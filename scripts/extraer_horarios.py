#!/usr/bin/env python3
"""Extrae las cuadrículas de horario (PDF ICET-2026) a filas planas.

Cada página contiene varias cuadrículas (2 columnas x N filas). Una cuadrícula
se reconoce por su encabezado LUNES..VIERNES y las filas 1H..8H. Se usan las
coordenadas de las palabras para no perder las celdas vacías.
"""
import re
import sys
import pdfplumber

DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]
SESIONES = {  # hora de la fila -> (bloque, sesión, inicio, fin)
    1: (1, 1, "06:30", "07:15"), 2: (1, 2, "07:15", "08:00"),
    3: (2, 1, "08:20", "09:05"), 4: (2, 2, "09:05", "09:50"),
    5: (3, 1, "10:10", "10:55"), 6: (3, 2, "10:55", "11:40"),
    7: (4, 1, "12:00", "12:45"), 8: (4, 2, "12:45", "13:30"),
}


def agrupar_lineas(words, tol=3):
    """Agrupa palabras en líneas por coordenada vertical."""
    lineas = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        for ln in lineas:
            if abs(ln["top"] - w["top"]) <= tol:
                ln["w"].append(w)
                break
        else:
            lineas.append({"top": w["top"], "w": [w]})
    for ln in lineas:
        ln["w"].sort(key=lambda w: w["x0"])
    return lineas


def extraer_pagina(page):
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
    # encabezados de día: cada grupo de 5 palabras LUNES..VIERNES = una cuadrícula
    cab = [w for w in words if w["text"] in DIAS]
    cab.sort(key=lambda w: (round(w["top"]), w["x0"]))
    grids = []
    i = 0
    while i < len(cab):
        grupo = [cab[i]]
        j = i + 1
        while j < len(cab) and abs(cab[j]["top"] - cab[i]["top"]) < 3 and len(grupo) < 5:
            grupo.append(cab[j]); j += 1
        i = j
    # reconstruir por fila (top) y bloque horizontal
    por_fila = {}
    for w in cab:
        por_fila.setdefault(round(w["top"]), []).append(w)
    for top, ws in sorted(por_fila.items()):
        ws.sort(key=lambda w: w["x0"])
        for k in range(0, len(ws), 5):
            g = ws[k:k + 5]
            if len(g) == 5:
                grids.append({"top": top, "dias": g})
    out = []
    for g in grids:
        centros = [(w["x0"] + w["x1"]) / 2 for w in g["dias"]]
        x_ini = g["dias"][0]["x0"]
        # etiqueta de fila (1H..8H) a la izquierda de LUNES
        etiquetas = [w for w in words if re.fullmatch(r"[1-8]H", w["text"])
                     and w["top"] > g["top"] and x_ini - 75 < w["x0"] < x_ini - 5]
        etiquetas.sort(key=lambda w: w["top"])
        if len(etiquetas) < 8:
            continue
        etiquetas = etiquetas[:8]
        # título: palabras sobre el encabezado, dentro del bloque horizontal
        x_fin = g["dias"][-1]["x1"] + 5
        titulo_ws = [w for w in words if g["top"] - 40 < w["top"] < g["top"] - 3
                     and x_ini - 80 < w["x0"] < x_fin]
        titulo = " ".join(w["text"] for w in sorted(titulo_ws, key=lambda w: (round(w["top"]), w["x0"]))
                          if "ASIGNACION" not in w["text"])
        titulo_lineas = agrupar_lineas(titulo_ws)
        textos = [" ".join(w["text"] for w in ln["w"]) for ln in titulo_lineas]
        titulo = " | ".join(t for t in textos if "ASIGNACION" not in t and t.strip())
        titulo = titulo or " | ".join(textos)
        celdas = {}
        for n, et in enumerate(etiquetas, start=1):
            y0 = et["top"] - 3
            y1 = (etiquetas[n]["top"] - 3) if n < 8 else et["bottom"] + 6
            for w in words:
                if (y0 <= w["top"] < y1 and w["x0"] > etiquetas[0]["x1"] and w["x0"] < x_fin + 12
                        and not re.fullmatch(r"[1-8]H|\d{4}-\d{4}", w["text"])):
                    c = (w["x0"] + w["x1"]) / 2
                    d = min(range(5), key=lambda d: abs(centros[d] - c))
                    celdas.setdefault((n, d), []).append(w["text"])
        for (n, d), toks in sorted(celdas.items()):
            out.append({"titulo": titulo, "hora": n, "dia": DIAS[d], "celda": " ".join(toks)})
    return out


def main(pdf):
    with pdfplumber.open(pdf) as doc:
        filas = []
        for p in doc.pages:
            filas += extraer_pagina(p)
    return filas


if __name__ == "__main__":
    for f in main(sys.argv[1]):
        print(f)
