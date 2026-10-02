#!/usr/bin/env python3
"""Construye data/*.csv a partir de los PDF de asignación y el Word de docentes."""
import csv
import glob
import os
import re
import sys
import unicodedata
import zipfile

sys.path.insert(0, os.path.dirname(__file__))
from extraer_horarios import SESIONES, extraer_pagina  # noqa: E402
import pdfplumber  # noqa: E402

FUENTES = os.path.join(os.path.dirname(__file__), "..", "fuentes")
DATA = os.path.join(os.path.dirname(__file__), "..", "data")


def norm(s):
    s = unicodedata.normalize("NFD", s.upper())
    return re.sub(r"[^A-Z ]", "", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


def docentes_docx(path):
    z = zipfile.ZipFile(path)
    x = z.read("word/document.xml").decode()
    filas = re.findall(r"<w:tr[ >].*?</w:tr>", x, flags=re.S)
    res = []
    for f in filas:
        cel = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<w:tc>.*?</w:tc>", f, flags=re.S)]
        if len(cel) >= 3 and re.fullmatch(r"\d+", cel[0]):
            res.append({"n": int(cel[0]), "apellidos": " ".join(cel[1].split()), "nombres": " ".join(cel[2].split())})
    return res


def limpiar_titulo(t):
    partes = [p.strip() for p in t.split("|")]
    for p in partes:
        if re.search(r"\d+ ?S(ECCIONES)?\b", p) and "ASIGNACION" not in p:
            return re.sub(r"\s*CICLO/HORA\s*", " ", p).strip()
    return partes[0]


def parse_titulo_docente(t):
    """'ARTE Y CULT-ART DOC-ARBOLEDA AMERICA - 28 SECCIONES' -> (area_texto, nombre_texto)."""
    t = re.sub(r"\s*-\s*\d+\s*S(ECCIONES)?\s*$", "", t)
    m = re.match(r"(.*?[A-Z]{3}(?:-[A-Z]{3})?(?:\s+DOC)?[- ]?(?:D-?\d)?)[\s-]+([A-ZÁÉÍÓÚÑ ]+)$", t)
    return t



# Cruce PDF -> Word (número en la lista oficial). Revisado manualmente.
# "?" = pendiente de confirmar por el coordinador (ver data/VALIDACION.md).
MAPA = {
    "PUCHES ANA": 37, "CUELLAR MARIA": 20, "ARIZALA ROBERTO": 4, "CUERO HERNANDO": 16,
    "LOZANO AMANDA": 26, "QUIÑONES MARCOS": 42,
    "PRADO MARIBEL": 39, "CASTILLO DAIRA": 10, "ORDOÑEZ JAIME": 34, "TERAN JORGE": 57,
    "QUINTERO CARMEN": 41, "CASANOVA YOLI": 8, "VASQUEZ SEGUNDO": 52, "AGUIRRE ANDRES": 1,
    "SAMANIEGO FLOR": 44, "VALVERDE MARIA": 51, "CUERO VERTE LEVI": 15, "CHILLAMBO ROCIO": 12,
    "ORTIZ ADIELA": 35, "CASTILLO MARTHA": 9, "PRECIADO OLEISA": 38, "FERNANDEZ ALFREDO": 19,
    "VALENCIA SAIDY": 49, "MEZA GLADYS": 28, "GONZALEZ JIMMY": 22, "LEMOS MIRIAN": 25,
    "BETANCOURT JOHANA": 6, "ESTACIO ESTUPIÑAN ROSARIO": 18, "BASTIDAS SENEIDA": 5, "MINDINEROS JOHN": 29,
    "ARBOLEDA AMERICA": 3, "ANCHICO HECTOR": 30, "RAMIREZ JIMMY": 43, "VILLOTA HECTOR": 53,
    "PULGARIN CESAR": 40, "MONTAÑO LEIDY": 31, "VILLOTA RUBIO JANETH": 54, "ANGULO ANDRES": 2,
}
# Cambios confirmados por el coordinador (el PDF de asignación del 02-02-2026 aún trae el horario original):
#  - El rector intercambió el horario de Arte de Docente 1 (antes Puches Ana Milena, #39) con el de Docente 2 (antes Prado Maribel, #37):
#    hoy Prado (#37) atiende lo que era de Puches y Puches (#39) lo que era de Prado.
#  - Armero Dájome Jesús (#57, OPS) reemplaza a Terán Guevara Jorge Alberto (#47) y atiende todo su horario.
PENDIENTES = {}
NOTAS_DOCENTE = {
    57: "OPS - reemplaza a Terán Guevara Jorge Alberto: atiende su horario",
    47: "Reemplazado por Armero Dájome Jesús (OPS): su horario lo atiende Armero",
    37: "Reemplazo de la docente Luz María Cortés Tenorio. Desde el cambio del rector atiende el horario que tenía Puches (Docente 1)",
    39: "Desde el cambio del rector atiende el horario que tenía Prado Maribel (Docente 2 de Arte)",
    7: "Docente orientadora: sin grupos, trabaja con todos los niveles",
    36: "Docente orientadora: sin grupos, trabaja con todos los niveles",
    56: "Tutora PTAFI (Todos a Aprender - Formación Integral), transitoria: apoya preescolar y primaria (procesos básicos, centros de interés)",
}
# Personal sin grupo: (n, tipo, código de grupo, entrada, salida, área). Jornada: orientadoras según el coordinador (la primera en nombrarse
# entra 7:30 y sale ~12:30; la segunda entra 8:00 y sale hasta las 16:00). Tutora PTAFI: jornada de primaria (por confirmar).
ESPECIALES = {
    7: ("ORIENTACION", "ORIENT", "07:30", "12:30", "ORIENTACIÓN ESCOLAR"),
    36: ("ORIENTACION", "ORIENT", "08:00", "16:00", "ORIENTACIÓN ESCOLAR"),
    56: ("TUTORIA", "PTAFI", "06:30", "12:00", "TUTORÍA PTAFI"),
}
NIVEL_ESPECIAL = {7: "ORIENTACIÓN", 36: "ORIENTACIÓN", 56: "TUTORA PTAFI", 47: "REEMPLAZADO"}
CORRECCION_AREA = {"ETI": "ETR", "REL": "ETR"}  # erratas del PDF (DOCENTES-2, Casanova Yoli)


def clave_pdf(titulo):
    t = norm(titulo)
    for k in sorted(MAPA, key=len, reverse=True):
        if norm(k) in t:
            return k
    return None


def grupo_info(g):
    if g == "ORIENT":
        return "TRANSVERSAL", "Todos los niveles", "Orientación escolar (todos los niveles)"
    if g == "PTAFI":
        return "TRANSVERSAL", "Preescolar y primaria", "Tutora PTAFI (preescolar y primaria)"
    if g.startswith("CS1"):
        return "CAMINAR EN SECUNDARIA 1", "6°-7°", f"CS 1-{g[-1]}"
    if g.startswith("CS2"):
        return "CAMINAR EN SECUNDARIA 2", "8°-9°", f"CS 2-{g[-1]}"
    return "REGULAR", str(int(g[:2])) + "°", f"{int(g[:2])}°-{g[2:]}"


def modalidad(g):
    return BASICA_PDF.get(g, ("", 0, "", ""))[3]


AREA_NOMBRE = {"ART": "Arte y Cultura Afro", "CAS": "Castellano", "CNA": "Ciencias Naturales", "CSI": "Sociales e Inglés",
               "ERD": "Educación Física", "ETR": "Ética y Religión", "MAT": "Matemáticas", "TEI": "Tecnología e Informática"}
# Áreas que el rector asigna alternando por semana (confirmado por el coordinador)
ALTERNAN = {"CSI": "Sociales / Inglés (alternan cada semana)", "ETR": "Ética / Religión (alternan cada semana)"}
GRADO_REF = {"D3-8°": ("0801", "0802"), "D5-10°": ("1001", "1002"), "D5-11°": ("1101", "1102")}


def enfasis_por_grupo():
    """{grupo: {(dia, hora)}} leído de los PDF por grupo (EST-AREAS)."""
    res = {}
    for pdf in sorted(glob.glob(os.path.join(FUENTES, "*EST-AREAS*.pdf"))):
        with pdfplumber.open(pdf) as d:
            for p in d.pages:
                for f in extraer_pagina(p):
                    m = re.search(r"(CS\d{3}|\d{4})\s*-", f["titulo"])
                    if m and f["celda"].startswith("ENFASIS"):
                        res.setdefault(m.group(1), set()).add((f["dia"], f["hora"]))
    return res


def main():
    docs = docentes_docx(glob.glob(os.path.join(FUENTES, "*ASISTENCIA*.docx"))[0])
    por_n = {d["n"]: d for d in docs}
    filas = []
    for pdf in sorted(glob.glob(os.path.join(FUENTES, "*ASIG_ACAD_DOC-*.pdf"))):
        with pdfplumber.open(pdf) as d:
            for p in d.pages:
                for f in extraer_pagina(p):
                    f["titulo"] = limpiar_titulo(f["titulo"])
                    k = clave_pdf(f["titulo"])
                    if not k:
                        sys.exit("Sin mapa: " + f["titulo"])
                    f["docente_n"] = MAPA[k]
                    filas.append(f)
    # --- horario maestro
    h = []
    for f in filas:
        n = f["docente_n"]
        bloque, ses, ini, fin = SESIONES[f["hora"]]
        celda = f["celda"].strip()
        if celda.startswith("ENFASIS-"):
            tipo, ref, area = "ENFASIS", celda[len("ENFASIS-"):], ""
            grupo = ""
        else:
            g, a = celda.split("-")
            tipo, ref, area, grupo = "CLASE", "", CORRECCION_AREA.get(a, a), g
        h.append({"docente_n": n, "docente": f'{por_n[n]["apellidos"]} {por_n[n]["nombres"]}',
                  "dia": f["dia"], "hora": f["hora"], "bloque": bloque, "sesion": ses,
                  "inicio": ini, "fin": fin, "tipo": tipo, "grupo": grupo, "area": area,
                  "enfasis_ref": ref, "celda_original": celda})
    areas_doc = {}
    for r in h:
        if r["area"]:
            areas_doc.setdefault(r["docente_n"], set()).add(r["area"])
    # --- énfasis: grupos atendidos, equipo y alternancia
    eg = enfasis_por_grupo()
    equipo = {}
    for r in h:
        if r["tipo"] == "ENFASIS":
            equipo.setdefault((r["enfasis_ref"], r["dia"], r["hora"]), []).append(r)
    for r in h:
        r["grupos_enfasis"] = r["equipo_enfasis"] = r["alternancia"] = ""
        if r["tipo"] == "ENFASIS":
            ref = r["enfasis_ref"]
            cand = GRADO_REF.get(ref, (ref,))
            r["grupos_enfasis"] = "+".join(g for g in cand if (r["dia"], int(r["hora"])) in eg.get(g, set()))
            otros = [o for o in equipo[(ref, r["dia"], r["hora"])] if o["docente_n"] != r["docente_n"]]
            r["equipo_enfasis"] = "; ".join(f'{o["docente"]} ({"/".join(sorted(areas_doc.get(o["docente_n"], [])))})' for o in otros)
            r["area"] = "/".join(sorted(areas_doc.get(r["docente_n"], [])))  # área del docente en el énfasis
            r["alternancia"] = ("PAREJA: comparten el énfasis y alternan por semana" if len(otros) == 1
                                else f"EQUIPO DE {len(otros) + 1}: cada docente atiende un grupo de estudiantes en su área")
        elif r["area"] in ALTERNAN:
            r["alternancia"] = ALTERNAN[r["area"]]
    h.sort(key=lambda r: (r["docente_n"], ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"].index(r["dia"]), r["hora"]))
    return docs, h


# Docentes de preescolar y primaria: grupo según el PDF "DIRECCIÓN DE GRUPO ICET 2026" (publicación 3-mar-2026).
from direccion_grupo import BASICA_PDF, BACHILLERATO_PDF  # noqa: E402
BASICA = {v[1]: (v[2], g) for g, v in BASICA_PDF.items()}  # n_docente: (nivel, grupo)
JORNADA_SESIONES = {"PRIMARIA": range(1, 7), "PREESCOLAR": range(2, 7)}  # primaria 6:30-12:00; preescolar 7:30-11:30
DIAS_SEM = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]

MOTIVOS = [  # (categoria, motivo, justificada, soporte)
    ("SIN JUSTIFICACIÓN", "Sin justificación", "NO", ""),
    ("SALUD", "Mal estado de salud", "SI", "Verbal / incapacidad posterior"),
    ("SALUD", "Incapacidad Médica", "SI", "Copia incapacidad/licencia"),
    ("SALUD", "Exámenes clínicos", "SI", "Constancia de cita"),
    ("PERMISO INSTITUCIONAL", "Permiso del rector", "SI", "Formato Permiso Docente"),
    ("EVENTO EXTERNO", "Capacitación/Taller", "SI", "Citación"),
    ("EVENTO EXTERNO", "Evento Secretaría de Educación", "SI", "Citación / oficio de la SED"),
    ("ACADÉMICO DEL DOCENTE", "Tema académico del docente", "SI", "Constancia (estudios, posgrado)"),
    ("CALAMIDAD DOMÉSTICA", "Calamidad familiar", "SI", "Verbal / soporte posterior"),
    ("CALAMIDAD DOMÉSTICA", "Salud de hijo(a) o familiar", "SI", "Constancia médica"),
    ("CALAMIDAD DOMÉSTICA", "Traslado hijo(a) a colegio/médico", "SI", "Verbal"),
    ("CALAMIDAD DOMÉSTICA", "Tema académico de hijo(a)", "SI", "Citación del colegio"),
    ("TRASLADO", "Remisión otra ciudad", "SI", "Formato Permiso Docente"),
    ("FORTUITO", "Situación fortuita camino al trabajo", "SI", "Verbal"),
    ("OTRO", "Otro", "SI", "Describir en observaciones"),
]
TIPOS = ["Presente", "No asistió", "Llegada tarde", "Llegada tarde informada", "Salida temprana", "Salida temprana informada"]
FUENTES_NOVEDAD = ["Coordinador(a)", "Docente ausente", "Estudiantes", "Otro docente", "Rector"]
MEDIOS = ["Inspección ocular/Ronda supervisión", "Reporte/Conversación con estudiantes", "Llamada celular", "WhatsApp directo",
          "WhatsApp grupal", "Formato Permiso Docente", "Verbal", "Copia incapacidad/licencia"]


def escribir(nombre, filas, cols):
    with open(os.path.join(DATA, nombre), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)


if __name__ == "__main__":
    docs, h = main()
    os.makedirs(DATA, exist_ok=True)
    sec = {r["docente_n"] for r in h if r["tipo"] in ("CLASE", "ENFASIS")}
    areas = {}
    for r in h:
        if r["area"]:
            areas.setdefault(r["docente_n"], set()).add(r["area"])
    # filas de áreas múltiples (primaria/preescolar)
    from extraer_horarios import SESIONES as _S
    nombre_doc = {d["n"]: f'{d["apellidos"]} {d["nombres"]}' for d in docs}
    for n, (nivel, g) in BASICA.items():
        for dia in DIAS_SEM:
            for hora in JORNADA_SESIONES[nivel]:
                b, ses, ini, fin = _S[hora]
                h.append({"docente_n": n, "docente": nombre_doc[n], "dia": dia, "hora": hora, "bloque": b, "sesion": ses,
                          "inicio": ini, "fin": fin, "tipo": "AREAS_MULTIPLES", "grupo": g, "area": "ÁREAS MÚLTIPLES",
                          "enfasis_ref": "", "grupos_enfasis": "", "equipo_enfasis": "",
                          "alternancia": "Maestro de aula: todas las áreas con su grupo", "celda_original": ""})
    for n, (tipo, g, ent, sal, area) in ESPECIALES.items():
        for dia in DIAS_SEM:
            for hora, (b, ses, ini, fin) in _S.items():
                if ini < sal and fin > ent:  # la sesión se traslapa con su jornada
                    h.append({"docente_n": n, "docente": nombre_doc[n], "dia": dia, "hora": hora, "bloque": b, "sesion": ses,
                              "inicio": ini, "fin": fin, "tipo": tipo, "grupo": g, "area": area, "enfasis_ref": "",
                              "grupos_enfasis": "", "equipo_enfasis": "", "celda_original": "",
                              "alternancia": f"Jornada {ent} a {sal}"})
    h.sort(key=lambda r: (["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"].index(r["dia"]), int(r["hora"]),
                          r["grupo"] or "~" + r["grupos_enfasis"], r["docente_n"]))
    con_horario = {r["docente_n"] for r in h}
    DIR_DE = {}
    for g, v in BASICA_PDF.items():
        DIR_DE.setdefault(v[1], []).append(g)
    DIR_BACH = set()
    for g, par in BACHILLERATO_PDF.items():
        for _, n in par:
            DIR_DE.setdefault(n, []).append(g); DIR_BACH.add(n)
    dres = []
    for d in docs:
        dres.append({"codigo": f'D{d["n"]:03d}', "n": d["n"], "apellidos": d["apellidos"], "nombres": d["nombres"],
                     "nombre_completo": f'{d["apellidos"]} {d["nombres"]}',
                     "nivel": (NIVEL_ESPECIAL.get(d["n"]) or BASICA[d["n"]][0]) if (d["n"] in NIVEL_ESPECIAL or d["n"] in BASICA) else ("SECUNDARIA" if d["n"] in sec or d["n"] in DIR_BACH else "POR DEFINIR"),
                     "grupo_titular": BASICA[d["n"]][1] if d["n"] in BASICA else "",
                     "direccion_grupo": "; ".join(grupo_info(g)[2] for g in sorted(DIR_DE.get(d["n"], []))),
                     "nota": NOTAS_DOCENTE.get(d["n"]) or ("Grupo según DIRECCIÓN DE GRUPO 2026" if d["n"] in BASICA else ""),
                     "areas": "/".join(sorted(areas.get(d["n"], []))), "correo": "", "tiene_horario": "SI" if d["n"] in con_horario else "NO"})
    escribir("docentes.csv", dres, ["codigo", "n", "apellidos", "nombres", "nombre_completo", "nivel", "grupo_titular", "direccion_grupo", "areas", "correo", "tiene_horario", "nota"])
    cols = ["docente_n", "docente", "dia", "hora", "bloque", "sesion", "inicio", "fin", "tipo", "grupo", "area", "enfasis_ref", "grupos_enfasis", "equipo_enfasis", "alternancia", "celda_original"]
    escribir("horario_maestro.csv", h, cols)
    gs = sorted({r["grupo"] for r in h if r["grupo"]})
    escribir("grupos.csv", [dict(zip(["grupo", "tipo", "grado", "nombre"], (g,) + grupo_info(g)), modalidad=modalidad(g)) for g in gs],
             ["grupo", "tipo", "grado", "nombre", "modalidad"])
    nom = {d["n"]: f'{d["apellidos"]} {d["nombres"]}' for d in docs}
    filas_dir = []
    for g in sorted(set(BASICA_PDF) | set(BACHILLERATO_PDF), key=lambda x: (x.startswith("CS"), x)):
        if g in BASICA_PDF:
            ds = [BASICA_PDF[g][1]]
        else:
            ds = [n for _, n in BACHILLERATO_PDF[g]]
        filas_dir.append({"grupo": g, "nombre": grupo_info(g)[2], "tipo_direccion": "DUAL (ambos responsables)" if len(ds) == 2 else "UN DINAMIZADOR(A)",
                          "docente_1_n": ds[0], "docente_1": nom[ds[0]], "docente_2_n": ds[1] if len(ds) > 1 else "",
                          "docente_2": nom[ds[1]] if len(ds) > 1 else "", "modalidad": modalidad(g)})
    escribir("direccion_grupo.csv", filas_dir, ["grupo", "nombre", "tipo_direccion", "docente_1_n", "docente_1", "docente_2_n", "docente_2", "modalidad"])
    escribir("motivos.csv", [{"categoria": c, "motivo": m, "justificada": j, "soporte_sugerido": so} for c, m, j, so in MOTIVOS],
             ["categoria", "motivo", "justificada", "soporte_sugerido"])
    escribir("listas.csv", [{"lista": l, "valor": v} for l, vs in (("tipo_novedad", TIPOS), ("fuente", FUENTES_NOVEDAD), ("medio", MEDIOS)) for v in vs],
             ["lista", "valor"])
    mins = lambda t: int(t[:2]) * 60 + int(t[3:])
    fr = [{"hora": k, "bloque": v[0], "sesion": v[1], "inicio": v[2], "fin": v[3], "inicio_min": mins(v[2]), "fin_min": mins(v[3])} for k, v in SESIONES.items()]
    escribir("franjas.csv", fr, ["hora", "bloque", "sesion", "inicio", "fin", "inicio_min", "fin_min"])
    print(len(dres), "docentes;", len(h), "filas de horario;", len(gs), "grupos")
