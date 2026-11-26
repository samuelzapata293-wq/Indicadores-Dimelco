import { useMemo, useState } from "react";
import DisposicionPbi from "../components/DisposicionPbi";
import GraficoDispFamilia, { type EquipoDisp } from "../components/GraficoDispFamilia";
import PanelesSemanales, { type PanelSemanal } from "../components/PanelesSemanales";
import SegmentadorBotones from "../components/SegmentadorBotones";
import SegmentadorLista from "../components/SegmentadorLista";
import SegmentadorPeriodo, { type Periodo } from "../components/SegmentadorPeriodo";
import TablaPbi, { type ColumnaPbi } from "../components/TablaPbi";
import { COLORES } from "../components/formato";

// Datos de ejemplo copiados de las capturas del reporte (docs/powerbi/capturas).

const EQUIPOS: EquipoDisp[] = [
  { id: "618487", nombre: "JUMBO DE PERFORACION ATLAS SIMBA S7 N°1", disp: 0.66, meta: 0.81, color: COLORES.naranjaNoCumple },
  { id: "100618", nombre: "JUMBO DE PERFORACION ATLAS SIMBA S7 N°2", disp: 0.81, meta: 0.82, color: COLORES.naranjaNoCumple },
  { id: "100660", nombre: "JUMBO DE PERFORACION ATLAS SIMBA S7 N°3", disp: 0.84, meta: 0.8, color: COLORES.verdeCumple },
];

interface Paro {
  sap: string;
  equipo: string;
  aviso: string;
  descripcion: string;
  inicio: string;
  fin: string;
  hrs: number;
  responsable: string;
  tipo: string;
}
const N1 = "JUMBO DE PERFORACION ATLAS SIMBA S7 N°1";
const N2 = "JUMBO DE PERFORACION ATLAS SIMBA S7 N°2";
const N3 = "JUMBO DE PERFORACION ATLAS SIMBA S7 N°3";
const PAROS: Paro[] = [
  { sap: "618487", equipo: N1, aviso: "940365357", descripcion: "BOMBA HIDRAULICA PRINCIPAL EN M/E", inicio: "2026-11-03T18:00:00", fin: "2026-11-05T16:20:00", hrs: 46.33, responsable: "Mantenimiento", tipo: "No Programado" },
  { sap: "618487", equipo: N1, aviso: "940366428", descripcion: "MANTENIMIENTO PROGRAMADO EXTENDIDO", inicio: "2026-11-11T19:00:00", fin: "2026-11-13T06:00:00", hrs: 35, responsable: "Mantenimiento", tipo: "No Programado" },
  { sap: "100660", equipo: N3, aviso: "940366931", descripcion: "PERNOS DEL MOTOR DE ROTACION QUEBRADO", inicio: "2026-11-19T01:00:00", fin: "2026-11-19T23:30:00", hrs: 22.5, responsable: "Mantenimiento", tipo: "No Programado" },
  { sap: "100618", equipo: N2, aviso: "940366878", descripcion: "VALVULA DEL ACUMULADOR DE ROTACION", inicio: "2026-11-17T11:30:00", fin: "2026-11-18T03:30:00", hrs: 16, responsable: "Mantenimiento", tipo: "No Programado" },
  { sap: "100618", equipo: N2, aviso: "940366185", descripcion: "MANTENIMIENTO PROGRAMADO", inicio: "2026-11-07T06:00:00", fin: "2026-11-07T18:00:00", hrs: 12, responsable: "Mantenimiento", tipo: "Programado" },
];

const COLS_PAROS: ColumnaPbi<Paro>[] = [
  { id: "sap", titulo: "Sap", valor: (f) => f.sap },
  { id: "equipo", titulo: "Equipo", valor: (f) => f.equipo, sinPartir: true },
  { id: "aviso", titulo: "Aviso", valor: (f) => f.aviso },
  { id: "descripcion", titulo: "Descripción del Paro", valor: (f) => f.descripcion, ancho: 260 },
  { id: "inicio", titulo: "Inicio del Paro", valor: (f) => f.inicio, formato: "fechaHora" },
  { id: "fin", titulo: "Fin del Paro", valor: (f) => f.fin, formato: "fechaHora" },
  { id: "hrs", titulo: "Hrs de Paro", valor: (f) => f.hrs, formato: "horas" },
  { id: "responsable", titulo: "Responsable", valor: (f) => f.responsable },
  { id: "tipo", titulo: "Tipo de Paro", valor: (f) => f.tipo },
];

