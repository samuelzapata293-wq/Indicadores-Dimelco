#!/usr/bin/env python3
"""Reenvia a Power BI una consulta capturada cambiando solo los filtros y guarda el resultado.

La pagina publica del reporte consulta https://<host>/public/reports/querydata?synchronous=true
con un cuerpo {version, queries, cancelQueries, modelId} y el encabezado X-PowerBI-ResourceKey
(la clave del enlace publico). No hay token de sesion: el reenvio directo funciona. Este script
toma una consulta de docs/powerbi/querydata/q_NNN.json, cambia en su Where solo:
  * el rango de DIM_TIEMPO[Fecha]  (>= ini, < fin + 1 dia),
  * HECHOS_DATAMES_NPI_PP[DISP],
  * Var_t: Disp[Var_t: Disp] y Confiabilidad[Confiabilidad],
  * DIM_EQUIPOS[Familia],
la reenvia y guarda {request, response} mas el resultado decodificado (con
tools/decodificar_querydata.py) en tests/fixtures/powerbi_escenarios/<escenario>_<visual>.json.

Uso (siempre con -I y solo biblioteca estandar):
  python3 -I tools/consultar_powerbi.py verificar [q_001:0 ...]
      Reenvia la consulta SIN cambios y comprueba que devuelve los mismos datos que la respuesta
      guardada (tests/fixtures/powerbi/q_NNN_i.json). Sin argumentos usa q_001:0.
  python3 -I tools/consultar_powerbi.py escenarios [--solo a,b,...] [--forzar] [--pausa 4] [--seco]
      Obtiene los escenarios definidos abajo (ESCENARIOS). Omite los archivos que ya existen salvo
      con --forzar. --seco solo muestra los filtros de cada consulta, sin enviar nada.
  python3 -I tools/consultar_powerbi.py redecodificar
      Vuelve a decodificar las respuestas ya guardadas en los fixtures (no envia nada).
  python3 -I tools/consultar_powerbi.py consulta q_001:0 --fechas 2026-11-01 2026-11-20
      [--disp Mecánica|Operacional|ninguno ...] [--vart 18|24] [--conf 12|18|24] [--familia X]
      [--nombre escenario_visual]
      Una consulta suelta; imprime el resultado decodificado (con --nombre tambien lo guarda).

Es un servicio publico ajeno: una consulta por escenario y visual, una sola vez cada una y con
pausa entre consultas. Si el servicio contesta con error, el script se detiene (no reintenta).
"""
import argparse
import copy
import datetime
import importlib.util
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
import uuid

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUERYDATA = os.path.join(RAIZ, "docs", "powerbi", "querydata")
FIXTURES_BASE = os.path.join(RAIZ, "tests", "fixtures", "powerbi")
SALIDA = os.path.join(RAIZ, "tests", "fixtures", "powerbi_escenarios")

HOST = "wabi-west-us-e-primary-api.analysis.windows.net"
URL = "https://%s/public/reports/querydata?synchronous=true" % HOST
CLAVE_RECURSO = "17129cf9-bbd4-4c9e-8800-d77314fc31ba"
URL_REPORTE = ("https://app.powerbi.com/view?r=eyJrIjoiMTcxMjljZjktYmJkNC00YzllLTg4MDAtZDc3MzE0ZmMzMWJhIiwidCI6IjVl"
               "MTRjNzhkLWU2YmUtNDY2MS1hYWRjLWU5NDA2Y2NjNjcwMiIsImMiOjZ9")

# ---------------------------------------------------------------------------
# Decodificador (tools/decodificar_querydata.py), cargado por ruta porque con -I
# el directorio del script no esta en sys.path.
# ---------------------------------------------------------------------------
_spec = importlib.util.spec_from_file_location(
    "decodificar_querydata", os.path.join(os.path.dirname(os.path.abspath(__file__)), "decodificar_querydata.py"))
dq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dq)


