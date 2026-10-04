# Validación de la extracción (horarios ICET 2026)

Fuente: 5 PDF por docente (`ASIG_ACAD_DOC-1..5`), 5 PDF por grupo (`EST-AREAS`) y el Word de asistencia (57 docentes).

| Verificación | Resultado |
|---|---|
| Docentes de secundaria con horario | 38 (6 + 8 + 8 + 8 + 8) |
| Grupos | 18 (14 regulares + CS 1-1, CS 1-2, CS 2-1, CS 2-2) |
| Filas de horario (sesiones de 45 min) | 1.024 (576 de clase + 448 de énfasis) |
| Sesiones por docente | 24 a 28, coincide con "24/26/28 SECCIONES" de cada PDF |
| Choques de docente (dos lugares a la vez) | 0 |
| Choques de grupo (dos docentes a la vez) | 0 |
| Cruce PDF por grupo vs PDF por docente | 576 de 576 celdas de clase coinciden |

Se reproduce con `python3 scripts/construir_datos.py && python3 scripts/validar.py`.

## Confirmado por el coordinador

- "CUELLAR MARIA" del PDF es **García Gobea, Saydi Magali** (#20), Sociales e Inglés de D1.
- **Betancourth Ocampo, Yohana Patricia** (#6) es correcta para "BETANCOURT JOHANA".
- "ETI/REL" del PDF equivale a ETR (Ética y Religión).
- Sociales e Inglés (CSI) y Ética y Religión (ETR) alternan sus dos áreas cada semana por decisión del rector.

## Énfasis (448 sesiones), resueltos con los PDF por grupo

- Cada curso tiene 8 sesiones de énfasis (PDF por grupo: `ENFASIS-Dn` = pool de docentes). Las 144 celdas de énfasis de los PDF por grupo coinciden con las franjas de los docentes.
- Los énfasis de grado (`D3-8°`, `D5-10°`, `D5-11°`) se asignan al curso del grado que tiene énfasis en esa franja.
- Equipos: 160 sesiones con **pareja** (alternan por semana) y 288 con **equipo de 4** (D3-8°, D4, D5).

## Cambios confirmados por el coordinador (oct-2026)

- **Orientadoras** (sin grupo, todos los niveles), confirmadas por el coordinador: Casanova Casanova Johana Andrea 7:30 a 14:30 y Ponce Moncayo Ángela Paola 8:30 a 13:30 (a veces llega más tarde o se queda más). Se registran por cada sesión de 45 min que se traslape con su jornada; lo posterior a las 13:30 no tiene sesión de clase.
- **Tutora PTAFI** (Todos a Aprender - Formación Integral): Ortiz Estacio Martha Cecilia, transitoria, apoya preescolar y primaria. Jornada de primaria (6:30 a 12:00), confirmada por el coordinador.
- **Armero Dájome Jesús** (OPS) reemplaza a **Terán Guevara Jorge Alberto**: atiende todo su horario (Educación Física, Docente 2). Terán queda como "REEMPLAZADO".
- **Cambio del rector en Arte:** Prado Genís Maribel atiende ahora el horario de Docente 1 (antes de Puches Ana Milena: sexto y Caminar 1) y Puches el de Docente 2 (séptimo). Se interpretó como un intercambio. Prado reemplaza a la docente Luz María Cortés Tenorio.
- **Énfasis:** en cada énfasis se muestra el área de cada docente. Los equipos de 4 (octavo a once, CS 2-1, CS 2-2) tienen un grupo de estudiantes por docente, en su área. La alternancia semanal de las parejas no se rastrea: la controla el coordinador internamente.
- **Primaria y preescolar:** 5°-3 Narváez y 5°-4 Escobar (el PDF de marzo decía lo contrario).

## Preescolar y primaria (áreas múltiples) y dirección de grupo

Fuente oficial: `fuentes/…DIRECCIÓN_DE_GRUPO_ICET_2026.pdf` (publicaciones del 3 y 10 de marzo de 2026).

- 15 grupos con su dinamizadora: 2 de preescolar (0°-1, 0°-2) y 13 de primaria. Se modelan como **ÁREAS MÚLTIPLES**, lunes a viernes: primaria en las sesiones 1 a 6 (6:30 a 11:40) y preescolar en las sesiones 2 a 6 (7:30 a 11:30).
- Modalidad "extra edad": 3°-2 Procesos Básicos; 5°-3 y 5°-4 Aceleración del Aprendizaje.
- Bachillerato: dirección **dual**, ambos docentes son responsables (sin titular ni suplente). Miriam Lemos Guancha y César Marino Pulgarín no tienen grupo asignado.
- Los 51 nombres del PDF se cruzaron con el Word sin ambigüedad; solo hay diferencias de escritura (Landázury/Landázuri, Nemecia/Nemesia, Concepción/Ascención, Govea/Gobea, Seneida/Zeneida).
- Armero Dájome Jesús dirige 6°-2 y atiende el horario de Terán.

## Verificaciones de la base de datos (`ICET_Base_Datos_2026.xlsx`, hoja `Controles`)

- Los 33 grupos tienen todas sus sesiones cubiertas: 40 en bachillerato, 30 en primaria y 25 en preescolar. Esto confirma que los énfasis quedaron bien reconstruidos.
- Sin docentes en dos sitios a la vez ni dos docentes de clase con el mismo grupo.
- **Errata en el PDF de asignación:** Valencia Saidy, Meza Gladys y González Jimy dicen "26 SECCIONES" en el título, pero su cuadrícula tiene 28 sesiones y coincide con los PDF por grupo.

## Justificaciones

Catálogo en `data/motivos.csv` (15 motivos en 8 categorías). Parte de los motivos reales del formulario de ausentismo e incorpora los pedidos: evento de la Secretaría de Educación, tema académico del docente, salud de hijo(a) o familiar y tema académico de hijo(a) (dentro de calamidad doméstica).

## Pruebas realizadas

- Hoja `Ronda`: fórmulas evaluadas con un motor de cálculo en Python (martes, sesión 1: 34 docentes, 23 grupos). La detección de sesión se probó en 15 horas, con descansos y fuera de jornada. No se pudo probar en Excel ni en Google Sheets.
- Aplicación web `Consulta.html`: probada en un navegador con tamaño de celular y un servidor simulado (marcar, justificar, tarde con minutos, guardar, cambiar de sesión). El Apps Script solo se revisó en sintaxis; no se ha ejecutado en Google.

## Pruebas del tablero y la bandeja

- Cálculo del panel: 55 comprobaciones contra un cálculo independiente en Python (incluye filtros por nivel y por docente).
- Servidor (roles, acceso, informe diario): 20 comprobaciones con las hojas reales del libro y servicios de Google simulados.
- Bandeja de WhatsApp, "Reportado hoy" y ronda: 10 comprobaciones; importador de chats: 12 comprobaciones con datos ficticios.
- Plazos de soportes: 14 comprobaciones contra un cálculo independiente en Python (rachas, fines de semana, 3 o 5 días, estados).
- Acceso, registro, carga y revisión de soportes: 45 comprobaciones con hojas y Drive simulados (matriz de permisos, un docente no ve a otro, validaciones del archivo, la aceptación corrige la novedad).
- Front y back: 14 comprobaciones (secreto, correo verificado, errores, el back no sirve pantallas).
- Observaciones de la ronda: analizador (`Notas.gs`) con 30 frases ficticias coincidiendo con el importador de Python (tipo, motivo, docentes) y pruebas de grupo, sesión y deducción por horario; servidor (`NotasRonda.gs`): guardar, proponer, confirmar/descartar, sin duplicados, audio privado, purga y permisos. Pantalla probada con Chromium y micrófono simulado. Transcripción local probada con voz sintética en español (faster-whisper): "8-1" sale como "8 uno" y los nombres con errores de ortografía bajan la confianza, por eso siempre se confirma a mano.
- Excel de ubicación: 5 escenarios (ahora, otra fecha con bloque, fecha sin elegir, descanso, fin de semana) evaluados con un motor de cálculo en Python; no se probó en Excel ni en Google Sheets.

## Pendientes

1. Correos de directivos (temporales por ahora) y de docentes (se dejan vacíos por decisión del coordinador).
2. Fase siguiente: informe para cada docente y carga virtual de soportes (ver README).
