import type { CSSProperties, ReactNode } from "react";
import "./componentes.css";

interface Props {
  /** Segmentadores (columna izquierda en escritorio, fila arriba bajo 900 px). */
  lateral: ReactNode;
  /** Ancho de la columna de segmentadores en px (por defecto 260). */
  anchoLateral?: number;
  children: ReactNode;
}

/** Lienzo de página como el de Power BI: segmentadores a la izquierda y contenido a la derecha. */
export default function DisposicionPbi({ lateral, anchoLateral, children }: Props) {
  return (
    <div className="pbi-pagina" style={anchoLateral ? ({ "--pbi-lateral": `${anchoLateral}px` } as CSSProperties) : undefined}>
      <aside className="pbi-lateral">{lateral}</aside>
      <div className="pbi-principal">{children}</div>
    </div>
  );
}
