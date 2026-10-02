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

## Pendientes por confirmar con el coordinador

1. **Cuéllar María (CSI, grado 6°)**: en el PDF aparece "CUELLAR MARIA"; en el Word solo existe *Cuéllar Gallo, Nemesia* (#14). Se asignó a ella.
2. **Betancourt Johana (CSI, grado 9°-10°)**: se asignó a *Betancourth Ocampo, Yohana Patricia* (#6). Otra posible: *Casanova Casanova, Johana Andrea* (#7).
3. **Erratas en el PDF**: en `DOC-2`, Casanova Yoli aparece con áreas "ETI" y "REL"; se normalizaron a ETR.
4. **19 docentes del Word sin horario** (preescolar, primaria y otros cargos): faltan sus PDF.
5. **Énfasis (448 sesiones)**: los PDF solo dicen "ENFASIS-0701", "ENFASIS-D5-10°", etc. No indican aula, ni con qué estudiantes ni qué área dicta. Se guardan como tipo ENFASIS con su referencia.
