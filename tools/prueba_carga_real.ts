// Lee el Excel real con leerLibro y escribe dos archivos: el JSON de datos (lo que recibe cargar_datos)
// y los conteos esperados por tabla. Uso: npx vite-node tools/prueba_carga_real.ts <libro.xlsx> <datos.json> <conteos.json>
import { readFileSync, writeFileSync } from "node:fs";
import { leerLibro } from "../src/datos/excel";

const [libro, salidaDatos, salidaConteos] = process.argv.slice(2);
const b = readFileSync(libro);
const t0 = Date.now();
const r = await leerLibro(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
console.log(`leerLibro: ${Date.now() - t0} ms, errores: ${r.errores.length}`);
if (r.errores.length) {
  console.error(r.errores.join("\n"));
  process.exit(1);
}
const d = r.datos;
writeFileSync(salidaDatos, JSON.stringify(d));
const conteos = { equipos: d.equipos.length, responsables: d.responsables.length, tipos_mantto: d.tipos_mantto.length, metas: d.metas.length, paros: d.paros.length };
writeFileSync(salidaConteos, JSON.stringify(conteos));

// Tamaño del cuerpo de la llamada RPC que mandaría subirYCargar.
const bytes = (o: unknown) => Buffer.byteLength(JSON.stringify(o));
const cuerpo = (datos: unknown) => bytes({ datos, archivo: libro.split("/").pop(), ruta_storage: "2026/11/22-120000_LIBRO_MAESTRO_15-09-2026.xlsx" });
const completo = cuerpo(d);
const sinCampos = cuerpo({ ...d, paros: d.paros.map(({ cod_falla, texto_falla, resumen, ...resto }) => resto) });
console.log(`Cuerpo RPC: ${completo} bytes (${(completo / 1048576).toFixed(2)} MiB)`);
console.log(`Sin cod_falla, texto_falla ni resumen: ${sinCampos} bytes (${(sinCampos / 1048576).toFixed(2)} MiB), baja ${(100 * (1 - sinCampos / completo)).toFixed(1)} %`);
