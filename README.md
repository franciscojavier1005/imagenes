# ICET 2026 - Control de asistencia docente

- `fuentes/`: PDF de asignación académica, dirección de grupo y Word de asistencia (originales).
- `scripts/`: extracción (`extraer_horarios.py`), datos (`construir_datos.py`), validación (`validar.py`) y libro (`generar_libro.py`; `direccion_grupo.py` con la dirección de grupo 2026).
- `data/`: CSV generados (docentes, grupos, franjas, horario maestro) y `VALIDACION.md`.
- `ICET_Control_Asistencia_Docente_2026.xlsx`: libro listo para importar a Google Sheets.
- `apps_script/`: `Codigo.gs` (formulario + registro automático) y `Consulta.html` (¿quién debe estar dónde ahora?).

## Ubicación de docentes de bachillerato (Excel)
`ICET_Ubicacion_Docentes_Bachillerato.xlsx`: la hoja **Ubicacion** aplica sola el filtro con la fecha y la hora del dispositivo y muestra quién está en cada grupo y en qué área. Para otro momento: fecha, bloque (1 a 4) o sesión (1 a 8) en las celdas amarillas. **Por_Docente** lista a cada docente de A a Z y dónde está (o "Libre"). Solo bachillerato, sin preescolar ni primaria. Se regenera con `python3 scripts/generar_ubicacion.py`.

## Paneles por rol
Un solo panel con tres vistas (selector "Vista"; el rol decide qué ve cada persona):
- **Rectoría:** resumen ejecutivo (horas sin atender, cumplimiento, tendencia, motivos, nivel, 8 grupos más afectados, novedades del día).
- **Coordinación:** todo lo anterior más áreas, ronda de verificación, docentes con más tiempo sin atender y filtros por nivel y por docente.
- **Informe del docente:** solo sus propios registros (ausencias, llegadas tarde, justificadas, tendencia, motivos y su lista de novedades), sin compararlo con otros.
- **Acceso:** editores del libro y las personas de la hoja `Directivos` ven las vistas de directivos; un docente (cuando su correo esté en la hoja `Docentes`) solo recibe su informe, y el servidor lo fuerza aunque pida otro. Cualquier otra persona es rechazada.

## Docentes: registro, informe y soportes
- **Registro una sola vez:** el docente abre el enlace con su cuenta de Google (Gmail u otra), elige su nombre y acepta la autorización de datos. Queda pendiente hasta que un directivo lo apruebe (Coordinación > Gestión). Desde entonces el sistema lo reconoce solo, en el celular o el computador. No se le envía nada por correo. También se puede escribir su correo de antemano en la hoja `Docentes` (columna `correo`): entonces solo debe aceptar la autorización.
- **Informe del docente:** sus últimos 30 días (ausencias, llegadas tarde, justificadas, tendencia, motivos y su lista de novedades).
- **Soportes (incapacidades, citas, actas, epicrisis, citaciones…):** tras una ausencia que lo exija, el docente toma una foto o elige un PDF desde el celular. Las fotos se reducen en el teléfono. Los archivos van a una carpeta de Drive **privada** (subcarpeta por docente); el docente solo ve el estado: Pendiente, Vencido, Entregado, Aceptado, Rechazado (con la observación) o No aplica.
- **Plazos (definidos por el coordinador):** 3 días hábiles si la ausencia es injustificada (para justificarla) y máximo 5 en los demás casos (incapacidad, viaje, etc.), **contados desde el reintegro** (el día hábil siguiente al último día de la ausencia). Varios días seguidos son una sola ausencia y un solo soporte; el fin de semana no la corta. Se cuentan días hábiles de lunes a viernes (los festivos no se descuentan todavía).
- **Qué exige soporte:** las ausencias ("No asistió") con motivo que lo requiera según `data/motivos.csv` (columnas `requiere_soporte` y `plazo_dias`; "Permiso del rector" no). Las llegadas tarde y salidas tempranas no. Las ausencias anteriores a la fecha de la hoja `Parametros` (`soportes_desde`) no cuentan, para que lo anterior no aparezca como vencido.
- **Revisión:** el directivo ve el archivo, y acepta, rechaza (con observación obligatoria) o marca "No aplica". Al aceptar, las novedades injustificadas de esa ausencia pasan a justificadas con el motivo declarado, y el panel lo refleja.
- **Despliegue:** requiere dos proyectos de Apps Script (back y front). Guía paso a paso en `docs/DESPLIEGUE.md`. Borrador del texto de autorización y lista de lo que debe confirmar la institución en `docs/AUTORIZACION_DATOS_BORRADOR.md`.