class DecodificadorCorregido(dq.Decodificador):
    """Decodificador de tools/decodificar_querydata.py con la herencia "R" corregida entre grupos.

    En una matriz (categoria x serie) el bit R de la primera fila hija de un grupo se refiere a la
    ultima fila del grupo anterior del mismo nivel, no a "ninguna". La clase base reinicia la fila
    previa en cada grupo y entrega nulo en vez del valor repetido (p. ej. Meta_Disp o Disp Din % de
    la primera semana de un equipo cuando coincide con la ultima del equipo anterior). Aqui la fila
    previa se conserva por profundidad durante todo el DS.
    """

    def filas_ds(self, ds, dicts_padre):
        self._previa = {}
        return super().filas_ds(ds, dicts_padre)

    def nivel(self, filas, prof, dicts, sync, ctx):
        res = []
        previa = getattr(self, "_previa", {}).get(prof)
        for fila in filas:
            if "S" in fila:
                self.esq[prof] = fila["S"]
            cols = self.una_fila(fila, self.esq[prof], previa, dicts)
            previa = cols
            if hasattr(self, "_previa"):
                self._previa[prof] = cols
            actual = dict(ctx)
            actual.update(cols)
            hijos = fila.get("M")
            if hijos:
                for h in hijos:
                    for _miembro, sub in h.items():
                        res += self.nivel(sub, prof + 1, dicts, sync, actual)
            else:
                for nom in list(cols):
                    if nom.startswith("SyncI") and cols[nom] is not None:
                        for tabla in sync.values():
                            if cols[nom] < len(tabla):
                                for k, v in tabla[cols[nom]].items():
                                    actual["sync." + k] = v
                res.append(actual)
        return res

# ---------------------------------------------------------------------------
# Visuales (consulta capturada de la que se parte) y escenarios
# ---------------------------------------------------------------------------
VISUALES = {
    "resumen_equipo": ("q_001", 0),          # Resumen Disp.: tabla por equipo
    "resumen_familia": ("q_000", 1),         # Resumen Disp.: tabla por familia
    "grafico_simba": ("q_021", 0),           # Disp Simba: grafico combinado
    "tabla_simba": ("q_022", 1),             # Disp Simba: tabla de paros
    "grafico_sostenimiento": ("q_013", 0),   # Disp Sostenimiento: grafico combinado
    "tabla_sostenimiento": ("q_014", 1),     # Disp Sostenimiento: tabla de paros
    "mensual": ("q_024", 0),                 # Disp Mensual: evolucion semanal
}
TODOS = list(VISUALES)
SOLO_RESUMEN = ["resumen_equipo", "resumen_familia"]

# disp: lista de valores elegidos en DISP. GLOBAL. ["Mecánica"] se envia como la pagina lo hace
# (NOT IN ('Operacional')); cualquier otra lista como IN (...); [] = sin filtro de DISP.
ESCENARIOS = [
    dict(id="a", ini="2026-11-01", fin="2026-11-20", disp=["Mecánica"], vart=18, conf=18, visuales=TODOS,
         texto="01 al 20/11/2026, Var t: Disp 18 h, Mecánica, Conf 18 h"),
    dict(id="b", ini="2026-11-01", fin="2026-11-20", disp=["Operacional"], vart=24, visuales=TODOS,
         texto="01 al 20/11/2026, 24 h, Operacional"),
    dict(id="c", ini="2026-11-01", fin="2026-11-20", disp=["Mecánica", "Operacional"], vart=24, visuales=TODOS,
         texto="01 al 20/11/2026, 24 h, Mecánica y Operacional"),
    dict(id="c_sindisp", ini="2026-11-01", fin="2026-11-20", disp=[], vart=24, visuales=SOLO_RESUMEN,
         texto="01 al 20/11/2026, 24 h, sin filtro de DISP (incluye los códigos sueltos); solo Resumen"),
    dict(id="d_conf12", ini="2026-11-01", fin="2026-11-20", disp=["Mecánica"], vart=24, conf=12, visuales=SOLO_RESUMEN,
         texto="01 al 20/11/2026, 24 h, Mecánica, Var t: Conf. 12 h (solo Resumen)"),
    dict(id="d_conf24", ini="2026-11-01", fin="2026-11-20", disp=["Mecánica"], vart=24, conf=24, visuales=SOLO_RESUMEN,
         texto="01 al 20/11/2026, 24 h, Mecánica, Var t: Conf. 24 h (solo Resumen)"),
    dict(id="e", ini="2026-10-01", fin="2026-10-31", disp=["Mecánica"], vart=24, conf=18, visuales=TODOS,
         texto="Octubre 2026 completo, 24 h, Mecánica, Conf 18 h"),
    dict(id="f", ini="2026-09-15", fin="2026-10-15", disp=["Mecánica"], vart=24, visuales=TODOS,
         texto="15/09 al 15/10/2026 (cruza meses), 24 h, Mecánica"),
    dict(id="g_tirolargo", ini="2026-07-01", fin="2026-11-20", disp=["Mecánica"], vart=24, familia="TIRO LARGO",
         visuales=["mensual"], texto="Disp Mensual 01/07 al 20/11/2026, familia TIRO LARGO, 24 h, Mecánica"),
    dict(id="g_sostenimiento", ini="2026-07-01", fin="2026-11-20", disp=["Mecánica"], vart=24,
         familia="EQUIPOS DE SOSTENIMIENTO", visuales=["mensual"],
         texto="Disp Mensual 01/07 al 20/11/2026, familia EQUIPOS DE SOSTENIMIENTO, 24 h, Mecánica"),
]

