# Propuesta de módulos futuros (ejemplo de esquema, sin tocar lo que ya funciona)

Sistema de control de asistencia de directivos · I.E. ICET, Tumaco. Autor: Francisco Javier Cortés Cabezas.
Estado: **propuesta**. No hay código nuevo en producción; el control de asistencia sigue igual.

## 1. Idea general: una sola URL, varios "ambientes" por rol

Hoy la aplicación ya identifica a cada persona (PIN, token, hoja `Directivos`) y cada función del servidor tiene una lista de roles permitidos (`API_PERMISOS`). Agregar ambientes es agregar **roles** y **pantallas**, sin cambiar la dirección:

| Rol | Entra a | No ve |
|---|---|---|
| Directivo | Ronda, panel, novedades, estudiantes, reuniones (como hoy) | Contenido clínico de orientación (ver 2) |
| Rector | Panel de solo lectura + cifras de los módulos | — |
| Orientadora escolar | Su módulo de casos, listado de estudiantes, marcas | Rondas, novedades de docentes, panel |
| Tutora PTAFI | Su propio módulo (seguimiento de estudiantes del programa) | Rondas, casos de orientación |
| Docente | Reportar un caso/remisión, ver sus notas y su grupo | Casos de otros, notas de otros docentes |

Al iniciar sesión, la pantalla de inicio muestra solo los botones que corresponden al rol. El servidor **rechaza** cualquier otra petición aunque alguien conozca el nombre de la función (el control está en el servidor, no en la pantalla).

## 2. Módulo de orientación escolar

**Quién lo usa:** las orientadoras registran y hacen seguimiento; los docentes (más adelante) pueden **reportar** una situación; los directivos ven cifras y estados, no el detalle clínico, salvo que la orientadora los comparta.

**Tipos de caso** (lista editable): psicológico, psiquiátrico/salud mental, discapacidad y NEE, convivencia (Ley 1620), violencia o abuso, sexualidad, consumo de SPA, riesgo suicida, familiar/social, académico, otro.

**Hojas nuevas** (se crean solas, como las demás):
- `Casos_Orientacion`: id, fecha, estudiante, grupo, tipo, nivel de riesgo (bajo/medio/alto), reporta (docente u orientadora), estado (Abierto, En seguimiento, Remitido, Cerrado), responsable.
- `Seguimientos_Orientacion`: id_caso, fecha, quién, nota (texto reservado), próxima acción, fecha de próxima cita.
- `Remisiones`: id_caso, entidad (EPS, ICBF, Comisaría, Policía de Infancia, hospital), fecha, estado de la respuesta.

**Reglas de confidencialidad (importante):**
- El texto de los seguimientos solo lo ve la orientadora que lo escribió y quien ella autorice; los directivos ven "Caso abierto · tipo · riesgo · próxima acción", no el relato.
- Un docente que reporta ve solo el estado de **su** reporte ("recibido", "en atención"), nunca la evolución.
- Casos de riesgo alto o violencia generan un aviso a la orientadora y al coordinador de convivencia; se recomienda definir con el rector el **protocolo y la ruta de atención** (Ley 1620 de 2013, Ley 1098 de 2006, Ley 1581 de 2012 de datos personales, secreto profesional de psicología).
- Se guarda quién consultó y cuándo (bitácora), y los registros no se borran, solo se cierran.
- No se almacenan documentos de identidad ni datos de contacto de las familias en la hoja: solo grupo, nombre y número de lista (igual que hoy).

**Pantallas:** lista de mis casos con filtros (estado, riesgo, grupo); ficha del caso con línea de tiempo; botón "Nuevo caso" (con búsqueda del estudiante por grupo); recordatorios de citas y de casos sin seguimiento hace más de N días; resumen para el rector (cuántos casos por tipo y estado, sin nombres).

## 3. Ambiente de la tutora PTAFI

