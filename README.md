# ICET 2026 - Control de asistencia docente

- `fuentes/`: PDF de asignación académica y Word de asistencia (originales).
- `scripts/`: extracción (`extraer_horarios.py`), datos (`construir_datos.py`), validación (`validar.py`) y libro (`generar_libro.py`).
- `data/`: CSV generados (docentes, grupos, franjas, horario maestro) y `VALIDACION.md`.
- `ICET_Control_Asistencia_Docente_2026.xlsx`: libro listo para importar a Google Sheets.
- `apps_script/`: `Codigo.gs` (formulario + registro automático) y `Consulta.html` (¿quién debe estar dónde ahora?).

## Uso rápido
- **Excel / Sheets:** hoja `Ronda` muestra sola quién debe estar en cada grupo en la sesión actual; `Matriz_Grupos` y `Horario` sirven para filtrar.
- **Celular o tablet (para guardar la ronda):** aplicación web de `apps_script/` con botones de radio (presente / no asistió / tarde) y justificación por categorías. Guarda en `Registro_Ronda` y, si hay novedad, en `Novedades` con las mismas columnas de su formulario de ausentismo.

## Puesta en marcha
1. Drive > Nuevo > Subir archivo > el `.xlsx` > abrir con Google Sheets.
2. Extensiones > Apps Script: pegar `Codigo.gs` y crear el archivo HTML `Consulta` con el contenido de `Consulta.html`.
3. Recargar la hoja. Menú **Asistencia ICET > Crear formulario de novedades (radios)** si quiere el formulario de Google.
4. Implementar > Aplicación web (ejecutar como el usuario que accede; acceso restringido a directivos) para la ronda.
6. En Google Sheets: Archivo > Configuración > zona horaria (GMT-05:00 Bogotá).
5. Compartir la hoja solo con los 3 coordinadores y el rector (Ley 1581 de 2012).
