#!/usr/bin/env python3
"""Vectores de prueba entre lenguajes: el importador de WhatsApp (Python) y el analizador de Notas.gs (JavaScript) deben coincidir.

Docentes y frases FICTICIOS. Salida: ejemplos/vectores_notas.json con el resultado de Python para cada frase.
"""
import csv, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
import importar_whatsapp as w

RAIZ = os.path.join(os.path.dirname(__file__), "..")
ROSTER = [("Rojas Mendoza", "Clara Inés"), ("Vega Torres", "Luis Fernando"), ("Castaño Díaz", "Ana María"), ("Díaz Pérez", "María Elena"),
          ("Mosquera Cuero", "Yadira"), ("Cuero Bonilla", "Hernán"), ("Obando", "Zoila"), ("Rojas Ibarra", "Pedro"), ("Quiñones Pérez", "Marcos Vidal"),
          ("Núñez Perlaza", "Elcy")]
FRASES = [
    "La profe Clara Rojas informa que amaneció enferma y hoy no viene",
    "Luis Fernando Vega presentó incapacidad médica por 3 días",
    "Zoila Obando llega tarde, se le varó la lancha",
    "La profe Ana María Castaño tiene calamidad, falleció su papá",
    "Yadira Mosquera sale temprano por cita médica",
    "Hernán Cuero y Yadira Mosquera están en capacitación de la SED",
    "Se informa que Díaz no asistió porque llevó a su hijo al médico",
    "La profe Clara Rojas no estaba en el aula en la tercera hora",
    "Pedro Rojas no se presentó y el grupo estaba solo",
    "Marcos Quiñones no vino por permiso del rector",
    "Elcy Núñez se retiró antes por examen de laboratorio",
    "Obando llegó con retraso por el tráfico",
    "Zoila no vino, tiene fiebre y dolor de cabeza",
    "Mosquera salió antes por incapacidad",
    "Vega no la vi en el salón",
    "Pedro viajó a Cali por una remisión",
    "Hernán tiene maestría y debe asistir a la universidad",
    "Ana María Castaño llevó a su hija al médico",
    "La profe Elena Díaz tiene reunión de padres de su hijo en el colegio",
    "Todo estuvo normal en la ronda",
    "Recuerden la reunión de área del viernes",
    "Rojas no estaba",
    "El grupo estaba sin profesor desde temprano",
    "Clara Rojas está en taller de formación en la Secretaría de Educación",
    "Luis Vega se fue antes por una calamidad familiar",
    "Marcos Vidal Quiñones llegará tarde por un accidente de tránsito",
    "Yadira no estaba y los estudiantes solos en el salón",
    "María Elena Díaz Pérez no se presentó, está incapacitada",
    "La profe Zoila Obando no asistió, mal estado de salud",
    "Pedro Rojas Ibarra salió temprano permiso de rectoría",
]
tmp = tempfile.mkdtemp(); csvp = os.path.join(tmp, "d.csv")
with open(csvp, "w", newline="", encoding="utf-8-sig") as f:
    cw = csv.writer(f); cw.writerow(["apellidos", "nombres", "nombre_completo"])
    for a, n in ROSTER:
        cw.writerow([a, n, f"{a} {n}"])
docentes, cont = w.cargar_docentes(csvp)
esperado = []
for fr in FRASES:
    tipo, motivo, cat = w.clasificar(fr)
    esperado.append({"frase": fr, "tipo": tipo, "motivo": motivo, "categoria": cat,
                     "menciones": sorted([[s, n] for s, n in w.menciones(fr, docentes, cont)], key=lambda x: (-x[0], x[1]))})
roster = [{"apellidos": a, "nombres": n, "nombre_completo": f"{a} {n}"} for a, n in ROSTER]
json.dump({"roster": roster, "casos": esperado}, open(os.path.join(RAIZ, "ejemplos", "vectores_notas.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(esperado), "vectores; con tipo:", sum(1 for e in esperado if e["tipo"]), "| con motivo:", sum(1 for e in esperado if e["motivo"]), "| con menciones:", sum(1 for e in esperado if e["menciones"]))
