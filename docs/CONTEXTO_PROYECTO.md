# Contexto del proyecto — Control de asistencia docente ICET 2026

> **Se actualiza en cada cambio** (regla acordada con el coordinador). Última actualización: reuniones y jornadas, motivos de lluvia/sepelio/cierre, selector "Reunión" en la ronda.

## Quién y para qué
Coordinador académico de una institución pública (San Andrés de Tumaco, Nariño, Colombia). Los directivos (4: coordinador académico Francisco Javier Cortés, coordinadora de redes de apoyo Verónica Barreiro, coordinador de convivencia Harold Angulo, rector Jorge Hernández) hacen **rondas** por el colegio con celular o tableta para verificar si los docentes están en su clase, registran novedades (ausencias, llegadas tarde, permisos), y consultan paneles. Los docentes después ven su informe y suben soportes. Todo sobre **Google Sheets + Apps Script** (sin servidor propio).

## Cómo trabajamos (reglas de entrega)
- Cada cambio: regenerar archivos, correr pruebas, commit y push en la rama `claude/teacher-attendance-system-fso0tf`, y **entregar al usuario**: archivos para sustituir + bloques de código para pegar + lista de qué cambiar. El usuario NO abre las aplicaciones aparte: quiere los bloques en el chat. Si hay demasiados cambios acumulados, recomendar reemplazo de archivos completos.
- El usuario puede no haber aplicado todas las entregas anteriores: **verificar** (se puede leer su hoja de Drive con la herramienta de Drive; no se puede editar ni tocar su Apps Script).
- No se usa la palabra "OPS" en ninguna parte. Armero es reemplazo de Terán.
- Correos de directivos: temporales `@example.com`; los de docentes quedan vacíos (entran con cuenta Google; Facebook no es posible en Apps Script). Huella: pospuesta.
- Datos sensibles (salud): Ley 1581; los chats de WhatsApp reales no se versionan; fixtures de pruebas anonimizados.
- Español colombiano; respuestas directas y cortas; el usuario dicta por voz (los mensajes llegan con errores de transcripción).

## Arquitectura
- `apps_script/` código del libro (BACK) y pantallas: `Codigo.gs` (ronda), `Resumen.gs`/`Dashboard.gs`/`Dashboard.html` (paneles), `Plazos.gs`/`Soportes.gs` (soportes), `Acceso.gs` (roles), `Whatsapp.gs`, `Notas.gs`+`NotasRonda.gs`+`Patrones.gs` (observaciones por voz/texto), `Reuniones.gs`+`Reunion.html`, `Api.gs` + `front/Front.gs` (modo B, dos proyectos, para docentes).
- Modo A (actual): un solo proyecto en el libro, "ejecutar como el usuario que accede"; los directivos son editores del libro. URL estable: se actualiza con Administrar implementaciones > Nueva versión (no "Nueva implementación").
- `apps_script/paquete/` lo genera `scripts/empaquetar_apps_script.py`: `ICET_completo.gs` (todos los .gs juntos, se pega en Código.gs), `Consulta.html`, `Dashboard.html`, `Reunion.html`, `appsscript.json`.
- Datos: `scripts/construir_datos.py` (extrae de los PDF de `fuentes/` → `data/*.csv`), `generar_libro.py` (xlsx), `generar_base_datos.py`, `generar_ubicacion.py`, `generar_vista_previa.py` (HTML de prueba de la ronda y de reuniones, con servidor simulado), `generar_panel_demo.py`, `generar_patrones.py` (JSON → `Patrones.gs`).
- Pruebas: `apps_script/pruebas/*.test.js` (Node con Google simulado; `exportar_hojas.py` anonimiza el libro en `hojas.json`, ignorado por git) y `scripts/pruebas_whatsapp.py`. Correr todas antes de entregar.

## Reglas de negocio acordadas
- **Sesiones** de 45 min, 8 al día, **bloques** de 2 (S1-2, S3-4, S5-6, S7-8). La ronda es **por bloque** por defecto (una visita vale para las dos sesiones); también por sesión o abriendo Reuniones.
- **Preescolar**: 4 periodos de 60 min entre 7:30 y 11:30 (se muestran en las sesiones 3-6); ausencia completa = 240 min. Menú del libro "Actualizar horario de preescolar" corrige hojas antiguas.
- Grupos sin cero a la izquierda (7°-1); orden preescolar, 1° a 11°, con **CS 1** tras los sextos y **CS 2** tras los novenos; "CS" abrevia Caminar en Secundaria. Códigos con cero inicial se escriben como texto en Sheets (`textoCod_`).
- **Estados** en la ronda (botones): Presente, No asistió, Permiso por horas o reunión (`Ausente temporal`, minutos 15-90, no cuenta como ausencia del día), Llegada tarde (primera sesión), Salida temprana (última). Un solo selector de **Motivo** ("Sin justificación" por defecto). **¿Quién atendió al grupo?**: nadie, sin clase (niños no asistieron), reemplazo, practicante, auxiliar o apoyo, otro docente o directivo; no cambia que el docente no asistió.
- **Toda la jornada**: se registra UNA vez (novedad `JC`), con el total de minutos del día; reemplaza las de sesión; las rondas siguientes no suman.
- **Parejas que alternan cada semana** (hoja `Alternancias`): ética y religión (Casanova/Castillo, Estacio/Montaño), sociales e inglés (Quintero/Ortiz, Betancourth/Pulgarín), ciencias naturales (Lemos/Villota). La ronda muestra los dos nombres hasta que un directivo elige quién dicta; se guarda de lunes a viernes (hoja `Semana_Alternancia`) y la elección intercambia los grupos. **Énfasis en pareja** (7°): un solo grupo atendido por un docente por semana (no se divide); de 8° en adelante equipos de 4 que sí dividen el grupo. Pendiente de confirmar: si los docentes 1 y 2 (6° y 7°) también se alternan entre sí.
- **Reuniones y jornadas**: asistencia una sola vez por reunión (hojas `Reuniones`, `Asistencia_Reunion`; pantalla `?p=reunion`; planilla de firmas imprimible). Sin estudiantes → se suspende la ronda de aula; con estudiantes → quien asistió queda "En reunión" y no se marca ausente. No genera minutos. No aparece aún en el panel.
- **Soportes**: plazo en días hábiles desde el reintegro (3 si todos son "Sin justificación", 5 máx.); `soportes_desde` 2026-10-05; aceptar un soporte justifica la novedad.
- **Motivos** (hoja `Motivos`, se completan solos): salud, calamidad (incl. sepelio o duelo), permisos (rector, por horas), eventos externos (capacitación, SED), actividad institucional (comités, reuniones, atención a padres, cierre de jornada), fortuito (camino, lluvia intensa), reunión o acto escolar de hijo(a), etc.
- Observaciones por voz/texto: el análisis propone novedades (nada se registra sin confirmación); audios en carpeta privada de Drive, 30 días.

## Estado
- Lo que el usuario tenía aplicado en su hoja al 2026-10-06: versión hasta "menú de preescolar y códigos como texto" (sin parejas, sin permisos por horas, sin reuniones). Debe reemplazar los 4 archivos completos.
- Pendientes: confirmar parejas de docentes 1 y 2; reuniones en el panel; modo B para docentes; correos reales; huella; autorización de datos (texto borrador).
