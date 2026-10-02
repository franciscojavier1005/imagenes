#!/usr/bin/env python3
"""Genera ICET_Control_Asistencia_Docente_2026.xlsx a partir de data/*.csv.

Hojas: LEEME, Ronda (consulta automática), Docentes, Horario, Matriz_Grupos, Motivos,
Novedades (mismo esquema del formulario de ausentismo), Registro_Ronda, Directivos, Listas, Franjas, Grupos.
"""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule

D = os.path.join(os.path.dirname(__file__), "..", "data")
OUT = os.path.join(os.path.dirname(__file__), "..", "ICET_Control_Asistencia_Docente_2026.xlsx")
AZUL = PatternFill("solid", fgColor="1F4E78")
CLARO = PatternFill("solid", fgColor="DDEBF7")
DIAS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]
MAXF = 1500   # filas máximas consideradas en Horario
NF = 70       # filas de la hoja Ronda


def leer(n):
    return list(csv.reader(open(os.path.join(D, n), encoding="utf-8-sig")))


def leer_d(n):
    return list(csv.DictReader(open(os.path.join(D, n), encoding="utf-8-sig")))


def cab(ws, fila=1):
    for c in ws[fila]:
        if c.value is not None:
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = AZUL
            c.alignment = Alignment(wrap_text=True, vertical="center")


def anchos(ws, tope=45, muestra=100):
    for i in range(1, ws.max_column + 1):
        w = max(len(str(ws.cell(r, i).value or "")) for r in range(1, min(ws.max_row, muestra) + 1))
        ws.column_dimensions[get_column_letter(i)].width = min(max(9, w + 2), tope)


def hoja(wb, nombre, filas):
    ws = wb.create_sheet(nombre)
    for f in filas:
        ws.append(f)
    cab(ws)
    ws.freeze_panes = "A2"
    anchos(ws)
    ws.auto_filter.ref = ws.dimensions
    return ws


_DOC = {d["nombre_completo"]: d for d in leer_d("docentes.csv")}


def corto(nombre):  # "Aguirre Riascos Jorge Andrés" -> "Aguirre J."
    d = _DOC.get(nombre)
    return f'{d["apellidos"].split()[0]} {d["nombres"].split()[0][0]}.' if d else nombre


wb = Workbook()
wb.remove(wb.active)
H = leer_d("horario_maestro.csv")
GR = {g["grupo"]: g for g in leer_d("grupos.csv")}

# ------------------------------------------------------------------ LEEME
lm = wb.create_sheet("LEEME")
for t in [
    "ICET 2026 - Control de asistencia docente",
    "",
    "RONDA (hoja principal): al abrirla muestra, sin filtros, quién debe estar en cada grupo en la sesión actual.",
    "  - Día y sesión se calculan con la hora del dispositivo. En Google Sheets: Archivo > Configuración > zona horaria (GMT-05:00 Bogotá).",
    "  - Para consultar otro momento escriba el día y/o la sesión en las celdas amarillas; bórrelas para volver a 'ahora'.",
    "  - Marque Estado y Motivo con las listas desplegables. En Excel NO se guardan los registros: para guardar use la aplicación web (Apps Script).",
    "",
    "Hojas:",
    "  Docentes       Lista oficial (57). Preescolar y primaria con su grupo (PDF Dirección de Grupo).",
    "  Horario        Una fila por docente / día / sesión de 45 min (secundaria: PDF 02-02-2026; primaria: áreas múltiples).",
    "  Direccion_Grupo Dinamizadores de cada grupo (PDF Dirección de Grupo 2026). En bachillerato la dirección es dual: ambos responsables.",
    "  Matriz_Grupos  Para cada día y sesión, quién atiende a cada grupo (consulta rápida o para imprimir).",
    "  Motivos        Catálogo de justificaciones por categoría (salud, permiso, evento externo, calamidad doméstica, etc.).",
    "  Novedades      Mismo esquema de su formulario 'ASISTENCIA DOCENTE ICET (respuestas)' + 3 columnas nuevas.",
    "  Registro_Ronda Cada marca de la ronda (presente, no asistió, tarde...).",
    "  Directivos     Quiénes registran. Correos TEMPORALES (@example.com), reemplazar por los reales.",
    "",
    "Énfasis: estudiantes de un curso dispersos entre un equipo de docentes. Parejas alternan por semana; Sociales/Inglés y Ética/Religión alternan sus áreas cada semana.",
    "Datos personales de docentes: acceso solo para directivos (Ley 1581 de 2012).",
]:
    lm.append([t])
