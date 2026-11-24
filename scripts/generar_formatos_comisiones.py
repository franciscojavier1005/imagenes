#!/usr/bin/env python3
"""Formatos en blanco de las Actas de la Comisión de Evaluación y Promoción (Word editable + PDF) para cada nivel.
Reproducen lo que imprime la aplicación (pantalla «Imprimible»): preescolar, básica primaria, bachillerato (6.º a 9.º) y media (10.º y 11.º).
Marca de agua: escudo del colegio al 30 % del área de la hoja carta, centrado vertical y horizontalmente detrás de todo el texto, en todas las páginas.
Uso:  python3 scripts/generar_formatos_comisiones.py   (requiere python-docx y LibreOffice `soffice` para el PDF)
Autor del sistema: Francisco Javier Cortés Cabezas (coordinador académico, I.E. ICET, Tumaco)."""
import os, subprocess, copy, shutil
from docx import Document
from docx.shared import Pt, Mm, Emu, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml, OxmlElement

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
REC = os.path.join(RAIZ, 'apps_script', 'recursos')
SALIDA = os.path.join(RAIZ, 'docs', 'formatos_comisiones')
MARCA = os.path.join(REC, 'escudo_marca_agua.png')   # escudo ya aclarado (10 % de opacidad), fondo transparente
ESCUDO = os.path.join(REC, 'escudo_icet.png')
ANCHO_LOGO, ALTO_LOGO = 1000, 732
PAG_W, PAG_H = 215.9, 279.4   # carta, mm
AREA_MARCA = 0.30 * PAG_W * PAG_H   # 30 % de la hoja
MARCA_W = (AREA_MARCA * ANCHO_LOGO / ALTO_LOGO) ** 0.5
MARCA_H = MARCA_W * ALTO_LOGO / ANCHO_LOGO
AZUL = '1F3864'
FUENTE = 'Arial'

AREAS = ['Matemáticas', 'Humanidades y Lengua Castellana', 'Ciencias Naturales y Educación Ambiental', 'Ciencias Sociales', 'Inglés', 'Educación Ética y Valores Humanos', 'Educación Religiosa Escolar', 'Educación Artística (Arte y Cultura Afro)', 'Educación Física, Recreación y Deportes', 'Tecnología e Informática', 'Convivencia']
PROPOSITOS = [
    ('Propósito 1. CONSTRUCCIÓN DE IDENTIDAD Y RELACIONES SOCIALES', ['Identidad y Autoestima', 'Autonomía e Independencia', 'Convivencia y Reglas de Juego', 'Pertenencia Cultural y Familiar']),
    ('Propósito 2. COMUNICACIÓN ACTIVA, EXPRESIÓN Y REPRESENTACIÓN', ['Expresión Oral y Escucha', 'Aproximación a la Lengua Escrita', 'Lenguajes Artísticos', 'Expresión Corporal y Musical']),
    ('Propósito 3. EXPLORACIÓN DEL MEDIO Y APRENDIZAJE SIGNIFICATIVO', ['Exploración y Curiosidad Científica', 'Pensamiento Lógico-Matemático', 'Causalidad y Resolución de Problemas', 'Cuidado de la Naturaleza']),
]
REQUISITOS = ['Todas las notas del periodo están cargadas en la plataforma y el registro académico está cerrado.',
              'Cada docente tiene sus planillas de notas (valoraciones por área y curso).',
              'Cada docente tiene sus resúmenes o consolidados del periodo.',
              'Cada docente tiene su cuaderno de registro de calificaciones y asistencia al día.',
              'Cada docente tiene sus observaciones y anotaciones de seguimiento de los estudiantes.',
              'Se tiene a la mano la información faltante (documentos, cédulas, correos); si no, se pide a rectoría, a archivo o al coordinador.']
JURAMENTO = ('Me comprometo a entregar la información con total transparencia: actúo de buena fe; lo que registro en esta acta es veraz, completo y verificable con mis planillas, resúmenes, cuadernos y soportes; '
             'no suplanto ni permito que otra persona firme o registre por mí; y respondo por ello.')
