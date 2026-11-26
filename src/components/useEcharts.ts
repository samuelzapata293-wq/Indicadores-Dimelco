import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import type { EChartsCoreOption, ECharts } from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";

// SVG: el lienzo de escritorio se escala con transform y el SVG queda nítido a cualquier escala.
echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LabelLayout, SVGRenderer]);

/**
 * Crea una instancia de ECharts en un div, la redimensiona con ResizeObserver
 * y la actualiza cuando cambia `option`. `onClick` recibe el evento de clic del gráfico.
 */
export function useEcharts(
  option: EChartsCoreOption,
  onClick?: (params: Record<string, unknown>) => void
) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chartRef.current = chart;
    chart.on("click", (p) => clickRef.current?.(p as unknown as Record<string, unknown>));
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) chart.resize();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return ref;
}
