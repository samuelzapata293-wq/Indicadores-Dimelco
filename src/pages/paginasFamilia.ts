import { EQUIPOS_POR_PAGINA } from "../medidas/contexto";
import { DISENOS_FAMILIA } from "./disenos";

// Las ST3.5 y ST1030 muestran en la tabla los paros de los 8 scoops (contrato, sección 7).
const SCOOPS = [...EQUIPOS_POR_PAGINA.st35, ...EQUIPOS_POR_PAGINA.st1030];

export const PAGINAS_FAMILIA = [
  { ruta: "/simba", titulo: "Tiro Largo", grafico: EQUIPOS_POR_PAGINA.simba, tabla: EQUIPOS_POR_PAGINA.simba, diseno: DISENOS_FAMILIA.simba },
  { ruta: "/jumbo", titulo: "Perforación Mecánizada", grafico: EQUIPOS_POR_PAGINA.jumbo, tabla: EQUIPOS_POR_PAGINA.jumbo, diseno: DISENOS_FAMILIA.jumbo },
  { ruta: "/sostenimiento", titulo: "Equipos de Sostenimiento", grafico: EQUIPOS_POR_PAGINA.sostenimiento, tabla: EQUIPOS_POR_PAGINA.sostenimiento, diseno: DISENOS_FAMILIA.sostenimiento },
  { ruta: "/st35", titulo: "Cargadoras Bajo Perfil", grafico: EQUIPOS_POR_PAGINA.st35, tabla: SCOOPS, diseno: DISENOS_FAMILIA.st35 },
  { ruta: "/st1030", titulo: "Cargadoras Bajo Perfil", grafico: EQUIPOS_POR_PAGINA.st1030, tabla: SCOOPS, diseno: DISENOS_FAMILIA.st1030 },
];
