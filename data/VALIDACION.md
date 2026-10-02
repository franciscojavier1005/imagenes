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

## Preescolar y primaria (áreas múltiples) y dirección de grupo

Fuente oficial: `fuentes/…DIRECCIÓN_DE_GRUPO_ICET_2026.pdf` (publicaciones del 3 y 10 de marzo de 2026).

- 15 grupos con su dinamizadora: 2 de preescolar (0°-1, 0°-2) y 13 de primaria. Se modelan como **ÁREAS MÚLTIPLES**, lunes a viernes: primaria en las sesiones 1 a 6 (6:30 a 11:40) y preescolar en las sesiones 2 a 6 (7:30 a 11:30).
- Modalidad "extra edad": 3°-2 Procesos Básicos; 5°-3 y 5°-4 Aceleración del Aprendizaje.
- Bachillerato: dirección **dual**, ambos docentes son responsables (sin titular ni suplente). Miriam Lemos Guancha y César Marino Pulgarín no tienen grupo asignado.
- Los 51 nombres del PDF se cruzaron con el Word sin ambigüedad; solo hay diferencias de escritura (Landázury/Landázuri, Nemecia/Nemesia, Concepción/Ascención, Govea/Gobea, Seneida/Zeneida).
- **Confirmado por el coordinador:** Escobar dirige 5°-4 y Narváez 5°-3 (el PDF de marzo decía lo contrario, pero los registros de jul-ago y el coordinador lo confirman).
- Sin nivel definido (3): Casanova Casanova Johana Andrea, Ponce Moncayo Ángela Paola, Ortiz Estacio Martha Cecilia.
- Armero Dájome Jesús dirige 6°-2 (secundaria) pero no tiene horario en los PDF de asignación.

## Verificaciones de la base de datos (`ICET_Base_Datos_2026.xlsx`, hoja `Controles`)

- Los 33 grupos tienen todas sus sesiones cubiertas: 40 en bachillerato, 30 en primaria y 25 en preescolar. Esto confirma que los énfasis quedaron bien reconstruidos.
- Sin docentes en dos sitios a la vez ni dos docentes de clase con el mismo grupo.
- **Errata en el PDF de asignación:** Valencia Saidy, Meza Gladys y González Jimy dicen "26 SECCIONES" en el título, pero su cuadrícula tiene 28 sesiones y coincide con los PDF por grupo.

## Justificaciones

Catálogo en `data/motivos.csv` (15 motivos en 8 categorías). Parte de los motivos reales del formulario de ausentismo e incorpora los pedidos: evento de la Secretaría de Educación, tema académico del docente, salud de hijo(a) o familiar y tema académico de hijo(a) (dentro de calamidad doméstica).

## Pruebas realizadas

- Hoja `Ronda`: fórmulas evaluadas con un motor de cálculo en Python (martes, sesión 1: 34 docentes, 23 grupos). La detección de sesión se probó en 15 horas, con descansos y fuera de jornada. No se pudo probar en Excel ni en Google Sheets.
- Aplicación web `Consulta.html`: probada en un navegador con tamaño de celular y un servidor simulado (marcar, justificar, tarde con minutos, guardar, cambiar de sesión). El Apps Script solo se revisó en sintaxis; no se ha ejecutado en Google.

## Pendientes

1. Cargo de los 3 docentes sin nivel (Casanova Johana, Ponce Moncayo, Ortiz Estacio).
2. Equipos de 4 docentes en énfasis (octavo a once, CS 2-1 y CS 2-2): ¿reparto o alternancia?
3. Parejas de énfasis: ¿quién atiende la semana del 2 de febrero?
4. Correos de directivos (hoy temporales) y de docentes (vacíos).
