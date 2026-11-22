import type { ReactNode } from "react";
import "./componentes.css";

interface Props {
  /** Segmentadores (columna izquierda en escritorio, fila arriba bajo 900 px). */
  lateral: ReactNode;
  children: ReactNode;
}

/** Lienzo de página como el de Power BI: segmentadores a la izquierda y contenido a la derecha. */
export default function DisposicionPbi({ lateral, children }: Props) {
  return (
    <div className="pbi-pagina">
      <aside className="pbi-lateral">{lateral}</aside>
      <div className="pbi-principal">{children}</div>
    </div>
  );
}
