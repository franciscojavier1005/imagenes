# ICET 2026 - Control de asistencia docente

- `fuentes/`: PDF de asignación académica y Word de asistencia (originales).
- `scripts/`: extracción (`extraer_horarios.py`), datos (`construir_datos.py`), validación (`validar.py`) y libro (`generar_libro.py`).
- `data/`: CSV generados (docentes, grupos, franjas, horario maestro) y `VALIDACION.md`.
- `ICET_Control_Asistencia_Docente_2026.xlsx`: libro listo para importar a Google Sheets.
- `apps_script/`: `Codigo.gs` (formulario + registro automático) y `Consulta.html` (¿quién debe estar dónde ahora?).

## Puesta en marcha
1. Drive > Nuevo > Subir archivo > el `.xlsx` > abrir con Google Sheets.
2. Extensiones > Apps Script: pegar `Codigo.gs` y crear `Consulta.html`. Ajustar `DIRECTIVOS`.
3. Recargar la hoja > menú **Asistencia ICET > Crear formulario de novedades**.
4. Implementar > Aplicación web (acceso restringido a directivos) para la consulta.
5. Compartir la hoja solo con los 3 coordinadores y el rector (Ley 1581 de 2012).