Mismo mecanismo: rol propio, hoja propia (`PTAFI_Seguimiento`: estudiante, tema, fecha, observación, compromiso, estado) y pantallas independientes. Sin acceso a rondas ni a orientación.

## 3.2 Comunicación de los directivos con orientación y PTAFI

- **Revisar informes:** los directivos ven los **informes de gestión** de las orientadoras y de la tutora PTAFI (cantidad de casos por tipo y estado, citas cumplidas, actividades realizadas), sin el relato reservado de los casos (ver reglas de confidencialidad del punto 2).
- **Remitir reportes a las orientadoras:** un directivo (o, más adelante, un docente) puede **remitir** una situación de un estudiante a una orientadora; llega a su bandeja como caso nuevo "Remitido por …" y el directivo ve solo su estado (recibido, en atención, cerrado).
- **Asignar tareas y actividades:** hoja `Tareas_Orientacion` (id, asignada a [orientadora 1, orientadora 2 o tutora PTAFI], asignada por, descripción, fecha límite, estado: Pendiente/En curso/Hecha, nota de cumplimiento). Cada una ve **sus** tareas con alertas de vencimiento; los directivos ven el tablero completo de cumplimiento.
- Todo con bitácora (quién asignó, quién cambió el estado y cuándo).

## 3.1 Módulo del docente: novedades propias y descargos

Ya existe la base: el docente entra con su correo/PIN, ve **solo su informe** y puede entregar **soportes** (incapacidad, cita, acta…) con plazos de 3 o 5 días hábiles. Se amplía así:
- **Reportar una novedad propia** (incapacidad, cita médica, calamidad, permiso, llegada tarde, situación laboral): el docente la registra con fecha, horas, motivo y soporte. Queda como **"Reportada por el docente · pendiente de revisión"**; coordinación la acepta, la ajusta o la rechaza, y solo entonces cuenta en los informes. Se evita así que una novedad propia modifique las estadísticas sin revisión.
- **Descargos:** ante un registro hecho por un directivo (ausencia, llegada tarde, incumplimiento), el docente escribe su **descargo** con soportes adjuntos. El registro original **no se modifica ni se borra**: el descargo se guarda al lado, con fecha, y coordinación responde (acepta, acepta parcialmente, mantiene) dejando constancia. Esto respalda el debido proceso.
- **Hojas nuevas:** `Descargos` (id_registro, docente, fecha, texto, soporte, estado, respuesta, quién respondió y cuándo) y, para las novedades propias, la misma hoja de novedades con la marca de origen "docente" y estado de revisión.
- **Seguridad:** cada docente solo ve y responde lo suyo; los soportes se guardan en carpetas privadas de Drive (como hoy).
- **Reportes laborales:** un formulario aparte (tipo de reporte, descripción, soporte) dirigido a coordinación, con seguimiento del estado.

## 4. Registro académico: notas por periodo, indicadores y boletines

**Problema actual:** cada grupo comparte un Excel donde todos los docentes ven todas las notas; luego se pasa a Access para el boletín. Es lento y poco seguro.

**Esquema propuesto:**
- **Aislamiento real:** cada docente solo carga y ve las **áreas y grupos que le asigna el horario** (la hoja `Horario` ya existe). El servidor entrega solo esas filas; los demás datos no llegan a su teléfono.
- **Estructura:** `Periodos` (4, con fechas y estado abierto/cerrado), `Areas_Grupo` (docente responsable por área y grupo), `Indicadores` (por área, grado y periodo: texto del indicador/desempeño), `Notas` (estudiante, área, periodo, nota 1.0–5.0, desempeño calculado, indicadores elegidos, observación).
- **Escala:** desempeños Superior / Alto / Básico / Bajo según el SIEE de la institución (los rangos se configuran en una hoja de parámetros).
- **Captura cómoda en celular o computador:** cuadrícula del grupo (estudiante × nota) con validación (rango, vacíos), guardado por grupo y control de periodo cerrado (después de la fecha solo corrige coordinación y queda en bitácora).
- **Boletín (PDF por estudiante o por grupo):** notas por área, desempeño, **indicadores de desempeño del periodo**, inasistencias, **puesto en el periodo**, **puesto general acumulado**, **áreas o asignaturas reprobadas** y total de reprobadas, observaciones del director de grupo y firma. Se genera con el mismo mecanismo de informes (HTML → PDF/correo).
- **Informes de coordinación:** consolidado por grupo, estudiantes en riesgo de perder el año, promedio por área y docente, comparativo entre periodos, listado de planes de apoyo.
- **Exportación** a Excel/CSV para quien aún necesite pasarlo a Access mientras dura la transición.

