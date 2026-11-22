import { Link } from "react-router-dom";

const secciones = [
  { ruta: "/simba", nombre: "Simba" },
  { ruta: "/jumbo", nombre: "Jumbo" },
  { ruta: "/sostenimiento", nombre: "Sostenimiento" },
  { ruta: "/st35", nombre: "ST 35" },
  { ruta: "/st1030", nombre: "ST 1030" },
  { ruta: "/resumen", nombre: "Resumen" },
  { ruta: "/mensual", nombre: "Mensual" },
];

export default function Portada() {
  return (
    <section className="portada">
      <h1 className="portada-titulo">Indicadores de mantenimiento</h1>
      <p className="nota">Disponibilidad de equipos mineros. Contenido provisional.</p>
      <nav className="tarjetas-secciones" aria-label="Secciones">
        {secciones.map((s) => (
          <Link key={s.ruta} to={s.ruta} className="tarjeta-seccion">
            {s.nombre}
          </Link>
        ))}
      </nav>
    </section>
  );
}
