#!/usr/bin/env python3
"""Genera el libro ICET_Control_Asistencia_Docente_2026.xlsx a partir de data/*.csv."""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

D = os.path.join(os.path.dirname(__file__), "..", "data")
OUT = os.path.join(os.path.dirname(__file__), "..", "ICET_Control_Asistencia_Docente_2026.xlsx")
HDR = PatternFill("solid", fgColor="1F4E78")


def leer(n):
    return list(csv.reader(open(os.path.join(D, n), encoding="utf-8-sig")))


def hoja(wb, nombre, filas, anchos=None):
    ws = wb.create_sheet(nombre)
    for f in filas:
        ws.append(f)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = HDR
        c.alignment = Alignment(wrap_text=True, vertical="center")
    ws.freeze_panes = "A2"
    for i in range(1, ws.max_column + 1):
        ancho = max(len(str(ws.cell(r, i).value or "")) for r in range(1, min(ws.max_row, 80) + 1))
        ws.column_dimensions[get_column_letter(i)].width = min(max(10, ancho + 2), 45)
    ws.auto_filter.ref = ws.dimensions
    return ws


wb = Workbook()
wb.remove(wb.active)

leeme = wb.create_sheet("LEEME")
for t in [
    "ICET 2026 - Control de asistencia docente",
    "",
    "Hojas:",
    "  Docentes    - Lista oficial (57). Complete 'correo' y 'nivel'. Los de PRIMARIA/PREESCOLAR aún no tienen horario cargado.",
    "  Franjas     - 8 sesiones de 45 min en 4 bloques de 90 min (descansos 8:00, 9:50 y 11:40, de 20 min).",
    "  Grupos      - 14 grupos regulares + 4 de Caminar en Secundaria (CS 1-1, 1-2, 2-1, 2-2).",
    "  Horario     - Una fila por docente / día / sesión de 45 min. Fuente: PDF de asignación académica 02-02-2026.",
    "  Novedades   - Aquí caen las respuestas del Formulario (las crea el menú 'Asistencia ICET').",
    "  Directivos  - Quienes registran novedades. Correos TEMPORALES (@example.com): reemplazar por los reales antes de compartir.",
    "  Config      - Tipos de novedad, responsables y zona horaria.",
    "",
    "Tipo ENFASIS: estudiantes dispersos de un curso atendidos por un equipo de docentes. 'grupos_enfasis' = curso atendido; 'equipo_enfasis' = demás docentes del equipo.",
    "Alternancia: parejas de énfasis alternan por semana; Sociales/Inglés y Ética/Religión alternan sus áreas cada semana (según asignación del rector).",
    "Datos personales de docentes: acceso solo para directivos (Ley 1581 de 2012).",
]:
    leeme.append([t])
leeme["A1"].font = Font(bold=True, size=14)
leeme.column_dimensions["A"].width = 120

hoja(wb, "Docentes", leer("docentes.csv"))
hoja(wb, "Franjas", leer("franjas.csv"))
hoja(wb, "Grupos", leer("grupos.csv"))
hoja(wb, "Horario", leer("horario_maestro.csv"))
hoja(wb, "Novedades", [[
    "marca_temporal", "fecha", "registrado_por", "docente", "tipo_novedad", "bloque", "hora_inicio",
    "grupo_segun_horario", "area_segun_horario", "tipo_clase", "observaciones", "soporte", "dia"]])
hoja(wb, "Directivos", [["nombre", "rol", "correo_temporal"],
    ["Coordinador 1", "Coordinador académico", "coordinador1.temporal@example.com"],
    ["Coordinador 2", "Coordinador", "coordinador2.temporal@example.com"],
    ["Coordinador 3", "Coordinador", "coordinador3.temporal@example.com"],
    ["Rector", "Rector", "rector.temporal@example.com"]])
hoja(wb, "Config", [["tipo_novedad", "responsables", "zona_horaria"],
    ["Ausencia con permiso", "Coordinador 1", "America/Bogota"],
    ["Ausencia por incapacidad", "Coordinador 2", ""],
    ["Ausencia por calamidad doméstica", "Coordinador 3", ""],
    ["Comisión de servicios", "Rector", ""],
    ["Llegada tarde", "", ""],
    ["Salida anticipada", "", ""],
    ["Ausencia sin justificar", "", ""],
    ["Presente / sin novedad", "", ""]])
wb.save(OUT)
print("OK", OUT)
