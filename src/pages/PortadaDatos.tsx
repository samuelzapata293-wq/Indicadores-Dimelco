// Portada con el período que ve todo el mundo: el guardado por el administrador (configuración) o,
// si no hay, el período inicial calculado del modelo (del primer día del mes de la última fecha de
// inicio de los paros hasta esa fecha).

import { useMemo } from "react";
import { useModelo } from "../datos/ModeloProvider";
import { useConfiguracion } from "../datos/lectura";
import { elegirPeriodo, periodoConfigurado } from "../datos/periodos";
import { periodoInicial } from "../medidas/visuales";
import Portada from "./Portada";

export default function PortadaDatos() {
  const { modelo } = useModelo();
  const { data: config } = useConfiguracion();
  const periodo = useMemo(() => {
    const inicial = modelo ? periodoInicial(modelo) : null;
    return elegirPeriodo(null, periodoConfigurado(config), inicial && { desde: inicial.general.ini, hasta: inicial.general.fin });
  }, [modelo, config]);
  return <Portada fechaMin={periodo?.desde} fechaMax={periodo?.hasta} />;
}
