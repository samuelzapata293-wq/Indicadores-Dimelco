// Navegador de páginas como el de Power BI: "‹  2 de 8  ›". Navega con react-router (sin recargar), así
// los filtros compartidos se conservan. Con las flechas del teclado también se cambia de página, salvo
// cuando el foco está en un campo de texto, fecha o lista.

import { useContext, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CtxForzarLienzo, posicion, useModoPagina } from "./LienzoPbi";
import { indicePagina, ORDEN_PAGINAS } from "../pages/ordenPaginas";
import type { Rect } from "../pages/disenos";

interface Props {
  /** Caja en el lienzo: centrada en la página, a la altura del pie (y = arriba, h = alto). */
  y?: number;
  h?: number;
  /** Texto claro, para fondos oscuros (Portada). */
  claro?: boolean;
  /** Fuerza el modo lienzo cuando la página no usa el proveedor de modo (la Portada). */
  enLienzo?: boolean;
}

const ANCHO_LIENZO = 1280;
const ANCHO_NAV = 160;

function esCampoEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export default function NavegadorPaginas({ y = 674, h = 16, claro, enLienzo }: Props) {
  const modo = useModoPagina();
  const lienzo = enLienzo ?? modo === "lienzo";
  const forzado = useContext(CtxForzarLienzo); // exportación a PDF: oculto por CSS y sin teclado
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const i = indicePagina(pathname);
  const anterior = i > 0 ? ORDEN_PAGINAS[i - 1] : null;
  const siguiente = i >= 0 && i < ORDEN_PAGINAS.length - 1 ? ORDEN_PAGINAS[i + 1] : null;

  useEffect(() => {
    if (forzado) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (esCampoEditable(e.target)) return;
      const destino = e.key === "ArrowLeft" ? anterior : e.key === "ArrowRight" ? siguiente : null;
      if (!destino) return;
      e.preventDefault();
      navigate(destino.ruta);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [forzado, anterior, siguiente, navigate]);

  if (i < 0) return null;

  const caja: Rect = { x: (ANCHO_LIENZO - ANCHO_NAV) / 2, y, w: ANCHO_NAV, h };
  const clases = ["nav-paginas", lienzo ? "lienzo-nav" : "", claro ? "nav-paginas-claro" : ""].filter(Boolean).join(" ");
  return (
    <nav className={clases} aria-label="Navegador de páginas" style={lienzo ? posicion(caja) : undefined}>
      <button
        type="button"
        className="nav-paginas-boton"
        aria-label="Página anterior"
        title={anterior ? anterior.titulo : undefined}
        disabled={!anterior}
        onClick={() => anterior && navigate(anterior.ruta)}
      >
        ‹
      </button>
      <span className="nav-paginas-texto" aria-live="polite">
        {i + 1} de {ORDEN_PAGINAS.length}
      </span>
      <button
        type="button"
        className="nav-paginas-boton"
        aria-label="Página siguiente"
        title={siguiente ? siguiente.titulo : undefined}
        disabled={!siguiente}
        onClick={() => siguiente && navigate(siguiente.ruta)}
      >
        ›
      </button>
    </nav>
  );
}