**Límites a tener presentes:** Google Sheets soporta hasta 10 millones de celdas por libro; para toda la institución conviene un libro aparte de notas (no el de asistencia) y, si el volumen crece mucho, evaluar una base de datos real más adelante. Las cuotas diarias de Apps Script alcanzan para el uso normal, pero la generación masiva de boletines debe hacerse por lotes.

## 5. Plan por etapas (cada etapa se prueba antes de la siguiente)

1. **Roles y pantalla de inicio por rol** (orientadora, PTAFI, docente, rector solo lectura). Sin tocar la asistencia.
2. **Orientación escolar:** casos, seguimientos, remisiones, confidencialidad, bitácora.
2b. **Docente:** novedades propias para revisión y descargos con soportes.
3. **Reporte de casos por docentes** (formulario corto, solo estado de retorno).
4. **Simulacro con el rector:** un periodo de prueba con un solo grado para validar escala, indicadores y formato del boletín.
5. **Notas e indicadores para todos los grados** y boletines masivos.

## 6. Preguntas para decidir con el rector y el equipo

- ¿Qué protocolo y ruta de atención formal tiene la institución para riesgo alto, violencia y salud mental?
- ¿Quién autoriza qué ve cada rol (directivos, comité de convivencia) y por cuánto tiempo se guardan los casos?
- ¿Se necesita consentimiento o información a los acudientes en cada tipo de caso?
- Escala y rangos exactos del SIEE, número de periodos y ponderaciones por periodo.
- Formato oficial del boletín (encabezado, firmas, logo) y qué debe llevar el puesto general.
- ¿Quién puede corregir notas con el periodo cerrado y con qué justificación?

## 7. Ajustes acordados el 17 de octubre de 2026 (prevalecen sobre lo anterior)

**Arquitectura: un libro matriz y libros separados por módulo.**
- **Matriz (este libro):** solo asistencia de directivos, usuarios/roles, listados maestros (estudiantes, docentes, horario, grupos) y los **enlaces** que arman los menús de los otros módulos. No se llena con los datos de los demás módulos.
- **Un libro propio por módulo**, cada uno con su dueño: Orientación escolar (lo manejan las orientadoras), PTAFI, Planeación y malla curricular, Notas/Boletines, Reportes de docentes. La matriz los abre por su identificador; el menú de cada rol muestra solo los que le corresponden.
- **Año nuevo:** se prepara un libro (o pestañas) por año lectivo; los listados maestros se reemplazan con los que entregue el rector (formato estándar de columnas: grupo, número, apellidos, nombres) y la matriz apunta a los libros del año vigente.

**Orientación escolar.**
- Los casos viven en la hoja de cálculo de las orientadoras; ellas la manejan y deciden el nivel de acceso de los directivos (por ejemplo, solo cifras y estados).
- Punto de diseño importante: si la aplicación abre ese libro "como el desarrollador", el desarrollador tendría acceso técnico al contenido. Para que la reserva sea real, la opción recomendada es que el libro (y su pequeño script) sea **propiedad de las orientadoras** y la matriz solo tenga el enlace. A decidir con ellas y el rector.

