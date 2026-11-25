// Lógica pura de los períodos: qué valor inicial tiene cada segmentador y qué fechas muestra la portada.

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
