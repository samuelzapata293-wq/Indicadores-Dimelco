// Lógica pura de los períodos: qué valor inicial tiene cada segmentador y qué fechas muestra la portada.

import type { PeriodoAGuardar } from "./lectura";

export interface ParFechas {
  /** aaaa-mm-dd */
  desde: string;
  hasta: string;
}

/** Fila de la tabla configuracion (período compartido por todos). Los pares pueden faltar. */
export interface Configuracion {
  periodo_ini: string | null;
  periodo_fin: string | null;
  mensual_ini: string | null;
  mensual_fin: string | null;
}

const esFecha = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function par(ini: string | null | undefined, fin: string | null | undefined): ParFechas | null {
  return esFecha(ini) && esFecha(fin) && ini <= fin ? { desde: ini, hasta: fin } : null;
}

/** Período general guardado, o null si no hay configuración o el par está incompleto. */
export function periodoConfigurado(c: Configuracion | null | undefined): ParFechas | null {
  return c ? par(c.periodo_ini, c.periodo_fin) : null;
}

/** Período de Disp Mensual guardado, o null. */
export function mensualConfigurado(c: Configuracion | null | undefined): ParFechas | null {
  return c ? par(c.mensual_ini, c.mensual_fin) : null;
}

/**
 * Valor de un segmentador de período, por prioridad:
 * 1. lo que el usuario ya movió (nunca se pisa, aunque la configuración llegue después),
 * 2. el período guardado por el administrador,
 * 3. el calculado de los datos (periodoInicial).
 * Devuelve null si no hay ninguno (todavía no hay datos).
 */
export function elegirPeriodo(
  usuario: ParFechas | null,
  configurado: ParFechas | null,
  calculado: ParFechas | null,
): ParFechas | null {
  return usuario ?? configurado ?? calculado;
}

// ---- Guardado automático del período (solo administrador) ----

export type EstadoGuardado =
  | { fase: "reposo" }
  | { fase: "guardando" }
  | { fase: "ok" }
  | { fase: "error"; mensaje: string };

export const ESPERA_GUARDADO_MS = 1500;
export const VISIBLE_OK_MS = 4000;

export interface OpcionesPlanificador {
  /** Guarda en la base (y refresca la configuración). Puede lanzar error. */
  guardar: (p: PeriodoAGuardar) => Promise<void>;
  /** Solo el administrador guarda. Se consulta al programar y al vencer el plazo. */
  habilitado: () => boolean;
  onEstado: (e: EstadoGuardado) => void;
  /** Temporizador inyectable (por defecto setTimeout/clearTimeout). */
  poner?: (fn: () => void, ms: number) => unknown;
  quitar?: (id: unknown) => void;
  espera?: number;
}

export interface Planificador {
  /** El administrador movió un período: programa el guardado tras la espera sin más cambios. */
  cambiar: (cual: "general" | "mensual", p: ParFechas) => void;
  cancelar: () => void;
}

/** Planificador con debounce: junta los cambios de ambos pares y los guarda de una vez. */
export function crearPlanificador(o: OpcionesPlanificador): Planificador {
  const poner = o.poner ?? ((fn, ms) => setTimeout(fn, ms));
  const quitar = o.quitar ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const espera = o.espera ?? ESPERA_GUARDADO_MS;
  let pendiente: { general?: ParFechas; mensual?: ParFechas } = {};
  let temporizador: unknown = null;
  let temporizadorOk: unknown = null;

  const limpiar = (id: unknown) => {
    if (id !== null) quitar(id);
  };

  async function ejecutar() {
    temporizador = null;
    const p = pendiente;
    pendiente = {};
    if (!o.habilitado() || (!p.general && !p.mensual)) return;
    const envio: PeriodoAGuardar = {};
    if (p.general) {
      envio.periodoIni = p.general.desde;
      envio.periodoFin = p.general.hasta;
    }
    if (p.mensual) {
      envio.mensualIni = p.mensual.desde;
      envio.mensualFin = p.mensual.hasta;
    }
    o.onEstado({ fase: "guardando" });
    try {
      await o.guardar(envio);
      o.onEstado({ fase: "ok" });
      limpiar(temporizadorOk);
      temporizadorOk = poner(() => {
        temporizadorOk = null;
        o.onEstado({ fase: "reposo" });
      }, VISIBLE_OK_MS);
    } catch (e) {
      o.onEstado({ fase: "error", mensaje: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    cambiar(cual, p) {
      if (!o.habilitado()) return;
      pendiente[cual] = p;
      limpiar(temporizador);
      limpiar(temporizadorOk);
      temporizadorOk = null;
      temporizador = poner(() => void ejecutar(), espera);
    },
    cancelar() {
      limpiar(temporizador);
      limpiar(temporizadorOk);
      temporizador = null;
      temporizadorOk = null;
      pendiente = {};
    },
  };
}
