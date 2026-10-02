#!/usr/bin/env python3
"""Valida horario_maestro.csv: choques y cruce con los PDF por grupo (EST-AREAS)."""
import csv, glob, os, re, sys, collections
sys.path.insert(0, os.path.dirname(__file__))
from extraer_horarios import extraer_pagina
import pdfplumber
from construir_datos import FUENTES, DATA, CORRECCION_AREA

H = list(csv.DictReader(open(os.path.join(DATA, "horario_maestro.csv"), encoding="utf-8-sig")))
out = []

# 1) Choques: un docente en dos sitios; un grupo con dos docentes de clase
dd = collections.defaultdict(set)
gg = collections.defaultdict(set)
for r in H:
    dd[(r["docente_n"], r["dia"], r["hora"])].add(r["celda_original"])
    if r["tipo"] == "CLASE":
        gg[(r["grupo"], r["dia"], r["hora"])].add((r["docente"], r["area"]))
c1 = [(k, v) for k, v in dd.items() if len(v) > 1]
c2 = [(k, v) for k, v in gg.items() if len(v) > 1]
out.append(f"Choques de docente (mismo docente, dos celdas a la vez): {len(c1)}")
out += [f"  - {k}: {sorted(v)}" for k, v in c1]
out.append(f"Choques de grupo (dos docentes con el mismo grupo a la vez): {len(c2)}")
out += [f"  - {k}: {sorted(v)}" for k, v in c2]

# 2) Cruce con PDF por grupo
mapa = {}  # (grupo,dia,hora) -> area (de los PDF por docente)
for (g, d, h), v in gg.items():
    mapa[(g, d, h)] = {a for _, a in v}
dif, tot, enf_g = [], 0, 0
for pdf in sorted(glob.glob(os.path.join(FUENTES, "*EST-AREAS*.pdf"))):
    with pdfplumber.open(pdf) as doc:
        for p in doc.pages:
            for f in extraer_pagina(p):
                m = re.search(r"(CS\d{3}|\d{4})\s*-", f["titulo"])
                if not m:
                    continue
                g = m.group(1)
                cel = f["celda"].strip()
                if cel.startswith("ENFASIS"):
                    enf_g += 1
                    continue
                area = cel.split("-")[0]
                area = CORRECCION_AREA.get(area, area)
                tot += 1
                esp = mapa.get((g, f["dia"], str(f["hora"])), set())
                if area not in esp:
                    dif.append((g, f["dia"], f["hora"], area, sorted(esp)))
out.append(f"Cruce PDF-por-grupo vs PDF-por-docente: {tot} celdas de clase comparadas, {len(dif)} diferencias; {enf_g} celdas de énfasis omitidas")
out += [f"  - grupo {g} {d} {h}H: PDF-grupo dice {a}, PDF-docente dice {e}" for g, d, h, a, e in dif[:40]]
print("\n".join(out))
