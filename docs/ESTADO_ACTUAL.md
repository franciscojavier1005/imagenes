# Estado actual (LEER ESTO PRIMERO; es corto a propósito)

**Dueño:** Francisco Javier Cortés Cabezas (coordinador académico, I.E. ICET, Tumaco). Español, respuestas cortas, sin bloques de código en el chat; los archivos se entregan con SendUserFile. Rama `claude/teacher-attendance-system-fso0tf` (sin PR salvo que lo pida). Nunca escribir «OPS». No versionar datos reales (libro, plantilla con nombres). No escribir en Google/Drive/OneDrive desde la sesión (solo lectura con el conector).
**Versión vigente: 2026.11.25-v** (la versión se cambia SOLO en `apps_script/Leeme.gs`: `VERSION_SISTEMA`, `FECHA_VERSION`, `HISTORIAL_VERSIONES`; las pantallas la reciben por `<?= VERSION ?>`).

## Qué es
«Control de Procesos ICET»: libro de Google Sheets + Apps Script. (1) Asistencia docente (ronda, novedades, reuniones, paneles). (2) **Comisiones de evaluación y promoción**: acta por grado y período, versionado optimista, turno de edición o modo equipo, historial de 8 días, borradores locales.

## Cómo se trabaja
1. Editar `apps_script/*.gs` y `*.html`. **`apps_script/Comisiones.html` ahora es la fuente (ya contiene todo); la plantilla con datos reales que lo generaba NO existe en sesiones nuevas: editarlo directamente** (`scripts/comisiones_build/` queda como referencia histórica).
2. `python3 scripts/empaquetar_apps_script.py` → `apps_script/paquete/` (`ICET_completo.gs` + 9 `.html` incl. `Manuales.html`).
3. Pruebas: `for f in apps_script/pruebas/*.test.js; do node $f; done` (20, todas deben pasar), `python3 scripts/pruebas_whatsapp.py`, `python3 scripts/auditoria_api.py` (permisos vs despacho vs pantallas) y navegador: `node scripts/pruebas_navegador/integ.js|integ5.js|integ7.js` (integ6 es lenta, ~3 min).
4. Versión: subir `Leeme.gs` + una línea en `docs/CONTEXTO_PROYECTO.md` (archivo de ~190 KB: NO leerlo entero, usar grep). Commit y push. Entregar al usuario SOLO los archivos que cambiaron (el `.gs` siempre).
5. Manuales: `node scripts/generar_manual_pdf.js`, `node scripts/generar_manual_comisiones.js`, `python3 scripts/generar_manuales_html.py` (PDF incrustados en `Manuales.html`); formatos de acta: `python3 scripts/generar_formatos_comisiones.py`; vistas previas: `python3 scripts/generar_vista_previa_comisiones.py`. «Envíame la última versión» = `python3 scripts/archivar_versiones.py` y enviar el zip.
6. Libro real (solo lectura): id `1mZ0QyTwpKid7HlNam1hm5ILUfLFMKks8SmiDS9OeZ-0`.

