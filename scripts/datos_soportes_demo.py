#!/usr/bin/env python3
"""Escenario de prueba para los plazos de soportes, con docentes ficticios, y su resultado esperado calculado aparte.

El cálculo esperado recorre el calendario día por día (distinto método al del código de producción) para poder compararlos.
Salidas: ejemplos/soportes_ctx.json y ejemplos/soportes_esperado.json
"""
import datetime as dt, json, os

RAIZ = os.path.join(os.path.dirname(__file__), "..")
D = dt.date.fromisoformat
HOY, DESDE = D("2026-10-06"), D("2026-09-28")           # martes; las ausencias anteriores al 28/09 no cuentan
motivos = [{"motivo": "Sin justificación", "requiere_soporte": "SI", "plazo_dias": 3}, {"motivo": "Incapacidad Médica", "requiere_soporte": "SI", "plazo_dias": 5},
           {"motivo": "Calamidad familiar", "requiere_soporte": "SI", "plazo_dias": 5}, {"motivo": "Mal estado de salud", "requiere_soporte": "SI", "plazo_dias": 5},
           {"motivo": "Remisión otra ciudad", "requiere_soporte": "SI", "plazo_dias": 5}, {"motivo": "Permiso del rector", "requiere_soporte": "NO", "plazo_dias": 5}]
N = lambda f, d, t, m, mi=45: {"fecha": f, "docente": d, "tipo": t, "motivo": m, "minutos": mi}
nov = [
    N("2026-10-05", "Docente A", "No asistió", "Incapacidad Médica", 270),                                   # 1 pendiente
    N("2026-10-01", "Docente B", "No asistió", "Calamidad familiar"), N("2026-10-02", "Docente B", "No asistió", "Calamidad familiar"),
    N("2026-10-05", "Docente B", "No asistió", "Calamidad familiar"),                                         # 2 racha con fin de semana, soporte entregado
    N("2026-09-30", "Docente C", "No asistió", "Sin justificación"),                                          # 3 vence hoy (plazo 3)
    N("2026-09-28", "Docente D", "No asistió", "Sin justificación", ""),                                      # 4 vencido (minutos en blanco = 45)
    N("2026-10-05", "Docente E", "No asistió", "Permiso del rector"),                                         # 5 no requiere soporte
    N("2026-10-05", "Docente F", "Llegada tarde", "Sin justificación", 15),                                   # 6 no es ausencia
    N("2026-09-25", "Docente G", "No asistió", "Mal estado de salud"),                                        # 7 anterior a la fecha de inicio
    N("2026-10-06", "Docente H", "No asistió", "Mal estado de salud"),                                        # 8 hoy: en curso
    N("2026-09-28", "Docente I", "No asistió", "Remisión otra ciudad"), N("2026-09-29", "Docente I", "No asistió", "Remisión otra ciudad"),
    N("2026-09-30", "Docente I", "No asistió", "Remisión otra ciudad"),                                       # 9 soporte rechazado
    N("2026-10-01", "Docente J", "No asistió", "Sin justificación"), N("2026-10-02", "Docente J", "No asistió", "Incapacidad Médica"),  # 10 racha mixta -> 5 días
    N("2026-09-29", "Docente K", "No asistió", "Incapacidad Médica"),                                         # 11 soporte aceptado
]
sop = [{"clave": "Docente B|2026-10-01", "id": "s1", "estado": "Entregado", "fecha_carga": "2026-10-06T08:00"},
       {"clave": "Docente I|2026-09-28", "id": "s2", "estado": "Rechazado", "fecha_carga": "2026-10-02T10:00"},
       {"clave": "Docente K|2026-09-29", "id": "s3", "estado": "Aceptado", "fecha_carga": "2026-09-30T09:00"},
       {"clave": "Docente K|2026-09-29", "id": "s0", "estado": "Rechazado", "fecha_carga": "2026-09-29T15:00"}]   # el más reciente manda
ctx = {"hoy": HOY.isoformat(), "desde": DESDE.isoformat(), "novedades": nov, "soportes": sop, "motivos": motivos}

# ------------------------------------------------------------------ esperado, recorriendo el calendario
mot = {m["motivo"]: m for m in motivos}
def habiles(a, b):                      # lista de días hábiles en (a, b]
    out, x = [], a
    while x < b:
        x += dt.timedelta(days=1)
        if x.weekday() < 5:
            out.append(x)
    return out
def n_esimo_habil(a, n):                # n-ésimo día hábil posterior a a
    x, c = a, 0
    while c < n:
        x += dt.timedelta(days=1)
        if x.weekday() < 5:
            c += 1
    return x

esperado = {}
docentes = sorted({n["docente"] for n in nov})
for doc in docentes:
    dias = sorted({D(n["fecha"]) for n in nov if n["docente"] == doc and n["tipo"] == "No asistió" and D(n["fecha"]) >= DESDE})
    if not dias:
        continue
    # una racha = días consecutivos en el calendario hábil
    rachas, actual = [], [dias[0]]
    for d in dias[1:]:
        if len(habiles(actual[-1], d)) == 1:
            actual.append(d)
        else:
            rachas.append(actual); actual = [d]
    rachas.append(actual)
    for r in rachas:
        ms = {n["motivo"] for n in nov if n["docente"] == doc and D(n["fecha"]) in r and n["tipo"] == "No asistió"}
        piden = [m for m in ms if mot[m]["requiere_soporte"] == "SI"]
        if not piden:
            continue
        plazo = 3 if ms == {"Sin justificación"} else max(mot[m]["plazo_dias"] for m in piden if m != "Sin justificación")
        reintegro = habiles(r[-1], r[-1] + dt.timedelta(days=5))[0]
        limite = n_esimo_habil(reintegro, plazo)
        clave = f"{doc}|{r[0].isoformat()}"
        ss = sorted([s for s in sop if s["clave"] == clave], key=lambda s: s["fecha_carga"])
        if ss:
            estado = ss[-1]["estado"]
        elif HOY <= r[-1]:
            estado = "En curso"
        else:
            estado = "Pendiente" if HOY <= limite else "Vencido"
        dias_rest = len(habiles(HOY, limite)) if HOY <= limite else -len(habiles(limite, HOY))
        minutos = sum((n["minutos"] if isinstance(n["minutos"], int) else 45) for n in nov
                      if n["docente"] == doc and D(n["fecha"]) in r and n["tipo"] == "No asistió")
        esperado[clave] = {"inicio": r[0].isoformat(), "fin": r[-1].isoformat(), "dias": len(r), "reintegro": reintegro.isoformat(), "limite": limite.isoformat(),
                           "plazoDias": plazo, "estado": estado, "diasRestantes": dias_rest, "minutos": minutos}
json.dump(ctx, open(os.path.join(RAIZ, "ejemplos", "soportes_ctx.json"), "w", encoding="utf-8"), ensure_ascii=False)
json.dump(esperado, open(os.path.join(RAIZ, "ejemplos", "soportes_esperado.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(esperado), "obligaciones esperadas")
for k, v in esperado.items():
    print(f"  {k:24s} {v['estado']:10s} límite {v['limite']} ({v['diasRestantes']:+d} días hábiles)")
