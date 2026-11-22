#!/usr/bin/env python3
"""Cotejo de los fixtures decodificados contra el texto visible de cada pagina.

Uso:
    python3 -I tools/verificar_fixtures.py tests/fixtures/powerbi docs/powerbi/capturas

Compara (redondeando como lo hace el reporte):
  * Resumen Disp. (pag_7.txt): tabla por equipo y tabla por familia.
  * Graficos de Disp Simba/Jumbo/Sostenimiento/ST3.5/ST1030 (pag_2..6.txt): etiquetas
    de Disp Din % y Meta_Disp (como multiconjunto: el orden de las etiquetas en el DOM
    no sigue el de las categorias).
  * Tablas de paros de pag_2..6.txt (filas visibles, en el mismo orden).
Termina con codigo 1 si algo no coincide.
"""
import datetime
import json
import os
import sys
from decimal import ROUND_HALF_UP, Decimal


def r(x, dec):
    q = Decimal(1).scaleb(-dec)
    return Decimal(repr(float(x))).quantize(q, rounding=ROUND_HALF_UP)


def fmt_num(x, dec):
    return "%s" % r(x, dec)


def fmt_pct0(x):
    return "%s%%" % r(x * 100, 0)


def fmt_pct2(x):
    return "%s %%" % r(x * 100, 2)