interface FilaEquipo {
  id: string;
  denominacion: string;
  mttr: number;
  mtbf: number;
  meta: number;
  disp: number;
  cumple: boolean;
  conf: number;
  prob: number;
}
// [id, denominación, MTTR, MTBF, meta, disp, cumple, confiabilidad %, prob. falla %]
const RESUMEN: FilaEquipo[] = (
  [
    ["100362", "CARGADOR FRONTAL BP SCOOP 3.50 N°5 (WAGNER)", 10.17, 69.83, 73, 83, true, 77.28, 22.72],
    ["618486", "CARGADOR FRONTAL BP SCOOP 3.50 N°6", 480, 0, 71, 0, false, 0, 100],
    ["618270", "CARGADOR FRONTAL BP SCOOP ST1030 No. 01", 480, 0, 75, 0, false, 0, 100],
    ["100615", "CARGADOR FRONTAL BP SCOOP ST1030 No. 02", 13.74, 26.26, 80, 63, false, 50.39, 49.61],
    ["100635", "CARGADOR FRONTAL BP SCOOP ST1030 No. 03", 29.13, 39.44, 82, 54, false, 63.36, 36.64],
    ["100655", "CARGADOR FRONTAL BP SCOOP ST1030 No. 04", 9.82, 70.18, 73, 81, true, 77.38, 22.62],
    ["100656", "CARGADOR FRONTAL BP SCOOP ST1030 No. 05", 7.22, 46.11, 73, 81, true, 67.68, 32.32],
    ["100657", "CARGADOR FRONTAL BP SCOOP ST1030 No. 06", 8.34, 15.66, 78, 65, false, 31.69, 68.31],
    ["618321", "DESATADOR DE ROCAS SCALEMIN", 480, 0, 29, 0, false, 0, 100],
    ["100647", "DESATADOR DE ROCAS SCALEMIN No.2", 49.91, 46.09, 80, 48, false, 67.67, 32.33],
    ["618320", "EMPERNADOR BOLTEC EPIROC N°1", 3.86, 17.95, 81, 77, false, 36.69, 63.31],
    ["621321", "EMPERNADOR BOLTEC S10 S EPIROC N°2", 4.6, 12.55, 81, 65, false, 23.82, 76.18],
    ["618487", "JUMBO DE PERFORACION ATLAS SIMBA S7 N°1", 7.72, 18.95, 81, 66, false, 38.67, 61.33],
    ["100618", "JUMBO DE PERFORACION ATLAS SIMBA S7 N°2", 4.39, 27.61, 82, 81, false, 52.1, 47.9],
    ["100660", "JUMBO DE PERFORACION ATLAS SIMBA S7 N°3", 6.07, 41.93, 80, 84, true, 65.1, 34.9],
    ["618269", "PERFORADORA BOOMER 282 EPIROC No. 01", 5.57, 12.89, 81, 64, false, 24.75, 75.25],
    ["100636", "PERFORADORA BOOMER 282 EPIROC No. 02", 3.8, 24.44, 79, 82, true, 47.87, 52.13],
    ["620903", "PERFORADORA BOOMER 282 EPIROC No. 03", 3.13, 50.2, 79, 89, true, 69.87, 30.13],
  ] as const
).map(([id, denominacion, mttr, mtbf, meta, disp, cumple, conf, prob]) => ({
  id, denominacion, mttr, mtbf, cumple, meta: meta / 100, disp: disp / 100, conf: conf / 100, prob: prob / 100,
}));

const COLS_RESUMEN: ColumnaPbi<FilaEquipo>[] = [
  { id: "id", titulo: "EQUIPO", valor: (f) => f.id, alinear: "der", ancho: 80 },
  { id: "denominacion", titulo: "DENOMINACION", valor: (f) => f.denominacion, sinPartir: true },
  { id: "mttr", titulo: "MTTR_Horas", valor: (f) => f.mttr, formato: "horas" },
  { id: "mtbf", titulo: "MTBF_Horas", valor: (f) => f.mtbf, formato: "horas" },
  { id: "meta", titulo: "Meta_Disp", valor: (f) => f.meta, formato: "pct0" },
  { id: "disp", titulo: "Disponibilidad %", valor: (f) => f.disp, formato: "pct0", semaforo: (f) => f.cumple },
  { id: "conf", titulo: "Confiabilidad %", valor: (f) => f.conf, formato: "pct2" },
  { id: "prob", titulo: "Prob. de Falla", valor: (f) => f.prob, formato: "pct2" },
];

