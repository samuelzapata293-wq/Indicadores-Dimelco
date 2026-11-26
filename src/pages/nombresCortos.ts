// Nombres cortos de los equipos para el gráfico, la tabla de paros y Disp Mensual
// (Resumen Disp. conserva el nombre completo). Se indexan por id_equipo.

export const NOMBRES_CORTOS: Readonly<Record<number, string>> = {
  618487: "SIMBA S7 N°1",
  100618: "SIMBA S7 N°2",
  100660: "SIMBA S7 N°3",
  618269: "BOOMER 282 No. 01",
  100636: "BOOMER 282 No. 02",
  620903: "BOOMER 282 No. 03",
  618321: "SCALEMIN",
  100647: "SCALEMIN No.2",
  618320: "BOLTEC N°1",
  621321: "BOLTEC S10 N°2",
  100362: "SCOOP 3.50 N°5 (WAGNER)",
  618486: "SCOOP 3.50 N°6",
  618270: "ST1030 No. 01",
  100615: "ST1030 No. 02",
  100635: "ST1030 No. 03",
  100655: "ST1030 No. 04",
  100656: "ST1030 No. 05",
  100657: "ST1030 No. 06",
};

/** Nombre corto del equipo o, si el id no está en el mapa, el nombre completo. */
export function nombreCorto(id: number | string, nombreCompleto: string): string {
  return NOMBRES_CORTOS[Number(id)] ?? nombreCompleto;
}
