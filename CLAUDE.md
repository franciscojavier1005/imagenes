# Instrucciones para Claude en este repositorio

Lee primero `docs/CONTEXTO_PROYECTO.md` (arquitectura, reglas de negocio acordadas, forma de trabajar y estado). **Actualízalo en cada cambio** y haz commit con el resto.

Resumen de la forma de trabajar:
1. Cambios en `data/`, `scripts/` y `apps_script/`; regenerar con los scripts; correr `apps_script/pruebas/*.test.js` y `scripts/pruebas_whatsapp.py`.
2. Empaquetar con `python3 scripts/empaquetar_apps_script.py` y entregar al usuario los archivos de `apps_script/paquete/` y una lista corta de qué sustituir. **No mostrar bloques de código en el chat** salvo que lo pida (lo dijo el 2026-10-06).
3. Commit y push a la rama `claude/teacher-attendance-system-fso0tf` (sin crear pull request salvo que lo pida).
4. Nunca escribir "OPS"; no versionar chats ni datos reales sensibles; no ejecutar nada en Google desde aquí (solo lectura de Drive).
5. **Autoría**: el sistema es de Francisco Javier Cortés Cabezas (coordinador académico, I.E. ICET, Tumaco). Mantener su crédito discreto en pantallas, libro, informe y README; incluirlo en todo archivo nuevo que se entregue.
