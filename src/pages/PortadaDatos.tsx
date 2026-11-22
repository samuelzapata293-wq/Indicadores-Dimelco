// Portada con el rango de fechas de los datos: de la última carga (Supabase) o, en modo local,
// de las fechas de inicio de los paros del modelo.

import { useMemo } from "react";
import { MODO_LOCAL, useModelo } from "../datos/ModeloProvider";
import { useUltimaCarga } from "../datos/lectura";
import { serialAIso } from "../medidas/contexto";
import Portada from "./Portada";

function PortadaSupabase() {
  const { data } = useUltimaCarga();
  return <Portada fechaMin={data?.fecha_min?.slice(0, 10)} fechaMax={data?.fecha_max?.slice(0, 10)} />;
}

function PortadaLocal() {
  const { modelo } = useModelo();
  const rango = useMemo(() => {
    if (!modelo || modelo.paros.length === 0) return {};
    let a = Infinity;
    let b = -Infinity;
    for (const p of modelo.paros) {
      if (p.inicio < a) a = p.inicio;
      if (p.inicio > b) b = p.inicio;
    }
    return { fechaMin: serialAIso(a).slice(0, 10), fechaMax: serialAIso(b).slice(0, 10) };
  }, [modelo]);
  return <Portada {...rango} />;
}

export default function PortadaDatos() {
  return MODO_LOCAL ? <PortadaLocal /> : <PortadaSupabase />;
}
