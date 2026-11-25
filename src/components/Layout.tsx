import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";

interface Props {
  // Sin título no hay banda superior (así se muestra la Portada).
  titulo?: string;
  /** Contenido más ancho (páginas del tablero con tablas). */
  amplio?: boolean;
  children: ReactNode;
}

export const TEXTO_PIE = "© 2025 Distribuidora de Materiales Eléctricos S.A.";

/** Enlaces de sesión: "Ingresar" o, con sesión, "Cargar datos" (administrador) y "Salir". */
export function EnlacesSesion({ className = "pie-enlaces" }: { className?: string }) {
  const { session, esAdmin, cerrarSesion } = useAuth();
  return (
    <nav className={className} aria-label="Sesión">
      {session ? (
        <>
          {esAdmin && <Link to="/cargar">Cargar datos</Link>}
          <button type="button" className="enlace-boton" onClick={() => void cerrarSesion()}>
            Salir
          </button>
        </>
      ) : (
        <Link to="/login">Ingresar</Link>
      )}
    </nav>
  );
}

export default function Layout({ titulo, amplio, children }: Props) {
  return (
    <div className="pagina">
      {titulo !== undefined && (
        <header className="banda">
          <Link to="/" className="banda-volver" aria-label="Volver a Portada" title="Volver a Portada">
            <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" focusable="false">
              <path fill="#3DDC84" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
            </svg>
          </Link>
          <h1 className="banda-titulo">{titulo}</h1>
          <span className="banda-marca">TSX:MSA BVC:MINEROS</span>
        </header>
      )}

      <main className={amplio ? "contenido contenido-amplio" : "contenido"}>{children}</main>

      <footer className="pie">
        <span className="pie-texto">{TEXTO_PIE}</span>
        <EnlacesSesion />
      </footer>
    </div>
  );
}
