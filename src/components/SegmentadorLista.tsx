import { useEffect, useRef } from "react";
import "./componentes.css";

export interface OpcionLista {
  valor: string;
  etiqueta: string;
}

interface Base {
  titulo: string;
  opciones: OpcionLista[];
}
interface Multiple extends Base {
  modo?: "multiple";
  seleccion: string[];
  onChange: (seleccion: string[]) => void;
}
interface Unica extends Base {
  modo: "unica";
  seleccion: string | null;
  onChange: (seleccion: string) => void;
}
type Props = Multiple | Unica;

function CasillaSelectAll({ estado, onChange }: { estado: "todo" | "nada" | "parcial"; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = estado === "parcial";
  }, [estado]);
  return (
    <label className="seg-item">
      <input ref={ref} type="checkbox" className="seg-casilla" checked={estado === "todo"} onChange={onChange} />
      <span>Select all</span>
    </label>
  );
}

/** Cabecera verde y lista: casillas con "Select all" (múltiple) o radios (selección única). */
export default function SegmentadorLista(props: Props) {
  const { titulo, opciones } = props;

  if (props.modo === "unica") {
    return (
      <section className="seg">
        <h3 className="seg-cabecera">{titulo}</h3>
        <div className="seg-cuerpo seg-lista" role="radiogroup" aria-label={titulo}>
          {opciones.map((o) => (
            <label key={o.valor} className="seg-item">
              <input
                type="radio"
                className="seg-radio"
                name={`seg-${titulo}`}
                checked={props.seleccion === o.valor}
                onChange={() => props.onChange(o.valor)}
              />
              <span>{o.etiqueta}</span>
            </label>
          ))}
        </div>
      </section>
    );
  }

  const sel = props.seleccion;
  const estado = sel.length === 0 ? "nada" : sel.length === opciones.length ? "todo" : "parcial";
  const alternar = (v: string) =>
    props.onChange(sel.includes(v) ? sel.filter((x) => x !== v) : opciones.map((o) => o.valor).filter((x) => x === v || sel.includes(x)));
  return (
    <section className="seg">
      <h3 className="seg-cabecera">{titulo}</h3>
      <div className="seg-cuerpo seg-lista">
        <CasillaSelectAll
          estado={estado}
          onChange={() => props.onChange(estado === "todo" ? [] : opciones.map((o) => o.valor))}
        />
        {opciones.map((o) => (
          <label key={o.valor} className="seg-item">
            <input
              type="checkbox"
              className="seg-casilla"
              checked={sel.includes(o.valor)}
              onChange={() => alternar(o.valor)}
            />
            <span>{o.etiqueta}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
