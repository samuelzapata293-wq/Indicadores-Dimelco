import type { ReactNode } from "react";
import { useModelo } from "../datos/ModeloProvider";
import type { Modelo } from "../medidas/modelo";

interface Props {
  children: (modelo: Modelo) => ReactNode;
}

/** Muestra el estado de la carga (cargando, error, sin datos) y, cuando hay modelo con paros, la página. */
export default function ConModelo({ children }: Props) {
  const { cargando, error, modelo } = useModelo();
  if (error) {
    return (
      <div className="estado-datos estado-error" role="alert">
        <p><strong>No se pudieron leer los datos</strong></p>
        <p>{error.message}</p>
      </div>
    );
  }
  if (cargando || !modelo) return <p className="cargando" role="status">Cargando datos…</p>;
  if (modelo.paros.length === 0) return <p className="estado-datos" role="status">Aún no hay datos cargados</p>;
  return <>{children(modelo)}</>;
}
