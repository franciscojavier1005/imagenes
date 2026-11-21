# Referentes de calidad (DBA y estándares)
`extraer_dba_pdf.py` extrae los enunciados de los DBA desde los PDF oficiales de Colombia Aprende (Ministerio de Educación Nacional):
Matemáticas, Lenguaje y Ciencias Naturales. Genera `data/referentes_dba.json`, que usa la aplicación de comisiones.
Los PDF no se versionan; se descargan de https://colombiaaprende.edu.co/contenidos/coleccion/derechos-basicos-de-aprendizaje
Los Estándares Básicos de Competencias (EBC) están en https://www.mineducacion.gov.co/1621/article-116042.html.
Ciencias Sociales (PDF gráfico) e Inglés de secundaria quedan pendientes. Revisar siempre contra el documento original.
Autoría del sistema: Francisco Javier Cortés Cabezas · I.E. ICET, Tumaco.

## Banco de etiquetas cortas (referentes de calidad)
`construir_banco.py` genera `data/referentes_etiquetas.json`: etiquetas **cortas** por área y grado (transición a 11°) para las recomendaciones de la comisión de evaluación y promoción: DBA, estándares básicos de competencias (EBC), estándares de inglés (Guía 22), orientaciones pedagógicas (artística, educación física, tecnología), estándares de ERE 2022 y, en transición, DBA por propósito y **experiencias** (con una propuesta de experiencias de pensamiento computacional y tecnológicas). Cada etiqueta indica su procedencia (`v`: `p` extracción parcial del PDF, `m` citado de memoria: verificar). Fuentes leídas desde la carpeta de Drive del coordinador (DBA Transición, Inglés 6°–11°, Sociales V1, EBC, Estándares ERE 2022, Lineamientos de Ética).
Autoría: Francisco Javier Cortés Cabezas · Coordinador académico, I.E. ICET.
