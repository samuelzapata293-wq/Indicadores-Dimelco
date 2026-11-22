// Genera tests/fixtures/datos/muestra.json a partir del Excel real.
// Uso: npx vite-node tools/muestra_datos.ts [ruta_al_excel]
// Contiene todos los equipos, responsables, tipos y metas, y solo los paros de
// los equipos de la tabla Equipos con fecha de fin >= 2026-06-01.

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leerLibro } from "../src/datos/excel";

const aqui = dirname(fileURLToPath(import.meta.url));
const excel = resolve(process.argv[2] ?? resolve(aqui, "../datos_local/LIBRO_MAESTRO_15-09-2026.xlsx"));
const salida = resolve(aqui, "../tests/fixtures/datos/muestra.json");
const DESDE = "2026-06-01";

const b = readFileSync(excel);
const r = await leerLibro(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
if (r.errores.length) {
  console.error("Errores al leer el libro:\n" + r.errores.join("\n"));
  process.exit(1);
}

const muestra = { ...r.datos, paros: r.datos.paros.filter((p) => p.fecha_fin >= DESDE) };
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify(muestra) + "\n");

const kb = (statSync(salida).size / 1024).toFixed(0);
console.log(`Escrito ${salida} (${kb} KB)`);
console.log(`equipos ${muestra.equipos.length}, responsables ${muestra.responsables.length}, tipos ${muestra.tipos_mantto.length}, metas ${muestra.metas.length}, paros ${muestra.paros.length}`);
console.log(`avisos de lectura: ${r.avisos.length}`);
