// Orden de las 8 páginas del tablero (el mismo del reporte de Power BI). Lo usa el navegador de páginas
// ("‹  2 de 8  ›"). Las rutas de las páginas de familia coinciden con PAGINAS_FAMILIA (paginasFamilia.ts).

export interface PaginaOrden {
  ruta: string;
  titulo: string;
}

export const ORDEN_PAGINAS: readonly PaginaOrden[] = [
  { ruta: "/", titulo: "Portada" },
  { ruta: "/simba", titulo: "Disp Simba" },
  { ruta: "/jumbo", titulo: "Disp Jumbo" },
  { ruta: "/sostenimiento", titulo: "Disp Sostenimiento" },
  { ruta: "/st35", titulo: "Disp Scootram ST3.5" },
  { ruta: "/st1030", titulo: "Disp Scootram ST1030" },
  { ruta: "/resumen", titulo: "Resumen Disp." },
  { ruta: "/mensual", titulo: "Disp Mensual" },
];

/** Posición (base 0) de una ruta en el orden de páginas, o -1 si no es una página del tablero. */
export function indicePagina(ruta: string): number {
  const limpia = ruta.length > 1 ? ruta.replace(/\/+$/, "") : ruta;
  return ORDEN_PAGINAS.findIndex((p) => p.ruta === limpia);
}