IMPORTANTE = ('IMPORTANTE: para su validez, el acta debe ser firmada por todos los asistentes, al finalizar. Quien no firme se entenderá que no participó ni asistió; la firma puesta por otra persona se considerará suplantación.')

NIVELES = {
    'preescolar': dict(titulo='Preescolar (transición)', grado='0° Preescolar', siguiente='1°', cursos=3, archivo='Formato_Acta_Comision_Preescolar'),
    'primaria': dict(titulo='Básica primaria (1.º a 5.º)', grado='____° Primaria', siguiente='____°', cursos=5, archivo='Formato_Acta_Comision_Basica_Primaria'),
    'bachillerato': dict(titulo='Bachillerato · básica secundaria (6.º a 9.º)', grado='____° Secundaria', siguiente='____°', cursos=5, archivo='Formato_Acta_Comision_Bachillerato'),
    'media': dict(titulo='Media (10.º y 11.º)', grado='____° Media', siguiente='11° / egreso (graduandos)', cursos=4, archivo='Formato_Acta_Comision_Media'),
}


# ---------------------------------------------------------------- utilidades de formato
def sombrear(celda, color):
    tcPr = celda._tc.get_or_add_tcPr()
    for s in tcPr.findall(qn('w:shd')): tcPr.remove(s)
    tcPr.append(parse_xml('<w:shd %s w:val="clear" w:color="auto" w:fill="%s"/>' % (nsdecls('w'), color)))

def fuente(run, tam=8, neg=False, color=None, cur=False):
    run.font.name = FUENTE; run._element.rPr.rFonts.set(qn('w:eastAsia'), FUENTE)
    run.font.size = Pt(tam); run.font.bold = neg; run.font.italic = cur
    if color: run.font.color.rgb = RGBColor.from_string(color)

