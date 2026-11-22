import "./componentes.css";

export interface Periodo {
  desde: string; // aaaa-mm-dd
  hasta: string; // aaaa-mm-dd
}

interface Props {
  titulo?: string;
  valor: Periodo;
  onChange: (valor: Periodo) => void;
  /** Primer y último día seleccionables (rango de los datos), "aaaa-mm-dd". */
  min?: string;
  max?: string;
}

export default function SegmentadorPeriodo({ titulo = "Periodo de tiempo", valor, onChange, min, max }: Props) {
  return (
    <section className="seg">
      <h3 className="seg-cabecera">{titulo}</h3>
      <div className="seg-cuerpo seg-fechas">
        <input
          type="date"
          className="seg-fecha"
          aria-label="Desde"
          value={valor.desde}
          min={min || undefined}
          max={valor.hasta || max || undefined}
          onChange={(e) => e.target.value && onChange({ ...valor, desde: e.target.value })}
        />
        <input
          type="date"
          className="seg-fecha"
          aria-label="Hasta"
          value={valor.hasta}
          min={valor.desde || min || undefined}
          max={max || undefined}
          onChange={(e) => e.target.value && onChange({ ...valor, hasta: e.target.value })}
        />
      </div>
    </section>
  );
}