## Novedades desde WhatsApp
No hay acceso directo a WhatsApp. El flujo es: exportar el chat del grupo de directivos (⋮ > Más > Exportar chat > sin archivos) → `python3 scripts/importar_whatsapp.py chat.txt [--fecha 2026-10-02]` → pegar el CSV en la hoja `Bandeja_WhatsApp` → revisar (docente, tipo, motivo) y marcar `SI` en *confirmar* → menú **Asistencia ICET > Importar bandeja de WhatsApp**. Cada fila pasa a `Novedades` como ausencia de jornada completa (minutos = sesiones del horario del día x 45), con el mensaje original en Descripción. En la ronda, el docente muestra "Reportado hoy" para que todos los directivos lo vean, y la ronda no duplica minutos si ya estaba reportado.
- Es una ayuda por palabras clave: puede equivocarse. Cada fila lleva su confianza (alta, media, baja o sin docente) y nada se importa sin su confirmación.
- Los chats contienen datos de salud: `importacion/` y los chats están en `.gitignore`; no los suba a ningún repositorio.
- Prueba (con docentes y mensajes ficticios): `python3 scripts/pruebas_whatsapp.py`.

## Observación de la ronda por voz o texto
Al terminar la ronda, el botón **🎙 Observación** (barra inferior de la ronda) permite escribir, dictar (micrófono del teclado), grabar con el navegador
(con transcripción automática si el navegador la ofrece, p. ej. Chrome en Android) o elegir un audio. El sistema (`Notas.gs`, mismas reglas de `data/patrones_novedades.json`
que el importador de WhatsApp) **propone** novedades: detecta tipo, motivo, grupo ("8-1", "octavo uno"), sesión ("tercera hora", "a las 8:30") y docente (por nombre o,
si solo se nombra el grupo, por el horario). Cada propuesta aparece con su nivel de confianza; usted elige/corrige docente y motivo y pulsa **Registrar novedad** o **Descartar**.
Nada pasa a `Novedades` sin esa confirmación y no se duplica una ausencia ya registrada.
- El audio es opcional y se guarda en una subcarpeta privada de Drive ("Audios de ronda"); se borra a los 30 días (parámetro `audio_conservar_dias`, menú *Borrar audios de ronda antiguos*).
  No grabe nombres de estudiantes ni más datos de salud de los necesarios (datos sensibles, Ley 1581).
- El navegador solo transcribe en el momento; si graba sin transcripción, el audio queda guardado pero **sin analizar** hasta que usted lo transcriba. Para eso, sin enviar nada a terceros:
  `pip install faster-whisper` y `python3 scripts/transcribir_audio.py ronda.m4a --analizar 2026-10-02` (usa `scripts/analizar_nota.js`; el texto resultante se puede pegar en el cuadro de observación).
- Vista previa funcional en `ICET_Vista_Previa_Ronda.html` (el análisis corre de verdad en el navegador; no guarda nada).

## Cambios de la ronda (última versión)
- Un solo selector **Motivo** (empieza en "Sin justificación"); ya no hay un selector aparte de "Justificación" que repetía lo mismo. Si el motivo es "Sin justificación" la ausencia cuenta como injustificada.
- **¿Quién atendió al grupo?** (nadie / reemplazo / practicante / otro docente o directivo): se anota, pero **no cambia** que el docente no asistió.
- Imagen institucional: escudo de ICET (recortado de `LOGO ORIENTACIÓN ESCOLAR ICET 40.jpg`, copia en `apps_script/recursos/`), azul marino y dorado.
- Directivos: Francisco Javier Cortés (coordinador académico), Verónica Barreiro (coordinadora de redes de apoyo), Harold Angulo (coordinador de convivencia) y Jorge Hernández (rector); correos aún temporales.