lm["A1"].font = Font(bold=True, size=14)
lm.column_dimensions["A"].width = 150

# ------------------------------------------------------------------ Franjas / Grupos / Listas / Motivos / Directivos
fr = hoja(wb, "Franjas", [[c for c in leer("franjas.csv")[0]]] + [[int(x) if x.isdigit() else x for x in r] for r in leer("franjas.csv")[1:]])
gr = hoja(wb, "Grupos", leer("grupos.csv"))
mot = hoja(wb, "Motivos", leer("motivos.csv"))
dir_ = hoja(wb, "Directivos", [["nombre", "rol", "correo_temporal"],
    ["Francisco Cortés", "Coordinador académico", "coordinador1.temporal@example.com"],
    ["Coordinador 2", "Coordinador", "coordinador2.temporal@example.com"],
    ["Coordinador 3", "Coordinador", "coordinador3.temporal@example.com"],
    ["Rector", "Rector", "rector.temporal@example.com"]])
lis = hoja(wb, "Listas", leer("listas.csv"))

# ------------------------------------------------------------------ Dirección de grupo
_dg = leer_d("direccion_grupo.csv")
dgf = [["grupo", "nombre", "tipo_direccion", "docente_1", "docente_2", "modalidad", "dinamizadores"]]
for r in _dg:
    cortos = " / ".join(corto(x) for x in (r["docente_1"], r["docente_2"]) if x)
    dgf.append([r["grupo"], r["nombre"], r["tipo_direccion"], r["docente_1"], r["docente_2"], r["modalidad"], cortos])
hoja(wb, "Direccion_Grupo", dgf)

# ------------------------------------------------------------------ Docentes
doc = hoja(wb, "Docentes", leer("docentes.csv"))
dv = DataValidation(type="list", formula1='"SECUNDARIA,PRIMARIA,PREESCOLAR,ADMINISTRATIVO,POR DEFINIR"', allow_blank=True)
doc.add_data_validation(dv)
dv.add("F2:F200")

# ------------------------------------------------------------------ Horario (+ columnas auxiliares con fórmulas)
cols = ["docente_n", "docente", "dia", "hora", "bloque", "sesion", "inicio", "fin", "tipo", "grupo", "area", "enfasis_ref",
        "grupos_enfasis", "equipo_enfasis", "alternancia", "celda_original"]
hz = wb.create_sheet("Horario")
hz.append(cols + ["grupo_mostrar", "nota", "clave", "orden", "indice", "dir_grupo"])
for i, r in enumerate(H, start=2):
    hz.append([int(r["docente_n"]), r["docente"], r["dia"], int(r["hora"]), int(r["bloque"]), int(r["sesion"]), r["inicio"], r["fin"],
               r["tipo"], r["grupo"], r["area"], r["enfasis_ref"], r["grupos_enfasis"], r["equipo_enfasis"], r["alternancia"], r["celda_original"],
               f'=IF(I{i}="ENFASIS","ÉNFASIS "&M{i},IFERROR(VLOOKUP(J{i},Grupos!$A$2:$D$100,4,FALSE),J{i}))',
               f'=O{i}&IF(N{i}<>"",IF(O{i}<>""," · ","")&"Con: "&N{i},"")',
               f'=C{i}&"|"&D{i}', f'=COUNTIF($S$2:S{i},S{i})', f'=S{i}&"|"&T{i}',
               f'=IFERROR(VLOOKUP(IF(I{i}="ENFASIS",LEFT(M{i},FIND("+",M{i}&"+")-1),J{i}),Direccion_Grupo!$A$2:$G$100,7,FALSE),"")'])
cab(hz)
hz.freeze_panes = "C2"
anchos(hz, 40)
hz.auto_filter.ref = hz.dimensions