# ---------------------------------------------------------------------------
# Modificacion de filtros
# ---------------------------------------------------------------------------
ENT_TIEMPO, COL_FECHA = "DIM_TIEMPO", "Fecha"
ENT_DISP, COL_DISP = "HECHOS_DATAMES_NPI_PP", "DISP"
ENT_VART, COL_VART = "Var_t: Disp", "Var_t: Disp"
ENT_CONF, COL_CONF = "Confiabilidad", "Confiabilidad"
ENT_FAM, COL_FAM = "DIM_EQUIPOS", "Familia"


def _lit(texto):
    return {"Literal": {"Value": "'%s'" % texto.replace("'", "''")}}


def _col(cond_expr, alias):
    """(entidad, propiedad) de una expresion Column, o None."""
    c = cond_expr.get("Column")
    if not c:
        return None
    src = c["Expression"]["SourceRef"]["Source"]
    return alias.get(src, src), c["Property"]


def _es_in_de(cond, alias, ent, prop):
    i = cond.get("In")
    if not i or len(i["Expressions"]) != 1:
        return False
    return _col(i["Expressions"][0], alias) == (ent, prop)


def _recorrer(cond, regla):
    """Aplica regla(cond) -> condicion nueva o None, de forma recursiva (And/Not)."""
    nueva = regla(cond)
    if nueva is not None:
        return nueva
    if "And" in cond:
        cond["And"]["Left"] = _recorrer(cond["And"]["Left"], regla)
        cond["And"]["Right"] = _recorrer(cond["And"]["Right"], regla)
    elif "Not" in cond:
        cond["Not"]["Expression"] = _recorrer(cond["Not"]["Expression"], regla)
    return cond


def _fecha_lit(iso):
    return {"Literal": {"Value": "datetime'%sT00:00:00'" % iso}}