## Ronda por bloque
La ronda verifica por **bloque** (2 sesiones: S1-2, S3-4, S5-6, S7-8) o, si se prefiere, por sesión (selector "Por bloque / Por sesión" en el encabezado; se recuerda en cada dispositivo). En bloque, una visita en cualquier momento del bloque vale para sus dos sesiones: una tarjeta por docente y la marca se guarda como las dos sesiones (Registro_Ronda y Novedades, 45 min cada una; 60 en preescolar). La llegada tarde se anota en la primera sesión y la salida temprana en la última. "Toda la jornada" sigue registrándose una sola vez.

## Ingreso de docentes
El docente entra con una **cuenta de Google** (Gmail o un correo cualquiera vinculado a una cuenta Google). El ingreso con Facebook **no es posible** en Google Apps Script. Los correos de los docentes se
dejan vacíos por ahora (se registran ellos mismos al ingresar y el directivo aprueba); los de los directivos siguen siendo temporales (`@example.com`). La huella/firma queda pospuesta.

## Panel (dashboard) e informe diario al rector
- **Panel** (`apps_script/Dashboard.html`, se abre con `?p=panel` al final de la URL de la aplicación): horas de clase sin atender, cumplimiento, docentes con novedad, ausencias, llegadas tarde, tendencia de 10 días, motivos, nivel, grupos y áreas más afectados, cobertura de la ronda y novedades del día. Filtros: hoy, semana, mes o fechas a elección. Cada gráfico tiene su tabla; funciona en celular y en modo oscuro.
- **Informe diario al rector:** correo HTML (lunes a viernes, hacia las 2:30 p. m.). Menú **Asistencia ICET > Informe al rector: programar envío diario**. Mientras el correo del rector en la hoja `Directivos` sea temporal (`@example.com`) **no se envía nada**; cuando se ponga el real, use "enviar prueba ahora".
- **Vista previa con datos de ejemplo** (docentes ficticios): `ICET_Panel_Vista_Previa.html`, se regenera con `python3 scripts/generar_panel_demo.py`.
- **Pruebas:** `python3 scripts/datos_demo.py && node apps_script/pruebas/resumen.test.js` (cálculo del panel y filtros contra un cálculo independiente en Python); `python3 apps_script/pruebas/exportar_hojas.py` y luego `node apps_script/pruebas/servidor.test.js`, `whatsapp.test.js`, `acceso_soportes.test.js` y `front.test.js` (roles, registro, soportes, importación, ronda y comunicación front-back, con docentes ficticios); `python3 scripts/datos_soportes_demo.py && node apps_script/pruebas/plazos.test.js` (plazos de soportes contra un cálculo independiente).
- Para activar la aplicación: copiar también `Dashboard.gs`, `Resumen.gs`, `Plazos.gs`, `Acceso.gs`, `Soportes.gs`, `Api.gs`, `Whatsapp.gs` y `Dashboard.html`, y el manifiesto `appsscript.json` (modo A, solo directivos). Para incluir a los docentes use el modo B de `docs/DESPLIEGUE.md`.

### Fase siguiente (no implementada)
- **Firma o huella en el celular:** hoy la ronda del coordinador reemplaza la hoja de firmas. Para que el docente confirme su llegada con la huella del teléfono se usarían llaves de acceso (passkeys/WebAuthn): la huella nunca sale del teléfono y el sistema solo guarda una llave pública asociada al docente. Requiere una página propia con HTTPS (no funciona dentro de Apps Script), cuentas de docentes y autorización expresa, porque los datos biométricos son sensibles (Ley 1581 de 2012).
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
