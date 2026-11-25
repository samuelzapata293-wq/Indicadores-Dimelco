import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { clienteSupabase } from "../lib/supabase";
import type { ResultadoLectura } from "../datos/excel";
import { compararConActual, ErrorCarga, subirYCargar } from "../datos/carga";
import { useCargas, useDatosModelo } from "../datos/lectura";

const MAX_AVISOS = 50;
const NOMBRES: Record<string, string> = {
  equipos: "Equipos",
  responsables: "Responsables",
  tipos_mantto: "Tipos de mantenimiento",
  metas: "Metas",
  paros: "Paros",
};
// Tablas de Excel del contrato (sección 1) → tabla de la app.
const TABLA_EXCEL: Record<string, string> = {
  equipos: "Tabla5",
  responsables: "Tabla18",
  tipos_mantto: "Tabla9",
  metas: "Tabla15",
  paros: "Tabla2",
};

const nf = new Intl.NumberFormat("es-MX");
const num = (n: number) => nf.format(n);
const signo = (n: number) => (n > 0 ? `+${num(n)}` : num(n));

function fechaLocal(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "medium" });
}

type Fase =
  | { paso: "elegir" }
  | { paso: "leyendo"; nombre: string }
  | { paso: "revisar"; archivo: File; lectura: ResultadoLectura }
  | { paso: "cargando"; archivo: File; lectura: ResultadoLectura }
  | { paso: "listo"; id: number; hora: Date; archivo: string };

const ESTILO = `
.carga { max-width: 960px; display: flex; flex-direction: column; gap: 24px; }
.carga h2 { font-size: 18px; margin: 0 0 8px; color: var(--verde-oscuro); }
.carga-zona { border: 2px dashed var(--borde); border-radius: 8px; padding: 32px 16px; text-align: center; color: var(--texto-suave); background: #fafafa; }
.carga-zona.arrastrando { border-color: var(--verde-tabla); background: #eef6f3; }
.carga-zona p { margin: 0 0 12px; }
.carga-cuadro { border: 1px solid var(--borde); border-radius: 8px; padding: 16px; background: var(--blanco); }
.carga-error { border: 1px solid #e0a0a0; background: #fdf0f0; color: #9c0006; border-radius: 8px; padding: 12px 16px; }
.carga-error ul, .carga-avisos ul { margin: 6px 0 0; padding-left: 20px; }
.carga-ok { border: 1px solid #9cc9b9; background: #eef6f3; border-radius: 8px; padding: 16px; }
.carga-acciones { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.boton-sec { padding: 10px 16px; font: inherit; font-weight: 600; color: var(--verde-tabla); background: var(--blanco); border: 1px solid var(--verde-tabla); border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
.boton-sec:hover { background: #eef6f3; }
.carga-tabla .tabla-pbi th { padding: 6px 8px; }
.carga-tabla .tabla-pbi table { min-width: 0; }
.carga-resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px 24px; margin: 0; }
.carga-resumen dt { font-size: 13px; color: var(--texto-suave); }
.carga-resumen dd { margin: 0 0 6px; font-weight: 600; }
`;

