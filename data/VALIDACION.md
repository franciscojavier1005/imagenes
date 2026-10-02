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

## Primaria y preescolar (áreas múltiples)

- Los docentes de primaria no tienen horario por áreas: se modelan como **ÁREAS MÚLTIPLES** con su grupo, de lunes a viernes, en las sesiones 1 a 6 (6:30 a 11:40).
- Preescolar (7:30 a 11:30) usaría las sesiones 2 a 6; todavía no hay docentes identificados en ese nivel.
- Grupos de 5 docentes tomados de los registros del formulario de ausentismo (hoja "ASISTENCIA DOCENTE ICET (respuestas)", 14/07 a 04/08/2026). **Confirmar:**
  Escobar Cortés Liliana 5°-4 · Narváez Sánchez Dora Alejandra 5°-3 · Núñez Perlaza Elcy 4°-2 · Sinisterra Ana Lucía 1°-2 · Torres Segura Encarnación 3°-1.
- El formulario escribe "Elsy" y el Word "Elcy" para #33. Se conservó el del Word.
- Sin grupo ni nivel (14): Casanova Casanova Johana Andrea, Centeno Zúñiga Claudia Patricia, Cortés Salazar María Ebelice, Cuéllar Gallo Nemesia, Garzón Quiñones Sixta Janina, Landázuri Quiñones María Elia, Landázuri Gallón Teresa, Martínez Álvarez Andrea Ascención, Ponce Moncayo Ángela Paola, Valencia Solís Gloria Alexa, Zamora Ordóñez Celia Pastora, Ortiz Estacio Martha Cecilia, Armero Dájome Jesús, y la fila #56 si es de otro cargo.

## Justificaciones

Catálogo en `data/motivos.csv` (15 motivos en 8 categorías). Parte de los motivos reales del formulario de ausentismo e incorpora los pedidos: evento de la Secretaría de Educación, tema académico del docente, salud de hijo(a) o familiar y tema académico de hijo(a) (dentro de calamidad doméstica).

## Pruebas realizadas

- Hoja `Ronda`: fórmulas evaluadas con un motor de cálculo en Python (martes, sesión 1: 34 docentes, 23 grupos). La detección de sesión se probó en 15 horas, con descansos y fuera de jornada. No se pudo probar en Excel ni en Google Sheets.
- Aplicación web `Consulta.html`: probada en un navegador con tamaño de celular y un servidor simulado (marcar, justificar, tarde con minutos, guardar, cambiar de sesión). El Apps Script solo se revisó en sintaxis; no se ha ejecutado en Google.

## Pendientes

1. Confirmar los 5 grupos de primaria y completar los 14 docentes sin nivel o grupo.
2. Equipos de 4 docentes en énfasis (octavo a once, CS 2-1 y CS 2-2): ¿reparto o alternancia?
3. Parejas de énfasis: ¿quién atiende la semana del 2 de febrero?
4. Correos de directivos (hoy temporales) y de docentes (vacíos).
