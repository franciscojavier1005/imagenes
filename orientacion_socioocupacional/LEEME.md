# Rumbo ICET · Orientación socioocupacional (aplicación web independiente)

Autoría del sistema: Francisco Javier Cortés Cabezas · I.E. Ciudadela Educativa Tumac (ICET), Tumaco.

Cuestionario para estudiantes de 9.°, 10.° y 11.° y egresados. Cada respuesta se guarda sola como una fila en el libro
**«Orientación Vocacional ICET 2026 - Respuestas»** (hojas Respuestas, Resumen y Rutas y ofertas). El libro calcula el resumen por sí mismo.
Los estudiantes no ven datos de nadie: solo envían su propia respuesta.

## Archivos del paquete
| Archivo | Para qué sirve |
|---|---|
| `Code.gs` | Receptor: sirve la página y escribe en el libro. Incluye `configurar()` y `probar()`. |
| `Index.html` | El cuestionario (la aplicación completa en un solo archivo). |
| `appsscript.json` | Configuración: zona horaria, permiso de hojas de cálculo y publicación como aplicación web. |
| `pruebas/receptor.test.js` | Prueba automática del receptor (`node pruebas/receptor.test.js`). |
| `package.json` | Opcional: comandos de `clasp` para subir y publicar desde el computador. |

## Opción A · Desde el propio libro (la más sencilla, sin instalar nada)
1. Abra el libro «Orientación Vocacional ICET 2026 - Respuestas» → **Extensiones → Apps Script**.
2. Borre el contenido de `Código.gs` y pegue el de `Code.gs`. Guarde.
3. Botón **+** (Archivos) → **HTML** → nómbrelo `Index` (sin .html) → pegue el contenido de `Index.html`. Guarde.
4. Engranaje **Configuración del proyecto** → active **Mostrar el archivo de manifiesto «appsscript.json»** → abra `appsscript.json` y pegue el contenido del paquete. Guarde.
5. Seleccione la función **`configurar`** y pulse **Ejecutar**. Acepte los permisos (hojas de cálculo). Deja los encabezados de las columnas AT:AY.
6. Seleccione **`probar`** y **Ejecutar**: escribe y borra una fila de ensayo. Debe responder `ok: true`.
7. **Implementar → Nueva implementación → Aplicación web.** Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**. Copie la dirección que termina en **/exec**.
8. Esa dirección es la que comparte con los estudiantes. **No hay que pegarla en ningún archivo**: la página se sirve desde el mismo script y guarda sola.
9. Panel de pegado de códigos (opcional): la misma dirección terminada en `?panel=1`.
10. Cada vez que cambie el código: **Implementar → Administrar implementaciones → lápiz → Versión nueva**. Si no lo hace, el enlace sigue ejecutando la versión vieja.

## Opción B · Desde el computador con `clasp`
`npm install` · `npx clasp login` · `npx clasp create --type standalone --title "Rumbo ICET"` · `npm run subir` · `npm run publicar`.
Requiere Node.js y activar la API de Apps Script en https://script.google.com/home/usersettings.

## Si algo no guarda
- Abra el proyecto → **Ejecuciones** (menú izquierdo): muestra el error de cada intento.
- `?ping=1` al final de la dirección debe responder `{"ok":true,...}`.
- Ejecute `probar`. Si falla, el libro no se encuentra: revise `ID_LIBRO` en **Configuración del proyecto → Propiedades del script**.
- El enlace de claude.ai («Rumbo vocacional») es una versión antigua y **no** guarda en el libro.

## Privacidad (menores de edad)
- Pida a rectoría la autorización de tratamiento de datos antes de aplicar el cuestionario (Ley 1581 de 2012).
- No se piden apellidos, documento, dirección ni teléfono; el alias es opcional.
- El libro debe quedar privado: solo coordinación y orientación. Los estudiantes solo conocen la dirección de la aplicación.
- Conexión con el libro de asistencia: opcional y posterior (leer solo grupo y número de lista desde la hoja `Estudiantes`, sin copiar datos).
