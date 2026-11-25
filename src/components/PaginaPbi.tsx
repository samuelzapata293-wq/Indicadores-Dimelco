// Página del tablero: en escritorio, lienzo escalado con la plantilla de Power BI (banda verde,
// flecha de volver, título serif y texto del pie); en celular, la versión apilada con Layout.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import DisposicionPbi from "./DisposicionPbi";
import Layout, { EnlacesSesion, TEXTO_PIE } from "./Layout";
import LienzoPbi, { ProveedorLienzo, posicion, useEstadoLienzo } from "./LienzoPbi";
import { BASE, type Rect } from "../pages/disenos";
import plantilla from "../assets/plantilla_cabecera.jpg";

interface Props {
  /** Título serif de la banda. */
  titulo: string;
  /** Caja del título en el lienzo (por defecto la de las páginas DISPONIBILIDADES). */
  rectTitulo?: Rect;
  /** Caja del texto del pie (por defecto donde la plantilla traía "© 2025 Mineros"). */
  rectPie?: Rect;
  /** Segmentadores: en el lienzo, cada uno dentro de su Caja; en la versión apilada, la columna lateral. */
  lateral: ReactNode;
  /** Ancho de la columna lateral en la versión apilada. */
  anchoLateral?: number;
  children: ReactNode;
}

export function BotonVolver() {
  return (
    <Link to="/" className="lienzo-volver" style={posicion(BASE.volver)} aria-label="Volver a Portada" title="Volver a Portada">
      <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true" focusable="false">
        <circle cx="15" cy="15" r="13.6" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M22 15H9.5M14.5 9.6 9 15l5.5 5.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

export default function PaginaPbi({ titulo, rectTitulo = BASE.titulo, rectPie = BASE.pie, lateral, anchoLateral, children }: Props) {
  const estado = useEstadoLienzo();

  if (estado.modo === "apilado") {
    return (
      <ProveedorLienzo value={estado}>
        <Layout titulo={titulo} amplio>
          <DisposicionPbi lateral={lateral} anchoLateral={anchoLateral}>
            {children}
          </DisposicionPbi>
        </Layout>
      </ProveedorLienzo>
    );
  }

  return (
    <ProveedorLienzo value={estado}>
      <LienzoPbi escala={estado.escala} fondo={plantilla} className="lienzo-tablero">
        <BotonVolver />
        <h1 className="lienzo-titulo" style={posicion(rectTitulo)}>
          {titulo}
        </h1>
        {lateral}
        {children}
        {/* Pie alineado al borde derecho del texto original; los enlaces de sesión siguen a su derecha. */}
        <div className="lienzo-pie" style={posicion(rectPie)}>
          <p>{TEXTO_PIE}</p>
          <EnlacesSesion className="lienzo-enlaces" />
        </div>
      </LienzoPbi>
    </ProveedorLienzo>
  );
}
