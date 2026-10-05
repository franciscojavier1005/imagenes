#!/usr/bin/env python3
"""Datos DE EJEMPLO (docentes ficticios) para probar y mostrar el tablero. No son registros reales.

Cada docente real del horario se reemplaza por un nombre ficticio ("Docente demo SEC 07"), conservando su horario y su nivel,
de modo que las novedades de ejemplo sean coherentes con el horario. Salidas en ejemplos/:
  demo_ctx.json       entrada de calcularResumen_
  demo_esperado.json  resultado calculado aparte, en Python (sin usar el código del tablero)
"""
import csv, datetime as dt, json, os, random
from collections import defaultdict

RAIZ = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(RAIZ, "data")
rd = lambda n: list(csv.DictReader(open(os.path.join(D, n), encoding="utf-8-sig")))
random.seed(2026)

HASTA = "2026-10-02"  # viernes
fin = dt.date.fromisoformat(HASTA)
dias = []
d = fin
while len(dias) < 10:
    if d.weekday() < 5:
        dias.insert(0, d)
    d -= dt.timedelta(days=1)
DIA = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]

H = rd("horario_maestro.csv")
reales = rd("docentes.csv")
motivos = rd("motivos.csv")
mot = {m["motivo"]: m for m in motivos}
directivos = ["Francisco Javier Cortés", "Carmen Verónica Barreiro Caicedo", "Harold Wilson Angulo Merchancano"]

# ---- anonimización: n real -> nombre ficticio y nivel
cont = defaultdict(int)
etiqueta, nivel_de_n = {}, {}
for r in reales:
    niv = r["nivel"]
    cont[niv] += 1
    etiqueta[int(r["n"])] = f"Docente demo {niv[:3]} {cont[niv]:02d}"
    nivel_de_n[int(r["n"])] = niv
docentes = [{"nombre_completo": etiqueta[n], "nivel": nivel_de_n[n]} for n in etiqueta]
nivel_de = {etiqueta[n]: nivel_de_n[n] for n in etiqueta}


def partes(g):
    if g == "ORIENT":
        return "ORI", "0"
    if g == "PTAFI":
        return "PTA", "0"
    if g.startswith("CS"):
        return g[:3], g[4:]
    if g[:2].isdigit() and g[2:].isdigit():
        return g[:2], str(int(g[2:]))
    return "N/A", "N/A"


# horario del contexto: solo día, sesión, docente ficticio y nivel (sin nombres reales)
horario = [{"dia": r["dia"], "hora": int(r["hora"]), "docente": etiqueta[int(r["docente_n"])], "nivel": nivel_de_n[int(r["docente_n"])]} for r in H]
clase = [r for r in H if r["tipo"] in ("CLASE", "AREAS_MULTIPLES", "ORIENTACION", "TUTORIA") and r["grupo"]]

novedades = []
for f in dias:
    cand = [r for r in clase if r["dia"] == DIA[f.weekday()]]
    for _ in range(random.randint(4, 9)):
        r = random.choice(cand)
        nombre = etiqueta[int(r["docente_n"])]
        tipo = random.choices(["No asistió", "Llegada tarde", "Salida temprana"], [60, 25, 15])[0]
        m = random.choice(motivos)
        minutos = random.choice([45, 90, 135, 180, 270, ""]) if tipo == "No asistió" else random.choice([10, 15, 20, 30])
        g, gr = partes(r["grupo"])
        novedades.append({"fecha": f.isoformat(), "docente": nombre, "tipo": tipo, "motivo": m["motivo"], "justificada": "Sí" if m["justificada"] == "SI" else "No",
                          "categoria": m["categoria"], "grado": g, "grupo": gr, "area": r["area"], "minutos": minutos, "directivo": random.choice(directivos)})
# un registro heredado con grado/grupo mal escritos (como en el formulario actual), sin categoría ni justificación
novedades.append({"fecha": HASTA, "docente": etiqueta[int(next(r for r in reales if r["nivel"] == "SECUNDARIA")["n"])], "tipo": "No asistió",
                  "motivo": "Calamidad familiar", "justificada": "", "categoria": "", "grado": "VIE", "grupo": "VIE", "area": "CAS", "minutos": 270,
                  "directivo": "Francisco Cortés"})

esperados_dia = defaultdict(int)
for r in H:
    if r["dia"] == "VIERNES":
        esperados_dia[int(r["hora"])] += 1