function Tabla({ cabecera, filas, vacio }: { cabecera: string[]; filas: (string | number)[][]; vacio?: string }) {
  return (
    <div className="carga-tabla">
      <div className="tabla-pbi">
        <table>
          <thead>
            <tr>
              {cabecera.map((c, i) => (
                <th key={c} className={i > 0 ? "der" : undefined}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td className="vacio" colSpan={cabecera.length}>{vacio ?? "Sin datos"}</td></tr>
            )}
            {filas.map((f, i) => (
              <tr key={i}>
                {f.map((c, j) => (
                  <td key={j} className={j > 0 ? "der" : undefined}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Revision({ lectura }: { lectura: ResultadoLectura }) {
  const { data: actual, isLoading, isError } = useDatosModelo();
  const { resumen, avisos } = lectura;
  const comp = useMemo(() => compararConActual(lectura.datos, actual), [lectura.datos, actual]);
  const d = resumen.descartadas;
  const descartes = d.sinAviso + d.sinFechaFin + d.sinEquipo + d.sinFechaInicio;

  return (
    <>
      <section className="carga-cuadro">
        <h2>Contenido del libro</h2>
        <Tabla
          cabecera={["Tabla", "Tabla de Excel", "Filas leídas"]}
          filas={Object.keys(NOMBRES).map((k) => [NOMBRES[k], TABLA_EXCEL[k], num(lectura.datos[k as keyof typeof lectura.datos].length)])}
        />
        <h2 style={{ marginTop: 16 }}>Paros</h2>
        <dl className="carga-resumen">
          <div><dt>Rango de fechas de inicio</dt><dd>{fechaLocal(resumen.fechaMin)} a {fechaLocal(resumen.fechaMax)}</dd></div>
          <div><dt>Filas descartadas</dt><dd>{num(descartes)}</dd></div>
          <div><dt>Sin aviso</dt><dd>{num(d.sinAviso)}</dd></div>
          <div><dt>Sin fecha de fin</dt><dd>{num(d.sinFechaFin)}</dd></div>
          <div><dt>Sin equipo en la lista</dt><dd>{num(d.sinEquipo)}</dd></div>
          {d.sinFechaInicio > 0 && <div><dt>Sin fecha de inicio</dt><dd>{num(d.sinFechaInicio)}</dd></div>}
        </dl>
      </section>

      <section className="carga-cuadro">
        <h2>Comparación con los datos actuales</h2>
        {isLoading && <p className="nota">Leyendo los datos actuales…</p>}
        {isError && <p className="nota">No se pudieron leer los datos actuales; la comparación no está disponible.</p>}
        {!isLoading && !isError && !comp.hayActual && <p className="nota">La base está vacía: todas las filas son nuevas.</p>}
        {!isLoading && !isError && (
          <>
            <Tabla
              cabecera={["Tabla", "Actual", "Nuevo", "Filas nuevas", "Filas quitadas"]}
              filas={comp.tablas.map((t) => [NOMBRES[t.tabla] ?? t.tabla, num(t.actual), num(t.nuevo), signo(t.nuevas), num(-t.quitadas)])}
            />
            <dl className="carga-resumen" style={{ marginTop: 12 }}>
              <div><dt>Rango de paros actual</dt><dd>{comp.paros.rangoActual ? `${fechaLocal(comp.paros.rangoActual.min)} a ${fechaLocal(comp.paros.rangoActual.max)}` : "—"}</dd></div>
              <div><dt>Rango de paros nuevo</dt><dd>{comp.paros.rangoNuevo ? `${fechaLocal(comp.paros.rangoNuevo.min)} a ${fechaLocal(comp.paros.rangoNuevo.max)}` : "—"}</dd></div>
              <div><dt>Avisos nuevos en los últimos 30 días del libro</dt><dd>{num(comp.paros.avisosNuevos30d)}</dd></div>
            </dl>
          </>
        )}
      </section>

      {avisos.length > 0 && (
        <section className="carga-cuadro carga-avisos">
          <h2>Avisos ({num(avisos.length)})</h2>
          <p className="nota">No impiden la carga.</p>
          <ul>
            {avisos.slice(0, MAX_AVISOS).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
          {avisos.length > MAX_AVISOS && <p className="nota">y {num(avisos.length - MAX_AVISOS)} más</p>}
        </section>
      )}
    </>
  );
}

function Historial() {
  const { data, isLoading, isError } = useCargas(10);
  return (
    <section className="carga-cuadro">
      <h2>Últimas cargas</h2>
      {isLoading && <p className="nota">Cargando…</p>}
      {isError && <p className="nota">No se pudo leer el historial.</p>}
      {data && (
        <Tabla
          cabecera={["Fecha", "Archivo", "Filas de paros", "Rango de fechas"]}
          filas={data.map((c) => [
            fechaHora(c.fecha_carga),
            c.archivo ?? "—",
            c.filas.paros !== undefined ? num(c.filas.paros) : "—",
            `${fechaLocal(c.fecha_min)} a ${fechaLocal(c.fecha_max)}`,
          ])}
          vacio="Todavía no hay cargas"
        />
      )}
    </section>
  );
}

export default function Cargar() {
  const qc = useQueryClient();
  const [fase, setFase] = useState<Fase>({ paso: "elegir" });
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [errorCarga, setErrorCarga] = useState<ErrorCarga | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setErrorLectura(null);
    setErrorCarga(null);
    setConfirmar(false);
    if (!/\.xlsx$/i.test(archivo.name)) {
      setErrorLectura("El archivo debe ser un libro de Excel con extensión .xlsx.");
      return;
    }
    setFase({ paso: "leyendo", nombre: archivo.name });
    // Deja que el navegador pinte «Leyendo el libro…» antes del trabajo pesado.
    await new Promise((r) => setTimeout(r, 50));
    try {
      const { leerLibro } = await import("../datos/excel");
      const lectura = await leerLibro(await archivo.arrayBuffer());
      setFase({ paso: "revisar", archivo, lectura });
    } catch (e) {
      setErrorLectura(`No se pudo leer el libro: ${e instanceof Error ? e.message : String(e)}`);
      setFase({ paso: "elegir" });
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    void elegir(e.dataTransfer.files[0]);
  }

  async function cargar(archivo: File, lectura: ResultadoLectura) {
    setErrorCarga(null);
    setConfirmar(false);
    setFase({ paso: "cargando", archivo, lectura });
    try {
      const id = await subirYCargar(clienteSupabase(), archivo, lectura.datos);
      // Refresca el tablero y el historial.
      await qc.invalidateQueries();
      setFase({ paso: "listo", id, hora: new Date(), archivo: archivo.name });
    } catch (e) {
      setErrorCarga(e instanceof ErrorCarga ? e : new ErrorCarga("carga", e instanceof Error ? e.message : String(e)));
      setFase({ paso: "revisar", archivo, lectura });
    }
  }

  function reiniciar() {
    setFase({ paso: "elegir" });
    setErrorCarga(null);
    setErrorLectura(null);
    setConfirmar(false);
    if (entrada.current) entrada.current.value = "";
  }

  const fatales = fase.paso === "revisar" || fase.paso === "cargando" ? fase.lectura.errores : [];

  return (
    <div className="carga">
      <style>{ESTILO}</style>

      {(fase.paso === "elegir" || fase.paso === "leyendo") && (
        <section>
          <h2>Paso 1. Elegir el libro</h2>
          <div
            className={`carga-zona${arrastrando ? " arrastrando" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
          >
            {fase.paso === "leyendo" ? (
              <p role="status">Leyendo el libro… <strong>{fase.nombre}</strong></p>
            ) : (
              <>
                <p>Arrastre aquí el libro maestro (.xlsx) o elíjalo desde su equipo.</p>
                <button type="button" className="boton" onClick={() => entrada.current?.click()}>Elegir archivo</button>
              </>
            )}
            <input
              ref={entrada}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => void elegir(e.target.files?.[0])}
            />
          </div>
          {errorLectura && <p className="error-texto" role="alert">{errorLectura}</p>}
        </section>
      )}

      {(fase.paso === "revisar" || fase.paso === "cargando") && (
        <>
          <section>
            <h2>Paso 2. Revisar</h2>
            <p className="nota">Archivo: <strong>{fase.archivo.name}</strong></p>
          </section>

          {fatales.length > 0 ? (
            <div className="carga-error" role="alert">
              <strong>El libro tiene errores y no se puede cargar:</strong>
              <ul>{fatales.map((e, i) => <li key={i}>{e}</li>)}</ul>
              <div className="carga-acciones">
                <button type="button" className="boton-sec" onClick={reiniciar}>Elegir otro archivo</button>
              </div>
            </div>
          ) : (
            <>
              <Revision lectura={fase.lectura} />
              <section>
                <h2>Paso 3. Cargar a la base</h2>
                <p className="nota">Reemplaza todos los datos actuales por los de este libro.</p>
                {errorCarga && (
                  <div className="carga-error" role="alert" style={{ marginTop: 8 }}>
                    <strong>{errorCarga.etapa === "subida" ? "No se pudo subir el archivo; no se cargó nada." : "La base rechazó la carga; no se cambió nada."}</strong>
                    <div>{errorCarga.message}</div>
                    {errorCarga.detalle && <div>{errorCarga.detalle}</div>}
                  </div>
                )}
                <div className="carga-acciones">
                  {!confirmar ? (
                    <button type="button" className="boton" disabled={fase.paso === "cargando"} onClick={() => setConfirmar(true)}>
                      Cargar a la base
                    </button>
                  ) : (
                    <>
                      <span>¿Reemplazar los datos actuales con {num(fase.lectura.datos.paros.length)} paros de este libro?</span>
                      <button type="button" className="boton" disabled={fase.paso === "cargando"} onClick={() => void cargar(fase.archivo, fase.lectura)}>
                        Sí, cargar
                      </button>
                      <button type="button" className="boton-sec" onClick={() => setConfirmar(false)}>Cancelar</button>
                    </>
                  )}
                  {fase.paso === "cargando" && <span role="status">Subiendo y cargando…</span>}
                  {fase.paso === "revisar" && <button type="button" className="boton-sec" onClick={reiniciar}>Elegir otro archivo</button>}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {fase.paso === "listo" && (
        <div className="carga-ok" role="status">
          <strong>Carga terminada.</strong>
          <div>El período que dejes en los filtros de fecha queda guardado para todos.</div>
          <div>Id de carga: {fase.id}</div>
          <div>Archivo: {fase.archivo}</div>
          <div>Hora: {fase.hora.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "medium" })}</div>
          <div className="carga-acciones">
            <Link to="/" className="boton-sec">Ver tablero</Link>
            <button type="button" className="boton-sec" onClick={reiniciar}>Cargar otro libro</button>
          </div>
        </div>
      )}

      <Historial />
    </div>
  );
}
