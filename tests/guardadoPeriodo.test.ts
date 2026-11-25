import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearPlanificador, type EstadoGuardado, type Planificador } from "../src/datos/periodos";
import type { PeriodoAGuardar } from "../src/datos/lectura";

const A = { desde: "2026-11-01", hasta: "2026-11-20" };
const B = { desde: "2026-07-01", hasta: "2026-11-05" };

let guardar: ReturnType<typeof vi.fn<(p: PeriodoAGuardar) => Promise<void>>>;
let estados: EstadoGuardado[];
let admin: boolean;

function crear(): Planificador {
  return crearPlanificador({ guardar, habilitado: () => admin, onEstado: (e) => estados.push(e) });
}

beforeEach(() => {
  vi.useFakeTimers();
  guardar = vi.fn(async () => {});
  estados = [];
  admin = true;
});
afterEach(() => vi.useRealTimers());

describe("planificador de guardado del período", () => {
  it("no guarda al crearse ni sin cambios del administrador (montar, llegar la configuración)", async () => {
    crear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(guardar).not.toHaveBeenCalled();
    expect(estados).toEqual([]);
  });

  it("guarda tras 1,5 s sin más cambios (debounce) y solo el último valor", async () => {
    const p = crear();
    p.cambiar("general", A);
    await vi.advanceTimersByTimeAsync(1400);
    expect(guardar).not.toHaveBeenCalled();
    p.cambiar("general", B);
    await vi.advanceTimersByTimeAsync(1400);
    expect(guardar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith({ periodoIni: B.desde, periodoFin: B.hasta });
  });

  it("envía solo el par que cambió: general", async () => {
    const p = crear();
    p.cambiar("general", A);
    await vi.advanceTimersByTimeAsync(1500);
    expect(guardar).toHaveBeenCalledWith({ periodoIni: A.desde, periodoFin: A.hasta });
  });

  it("envía solo el par que cambió: mensual", async () => {
    const p = crear();
    p.cambiar("mensual", B);
    await vi.advanceTimersByTimeAsync(1500);
    expect(guardar).toHaveBeenCalledWith({ mensualIni: B.desde, mensualFin: B.hasta });
  });

  it("si cambian ambos pares antes del plazo, guarda los dos en una sola llamada", async () => {
    const p = crear();
    p.cambiar("general", A);
    await vi.advanceTimersByTimeAsync(1000);
    p.cambiar("mensual", B);
    await vi.advanceTimersByTimeAsync(1500);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledWith({
      periodoIni: A.desde, periodoFin: A.hasta, mensualIni: B.desde, mensualFin: B.hasta,
    });
  });

  it("un invitado nunca guarda", async () => {
    admin = false;
    const p = crear();
    p.cambiar("general", A);
    p.cambiar("mensual", B);
    await vi.advanceTimersByTimeAsync(10000);
    expect(guardar).not.toHaveBeenCalled();
    expect(estados).toEqual([]);
  });

  it("después de guardar no repite el par ya enviado", async () => {
    const p = crear();
    p.cambiar("general", A);
    await vi.advanceTimersByTimeAsync(1500);
    p.cambiar("mensual", B);
    await vi.advanceTimersByTimeAsync(1500);
    expect(guardar).toHaveBeenLastCalledWith({ mensualIni: B.desde, mensualFin: B.hasta });
  });

  it("estados: guardando, ok y reposo a los 4 s", async () => {
    const p = crear();
    p.cambiar("general", A);
    await vi.advanceTimersByTimeAsync(1500);
    expect(estados.map((e) => e.fase)).toEqual(["guardando", "ok"]);
    await vi.advanceTimersByTimeAsync(3900);
    expect(estados.at(-1)?.fase).toBe("ok");
    await vi.advanceTimersByTimeAsync(100);
    expect(estados.at(-1)?.fase).toBe("reposo");
  });

  it("muestra el mensaje de error de la base y no lo borra solo", async () => {
    guardar.mockRejectedValueOnce(new Error("No se pudo guardar el período: permiso denegado"));
    const p = crear();
    p.cambiar("general", A);
    await vi.advanceTimersByTimeAsync(1500);
    expect(estados.at(-1)).toEqual({ fase: "error", mensaje: "No se pudo guardar el período: permiso denegado" });
    await vi.advanceTimersByTimeAsync(10000);
    expect(estados.at(-1)?.fase).toBe("error");
  });

  it("cancelar descarta lo pendiente", async () => {
    const p = crear();
    p.cambiar("general", A);
    p.cancelar();
    await vi.advanceTimersByTimeAsync(5000);
    expect(guardar).not.toHaveBeenCalled();
  });
});