interface FilaFamilia { familia: string; mttr: number; mtbf: number; disp: number; conf: number; prob: number }
const FAMILIAS: FilaFamilia[] = [
  { familia: "TIRO LARGO", mttr: 6.17, mtbf: 27.31, disp: 0.77, conf: 0.5174, prob: 0.4826 },
  { familia: "PERFORACION MECANIZADA", mttr: 4.57, mtbf: 23.12, disp: 0.78, conf: 0.4591, prob: 0.5409 },
  { familia: "EQUIPOS DE SOSTENIMIENTO", mttr: 16.84, mtbf: 17.44, disp: 0.47, conf: 0.3563, prob: 0.6437 },
  { familia: "CARGADORAS BP FLOTA 3.5", mttr: 77.29, mtbf: 59.86, disp: 0.41, conf: 0.7403, prob: 0.2597 },
  { familia: "CARGADORAS BP", mttr: 20.72, mtbf: 31.65, disp: 0.58, conf: 0.5662, prob: 0.4338 },
];
const COLS_FAMILIA: ColumnaPbi<FilaFamilia>[] = [
  { id: "familia", titulo: "Familia", valor: (f) => f.familia },
  { id: "mttr", titulo: "MTTR (Horas)", valor: (f) => f.mttr, formato: "horas" },
  { id: "mtbf", titulo: "MTBF (Horas)", valor: (f) => f.mtbf, formato: "horas" },
  { id: "disp", titulo: "Disponibilidad %", valor: (f) => f.disp, formato: "pct0" },
  { id: "conf", titulo: "Confiabilidad %", valor: (f) => f.conf, formato: "pct2" },
  { id: "prob", titulo: "Probabilidad de Falla", valor: (f) => f.prob, formato: "pct2" },
];

const SEMANAS = Array.from({ length: 19 }, (_, i) => `Sem ${27 + i}/26`);
const pc = (a: number[]) => a.map((v) => v / 100);
// Valores aproximados leídos de la captura pag_8.
const PANELES: PanelSemanal[] = [
  {
    id: "1", titulo: "CARGADOR FRONTAL BP SCOOP ST1030 No. 01", semanas: SEMANAS,
    disp: pc(Array(19).fill(0)),
    meta: pc([31, 31, 31, 31, 37, 73, 73, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 75]),
  },
  {
    id: "2", titulo: "CARGADOR FRONTAL BP SCOOP ST1030 No. 02", semanas: SEMANAS,
    disp: pc([92, 89, 79, 95, 88, 72, 94, 73, 64, 76, 9, 67, 79, 86, 91, 82, 97, 80, 66]),
    meta: pc([89, 78, 78, 72, 78, 78, 76, 68, 68, 68, 68, 67, 79, 79, 80, 80, 80, 80, 80]),
  },
  {
    id: "3", titulo: "CARGADOR FRONTAL BP SCOOP ST1030 No. 03", semanas: SEMANAS,
    disp: pc([0, 0, 0, 0, 0, 0, 0, 0, 50, 81, 90, 81, 72, 60, 100, 83, 85, 80, 83]),
    meta: pc([43, 43, 43, 43, 48, 82, 82, 82, 82, 82, 81, 80, 80, 80, 80, 80, 83, 83, 80]),
  },
  {
    id: "4", titulo: "CARGADOR FRONTAL BP SCOOP ST1030 No. 04", semanas: SEMANAS,
    disp: pc([99, 98, 95, 72, 66, 81, 42, 60, 63, 88, 82, 90, 80, 74, 84, 94, 99, 73, 62]),
    meta: pc([72, 72, 72, 72, 72, 81, 81, 82, 88, 88, 91, 90, 80, 80, 80, 80, 80, 73, 62]),
  },
];

const FAMILIAS_MENSUAL = [
  { valor: "CARGADORAS BP", etiqueta: "CARGADORAS BP" },
  { valor: "CARGADORAS BP FLOTA 3.5", etiqueta: "CARGADORAS BP FLOTA 3.5" },
  { valor: "EQUIPOS DE SOSTENIMIENTO", etiqueta: "EQUIPOS DE SOSTENIMIENTO" },
  { valor: "PERFORACION MECANIZADA", etiqueta: "PERFORACION MECANIZADA" },
  { valor: "TIRO LARGO", etiqueta: "TIRO LARGO" },
];