**Docentes (ambiente propio):**
1. **Novedades laborales** y **descargos** (ausentismo/asistencia) con soportes, con revisión de coordinación. *(más adelante)*
2. **Programación del periodo:** aprendizajes, contenidos y **indicadores de desempeño generales**; alimenta directamente el boletín.
3. **Malla curricular** (diseño curricular) del área o asignatura y del grado que tiene asignado; por **grupos de docentes por área**, con control de versiones por año.
4. **Reportes de situaciones de estudiantes** por tipo (dificultad de aprendizaje, convivencia, salud, otros) dirigidos a **coordinación, rectoría u orientación**, manejados por separado de la asistencia y con el retorno de estado.
5. **Actividades y reuniones** que van a realizar, para que queden en el calendario institucional.

**Boletines.** Toman del módulo de planeación los indicadores del periodo y de las notas el desempeño, puesto del periodo, puesto general y áreas reprobadas.

**Piloto en el cuarto periodo (propuesta de alcance prudente).**
- Es un **piloto en paralelo**: el proceso oficial en Excel/Access sigue vigente y no se reemplaza; el tercer periodo pendiente se cierra por el camino actual.
- Alcance sugerido: 1 o 2 grados / grupos, docentes de esos grupos, captura de indicadores y notas, y un boletín de ejemplo en PDF para comparar con el oficial.
- Requisitos previos: listados actualizados del rector, asignación docente-área-grupo, escala y rangos del SIEE, formato del boletín y fechas de cierre del periodo.
- Si el piloto funciona, se amplía en el periodo siguiente y no antes.

## 8. Notas: reglas de acceso, cierre de periodos y asignaturas compartidas (17 de octubre de 2026)

**Periodos y correcciones.**
- Cada docente **ve** sus periodos anteriores en solo lectura; **no los modifica**.
- La captura de cada periodo solo está abierta durante la **ventana de fechas** que fija el rector con el coordinador académico. Al vencer, el periodo queda cerrado.
- Para corregir con el periodo cerrado, o ante un error significativo del sistema, el docente envía una **solicitud con anotación** (qué nota, por qué, soporte). Solo el administrador, el rector o el coordinador académico pueden **reabrir** ese registro, por tiempo limitado; el cambio queda en bitácora con el valor anterior, el nuevo, quién autorizó y cuándo. Nunca se sobrescribe sin dejar rastro.

**Identidad e integridad.**
- Cada docente tiene su correo y su contraseña (PIN) personales; no se comparten.
- Solo el docente asignado a un área, asignatura y grupo puede escribir sus notas; ningún otro docente puede cambiarlas ni verlas. Cada nota guarda quién la registró y cuándo.
- Para que no dependa de que alguien "revise al final": al terminar el registro, el docente recibe **una copia en hoja de cálculo** de lo que subió (notas con sus indicadores de desempeño) en su correo registrado, y debe **confirmar** el envío. Hasta confirmar, el estado es "borrador"; después, "entregado y confirmado", y desde ahí cualquier cambio sigue el proceso de corrección.
- Nota de privacidad: la copia contiene datos de menores; se envía solo al correo del propio docente y se recomienda no reenviarla.

**Asignaturas compartidas y énfasis.**
- Áreas con varias asignaturas (por ejemplo, **Ciencias Naturales = Química + Física**): cada docente sube la nota de **su** asignatura y el sistema calcula la nota del área como promedio.
- Por defecto el promedio es **ponderado** por intensidad horaria o por el porcentaje que fije la institución (configurable en la hoja de parámetros); si el SIEE establece promedio simple, se cambia el parámetro.
- Los **énfasis** con varios docentes funcionan igual: cada uno registra su parte y se promedia según la regla definida.
- Se necesita definir con el rector: pesos por asignatura, redondeo (a uno o dos decimales) y qué pasa si falta la nota de uno de los docentes (el área queda "incompleta" y no se publica en el boletín).