def parrafo(doc, texto='', tam=9, neg=False, alin=None, antes=0, despues=2, color=None, cur=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(antes); p.paragraph_format.space_after = Pt(despues); p.paragraph_format.line_spacing = 1.05
    if alin == 'c': p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif alin == 'j': p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if texto: fuente(p.add_run(texto), tam, neg, color, cur)
    return p

def titulo(doc, texto):
    p = parrafo(doc, texto, 9.5, True, 'c', 8, 3, 'FFFFFF')
    p.paragraph_format.keep_with_next = True
    pPr = p._p.get_or_add_pPr(); pPr.append(parse_xml('<w:shd %s w:val="clear" w:color="auto" w:fill="%s"/>' % (nsdecls('w'), AZUL)))
    return p

def tabla(doc, encabezados, filas, anchos=None, tam=8, alto_fila=7.5, centrar=None, pie_total=None):
    t = doc.add_table(rows=1, cols=len(encabezados)); t.style = 'Table Grid'; t.alignment = WD_TABLE_ALIGNMENT.CENTER; t.autofit = False
    for i, h in enumerate(encabezados):
        c = t.rows[0].cells[i]; c.text = ''; c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER; sombrear(c, 'D9E2F3')
        p = c.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(0); fuente(p.add_run(h), tam, True)
    trPr = t.rows[0]._tr.get_or_add_trPr(); trPr.append(parse_xml('<w:tblHeader %s/>' % nsdecls('w')))
    for f in filas:
        r = t.add_row(); r.height = Mm(alto_fila)
        cant = r._tr.get_or_add_trPr(); cant.append(parse_xml('<w:cantSplit %s/>' % nsdecls('w')))
        for i, v in enumerate(f):
            c = r.cells[i]; c.text = ''; c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(0)
            if centrar and i in centrar: p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if v: fuente(p.add_run(str(v)), tam, False)
    if anchos:
        fijar_anchos(t, anchos)
    return t

def fijar_anchos(t, anchos):
    """Ancho fijo de columnas (Word y LibreOffice respetan la rejilla `tblGrid` y el diseño fijo)."""
    tblPr = t._tbl.tblPr
    for x in tblPr.findall(qn('w:tblLayout')): tblPr.remove(x)
    tblPr.append(parse_xml('<w:tblLayout %s w:type="fixed"/>' % nsdecls('w')))
    for x in tblPr.findall(qn('w:tblW')): tblPr.remove(x)
    tblPr.append(parse_xml('<w:tblW %s w:w="%d" w:type="dxa"/>' % (nsdecls('w'), int(sum(anchos) * 56.7))))
    for i, w in enumerate(anchos):
        t.columns[i].width = Mm(w)
    for row in t.rows:
        for i, w in enumerate(anchos):
            row.cells[i].width = Mm(w)

def lineas(doc, etiqueta, n=2, tam=8.5):
    p = parrafo(doc, etiqueta, tam, True, None, 3, 1)
    p.paragraph_format.keep_with_next = True
    for _ in range(n):
        q = parrafo(doc, '_' * 118, tam, False, None, 0, 1, '7F7F7F')

def casilla(doc, texto, tam=8.5):
    parrafo(doc, '☐  ' + texto, tam, False, None, 0, 1)


# ---------------------------------------------------------------- marca de agua (escudo al 30 % de la hoja, centrado, detrás de todo)
def agregar_marca(doc):
    sec = doc.sections[0]
    sec.header.is_linked_to_previous = False
    p = sec.header.paragraphs[0]
    run = p.add_run()
    run.add_picture(MARCA, width=Mm(MARCA_W))
    inline = run._r.xpath('.//wp:inline')[0]
    graphic = inline.find(qn('a:graphic'))
    cx, cy = int(Mm(MARCA_W)), int(Mm(MARCA_H))
    docpr = inline.find(qn('wp:docPr'))
    anchor = parse_xml(
        '<wp:anchor %s distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">'
        '<wp:simplePos x="0" y="0"/>'
        '<wp:positionH relativeFrom="page"><wp:align>center</wp:align></wp:positionH>'
        '<wp:positionV relativeFrom="page"><wp:align>center</wp:align></wp:positionV>'
        '<wp:extent cx="%d" cy="%d"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>'
        '<wp:docPr id="%s" name="Marca de agua escudo ICET" descr="Escudo de la institución, marca de agua"/><wp:cNvGraphicFramePr/>'
        '</wp:anchor>' % (nsdecls('wp', 'a', 'pic', 'r'), cx, cy, docpr.get('id')))
    anchor.append(copy.deepcopy(graphic))
    inline.getparent().replace(inline, anchor)


def pie_pagina(doc, texto):
    sec = doc.sections[0]; p = sec.footer.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fuente(p.add_run(texto + ' · Página '), 7, False, '595959')
    for tipo in ('begin', None, 'end'):
        r = p.add_run(); fuente(r, 7, False, '595959')
        if tipo:
            fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), tipo); r._r.append(fc)
        else:
            it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = 'PAGE'; r._r.append(it)


# ---------------------------------------------------------------- contenido
def encabezado(doc, nivel, datos):
    t = doc.add_table(rows=1, cols=2); t.autofit = False
    fijar_anchos(t, [28, 163])
    c0, c1 = t.rows[0].cells
    c0.paragraphs[0].add_run().add_picture(ESCUDO, width=Mm(22))
    c1.text = ''; c1.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    lineas_t = [('MINISTERIO DE EDUCACIÓN NACIONAL', 8, False), ('SAN ANDRÉS DE TUMACO', 8, False), ('INSTITUCIÓN CIUDADELA EDUCATIVA TUMAC-ICET', 11, True),
                ('RESOLUCIÓN DE APROBACIÓN DE ESTUDIOS: NO.4075 DEL 27 DE DICIEMBRE DEL 2002 - NIT. 840000163-1', 7, False), ('COD. ICFES: 112052 – COD. DANE: 152835-004371', 7, False),
                ('COMISIÓN DE EVALUACIÓN Y PROMOCIÓN 2026', 10.5, True), ('DECRETO 1290 DE ABRIL 16 DE 2009 Y MANUAL DE CONVIVENCIA', 8, False)]
    for i, (tx, tam, neg) in enumerate(lineas_t):
        p = c1.paragraphs[0] if i == 0 else c1.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(0); fuente(p.add_run(tx), tam, neg)
    parrafo(doc, IMPORTANTE, 7.5, True, 'j', 4, 3, '7F1D1D')
    tabla(doc, ['ACTA No.', 'FECHA', 'HORA DE APERTURA', 'HORA DE CIERRE', 'GRADO'], [['', '', '', '', datos['grado']]], [28, 34, 38, 38, 53], 8.5, 9, [0, 1, 2, 3, 4])
    parrafo(doc, 'PERÍODO ACADÉMICO:   ☐ Primero    ☐ Segundo    ☐ Tercero    ☐ Final (informe final · cierre del año escolar)', 8.5, True, None, 3, 2)


