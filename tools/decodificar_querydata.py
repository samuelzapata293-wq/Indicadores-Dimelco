#!/usr/bin/env python3
"""Decodifica las respuestas capturadas de /public/reports/querydata de Power BI.

Uso:
    python3 -I tools/decodificar_querydata.py docs/powerbi/querydata tests/fixtures/powerbi

Entrada: q_NNN.json = {"request": ..., "response": ...}. Un archivo puede traer
varias consultas (request.queries[i] <-> response.results[i]); se escribe un
fixture por consulta: q_NNN_<i>.json.

Salida de cada fixture:
  {"origen": "q_000.json", "consulta": 1, "pagina": ..., "visual": ...,
   "campos": [...], "filtros": {...}, "filas": [{campo: valor, ...}, ...]}

Solo biblioteca estandar.
"""
import datetime
import glob
import json
import os
import re
import sys

# ---------------------------------------------------------------------------
# Catalogo de paginas y visuales (de docs/powerbi/paginas.txt y pbir/*.json)
# ---------------------------------------------------------------------------
PAG_PORTADA = "Portada"
PAG_SIMBA = "Disp Simba"
PAG_JUMBO = "Disp Jumbo"
PAG_SOST = "Disp Sostenimiento"
PAG_ST35 = "Disp Scooptram ST3.5"
PAG_ST1030 = "Disp Scooptram ST1030"
PAG_RESUMEN = "Resumen Disp."
PAG_MENSUAL = "Disp Mensual"

# Numero de pagina (1..8) segun el orden visible del reporte.
NUM_PAGINA = {PAG_PORTADA: 1, PAG_SIMBA: 2, PAG_JUMBO: 3, PAG_SOST: 4,
              PAG_ST35: 5, PAG_ST1030: 6, PAG_RESUMEN: 7, PAG_MENSUAL: 8}

# Equipos de cada grafico combinado (de pag_N.txt); sirve para asignar el grafico
# y la tabla de paros a su pagina.
EQUIPOS_PAGINA = {
    PAG_SIMBA: ("SIMBA",),
    PAG_JUMBO: ("BOOMER",),
    PAG_SOST: ("DESATADOR", "EMPERNADOR"),
    PAG_ST35: ("SCOOP 3.50", "WAGNER"),
    PAG_ST1030: ("ST1030",),
}
TITULO_GRAFICO = {
    PAG_SIMBA: "Tiro Largo",
    PAG_JUMBO: "Perforación Mecánizada",
    PAG_SOST: "Equipos de Sostenimiento",
    PAG_ST35: "Cargadoras Bajo Perfil",
    PAG_ST1030: "Cargadoras Bajo Perfil",
}

OPS = {0: "=", 1: ">", 2: ">=", 3: "<", 4: "<="}


# ---------------------------------------------------------------------------
# Literales y filtros (Where)
# ---------------------------------------------------------------------------
def literal(valor):
    """Convierte el texto de un Literal de SemanticQuery a un valor Python."""
    if valor is None:
        return None
    s = valor.strip()
    if s == "null":
        return None
    if s.startswith("datetime'") and s.endswith("'"):
        return s[len("datetime'"):-1]
    if s.startswith("'") and s.endswith("'"):
        return s[1:-1].replace("''", "'")
    if s in ("true", "false"):
        return s == "true"
    m = re.fullmatch(r"(-?\d+)L", s)
    if m:
        return int(m.group(1))
    m = re.fullmatch(r"(-?[\d.]+(?:[eE][-+]?\d+)?)[DM]?", s)
    if m:
        txt = m.group(1)
        return float(txt) if re.search(r"[.eE]", txt) else int(txt)
    return s


def etiqueta_expr(expr, alias):
    """Tabla[Columna] (o Tabla[Medida] (M), Agg(...)) de una expresion."""
    if "Column" in expr:
        c = expr["Column"]
        ent = alias.get(c["Expression"]["SourceRef"]["Source"], c["Expression"]["SourceRef"]["Source"])
        return "%s[%s]" % (ent, c["Property"])
    if "Measure" in expr:
        c = expr["Measure"]
        ent = alias.get(c["Expression"]["SourceRef"]["Source"], c["Expression"]["SourceRef"]["Source"])
        return "%s[%s] (M)" % (ent, c["Property"])
    if "Aggregation" in expr:
        a = expr["Aggregation"]
        nombres = {0: "Sum", 1: "Avg", 2: "Count", 3: "Min", 4: "Max", 5: "CountNonNull"}
        return "%s(%s)" % (nombres.get(a.get("Function"), "Agg"), etiqueta_expr(a["Expression"], alias))
    return json.dumps(expr, ensure_ascii=False)


