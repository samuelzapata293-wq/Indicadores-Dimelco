// Tipos de entrada del modelo (contrato de datos, sección 1).
// Las fechas son texto ISO "aaaa-mm-dd" y las horas texto "hh:mm:ss" (sin zona horaria).
// Los textos ausentes se guardan como cadena vacía; los números ausentes como null.

export interface Equipo {
  id_equipo: number;
  /** Descripción recortada (el Excel trae espacios al inicio o al final). */
  descripcion: string;
  familia: string;
}

export interface Responsable {
  /** Código del grupo, por ejemplo "T-MTO-ME". */
  id_responsable: string;
  denominacion: string;
  responsable: string;
  disponibilidad: string;
}

export interface TipoMantto {
  /** PP, NPI o EPP. */
  id_tipo_mantto: string;
  descripcion: string;
}

export interface Meta {
  /** Primer día del mes en texto "dd/mm/aaaa", tal como viene en el Excel. */
  mes: string;
  /** Descripción del equipo (la columna se llama "Familia" en el Excel). Recortada. */
  equipo_descripcion: string;
  /** Fracción 0 a 1. */
  meta_disp: number;
  meta_mttr: number | null;
  meta_mtbf: number | null;
  meta_conf: number | null;
}

export interface Paro {
  id_equipo: number;
  aviso: number;
  /** "aaaa-mm-dd" */
  fecha_inicio: string;
  /** "hh:mm:ss". El "24:00:00" ya viene cambiado por "00:00:00". */
  hora_inicio: string;
  /** "aaaa-mm-dd" */
  fecha_fin: string;
  /** "hh:mm:ss". Puede ser "24:00:00" (suma un día; ver derivados.fin). */
  hora_fin: string;
  duracion_min: number | null;
  desc_paro: string;
  id_responsable: string;
  cod_falla: string;
  texto_falla: string;
  id_tipo_mantto: string;
  tipo_paro_pp_npi: string;
  resumen: string;
}

export interface DatosModelo {
  equipos: Equipo[];
  responsables: Responsable[];
  tipos_mantto: TipoMantto[];
  metas: Meta[];
  paros: Paro[];
}