export default function Galeria() {
  const [periodo, setPeriodo] = useState<Periodo>({ desde: "2026-11-01", hasta: "2026-11-20" });
  const [varDisp, setVarDisp] = useState<number>(24);
  const [varConf, setVarConf] = useState<number>(18);
  const [global, setGlobal] = useState<string[]>(["mecanica"]);
  const [familia, setFamilia] = useState<string | null>("CARGADORAS BP");
  const [equipo, setEquipo] = useState<string | null>(null);

  const paros = useMemo(
    () => (equipo ? PAROS.filter((p) => p.sap === equipo) : PAROS),
    [equipo]
  );

  const segmentadoresBase = (
    <>
      <SegmentadorPeriodo valor={periodo} onChange={setPeriodo} />
      <SegmentadorBotones
        titulo="Var t: Conf."
        opciones={[{ valor: 12, etiqueta: "12 hrs" }, { valor: 18, etiqueta: "18 hrs" }, { valor: 24, etiqueta: "24 hrs" }]}
        valor={varConf}
        onChange={setVarConf}
      />
      <SegmentadorBotones
        titulo="Var t: Disp"
        opciones={[{ valor: 18, etiqueta: "18 hrs" }, { valor: 24, etiqueta: "24 hrs" }]}
        valor={varDisp}
        onChange={setVarDisp}
      />
      <SegmentadorLista
        titulo="DISP. GLOBAL"
        opciones={[{ valor: "mecanica", etiqueta: "Mecánica" }, { valor: "operacional", etiqueta: "Operacional" }]}
        seleccion={global}
        onChange={setGlobal}
      />
    </>
  );

  return (
    <div className="galeria">
      <style>{`
        .galeria h2 { font-family: "Times New Roman", Times, serif; font-weight: 400; color: var(--verde-oscuro); font-size: 26px; margin: 36px 0 12px; border-bottom: 2px solid var(--verde-tabla); padding-bottom: 4px; }
        .galeria h2:first-child { margin-top: 0; }
        .galeria .nota { margin-bottom: 12px; }
      `}</style>

      <h2>Segmentadores</h2>
      <p className="nota">Controlados: cada uno recibe el valor y un onChange. Prueba hacer clic.</p>
      <DisposicionPbi lateral={segmentadoresBase}>
        <SegmentadorLista
          titulo="DISP. GLOBAL (selección única)"
          modo="unica"
          opciones={FAMILIAS_MENSUAL}
          seleccion={familia}
          onChange={setFamilia}
        />
        <p className="nota">
          Periodo: {periodo.desde} a {periodo.hasta} · Var t Disp: {varDisp} hrs · Var t Conf.: {varConf} hrs ·
          Global: {global.join(", ") || "ninguno"} · Familia: {familia}
        </p>
      </DisposicionPbi>

      <h2>Página de familia: gráfico combinado y tabla de paros</h2>
      <p className="nota">Clic en una columna filtra la tabla a ese equipo; otro clic la suelta.</p>
      <DisposicionPbi lateral={segmentadoresBase}>
        <GraficoDispFamilia titulo="Tiro Largo" equipos={EQUIPOS} seleccionado={equipo} onClickEquipo={setEquipo} />
        <TablaPbi datos={paros} columnas={COLS_PAROS} ordenInicial={{ id: "hrs", desc: true }} alturaMax={280} />
      </DisposicionPbi>

      <h2>Resumen: tablas con semáforo</h2>
      <DisposicionPbi lateral={segmentadoresBase}>
        <TablaPbi datos={RESUMEN} columnas={COLS_RESUMEN} ordenInicial={{ id: "denominacion" }} alturaMax={560} />
        <TablaPbi datos={FAMILIAS} columnas={COLS_FAMILIA} ordenInicial={{ id: "familia" }} />
      </DisposicionPbi>

      <h2>Disp Mensual: paneles semanales</h2>
      <DisposicionPbi
        lateral={
          <>
            <SegmentadorPeriodo valor={{ desde: "2026-07-01", hasta: "2026-11-05" }} onChange={() => {}} />
            <SegmentadorLista
              titulo="DISP. GLOBAL"
              modo="unica"
              opciones={FAMILIAS_MENSUAL}
              seleccion={familia}
              onChange={setFamilia}
            />
          </>
        }
      >
        <PanelesSemanales titulo="Evolución semanal de disponibilidades %" paneles={PANELES} />
      </DisposicionPbi>
    </div>
  );
}
