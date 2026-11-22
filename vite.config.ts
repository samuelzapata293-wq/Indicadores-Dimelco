import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

// --mode web: sitio para Chrome y celular (GitHub Pages) en dist-web/.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: "./",
  server: { port: 5190, strictPort: true },
  build: mode === "web" ? { outDir: "dist-web" } : undefined,
  // Sin pruebas todavía, "npm test" no debe fallar.
  test: { passWithNoTests: true },
}));
