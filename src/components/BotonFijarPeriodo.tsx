// Botón solo para el administrador: guarda el período que está viendo para que todos lo vean al abrir la web.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { CLAVE_CONFIGURACION, guardarPeriodo } from "../datos/lectura";
import { clienteSupabase } from "../lib/supabase";
import { useFiltros } from "./Filtros";

interface Props {
  /** true en Disp Mensual: guarda el par mensual en lugar del general. */
  mensual?: boolean;
}

export default function BotonFijarPeriodo({ mensual = false }: Props) {
  const { esAdmin } = useAuth();
  const f = useFiltros();
  const qc = useQueryClient();
  const [estado, setEstado] = useState<"reposo" | "guardando" | "ok" | "error">("reposo");
  const [error, setError] = useState("");

  useEffect(() => {
    if (estado !== "ok") return;
    const t = setTimeout(() => setEstado("reposo"), 3000);
    return () => clearTimeout(t);
  }, [estado]);

  if (!esAdmin) return null;
  const p = mensual ? f.periodoMensual : f.periodo;

  async function fijar() {
    setEstado("guardando");
    try {
      await guardarPeriodo(
        clienteSupabase(),
        mensual
          ? { mensualIni: p.desde, mensualFin: p.hasta }
          : { periodoIni: p.desde, periodoFin: p.hasta },
      );
      await qc.invalidateQueries({ queryKey: CLAVE_CONFIGURACION });
      setEstado("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("error");
    }
  }

  return (
    <div className="fijar-periodo">
      <button type="button" className="fijar-periodo-boton" disabled={estado === "guardando" || !p.desde || !p.hasta} onClick={() => void fijar()}>
        Fijar este período para todos
      </button>
      {estado === "ok" && <span className="fijar-periodo-msg" role="status">Período guardado</span>}
      {estado === "error" && <span className="fijar-periodo-msg error" role="alert">{error}</span>}
    </div>
  );
}
