// Plantilla de las páginas de familia (Simba, Jumbo, Sostenimiento, ST3.5 y ST1030):
// gráfico de disponibilidad por equipo con filtro cruzado sobre la tabla de paros.

import { useDeferredValue, useMemo, useState } from "react";
import ConModelo from "../components/ConModelo";
import { useFiltros } from "../components/Filtros";
import GraficoDispFamilia, { ChipMeta, ChipReal, type EquipoDisp } from "../components/GraficoDispFamilia";
import { Caja } from "../components/LienzoPbi";
import PaginaPbi from "../components/PaginaPbi";
import SegmentadorBotones from "../components/SegmentadorBotones";
import SegmentadorLista from "../components/SegmentadorLista";
import IndicadorGuardado from "../components/IndicadorGuardado";
import SegmentadorPeriodo from "../components/SegmentadorPeriodo";
import TablaPbi, { type ColumnaPbi } from "../components/TablaPbi";
import type { Contexto, HorasDisp } from "../medidas/contexto";
import type { Modelo } from "../medidas/modelo";
import { graficoFamilia, tablaParos, type FilaParo } from "../medidas/visuales";
import type { DisenoFamilia } from "./disenos";
import { nombreCorto } from "./nombresCortos";
import { OPCIONES_DISP, OPCIONES_H_DISP } from "./opciones";

const TITULO_PAGINA = "DISPONIBILIDADES";

interface Props {
  /** Título del gráfico ("Tiro Largo"). */
  titulo: string;
  /** id_equipo de las columnas del gráfico. */
  equiposGrafico: readonly number[];
  /** id_equipo de la tabla de paros (en ST3.5 y ST1030, los 8 scoops). */
  equiposTabla: readonly number[];
  /** Posiciones de los visuales en el lienzo de escritorio. */
  diseno: DisenoFamilia;
}

const COLUMNAS: ColumnaPbi<FilaParo>[] = [
  { id: "sap", titulo: "Sap", valor: (f) => f.sap, alinear: "der" },
  { id: "equipo", titulo: "Equipo", valor: (f) => nombreCorto(f.sap, f.equipo) },
  { id: "aviso", titulo: "Aviso", valor: (f) => f.aviso, alinear: "der" },
  { id: "descripcion", titulo: "Descripción del Paro", valor: (f) => f.descripcion },
  { id: "inicio", titulo: "Inicio del Paro", valor: (f) => f.inicio, formato: "fechaHora" },
  { id: "fin", titulo: "Fin del Paro", valor: (f) => f.fin, formato: "fechaHora" },
  { id: "hrs", titulo: "Hrs de Paro", valor: (f) => f.hrsParoVentana, formato: "horas" },
  { id: "responsable", titulo: "Responsable", valor: (f) => f.responsable, sinPartir: true },
  { id: "tipo", titulo: "Tipo de Paro", valor: (f) => f.tipoParo, sinPartir: true },
];

function Contenido({ modelo, titulo, equiposGrafico, equiposTabla, diseno }: Props & { modelo: Modelo }) {
  const f = useFiltros();
  const [equipo, setEquipo] = useState<string | null>(null);

  // El contexto se difiere: al mover un filtro, la interfaz responde primero y el cálculo sigue después.
  const ctxBase = useDeferredValue(
    useMemo(
      () => ({ ini: f.periodo.desde, fin: f.periodo.hasta, disp: f.disp, hDisp: f.hDisp, tConf: f.tConf }),
      [f.periodo, f.disp, f.hDisp, f.tConf],
    ),
  );

  const filasGrafico = useMemo(() => {
    const ctx: Contexto = { ...ctxBase, equipos: [...equiposGrafico] };
    return graficoFamilia(modelo, ctx);
  }, [modelo, ctxBase, equiposGrafico]);

  const equipos = useMemo<EquipoDisp[]>(
    () =>
      filasGrafico.map((r) => ({ id: String(r.id), nombre: nombreCorto(r.id, r.descripcion), disp: r.dispDin, meta: r.metaDisp, color: r.color })),
    [filasGrafico],
  );

  const filasTabla = useMemo(() => {
    const ctx: Contexto = { ...ctxBase, equipos: [...equiposTabla] };
    return tablaParos(modelo, ctx);
  }, [modelo, ctxBase, equiposTabla]);

  // Filtro cruzado: clic en una columna del gráfico deja en la tabla solo ese equipo.
  const filasVisibles = useMemo(
    () => (equipo ? filasTabla.filter((r) => String(r.sap) === equipo) : filasTabla),
    [filasTabla, equipo],
  );

  return (
    <>
      <Caja r={diseno.grafico}>
        <GraficoDispFamilia titulo={titulo} equipos={equipos} seleccionado={equipo} onClickEquipo={setEquipo} />
      </Caja>
      <Caja r={diseno.chipReal} soloLienzo>
        <ChipReal />
      </Caja>
      <Caja r={diseno.chipMeta} soloLienzo>
        <ChipMeta />
      </Caja>
      <Caja r={diseno.tabla} className="caja-tabla">
        <TablaPbi
          datos={filasVisibles}
          columnas={COLUMNAS}
          ordenInicial={{ id: "hrs", desc: true }}
          alturaMax={300}
          idFila={(r, i) => `${r.sap}-${r.aviso}-${r.inicioSerial}-${i}`}
          mensajeVacio="Sin paros en el periodo."
          className="tabla-paros"
          etiqueta="Tabla de paros"
        />
      </Caja>
    </>
  );
}

export default function PaginaFamilia(props: Props) {
  const f = useFiltros();
  const d = props.diseno;
  const lateral = (
    <>
      <Caja r={d.periodo}>
        <SegmentadorPeriodo valor={f.periodo} onChange={f.setPeriodo} min={f.rango.min} max={f.rango.max} />
        <IndicadorGuardado />
      </Caja>
      <Caja r={d.hDisp}>
        <SegmentadorBotones
          titulo="Var t: Disp"
          opciones={OPCIONES_H_DISP}
          valor={f.hDisp}
          onChange={(v) => f.setHDisp(v as HorasDisp)}
        />
      </Caja>
      <Caja r={d.disp}>
        <SegmentadorLista titulo="DISP. GLOBAL" opciones={OPCIONES_DISP} seleccion={f.disp} onChange={f.setDisp} />
      </Caja>
    </>
  );
  return (
    <PaginaPbi titulo={TITULO_PAGINA} lateral={lateral}>
      <ConModelo>{(modelo) => <Contenido modelo={modelo} {...props} />}</ConModelo>
    </PaginaPbi>
  );
}
