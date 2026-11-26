import { useMemo } from "react";
import { COLORES, FUENTE_GRAFICOS, pct0 } from "./formato";
import { useModoPagina } from "./LienzoPbi";
import { useEcharts } from "./useEcharts";
import "./componentes.css";

export interface PanelSemanal {
  id: string;
  titulo: string;
  /** Etiquetas de semana, p. ej. "Sem 45/26". */
  semanas: string[];
  /** Disponibilidad por semana, fracción 0..1 (null = sin dato). */
  disp: (number | null)[];
  /** Meta por semana, fracción 0..1. */
  meta: (number | null)[];
}

/** Márgenes horizontales del área de trazado en el lienzo (iguales en los paneles y en los ejes de abajo). */
const MARGEN_LIENZO = { left: 28, right: 23 };

/**
 * Etiquetas alternadas arriba y abajo del punto, como las acomoda Power BI cuando las semanas están juntas.
 * `primera` es la posición del primer punto.
 */
function alternar(valores: (number | null)[], primera: "top" | "bottom") {
  const otra = primera === "top" ? "bottom" : "top";
  return valores.map((value, i) => {
    // Cerca de 0 % la etiqueta va siempre arriba, para no salirse del panel.
    const position = value !== null && value < 0.1 ? "top" : i % 2 === 0 ? primera : otra;
    return { value, label: { position } };
  });
}

function Panel({ panel, lienzo }: { panel: PanelSemanal; lienzo: boolean }) {
  const option = useMemo(() => {
    // Holgura sobre el 100 % para que las etiquetas de arriba no toquen el título del panel.
    const maximo = Math.max(1, ...panel.disp.map((v) => v ?? 0), ...panel.meta.map((v) => v ?? 0)) * (lienzo ? 1.06 : 1);
    const etiqueta = { show: true, minMargin: 3, formatter: (p: { value: number }) => pct0(p.value), color: COLORES.textoEje };
    return {
      animation: false,
      textStyle: { fontFamily: FUENTE_GRAFICOS },
      grid: lienzo
        ? { ...MARGEN_LIENZO, top: 40, bottom: 13, containLabel: false }
        : { left: 6, right: 14, top: 34, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => pct0(v),
      },
      xAxis: {
        type: "category",
        data: panel.semanas,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { show: !lienzo, lineStyle: { color: "#999" } },
        // En el lienzo las semanas van una sola vez, abajo de la cuadrícula (como en el reporte).
        axisLabel: lienzo ? { show: false } : { interval: 0, rotate: 90, fontSize: 11, color: COLORES.textoEje },
      },
      yAxis: lienzo ? { type: "value", show: false, min: 0, max: maximo } : { type: "value", show: false, min: -0.04, max: 1.15 },
      series: [
        {
          name: "Disponibilidad%",
          type: "line",
          data: lienzo ? alternar(panel.disp, "top") : panel.disp,
          symbol: "circle",
          symbolSize: 1,
          lineStyle: { color: COLORES.lineaDisp, width: lienzo ? 3 : 2.5 },
          itemStyle: { color: COLORES.lineaDisp },
          label: { ...etiqueta, position: "top", fontSize: lienzo ? 13.33 : 10 },
          labelLayout: { hideOverlap: true },
        },
        {
          name: "Meta Disp",
          type: "line",
          data: lienzo ? alternar(panel.meta, "bottom") : panel.meta,
          symbol: "circle",
          symbolSize: 1,
          lineStyle: { color: COLORES.lineaMeta, width: lienzo ? 3 : 2.5, type: lienzo ? [5, 3] : [4, 3] },
          itemStyle: { color: COLORES.lineaMeta },
          label: { ...etiqueta, position: "bottom", fontSize: lienzo ? 13.33 : 10 },
          labelLayout: { hideOverlap: true },
        },
      ],
    };
  }, [panel, lienzo]);
  const ref = useEcharts(option);
  return (
    <div className="panel-sem">
      <h4 className="panel-sem-titulo">{panel.titulo}</h4>
      <div ref={ref} className="panel-sem-lienzo" role="img" aria-label={`Disponibilidad semanal: ${panel.titulo}`} />
    </div>
  );
}

/** Eje de semanas compartido, debajo de una columna de paneles (solo en el lienzo). */
function EjeSemanas({ semanas }: { semanas: string[] }) {
  const option = useMemo(
    () => ({
      animation: false,
      textStyle: { fontFamily: FUENTE_GRAFICOS },
      grid: { ...MARGEN_LIENZO, top: 0, bottom: 69, containLabel: false },
      xAxis: {
        type: "category",
        data: semanas,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { interval: 0, rotate: 90, fontSize: 12, color: COLORES.textoEje, margin: 6 },
      },
      yAxis: { type: "value", show: false, min: 0, max: 1 },
      series: [{ type: "line", silent: true, symbol: "none", data: semanas.map(() => null) }],
    }),
    [semanas],
  );
  const ref = useEcharts(option);
  return <div ref={ref} className="paneles-eje" aria-hidden="true" />;
}

interface Props {
  titulo?: string;
  paneles: PanelSemanal[];
}

/** Cuadrícula de dos columnas con un panel por equipo; con más de 4 paneles hace scroll vertical interno. */
export default function PanelesSemanales({ titulo, paneles }: Props) {
  const lienzo = useModoPagina() === "lienzo";
  const semanas = paneles[0]?.semanas ?? [];
  return (
    <div className="paneles">
      {titulo && <h3 className="graf-titulo">{titulo}</h3>}
      <div className="paneles-leyenda">
        <span><i className="punto" style={{ background: COLORES.lineaDisp }} />Disponibilidad%</span>
        <span><i className="punto" style={{ background: COLORES.lineaMeta }} />Meta Disp</span>
      </div>
      <div className={paneles.length > 4 ? "paneles-rejilla con-scroll" : "paneles-rejilla"}>
        {paneles.map((p) => (
          <Panel key={p.id} panel={p} lienzo={lienzo} />
        ))}
      </div>
      {lienzo && paneles.length > 0 && (
        <div className="paneles-ejes">
          <EjeSemanas semanas={semanas} />
          {paneles.length > 1 && <EjeSemanas semanas={semanas} />}
        </div>
      )}
    </div>
  );
}