registro = []
for s in range(1, 6):  # ronda hecha hasta la sesión 5 del último día
    marcados = int(esperados_dia[s] * random.uniform(0.7, 1.0))
    nombres = [etiqueta[int(r["docente_n"])] for r in H if r["dia"] == "VIERNES" and int(r["hora"]) == s]
    for nm in nombres[:marcados]:
        registro.append({"fecha": HASTA, "sesion": s, "docente": nm, "estado": "Presente"})

ctx = {"desde": dias[0].isoformat(), "hasta": HASTA, "novedades": novedades, "registro": registro, "horario": horario, "docentes": docentes,
       "motivos": [{"motivo": m["motivo"], "categoria": m["categoria"], "justificada": m["justificada"]} for m in motivos]}


# ---- cálculo esperado, hecho aparte (sin usar el código del tablero)
def minutos_de(n):
    return n["minutos"] if isinstance(n["minutos"], int) else (45 if n["tipo"] == "No asistió" else 0)
def justificada(n):
    return (n["justificada"] == "Sí") if n["justificada"] else mot[n["motivo"]]["justificada"] == "SI"
def categoria(n):
    return n["categoria"] or mot[n["motivo"]]["categoria"]

def resumen(nov, hz, dias_):
    tot = sum(minutos_de(n) for n in nov)
    prog = sum(sum(1 for h in hz if h["dia"] == DIA[f.weekday()]) for f in dias_)
    return {"minutos": tot, "eventos": len(nov), "programadas": prog,
            "ausencias": len({(n["docente"], n["fecha"]) for n in nov if n["tipo"] == "No asistió"}),
            "docentesConNovedad": len({n["docente"] for n in nov}),
            "llegadasTarde": sum(1 for n in nov if n["tipo"] == "Llegada tarde"),
            "salidasTempranas": sum(1 for n in nov if n["tipo"] == "Salida temprana"),
            "cumplimiento": round((1 - tot / (prog * 45)) * 100, 1) if prog else None,
            "pctJustificadas": round(sum(1 for n in nov if justificada(n)) / len(nov) * 100, 1) if nov else None}

esperado = resumen(novedades, horario, dias)
cat = defaultdict(int)
for n in novedades:
    cat[categoria(n)] += minutos_de(n)
nivel_just = defaultdict(lambda: [0, 0])
for n in novedades:
    nivel_just[nivel_de[n["docente"]]][0 if justificada(n) else 1] += minutos_de(n)
esperado.update({
    "porCategoria": dict(cat),
    "porNivel": {k: {"justificada": v[0], "sinJustificar": v[1]} for k, v in nivel_just.items()},
    "tendencia": {f.isoformat(): sum(minutos_de(n) for n in novedades if n["fecha"] == f.isoformat()) for f in dias},
    "ronda": {str(s): [esperados_dia[s], len([r for r in registro if r["sesion"] == s])] for s in range(1, 9)},
    "grupoSinGrupo": sum(minutos_de(n) for n in novedades if n["grado"] == "VIE"),
})
# filtros: por nivel y por el docente con más novedades
esperado["filtroNivel"] = {}
for niv in ("PRIMARIA", "SECUNDARIA", "PREESCOLAR"):
    esperado["filtroNivel"][niv] = resumen([n for n in novedades if nivel_de[n["docente"]] == niv], [h for h in horario if h["nivel"] == niv], dias)
cuenta = defaultdict(int)
for n in novedades:
    cuenta[n["docente"]] += 1
doc = max(cuenta, key=lambda k: (cuenta[k], k))
esperado["docenteFiltro"] = doc
esperado["filtroDocente"] = resumen([n for n in novedades if n["docente"] == doc], [h for h in horario if h["docente"] == doc], dias)
esperado["filtroDocente"]["lista"] = sum(1 for n in novedades if n["docente"] == doc)

json.dump(ctx, open(os.path.join(RAIZ, "ejemplos", "demo_ctx.json"), "w", encoding="utf-8"), ensure_ascii=False)
json.dump(esperado, open(os.path.join(RAIZ, "ejemplos", "demo_esperado.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("novedades demo:", len(novedades), "| minutos:", esperado["minutos"], "| programadas:", esperado["programadas"], "| docente con más novedades:", doc, cuenta[doc])
