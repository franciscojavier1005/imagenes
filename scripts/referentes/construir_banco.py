#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construye data/referentes_etiquetas.json: etiquetas CORTAS de referentes de calidad
(DBA, estándares básicos de competencias, orientaciones, estándares de ERE) por área y grado,
para que el docente las use en las recomendaciones de la comisión de evaluación y promoción.

Sistema de control de asistencia docente · I.E. Ciudadela Educativa Tumac (ICET), Tumaco.
Diseñado por Francisco Javier Cortés Cabezas · Coordinador académico.

Entrada:  data/referentes_dba.json (DBA extraídos de los PDF oficiales) + listas de este archivo.
Salida:   data/referentes_etiquetas.json
Cada etiqueta: {k: tipo, c: código corto, e: etiqueta corta, t: texto oficial (si se tiene), v: 'p' si es parcial/por verificar}
"""
import json, os, sys
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
dba = json.load(open(os.path.join(RAIZ, 'data', 'referentes_dba.json'), encoding='utf-8'))['areas']

A = {'MAT': 'Matemáticas', 'LEN': 'Humanidades y Lengua Castellana', 'NAT': 'Ciencias Naturales y Educación Ambiental',
     'SOC': 'Ciencias Sociales', 'ING': 'Inglés', 'ETI': 'Educación Ética y Valores Humanos', 'REL': 'Educación Religiosa Escolar',
     'ART': 'Educación Artística (Arte y Cultura Afro)', 'EFI': 'Educación Física, Recreación y Deportes', 'TEC': 'Tecnología e Informática'}

# ---------------------------------------------------------------- DBA: etiquetas cortas (por grado y n.º de DBA)
DBA_E = {
 'MAT': {
  1: {1: 'Usos de los números y operaciones', 2: 'Conteo y problemas aditivos', 3: 'Sistema decimal y valor posicional', 4: 'Atributos medibles', 5: 'Medición con unidades e instrumentos', 6: 'Semejanzas y formas geométricas', 7: 'Trayectorias y posiciones', 8: 'Cambio y variación', 9: 'Signo igual y equivalencia', 10: 'Datos, tablas y pictogramas'},
  2: {1: 'Problemas aditivos', 2: 'Estrategias de cálculo y estimación', 3: 'Sistema decimal: comparar y ordenar', 4: 'Medición con patrones y unidades', 5: 'Propiedades geométricas de objetos', 6: 'Patrones y propiedades de operaciones', 7: 'Secuencias numéricas', 8: 'Datos: tablas, pictogramas y gráficos', 9: 'Posibilidad de eventos'},
  3: {1: 'Problemas aditivos', 2: 'Estimación y cálculo', 3: 'Comparar cantidades', 4: 'Área y perímetro', 5: 'Formas 2D y 3D', 6: 'Incógnitas y enunciados'},
  4: {1: 'Fracciones: usos', 2: 'Operaciones y estimación con naturales', 3: 'Orden y relaciones multiplicativas', 4: 'Atributos medibles', 6: 'Movimientos de figuras en el plano', 7: 'Dependencia entre cantidades', 8: 'Patrones y generalizaciones', 9: 'Interpretar y comunicar información', 10: 'Situaciones aleatorias y determinísticas'},
  5: {1: 'Naturales y fracciones', 2: 'Algoritmos y propiedades', 3: 'Comparar y ordenar fracciones', 4: 'Perímetro y área', 5: 'Cuerpos 2D y 3D', 6: 'Variación y gráficas', 7: 'Ecuaciones y operaciones no convencionales', 8: 'Analizar información y comunicar', 9: 'Media y mediana', 10: 'Probabilidad de eventos simples'},
  6: {1: 'Enteros y racionales', 2: 'Propiedades de las operaciones', 3: 'Orden y equivalencia', 4: 'Desarrollo de sólidos y medición', 5: 'Formas 2D y 3D con instrumentos', 6: 'Covariación directa e inversa', 7: 'Ecuaciones: números desconocidos', 8: 'Información estadística', 9: 'Comparar poblaciones'},
  7: {1: 'Problemas con racionales', 3: 'Relaciones y representaciones de racionales', 4: 'Escalas: planos y mapas', 6: 'Plano cartesiano y variación', 7: 'Ecuaciones y variación', 8: 'Estudios estadísticos e histogramas'},
  8: {1: 'Racionales e irracionales', 2: 'Usos de las operaciones', 3: 'Sólidos: atributos medibles', 4: 'Figuras compuestas: área y volumen', 5: 'Teoremas y propiedades geométricas', 6: 'Gráficas y expresiones algebraicas', 7: 'Álgebra: procedimientos inductivos', 8: 'Funciones y covariación', 9: 'Datos agrupados en intervalos'},
  9: {1: 'Números reales y problemas', 2: 'Expresiones algebraicas', 3: 'Procesos infinitos con reales', 4: 'Thales y Pitágoras', 5: 'Conjeturas geométricas', 8: 'Diseño estadístico', 9: 'Conteo y probabilidad'},
  10: {1: 'Propiedades de los reales', 2: 'Equivalencia y orden algebraico', 3: 'Magnitudes relacionales (velocidad)', 4: 'Movimiento en el plano cartesiano', 5: 'Lugares geométricos', 6: 'Razón de cambio', 7: 'Funciones y representaciones', 8: 'Muestras aleatorias', 9: 'Experimentos aleatorios', 10: 'Orden de los reales'},
  11: {1: 'Derivada y razón de cambio', 2: 'Derivada y pendiente de la tangente', 3: 'Coordenadas polar y esférica', 4: 'Cálculo de derivadas', 5: 'Modelación de problemas', 6: 'Eventos independientes'}},
 'LEN': {
  1: {1: 'Medios de comunicación', 2: 'Códigos no verbales', 3: 'Literatura y creatividad', 4: 'Comprensión de textos literarios', 5: 'Lectura de palabras e imágenes', 6: 'Textos orales'},
  2: {1: 'Medios masivos', 2: 'Señales y símbolos', 3: 'Literatura y vivencias', 4: 'Predicción y estructura de textos', 5: 'Expresión según el contexto', 6: 'Producción con propósito'},
  3: {1: 'Función de los medios', 2: 'Textos y manifestaciones artísticas', 3: 'Escritura literaria', 4: 'Comprensión inferencial', 5: 'Textos orales breves', 6: 'Gramática y ortografía'},
  4: {1: 'Análisis de medios', 2: 'Escritura desde imágenes y arte', 3: 'Textos poéticos y figuras', 4: 'Tono del discurso', 5: 'Exposición de conclusiones', 6: 'Discusión y adecuación', 7: 'Producción según público'},
  5: {1: 'Mensajes en imágenes y gestos', 2: 'Géneros literarios', 3: 'Intención comunicativa', 4: 'Textos orales y contexto', 5: 'Planes textuales'},
  6: {1: 'Información de los medios', 2: 'Organizadores gráficos', 3: 'Expresiones regionales en literatura', 4: 'Comprensión de tipos de texto', 5: 'Discursos orales y contexto', 6: 'Producción escrita y destinatario'},
  7: {1: 'Sistemas verbales y no verbales', 2: 'Clasificación de obras literarias', 3: 'Interpretación por tipología', 4: 'Narraciones orales', 5: 'Producción por tipología'},
  8: {1: 'Discursos en los medios', 2: 'Arte y culturas', 3: 'Género lírico', 4: 'Inferencia de sentidos', 5: 'Composición por ámbitos de uso'},
  9: {1: 'Confrontar discursos de medios', 2: 'Titulares e imágenes', 3: 'Obras y producciones audiovisuales', 4: 'Funcionamiento de la lengua', 5: 'Planes textuales', 6: 'Producción audiovisual'},
  10: {1: 'Literatura e historia', 2: 'Literatura y artes visuales', 4: 'Textos orales: ponencia y entrevista', 5: 'Corrección lingüística', 6: 'Ponencia: contenido y estructura', 7: 'Códigos verbales y no verbales'},
  11: {1: 'Selección de lecturas', 2: 'Argumentos del interlocutor', 3: 'Comparación crítica de textos', 4: 'Dominio oral de un tema', 5: 'Estructura y contextos del texto'}},
 'NAT': {
  1: {1: 'Los sentidos', 2: 'Materiales y usos', 3: 'Seres vivos: características'},
  2: {1: 'Fuerza y deformación', 2: 'Estados de la materia', 3: 'Ciclos de vida'},
  3: {1: 'Sombra, luz y distancia', 2: 'Temperatura y cambios de estado', 3: 'Relaciones entre seres vivos'},
  4: {1: 'Máquinas simples', 2: 'Fases de la Luna', 3: 'Mezclas', 4: 'Niveles tróficos', 5: 'Ecosistemas'},
  5: {1: 'Circuito eléctrico', 2: 'Conductores de corriente', 3: 'Nutrición humana'},
  6: {1: 'Carga eléctrica', 2: 'Temperatura y presión', 3: 'Clasificación de materiales', 4: 'La célula y sus funciones', 5: 'Taxonomía de organismos'},
  7: {1: 'Transformaciones de energía y sustancias', 2: 'Ciclos del carbono, nitrógeno y agua'},
  8: {1: 'Máquinas térmicas', 2: 'Reacción química', 3: 'Sistemas de órganos', 4: 'Reproducción'},
  9: {1: 'Movimiento y marco de referencia', 2: 'Acidez y basicidad', 3: 'Soluciones: solutos y solventes', 4: 'Origen de las especies'},
  10: {1: 'Fuerzas y equilibrio', 2: 'Conservación de la energía', 3: 'Mecanismos de reacción', 4: 'Biotecnología'},
  11: {1: 'Ondas: sonido y luz', 2: 'Fuerzas eléctricas', 3: 'Corriente y voltaje', 4: 'Reacciones orgánicas', 5: 'Cuestiones ambientales'}},
 'ING': {
  0: {1: 'Vocabulario del entorno', 2: 'Datos personales (preguntas)', 3: 'Instrucciones escolares básicas', 4: 'Declaraciones sencillas'},
  1: {1: 'Secuencia de una historia corta', 2: 'Información personal básica', 3: 'Ideas con palabras y frases', 4: 'Contar una historia corta'},
  2: {1: 'Intercambio de información personal', 2: 'Detalles en textos cortos', 3: 'Preguntas sobre textos descriptivos', 4: 'Ideas y opiniones sencillas', 5: 'Descripción oral y escrita'},
  3: {1: 'Idea general en texto informativo', 2: 'Preguntas qué, quién y cuándo'},
  4: {1: 'Opiniones sencillas', 2: 'Texto narrativo corto'},
  5: {1: 'Hábitos, gustos y preferencias'}},
}

# Inglés 6° a 11° (extraído del PDF «DBA Inglés de 6° a 11°»: extracción PARCIAL; la numeración oficial puede diferir)
ING_611 = {
 6: ['Conversación corta: datos personales', 'Palabras y frases sobre rutinas y gustos', 'Instrucciones de clase y comunidad', 'Aclaraciones y deletreo', 'Formatos con información personal', 'Preguntas qué, quién y cuándo', 'Tema general de un texto corto', 'Conversar sobre sí mismo y su entorno', 'Textos cortos: acciones y planes'],
 7: ['Descripción oral de personas y eventos', 'Idea principal en texto descriptivo', 'Información específica (habla pausada)', 'Describir acciones con imágenes', 'Dar y recibir instrucciones', 'Experiencias y planes', 'Estrategias de lectura'],
 8: ['Explicar por escrito hechos familiares', 'Intercambio de información académica', 'Emociones y razones', 'Exposiciones breves', 'Narrar hechos y experiencias'],
 9: ['Explicar planes y acciones', 'Resumir lo leído o escuchado', 'Causa y efecto en lecturas', 'Propósito, partes y tipo de texto', 'Opinión citando fuentes', 'Intercambio de información con apuntes', 'Recomendaciones y sugerencias escritas', 'Textos narrativos, descriptivos y expositivos', 'Explicar ideas con inferencias'],
 10: ['Cartas y correos estructurados', 'Intercambio de opiniones', 'Responder preguntas tras una exposición'],
 11: ['Propósito de textos orales y escritos', 'Opinión del autor', 'Textos argumentativos', 'Posición según destinatario y tono', 'Punto de vista en tema controversial', 'Narrar experiencias e historias', 'Discusiones formales preparadas'],
}

# Ciencias Sociales: DBA V1 (PDF gráfico; extracción PARCIAL de los enunciados por grado). Etiquetas cortas.
SOC_DBA = {
 1: ['Ubicación en el espacio', 'Paisaje y sus características', 'Tiempo personal', 'Individualidad y pertenencia', 'Noción de cambio', 'Acuerdos de convivencia', 'Cambios en las formas de vida', 'Relaciones de convivencia'],
 2: ['Paisaje natural y cultural', 'Fuentes históricas', 'Puntos cardinales', 'Actividades económicas', 'Cambios y continuidades', 'Viviendas y culturas', 'Organización territorial', 'Rechazo a la exclusión', 'Características biogeográficas', 'Normas del grupo', 'Océanos y recursos'],
 3: ['Acciones humanas y ambiente', 'Legado de grupos humanos', 'Contribuciones de los grupos', 'Tiempo y fuentes', 'Participación ciudadana', 'Estructura del gobierno', 'Geografía de las regiones', 'Límites y fronteras'],
 4: ['Cambios en el poblamiento', 'Culturas prehispánicas', 'División de poderes', 'Diversidad étnica y cultural', 'Derechos de la niñez', 'Necesidades básicas', 'Ventajas de la organización', 'Organización territorial'],
 5: ['Cambios en la sociedad', 'Periodo colonial', 'Cambios sociales', 'Origen y consolidación de Colombia', 'Diversidad en la sociedad colombiana', 'Organizaciones sociales', 'La Tierra como planeta', 'Explicaciones del origen'],
 6: ['Proceso de hominización', 'Poder en sociedades antiguas', 'Legados de sociedades antiguas', 'Formas de gobierno', 'Escenario político antiguo', 'Representaciones del mundo'],
 7: ['Imperio romano', 'Crecimiento y sociedades', 'Renacimiento', 'Edad Media', 'Causas y consecuencias históricas'],
 8: ['Cooperación entre Estados', 'Migraciones', 'Expansión territorial y capitalismo', 'Cambios sociales y económicos (siglo XIX)', 'Procesos de independencia y Estados', 'Avances científicos y tecnológicos', 'Hechos trascendentales'],
 9: ['Consecuencias de las guerras', 'Situación ambiental', 'Cambios sociales y políticos', 'Crisis económicas', 'Sociedades democráticas', 'Papel de las mujeres', 'Crecimiento y sociedad', 'Solución de conflictos'],
 10: ['Causas y consecuencias de conflictos', 'Conflictos y negociación', 'Organismos internacionales', 'Diversidad cultural', 'Conflictos bélicos', 'Solución negociada', 'Bienestar y supervivencia'],
 11: ['Consecuencias políticas y económicas', 'Implicaciones sociales', 'Globalización'],
}

# DBA transición (16): por propósito  (texto del PDF «DBA Transición V1»)
TRANS = [
 ('Propósito 1', ['Toma decisiones en lo cotidiano', 'Hábitos de cuidado personal y del entorno', 'Características corporales y emocionales', 'Familia, comunidad y territorio', 'Acuerdos y proyectos colectivos', 'Consideración y respeto']),
 ('Propósito 2', ['Expresa y representa (juego, música, dibujo, cuerpo)', 'Relaciones sonoras en el lenguaje oral', 'Imágenes, letras y textos', 'Grafías propias para comunicar']),
 ('Propósito 3', ['Crea situaciones y alternativas de solución', 'Causas y consecuencias', 'Herramientas y objetos', 'Espacio, tiempo y medida', 'Compara, ordena, clasifica y patrones', 'Cantidad y colecciones']),
]

# ---------------------------------------------------------------- Estándares / orientaciones por grupo de grados
BANDAS = {'1-3': (1, 2, 3), '4-5': (4, 5), '6-7': (6, 7), '8-9': (8, 9), '10-11': (10, 11)}
def banda(g):
    for b, gs in BANDAS.items():
        if g in gs: return b

EBC = {
 'MAT': {  # EBC de Matemáticas (MEN, 2006): pensamientos y procesos. Citado de memoria: verificar.
  '1-3': ['Numérico: números hasta 1000 y valor posicional', 'Numérico: suma, resta y multiplicación inicial', 'Espacial: figuras, sólidos y ubicación', 'Métrico: longitud, tiempo, peso', 'Aleatorio: datos y pictogramas', 'Variacional: patrones y secuencias'],
  '4-5': ['Numérico: fracciones y decimales', 'Numérico: multiplicación y división', 'Espacial: ángulos, simetrías y transformaciones', 'Métrico: área y volumen', 'Aleatorio: gráficas y promedio', 'Variacional: proporcionalidad y ecuaciones simples'],
  '6-7': ['Numérico: enteros y racionales', 'Numérico: razones y proporciones', 'Espacial: poliedros y sólidos', 'Métrico: magnitudes y escalas', 'Aleatorio: frecuencias, moda y mediana', 'Variacional: funciones lineales'],
  '8-9': ['Numérico: reales y notación científica', 'Espacial: congruencia, Thales y Pitágoras', 'Métrico: área y volumen de sólidos', 'Aleatorio: muestras y probabilidad', 'Variacional: ecuaciones, sistemas y funciones'],
  '10-11': ['Numérico: reales, sucesiones y límites', 'Espacial: geometría analítica y cónicas', 'Espacial: trigonometría', 'Aleatorio: probabilidad e inferencia', 'Variacional: funciones, derivada y razón de cambio'],
  'todas': ['Proceso: resolución de problemas', 'Proceso: razonamiento', 'Proceso: comunicación y representación', 'Proceso: modelación', 'Proceso: ejercitación de procedimientos']},
 'LEN': {  # EBC de Lenguaje (factores). Verificado en el documento los de 8°-9°; el resto citado de memoria.
  '1-3': ['Producción: escribir con propósito', 'Comprensión: leer y comentar textos', 'Literatura: cuentos, poemas y rondas', 'Medios: imágenes y símbolos', 'Ética de la comunicación: escuchar y turnos'],
  '4-5': ['Producción: plan y revisión del texto', 'Comprensión: inferir y resumir', 'Literatura: géneros y figuras', 'Medios: publicidad y noticias', 'Ética de la comunicación: respeto al interlocutor'],
  '6-7': ['Producción: textos descriptivos y explicativos', 'Comprensión: tipologías y estrategias de lectura', 'Literatura: mito, leyenda y narrativa', 'Medios: prensa, radio y TV', 'Ética de la comunicación: argumentar con respeto'],
  '8-9': ['Producción: plan textual y texto explicativo', 'Producción: coherencia, cohesión y reescritura', 'Comprensión: interpretación y estrategias', 'Literatura: géneros y contexto', 'Medios: análisis de discursos', 'Ética de la comunicación: argumentación y acuerdos'],
  '10-11': ['Producción: ensayo y texto argumentativo', 'Comprensión: lectura crítica', 'Literatura: movimientos y autores', 'Medios: medios y sociedad', 'Ética de la comunicación: debate y ponencia']},
 'NAT': {  # EBC de Ciencias (2004). Citado de memoria: verificar.
  '1-3': ['Entorno vivo: seres vivos y su ciclo', 'Entorno vivo: cuerpo humano y cuidado', 'Entorno físico: materiales, luz y sonido', 'Ciencia y tecnología: objetos y ambiente'],
  '4-5': ['Entorno vivo: ecosistemas y cadenas tróficas', 'Entorno vivo: funciones vitales', 'Entorno físico: mezclas y estados', 'Entorno físico: circuitos y energía', 'Entorno físico: Tierra y sistema solar'],
  '6-7': ['Entorno vivo: célula y clasificación', 'Entorno vivo: ecosistemas y energía', 'Entorno físico: propiedades de la materia', 'Entorno físico: fuerzas y movimiento'],
  '8-9': ['Entorno vivo: reproducción, herencia y evolución', 'Entorno físico: reacciones y tabla periódica', 'Entorno físico: fuerzas, ondas y electricidad'],
  '10-11': ['Entorno vivo: biotecnología', 'Entorno físico: química: estequiometría y orgánica', 'Entorno físico: cinemática, dinámica y ondas', 'Ciencia, tecnología y sociedad: ambiente'],
  'todas': ['Me aproximo como científico: observar y preguntar', 'Me aproximo como científico: hipótesis y registro', 'Me aproximo como científico: comunicar resultados', 'Compromisos personales y sociales']},
 'SOC': {  # EBC de Ciencias Sociales (2004). Citado de memoria: verificar.
  '1-3': ['Historia: mi historia y mi comunidad', 'Espacio: ubicación y puntos cardinales', 'Ético-político: normas y deberes'],
  '4-5': ['Historia: primeras civilizaciones y poblamiento', 'Espacio: regiones de Colombia', 'Ético-político: Constitución y derechos'],
  '6-7': ['Historia: sociedades antiguas y medievales', 'Espacio: geografía física y humana', 'Ético-político: organización política'],
  '8-9': ['Historia: revoluciones y siglo XIX', 'Espacio: geografía humana y economía', 'Ético-político: derechos humanos y democracia'],
  '10-11': ['Historia: siglo XX y Colombia contemporánea', 'Espacio: globalización y economía', 'Ético-político: Constitución de 1991, conflicto y paz']},
 'ING': {  # Guía 22 (Estándares básicos de competencias en lenguas extranjeras: inglés). Citado de memoria.
  '1-3': ['Nivel A1: escucha', 'Nivel A1: lectura', 'Nivel A1: escritura', 'Nivel A1: monólogo', 'Nivel A1: conversación'],
  '4-5': ['Nivel A2: escucha', 'Nivel A2: lectura', 'Nivel A2: escritura', 'Nivel A2: monólogo', 'Nivel A2: conversación'],
  '6-7': ['Nivel A2+: escucha', 'Nivel A2+: lectura', 'Nivel A2+: escritura', 'Nivel A2+: monólogo', 'Nivel A2+: conversación'],
  '8-9': ['Nivel B1: escucha', 'Nivel B1: lectura', 'Nivel B1: escritura', 'Nivel B1: monólogo', 'Nivel B1: conversación'],
  '10-11': ['Nivel B1+: escucha', 'Nivel B1+: lectura', 'Nivel B1+: escritura', 'Nivel B1+: monólogo', 'Nivel B1+: conversación'],
  'todas': ['Vocabulario y gramática del nivel', 'Pronunciación y fluidez']},
 'ETI': {  # Competencias ciudadanas (EBC, 2004) + Lineamientos de Ética y Valores Humanos (documento cargado).
  '1-3': ['Convivencia y paz: reglas y acuerdos', 'Participación: normas del grupo', 'Pluralidad: respeto a la diferencia', 'Autoconocimiento y emociones'],
  '4-5': ['Convivencia y paz: manejo de conflictos', 'Participación: representación y voto', 'Pluralidad: identidad y diferencias', 'Autorregulación'],
  '6-7': ['Convivencia y paz: mediación y diálogo', 'Participación: derechos y deberes', 'Pluralidad: discriminación y prejuicios', 'Conciencia y valoración de sí mismo'],
  '8-9': ['Convivencia y paz: conflictos y violencia', 'Participación: democracia y control', 'Pluralidad: derechos humanos', 'Autorrealización y proyecto de vida'],
  '10-11': ['Convivencia y paz: justicia y paz', 'Participación: política y ciudadanía', 'Pluralidad: dignidad y equidad', 'Competencias dialógicas y comunicativas'],
  'todas': ['Toma de decisiones éticas', 'Responsabilidad y compromiso social']},
 'ART': {  # Orientaciones pedagógicas para la educación artística (MEN, 2010): sensibilidad, apreciación estética, comunicación.
  '1-3': ['Sensibilidad: exploración de sonidos, colores y formas', 'Apreciación: observar y comentar obras', 'Comunicación: dibujo, canto y juego dramático'],
  '4-5': ['Sensibilidad: percepción y emociones', 'Apreciación: obras y artistas de la región', 'Comunicación: música, danza y plástica'],
  '6-7': ['Sensibilidad: identidad y cultura', 'Apreciación: lenguajes artísticos', 'Comunicación: proyectos de expresión'],
  '8-9': ['Sensibilidad: expresión personal', 'Apreciación: crítica y contexto', 'Comunicación: producción y montaje'],
  '10-11': ['Sensibilidad: sentido estético', 'Apreciación: arte y sociedad', 'Comunicación: proyecto artístico'],
  'todas': ['Cultura afrocolombiana y del Pacífico: música y danza', 'Artes plásticas y visuales', 'Música', 'Danza y expresión corporal', 'Teatro y expresión dramática']},
 'EFI': {  # Orientaciones pedagógicas para la educación física, recreación y deporte (MEN, 2010): competencias motriz, expresiva corporal, axiológica corporal.
  '1-3': ['Motriz: habilidades básicas (correr, saltar, lanzar)', 'Motriz: coordinación y lateralidad', 'Expresiva corporal: juego y ritmo', 'Axiológica: normas y cuidado de sí'],
  '4-5': ['Motriz: coordinación y destrezas', 'Motriz: juegos pre-deportivos', 'Expresiva corporal: danza y expresión', 'Axiológica: juego limpio y cooperación'],
  '6-7': ['Motriz: fundamentos del deporte', 'Condición física y salud', 'Expresiva corporal: ritmo y creación', 'Axiológica: respeto y liderazgo'],
  '8-9': ['Motriz: deportes de conjunto y táctica', 'Condición física: capacidades y hábitos', 'Expresiva corporal: coreografía', 'Axiológica: ética deportiva'],
  '10-11': ['Motriz: especialización y competencia', 'Condición física: planificación y salud', 'Expresiva corporal: proyectos', 'Axiológica: organización y liderazgo'],
  'todas': ['Recreación y tiempo libre', 'Hábitos de vida saludable']},
 'TEC': {  # Orientaciones generales para la educación en tecnología (Guía 30, MEN 2008) + pensamiento computacional (propuesta).
  '1-3': ['Naturaleza: objetos naturales y artificiales', 'Apropiación y uso: herramientas y seguridad', 'Solución de problemas: dibujar y armar', 'Pensamiento computacional: secuencias y órdenes', 'Tecnología y sociedad: uso responsable'],
  '4-5': ['Naturaleza: evolución de los artefactos', 'Apropiación y uso: computador e internet', 'Solución de problemas: diseño y prototipo', 'Pensamiento computacional: patrones y algoritmos', 'Tecnología y sociedad: ambiente'],
  '6-7': ['Naturaleza: tecnología e historia', 'Apropiación y uso: ofimática', 'Solución de problemas: diseño y prueba', 'Pensamiento computacional: programación por bloques', 'Tecnología y sociedad: ciudadanía digital'],
  '8-9': ['Naturaleza: procesos productivos', 'Apropiación y uso: herramientas digitales', 'Solución de problemas: electrónica y robótica básica', 'Pensamiento computacional: variables, ciclos y condicionales', 'Tecnología y sociedad: impacto y ética'],
  '10-11': ['Naturaleza: sistemas tecnológicos', 'Apropiación y uso: gestión de información', 'Solución de problemas: proyecto tecnológico', 'Pensamiento computacional: programación y datos', 'Tecnología y sociedad: innovación y emprendimiento']},
}

# Educación Religiosa Escolar: Estándares ERE 2022 (Conferencia Episcopal de Colombia): tema del grado y temas (documento cargado)
ERE = {
 1: ('La vida', ['La vida y sus manifestaciones', 'Dignidad de la vida humana', 'Cuidado de la vida y de la casa común', 'Convivir', 'Dios creador y dador de vida']),
 2: ('La amistad', ['La amistad como encuentro con el otro', 'Características de la amistad', 'Valor de cada persona', 'Perdón y reconciliación', 'Amistad con Dios']),
 3: ('La celebración', ['Celebrar los acontecimientos significativos', 'Tipos de fiestas', 'Celebraciones familiares y sociales', 'Fiestas de otras culturas', 'Fiestas religiosas de Israel']),
 4: ('La vocación', ['El ser humano y su misión', 'Toma de decisiones', 'Felicidad y sentido de la vida', 'Vocación y servicio', 'Dios llama']),
 5: ('El testimonio', ['Testimonio y confianza', 'Autenticidad y coherencia de vida', 'Testigos y solución pacífica de conflictos', 'Defensores de los derechos humanos', 'Testimonio del pueblo de Israel']),
 6: ('La persona humana', ['Naturaleza del ser humano', 'Igualdad fundamental de la persona', 'Dimensión trascendente y religiosa', 'Derechos humanos', 'Dignidad de la persona en las religiones']),
 7: ('La familia', ['Ser social llamado a vivir en familia', 'La familia y el amor', 'Corresponsabilidad y autoridad', 'Desafíos de la familia actual', 'Matrimonio y familia']),
 8: ('La comunidad', ['Diferencia entre grupo y comunidad', 'Dimensión comunitaria del ser humano', 'Bien común y convivencia social', 'Amenazas: corrupción y violencia', 'Globalización y casa común', 'Comunidad como pueblo de Dios']),
 9: ('La moral', ['Dimensión ética de la persona', 'Responsabilidad y praxis humana', 'La ética en las religiones', 'Jesús, fundamento de la moral cristiana', 'Pecado personal y social']),
 10: ('El proyecto de vida', ['Valor y sentido de la vida', 'Estructurar un proyecto de vida', 'Autoestima y virtud personal', 'Emprendimiento y liderazgo juvenil', 'Experiencia religiosa y sentido de la vida']),
 11: ('Construcción de una nueva sociedad', ['Desafíos económicos, culturales y ecológicos', 'Modelos de sociedad y ética', 'Derechos y deberes humanos', 'Bien común y participación', 'Orientación vocacional y profesional']),
}

# Preescolar: experiencias (incluye experiencia tecnológica y de pensamiento computacional: PROPUESTA del sistema, no del DBA)
EXPERIENCIAS = [
 ('Juego y exploración con objetos y herramientas', 'DBA 13'),
 ('Arma, desarma y construye (experiencia tecnológica)', 'propuesta'),
 ('Secuencias y patrones con objetos (pensamiento computacional)', 'propuesta'),
 ('Instrucciones paso a paso: juegos de ruta y «robot humano»', 'propuesta'),
 ('Programación sin pantalla: tarjetas de flechas y órdenes', 'propuesta'),
 ('Resolución de problemas cotidianos', 'DBA 11'),
 ('Expresión artística: música, dibujo, danza y teatro', 'DBA 7'),
 ('Literatura, rondas y juegos de palabras', 'DBA 8-10'),
 ('Juego simbólico y de roles', 'DBA 7'),
 ('Exploración del medio natural y cuidado del entorno', 'DBA 2, 12'),
 ('Medida, espacio y tiempo en la vida diaria', 'DBA 14'),
]

# ---------------------------------------------------------------- construcción
def dba_texto(area_nombre, g, n):
    for x in dba.get(area_nombre, {}).get(str(g), []):
        if x['n'] == n: return x['t']
    return ''

banco = {'areas': {}}
for cod, nombre in A.items():
    por_grado = {}
    for g in range(0, 12):
        L = []
        if cod in DBA_E and g in DBA_E[cod]:
            for n, e in sorted(DBA_E[cod][g].items()):
                L.append({'k': 'DBA', 'c': 'DBA %d-%d' % (g, n) if g else 'DBA T-%d' % n, 'e': e, 't': dba_texto(nombre, g, n)})
        if cod == 'ING' and g in ING_611:
            for i, e in enumerate(ING_611[g], 1):
                L.append({'k': 'DBA', 'c': 'DBA %d·%d' % (g, i), 'e': e, 't': '', 'v': 'p'})
        if cod == 'SOC' and g in SOC_DBA:
            for i, e in enumerate(SOC_DBA[g], 1):
                L.append({'k': 'DBA', 'c': 'DBA %d·%d' % (g, i), 'e': e, 't': '', 'v': 'p'})
        if cod == 'REL' and g in ERE:
            tema, items = ERE[g]
            L.append({'k': 'ERE', 'c': 'ERE %d' % g, 'e': 'Tema del grado: ' + tema, 't': ''})
            for i, e in enumerate(items, 1):
                L.append({'k': 'ERE', 'c': 'ERE %d·%d' % (g, i), 'e': e, 't': ''})
        if g >= 1 and cod in EBC:
            b = banda(g)
            nom_k = {'ING': 'GUIA22', 'ART': 'ORI', 'EFI': 'ORI', 'TEC': 'ORI'}.get(cod, 'EBC')
            for i, e in enumerate(EBC[cod].get(b, []), 1):
                L.append({'k': nom_k, 'c': '%s %s·%d' % (nom_k, b, i), 'e': e, 't': '', 'v': 'm'})
            for i, e in enumerate(EBC[cod].get('todas', []), 1):
                L.append({'k': nom_k, 'c': '%s gral·%d' % (nom_k, i), 'e': e, 't': '', 'v': 'm'})
        if L: por_grado[str(g)] = L
    banco['areas'][nombre] = por_grado

# transición
banco['transicion'] = {
 'dba': [{'propósito': p, 'items': [{'c': 'DBA T-%d' % (sum(len(x[1]) for x in TRANS[:i]) + j + 1), 'e': e} for j, e in enumerate(its)]} for i, (p, its) in enumerate(TRANS)],
 'experiencias': [{'e': e, 'f': f} for e, f in EXPERIENCIAS],
}
banco['fuentes'] = {
 'DBA': 'Derechos Básicos de Aprendizaje, MEN (Colombia Aprende). Matemáticas, Lenguaje y Ciencias Naturales: extraídos de los PDF. Inglés 6°–11° y Ciencias Sociales: extracción parcial de los PDF (verificar). Transición: PDF «DBA Transición V1».',
 'EBC': 'Estándares Básicos de Competencias en Lenguaje, Matemáticas, Ciencias y Ciudadanas (MEN, 2006): los de Lenguaje 8°–9° se verificaron en el documento cargado; el resto se cita de memoria (verificar).',
 'GUIA22': 'Estándares básicos de competencias en lenguas extranjeras: inglés (Guía 22): citado de memoria (verificar).',
 'ORI': 'Orientaciones pedagógicas de Educación Artística y de Educación Física (MEN, 2010) y Orientaciones generales para la educación en tecnología (Guía 30, MEN 2008): citado de memoria. Pensamiento computacional: propuesta del sistema.',
 'ERE': 'Estándares para la Educación Religiosa Escolar 2022 (Conferencia Episcopal de Colombia), documento cargado por el coordinador.',
 'ETICA': 'Lineamientos curriculares de Educación Ética y Valores Humanos (MEN) y Competencias ciudadanas (EBC): documento cargado.',
}
banco['nota'] = 'Etiquetas CORTAS para recomendaciones; v: p=extracción parcial, m=citado de memoria (verificar). Sin datos personales.'
salida = os.path.join(RAIZ, 'data', 'referentes_etiquetas.json')
json.dump(banco, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = sum(len(v) for a in banco['areas'].values() for v in a.values())
print('Banco generado:', salida, '·', n, 'etiquetas')
for a, v in banco['areas'].items():
    print(' ', a, {g: len(x) for g, x in v.items() if g in ('1', '5', '8', '11')})