## Reglas vigentes de comisiones
- Grado del estudiante = columna `grupo` de `Estudiantes` (0901, 1001…), no `curso`; códigos de grado de 2 cifras (`comisionGradoKey_`). No insertar/ordenar filas con actas abiertas: lo guardado se une por nombre (`k0`).
- Caminar: defecto CS1→6.º y CS2→8.º; coordinación cambia por período («Cambiar integración», `comisiones_union`); el primer grado que abre un acta con Caminar lo toma (`comisiones_union_uso`).
- Modo `UNO` (una persona edita) o `EQUIPO` (cada docente solo su curso/áreas) por `comisiones_modo`.
- **La matrícula sale de los listados** (`matDeriva`): inicial, nuevos (agregados), retirados, no asisten = solo lectura (texto); hombres, mujeres, venezolanos, ecuatorianos editables (`setMatMan`). «Matrícula final» = inicial + nuevos − retirados − no asisten, destacada. Cada director confirma sexo, nacionalidad (Colombiana por defecto) y tipo de documento (TI sugerido) con «Confirmar sexo y documento del curso».
- «No asiste…» (inhibe) y «Retirado…» (otra institución/domicilio/canceló); sus datos se vacían de reprobación, reconocimientos, convivencia, compromisos y PIAR (`limpiaBajas`) y no salen en promoción.
- Reprobación = REFLEJO de Áreas (solo lectura; `repCard` solo causas/inasistencia/anotación): los reprobados se eligen en Áreas con «Seleccionar» (desmarcar quita; etiquetas con ✕ bajo cada área; «Vaciar reprobados» por curso) y `rpDeriva` cuenta desde `S.rep`; más de 2 áreas = no promovido; 11.º: quien pierde un área no participa en la graduación.
- Promoción: alfabética; franja amarilla (con áreas pendientes) y rosada (no promovidos).
- Reconocimientos: Excelencia (puesto 1.º–10.º), Rendimiento académico (1.º–10.º), Convivencia escolar, Colaboración y buen porte del uniforme, Otros (sin puesto); promedio sugerido 4,6 que se confirma; documento y sexo obligatorios para reconocidos.
- «Habilitar de nuevo» (coord/desarrollador) con justificación. Traslados: coord aplica; otros solicitan (`Traslados_Estudiantes`). Menú de directivos: traslados y cambios masivos, importación de otro libro, informe de reconocimientos (Excel .csv, hoja de Google y PDF por grupos), seguimiento (destacadas + tabla), manuales PDF, copia de revisión (cada 6 h).
- Nueva acta: archivar / borrar (recuperable) / recuperar (`ARCHIVADA`/`BORRADA` ocultas en `comisionActas_`).
- Rendimiento: leer cada hoja una vez por solicitud (`VAL_REQ`); no leer `Parametros` en bucles.
- Alternancias del horario: `COM_ALTERNAN_DEFECTO` (solo Quintero en 0801/0802, CSI) + parámetro `comisiones_alternan`; faltan los demás pares.

## Pendientes
- Actas de período: la promoción solo aparece en el acta final; el usuario sugiere una vista «promoción parcial» (estado de áreas por período). Pendiente de definir.
- Mac (Safari): no hay permisos que activar en la app; probar Chrome, ventana privada con UNA cuenta de Google, o Safari → Ajustes → Privacidad → desmarcar «Impedir seguimiento entre sitios» y permitir ventanas emergentes. Google muestra «No se pudo abrir el archivo»; pedir el enlace completo (termina en `/exec`) y probar en Chrome/ventana privada, una sola cuenta de Google.
Auditoría completa de velocidad con todos los grados. Capturas de los manuales desactualizadas. El usuario debe correr «unificar actas duplicadas» y corregir `grupo` de promovidos (p. ej. Valencia Ibarra Keyla Johana → 1001).
- Umbral: el SIEE aprueba de 3,0 a 5,0; el rector redondea de 2,91 a 3,0 en la plataforma, así que en la práctica reprueba quien queda **por debajo de 2,91**. Los textos del SIEE (superación 3,0–5,0) NO cambian. `.xlsx` antiguos versionados en la raíz (revisar si traen datos reales).
- Énfasis: las filas `tipo=ENFASIS` del Horario no traen `grupo` (usan `grupos_enfasis`); `comisionHorarioConAlternan_` las incluye para equipos y áreas.
- Alternancias (`COM_ALTERNAN_DEFECTO`, ya cargadas con lo explicado por el coordinador): CSI Quintero↔Ortiz (7.º, 8.º, CS2), Pulgarín↔Betancourth (9.º–11.º), García Gobea sola (6.º–CS1-1); ETR Castillo↔Casanova (CS1-2, 7.º, 8.º, CS2), Estacio↔Montaño (9.º–11.º), Lozano sola (6.º–CS1-1); CNA Lemos y Villota (9.º–11.º y CS2). Otras parejas: parámetro `comisiones_alternan`.
- Promedio de excelencia/rendimiento admite 3 decimales. Velocidad: lecturas por solicitud 28→11 en `comisionGradoDatos` (`VAL_REQ` también para correos y `Parametros`); el cliente pide listado y acta en paralelo.
- Documento para otros chats: https://claude.ai/artifact/4eqpmkvtdV5WMmjQG4KkTp