# ------------------------------------------------------------------ Ronda
ro = wb.create_sheet("Ronda", 1)
ro["A1"] = "RONDA DE ASISTENCIA DOCENTE - ICET 2026"
ro["A1"].font = Font(bold=True, size=15, color="1F4E78")
ro["A3"], ro["A4"], ro["A5"], ro["A6"], ro["A7"] = "Día", "Sesión", "Franja", "Docentes esperados", "Hora del dispositivo"
for c in ("A3", "A4", "A5", "A6", "A7"):
    ro[c].font = Font(bold=True)
ro["E3"], ro["E4"] = "← Día manual (opcional)", "← Sesión manual 1-8 (opcional)"
ro["D3"].fill = ro["D4"].fill = PatternFill("solid", fgColor="FFF2CC")
ro["K1"], ro["K2"], ro["K3"], ro["K4"] = "minuto", "sesión auto", "día auto", "clave"
ro["L1"] = '=HOUR(NOW())*60+MINUTE(NOW())'
ro["L2"] = '=IF(L1>=MAX(Franjas!$G$2:$G$9),"FUERA DE JORNADA",IFERROR(IF(L1<INDEX(Franjas!$G$2:$G$9,MATCH(L1,Franjas!$F$2:$F$9,1)),MATCH(L1,Franjas!$F$2:$F$9,1),"DESCANSO"),"FUERA DE JORNADA"))'
ro["L3"] = '=IFERROR(CHOOSE(WEEKDAY(NOW(),2),"LUNES","MARTES","MIERCOLES","JUEVES","VIERNES"),"FIN DE SEMANA")'
ro["L4"] = '=B3&"|"&B4'
ro["B3"] = '=IF(D3<>"",D3,L3)'
ro["B4"] = '=IF(D4<>"",D4,L2)'
ro["B5"] = '=IFERROR(INDEX(Franjas!$D$2:$D$9,B4)&" - "&INDEX(Franjas!$E$2:$E$9,B4),"Sin clase en este momento")'
ro["B6"] = '=COUNTIF(Horario!$S$2:$S$%d,L4)' % MAXF
ro["B7"] = '=TEXT(NOW(),"HH:mm")'
for c in ("B3", "B4", "B5", "B6", "B7"):
    ro[c].font = Font(bold=True, size=12)
dvd = DataValidation(type="list", formula1='"LUNES,MARTES,MIERCOLES,JUEVES,VIERNES"', allow_blank=True)
dvs = DataValidation(type="list", formula1='"1,2,3,4,5,6,7,8"', allow_blank=True)
ro.add_data_validation(dvd); ro.add_data_validation(dvs)
dvd.add("D3"); dvs.add("D4")
enc = ["#", "Grupo", "Dirección de grupo", "Docente", "Área", "Nota (alternancia / equipo)", "Estado", "Motivo", "Observaciones"]
for j, t in enumerate(enc, start=1):
    ro.cell(9, j, t)
cab(ro, 9)
for k in range(1, NF + 1):
    f = 9 + k
    ro.cell(f, 1, k)
    ro.cell(f, 11, f'=IFERROR(MATCH($L$4&"|"&A{f},Horario!$U$2:$U${MAXF},0),"")')
    ro.cell(f, 2, f'=IF($K{f}="","",INDEX(Horario!$Q$2:$Q${MAXF},$K{f}))')
    ro.cell(f, 3, f'=IF($K{f}="","",INDEX(Horario!$V$2:$V${MAXF},$K{f}))')
    ro.cell(f, 4, f'=IF($K{f}="","",INDEX(Horario!$B$2:$B${MAXF},$K{f}))')
    ro.cell(f, 5, f'=IF($K{f}="","",IF(INDEX(Horario!$K$2:$K${MAXF},$K{f})="","(énfasis)",INDEX(Horario!$K$2:$K${MAXF},$K{f})))')
    ro.cell(f, 6, f'=IF($K{f}="","",INDEX(Horario!$R$2:$R${MAXF},$K{f}))')