def seccion_asistencia(doc, nivel):
    titulo(doc, 'VERIFICACIÓN DE ASISTENCIA DE LOS INTEGRANTES DE LA COMISIÓN')
    rol = 'maestra' if nivel == 'preescolar' else 'docente'
    tabla(doc, ['No.', 'Nombres y apellidos de la ' + rol, '¿Director(a) de grupo?', 'Área / rol', 'N.º de cédula', 'Celular · correo', 'Firma al finalizar (obligatoria)'],
          [[i + 1, '', '', '', '', '', ''] for i in range(8 if nivel == 'preescolar' else 12)], [9, 44, 21, 27, 23, 31, 36], 7.5, 8.5, [0, 2])
    parrafo(doc, 'Acompañan (opcional, no firman el cierre): Directivo(a) docente ______________________   Docente orientadora ______________________   Tutora PTAFI ______________________', 7.5, False, None, 3, 2)
    parrafo(doc, 'Acuerdo y compromiso de transparencia (cada docente del grado lo acepta en la aplicación): ' + JURAMENTO, 7.5, False, 'j', 3, 1, None, True)
    parrafo(doc, 'Aceptado por (nombres y hora): ________________________________________________________________________________________', 7.5, False, None, 1, 3)
    parrafo(doc, 'Requisitos verificados antes de iniciar:', 8, True, None, 2, 1)
    for r in REQUISITOS: casilla(doc, r, 7.5)
    parrafo(doc, 'Docente responsable del registro y del cierre: ______________________________________________', 8.5, True, None, 4, 2)


def seccion_matricula(doc, nivel, cursos):
    titulo(doc, 'INFORMACIÓN ESTADÍSTICA DE MATRÍCULA')
    fin = ['Desarrollo esperado', 'Por consolidar'] if nivel == 'preescolar' else ['Aprobación / sin pérdida', 'Reprobación']
    enc = ['Grupo', 'Matrícula inicial', 'Nuevos', 'Retirados', 'No asistentes', 'Total actual', 'M', 'F', 'VEN', 'ECU'] + fin
    filas = [[''] * len(enc) for _ in range(cursos)] + [['TOTAL GRADO'] + [''] * (len(enc) - 1)]
    tabla(doc, enc, filas, [18, 17, 13, 19, 21, 16, 9, 9, 10, 10, 25, 25], 7.5, 7.5, list(range(len(enc))))
    parrafo(doc, 'Total actual = inicial + nuevos − retirados − no asistentes.  Hombres + mujeres = total actual.  VEN = estudiantes venezolanos; ECU = ecuatorianos.', 7, False, None, 1, 2, '595959', True)


