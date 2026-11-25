// Disp Mensual: un panel por equipo con la disponibilidad semanal y su meta.

import { useDeferredValue, useMemo } from "react";
import ConModelo from "../components/ConModelo";
import DisposicionPbi from "../components/DisposicionPbi";
import { useFiltros } from "../components/Filtros";
import PanelesSemanales, { type PanelSemanal } from "../components/PanelesSemanales";
import SegmentadorBotones from "../components/SegmentadorBotones";
import SegmentadorLista, { type OpcionLista } from "../components/SegmentadorLista";
import IndicadorGuardado from "../components/IndicadorGuardado";
import SegmentadorPeriodo from "../components/SegmentadorPeriodo";
import { EQUIPOS_RESUMEN, type Contexto, type HorasDisp } from "../medidas/contexto";
import type { Modelo } from "../medidas/modelo";
import { panelesSemanales } from "../medidas/visuales";
import { OPCIONES_DISP, OPCIONES_H_DISP } from "./opciones";

function Contenido({ modelo }: { modelo: Modelo }) {
  const f = useFiltros();

  // Familias que tienen equipos en esta página, en orden alfabético (como el segmentador del reporte).
  const opcionesFamilia = useMemo<OpcionLista[]>(() => {
    const familias = new Set<string>();
    for (const id of EQUIPOS_RESUMEN) {
      const e = modelo.equipos.get(id);
      if (e) familias.add(e.familia);
    }
    return [...familias].sort((a, b) => a.localeCompare(b, "es")).map((x) => ({ valor: x, etiqueta: x }));
  }, [modelo]);

  const ctxBase = useDeferredValue(
    useMemo(
      () => ({ ini: f.periodoMensual.desde, fin: f.periodoMensual.hasta, disp: f.disp, hDisp: f.hDisp, tConf: f.tConf, familia: f.familia }),
      [f.periodoMensual, f.disp, f.hDisp, f.tConf, f.familia],
    ),
  );

  const paneles = useMemo<PanelSemanal[]>(() => {
    const { familia, ...resto } = ctxBase;
    const equipos = EQUIPOS_RESUMEN.filter((id) => modelo.equipos.get(id)?.familia === familia);
    const ctx: Contexto = { ...resto, equipos };
    return panelesSemanales(modelo, ctx).map((p) => ({
      id: String(p.id),
      titulo: p.descripcion,
      semanas: p.puntos.map((x) => x.etiqueta),
      disp: p.puntos.map((x) => x.dispDin),
      meta: p.puntos.map((x) => x.metaDisp),
    }));
  }, [modelo, ctxBase]);

  const lateral = (
    <>
      <SegmentadorPeriodo valor={f.periodoMensual} onChange={f.setPeriodoMensual} min={f.rango.min} max={f.rango.max} />
      <IndicadorGuardado />
      <SegmentadorBotones
        titulo="Var t: Disp"
        opciones={OPCIONES_H_DISP}
        valor={f.hDisp}
        onChange={(v) => f.setHDisp(v as HorasDisp)}
      />
      <SegmentadorLista titulo="DISP. GLOBAL" opciones={OPCIONES_DISP} seleccion={f.disp} onChange={f.setDisp} />
      <SegmentadorLista
        titulo="Familia"
        modo="unica"
        opciones={opcionesFamilia}
        seleccion={f.familia}
        onChange={f.setFamilia}
      />
    </>
  );

  return (
    <DisposicionPbi lateral={lateral} anchoLateral={330}>
      <PanelesSemanales titulo="Evolución semanal de disponibilidades %" paneles={paneles} />
    </DisposicionPbi>
  );
}

export default function Mensual() {
  return <ConModelo>{(modelo) => <Contenido modelo={modelo} />}</ConModelo>;
}
