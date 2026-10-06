# Auditoría del sistema de control de asistencia docente (2026-10-06)

## 1. Qué se construyó (resumen por área)
**Datos e horario.** Extracción de 10 PDF de horarios (secundaria, primaria, preescolar) a CSV y libro; 57 docentes, 35 grupos, 1 549 filas de horario; validado: 0 choques de docente, 0 choques de grupo, 576 celdas de clase cruzadas con 0 diferencias. Énfasis reconstruidos (parejas de 7°, equipos de 4 desde 8°). Direcciones de grupo (dinamizadores), reemplazos (Armero reemplaza a Terán, orientadoras, PTAFI). Preescolar en 4 periodos de 60 min (7:30-11:30).
**Ronda (celular/tableta).** Por bloque (2 sesiones) o por sesión; tarjetas por docente con botones Presente / No asistió / Permiso por horas o reunión / Llegada tarde / Salida temprana; un solo selector de Motivo; quién atendió el grupo; toda la jornada una sola vez con total de minutos; barra fija con conteos y directivo; tonos suaves (se pueden silenciar); ausentes en rosado; lista ordenada preescolar→11° con CS tras sextos y novenos; grupos sin cero a la izquierda; logo responsive y colores del escudo.
**Parejas que alternan cada semana.** Ética/religión, sociales/inglés y ciencias naturales, más énfasis en pareja de 7°: la ronda ofrece los dos nombres, un directivo elige una vez y vale de lunes a viernes (intercambia los grupos).
**Reuniones y jornadas.** Registro único de asistencia (jornada pedagógica, desarrollo institucional, planeación, asamblea, consejo, comités, capacitación…), planilla de firmas imprimible, cruce con la ronda (sin estudiantes: se suspende la ronda; con estudiantes: "En reunión", no ausente). Sin minutos de inasistencia.
**Menú de entrada.** Pantalla con tres botones (Ronda, Reuniones, Panel e informes); cada pantalla trae el enlace «Menú». Ya no hace falta escribir `?p=`.
**Paneles e informes.** Rector, coordinación e informe individual del docente; informe diario por correo al rector (se activa con correo real); cifras nuevas: permisos por horas.
**Docentes.** Registro único con cuenta Google + aprobación del directivo + autorización de datos (texto borrador), carga de soportes a Drive privado con plazos en días hábiles, revisión de soportes (modo B con dos proyectos, documentado, no desplegado).
**Novedades por otros medios.** Importador de WhatsApp (chat exportado → bandeja → confirmar → Novedades); observación por voz o texto al terminar la ronda con propuestas confirmables (audio opcional en carpeta privada, 30 días); análisis compartido Python/JS con reglas en `data/patrones_novedades.json`.
**Motivos.** Catálogo ampliado: permiso por horas, comités, reunión PTAFI, reunión de docentes, atención a padres, atención en coordinación, reunión de cierre, reunión o acto escolar de hijo(a), lluvia intensa, sepelio o duelo (más los de salud, calamidad, capacitación, SED, etc.). Se agregan solos a la hoja `Motivos`.

## 2. Verificación
- 246 comprobaciones automáticas en 8 suites de Node (Google simulado) + 12 del importador de WhatsApp en Python; todas pasan. Cálculo del panel contrastado con un cálculo independiente en Python; vectores cruzados Python/JS para el análisis de notas.
- Revisión del paquete final: 113 funciones en `ICET_completo.gs`, sin nombres duplicados; todas las llamadas de las 4 pantallas al servidor existen; las 5 páginas del menú compilan.
- Pantallas probadas con Chromium (celular y computador) y micrófono simulado; sonidos verificados por creación de osciladores (no se pueden oír aquí).
- **No verificado en Google real:** nada se ha ejecutado desde aquí en tu cuenta (solo lectura de Drive). Sí se vio que tu hoja ya guarda rondas (Registro_Ronda y Novedades).

## 3. Riesgos y límites conocidos
1. **Versión desplegada atrasada.** Al 2026-10-06 tu hoja no tenía las hojas `Alternancias`, `Semana_Alternancia`, `Reuniones`, `Asistencia_Reunion` ni los motivos nuevos: el código desplegado es de varias entregas atrás.
2. Modo A (un proyecto): todos los directivos deben ser **editores** del libro; los docentes no pueden usarlo (para ellos, modo B).
3. Google Sheets convierte textos en números/horas: se mitigó con apóstrofo (códigos de grupo, fechas y horas de reuniones). Si aparece un valor raro en una hoja, avisar.
4. "Toda la jornada" de un docente que intercambió grupos esa semana usa su horario normal (diferencia pequeña).
5. El cumplimiento (%) y las "sesiones equivalentes" del panel usan 45 min; en preescolar (60 min) son aproximados. Los minutos y horas sí son exactos.
6. Quintero aparece en dos parejas (énfasis y sociales/inglés): puede salir en dos tarjetas a la misma hora; el directivo elige.
7. Las reuniones todavía no aparecen en el panel ni en el informe al rector.
8. Los festivos no se descuentan en los plazos de soportes.
9. Observaciones por voz: la transcripción automática depende del navegador; audio = dato sensible (Ley 1581): revisar la política institucional y el texto de autorización (borrador).
10. Pendiente de confirmar: si los docentes 1 y 2 (6° y 7°) también se alternan entre sí.

## 4. Pendientes
Correos reales de directivos (hoy temporales), huella (pospuesta), modo B para docentes, reuniones en el panel, confirmar parejas de docentes 1 y 2, texto jurídico de autorización de datos.

## 5. Qué sustituir en Apps Script (una sola vez, con los archivos de `apps_script/paquete/`)
1. `Código.gs` ← contenido completo de `ICET_completo.gs`.
2. HTML `Consulta` ← `Consulta.html` (completo).
3. HTML `Dashboard` ← `Dashboard.html` (completo).
4. HTML **nuevo** `Reunion` ← `Reunion.html`.
5. HTML **nuevo** `Menu` ← `Menu.html`.
6. `appsscript.json`: sin cambios.
7. Guardar, y **Implementar > Administrar implementaciones > lápiz > Nueva versión** (la URL no cambia).
8. Recargar la hoja y, una sola vez, menú **Asistencia ICET > Actualizar horario de preescolar**.
9. Abrir la URL **sin nada al final**: aparece el menú.
