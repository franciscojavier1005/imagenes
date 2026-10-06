# Actualizar el libro de Drive sin perder datos (no hay que subir otro libro)
El libro que ya tiene en Google Sheets se conserva. El código nuevo **crea solo** lo que falta: hojas `Alternancias`, `Semana_Alternancia`, `Reuniones`, `Asistencia_Reunion`, `Sesiones`, `Notas_Ronda`; columnas de clave en `Directivos`; columnas nuevas de `Bandeja_WhatsApp`; y los motivos nuevos en `Motivos`. Solo hay que hacer a mano (todo opcional salvo el punto 3):
1. En la hoja `Directivos`, columna `nombre`: dejar el nombre corto de cada coordinador (primer nombre y primer apellido: Francisco Cortés, Verónica Barreiro, Harold Angulo, Jorge Hernández). Hágalo **antes** de generar las claves.
2. En `LEEME`, celda A2: pegar la línea de autoría (opcional).
3. Menú **Asistencia ICET > Actualizar horario de preescolar** (una vez) y **Generar claves de ingreso de los directivos**.
4. En `Docentes`, columna `nota` de Armero y Terán: quitar la mención "OPS" si la tiene (opcional; no afecta nada).

---

# Ingreso con clave (modo recomendado ahora): sin pantallas de Google

Los coordinadores no tienen que iniciar sesión en Google ni pasar por «Google no ha verificado esta aplicación > Opciones avanzadas». La aplicación se publica **como el propietario** y para **cualquier persona**; cada directivo entra con su nombre y una **clave de 6 números**.

1. Pegue el código (`ICET_completo.gs`, `Consulta`, `Dashboard`, `Reunion`, `Menu` y `appsscript.json`, que ahora trae `USER_DEPLOYING` y `ANYONE_ANONYMOUS`).
2. **Implementar > Administrar implementaciones > lápiz**: *Ejecutar como*: **Yo**; *Quién tiene acceso*: **Cualquier persona**; Versión: *Nueva versión*; Implementar. La URL no cambia. Solo usted (propietario) autoriza los permisos, una vez.
3. Recargue la hoja y use el menú **Asistencia ICET > Generar claves de ingreso de los directivos**: aparecen las claves **una sola vez**; anótelas y entréguelas. En la hoja solo queda el hash.
4. Cada directivo abre la URL, elige su nombre y escribe su clave. La sesión dura 14 días en ese dispositivo (se puede cerrar con «Cerrar sesión») y la clave se puede cambiar desde el menú de la aplicación.
5. 5 intentos fallidos bloquean al directivo 15 minutos. Si alguien olvida su clave: vuelva a generarlas (reemplaza las anteriores) o cámbiela directamente.
6. Ya no es necesario compartir el libro con los coordinadores: pueden dejar de ser editores (más seguro).

Seguridad: ninguna función entrega datos sin una sesión válida (la validación del token y los permisos por rol están en el servidor); las acciones del menú del libro solo las ejecuta un editor desde el libro; el reloj del informe diario envía como máximo un informe por día.

---

# Despliegue del acceso para docentes (modo con docentes)

Hay dos formas de usar la aplicación:

- **Modo A, solo directivos (un proyecto):** el libro con su Apps Script, desplegado "ejecutar como el usuario que accede". Los directivos necesitan acceso de edición al libro. Es lo que ya describe el `README.md`. **No sirve para docentes**, porque exigiría darles acceso al libro.
- **Modo B, con docentes (dos proyectos):** un *back* que se ejecuta con los permisos del propietario (lee el libro y la carpeta de soportes) y un *front* que cada persona abre con su cuenta de Google. Es la forma recomendada para todos. El docente no tiene acceso al libro ni a la carpeta.

```
 celular o computador ──► FRONT (como el usuario) ──► BACK (como propietario) ──► libro + carpeta de soportes
   cuenta de Google          verifica el correo         comprueba secreto y rol
```

## Pasos del modo B

1. **Back.** Abra el libro en Google Sheets > Extensiones > Apps Script. Cree o pegue estos archivos: `Codigo.gs`, `Resumen.gs`, `Plazos.gs`, `Acceso.gs`, `Dashboard.gs`, `Whatsapp.gs`, `Soportes.gs` y `Api.gs`. En Configuración del proyecto marque "Mostrar el archivo de manifiesto appsscript.json" y reemplace su contenido por `apps_script/appsscript.back.json`.
2. En Configuración del proyecto > **Propiedades de la secuencia de comandos** del back agregue:
   - `API_SECRET`: una cadena aleatoria larga (32 caracteres o más). Es la contraseña entre front y back; no la comparta.
   - `MODO_BACK`: `SI`. Evita que el back muestre pantallas a quien abra su enlace.
