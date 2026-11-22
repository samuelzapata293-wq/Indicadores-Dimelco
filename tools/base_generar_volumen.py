#!/usr/bin/env python3
"""Genera un JSON de carga con N paros ficticios (por omisión 15 000). Uso: base_generar_volumen.py salida.json [N]"""
import json, random, sys
from datetime import date, timedelta

salida = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 15000
random.seed(7)
familias = ["ACARREO MECANIZADO", "CARGADORAS BP", "EQUIPOS DE SOSTENIMIENTO", "TIRO LARGO", "PERFORACION MECANIZADA"]
equipos = [{"id_equipo": 100000 + i, "descripcion": f"EQUIPO FICTICIO {i:02d}", "familia": familias[i % 5]} for i in range(25)]
resp = [{"id_responsable": c, "denominacion": f"Grupo {c}", "responsable": r, "disponibilidad": d}
        for c, r, d in [("T-MTO-ME", "Mantenimiento", "Mecánica"), ("T-MTO-EL", "Mantenimiento", "Mecánica"),
                        ("T-OPE-MP", "Operación", "Operacional"), ("T-FES-NI", "T-FES-NI", "T-FES-NI")]]
tipos = [{"id_tipo_mantto": t, "descripcion": t} for t in ("PP", "NPI", "EPP")]
metas = [{"mes": f"01/{m:02d}/2026", "equipo_descripcion": e["descripcion"], "meta_disp": 0.85,
          "meta_mttr": None, "meta_mtbf": None, "meta_conf": None} for e in equipos for m in range(1, 10)]
paros = []
for i in range(n):
    e = random.choice(equipos)
    ini = date(2025, 1, 1) + timedelta(days=random.randrange(700))
    dur = random.randrange(10, 3000)
    fin = ini + timedelta(days=dur // 1440 + 1)
    paros.append({"aviso": 300000000 + i // 2, "id_equipo": e["id_equipo"], "fecha_inicio": ini.isoformat(),
                  "hora_inicio": f"{random.randrange(24):02d}:{random.randrange(60):02d}:00",
                  "fecha_fin": fin.isoformat(), "hora_fin": f"{random.randrange(24):02d}:{random.randrange(60):02d}:00",
                  "duracion_min": dur, "desc_paro": f"Falla ficticia número {i} en sistema hidráulico",
                  "id_responsable": random.choice(resp)["id_responsable"], "cod_falla": f"C{random.randrange(99):02d}",
                  "texto_falla": "Fuga de aceite", "id_tipo_mantto": random.choice(["PP", "NPI", "EPP"]),
                  "tipo_paro_pp_npi": "NPI", "resumen": "01 cambio de manguera hidráulica"})
with open(salida, "w", encoding="utf-8") as f:
    json.dump({"equipos": equipos, "responsables": resp, "tipos_mantto": tipos, "metas": metas, "paros": paros}, f, ensure_ascii=False)
print(f"{salida}: {n} paros, {len(equipos)} equipos, {len(metas)} metas")