def valor_literal_expr(e):
    if "Literal" in e:
        return literal(e["Literal"]["Value"])
    return json.dumps(e, ensure_ascii=False)


def condiciones(cond, alias, negado=False):
    """Aplana una condicion en tuplas (etiqueta, operador, valor)."""
    out = []
    if "And" in cond:
        out += condiciones(cond["And"]["Left"], alias, negado)
        out += condiciones(cond["And"]["Right"], alias, negado)
    elif "Or" in cond:
        izq = condiciones(cond["Or"]["Left"], alias, negado)
        der = condiciones(cond["Or"]["Right"], alias, negado)
        out.append(("(or)", "or", [izq, der]))
    elif "Not" in cond:
        out += condiciones(cond["Not"]["Expression"], alias, not negado)
    elif "In" in cond:
        exprs = [etiqueta_expr(e, alias) for e in cond["In"]["Expressions"]]
        filas = [[valor_literal_expr(v) for v in fila] for fila in cond["In"]["Values"]]
        op = "not_in" if negado else "in"
        if len(exprs) == 1:
            out.append((exprs[0], op, [f[0] for f in filas]))
        else:
            out.append((" + ".join(exprs), op, filas))
    elif "Contains" in cond:
        c = cond["Contains"]
        op = "not_contains" if negado else "contains"
        out.append((etiqueta_expr(c["Left"], alias), op, valor_literal_expr(c["Right"])))
    elif "StartsWith" in cond:
        c = cond["StartsWith"]
        op = "not_startswith" if negado else "startswith"
        out.append((etiqueta_expr(c["Left"], alias), op, valor_literal_expr(c["Right"])))
    elif "Comparison" in cond:
        c = cond["Comparison"]
        op = OPS.get(c["ComparisonKind"], "cmp%s" % c["ComparisonKind"])
        if negado:
            op = "not(%s)" % op
        out.append((etiqueta_expr(c["Left"], alias), op, valor_literal_expr(c["Right"])))
    else:
        out.append(("(condicion no reconocida)", "raw", cond))
    return out


def filtros_legibles(query):
    alias = {f["Name"]: f["Entity"] for f in query.get("From", [])}
    res = {}
    for w in query.get("Where", []):
        for etiqueta, op, valor in condiciones(w["Condition"], alias):
            d = res.setdefault(etiqueta, {})
            clave = op
            n = 2
            while clave in d:
                clave = "%s#%d" % (op, n)
                n += 1
            d[clave] = valor
    return res


def campos_seleccionados(query):
    alias = {f["Name"]: f["Entity"] for f in query.get("From", [])}
    out = []
    for s in query["Select"]:
        if "Column" in s:
            k = "Column"
        elif "Measure" in s:
            k = "Measure"
        else:
            k = None
        if k:
            src = s[k]["Expression"]["SourceRef"]["Source"]
            et = "%s[%s]%s" % (alias.get(src, src), s[k]["Property"], " (M)" if k == "Measure" else "")
        else:
            et = etiqueta_expr(s, alias)
        out.append({"nombre": s.get("Name"), "campo": et,
                    "alias_visual": s.get("NativeReferenceName")})
    return out


# ---------------------------------------------------------------------------
# Decodificacion de DataShapeResult (dsr)
# ---------------------------------------------------------------------------
def a_numero(v, tipo):
    """Los decimales llegan a veces como texto ('10.1666...'); se pasan a float sin redondear."""
    if isinstance(v, str) and tipo in (2, 3, 4, 6):
        t = v.strip()
        t = re.sub(r"[LDM]$", "", t)
        try:
            return int(t) if tipo == 4 and re.fullmatch(r"-?\d+", t) else float(t)
        except ValueError:
            return v
    return v


def a_fecha(ms):
    return (datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=ms)).strftime("%Y-%m-%dT%H:%M:%S")