def seccion_rendimiento(doc, nivel):
    if nivel == 'preescolar':
        titulo(doc, 'FRECUENCIA DEL RENDIMIENTO SEGÚN EL ESTADO DEL PROPÓSITO (EDUCACIÓN PREESCOLAR)')
        enc = ['Propósito / imprescindible', 'Excepcional avanzado', 'Desarrollo esperado', 'En proceso', 'Requiere apoyo', '% desarrollo esperado', '% por consolidar']
        filas = []
        for pr, items in PROPOSITOS:
            filas.append([pr, '', '', '', '', '', '']); filas.extend([[i, '', '', '', '', '', ''] for i in items])
        filas.append(['CONVIVENCIA', '', '', '', '', '', '']); filas.append(['Convivencia', '', '', '', '', '', ''])
        t = tabla(doc, enc, filas, [74, 18, 18, 16, 16, 24, 24], 7.5, 6.5, [1, 2, 3, 4, 5, 6])
        for r in t.rows[1:]:
            if r.cells[0].text.startswith(('Propósito', 'CONVIVENCIA')):
                for c in r.cells: sombrear(c, 'EEF2F9')
        return
    titulo(doc, 'RENDIMIENTO ACADÉMICO POR ÁREA / ASIGNATURA')
    areas = list(AREAS)
    if nivel == 'media':
        areas = areas[:-1] + ['Ciencias Económicas y Políticas', 'Filosofía', 'Área de profundización o media técnica (_____________)', 'Convivencia']
    tabla(doc, ['Área / asignatura', 'Aprobados', '%', 'Reprobados', '%'], [[a, '', '', '', ''] for a in areas], [90, 25, 20, 25, 20], 7.5, 6.5, [1, 2, 3, 4])
    parrafo(doc, 'Registre también los reprobados por curso en la aplicación (cifra de cada área en cada curso del grado).', 7, False, None, 1, 2, '595959', True)


def seccion_reprobacion(doc, nivel):
    if nivel == 'preescolar':
        titulo(doc, 'ESTUDIANTES DEFICIENTES POR DESERCIÓN E INASISTENCIA')
        enc = ['No.', 'Apellidos y nombres', 'Grupo', 'Inasist.', 'Propósitos sin consolidar y motivos', 'Motivos generales']
    else:
        titulo(doc, 'ESTUDIANTES CON REPROBACIÓN O RIESGO (POR ÁREA Y MOTIVO)')
        enc = ['No.', 'Apellidos y nombres', 'Grupo', 'Inasist.', 'Áreas y motivos', 'Motivos generales']
    tabla(doc, enc, [[i + 1, '', '', '', '', ''] for i in range(12)], [9, 52, 14, 14, 70, 32], 7.5, 7.5, [0, 2, 3])
    parrafo(doc, 'Por curso: «Director(a): ______________________». Si no hubo casos: ☐ No hubo casos de reprobación o riesgo en el curso ______.', 7.5, False, None, 2, 2)


def seccion_promocion(doc, nivel, cursos):
    if nivel == 'preescolar':
        return
    if nivel == 'media':
        titulo(doc, 'PROMOCIÓN Y GRADUACIÓN DE ESTUDIANTES POR CURSO (ACTA FINAL)')
    else:
        titulo(doc, 'PROMOCIÓN DE ESTUDIANTES POR CURSO (ACTA FINAL)')
    parrafo(doc, 'Regla del SIEE: se promueve al estudiante que reprueba hasta el máximo de áreas que fija el Sistema Institucional de Evaluación (verifique el criterio vigente).', 7.5, False, None, 0, 2, '595959', True)
    tabla(doc, ['Curso', 'Promovidos sin áreas pendientes', 'Promovidos con áreas pendientes', 'No promovidos', 'Confirmado por el director(a)'], [[''] * 5 for _ in range(cursos)], [24, 40, 40, 30, 55], 7.5, 7.5, [0, 1, 2, 3, 4])
    enc = ['No.', 'Apellidos y nombres', 'Grupo', 'Documento', 'Situación (promovido con pendientes / no promovido)', 'Áreas pendientes']
    anchos = [9, 50, 14, 24, 50, 42]
    if nivel == 'media':
        titulo(doc, 'GRADUACIÓN (GRADO 11°)')
        tabla(doc, ['Curso', 'Graduandos', 'No graduados', 'Servicio social (80 h) cumplido', 'Constitución política (50 h) cumplida', 'Otros requisitos pendientes'], [[''] * 6 for _ in range(3)], [20, 26, 26, 38, 38, 43], 7.5, 7.5, [0, 1, 2, 3, 4])
        parrafo(doc, 'Verifique los requisitos de grado vigentes del SIEE y de la normativa nacional antes de proclamar bachilleres.', 7, False, None, 1, 2, '595959', True)
    tabla(doc, enc, [[i + 1, '', '', '', '', ''] for i in range(10)], anchos, 7.5, 7.5, [0, 2])


