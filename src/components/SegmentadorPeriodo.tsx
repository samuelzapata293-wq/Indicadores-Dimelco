import "./componentes.css";

export interface Periodo {
  desde: string; // aaaa-mm-dd
  hasta: string; // aaaa-mm-dd
}

interface Props {
  titulo?: string;
  valor: Periodo;
  onChange: (valor: Periodo) => void;
}

export default function SegmentadorPeriodo({ titulo = "Periodo de tiempo", valor, onChange }: Props) {
  return (
    <section className="seg">
      <h3 className="seg-cabecera">{titulo}</h3>
      <div className="seg-cuerpo seg-fechas">
        <input
          type="date"
          className="seg-fecha"
          aria-label="Desde"
          value={valor.desde}
          max={valor.hasta || undefined}
          onChange={(e) => e.target.value && onChange({ ...valor, desde: e.target.value })}
        />
        <input
          type="date"
          className="seg-fecha"
          aria-label="Hasta"
          value={valor.hasta}
          min={valor.desde || undefined}
          onChange={(e) => e.target.value && onChange({ ...valor, hasta: e.target.value })}
        />
      </div>
    </section>
  );
}