def aplicar_filtros(query, ini=None, fin=None, disp=None, vart=None, conf=None, familia=None):
    """Cambia en `query` (el objeto Query de SemanticQueryDataShapeCommand) solo los filtros pedidos.

    ini/fin: "aaaa-mm-dd", ambos inclusive (el Where guarda el fin excluyente: fin + 1 dia).
    disp: None = no tocar; [] = quitar el filtro; ["Mecánica"] = NOT IN ('Operacional') como la pagina;
          otra lista = IN (...).
    vart/conf: 18, 24 (y 12 en conf) = '18 hrs', ... familia: texto.
    Devuelve la lista de cambios hechos (texto). Lanza ValueError si el filtro no existe en la consulta.
    """
    alias = {f["Name"]: f["Entity"] for f in query.get("From", [])}
    cambios = []

    def reemplazo_in_texto(ent, prop, valor, etiqueta):
        n = [0]

        def regla(cond):
            if _es_in_de(cond, alias, ent, prop):
                cond["In"]["Values"] = [[_lit(valor)]]
                n[0] += 1
                return cond
            return None
        query["Where"] = [{**w, "Condition": _recorrer(w["Condition"], regla)} for w in query.get("Where", [])]
        return n[0]

    if ini is not None or fin is not None:
        n = [0]
        fin_excl = None if fin is None else (datetime.date.fromisoformat(fin) + datetime.timedelta(days=1)).isoformat()

        def regla_fecha(cond):
            c = cond.get("Comparison")
            if c and _col(c["Left"], alias) == (ENT_TIEMPO, COL_FECHA):
                if c["ComparisonKind"] == 2 and ini is not None:      # >=
                    c["Right"] = _fecha_lit(ini)
                    n[0] += 1
                elif c["ComparisonKind"] == 3 and fin_excl is not None:  # <
                    c["Right"] = _fecha_lit(fin_excl)
                    n[0] += 1
                return cond
            return None
        query["Where"] = [{**w, "Condition": _recorrer(w["Condition"], regla_fecha)} for w in query["Where"]]
        esperado = (ini is not None) + (fin is not None)
        if n[0] != esperado:
            raise ValueError("la consulta no tiene el filtro de DIM_TIEMPO[Fecha] esperado (%d de %d cambios)" % (n[0], esperado))
        cambios.append("Fecha %s a %s" % (ini, fin))

    if disp is not None:
        src = next((k for k, v in alias.items() if v == ENT_DISP), None)
        if src is None:
            raise ValueError("la consulta no usa %s" % ENT_DISP)
        n = [0]

        def regla_disp(cond):
            interior = cond["Not"]["Expression"] if "Not" in cond else cond
            if _es_in_de(interior, alias, ENT_DISP, COL_DISP):
                n[0] += 1
                if len(disp) == 0:
                    return {"__quitar__": True}
                expr = interior["In"]["Expressions"]
                if list(disp) == ["Mecánica"]:
                    valores, nuevo = ["Operacional"], True
                else:
                    valores, nuevo = list(disp), False
                inn = {"In": {"Expressions": expr, "Values": [[_lit(v)] for v in valores]}}
                return {"Not": {"Expression": inn}} if nuevo else inn
            return None
        nuevos = []
        for w in query["Where"]:
            c = _recorrer(w["Condition"], regla_disp)
            if isinstance(c, dict) and c.get("__quitar__"):
                continue
            nuevos.append({**w, "Condition": c})
        query["Where"] = nuevos
        if n[0] != 1:
            raise ValueError("se esperaba exactamente 1 filtro de %s[%s], hay %d" % (ENT_DISP, COL_DISP, n[0]))
        cambios.append("DISP " + ("sin filtro" if not disp else ("NOT IN Operacional" if list(disp) == ["Mecánica"] else "IN " + ", ".join(disp))))

    if vart is not None:
        if reemplazo_in_texto(ENT_VART, COL_VART, "%d hrs" % vart, "Var t: Disp") != 1:
            raise ValueError("la consulta no tiene exactamente 1 filtro de Var_t: Disp")
        cambios.append("Var t: Disp %d hrs" % vart)
    if conf is not None:
        if reemplazo_in_texto(ENT_CONF, COL_CONF, "%d hrs" % conf, "Confiabilidad") != 1:
            raise ValueError("la consulta no tiene exactamente 1 filtro de Confiabilidad")
        cambios.append("Conf. %d hrs" % conf)
    if familia is not None:
        if reemplazo_in_texto(ENT_FAM, COL_FAM, familia, "Familia") != 1:
            raise ValueError("la consulta no tiene exactamente 1 filtro de DIM_EQUIPOS[Familia]")
        cambios.append("Familia " + familia)
    return cambios