class Decodificador:
    """Decodifica result.data.dsr de una consulta.

    Reglas del formato (DataShapeResult v2):
      * descriptor.Select mapea G*/M* -> Name.
      * Cada fila DM* trae "C" con los valores que NO son repeticion ni nulo.
        Para la columna j (orden del esquema S): bit j de "R" = igual a la fila
        anterior del mismo nivel; bit j de "\u00d8" = nulo; si no, se toma el
        siguiente valor de "C".
      * La fila anterior para R se conserva por nivel entre grupos (matrices): la primera
        fila hija de un grupo puede repetir la ultima del grupo anterior.
      * "S" (esquema) solo aparece en la primera fila de cada nivel y se hereda.
      * Columnas con "DN" guardan en C un indice a ValueDicts[DN].
      * Filas con "M" anidan un nivel inferior (series): cada fila hija se
        combina con las columnas de la fila padre. SyncI* apunta a un dato
        sincronizado (DS anidado) con la etiqueta de la categoria.
    """

    def __init__(self, resultado):
        self.data = resultado["result"]["data"]
        self.dsr = self.data["dsr"]
        self.nombres = {}
        for s in self.data["descriptor"]["Select"]:
            if s and s.get("Value") and s.get("Name"):
                self.nombres[s["Value"]] = s["Name"]
            if s and s.get("Synchronized"):
                self.nombres[s["Synchronized"]["Value"]] = s["Name"]
        self.avisos = []
        self.esq = {}

    def valor(self, v, col, dicts):
        if v is None:
            return None
        if "DN" in col:
            for d in dicts:
                if col["DN"] in d:
                    v = d[col["DN"]][v]
                    break
            else:
                self.avisos.append("diccionario %s no encontrado" % col["DN"])
        t = col.get("T")
        if t == 7 and isinstance(v, (int, float)):
            return a_fecha(v)
        return a_numero(v, t)

    def una_fila(self, fila, esquema, previa, dicts):
        n = len(esquema)
        cols = {}
        if "C" in fila or "R" in fila or "\u00d8" in fila:
            C = list(fila.get("C", []))
            R = fila.get("R", 0)
            nulos = fila.get("\u00d8", 0)
            it = 0
            for j in range(n):
                bit = 1 << j
                nom = esquema[j]["N"]
                if nulos & bit:
                    cols[nom] = None
                elif R & bit:
                    cols[nom] = previa.get(nom) if previa else None
                elif it < len(C):
                    cols[nom] = self.valor(C[it], esquema[j], dicts)
                    it += 1
                else:
                    cols[nom] = None
                    self.avisos.append("C corto en fila")
            if it != len(C):
                self.avisos.append("C con %d valores sobrantes" % (len(C) - it))
        else:  # formato con claves nombradas (G0: valor)
            for col in esquema:
                nom = col["N"]
                if nom in fila:
                    cols[nom] = self.valor(fila[nom], col, dicts)
                else:
                    cols[nom] = previa.get(nom) if previa else None
        return cols

    def nivel(self, filas, prof, dicts, sync, ctx):
        res = []
        # La fila previa (para el bit R) se conserva por profundidad durante todo el DS: en una
        # matriz, la primera fila hija de un grupo repite la ultima del grupo anterior del mismo nivel.
        previas = self.__dict__.setdefault("_previa", {})
        previa = previas.get(prof)
        for fila in filas:
            if "S" in fila:
                self.esq[prof] = fila["S"]
            cols = self.una_fila(fila, self.esq[prof], previa, dicts)
            previa = previas[prof] = cols
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

    def filas(self):
        out = []
        for ds in self.dsr["DS"]:
            out += self.filas_ds(ds, [])
        return out

    def filas_ds(self, ds, dicts_padre):
        dicts = [ds.get("ValueDicts", {})] + dicts_padre
        sync = {}
        for sub in ds.get("DS", []):
            d2 = [sub.get("ValueDicts", {})] + dicts
            tabla = []
            for ph in sub.get("PH", []):
                for _m, filas in ph.items():
                    sub_dec = Decodificador.__new__(Decodificador)
                    sub_dec.avisos = self.avisos
                    sub_dec.esq = {}
                    tabla += sub_dec.nivel(filas, 0, d2, {}, {})
            sync[sub["N"]] = tabla
        self.esq = {}
        self._previa = {}
        out = []
        for ph in ds.get("PH", []):
            for _m, filas in ph.items():
                out += self.nivel(filas, 0, dicts, sync, {})
        return out

    def filas_con_nombre(self):
        res = []
        for fila in self.filas():
            r = {}
            for k, v in fila.items():
                if k in self.nombres:
                    r[self.nombres[k]] = v
                elif k.startswith("sync."):
                    r[k] = v
                else:
                    r["_" + k] = v
            res.append(r)
        return res


