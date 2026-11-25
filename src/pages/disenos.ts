// Posiciones de los visuales en el lienzo de cada página, en coordenadas de la página de Power BI
// (docs/powerbi/paginas.txt y docs/powerbi/pbir/<id>/page.json). Todas las páginas miden 1280x720.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const TAMANO_PAGINA = { ancho: 1280, alto: 720 } as const;

/**
 * Elementos comunes de las páginas con banda: flecha de volver, título y texto del pie (en el lugar
 * donde la plantilla traía "© 2025 Mineros", alineado a su borde derecho).
 */
export const BASE = {
  volver: r(0, 0, 40, 40),
  titulo: r(55, 31, 355, 50),
  pie: r(806, 674, 380, 16),
} as const;

export interface DisenoFamilia {
  periodo: Rect;
  hDisp: Rect;
  disp: Rect;
  grafico: Rect;
  chipReal: Rect;
  chipMeta: Rect;
  tabla: Rect;
}

// DISP SIMBA y DISP JUMBO comparten disposición.
const FAMILIA_BASE: DisenoFamilia = {
  periodo: r(0, 106, 240, 70),
  hDisp: r(0, 177, 240, 62),
  disp: r(0, 240, 240, 121),
  grafico: r(246, 106, 811, 338),
  chipReal: r(981, 141, 155, 34),
  chipMeta: r(981, 191, 155, 34),
  tabla: r(0, 445, 1280, 225),
};

export const DISENOS_FAMILIA = {
  simba: FAMILIA_BASE,
  jumbo: FAMILIA_BASE,
  sostenimiento: { ...FAMILIA_BASE, chipReal: r(1009, 147, 155, 34), chipMeta: r(1009, 197, 155, 34) },
  st35: { ...FAMILIA_BASE, grafico: r(246, 106, 812, 338) },
  st1030: {
    ...FAMILIA_BASE,
    grafico: r(246, 106, 1016, 338),
    chipReal: r(148, 350, 155, 34),
    chipMeta: r(148, 400, 155, 34),
    tabla: r(0, 436, 1280, 225),
  },
} satisfies Record<string, DisenoFamilia>;

export type PaginaFamiliaId = keyof typeof DISENOS_FAMILIA;

export const DISENO_RESUMEN = {
  titulo: r(55, 31, 860, 50),
  periodo: r(0, 106, 255, 70),
  tConf: r(0, 176, 255, 61),
  hDisp: r(0, 239, 254, 62),
  disp: r(0, 302, 254, 119),
  tablaEquipo: r(255, 81, 991, 473),
  tablaFamilia: r(328, 536, 915, 178),
  // La tabla por familia tapa el lugar del pie: aquí va pegado al borde inferior.
  pie: r(806, 702, 380, 16),
} as const;

export const DISENO_MENSUAL = {
  periodo: r(0, 106, 240, 70),
  hDisp: r(0, 177, 240, 62),
  disp: r(0, 240, 240, 121),
  familia: r(0, 360, 275, 218),
  paneles: r(275, 105, 1003, 561),
} as const;

export const DISENO_PORTADA = {
  titulo: r(16, 123, 956, 98),
  botones: r(16, 456, 1216, 70),
  fecha: r(725, 683, 555, 36),
} as const;