# ---------------------------------------------------------------------------
# Consulta capturada, envio y decodificacion
# ---------------------------------------------------------------------------
def consulta_capturada(q_id, idx):
    """(request de una sola consulta, fixture base decodificado) de q_NNN.json #idx."""
    with open(os.path.join(QUERYDATA, q_id + ".json"), encoding="utf-8") as fh:
        d = json.load(fh)
    req = d["request"]
    q = copy.deepcopy(req["queries"][idx])
    with open(os.path.join(FIXTURES_BASE, "%s_%d.json" % (q_id, idx)), encoding="utf-8") as fh:
        base = json.load(fh)
    return {"version": req["version"], "queries": [q], "cancelQueries": [], "modelId": req["modelId"]}, base


def cache_key(query_obj):
    """CacheKey de la captura = JSON compacto del objeto Query ({"Commands": [...]})."""
    return json.dumps(query_obj, separators=(",", ":"), ensure_ascii=False)


def contexto_ssl():
    cafile = os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"
    return ssl.create_default_context(cafile=cafile) if os.path.exists(cafile) else ssl.create_default_context()


def enviar(request):
    """POST a querydata. Una sola vez: ante cualquier error lanza RuntimeError con el detalle."""
    cuerpo = json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    cab = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "X-PowerBI-ResourceKey": CLAVE_RECURSO,
        "ActivityId": str(uuid.uuid4()),
        "RequestId": str(uuid.uuid4()),
        "Origin": "https://app.powerbi.com",
        "Referer": "https://app.powerbi.com/",
    }
    req = urllib.request.Request(URL, data=cuerpo, headers=cab, method="POST")
    try:
        with urllib.request.urlopen(req, context=contexto_ssl(), timeout=90) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError("HTTP %s: %s" % (e.code, e.read()[:500].decode("utf-8", "replace")))
    except (urllib.error.URLError, OSError) as e:
        raise RuntimeError("error de red: %s" % e)


def decodificar(response, base):
    """Filas decodificadas de results[0], con las claves en el orden y con los nombres de los fixtures base."""
    r = response["results"][0]
    if "error" in r:
        raise RuntimeError("el servicio devolvio error en la consulta: %s" % json.dumps(r["error"])[:500])
    dec = DecodificadorCorregido(r)
    filas = [dq.nombre_fila(base["campos"], f) for f in dec.filas_con_nombre()]
    return filas, sorted(set(dec.avisos))


def _iguales(a, b, tol=1e-9):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return abs(a - b) <= tol
    return a == b


def comparar_filas(a, b):
    """Lista de diferencias entre dos listas de filas (mismo orden)."""
    dif = []
    if len(a) != len(b):
        dif.append("filas: %d vs %d" % (len(a), len(b)))
    for i, (x, y) in enumerate(zip(a, b)):
        for k in sorted(set(x) | set(y)):
            if not _iguales(x.get(k), y.get(k)):
                dif.append("fila %d %s: %r vs %r" % (i, k, x.get(k), y.get(k)))
    return dif


def volcar(obj):
    """JSON legible: cabecera con sangria, una fila por linea, request y response compactos."""
    cab = {k: v for k, v in obj.items() if k not in ("filas", "request", "response")}
    s = json.dumps(cab, indent=2, ensure_ascii=False)
    s = s[:s.rindex("\n}")]
    filas = ",\n".join("    " + json.dumps(f, ensure_ascii=False) for f in obj["filas"])
    comp = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
    return (s + ',\n  "filas": [\n' + filas + '\n  ],\n  "request": ' + comp(obj["request"]) +
            ',\n  "response": ' + comp(obj["response"]) + "\n}\n")


def consultar(q_id, idx, ini=None, fin=None, disp=None, vart=None, conf=None, familia=None):
    """Arma, envia y decodifica. Devuelve dict con request, response, filas, filtros, cambios y base."""
    request, base = consulta_capturada(q_id, idx)
    q = request["queries"][0]
    cmd = q["Query"]["Commands"][0]["SemanticQueryDataShapeCommand"]
    cambios = aplicar_filtros(cmd["Query"], ini, fin, disp, vart, conf, familia)
    q["CacheKey"] = cache_key(q["Query"])
    filtros = dq.filtros_legibles(cmd["Query"])
    return {"request": request, "base": base, "cambios": cambios, "filtros": filtros}


