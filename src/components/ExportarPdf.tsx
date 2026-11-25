// Exportar PDF: renderiza las 8 páginas del tablero fuera de pantalla (lienzo de 1280x720 a escala 1,
// con los mismos datos y filtros que ve el usuario), captura cada una como imagen y arma un PDF
// horizontal con una página por hoja. Las bibliotecas se cargan con import dinámico al pulsar el botón.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFiltros } from "./Filtros";
import { CtxForzarLienzo } from "./LienzoPbi";
import PaginaFamilia from "../pages/PaginaFamilia";
import Resumen from "../pages/Resumen";
import Mensual from "../pages/Mensual";
import PortadaDatos from "../pages/PortadaDatos";
import { PAGINAS_FAMILIA } from "../pages/paginasFamilia";
import { TAMANO_PAGINA } from "../pages/disenos";

const ESCALA_IMAGEN = 2;
const TIEMPO_MAX_ESPERA_MS = 20000;

interface PaginaExport {
  nombre: string;
  /** La página dibuja gráficos ECharts: hay que esperar a que terminen. */
  grafico: boolean;
  contenido: JSX.Element;
}

const PAGINAS: PaginaExport[] = [
  { nombre: "Portada", grafico: false, contenido: <PortadaDatos /> },
  ...PAGINAS_FAMILIA.map((p) => ({
    nombre: p.ruta,
    grafico: true,
    contenido: <PaginaFamilia key={p.ruta} titulo={p.titulo} equiposGrafico={p.grafico} equiposTabla={p.tabla} diseno={p.diseno} />,
  })),
  { nombre: "Resumen", grafico: false, contenido: <Resumen /> },
  { nombre: "Mensual", grafico: true, contenido: <Mensual /> },
];

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const siguienteCuadro = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function paginaLista(el: HTMLElement, grafico: boolean): boolean {
  if (!el.querySelector(".lienzo")) return false;
  if (el.querySelector(".lienzo-estado")) return false; // "Cargando datos…" o error
  if (grafico && !el.querySelector(".graf-lienzo svg, .panel-sem-lienzo svg")) return false;
  return true;
}

/** Espera a que las 8 páginas estén montadas con datos y a que los gráficos terminen de dibujar. */
async function esperarPaginas(raiz: HTMLElement): Promise<HTMLElement[]> {
  const inicio = Date.now();
  for (;;) {
    const hojas = Array.from(raiz.querySelectorAll<HTMLElement>("[data-hoja-pdf]"));
    if (hojas.length === PAGINAS.length && hojas.every((h, i) => paginaLista(h, PAGINAS[i].grafico))) break;
    if (Date.now() - inicio > TIEMPO_MAX_ESPERA_MS) {
      const err = raiz.querySelector(".estado-error");
      throw new Error(err?.textContent?.trim() || "Los datos o los gráficos tardaron demasiado en cargar.");
    }
    await esperar(100);
  }
  // Los valores diferidos y el redibujado de ECharts terminan unos cuadros después.
  if (document.fonts?.ready) await document.fonts.ready;
  await esperar(500);
  await siguienteCuadro();
  await siguienteCuadro();
  return Array.from(raiz.querySelectorAll<HTMLElement>("[data-hoja-pdf]"));
}

async function generarPdf(raiz: HTMLElement, nombreArchivo: string, progreso: (n: number) => void) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const hojas = await esperarPaginas(raiz);
  const { ancho, alto } = TAMANO_PAGINA;
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [ancho, alto], compress: true });
  for (let i = 0; i < hojas.length; i++) {
    progreso(i + 1);
    const lienzo = hojas[i].querySelector<HTMLElement>(".lienzo");
    if (!lienzo) throw new Error(`No se pudo dibujar la página ${i + 1}.`);
    // Se descarta la primera captura de la primera hoja si sale en blanco por fuentes sin cargar: se
    // captura una vez de calentamiento solo para la primera.
    if (i === 0) await toJpeg(lienzo, { width: ancho, height: alto, pixelRatio: 1, quality: 0.5 });
    const imagen = await toJpeg(lienzo, {
      width: ancho,
      height: alto,
      pixelRatio: ESCALA_IMAGEN,
      quality: 0.92,
      backgroundColor: "#ffffff",
      cacheBust: false,
    });
    if (i > 0) pdf.addPage([ancho, alto], "landscape");
    pdf.addImage(imagen, "JPEG", 0, 0, ancho, alto, undefined, "FAST");
    await siguienteCuadro(); // deja respirar a la interfaz entre páginas
  }
  progreso(hojas.length);
  pdf.save(nombreArchivo);
}

export function nombreArchivoPdf(desde: string, hasta: string): string {
  const sufijo = desde && hasta ? `_${desde}_${hasta}` : "";
  return `Indicadores_Dimelco${sufijo}.pdf`;
}

/** Botón discreto "Exportar PDF". Debe usarse dentro de los proveedores de datos y filtros. */
export default function BotonExportarPdf() {
  const f = useFiltros();
  const [fase, setFase] = useState<{ activo: boolean; n: number }>({ activo: false, n: 0 });
  const [error, setError] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement | null>(null);
  const ocupado = useRef(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const exportar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setError(null);
    setFase({ activo: true, n: 0 });
    try {
      // Espera a que React monte el contenedor fuera de pantalla.
      while (!raiz.current) await siguienteCuadro();
      await generarPdf(raiz.current, nombreArchivoPdf(f.periodo.desde, f.periodo.hasta), (n) => {
        if (vivo.current) setFase({ activo: true, n });
      });
    } catch (e) {
      console.error("Exportar PDF", e);
      const detalle = e instanceof Error && e.message ? ` (${e.message})` : "";
      if (vivo.current) setError(`No se pudo generar el PDF${detalle}. Intente de nuevo.`);
    } finally {
      ocupado.current = false;
      if (vivo.current) setFase({ activo: false, n: 0 });
    }
  }, [f.periodo.desde, f.periodo.hasta]);

  return (
    <>
      <button
        type="button"
        className="enlace-boton boton-exportar-pdf"
        onClick={() => void exportar()}
        disabled={fase.activo}
        aria-busy={fase.activo}
        title={error ?? undefined}
      >
        {fase.activo ? `Generando PDF ${Math.max(fase.n, 1)}/${PAGINAS.length}…` : "Exportar PDF"}
      </button>
      {error &&
        createPortal(
          <div className="exportar-pdf-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso">
              ×
            </button>
          </div>,
          document.body,
        )}
      {fase.activo &&
        createPortal(
          <div ref={raiz} className="exportando-pdf" aria-hidden="true">
            <CtxForzarLienzo.Provider value={true}>
              {PAGINAS.map((p) => (
                <div key={p.nombre} data-hoja-pdf className="hoja-pdf" style={{ width: TAMANO_PAGINA.ancho, height: TAMANO_PAGINA.alto }}>
                  {p.contenido}
                </div>
              ))}
            </CtxForzarLienzo.Provider>
          </div>,
          document.body,
        )}
    </>
  );
}
