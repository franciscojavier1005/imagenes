# Instrucciones para Claude en este repositorio

Lee primero `docs/CONTEXTO_PROYECTO.md` (arquitectura, reglas de negocio acordadas, forma de trabajar y estado). **Actualízalo en cada cambio** y haz commit con el resto.

Resumen de la forma de trabajar:
1. Cambios en `data/`, `scripts/` y `apps_script/`; regenerar con los scripts; correr `apps_script/pruebas/*.test.js` y `scripts/pruebas_whatsapp.py`.
2. Empaquetar con `python3 scripts/empaquetar_apps_script.py` y entregar al usuario los archivos de `apps_script/paquete/` y una lista corta de qué sustituir. **No mostrar bloques de código en el chat** salvo que lo pida (lo dijo el 2026-10-06).
3. Commit y push a la rama `claude/teacher-attendance-system-fso0tf` (sin crear pull request salvo que lo pida).
4. Nunca escribir "OPS"; no versionar chats ni datos reales sensibles; no ejecutar nada en Google desde aquí (solo lectura de Drive).
5. **Autoría**: el sistema es de Francisco Javier Cortés Cabezas (coordinador académico; especialista en informática y telemática, magíster en educación, doctorando en desarrollo de la educación; I.E. ICET, Tumaco). Mantener su crédito discreto en pantallas, libro, informe y README; incluirlo en todo archivo nuevo que se entregue.
6. **Versiones**: cada cambio entregado sube la versión (sello `versión AAAA.MM.DD-x` en el pie de las pantallas, con `sed` sobre `apps_script/*.html`) y **debe** actualizar `VERSION_SISTEMA`, `FECHA_VERSION` e `HISTORIAL_VERSIONES` en `apps_script/Leeme.gs` (la hoja LEEME del libro se regenera sola al abrirlo; `apps_script/pruebas/leeme.test.js` verifica que coincidan).
7. **LEEME**: la hoja LEEME del libro se genera desde `apps_script/Leeme.gs`. Si un cambio afecta lo que ahí se explica (estados de la ronda, hojas, reglas, menús), actualizar `LEEME_USO`/`LEEME_HOJAS` y el historial en la misma entrega, aunque sea un cambio pequeño. Lo mismo con el manual de usuario `apps_script/Ayuda.html` (pantalla ?p=ayuda): si cambia el uso de una pantalla, actualizar el manual.
8. **Carpeta «App Asistencia» (OneDrive del usuario)**: no hay conector de escritura a OneDrive. Cuando el usuario pida «envíame la última versión», ejecutar `python3 scripts/archivar_versiones.py` y enviar con SendUserFile el zip `salida_onedrive/App_Asistencia_<versión>.zip` (carpeta `ULTIMA` + `VERSIONES` con las 5 últimas estables + LEEME); el usuario lo coloca en OneDrive. Las versiones con defecto se registran en `VERSIONES_CON_DEFECTO` del script.
