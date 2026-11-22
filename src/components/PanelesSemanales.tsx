import { useMemo } from "react";
import { COLORES, pct0 } from "./formato";
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

function Panel({ panel }: { panel: PanelSemanal }) {
  const option = useMemo(
    () => ({
      animation: false,
      grid: { left: 6, right: 14, top: 34, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) => pct0(v),
      },
      xAxis: {
        type: "category",
        data: panel.semanas,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#999" } },
        axisLabel: { interval: 0, rotate: 90, fontSize: 11, color: "#555" },
      },
      yAxis: { type: "value", show: false, min: -0.04, max: 1.15 },
      series: [
        {
          name: "Disponibilidad%",
          type: "line",
          data: panel.disp,
          symbol: "circle",
          symbolSize: 1,
          lineStyle: { color: COLORES.lineaDisp, width: 2.5 },
          itemStyle: { color: COLORES.lineaDisp },
          label: { show: true, position: "top", formatter: (p: { value: number }) => pct0(p.value), fontSize: 10, color: "#555" },
        },
        {
          name: "Meta Disp",
          type: "line",
          data: panel.meta,
          symbol: "circle",
          symbolSize: 1,
          lineStyle: { color: COLORES.lineaMeta, width: 2.5, type: [4, 3] },
          itemStyle: { color: COLORES.lineaMeta },
          label: { show: true, position: "bottom", formatter: (p: { value: number }) => pct0(p.value), fontSize: 10, color: "#555" },
        },
      ],
    }),
    [panel]
  );
  const ref = useEcharts(option);
  return (
    <div className="panel-sem">
      <h4 className="panel-sem-titulo">{panel.titulo}</h4>
      <div ref={ref} className="panel-sem-lienzo" role="img" aria-label={`Disponibilidad semanal: ${panel.titulo}`} />
    </div>
  );
}

interface Props {
  titulo?: string;
  paneles: PanelSemanal[];
}

/** Cuadrícula de dos columnas con un panel por equipo; con más de 4 paneles hace scroll vertical interno. */
export default function PanelesSemanales({ titulo, paneles }: Props) {
  return (
    <div className="paneles">
      {titulo && <h3 className="graf-titulo">{titulo}</h3>}
      <div className="paneles-leyenda">
        <span><i className="punto" style={{ background: COLORES.lineaDisp }} />Disponibilidad%</span>
        <span><i className="punto" style={{ background: COLORES.lineaMeta }} />Meta Disp</span>
      </div>
      <div className={paneles.length > 4 ? "paneles-rejilla con-scroll" : "paneles-rejilla"}>
        {paneles.map((p) => (
          <Panel key={p.id} panel={p} />
        ))}
      </div>
    </div>
  );
}