# ---------------------------------------------------------------------------
# Clasificacion de consultas: visual y pagina
# ---------------------------------------------------------------------------
def tipo_visual(nombres):
    """Tipo logico de consulta segun los campos seleccionados."""
    n = set(nombres)
    if n == {"Confiabilidad.Confiabilidad"}:
        return "slicer_conf"
    if "DIM_EQUIPOS.Familia" in n and "Metricas (2).MTTR_H" in n:
        return "tabla_familia"
    if "DIM_EQUIPOS.IDEQUIPO" in n and "Metricas (2).MTTR_H" in n:
        return "tabla_resumen"
    if "DIM_TIEMPO.NbSemana" in n:
        return "linea_semanal"
    if "Metricas.MetaDispSimba" in n or "Metas2026.Color_Disponibilidad" in n:
        return "combo"
    if "Sum(HECHOS_DATAMES_NPI_PP.Aviso)" in n:
        return "tabla_paros"
    if "Min(DIM_TIEMPO.Fecha)" in n:
        return "slicer_fecha"
    if n == {"Var_t: Disp.Var_t: Disp"}:
        return "slicer_vart"
    if n == {"HECHOS_DATAMES_NPI_PP.DISP"}:
        return "slicer_disp"
    if n == {"DIM_EQUIPOS.Familia"}:
        return "slicer_familia"
    return "desconocido"


def lista_pagina(filtros):
    """Lista Descripcion IN (...) mas larga = filtro de pagina (o de la visual)."""
    d = filtros.get("DIM_EQUIPOS[Descripcion]", {})
    listas = [v for k, v in d.items() if k.split("#")[0] == "in"]
    return max(listas, key=len) if listas else []


def pagina_por_equipos(lista):
    t = " ".join(lista).upper()
    if "SIMBA" in t:
        return PAG_SIMBA
    if "BOOMER" in t and "SCOOP" not in t:
        return PAG_JUMBO
    if ("DESATADOR" in t or "EMPERNADOR" in t) and "SCOOP" not in t:
        return PAG_SOST
    return None


VISUALES = {
    # tipo logico: (tipo de visual Power BI, titulo, descripcion)
    "slicer_conf": ("slicer", "Var t: Conf.", "Opciones de Confiabilidad[Confiabilidad]"),
    "slicer_vart": ("slicer", "Var t: Disp", "Opciones de Var_t: Disp[Var_t: Disp]"),
    "slicer_fecha": ("slicer", "Periodo de tiempo", "Min/Max de DIM_TIEMPO[Fecha] (rango del slicer Between)"),
    "slicer_disp": ("slicer", "DISP. GLOBAL", "Opciones de HECHOS_DATAMES_NPI_PP[DISP]"),
    "slicer_familia": ("slicer", "DISP. GLOBAL", "Opciones de DIM_EQUIPOS[Familia]"),
    "tabla_resumen": ("tableEx", "", "Tabla EQUIPO/DENOMINACION/MTTR/MTBF/Meta/Disp/Confiabilidad/Prob. de Falla"),
    "tabla_familia": ("tableEx", "", "Tabla por Familia: MTTR/MTBF/Disponibilidad/Confiabilidad/Prob. de Falla"),
    "linea_semanal": ("lineChart", "Evolucion Semanal de disponibilidades %",
                      "Categoria=DIM_TIEMPO[NbSemana], Series=DIM_EQUIPOS[Descripcion]"),
    "combo": ("lineClusteredColumnComboChart", None, "Disp Din % (columnas) y Meta_Disp (linea) por equipo"),
    "tabla_paros": ("tableEx", "", "Tabla de paros: Sap/Equipo/Aviso/Descripcion/F-H Inicio/F-H Fin/Hrs Paro Ventana/Responsable/Tipo de Paro"),
}


