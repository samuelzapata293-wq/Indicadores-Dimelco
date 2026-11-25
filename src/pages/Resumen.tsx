// Resumen Disp.: tabla por equipo y tabla por familia (MTTR, MTBF, disponibilidad, confiabilidad).

import { useDeferredValue, useMemo } from "react";
import ConModelo from "../components/ConModelo";
import { Caja } from "../components/LienzoPbi";
import PaginaPbi from "../components/PaginaPbi";
import { useFiltros } from "../components/Filtros";
import SegmentadorBotones from "../components/SegmentadorBotones";
import SegmentadorLista from "../components/SegmentadorLista";
import IndicadorGuardado from "../components/IndicadorGuardado";
import SegmentadorPeriodo from "../components/SegmentadorPeriodo";
import TablaPbi, { type ColumnaPbi } from "../components/TablaPbi";
import { COLORES } from "../components/formato";
import { EQUIPOS_RESUMEN, type Contexto, type HorasConf, type HorasDisp } from "../medidas/contexto";
import type { Modelo } from "../medidas/modelo";
import {
  resumenPorEquipo,
  resumenPorFamilia,
  type FilaResumenEquipo,
  type FilaResumenFamilia,
} from "../medidas/visuales";
import { DISENO_RESUMEN as D } from "./disenos";
import { OPCIONES_DISP, OPCIONES_H_DISP, OPCIONES_T_CONF } from "./opciones";

const TITULO_PAGINA = "DISIPONIBILIDAD-MTTR-MTBF (Z4 NPI MEC-ELC)"; // con la errata del reporte original

const cumple = (f: { color: string }) => f.color === COLORES.verdeCumple;

const COLS_EQUIPO: ColumnaPbi<FilaResumenEquipo>[] = [
  { id: "id", titulo: "EQUIPO", valor: (f) => f.id, alinear: "der" },
  { id: "denominacion", titulo: "DENOMINACION", valor: (f) => f.descripcion },
  { id: "mttr", titulo: "MTTR_Horas", valor: (f) => f.mttrH, formato: "horas" },
  { id: "mtbf", titulo: "MTBF_Horas", valor: (f) => f.mtbfH, formato: "horas" },
  { id: "meta", titulo: "Meta_Disp", valor: (f) => f.metaDisp, formato: "pct0" },
  { id: "disp", titulo: "Disponibilidad %", valor: (f) => f.dispDin, formato: "pct0", semaforo: cumple },
  { id: "conf", titulo: "Confiabilidad %", valor: (f) => f.confiabilidad, formato: "pct2" },
  { id: "prob", titulo: "Prob. de Falla", valor: (f) => f.probFalla, formato: "pct2" },
];

const COLS_FAMILIA: ColumnaPbi<FilaResumenFamilia>[] = [
  { id: "familia", titulo: "Familia", valor: (f) => f.familia },
  { id: "mttr", titulo: "MTTR (Horas)", valor: (f) => f.mttrH, formato: "horas" },
  { id: "mtbf", titulo: "MTBF (Horas)", valor: (f) => f.mtbfH, formato: "horas" },
  { id: "disp", titulo: "Disponibilidad %", valor: (f) => f.dispDin, formato: "pct0" },
  { id: "conf", titulo: "Confiabilidad %", valor: (f) => f.confiabilidad, formato: "pct2" },
  { id: "prob", titulo: "Probabilidad de Falla", valor: (f) => f.probFalla, formato: "pct2" },
];

function Contenido({ modelo }: { modelo: Modelo }) {
  const f = useFiltros();
  const ctxBase = useDeferredValue(
    useMemo(
      () => ({ ini: f.periodo.desde, fin: f.periodo.hasta, disp: f.disp, hDisp: f.hDisp, tConf: f.tConf }),
      [f.periodo, f.disp, f.hDisp, f.tConf],
    ),
  );
  const ctx = useMemo<Contexto>(() => ({ ...ctxBase, equipos: [...EQUIPOS_RESUMEN] }), [ctxBase]);
  const porEquipo = useMemo(() => resumenPorEquipo(modelo, ctx), [modelo, ctx]);
  const porFamilia = useMemo(() => resumenPorFamilia(modelo, ctx), [modelo, ctx]);

  return (
    <>
      <Caja r={D.tablaEquipo} className="caja-tabla">
        <TablaPbi
          datos={porEquipo}
          columnas={COLS_EQUIPO}
          ordenInicial={{ id: "denominacion" }}
          alturaMax={720}
          idFila={(r) => String(r.id)}
          className="tabla-resumen"
        />
      </Caja>
      <Caja r={D.tablaFamilia} className="caja-tabla">
        <TablaPbi
          datos={porFamilia}
          columnas={COLS_FAMILIA}
          ordenInicial={{ id: "familia", desc: true }}
          idFila={(r) => r.familia}
        />
      </Caja>
    </>
  );
}

export default function Resumen() {
  const f = useFiltros();
  const lateral = (
    <>
      <Caja r={D.periodo}>
        <SegmentadorPeriodo valor={f.periodo} onChange={f.setPeriodo} min={f.rango.min} max={f.rango.max} />
        <IndicadorGuardado />
      </Caja>
      <Caja r={D.tConf}>
        <SegmentadorBotones
          titulo="Var t: Conf."
          opciones={OPCIONES_T_CONF}
          valor={f.tConf}
          onChange={(v) => f.setTConf(v as HorasConf)}
        />
      </Caja>
      <Caja r={D.hDisp}>
        <SegmentadorBotones
          titulo="Var t: Disp"
          opciones={OPCIONES_H_DISP}
          valor={f.hDisp}
          onChange={(v) => f.setHDisp(v as HorasDisp)}
        />
      </Caja>
      <Caja r={D.disp}>
        <SegmentadorLista titulo="DISP. GLOBAL" opciones={OPCIONES_DISP} seleccion={f.disp} onChange={f.setDisp} />
      </Caja>
    </>
  );
  return (
    <PaginaPbi titulo={TITULO_PAGINA} rectTitulo={D.titulo} rectPie={D.pie} lateral={lateral}>
      <ConModelo>{(modelo) => <Contenido modelo={modelo} />}</ConModelo>
    </PaginaPbi>
  );
}
