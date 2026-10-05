# Conectar la ronda con su hoja de Google (arranque provisional, modo A)

Para que los directivos empiecen a cargar datos reales en Google Sheets. Docentes entran después (modo B, `docs/DESPLIEGUE.md`).
Tiempo: unos 10 minutos. Use la cuenta de Google propietaria del libro.

1. **Subir el libro.** Drive > Nuevo > Subir archivo > `ICET_Control_Asistencia_Docente_2026.xlsx`. Ábralo con Google Sheets y use Archivo > Guardar como hoja de cálculo de Google. Archivo > Configuración > zona horaria **(GMT-05:00) Bogotá**.
2. **Pegar el código.** En la hoja: Extensiones > Apps Script. Borre el contenido de `Código.gs` y pegue todo `apps_script/paquete/ICET_completo.gs`. Cree dos archivos HTML con **exactamente** estos nombres: `Consulta` (pegue `Consulta.html`) y `Dashboard` (pegue `Dashboard.html`). Configuración del proyecto > marque "Mostrar el archivo appsscript.json" y pegue el contenido de `appsscript.json` del paquete.
3. **Implementar.** Implementar > Nueva implementación > Aplicación web · Ejecutar como: **el usuario que accede** · Acceso: **cualquier persona con cuenta de Google**. Autorice los permisos (Google avisará que la app no está verificada: Opciones avanzadas > Ir a la aplicación). Copie la URL.
4. **Probar.** Ronda: la URL con `?p=ronda`; panel: `?p=panel`. Marque una asistencia y guárdela: debe aparecer una fila en las hojas `Registro_Ronda` y, si hubo novedad, en `Novedades`.
5. **Otros directivos.** En modo A leen y escriben directamente en el libro: compártalo como **Editor** con ellos (hoy sus correos en la hoja `Directivos` son temporales `@example.com`; reemplácelos por los reales cuando quiera). No comparta el libro con docentes.
6. Menú **Asistencia ICET** (aparece al recargar la hoja): crear formulario, importar WhatsApp, informe al rector.

Límite del modo A: los docentes no pueden usarlo (tendrían que ser editores del libro). Para que ingresen con su cuenta de Google use el modo B.
