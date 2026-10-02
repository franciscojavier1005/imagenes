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

## Pendientes

1. **Equipos de 4 docentes** (octavo, noveno, décimo, once, CS 2-1, CS 2-2): ¿se reparten los estudiantes entre los 4, o también alternan?
2. **Parejas**: ¿qué docente de la pareja atiende en la semana del 2 de febrero? Con eso se puede indicar cuál corresponde cada semana.
3. **Aula o sitio** del énfasis: los PDF no lo traen.
4. **19 docentes sin horario** (preescolar, primaria y otros cargos): faltan sus PDF.
5. **Correos**: los de directivos son temporales (`@example.com`, hoja `Directivos`); los de docentes quedan vacíos.