def seccion_reconocimientos(doc, nivel):
    titulo(doc, 'RECONOCIMIENTO DE MÉRITOS')
    tabla(doc, ['No.', 'Grupo', 'Promedio', 'Nombres', 'Apellidos', 'Tipo y N.º de documento', 'Tipo de reconocimiento / puesto'],
          [[i + 1, '', '', '', '', '', ''] for i in range(10)], [9, 15, 17, 38, 38, 32, 42], 7.5, 7.5, [0, 1, 2])


def seccion_convivencia(doc):
    titulo(doc, 'CONVIVENCIA: CASOS, MATRÍCULA EN OBSERVACIÓN, CONDICIONAL O CANCELACIÓN')
    tabla(doc, ['No.', 'Estudiante', 'Grupo', 'Situación y motivo', 'Decisión', 'Ruta de atención', 'Reporte coord. convivencia', 'Reporte orientación', 'Padre notificado'],
          [[i + 1] + [''] * 8 for i in range(6)], [8, 32, 12, 40, 24, 22, 17, 17, 17], 7, 8.5, [0, 2, 6, 7, 8])
    parrafo(doc, 'Si no hubo casos: ☐ No hubo casos de convivencia.', 7.5, False, None, 2, 2)


def seccion_acudientes(doc):
    titulo(doc, 'OBSERVACIONES DE LOS ACUDIENTES Y LLAMADOS A COMPROMISO')
    lineas(doc, 'Acudientes que asistieron (nombre y celular) y observaciones:', 2)
    tabla(doc, ['No.', 'Apellidos y nombres', 'Grupo', '¿Compromiso? Llamado', 'Motivos', 'Soporte firmado'], [[i + 1, '', '', '', '', ''] for i in range(6)], [9, 55, 14, 36, 50, 25], 7.5, 7.5, [0, 2, 5])


def seccion_recomendaciones(doc, nivel, datos):
    sig = datos['siguiente']
    titulo(doc, 'RECOMENDACIONES DE LOS DOCENTES PARA ' + sig.upper())
    if nivel == 'preescolar':
        filas = []
        for pr, items in PROPOSITOS:
            filas.append([pr, '', '']); filas.extend([[i, '', ''] for i in items])
        t = tabla(doc, ['Propósito', 'Aprendizajes y competencias con mayor dificultad', 'Recomendación'], filas, [60, 55, 76], 7.5, 7, None)
        for r in t.rows[1:]:
            if r.cells[0].text.startswith('Propósito'):
                for c in r.cells: sombrear(c, 'EEF2F9')
    else:
        areas = list(AREAS[:-1])
        if nivel == 'media':
            areas += ['Ciencias Económicas y Políticas', 'Filosofía', 'Profundización o media técnica']
        tabla(doc, ['Área', 'Aprendizajes y competencias con mayor dificultad', 'Recomendación'], [[a, '', ''] for a in areas], [60, 55, 76], 7.5, 8, None)
    parrafo(doc, 'Referentes de calidad: DBA, estándares básicos de competencias, orientaciones pedagógicas y estándares de ERE del Ministerio de Educación Nacional (y de la Conferencia Episcopal para ERE).', 7, False, None, 2, 2, '595959', True)


