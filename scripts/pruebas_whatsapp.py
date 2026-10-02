#!/usr/bin/env python3
"""Prueba del importador con un chat y un listado de docentes FICTICIOS (no hay datos reales)."""
import csv, os, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
import importar_whatsapp as w

tmp = tempfile.mkdtemp()
doc = os.path.join(tmp, "docentes.csv")
with open(doc, "w", newline="", encoding="utf-8-sig") as f:
    cw = csv.writer(f); cw.writerow(["apellidos", "nombres", "nombre_completo"])
    for a, n in [("Rojas Mendoza", "Clara Inés"), ("Vega Torres", "Luis Fernando"), ("Castaño Díaz", "Ana María"), ("Díaz Pérez", "María Elena"),
                 ("Mosquera Cuero", "Yadira"), ("Cuero Bonilla", "Hernán"), ("Obando", "Zoila")]:
        cw.writerow([a, n, f"{a} {n}"])
android = """12/10/26, 6:41 a. m. - Francisco Cortés: Buenos días. La profe Clara Rojas informa que amaneció enferma y hoy no viene.
12/10/26, 6:55 a. m. - Francisco Cortés: Luis Fernando Vega presentó incapacidad médica por 3 días
12/10/26, 7:02 a. m. - Rector: Ok, gracias
12/10/26, 7:15 a. m. - Francisco Cortés: Zoila Obando llega tarde, se le varó la lancha
Esta línea continúa el mensaje anterior sobre el transporte
12/10/26, 8:10 a. m. - Coordinador 2: La profe Ana María Castaño tiene calamidad, falleció su papá
12/10/26, 8:12 a. m. - Coordinador 2: <Multimedia omitido>
12/10/26, 9:30 a. m. - Francisco Cortés: Yadira Mosquera sale temprano por cita médica
12/10/26, 9:40 a. m. - Francisco Cortés: Hernán Cuero y Yadira Mosquera están en capacitación de la SED
12/10/26, 10:00 a. m. - Francisco Cortés: Recuerden la reunión de área del viernes
11/10/26, 7:00 a. m. - Francisco Cortés: Clara Rojas no vino ayer por permiso del rector
12/10/26, 11:20 a. m. - Francisco Cortés: Se informa que Díaz no asistió porque llevó a su hijo al médico
"""
ios = """[12/10/26, 6:41:05 a. m.] Francisco Cortés: Zoila Obando no asistió, mal estado de salud
[12/10/26, 1:05:00 p. m.] Rector: Gracias directivos
"""
r = {}
for nombre, txt in (("android.txt", android), ("ios.txt", ios)):
    p = os.path.join(tmp, nombre); open(p, "w", encoding="utf-8").write(txt)
    filas = w.main([p, "--fecha", "2026-10-12", "--docentes", doc, "--salida", tmp])
    r[nombre] = filas
fallos = []
def ok(c, m):
    print(("  ok   " if c else "  FALLA ") + m)
    if not c: fallos.append(m)
a = {(x["docente"], x["tipo_novedad"]): x for x in r["android.txt"]}
f_ana = lambda x: x["docente"] == "Castaño Díaz Ana María"
ok(len(r["android.txt"]) == 9, f"9 propuestas del día (hay {len(r['android.txt'])})")
x = a[("Rojas Mendoza Clara Inés", "No asistió")]; ok(x["motivo"] == "Mal estado de salud" and x["confianza"] == "alta", "Clara Rojas: no asistió por mal estado de salud (confianza alta)")
x = a[("Vega Torres Luis Fernando", "No asistió")]; ok(x["motivo"] == "Incapacidad Médica", "Luis Vega: incapacidad médica")
x = a[("Obando Zoila", "Llegada tarde informada")]; ok(x["motivo"] == "Situación fortuita camino al trabajo", "Zoila Obando: llegada tarde por lancha (situación fortuita), mensaje de varias líneas unido")
x = next(f for f in r["android.txt"] if "calamidad" in f["mensaje"]); ok(f_ana(x) and x["motivo"] == "Calamidad familiar" and x["categoria"] == "CALAMIDAD DOMÉSTICA", "Ana María Castaño: calamidad familiar")
x = a[("Mosquera Cuero Yadira", "Salida temprana informada")]; ok(x["motivo"] == "Exámenes clínicos", "Yadira Mosquera: salida temprana por cita médica")
ok(not any(f["fecha"] != "2026-10-12" for f in r["android.txt"]), "solo el día pedido (ignora el 11/10)")
cap = [x for x in r["android.txt"] if x["motivo"] in ("Capacitación/Taller", "Evento Secretaría de Educación")]; ok(len(cap) == 2 and all(c["confianza"] == "baja" for c in cap), "mensaje que menciona a dos personas: 2 filas con confianza baja")
amb = [x for x in r["android.txt"] if "hijo al médico" in x["mensaje"]]; ok({x["docente"] for x in amb} == {"Castaño Díaz Ana María", "Díaz Pérez María Elena"} and all(x["confianza"] == "baja" and x["motivo"] == "Traslado hijo(a) a colegio/médico" for x in amb), "apellido repetido (Díaz): propone a ambas personas con confianza baja; \"llevó a su hijo al médico\" = traslado de hijo(a)")
ok(not any("reunión de área" in x["mensaje"] for x in r["android.txt"]), "ignora mensajes sin docente ni motivo")
ok(len(r["ios.txt"]) == 1 and r["ios.txt"][0]["docente"] == "Obando Zoila" and r["ios.txt"][0]["motivo"] == "Mal estado de salud", "formato de iPhone ([fecha] remitente: texto) con p. m.")
sin = w.proponer(w.leer_chat(os.path.join(tmp, "android.txt")), *w.cargar_docentes(doc), __import__("datetime").date(2026, 10, 12), __import__("datetime").date(2026, 10, 12))
open(os.path.join(tmp, "x.txt"), "w", encoding="utf-8").write("12/10/26, 7:00 a. m. - Francisco Cortés: Una profe no viene hoy por incapacidad\n")
f2, _ = w.proponer(w.leer_chat(os.path.join(tmp, "x.txt")), *w.cargar_docentes(doc), __import__("datetime").date(2026, 10, 12), __import__("datetime").date(2026, 10, 12))
ok(len(f2) == 1 and f2[0]["docente"] == "" and f2[0]["confianza"] == "sin docente", "motivo sin docente identificable: queda en la bandeja con el docente vacío")
sys.exit(1 if fallos else 0)
