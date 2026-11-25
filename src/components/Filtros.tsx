// Estado de los segmentadores, compartido entre las páginas del tablero (contexto React).
// Los valores iniciales salen de VALORES_INICIALES y, para los periodos, de la configuración guardada por el
// administrador (useConfiguracion) o, si no hay, de periodoInicial(modelo). Mientras el usuario no mueve un
// periodo, ese periodo sigue al guardado o al de los datos; si ya lo movió, no se le pisa.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useModelo } from "../datos/ModeloProvider";
import { useConfiguracion } from "../datos/lectura";
import { elegirPeriodo, mensualConfigurado, periodoConfigurado } from "../datos/periodos";
import { serialAIso } from "../medidas/contexto";
import { VALORES_INICIALES, type HorasConf, type HorasDisp } from "../medidas/contexto";
import type { Modelo } from "../medidas/modelo";
import { periodoInicial } from "../medidas/visuales";
import type { Periodo } from "./SegmentadorPeriodo";

export interface RangoDatos {
  /** Primer y último día con datos de paros ("" si no hay). */
  min: string;
  max: string;
}

/** Rango de fechas de los paros del modelo: del primer inicio al último fin. */
export function rangoDeDatos(modelo: Modelo | null): RangoDatos {
  if (!modelo || modelo.paros.length === 0) return { min: "", max: "" };
  let a = Infinity;
  let b = -Infinity;
  for (const p of modelo.paros) {
    if (p.inicio < a) a = p.inicio;
    if (p.fin > b) b = p.fin;
  }
  return { min: serialAIso(a).slice(0, 10), max: serialAIso(b).slice(0, 10) };
}

export interface Filtros {
  modelo: Modelo | null;
  rango: RangoDatos;
  /** Periodo de las páginas de familia y Resumen. */
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  /** Periodo propio de Disp Mensual. */
  periodoMensual: Periodo;
  setPeriodoMensual: (p: Periodo) => void;
  hDisp: HorasDisp;
  setHDisp: (v: HorasDisp) => void;
  tConf: HorasConf;
  setTConf: (v: HorasConf) => void;
  disp: string[];
  setDisp: (v: string[]) => void;
  /** Familia de Disp Mensual (selección única). */
  familia: string;
  setFamilia: (v: string) => void;
}

const Ctx = createContext<Filtros | null>(null);

export function useFiltros(): Filtros {
  const f = useContext(Ctx);
  if (!f) throw new Error("useFiltros debe usarse dentro de FiltrosProvider");
  return f;
}

/** Deja la fecha dentro del rango de datos (sin rango, la deja como está). */
function acotar(fecha: string, rango: RangoDatos): string {
  if (!rango.min || !rango.max) return fecha;
  return fecha < rango.min ? rango.min : fecha > rango.max ? rango.max : fecha;
}

function periodoAcotado(p: Periodo, rango: RangoDatos): Periodo {
  const desde = acotar(p.desde, rango);
  const hasta = acotar(p.hasta, rango);
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
}

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const { modelo } = useModelo();
  const rango = useMemo(() => rangoDeDatos(modelo), [modelo]);
  const inicial = useMemo(() => (modelo ? periodoInicial(modelo) : null), [modelo]);
  // Período guardado por el administrador (null si no hay o aún no llega).
  const { data: config } = useConfiguracion();

  // null = el usuario no lo ha tocado: se usa el periodo inicial de los datos.
  const [periodoUsuario, setPeriodo] = useState<Periodo | null>(null);
  const [mensualUsuario, setPeriodoMensual] = useState<Periodo | null>(null);
  const [hDisp, setHDisp] = useState<HorasDisp>(VALORES_INICIALES.hDisp);
  const [tConf, setTConf] = useState<HorasConf>(VALORES_INICIALES.tConf);
  const [disp, setDisp] = useState<string[]>(VALORES_INICIALES.disp);
  const [familia, setFamilia] = useState<string>(VALORES_INICIALES.familiaMensual);

  const acotarPeriodo = useCallback((p: Periodo) => periodoAcotado(p, rango), [rango]);

  // Prioridad: lo que movió el usuario, luego lo guardado por el administrador, luego el calculado de los datos.
  const periodo = useMemo<Periodo>(() => {
    const p = elegirPeriodo(
      periodoUsuario,
      periodoConfigurado(config),
      inicial ? { desde: inicial.general.ini, hasta: inicial.general.fin } : null,
    );
    return p ? acotarPeriodo(p) : { desde: "", hasta: "" };
  }, [periodoUsuario, config, inicial, acotarPeriodo]);

  const periodoMensual = useMemo<Periodo>(() => {
    const p = elegirPeriodo(
      mensualUsuario,
      mensualConfigurado(config),
      inicial ? { desde: inicial.mensual.ini, hasta: inicial.mensual.fin } : null,
    );
    return p ? acotarPeriodo(p) : { desde: "", hasta: "" };
  }, [mensualUsuario, config, inicial, acotarPeriodo]);

  const valor = useMemo<Filtros>(
    () => ({
      modelo, rango, periodo, setPeriodo, periodoMensual, setPeriodoMensual,
      hDisp, setHDisp, tConf, setTConf, disp, setDisp, familia, setFamilia,
    }),
    [modelo, rango, periodo, periodoMensual, hDisp, tConf, disp, familia],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
