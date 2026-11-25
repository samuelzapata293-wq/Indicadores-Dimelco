// Lienzo fijo del tamaño de la página de Power BI (1280x720) que se escala con transform para caber
// completo en la ventana, centrado y con fondo gris alrededor. Bajo 900 px de ancho, o si la escala
// dejaría el texto muy chico (< 0.6), las páginas usan la versión apilada (adaptable al celular).

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Rect } from "../pages/disenos";
import { TAMANO_PAGINA } from "../pages/disenos";
import "./lienzo.css";

export type ModoPagina = "lienzo" | "apilado";

export interface EstadoLienzo {
  modo: ModoPagina;
  escala: number;
}

/** Ancho mínimo de ventana para usar el lienzo. */
export const ANCHO_MIN_LIENZO = 900;
/** Escala mínima del lienzo; por debajo el texto queda ilegible y se usa la versión apilada. */
export const ESCALA_MIN_LIENZO = 0.6;

function medir(ancho: number, alto: number): EstadoLienzo {
  if (typeof window === "undefined") return { modo: "apilado", escala: 1 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const escala = Math.min(w / ancho, h / alto);
  const modo: ModoPagina = w < ANCHO_MIN_LIENZO || escala < ESCALA_MIN_LIENZO ? "apilado" : "lienzo";
  return { modo, escala };
}

/** Modo y escala del lienzo según el tamaño de la ventana; se actualiza al redimensionar. */
export function useEstadoLienzo(ancho: number = TAMANO_PAGINA.ancho, alto: number = TAMANO_PAGINA.alto): EstadoLienzo {
  const forzado = useContext(CtxForzarLienzo);
  const [estado, setEstado] = useState(() => medir(ancho, alto));
  useEffect(() => {
    const actualizar = () =>
      setEstado((prev) => {
        const nuevo = medir(ancho, alto);
        return nuevo.modo === prev.modo && Math.abs(nuevo.escala - prev.escala) < 0.0005 ? prev : nuevo;
      });
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, [ancho, alto]);
  // Exportación a PDF: siempre lienzo a escala 1, sin importar la ventana.
  return forzado ? ESTADO_FORZADO : estado;
}

/** Dentro de este proveedor (con valor true) las páginas usan siempre el lienzo de 1280x720 a escala 1. */
export const CtxForzarLienzo = createContext(false);
const ESTADO_FORZADO: EstadoLienzo = { modo: "lienzo", escala: 1 };

const CtxLienzo = createContext<EstadoLienzo>({ modo: "apilado", escala: 1 });

export const ProveedorLienzo = CtxLienzo.Provider;

/** Modo de la página actual ("apilado" fuera de una página con lienzo, por ejemplo en la galería). */
export function useModoPagina(): ModoPagina {
  return useContext(CtxLienzo).modo;
}

/** Estilo de posición absoluta para un rectángulo del diseño. */
export function posicion(r: Rect): CSSProperties {
  return { left: r.x, top: r.y, width: r.w, height: r.h };
}

interface PropsCaja {
  r: Rect;
  className?: string;
  /** Solo se muestra en el lienzo (por ejemplo, las leyendas sueltas del gráfico). */
  soloLienzo?: boolean;
  children: ReactNode;
}

/**
 * Contenedor de un visual: en el lienzo va en posición absoluta con las coordenadas de Power BI;
 * en la versión apilada no crea caja (display: contents) y su contenido fluye como antes.
 */
export function Caja({ r, className, soloLienzo, children }: PropsCaja) {
  const modo = useModoPagina();
  if (modo === "lienzo") {
    return (
      <div className={className ? `caja ${className}` : "caja"} style={posicion(r)}>
        {children}
      </div>
    );
  }
  if (soloLienzo) return null;
  return <div className="caja-apilada">{children}</div>;
}

interface PropsLienzo {
  escala: number;
  /** Imagen de fondo de la página (plantilla con la banda o la imagen de la portada). */
  fondo?: string;
  className?: string;
  ancho?: number;
  alto?: number;
  children: ReactNode;
}

export default function LienzoPbi({
  escala,
  fondo,
  className,
  ancho = TAMANO_PAGINA.ancho,
  alto = TAMANO_PAGINA.alto,
  children,
}: PropsLienzo) {
  return (
    <div className="lienzo-marco">
      <div className="lienzo-escala" style={{ width: ancho * escala, height: alto * escala }}>
        <div
          className={className ? `lienzo ${className}` : "lienzo"}
          style={{
            width: ancho,
            height: alto,
            transform: `scale(${escala})`,
            backgroundImage: fondo ? `url(${fondo})` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
