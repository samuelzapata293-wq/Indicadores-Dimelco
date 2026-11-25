// Indicador discreto bajo el segmentador de período: solo el administrador lo ve.

import { useAuth } from "../auth";
import { useFiltros } from "./Filtros";

export default function IndicadorGuardado() {
  const { esAdmin } = useAuth();
  const { guardado } = useFiltros();
  if (!esAdmin || guardado.fase === "reposo") return null;
  return (
    <div className="guardado-periodo">
      {guardado.fase === "guardando" && <span className="guardado-periodo-msg" role="status">Guardando…</span>}
      {guardado.fase === "ok" && <span className="guardado-periodo-msg" role="status">Período guardado para todos</span>}
      {guardado.fase === "error" && <span className="guardado-periodo-msg error" role="alert">{guardado.mensaje}</span>}
    </div>
  );
}
