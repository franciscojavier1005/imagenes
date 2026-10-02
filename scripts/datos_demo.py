#!/usr/bin/env python3
"""Datos DE EJEMPLO (docentes ficticios) para probar y mostrar el tablero. No son registros reales.

Salidas en ejemplos/: demo_ctx.json (entrada de calcularResumen_) y demo_esperado.json (resultado calculado aparte, en Python).
"""
import csv, json, os, random
from collections import defaultdict

RAIZ = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(RAIZ, "data")
rd = lambda n: list(csv.DictReader(open(os.path.join(D, n), encoding="utf-8-sig")))
random.seed(2026)

HASTA = "2026-10-02"  # viernes
import datetime as dt
fin = dt.date.fromisoformat(HASTA)
dias = []
d = fin
while len(dias) < 10:
    if d.weekday() < 5:
        dias.insert(0, d)
    d -= dt.timedelta(days=1)
DIA = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]

H = rd("horario_maestro.csv")
motivos = rd("motivos.csv")
mot = {m["motivo"]: m for m in motivos}
clase = [r for r in H if r["tipo"] in ("CLASE", "AREAS_MULTIPLES")]
directivos = ["Francisco Cortés", "Coordinador 2", "Coordinador 3"]


def nivel_de(g):
    if g[:2] == "00":
        return "PREESCOLAR"
    if g[:2] in ("01", "02", "03", "04", "05"):
        return "PRIMARIA"
    return "SECUNDARIA"


def partes(g):
    return (g[:3], g[4:]) if g.startswith("CS") else (g[:2], str(int(g[2:])))


pool = {"PREESCOLAR": 2, "PRIMARIA": 13, "SECUNDARIA": 38}
demo = lambda niv, i: f"Docente demo {niv[:3]} {i:02d}"
novedades = []
for f in dias:
    cand = [r for r in clase if r["dia"] == DIA[f.weekday()]]
    for _ in range(random.randint(4, 9)):
        r = random.choice(cand)
        niv = nivel_de(r["grupo"])
        nombre = demo(niv, random.randint(1, pool[niv] if niv != "SECUNDARIA" else 12))
        tipo = random.choices(["No asistió", "Llegada tarde", "Salida temprana"], [60, 25, 15])[0]
        m = random.choice(motivos)
        if tipo == "No asistió":
            minutos = random.choice([45, 90, 135, 180, 270, ""])  # "" -> el cálculo asume 45 (una sesión)
        else:
            minutos = random.choice([10, 15, 20, 30])
        g, gr = partes(r["grupo"])
        novedades.append({"fecha": f.isoformat(), "docente": nombre, "tipo": tipo, "motivo": m["motivo"], "justificada": "Sí" if m["justificada"] == "SI" else "No",
                          "categoria": m["categoria"], "grado": g, "grupo": gr, "area": r["area"], "minutos": minutos, "directivo": random.choice(directivos)})
# un registro heredado con grado/grupo mal escritos (como en el formulario actual) y sin categoría ni justificación
novedades.append({"fecha": HASTA, "docente": "Docente demo SEC 03", "tipo": "No asistió", "motivo": "Calamidad familiar", "justificada": "", "categoria": "",
                  "grado": "VIE", "grupo": "VIE", "area": "CAS", "minutos": 270, "directivo": "Francisco Cortés"})

niveles_demo = {}
for n in novedades:
    niveles_demo[n["docente"]] = n["docente"].split()[2].replace("PRE", "PREESCOLAR").replace("PRI", "PRIMARIA").replace("SEC", "SECUNDARIA")
docentes = [{"nombre_completo": k, "nivel": v} for k, v in niveles_demo.items()]
# PRE se reemplaza también en "PREESCOLAR": corregir doble reemplazo
for dd in docentes:
    dd["nivel"] = {"PRE": "PREESCOLAR", "PRI": "PRIMARIA", "SEC": "SECUNDARIA"}[dd["nombre_completo"].split()[2]]

horario = [{"dia": r["dia"], "hora": int(r["hora"])} for r in H]
esperados_dia = defaultdict(int)
for r in H:
    if r["dia"] == "VIERNES":
        esperados_dia[int(r["hora"])] += 1
registro = []
for s in range(1, 6):  # ronda hecha hasta la sesión 5 del último día
    marcados = int(esperados_dia[s] * random.uniform(0.7, 1.0))
    for i in range(marcados):
        registro.append({"fecha": HASTA, "sesion": s, "docente": f"Docente demo {i + 1:02d}", "estado": "Presente"})

ctx = {"desde": dias[0].isoformat(), "hasta": HASTA, "novedades": novedades, "registro": registro, "horario": horario, "docentes": docentes,
       "motivos": [{"motivo": m["motivo"], "categoria": m["categoria"], "justificada": m["justificada"]} for m in motivos]}

# ---- cálculo esperado, hecho aparte (sin usar el código del tablero)
def minutos_de(n):
    if isinstance(n["minutos"], int):
        return n["minutos"]
    return 45 if n["tipo"] == "No asistió" else 0
def justificada(n):
    if n["justificada"]:
        return n["justificada"] == "Sí"
    return mot[n["motivo"]]["justificada"] == "SI"
def categoria(n):
    return n["categoria"] or mot[n["motivo"]]["categoria"]

tot = sum(minutos_de(n) for n in novedades)
prog = sum(sum(1 for h in H if h["dia"] == DIA[f.weekday()]) for f in dias)
cat = defaultdict(int)
for n in novedades:
    cat[categoria(n)] += minutos_de(n)
niv = {d["nombre_completo"]: d["nivel"] for d in docentes}
nivel_just = defaultdict(lambda: [0, 0])
for n in novedades:
    nivel_just[niv[n["docente"]]][0 if justificada(n) else 1] += minutos_de(n)
esperado = {
    "programadas": prog, "minutos": tot, "eventos": len(novedades),
    "ausencias": len({(n["docente"], n["fecha"]) for n in novedades if n["tipo"] == "No asistió"}),
    "docentesConNovedad": len({n["docente"] for n in novedades}),
    "llegadasTarde": sum(1 for n in novedades if n["tipo"] == "Llegada tarde"),
    "salidasTempranas": sum(1 for n in novedades if n["tipo"] == "Salida temprana"),
    "cumplimiento": round((1 - tot / (prog * 45)) * 100, 1),
    "pctJustificadas": round(sum(1 for n in novedades if justificada(n)) / len(novedades) * 100, 1),
    "porCategoria": dict(cat),
    "porNivel": {k: {"justificada": v[0], "sinJustificar": v[1]} for k, v in nivel_just.items()},
    "tendencia": {f.isoformat(): sum(minutos_de(n) for n in novedades if n["fecha"] == f.isoformat()) for f in dias},
    "ronda": {str(s): [esperados_dia[s], len([r for r in registro if r["sesion"] == s])] for s in range(1, 9)},
    "grupoSinGrupo": sum(minutos_de(n) for n in novedades if n["grado"] == "VIE"),
}
json.dump(ctx, open(os.path.join(RAIZ, "ejemplos", "demo_ctx.json"), "w", encoding="utf-8"), ensure_ascii=False)
json.dump(esperado, open(os.path.join(RAIZ, "ejemplos", "demo_esperado.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("novedades demo:", len(novedades), "| minutos:", tot, "| programadas:", prog, "| días:", dias[0], "a", dias[-1])
