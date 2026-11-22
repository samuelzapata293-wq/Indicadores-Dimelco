import { useEffect, useMemo, useState } from "react";
import { COLORES, partirNombre, pct0 } from "./formato";
import { useEcharts } from "./useEcharts";
import "./componentes.css";

export interface EquipoDisp {
  id: string;
  nombre: string;
  /** Disponibilidad real, fracción 0..1. */
  disp: number;
  /** Meta, fracción 0..1. */
  meta: number;
  /** Color de la columna (COLORES.verdeCumple o COLORES.naranjaNoCumple). */
  color: string;
}

interface Props {
  titulo: string;
  equipos: EquipoDisp[];
  /** Equipo resaltado (filtro cruzado) o null. */
  seleccionado: string | null;
  onClickEquipo: (id: string | null) => void;
  alto?: number;
}

export default function GraficoDispFamilia({ titulo, equipos, seleccionado, onClickEquipo, alto = 380 }: Props) {
  const [ancho, setAncho] = useState(800);
  const angosto = ancho / Math.max(equipos.length, 1) < 150;
  const option = useMemo(() => {
    const lineas = equipos.length > 4 || angosto ? 3 : 2;
    const tope = Math.max(1, ...equipos.map((e) => Math.max(e.disp, e.meta))) * 1.12;
    return {
      animation: false,
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const e = equipos[p.dataIndex];
          return `${e.nombre}<br/>Disponibilidad: ${pct0(e.disp)}<br/>Meta: ${pct0(e.meta)}`;
        },
      },
      xAxis: {
        type: "category",
        data: equipos.map((e) => e.nombre),
        triggerEvent: true,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          interval: 0,
          color: "#555",
          fontSize: angosto ? 10 : 12,
          lineHeight: angosto ? 13 : 16,
          margin: 12,
          formatter: (v: string) => partirNombre(v, lineas),
        },
      },
      yAxis: { type: "value", min: 0, max: tope, show: false, splitLine: { show: false } },
      series: [
        {
          type: "bar",
          barWidth: "62%",
          data: equipos.map((e) => ({
            value: e.disp,
            itemStyle: { color: e.color, opacity: seleccionado === null || seleccionado === e.id ? 1 : 0.3 },
          })),
          label: {
            show: true,
            position: "top",
            formatter: (p: { value: number }) => pct0(p.value),
            backgroundColor: COLORES.amarilloEtiqueta,
            color: "#444",
            fontSize: 13,
            padding: [2, 6],
            borderRadius: 3,
          },
          z: 2,
        },
        {
          type: "line",
          silent: true,
          symbol: "circle",
          symbolSize: 1,
          itemStyle: { color: COLORES.metaLinea },
          lineStyle: { color: COLORES.metaLinea, width: 2 },
          data: equipos.map((e) => ({
            value: e.meta,
            label: { position: e.meta - e.disp > 0.05 ? "top" : "bottom" },
          })),
          label: {
            show: true,
            formatter: (p: { value: number }) => pct0(p.value),
            backgroundColor: COLORES.grisEtiqueta,
            color: "#fff",
            fontSize: 13,
            padding: [2, 6],
            borderRadius: 3,
            distance: 8,
          },
          z: 3,
        },
      ],
    };
  }, [equipos, seleccionado, angosto]);

  const ref = useEcharts(option, (p) => {
    let i = typeof p.dataIndex === "number" ? p.dataIndex : -1;
    if (p.componentType === "xAxis") i = equipos.findIndex((e) => e.nombre === p.value);
    if (i < 0 || i >= equipos.length) return;
    const id = equipos[i].id;
    onClickEquipo(seleccionado === id ? null : id);
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return (
    <div className="graf-familia">
      <h3 className="graf-titulo">{titulo}</h3>
      <div className="graf-cuerpo">
        <div ref={ref} className="graf-lienzo" style={{ height: alto }} role="img" aria-label={`Disponibilidad por equipo: ${titulo}`} />
        <div className="graf-leyenda">
          <span className="chip chip-amarillo">% Disponibilidad Real</span>
          <span className="chip chip-gris">-- Meta Disp %</span>
        </div>
      </div>
    </div>
  );
}