def clasificar(items):
    """items: lista de dicts con 'archivo', 'idx', 'tipo', 'filtros', 'query', 'filas'.
    Asigna item['pagina'], item['criterio'] y item['visual']."""
    # 1) anclas con pagina determinada por campos / equipos
    firmas = {}  # frozenset(lista de equipos) -> pagina
    for it in items:
        t = it["tipo"]
        lista = lista_pagina(it["filtros"])
        pag = crit = None
        if t in ("slicer_conf", "tabla_familia", "tabla_resumen"):
            pag, crit = PAG_RESUMEN, "campos (Metricas MTTR/MTBF/Confiabilidad) -> Resumen Disp."
        elif t == "linea_semanal":
            pag, crit = PAG_MENSUAL, "campos (DIM_TIEMPO[NbSemana] + Series por equipo) -> Disp Mensual"
        elif t in ("combo", "tabla_paros"):
            pag = pagina_por_equipos(lista)
            if pag:
                crit = "filtro de pagina DIM_EQUIPOS[Descripcion] IN (...)"
        it["pagina"], it["criterio"] = pag, crit
        if pag and lista and t != "combo":
            firmas.setdefault(frozenset(lista), pag)
    # 2) par ST3.5 / ST1030 (mismo filtro de pagina)
    for it in items:
        if it["pagina"] or it["tipo"] not in ("combo", "tabla_paros"):
            continue
        if it["tipo"] == "combo":
            nombres = {f.get("DIM_EQUIPOS.Descripcion") for f in it["filas"]}
            if nombres and all("ST1030" in (n or "") for n in nombres):
                it["pagina"], it["criterio"] = PAG_ST1030, "equipos del grafico (todos ST1030)"
            elif nombres and all(("3.50" in (n or "") or "WAGNER" in (n or "")) for n in nombres):
                it["pagina"], it["criterio"] = PAG_ST35, "equipos del grafico (Wagner y SCOOP 3.50 N°6)"
        else:
            orden = it["query"].get("OrderBy", [])
            prop = None
            if orden:
                e = orden[0]["Expression"]
                prop = (e.get("Column") or e.get("Measure") or {}).get("Property")
            # pag_6.txt (ST1030) ordena por Sap (IDEQUIPO); pag_5.txt (ST3.5) por Hrs Paro Ventana desc
            if prop == "IDEQUIPO":
                it["pagina"], it["criterio"] = PAG_ST1030, "orden de la tabla (IDEQUIPO asc) = pag_6.txt"
            elif prop == "Hrs Paro Ventana":
                it["pagina"], it["criterio"] = PAG_ST35, "orden de la tabla (Hrs Paro Ventana desc) = pag_5.txt"
    # 3) slicers: por firma de la lista de equipos de pagina; si no, por cercania a anclas ST
    for it in items:
        if it["pagina"]:
            continue
        lista = lista_pagina(it["filtros"])
        pag = firmas.get(frozenset(lista)) if lista else None
        if pag:
            it["pagina"], it["criterio"] = pag, "mismo filtro de pagina DIM_EQUIPOS[Descripcion] que un visual de la pagina"
            continue
        p2 = pagina_por_equipos(lista)
        if p2:
            it["pagina"], it["criterio"] = p2, "filtro de pagina DIM_EQUIPOS[Descripcion] IN (...)"
    # 4) lo que queda: lista ST (compartida por ST3.5 y ST1030) -> ancla ST mas cercana por orden de captura
    pos = {id(it): n for n, it in enumerate(items)}
    anclas_st = [it for it in items if it["pagina"] in (PAG_ST35, PAG_ST1030) and it["tipo"] in ("combo", "tabla_paros")]
    for it in items:
        if it["pagina"]:
            continue
        cand = [a for a in anclas_st if a["archivo"] == it["archivo"]] or anclas_st
        if cand and "SCOOP" in " ".join(lista_pagina(it["filtros"])).upper() and len(lista_pagina(it["filtros"])) < 15:
            a = min(cand, key=lambda x: (abs(pos[id(x)] - pos[id(it)]), pos[id(x)]))
            it["pagina"] = a["pagina"]
            it["criterio"] = "filtro de pagina compartido ST3.5/ST1030; asignada por orden de captura (visual ST mas cercano)"
        else:
            # Mensual: lista de 21 equipos propia (difiere de la de Resumen) o slicer Familia
            fl = it["filtros"]
            if "DIM_EQUIPOS[Familia]" in fl or it["tipo"] == "slicer_familia" or lista_pagina(fl):
                it["pagina"] = PAG_MENSUAL
                it["criterio"] = "filtro de pagina distinto al de Resumen (lista de 21 equipos con 'SCOOP3.5 No.02'); orden de captura tras el grafico semanal"
    for it in items:
        v = VISUALES[it["tipo"]] if it["tipo"] in VISUALES else ("desconocido", "", "")
        titulo = v[1]
        if it["tipo"] == "combo":
            titulo = TITULO_GRAFICO.get(it["pagina"], "")
        if it["tipo"] == "slicer_vart" and it["pagina"] == PAG_RESUMEN:
            titulo = "Var t: Disp"
        it["visual"] = {"tipo": v[0], "titulo": titulo, "descripcion": v[2]}


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------
def nombre_fila(campos, d):
    """Ordena claves segun el orden de seleccion; renombra auxiliares."""
    res = {}
    for c in campos:
        n = c["nombre"]
        if n in d:
            v = d[n]
            if n.endswith(".IDEQUIPO") and v is not None:
                v = str(v)
            res[n] = v
    for k, v in d.items():
        if k in res or k.startswith("sync.") or k.startswith("_SyncI"):
            continue
        if k == "_K0":
            res["DIM_TIEMPO.NbSemana_orden"] = v
        elif k.startswith("_"):
            res[k] = v
    return res


