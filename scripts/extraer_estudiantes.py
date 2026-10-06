#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrae del PDF «REGISTRO Y CONTROL ESCOLAR ESTUDIANTES (RCEE)» SOLO lo necesario para consultar por grupo: grupo, curso, n.º de lista,
apellidos y nombres. NO toma documentos, correos institucionales, contraseñas ni teléfonos (el PDF los trae; no se copian a ninguna parte).
La salida es un .xlsx con la hoja «Estudiantes» para importar al libro (Archivo > Importar > Insertar hoja nueva). Esa salida contiene
datos de menores: NO se versiona (no la suba al repositorio).

  python3 scripts/extraer_estudiantes.py LISTADO.pdf salida.xlsx

Requiere pdftotext (poppler) y openpyxl. Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
"""
import csv, os, re, subprocess, sys, tempfile
import openpyxl

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRA = {"C301": "Adultos 6°-7° (C301)", "C501": "Adultos 10°-11° (C501)"}


def nombres_de_grupos():
    m = {}
    with open(os.path.join(RAIZ, "data", "grupos.csv"), encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            m[r["grupo"]] = r["nombre"]
    m.update(EXTRA)
    return m


def paginas(pdf):
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "bb.html")
    subprocess.run(["pdftotext", "-bbox", pdf, out], check=True)
    txt = open(out, encoding="utf-8").read()
    for pg in re.findall(r"<page [^>]*>(.*?)</page>", txt, flags=re.S):
        yield [(float(a), float(b), float(c), float(d), w.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">"))
               for a, b, c, d, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', pg)]


def filas_de(words):
    rows = {}
    for x0, y0, x1, y1, w in words:
        rows.setdefault(round(y0 / 2), []).append((x0, x1, w))
    return [sorted(rows[k]) for k in sorted(rows)]


def main(pdf, salida):
    nombres = nombres_de_grupos()
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Estudiantes"
    ws.append(["grupo", "curso", "no", "apellidos", "nombres"])
    resumen, avisos = {}, []
    for words in paginas(pdf):
        filas = filas_de(words)
        cods = [w for x0, y0, x1, y1, w in words if y0 < 160 and x0 > 400 and re.fullmatch(r"(CS\d{3}|C\d{3}|\d{4})(NAC)?(-[A-Z]{3})?-2026", w)]
        if not cods:
            continue
        cod = re.match(r"CS\d{3}|C\d{3}|\d{4}", cods[0]).group(0)
        cab = next(r for r in filas if any(w == "NOMBRES" for _, _, w in r))
        xa = next(x0 for x0, _, w in cab if w == "APELLIDOS"); xn = next(x0 for x0, _, w in cab if w == "NOMBRES") - 3
        xt = next(x0 for x0, _, w in cab if w == "TIP") - 2
        for r in filas:
            if not r or r[0][0] > 60:
                continue
            m0 = re.fullmatch(r"\d{1,3}", r[0][2]) or re.match(r"(\d{1,3}?)2026\w+$", r[0][2])   # el n.º de lista a veces viene pegado al código
            if not m0:
                continue
            nro = int(m0.group(1) if m0.re.groups else r[0][2])
            nm = [(x0, w) for x0, x1, w in r if xa - 32 <= x0 < xt and not re.search(r"-2026$|^\d{6,}|^20\d{8}|^20\d\d[A-Z]", w)]
            ape = " ".join(w for x0, w in nm if x0 < xn); nom = " ".join(w for x0, w in nm if x0 >= xn)
            if not ape or not nom:
                avisos.append("%s fila %d: no se pudo separar apellidos y nombres (%s)" % (cod, nro, ape or nom)); 
            ws.append([cod, nombres.get(cod, cod), nro, ape, nom])
            resumen[cod] = resumen.get(cod, 0) + 1
    ws.freeze_panes = "A2"
    for col, a in zip("ABCDE", (10, 22, 6, 34, 34)):
        ws.column_dimensions[col].width = a
    wb.save(salida)
    print("OK %d estudiantes en %d grupos -> %s" % (sum(resumen.values()), len(resumen), salida))
    for c in sorted(resumen):
        print("  %-6s %-24s %3d" % (c, nombres.get(c, c), resumen[c]))
    for a in avisos:
        print("AVISO:", a)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
