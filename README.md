# ICET 2026 - Control de asistencia docente

- `fuentes/`: PDF de asignación académica, dirección de grupo y Word de asistencia (originales).
- `scripts/`: extracción (`extraer_horarios.py`), datos (`construir_datos.py`), validación (`validar.py`) y libro (`generar_libro.py`; `direccion_grupo.py` con la dirección de grupo 2026).
- `data/`: CSV generados (docentes, grupos, franjas, horario maestro) y `VALIDACION.md`.
- `ICET_Control_Asistencia_Docente_2026.xlsx`: libro listo para importar a Google Sheets.
- `apps_script/`: `Codigo.gs` (formulario + registro automático) y `Consulta.html` (¿quién debe estar dónde ahora?).

## Panel (dashboard) e informe diario al rector
- **Panel** (`apps_script/Dashboard.html`, se abre con `?p=panel` al final de la URL de la aplicación): horas de clase sin atender, cumplimiento, docentes con novedad, ausencias, llegadas tarde, tendencia de 10 días, motivos, nivel, grupos y áreas más afectados, cobertura de la ronda y novedades del día. Filtros: hoy, semana, mes o fechas a elección. Cada gráfico tiene su tabla; funciona en celular y en modo oscuro.
- **Informe diario al rector:** correo HTML (lunes a viernes, hacia las 2:30 p. m.). Menú **Asistencia ICET > Informe al rector: programar envío diario**. Mientras el correo del rector en la hoja `Directivos` sea temporal (`@example.com`) **no se envía nada**; cuando se ponga el real, use "enviar prueba ahora".
- **Vista previa con datos de ejemplo** (docentes ficticios): `ICET_Panel_Vista_Previa.html`, se regenera con `python3 scripts/generar_panel_demo.py`.
- **Pruebas:** `node apps_script/pruebas/resumen.test.js` compara el cálculo del panel con un cálculo independiente en Python (`python3 scripts/datos_demo.py`).
- Para activar la aplicación: copiar también `Dashboard.gs`, `Resumen.gs` y `Dashboard.html`, y el manifiesto `appsscript.json` (zona horaria de Bogotá y permisos).

### Fase siguiente (no implementada)
Informe para cada docente (sus ausencias y horas sin atender, diario o semanal) y carga virtual de soportes (foto o escaneo de incapacidades, citas, actas, epicrisis). Antes de hacerla conviene definir: acceso individual por docente, carpeta de Drive restringida a directivos, plazo de entrega de soportes y autorización de tratamiento de datos de salud (Ley 1581 de 2012: datos sensibles).

## Vista previa (sin instalar nada)
Abra `ICET_Vista_Previa_Ronda.html` en el celular, tablet o computador: es la misma pantalla de la ronda con todos los datos incluidos. Cambie día y sesión con las flechas; al guardar se descarga un CSV. Se regenera con `python3 scripts/generar_vista_previa.py`.

## Base de datos aparte (consulta y verificación)
- `ICET_Base_Datos_2026.xlsx`: tablas (docentes, grupos, direccion_grupo, franjas, horario, motivos), `Horario_Legible` para filtrar por día y sesión, y hojas de verificación `Controles`, `Carga_Docente` y `Cobertura_Grupo`.
- `ICET_Base_Datos_2026.db` (SQLite): las mismas tablas con vistas `v_horario`, `v_carga_docente` y `v_cobertura_grupo`.
  ```sql
  -- ¿Quién debe estar el martes en la sesión 3?
  SELECT grupo, docente, area FROM v_horario WHERE dia='MARTES' AND sesion=3 ORDER BY grupo;
  -- ¿Dónde está un docente el lunes?
  SELECT sesion, inicio, fin, grupo, area FROM v_horario WHERE docente LIKE 'Villota Rubio Janeth%' AND dia='LUNES' ORDER BY sesion;
  ```
- Se regenera con `python3 scripts/generar_base_datos.py`.

## Uso rápido
- **Excel / Sheets:** hoja `Ronda` muestra sola quién debe estar en cada grupo en la sesión actual; `Matriz_Grupos` y `Horario` sirven para filtrar.
- **Celular o tablet (para guardar la ronda):** aplicación web de `apps_script/` con desplegables: asistencia (presente / no asistió / llegada tarde / salida temprana); si no estuvo se activan justificación, motivo por categoría, minutos y actividad de aprendizaje. Guarda en `Registro_Ronda` y, si hay novedad, en `Novedades` con las mismas columnas de su formulario de ausentismo.

## Puesta en marcha
1. Drive > Nuevo > Subir archivo > el `.xlsx` > abrir con Google Sheets.
2. Extensiones > Apps Script: pegar `Codigo.gs` y crear el archivo HTML `Consulta` con el contenido de `Consulta.html`.
3. Recargar la hoja. Menú **Asistencia ICET > Crear formulario de novedades (desplegables)** si quiere el formulario de Google.
4. Implementar > Aplicación web (ejecutar como el usuario que accede; acceso restringido a directivos) para la ronda.
6. En Google Sheets: Archivo > Configuración > zona horaria (GMT-05:00 Bogotá).
5. Compartir la hoja solo con los 3 coordinadores y el rector (Ley 1581 de 2012).