def proyecciones(nodo):
    """Indices de Select usados en Binding (listas 'Projections' en cualquier nivel)."""
    res = set()
    if isinstance(nodo, dict):
        for k, v in nodo.items():
            if k == "Projections" and isinstance(v, list):
                res.update(x for x in v if isinstance(x, int))
            else:
                res |= proyecciones(v)
    elif isinstance(nodo, list):
        for v in nodo:
            res |= proyecciones(v)
    return res


def volcar(obj):
    cab = {k: v for k, v in obj.items() if k != "filas"}
    s = json.dumps(cab, indent=2, ensure_ascii=False)
    s = s[:s.rindex("\n}")]
    filas = ",\n".join("    " + json.dumps(f, ensure_ascii=False) for f in obj["filas"])
    return s + ',\n  "filas": [\n' + filas + "\n  ]\n}\n"


def main(argv):
    if len(argv) != 3:
        sys.stderr.write(__doc__)
        return 2
    entrada, salida = argv[1], argv[2]
    os.makedirs(salida, exist_ok=True)
    items = []
    for ruta in sorted(glob.glob(os.path.join(entrada, "q_*.json"))):
        with open(ruta, encoding="utf-8") as fh:
            d = json.load(fh)
        qs, rs = d["request"]["queries"], d["response"]["results"]
        if len(qs) != len(rs):
            sys.stderr.write("%s: %d consultas vs %d resultados\n" % (ruta, len(qs), len(rs)))
        for i, (q, r) in enumerate(zip(qs, rs)):
            cmd = q["Query"]["Commands"][0]["SemanticQueryDataShapeCommand"]
            query = cmd["Query"]
            campos = campos_seleccionados(query)
            dec = Decodificador(r)
            filas = [nombre_fila(campos, f) for f in dec.filas_con_nombre()]
            avisos = sorted(set(dec.avisos))
            rc = None
            for ev in r["result"]["data"].get("metrics", {}).get("Events", []):
                if ev.get("Name") == "Execute DAX Query":
                    rc = ev.get("Metrics", {}).get("RowCount")
            # RowCount del servidor cuenta tambien filas de total/sincronizacion: solo avisa si faltan filas
            if rc is not None and len(filas) > rc:
                avisos.append("RowCount del servidor=%s, filas decodificadas=%d" % (rc, len(filas)))
            # campos proyectados que no devolvieron ningun valor (p. ej. medida en blanco)
            proy = proyecciones(cmd.get("Binding", {}))
            presentes = set().union(*[set(f) for f in filas]) if filas else set()
            vacios = [c["nombre"] for j, c in enumerate(campos) if j in proy and c["nombre"] not in presentes]
            items.append({
                "archivo": os.path.basename(ruta), "idx": i, "query": query,
                "tipo": tipo_visual([c["nombre"] for c in campos]),
                "filtros": filtros_legibles(query), "campos": campos, "filas": filas,
                "avisos": avisos, "vacios": vacios, "bind": cmd.get("Binding", {}),
            })
    clasificar(items)
    for it in items:
        pag = it["pagina"]
        out = {
            "origen": it["archivo"],
            "consulta": it["idx"],
            "pagina": pag,
            "pagina_numero": NUM_PAGINA.get(pag),
            "asignacion_pagina": it["criterio"],
            "visual": it["visual"],
            "campos": it["campos"],
            "filtros": it["filtros"],
            "campos_sin_valores": it["vacios"],
            "avisos_decodificacion": it["avisos"],
            "filas": it["filas"],
        }
        nombre = "%s_%d.json" % (os.path.splitext(it["archivo"])[0], it["idx"])
        with open(os.path.join(salida, nombre), "w", encoding="utf-8") as fh:
            fh.write(volcar(out))
        print("%-14s %-22s %-30s filas=%d" % (nombre, pag, it["visual"]["tipo"] + ":" + it["tipo"], len(it["filas"])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
