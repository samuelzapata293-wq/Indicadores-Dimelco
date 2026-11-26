import { Link } from "react-router-dom";
import fondo from "../assets/portada_mineros.png";
import Layout, { EnlacesSesion } from "../components/Layout";
import NavegadorPaginas from "../components/NavegadorPaginas";
import LienzoPbi, { posicion, useEstadoLienzo } from "../components/LienzoPbi";
import { DISENO_PORTADA as D } from "./disenos";
import "./portada.css";

const botones = [
  { ruta: "/simba", texto: "DISP SIMBA" },
  { ruta: "/jumbo", texto: "DISP JUMBO" },
  { ruta: "/sostenimiento", texto: "DISP SOSTENIMIENTO" },
  { ruta: "/st35", texto: "DISP SCOOTRAM ST3.5" },
  { ruta: "/st1030", texto: "DISP SCOOTRAM ST1030" },
  { ruta: "/resumen", texto: "RESUMEN DISP." },
  { ruta: "/mensual", texto: "DISP MENSUAL" },
];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

interface FechaPartes {
  anio: number;
  mes: number; // 1 a 12
  dia: number;
}

// Lee "aaaa-mm-dd". Devuelve undefined si el texto no es una fecha válida.
function leerFecha(texto: string | undefined): FechaPartes | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto ?? "");
  if (!m) return undefined;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const valida = new Date(Date.UTC(anio, mes - 1, dia));
  if (valida.getUTCFullYear() !== anio || valida.getUTCMonth() !== mes - 1 || valida.getUTCDate() !== dia) {
    return undefined;
  }
  return { anio, mes, dia };
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

// Texto del rango de datos que muestra la portada, en español.
export function textoDataActualizada(fechaMin?: string, fechaMax?: string): string {
  const desde = leerFecha(fechaMin);
  const hasta = leerFecha(fechaMax);
  if (!desde || !hasta) return "Data actualizada: sin datos cargados";

  if (desde.anio === hasta.anio && desde.mes === hasta.mes && desde.dia === hasta.dia) {
    return `Data actualizada: ${dosDigitos(desde.dia)} de ${MESES[desde.mes - 1]} ${desde.anio}`;
  }
  if (desde.anio !== hasta.anio) {
    return `Data actualizada: ${dosDigitos(desde.dia)} de ${MESES[desde.mes - 1]} ${desde.anio} al ${dosDigitos(hasta.dia)} de ${MESES[hasta.mes - 1]} ${hasta.anio}`;
  }
  if (desde.mes !== hasta.mes) {
    return `Data actualizada: ${dosDigitos(desde.dia)} de ${MESES[desde.mes - 1]} al ${dosDigitos(hasta.dia)} de ${MESES[hasta.mes - 1]} ${hasta.anio}`;
  }
  return `Data actualizada: ${dosDigitos(desde.dia)} al ${dosDigitos(hasta.dia)} de ${MESES[hasta.mes - 1]} ${hasta.anio}`;
}

interface Props {
  fechaMin?: string; // aaaa-mm-dd
  fechaMax?: string; // aaaa-mm-dd
}

export default function Portada({ fechaMin, fechaMax }: Props) {
  const { modo, escala } = useEstadoLienzo();
  const fecha = textoDataActualizada(fechaMin, fechaMax);

  // Escritorio: la página 1 del reporte en el lienzo escalado, con las posiciones de Power BI.
  if (modo === "lienzo") {
    return (
      <LienzoPbi escala={escala} fondo={fondo} className="portada-lienzo">
        <h1 id="portada-titulo" className="portada-h1" style={posicion(D.titulo)}>
          <span>PRESENTACIÓN DE INDICADORES DE MANTENIMIENTO</span>{" "}
          <span>MINERÍA MECANIZADA</span>
        </h1>
        <nav className="portada-botones" aria-label="Secciones" style={posicion(D.botones)}>
          {botones.map((b) => (
            <Link key={b.ruta} to={b.ruta} className="portada-boton">
              {b.texto}
            </Link>
          ))}
        </nav>
        <p className="portada-fecha" style={posicion(D.fecha)}>{fecha}</p>
        {/* A la altura del texto de la fecha (centrado verticalmente en su caja). */}
        <NavegadorPaginas y={D.fecha.y + D.fecha.h / 2 - 8} h={16} claro enLienzo />
        <EnlacesSesion className="portada-enlaces" exportarPdf />
      </LienzoPbi>
    );
  }

  return (
    <Layout exportarPdf navegador>
      <section className="portada" aria-labelledby="portada-titulo">
        <img className="portada-fondo" src={fondo} alt="" />

        <h1 id="portada-titulo" className="portada-h1">
          <span>PRESENTACIÓN DE INDICADORES DE MANTENIMIENTO</span>{" "}
          <span>MINERÍA MECANIZADA</span>
        </h1>

        <nav className="portada-botones" aria-label="Secciones">
          {botones.map((b) => (
            <Link key={b.ruta} to={b.ruta} className="portada-boton">
              {b.texto}
            </Link>
          ))}
        </nav>

        <div className="portada-pie">
          <p className="portada-fecha">{fecha}</p>
        </div>
      </section>
    </Layout>
  );
}
