# Estado actual (LEER ESTO PRIMERO; es corto a propósito)

Autor y dueño: Francisco Javier Cortés Cabezas (coordinador académico, I.E. ICET, Tumaco). Responder en español, corto, sin bloques de código en el chat; los archivos se entregan con SendUserFile. Rama: `claude/teacher-attendance-system-fso0tf` (sin PR salvo que lo pida). No escribir "OPS". No versionar datos reales (libro xlsx, plantilla con datos).

**Versión vigente: 2026.11.24-k** (ver `VERSION_SISTEMA` en `apps_script/Leeme.gs`).

## Qué es
Libro de Google Sheets + Apps Script: (1) asistencia docente (ronda, novedades, reuniones, paneles) y (2) **Comisiones de evaluación y promoción** (acta por grado y período, varios docentes a la vez, versionado optimista, turno de edición, historial 8 días, borradores locales).

## Dónde está cada cosa
- Código: `apps_script/*.gs` y `*.html`; paquete para pegar: `apps_script/paquete/` (`python3 scripts/empaquetar_apps_script.py`). Entregar siempre los 9 archivos (.gs + 8 .html).
- Comisiones servidor: `apps_script/Comisiones.gs`. Pantalla: `apps_script/Comisiones.html` (GENERADA; no editar a mano). Se construye con `scripts/comisiones_build/build_real.py` + `real_layer.js` desde una plantilla con datos que vive FUERA del repo (`/tmp/cartilla/comisiones_v53.tpl.html`, puede no existir en una sesión nueva: si falta, editar `Comisiones.html` con cuidado o pedir la plantilla).
- Pruebas: `for f in apps_script/pruebas/*.test.js; do node $f; done` (todas deben pasar) y `scripts/pruebas_whatsapp.py`. Integración con navegador: `/tmp/cartilla/integ*.js` (fuera del repo).
- Versión nueva = subir `VERSION_SISTEMA`, `FECHA_VERSION`, `HISTORIAL_VERSIONES` en `Leeme.gs` + `sed` del sello en `apps_script/*.html` + `docs/CONTEXTO_PROYECTO.md` (una línea) + commit/push.
- Manuales: `docs/Manual_ICET_Asistencia_Docente.pdf` (`node scripts/generar_manual_pdf.js`), `docs/Manual_Comisiones_ICET.pdf` (`node scripts/generar_manual_comisiones.js`), formatos Word/PDF en `docs/formatos_comisiones/` (`python3 scripts/generar_formatos_comisiones.py`).
- Libro real (solo lectura vía conector de Drive): id `1mZ0QyTwpKid7HlNam1hm5ILUfLFMKks8SmiDS9OeZ-0`. Nunca escribir en Google desde aquí.

## Reglas de comisiones vigentes (resumen)
- Grado de cada estudiante = columna `grupo` de `Estudiantes` (código 0901, 1001…), no `curso`. Grados se guardan como texto de 2 cifras (`comisionGradoKey_`; Sheets convierte «05»→5).
- **Caminar en Secundaria**: defecto CS1→6.º y CS2→8.º en todos los períodos; coordinación/desarrollador cambian por período (parámetro `comisiones_union`, botón «Cambiar integración»). El primer grado que abre un acta con Caminar lo «toma» (`comisiones_union_uso`); el otro no puede moverlo sin acuerdo. 9.º ya tomó CS2 en el período Final.
- **No asiste** (botón junto al encabezado del curso, ventana con casillas): inhibe sin quitar del listado, descuenta matrícula (`r.de`), no se promueve ni reprueba. «Retirados» = otra institución, domicilio o canceló. Sexo editable en listados; nombre pulsable para modificar.
- Matrícula se bloquea solo al confirmar la promoción del curso. «Habilitar de nuevo» (coord/desarrollador) junto a cada confirmación, con justificación.
- Reconocimientos y reprobación: selección múltiple; excelencia/rendimiento con promedio 4,6 por defecto resaltado; barra de reprobados por área y curso (solo agrega). Acta cerrada: solo coord/desarrollador escriben.
- Docentes que alternan semanalmente con quien aparece en el Horario: `COM_ALTERNAN_DEFECTO` (Quintero en 0801/0802, CSI) + parámetro `comisiones_alternan`. **Faltan** los demás pares (Ética/Religión, CS2…): pedirlos al coordinador.
- Rendimiento: leer cada hoja una vez por solicitud (`VAL_REQ` en `comisionContexto` y `comisionGradoDatos`); no leer `Parametros` en bucles (memo `COM_UNION_RES`).

- Identidad de estudiantes: lo guardado por estudiante lleva `k0` (nombre normalizado) y se reubica/descarta si la fila de `Estudiantes` cambió (los ids son el n.º de fila). No insertar/ordenar filas de `Estudiantes` con actas abiertas sin necesidad; mejor cambiar solo `grupo`. Hojas de las comisiones: `Comision_Actas`, `Comision_Secciones`, `Comision_Log`, `Comision_Historial`, `Comision_CambiosHojas` (no se editan a mano).

## Pendientes conocidos
- Mensaje cortado del usuario: «necesitamos para los reconocimientos poder elegir…» (preguntar qué).
- Pares de docentes que alternan (ver arriba). Capturas del manual de comisiones desactualizadas. Auditoría PDF de Caminar describe la regla vieja (solo .md actualizado).
- Safari/WebKit sin probar. El usuario debe: publicar «Nueva versión», ejecutar «unificar actas duplicadas» (menú) y corregir `grupo` de los estudiantes promovidos (p. ej. Valencia Ibarra Keyla Johana → 1001).

## Historial detallado
`docs/CONTEXTO_PROYECTO.md` es un ARCHIVO de ~185 KB: NO leerlo entero. Buscar con grep lo que haga falta (`grep -n "palabra" docs/CONTEXTO_PROYECTO.md`) y leer solo esas secciones.