def lineas(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return [l.rstrip("\n") for l in fh]


def cargar(dirfix, pagina, tipo):
    res = []
    for n in sorted(os.listdir(dirfix)):
        if n.startswith("q_") and n.endswith(".json"):
            with open(os.path.join(dirfix, n), encoding="utf-8") as fh:
                d = json.load(fh)
            if d["pagina"] == pagina and d["visual"]["tipo"] == tipo:
                res.append(d)
    return res


def bloques(lns, ancho, desde=0, hasta=None):
    out, i = [], desde
    hasta = len(lns) if hasta is None else hasta
    while i < hasta:
        if lns[i] == "Select Row":
            out.append(lns[i + 1:i + 1 + ancho])
            i += 1 + ancho
        else:
            i += 1
    return out


class Cuenta:
    def __init__(self):
        self.ok = self.mal = 0

    def cmp(self, etiqueta, esperado, obtenido):
        if esperado == obtenido:
            self.ok += 1
        else:
            self.mal += 1
            print("  DIFERENCIA %s: texto=%r decodificado=%r" % (etiqueta, esperado, obtenido))


def resumen(dirfix, cap, c):
    lns = lineas(os.path.join(cap, "pag_7.txt"))
    ifam = lns.index("Familia")
    t_eq = bloques(lns, 8, 0, ifam)
    t_fam = bloques(lns, 6, ifam)
    eq = [d for d in cargar(dirfix, "Resumen Disp.", "tableEx") if "DIM_EQUIPOS.IDEQUIPO" in d["filas"][0]][0]["filas"]
    fam = [d for d in cargar(dirfix, "Resumen Disp.", "tableEx") if "DIM_EQUIPOS.Familia" in d["filas"][0]][0]["filas"]
    print("Resumen Disp. - tabla por equipo: %d filas en texto, %d decodificadas" % (len(t_eq), len(eq)))
    c.cmp("n filas equipos", len(t_eq), len(eq))
    por_id = {f["DIM_EQUIPOS.IDEQUIPO"]: f for f in eq}
    for b in t_eq:
        f = por_id.get(b[0])
        if f is None:
            c.cmp("equipo %s presente" % b[0], True, False)
            continue
        esp = [b[1], b[2], b[3], b[4], b[5], b[6], b[7]]
        got = [f["DIM_EQUIPOS.Descripcion"], fmt_num(f["Metricas (2).MTTR_H"], 2), fmt_num(f["Metricas (2).MTBF_H"], 2),
               fmt_pct0(f["Metas2026.Meta_Disp"]), fmt_pct0(f["Metricas (2).Disp Din %"]),
               fmt_pct2(f["Metricas.Confiabilidad_24h"]), fmt_pct2(f["Metricas.ProbabilidadDeFalla"])]
        for nom, e, g in zip(["Descripcion", "MTTR_H", "MTBF_H", "Meta", "Disp Din %", "Conf 24h", "Prob falla"], esp, got):
            c.cmp("%s %s" % (b[0], nom), e, g)
        print("  %s  MTTR %s  MTBF %s  Meta %s  Disp %s  Conf %s  Prob %s" % (b[0], got[1], got[2], got[3], got[4], got[5], got[6]))
    print("Resumen Disp. - tabla por familia: %d filas en texto, %d decodificadas" % (len(t_fam), len(fam)))
    c.cmp("n filas familias", len(t_fam), len(fam))
    por_fam = {f["DIM_EQUIPOS.Familia"]: f for f in fam}
    for b in t_fam:
        f = por_fam.get(b[0])
        if f is None:
            c.cmp("familia %s presente" % b[0], True, False)
            continue
        got = [fmt_num(f["Metricas (2).MTTR_H"], 2), fmt_num(f["Metricas (2).MTBF_H"], 2), fmt_pct0(f["Metricas (2).Disp Din %"]),
               fmt_pct2(f["Metricas.Confiabilidad_24h"]), fmt_pct2(f["Metricas.ProbabilidadDeFalla"])]
        for nom, e, g in zip(["MTTR", "MTBF", "Disp", "Conf", "Prob"], b[1:], got):
            c.cmp("%s %s" % (b[0], nom), e, g)
        print("  %-26s MTTR %s  MTBF %s  Disp %s  Conf %s  Prob %s" % ((b[0],) + tuple(got)))


def graficos(dirfix, cap, c):
    paginas = [("Disp Simba", 2), ("Disp Jumbo", 3), ("Disp Sostenimiento", 4), ("Disp Scooptram ST3.5", 5),
               ("Disp Scooptram ST1030", 6)]
    for pag, n in paginas:
        d = cargar(dirfix, pag, "lineClusteredColumnComboChart")[0]
        filas = d["filas"]
        lns = lineas(os.path.join(cap, "pag_%d.txt" % n))
        # etiquetas: lineas "NN%" entre el ultimo nombre de equipo / titulo y la leyenda
        ini = lns.index(d["visual"]["titulo"]) + 1
        fin = lns.index("% Disponibilidad Real")
        etiquetas = [l for l in lns[ini:fin] if l.endswith("%")]
        k = len(filas)
        disp_txt, meta_txt = etiquetas[:k], etiquetas[k:2 * k]
        disp = [fmt_pct0(f["Metricas (2).Disp Din %"]) for f in filas]
        meta = [fmt_pct0(f["Metas2026.Meta_Disp"]) for f in filas]
        print("%s (pag_%d): %d equipos; texto Disp=%s Meta=%s" % (pag, n, k, disp_txt, meta_txt))
        c.cmp("%s n etiquetas" % pag, 2 * k, len(etiquetas))
        c.cmp("%s Disp (en orden)" % pag, disp_txt, disp)
        c.cmp("%s Meta (multiconjunto)" % pag, sorted(meta_txt), sorted(meta))
        if meta_txt != meta:
            print("  nota: el orden de las etiquetas Meta en el DOM difiere del de las categorias (mismos valores)")


def fecha_txt(iso):
    t = datetime.datetime.strptime(iso, "%Y-%m-%dT%H:%M:%S")
    h = t.hour % 12 or 12
    return "%d/%d/%d %d:%02d:%02d %s" % (t.month, t.day, t.year, h, t.minute, t.second, "AM" if t.hour < 12 else "PM")


def paros(dirfix, cap, c):
    paginas = [("Disp Simba", 2), ("Disp Jumbo", 3), ("Disp Sostenimiento", 4), ("Disp Scooptram ST3.5", 5),
               ("Disp Scooptram ST1030", 6)]
    for pag, n in paginas:
        filas = [d for d in cargar(dirfix, pag, "tableEx")][0]["filas"]
        lns = lineas(os.path.join(cap, "pag_%d.txt" % n))
        bl = bloques(lns, 9)
        print("%s (pag_%d): %d filas visibles en texto, %d decodificadas" % (pag, n, len(bl), len(filas)))
        malas = 0
        for i, b in enumerate(bl):
            f = filas[i]
            got = [f["DIM_EQUIPOS.IDEQUIPO"], f["HECHOS_DATAMES_NPI_PP.DesEquipo"], str(f["Sum(HECHOS_DATAMES_NPI_PP.Aviso)"]),
                   f["HECHOS_DATAMES_NPI_PP.Desc de Paro"], fecha_txt(f["HECHOS_DATAMES_NPI_PP._F/H Inicio"]),
                   fecha_txt(f["HECHOS_DATAMES_NPI_PP._F/H Fin"]), fmt_num(f["Metricas (2).Hrs Paro Ventana"], 2),
                   f["HECHOS_DATAMES_NPI_PP.Responsable"], f["HECHOS_DATAMES_NPI_PP.Tipo de Paro(PP/NPI)"]]
            if [x.strip() for x in b] == [str(x).strip() for x in got]:
                c.ok += 1
            else:
                # empates en el orden (misma Hrs) pueden reordenar filas: se acepta si la fila existe en las decodificadas
                malas += 1
                esta = any([str(x).strip() for x in [
                    g["DIM_EQUIPOS.IDEQUIPO"], g["HECHOS_DATAMES_NPI_PP.DesEquipo"], g["Sum(HECHOS_DATAMES_NPI_PP.Aviso)"],
                    g["HECHOS_DATAMES_NPI_PP.Desc de Paro"], fecha_txt(g["HECHOS_DATAMES_NPI_PP._F/H Inicio"]),
                    fecha_txt(g["HECHOS_DATAMES_NPI_PP._F/H Fin"]), fmt_num(g["Metricas (2).Hrs Paro Ventana"], 2),
                    g["HECHOS_DATAMES_NPI_PP.Responsable"], g["HECHOS_DATAMES_NPI_PP.Tipo de Paro(PP/NPI)"]]] ==
                    [x.strip() for x in b] for g in filas)
                if esta:
                    print("  fila %d fuera de orden pero presente (empate de ordenamiento): %s" % (i + 1, b[2]))
                    c.ok += 1
                else:
                    c.mal += 1
                    print("  DIFERENCIA fila %d: texto=%r decodificado=%r" % (i + 1, b, got))
        print("  filas en el mismo orden: %d de %d" % (len(bl) - malas, len(bl)))


def main(argv):
    if len(argv) != 3:
        sys.stderr.write(__doc__)
        return 2
    c = Cuenta()
    resumen(argv[1], argv[2], c)
    graficos(argv[1], argv[2], c)
    paros(argv[1], argv[2], c)
    print("\nTOTAL comparaciones: %d correctas, %d con diferencia" % (c.ok, c.mal))
    return 1 if c.mal else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
