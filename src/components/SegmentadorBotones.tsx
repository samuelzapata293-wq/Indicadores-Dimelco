import "./componentes.css";

export interface OpcionSeg<V extends string | number = string> {
  valor: V;
  etiqueta: string;
}

interface Props<V extends string | number> {
  titulo: string;
  opciones: OpcionSeg<V>[];
  valor: V;
  onChange: (valor: V) => void;
}

/** Cabecera verde y botones de selección única (el elegido va en gris oscuro con texto blanco). */
export default function SegmentadorBotones<V extends string | number>({
  titulo,
  opciones,
  valor,
  onChange,
}: Props<V>) {
  return (
    <section className="seg">
      <h3 className="seg-cabecera">{titulo}</h3>
      <div className="seg-cuerpo seg-botones" role="radiogroup" aria-label={titulo}>
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <button
              key={String(o.valor)}
              type="button"
              role="radio"
              aria-checked={activo}
              className={activo ? "seg-boton activo" : "seg-boton"}
              onClick={() => onChange(o.valor)}
            >
              {o.etiqueta}
            </button>
          );
        })}
      </div>
    </section>
  );
}