3. Implementar > Nueva implementación > Aplicación web: **Ejecutar como: Yo** · **Quién tiene acceso: Cualquier persona**. Autorice los permisos. Copie la URL que termina en `/exec` (será `BACK_URL`).
4. **Front.** En script.google.com cree un proyecto nuevo e independiente. Pegue `apps_script/front/Front.gs`, cree dos archivos HTML llamados `Consulta` y `Dashboard` con el contenido de `apps_script/Consulta.html` y `apps_script/Dashboard.html`, y reemplace el manifiesto por `apps_script/front/appsscript.json`.
5. Propiedades del front: `BACK_URL` (la URL del paso 3) y `API_SECRET` (**el mismo** del back).
6. Implementar > Aplicación web: **Ejecutar como: el usuario que accede a la aplicación** · **Quién tiene acceso: Cualquier persona con cuenta de Google**. Esa URL es el enlace que se comparte. Panel: la URL. Ronda: la URL con `?p=ronda`.
7. Ábralo con su cuenta (propietaria del libro): debe entrar como directivo. Los demás directivos necesitan su correo real en la hoja `Directivos` (hoy hay correos temporales) o ser editores del libro.
8. **Docentes:** comparta el enlace. La primera vez Google muestra "Google no ha verificado esta aplicación": Opciones avanzadas > Ir a la aplicación. Después eligen su nombre, aceptan la autorización y quedan pendientes; un directivo los aprueba en Coordinación > Gestión. Desde entonces el sistema los reconoce solo, en el celular o el computador.
9. El informe diario al rector, la bandeja de WhatsApp y los demás menús siguen en el libro (back).

## Comprobación de 5 minutos
1. Abra el enlace con la cuenta propietaria: panel de Coordinación con la sección "Gestión".
2. Abra el enlace con otra cuenta de Gmail (ventana de incógnito): debe pedir el registro.
3. Elija un nombre, acepte y envíe: pantalla "Solicitud enviada".
4. Con la cuenta propietaria: Gestión > Aprobar.
5. Vuelva a abrir con la otra cuenta: informe del docente. Si tiene una ausencia reciente, "Mis soportes" muestra la tarjeta; cargue una foto y revise en Gestión > Soportes por revisar.

## Observación por voz
Copie también `Notas.gs`, `NotasRonda.gs` y `Patrones.gs` al proyecto del libro (back) y vuelva a desplegar; en el front solo se actualizan `Front.gs`, `Consulta.html` y `Dashboard.html`.
Pruebas en el celular: abrir `?p=ronda`, pulsar **🎙 Observación** y conceder el permiso de micrófono (el sitio debe abrirse por https, como lo hace Apps Script). Si el navegador no
transcribe, use el micrófono del teclado. El menú *Asistencia ICET > Borrar audios de ronda antiguos* aplica la retención (30 días).

## Reuniones y jornadas
Agregue el archivo HTML `Reunion` (contenido de `apps_script/Reunion.html`) y el código de `Reuniones.gs` al proyecto del libro (back) y al front el HTML `Reunion` y las funciones nuevas de `Front.gs`. La pantalla se abre con `?p=reunion` y desde la ronda hay un enlace "Reuniones".

## Si algo falla
- **"No autorizado" al abrir el front:** `API_SECRET` distinto entre front y back, o falta en uno de los dos.
- **Pantalla en blanco o error de permisos en el front:** vuelva a autorizar (Implementar > Administrar implementaciones > editar > nueva versión).
- **Cambió la URL del back** (nueva implementación): actualice `BACK_URL` en el front.
- **Rotar el secreto:** cambie `API_SECRET` en los dos proyectos a la vez.
- **Cuotas:** los llamados entre front y back usan el límite diario de `UrlFetchApp` de la cuenta del front de cada usuario; para un colegio es suficiente.

## Seguridad en pocas palabras
- El back solo responde a peticiones con el secreto correcto y luego aplica la matriz de permisos por rol (directivo, docente, sin registro, pendiente, bloqueado). Un docente no puede pedir datos de otro: el servidor lo fuerza a sí mismo.
- Los soportes quedan en una carpeta de Drive privada (subcarpeta por docente). Compartir el libro con directivos desde el menú también da acceso de lectura a esa carpeta.
- Aprobar a cada docente evita que alguien registre su cuenta con el nombre de otra persona.

## Lo que no se ha podido probar
Todo el código se probó con pruebas automáticas que simulan Google (hojas, Drive, correo y la comunicación front-back). **No se ha ejecutado en Google.** Haga primero la comprobación de 5 minutos antes de compartir el enlace con los docentes.