dvE = DataValidation(type="list", formula1="=Listas!$B$2:$B$7", allow_blank=True)
dvM = DataValidation(type="list", formula1="=Motivos!$B$2:$B$16", allow_blank=True)
ro.add_data_validation(dvE); ro.add_data_validation(dvM)
dvE.add(f"G10:G{9 + NF}"); dvM.add(f"H10:H{9 + NF}")
ro.conditional_formatting.add(f"A10:I{9 + NF}", FormulaRule(formula=['$G10="No asistió"'], fill=PatternFill("solid", bgColor="F8CBAD")))
ro.conditional_formatting.add(f"A10:I{9 + NF}", FormulaRule(formula=['LEFT($G10,7)="Llegada"'], fill=PatternFill("solid", bgColor="FFE699")))
ro.conditional_formatting.add(f"A10:I{9 + NF}", FormulaRule(formula=['$G10="Presente"'], fill=PatternFill("solid", bgColor="C6E0B4")))
for col, w in zip("ABCDEFGHI", (20, 22, 30, 38, 18, 55, 18, 34, 30)):
    ro.column_dimensions[col].width = w
ro.freeze_panes = "A10"
for c in ("K", "L"):
    ro.column_dimensions[c].hidden = True

# ------------------------------------------------------------------ Matriz_Grupos (quién atiende a cada grupo, por día y sesión)
grupos = sorted(GR, key=lambda g: (g.startswith("CS"), g))
mx = wb.create_sheet("Matriz_Grupos")
mx.append(["día", "sesión", "franja"] + [GR[g]["nombre"] for g in grupos])
fr_txt = {int(r[0]): f"{r[3]}-{r[4]}" for r in leer("franjas.csv")[1:]}
cel = {}
for r in H:
    g = r["grupo"] if r["tipo"] != "ENFASIS" else None
    areas = r["area"]
    txt = f'{corto(r["docente"])} ({areas})' if g else f'{corto(r["docente"])}'
    if g:
        cel.setdefault((r["dia"], int(r["hora"]), g), []).append(txt)
    else:
        for gg in r["grupos_enfasis"].split("+"):
            cel.setdefault((r["dia"], int(r["hora"]), gg), []).append(txt)
for d in DIAS:
    for h in range(1, 9):
        fila = [d, h, fr_txt[h]]
        for g in grupos:
            v = cel.get((d, h, g), [])
            es_enf = any(r for r in H if r["tipo"] == "ENFASIS" and r["dia"] == d and int(r["hora"]) == h and g in r["grupos_enfasis"].split("+"))
            fila.append(("ÉNFASIS: " if es_enf else "") + " / ".join(v))
        mx.append(fila)
cab(mx)
mx.freeze_panes = "D2"
mx.column_dimensions["A"].width = 12; mx.column_dimensions["B"].width = 8; mx.column_dimensions["C"].width = 14
for i in range(4, mx.max_column + 1):
    mx.column_dimensions[get_column_letter(i)].width = 28
for row in mx.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical="top")
mx.auto_filter.ref = mx.dimensions

# ------------------------------------------------------------------ Novedades (esquema del formulario actual) y Registro_Ronda
nov = hoja(wb, "Novedades", [["Marca temporal", "Fecha Novedad", "Docente", "Tipo Novedad", "Actividad de Aprendizaje", "Motivo Ausencia",
                              "Descripción", "Fuente Novedad", "Medio Información", "Grado", "Grupo", "Área/Asignatura", "Horario",
                              "Minutos Desatendidos", "Directivo Docente", "Sesiones", "Justificada", "Categoría motivo"]])
hoja(wb, "Registro_Ronda", [["marca_temporal", "fecha", "dia", "sesion", "franja", "docente", "grupo", "area", "estado", "motivo",
                             "justificada", "minutos", "observaciones", "directivo"]])

orden = ["LEEME", "Ronda", "Docentes", "Horario", "Matriz_Grupos", "Direccion_Grupo", "Motivos", "Novedades", "Registro_Ronda", "Directivos", "Listas", "Franjas", "Grupos"]
wb._sheets = [wb[n] for n in orden]
wb.active = 1
wb.save(OUT)
print("OK", OUT)
