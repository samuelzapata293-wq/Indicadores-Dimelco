// Campos derivados del contrato (sección 1.1). Funciones puras, sin dependencias.
//
// Representación de fecha-hora: NÚMERO DE DÍAS tipo serial de Excel (días desde
// 1899-12-30; la parte decimal es la hora del día, 0.5 = 12:00). No hay zona
// horaria ni horario de verano, así que restar dos valores da días exactos y
// `* 1440` da minutos. Es la representación que usa el motor de medidas.
// Con `serialADate` se obtiene un Date "local sin zona" (componentes UTC).

import type { Paro } from "./tipos";

const MS_DIA = 86_400_000;
/** Medianoche UTC de 1899-12-30 (origen del serial de Excel). */
const ORIGEN_EXCEL_MS = Date.UTC(1899, 11, 30);

/** "aaaa-mm-dd" -> días serial enteros. Devuelve NaN si el texto no es una fecha válida. */
export function fechaASerial(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return NaN;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((ms - ORIGEN_EXCEL_MS) / MS_DIA);
}

/** "hh:mm[:ss]" -> fracción de día. "24:00:00" da 1. NaN si no tiene el formato. */
export function horaAFraccion(hora: string): number {
  const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(hora ?? "");
  if (!m) return NaN;
  return (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0)) / 86400;
}

/** Días serial -> "aaaa-mm-dd" (parte entera). */
export function serialAFecha(serial: number): string {
  return new Date(ORIGEN_EXCEL_MS + Math.floor(serial) * MS_DIA).toISOString().slice(0, 10);
}

/** Días serial -> Date cuyos componentes UTC son la fecha-hora local (sin zona). */
export function serialADate(serial: number): Date {
  return new Date(ORIGEN_EXCEL_MS + Math.round(serial * MS_DIA));
}

/**
 * `_F/H Inicio` = fecha_inicio + hora_inicio. Igual que Power Query, "24:00:00"
 * se trata como "00:00:00" (mismo día), por si el dato no pasó por el importador.
 */
export function inicio(p: Pick<Paro, "fecha_inicio" | "hora_inicio">): number {
  const hora = p.hora_inicio.replace("24:00:00", "00:00:00");
  return fechaASerial(p.fecha_inicio) + horaAFraccion(hora);
}

/** `_F/H Fin` = fecha_fin + hora_fin. "24:00:00" no se cambia: suma un día completo. */
export function fin(p: Pick<Paro, "fecha_fin" | "hora_fin">): number {
  return fechaASerial(p.fecha_fin) + horaAFraccion(p.hora_fin);
}

/**
 * Text.Proper de Power Query: cada letra que sigue a un carácter que no es letra
 * va en mayúscula y las demás en minúscula ("1st" -> "1St", "o'neil" -> "O'Neil").
 */
export function textoProper(texto: string): string {
  let anteriorLetra = false;
  let salida = "";
  for (const c of texto) {
    const esLetra = /\p{L}/u.test(c);
    salida += esLetra ? (anteriorLetra ? c.toLowerCase() : c.toUpperCase()) : c;
    anteriorLetra = esLetra;
  }
  return salida;
}

/**
 * `tipo_paro` = Text.AfterDelimiter(Text.Proper(resumen), " "): lo que sigue al
 * primer espacio. Sin espacio (o texto vacío) devuelve "".
 */
export function tipoParo(resumen: string): string {
  const proper = textoProper(resumen ?? "");
  const i = proper.indexOf(" ");
  return i < 0 ? "" : proper.slice(i + 1);
}

/** `disp`: "-MTO-" -> Mecánica; "-OPE-" u "-OPH-" -> Operacional; si no, el propio id. */
export function disp(idResponsable: string): string {
  const id = idResponsable ?? "";
  if (id.includes("-MTO-")) return "Mecánica";
  if (id.includes("-OPE-") || id.includes("-OPH-")) return "Operacional";
  return id;
}

/** `responsable`: igual que disp pero con "Mantenimiento" y "Operación". */
export function responsable(idResponsable: string): string {
  const id = idResponsable ?? "";
  if (id.includes("-MTO-")) return "Mantenimiento";
  if (id.includes("-OPE-") || id.includes("-OPH-")) return "Operación";
  return id;
}

/** `minutos_ajustados` = INT(d / 1440) * 1080 + MIN(MOD(d, 1440), 1080). */
export function minutosAjustados(duracionMin: number): number {
  const dias = Math.floor(duracionMin / 1440);
  const resto = duracionMin - dias * 1440;
  return dias * 1080 + Math.min(resto, 1080);
}