def ejecutar(plan):
    response = enviar(plan["request"])
    filas, avisos = decodificar(response, plan["base"])
    plan.update(response=response, filas=filas, avisos=avisos)
    return plan


def guardar(plan, esc, visual, q_id, idx, ruta):
    base = plan["base"]
    ev = [e for e in plan["response"]["results"][0]["result"]["data"].get("metrics", {}).get("Events", [])]
    salida = {
        "escenario": esc["id"],
        "escenario_descripcion": esc["texto"],
        "visual_clave": visual,
        "obtenido_el": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fuente": "reenvio directo a %s (consulta %s #%d con los filtros cambiados) del reporte %s" % (URL, q_id, idx, URL_REPORTE),
        "origen": "%s.json" % q_id,
        "consulta": idx,
        "pagina": base["pagina"],
        "pagina_numero": base["pagina_numero"],
        "visual": base["visual"],
        "campos": base["campos"],
        "filtros": plan["filtros"],
        "cambios_de_filtro": plan["cambios"],
        "avisos_decodificacion": plan["avisos"],
        "filas": plan["filas"],
        "request": plan["request"],
        "response": plan["response"],
    }
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as fh:
        fh.write(volcar(salida))


# ---------------------------------------------------------------------------
# Subcomandos
# ---------------------------------------------------------------------------
def cmd_verificar(args):
    objetivos = args.consultas or ["q_001:0"]
    mal = 0
    for i, t in enumerate(objetivos):
        q_id, idx = t.split(":")
        idx = int(idx)
        if i:
            time.sleep(args.pausa)
        plan = consultar(q_id, idx)  # sin cambios de filtro
        original = consulta_capturada(q_id, idx)[0]["queries"][0]
        mismo_cache = plan["request"]["queries"][0]["CacheKey"] == original["CacheKey"]
        plan = ejecutar(plan)
        dif = comparar_filas(plan["filas"], plan["base"]["filas"])
        print("%s:%d  filas reenviadas=%d guardadas=%d  CacheKey regenerado identico=%s  diferencias=%d  avisos=%s"
              % (q_id, idx, len(plan["filas"]), len(plan["base"]["filas"]), mismo_cache, len(dif), plan["avisos"]))
        for d in dif[:10]:
            print("   ", d)
        mal += bool(dif)
    return 1 if mal else 0


def cmd_escenarios(args):
    solo = set(args.solo.split(",")) if args.solo else None
    pendientes = []
    for esc in ESCENARIOS:
        if solo and esc["id"] not in solo:
            continue
        for visual in esc["visuales"]:
            ruta = os.path.join(SALIDA, "%s_%s.json" % (esc["id"], visual))
            if os.path.exists(ruta) and not args.forzar:
                print("ya existe, se omite: %s" % os.path.relpath(ruta, RAIZ))
                continue
            pendientes.append((esc, visual, ruta))
    print("%d consultas por enviar" % len(pendientes))
    primera = True
    for esc, visual, ruta in pendientes:
        q_id, idx = VISUALES[visual]
        resumen = visual in SOLO_RESUMEN
        plan = consultar(q_id, idx, ini=esc["ini"], fin=esc["fin"], disp=esc["disp"], vart=esc.get("vart"),
                         conf=esc.get("conf") if resumen else None, familia=esc.get("familia"))
        print("[%s] %-22s %s" % (esc["id"], visual, "; ".join(plan["cambios"])))
        if args.seco:
            continue
        if not primera:
            time.sleep(args.pausa)
        primera = False
        ejecutar(plan)
        guardar(plan, esc, visual, q_id, idx, ruta)
        print("      -> %d filas%s  %s" % (len(plan["filas"]), (" AVISOS " + str(plan["avisos"])) if plan["avisos"] else "",
                                          os.path.relpath(ruta, RAIZ)))
    return 0


def cmd_redecodificar(args):
    """Vuelve a decodificar, sin enviar nada, la respuesta guardada en cada fixture de escenario."""
    cambiados = 0
    for nombre in sorted(os.listdir(SALIDA)):
        if not nombre.endswith(".json"):
            continue
        ruta = os.path.join(SALIDA, nombre)
        with open(ruta, encoding="utf-8") as fh:
            fx = json.load(fh)
        with open(os.path.join(FIXTURES_BASE, "%s_%d.json" % (fx["origen"][:-5], fx["consulta"])), encoding="utf-8") as fh:
            base = json.load(fh)
        filas, avisos = decodificar(fx["response"], base)
        dif = comparar_filas(filas, fx["filas"])
        if dif:
            cambiados += 1
            print("%s: %d valores cambian (p. ej. %s)" % (nombre, len(dif), dif[0]))
            fx["filas"], fx["avisos_decodificacion"] = filas, avisos
            with open(ruta, "w", encoding="utf-8") as fh:
                fh.write(volcar(fx))
    print("%d fixtures actualizados" % cambiados)
    return 0


def cmd_consulta(args):
    q_id, idx = args.consulta.split(":")
    idx = int(idx)
    ini, fin = args.fechas if args.fechas else (None, None)
    disp = None
    if args.disp is not None:
        disp = [] if args.disp == ["ninguno"] else args.disp
    plan = consultar(q_id, idx, ini, fin, disp, args.vart, args.conf, args.familia)
    print("; ".join(plan["cambios"]) or "sin cambios de filtro")
    ejecutar(plan)
    if args.nombre:
        esc = {"id": args.nombre.split("_")[0], "texto": "consulta suelta"}
        guardar(plan, esc, args.nombre, q_id, idx, os.path.join(SALIDA, args.nombre + ".json"))
    for f in plan["filas"][:args.max]:
        print(json.dumps(f, ensure_ascii=False))
    print("%d filas" % len(plan["filas"]))
    return 0


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("verificar", help="reenviar consultas capturadas sin cambios")
    v.add_argument("consultas", nargs="*", help="q_NNN:i (por defecto q_001:0)")
    v.add_argument("--pausa", type=float, default=4)
    e = sub.add_parser("escenarios", help="obtener los escenarios definidos en ESCENARIOS")
    e.add_argument("--solo", help="ids separados por coma (a,b,c,c_sindisp,d_conf12,d_conf24,e,f,g_tirolargo,g_sostenimiento)")
    e.add_argument("--forzar", action="store_true", help="volver a pedir los que ya existen")
    e.add_argument("--pausa", type=float, default=4)
    e.add_argument("--seco", action="store_true", help="no enviar; solo mostrar los filtros")
    sub.add_parser("redecodificar", help="volver a decodificar las respuestas ya guardadas (sin enviar nada)")
    c = sub.add_parser("consulta", help="una consulta suelta con filtros cambiados")
    c.add_argument("consulta", help="q_NNN:i")
    c.add_argument("--fechas", nargs=2, metavar=("INI", "FIN"), help="aaaa-mm-dd, ambos inclusive")
    c.add_argument("--disp", nargs="*", help="Mecánica | Operacional | ... | ninguno")
    c.add_argument("--vart", type=int, choices=(18, 24))
    c.add_argument("--conf", type=int, choices=(12, 18, 24))
    c.add_argument("--familia")
    c.add_argument("--nombre", help="guardar como tests/fixtures/powerbi_escenarios/<nombre>.json")
    c.add_argument("--max", type=int, default=5, help="filas a imprimir")
    args = ap.parse_args(argv[1:])
    try:
        return {"verificar": cmd_verificar, "escenarios": cmd_escenarios, "consulta": cmd_consulta, "redecodificar": cmd_redecodificar}[args.cmd](args)
    except (RuntimeError, ValueError) as ex:
        sys.stderr.write("ERROR: %s\n" % ex)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
