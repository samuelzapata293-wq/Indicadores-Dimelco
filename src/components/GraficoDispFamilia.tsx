import { useEffect, useMemo, useState } from "react";
import { COLORES, FUENTE_GRAFICOS, lineasEnvueltas, partirNombre, pct0 } from "./formato";
import { useModoPagina } from "./LienzoPbi";
import { useEcharts } from "./useEcharts";
import "./componentes.css";

export interface EquipoDisp {
  id: string;
  nombre: string;
  /** Disponibilidad real, fracción 0..1 (null = en blanco). */
  disp: number | null;
  /** Meta, fracción 0..1 (null = en blanco). */
  meta: number | null;
  /** Color de la columna (COLORES.verdeCumple o COLORES.naranjaNoCumple). */
  color: string;
}

interface Props {
  titulo: string;
  equipos: EquipoDisp[];
  /** Equipo resaltado (filtro cruzado) o null. */
  seleccionado: string | null;
  onClickEquipo: (id: string | null) => void;
  /** Alto del área del gráfico en la versión apilada (en el lienzo llena su caja). */
  alto?: number;
}

const ETIQUETA_BASE = {
  show: true,
  fontSize: 14,
  lineHeight: 15,
  padding: [1, 8, 1, 8],
  borderRadius: 3,
};

/** Geometría del lienzo, medida en el reporte: márgenes del área de trazado y ancho máximo por equipo. */
const LIENZO = { izquierda: 75, derecha: 50, anchoMaxCategoria: 215, arriba: 19, holgura: 1.15 };

export default function GraficoDispFamilia({ titulo, equipos, seleccionado, onClickEquipo, alto = 380 }: Props) {
  const lienzo = useModoPagina() === "lienzo";
  const [ancho, setAncho] = useState(800);
  const angosto = ancho / Math.max(equipos.length, 1) < 150;

  const option = useMemo(() => {
    const n = Math.max(equipos.length, 1);
    const maximo = Math.max(0.01, ...equipos.map((e) => Math.max(e.disp ?? 0, e.meta ?? 0)));

    // Lienzo: el área de trazado y las etiquetas siguen las medidas del reporte (columnas de hasta
    // 215 px centradas, eje Y oculto con 15 % de holgura sobre el mayor valor).
    let grid: Record<string, number | boolean>;
    let etiquetaEje: Record<string, unknown>;
    let tope: number;
    if (lienzo) {
      const disponible = Math.max(ancho - LIENZO.izquierda - LIENZO.derecha, 100);
      const categoria = Math.min(disponible / n, LIENZO.anchoMaxCategoria);
      const izquierda = LIENZO.izquierda + (disponible - categoria * n) / 2;
      const anchoEtiqueta = Math.max(categoria - 10, 40);
      const lineas = Math.max(1, ...equipos.map((e) => lineasEnvueltas(e.nombre, anchoEtiqueta, `12px ${FUENTE_GRAFICOS}`)));
      grid = { left: izquierda, right: ancho - izquierda - categoria * n, top: LIENZO.arriba, bottom: 19 + 15 * lineas, containLabel: false };
      etiquetaEje = { width: anchoEtiqueta, overflow: "break", fontSize: 12, lineHeight: 15, margin: 12, color: COLORES.textoEje };
      tope = maximo * LIENZO.holgura;
    } else {
      // Con nombres cortos, en un gráfico ancho cada nombre cabe en una línea; solo se parte si es angosto.
      const lineas = !angosto ? 1 : equipos.length > 4 ? 3 : 2;
      grid = { left: 8, right: 8, top: 36, bottom: 8, containLabel: true };
      etiquetaEje = {
        color: COLORES.textoEje,
        fontSize: angosto ? 10 : 12,
        lineHeight: angosto ? 13 : 16,
        margin: 12,
        formatter: (v: string) => partirNombre(v, lineas),
      };
      tope = Math.max(1, maximo) * 1.12;
    }

    return {
      animation: false,
      textStyle: { fontFamily: FUENTE_GRAFICOS },
      grid,
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
        axisLabel: { interval: 0, ...etiquetaEje },
      },
      yAxis: { type: "value", min: 0, max: tope, show: false, splitLine: { show: false } },
      series: [
        {
          type: "bar",
          barWidth: lienzo ? "75%" : "62%",
          data: equipos.map((e) => ({
            value: e.disp,
            itemStyle: { color: e.color, opacity: seleccionado === null || seleccionado === e.id ? 1 : 0.3 },
          })),
          label: {
            ...ETIQUETA_BASE,
            position: "top",
            distance: 5,
            formatter: (p: { value: number | null }) => pct0(p.value),
            backgroundColor: COLORES.amarilloEtiqueta,
            color: COLORES.textoOscuro,
          },
          z: 2,
        },
        {
          type: "line",
          silent: true,
          // Con symbol "none" ECharts no dibuja las etiquetas: se usa un punto de 1 px.
          symbol: "circle",
          symbolSize: 1,
          lineStyle: { color: COLORES.metaLinea, width: 2.5 },
          itemStyle: { color: COLORES.metaLinea },
          data: equipos.map((e) => ({
            value: e.meta,
            // Como en el reporte: arriba de la línea si la meta supera a la columna (para no tapar su
            // etiqueta), salvo que la columna esté vacía (0 %), donde va debajo.
            label: { position: (e.disp ?? 0) >= 0.05 && (e.meta ?? 0) - (e.disp ?? 0) > 0.05 ? "top" : "bottom" },
          })),
          label: {
            ...ETIQUETA_BASE,
            formatter: (p: { value: number | null }) => pct0(p.value),
            backgroundColor: COLORES.grisEtiqueta,
            color: "#fff",
            distance: 8,
          },
          z: 3,
        },
      ],
    };
  }, [equipos, seleccionado, angosto, lienzo, ancho]);

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
    setAncho(el.clientWidth || 800);
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) setAncho(el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return (
    <div className="graf-familia">
      <h3 className="graf-titulo">{titulo}</h3>
      <div className="graf-cuerpo">
        <div
          ref={ref}
          className="graf-lienzo"
          style={lienzo ? undefined : { height: alto }}
          role="img"
          aria-label={`Disponibilidad por equipo: ${titulo}`}
        />
        {!lienzo && <LeyendaDisp />}
      </div>
    </div>
  );
}

/** Leyenda del gráfico (en el lienzo, cada chip va en su propia caja con la posición del reporte). */
export function LeyendaDisp() {
  return (
    <div className="graf-leyenda">
      <ChipReal />
      <ChipMeta />
    </div>
  );
}

export function ChipReal() {
  return <span className="chip chip-amarillo">% Disponibilidad Real</span>;
}

export function ChipMeta() {
  return <span className="chip chip-gris">-- Meta Disp %</span>;
}
