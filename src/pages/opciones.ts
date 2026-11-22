import type { OpcionLista } from "../components/SegmentadorLista";
import type { OpcionSeg } from "../components/SegmentadorBotones";

/** DISP. GLOBAL: los valores son los del campo `disp` de los paros. */
export const OPCIONES_DISP: OpcionLista[] = [
  { valor: "Mecánica", etiqueta: "Mecánica" },
  { valor: "Operacional", etiqueta: "Operacional" },
];

export const OPCIONES_H_DISP: OpcionSeg<number>[] = [
  { valor: 18, etiqueta: "18 hrs" },
  { valor: 24, etiqueta: "24 hrs" },
];

export const OPCIONES_T_CONF: OpcionSeg<number>[] = [
  { valor: 12, etiqueta: "12 hrs" },
  { valor: 18, etiqueta: "18 hrs" },
  { valor: 24, etiqueta: "24 hrs" },
];
