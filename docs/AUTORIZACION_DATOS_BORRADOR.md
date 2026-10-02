# Autorización de tratamiento de datos: BORRADOR

> **Es un borrador de partida, no asesoría jurídica.** Debe revisarlo la institución (rectoría y, si cuenta con él, su asesor jurídico) y ajustarlo a su *Política de tratamiento de datos personales* antes de usarlo. Los datos de salud son datos **sensibles** (Ley 1581 de 2012, art. 5 y 6) y para ellos la autorización debe ser expresa y facultativa.

## Texto que ve el docente al registrarse (versión `v1-borrador`)

Autorizo a la Institución Educativa [NOMBRE DE LA INSTITUCIÓN], como responsable del tratamiento, a recolectar, almacenar y usar mis datos personales (nombre, correo, horario, asistencia y novedades) y los soportes que yo cargue, que pueden incluir datos sensibles de salud (incapacidades, constancias, epicrisis) y de mi familia (actas, citaciones), con la finalidad exclusiva de controlar la asistencia, justificar mis ausencias y cumplir la normatividad laboral. Los datos sensibles son facultativos: puedo no entregarlos, aunque sin soporte la ausencia no podrá justificarse. Solo los verán los directivos docentes. Conozco mis derechos de conocer, actualizar, rectificar y suprimir mis datos y de revocar esta autorización (Ley 1581 de 2012 y Decreto 1377 de 2013), que ejerzo escribiendo a [CORREO DE CONTACTO]. Se conservarán mientras dure la relación laboral y el tiempo que exija la ley.

## Qué completar o confirmar
- [ ] Nombre de la institución y correo de contacto para reclamos (se editan en `TEXTO_AUTORIZACION`, archivo `Acceso.gs`).
- [ ] Que la *Política de tratamiento de datos* de la institución exista, esté publicada y diga lo mismo (finalidades, derechos, canal de reclamos).
- [ ] Tiempo de conservación de los soportes (el borrador dice "mientras dure la relación laboral y lo que exija la ley").
- [ ] Si la institución debe inscribir esta base de datos en el Registro Nacional de Bases de Datos de la SIC: consúltelo con asesoría jurídica.
- [ ] Quiénes tendrán acceso a la carpeta de soportes (hoy: el propietario y los directivos con el libro compartido desde el menú).
- [ ] Si algún docente no acepta: puede seguir usando el informe de asistencia, pero no cargar soportes en el sistema; el directivo puede recibirlos en físico y marcarlos como entregados.

## Cómo queda registrada la aceptación
En la hoja `Usuarios`: correo, docente, fecha y hora de la autorización, versión del texto (`version_texto`), quién aprobó la cuenta y cuándo. Si cambia el texto, cambie también `TEXTO_AUTORIZACION_VERSION` para que quede constancia de qué versión aceptó cada persona.
