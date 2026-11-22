import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { COLORES, esFormatoNumerico, formatear, type FormatoCelda } from "./formato";
import "./componentes.css";

export interface ColumnaPbi<T> {
  id: string;
  titulo: string;
  valor: (fila: T) => string | number | null | undefined;
  formato?: FormatoCelda;
  alinear?: "izq" | "der";
  /** Ancho CSS (px o %). Sin él, la columna se reparte. */
  ancho?: number | string;
  /** Evita que el texto de la celda se parta en varias líneas (por defecto, solo las columnas con formato). */
  sinPartir?: boolean;
  /** Círculo verde (true) o rojo (false) antes del valor; null/undefined no dibuja nada. */
  semaforo?: (fila: T) => boolean | null | undefined;
}

interface Props<T> {
  datos: T[];
  columnas: ColumnaPbi<T>[];
  /** Orden inicial (p. ej. { id: "hrs", desc: true }). */
  ordenInicial?: { id: string; desc?: boolean };
  /** Alto máximo en px; por encima hay scroll interno con cabecera fija. */
  alturaMax?: number;
  idFila?: (fila: T, indice: number) => string;
  mensajeVacio?: string;
}

export default function TablaPbi<T>({
  datos,
  columnas,
  ordenInicial,
  alturaMax = 360,
  idFila,
  mensajeVacio = "Sin datos para mostrar.",
}: Props<T>) {
  const [orden, setOrden] = useState<SortingState>(
    ordenInicial ? [{ id: ordenInicial.id, desc: ordenInicial.desc ?? false }] : []
  );

  const defs = useMemo<ColumnDef<T>[]>(
    () =>
      columnas.map((c) => ({
        id: c.id,
        header: c.titulo,
        accessorFn: (f: T) => c.valor(f),
        sortUndefined: "last",
        cell: (ctx) => {
          const f = ctx.row.original;
          const sem = c.semaforo?.(f);
          const texto = c.formato || !c.semaforo ? formatear(ctx.getValue(), c.formato) : "";
          return (
            <>
              {sem !== null && sem !== undefined && (
                <span
                  className="semaforo"
                  style={{ background: sem ? COLORES.semaforoVerde : COLORES.semaforoRojo }}
                  role="img"
                  aria-label={sem ? "Cumple" : "No cumple"}
                />
              )}
              {texto}
            </>
          );
        },
      })),
    [columnas]
  );

  const tabla = useReactTable({
    data: datos,
    columns: defs,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: idFila ? (f, i) => idFila(f, i) : undefined,
    enableSortingRemoval: false,
    sortDescFirst: false,
  });

  const alin = (c: ColumnaPbi<T>) =>
    (c.alinear ?? (esFormatoNumerico(c.formato) ? "der" : "izq")) === "der" ? "der" : "izq";

  return (
    <div className="tabla-pbi" style={{ maxHeight: alturaMax }}>
      <table>
        <thead>
          {tabla.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h, i) => {
                const c = columnas[i];
                const dir = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    className={alin(c) === "der" ? "der" : undefined}
                    style={c.ancho !== undefined ? { width: c.ancho } : undefined}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                  >
                    <button type="button" className="th-boton" onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <span className="th-orden" aria-hidden="true">
                        {dir === "asc" ? " ▲" : dir === "desc" ? " ▼" : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {tabla.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((cell, i) => (
                <td
                  key={cell.id}
                  className={[alin(columnas[i]) === "der" ? "der" : "", columnas[i].sinPartir ?? (columnas[i].formato && columnas[i].formato !== "texto") ? "np" : ""].join(" ").trim() || undefined}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {datos.length === 0 && (
            <tr>
              <td colSpan={columnas.length} className="vacio">{mensajeVacio}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