def seccion_piar(doc):
    titulo(doc, 'PIAR Y DIFICULTADES DE APRENDIZAJE')
    tabla(doc, ['No.', 'Estudiante', 'Grupo', 'Situación (tiene PIAR / requiere PIAR)', '¿Se aplicaron los ajustes?', 'Ajustes', 'Evidencias'], [[i + 1] + [''] * 6 for i in range(6)], [9, 44, 13, 38, 24, 38, 25], 7.5, 7.5, [0, 2])
    parrafo(doc, 'DUA aplicado:  ☐ Sí   ☐ Parcialmente   ☐ No        Orientación / apoyo pedagógico:  ☐ Sí   ☐ Algunos casos   ☐ No', 8, False, None, 3, 1)
    lineas(doc, 'Observaciones sobre PIAR / DUA:', 2)


def seccion_conclusiones(doc):
    titulo(doc, 'DIFICULTADES, ESTRATEGIAS Y CONCLUSIONES')
    parrafo(doc, 'Seguimiento al periodo anterior:   ☐ Sí   ☐ Parcialmente   ☐ No', 8.5, True, None, 2, 1)
    lineas(doc, 'Detalle del seguimiento:', 1)
    lineas(doc, 'Dificultades o deficiencias relevantes:', 2)
    lineas(doc, 'Estrategias pedagógicas sugeridas o en curso:', 2)
    lineas(doc, 'Conclusiones:', 2)


def seccion_cierre(doc, nivel):
    p = parrafo(doc, 'Siendo las ______________ (hora de cierre y guardado del acta en la aplicación) se da por finalizada la Comisión de Evaluación y Promoción.', 9, True, 'j', 8, 3)
    p.paragraph_format.keep_with_next = True
    parrafo(doc, IMPORTANTE, 7.5, True, 'j', 0, 3, '7F1D1D').paragraph_format.keep_with_next = True
    tabla(doc, ['Nombres y apellidos', 'Cargo / rol', 'C.C. No.', 'Correo o celular', 'Firma'], [[''] * 5 for _ in range(6)], [52, 34, 28, 36, 41], 7.5, 10, None)


def construir(nivel):
    datos = NIVELES[nivel]
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Mm(PAG_W), Mm(PAG_H)
    sec.left_margin = sec.right_margin = Mm(12); sec.top_margin = Mm(12); sec.bottom_margin = Mm(16); sec.header_distance = Mm(5); sec.footer_distance = Mm(7)
    st = doc.styles['Normal']; st.font.name = FUENTE; st.font.size = Pt(9)
    agregar_marca(doc)
    pie_pagina(doc, 'ACTA COMISIÓN DE EVALUACIÓN Y PROMOCIÓN · ' + datos['titulo'] + ' · Sistema de control de asistencia docente · Diseñado por Francisco Javier Cortés Cabezas - Coordinador')
    encabezado(doc, nivel, datos)
    seccion_asistencia(doc, nivel)
    seccion_matricula(doc, nivel, datos['cursos'])
    seccion_rendimiento(doc, nivel)
    seccion_reprobacion(doc, nivel)
    seccion_promocion(doc, nivel, datos['cursos'])
    seccion_reconocimientos(doc, nivel)
    seccion_convivencia(doc)
    seccion_acudientes(doc)
    seccion_recomendaciones(doc, nivel, datos)
    seccion_piar(doc)
    seccion_conclusiones(doc)
    seccion_cierre(doc, nivel)
    doc.core_properties.author = 'Francisco Javier Cortés Cabezas'
    doc.core_properties.title = 'Formato de acta · Comisión de evaluación y promoción · ' + datos['titulo']
    os.makedirs(SALIDA, exist_ok=True)
    ruta = os.path.join(SALIDA, datos['archivo'] + '.docx')
    doc.save(ruta)
    return ruta


def main():
    rutas = [construir(n) for n in NIVELES]
    for r in rutas:
        subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', SALIDA, r], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('Marca de agua: %.1f × %.1f mm (%.0f %% de la hoja carta)' % (MARCA_W, MARCA_H, 100 * MARCA_W * MARCA_H / (PAG_W * PAG_H)))
    for f in sorted(os.listdir(SALIDA)): print(' ', f, os.path.getsize(os.path.join(SALIDA, f)) // 1024, 'KB')


if __name__ == '__main__':
    main()
