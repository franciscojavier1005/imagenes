/**
 * Hoja LEEME del libro: título grande, versión vigente, qué contiene cada hoja e historial de cambios.
 * Se regenera sola al abrir el libro si la versión escrita en LEEME no es la de este código, o desde el menú
 * «Actualizar hoja LEEME». REGLA: cada vez que se cambie la versión (sello en el pie de las pantallas), actualizar
 * VERSION_SISTEMA e HISTORIAL_VERSIONES aquí (la prueba leeme.test.js lo verifica).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var VERSION_SISTEMA = '2026.10.23-g';
var FECHA_VERSION = '2026-10-23';

/** De la más nueva a la más antigua. */
var HISTORIAL_VERSIONES = [
  { version: '2026.10.23-g', fecha: '2026-10-23', cambios: [
    'Ronda: los botones que se suman a «Presente» (llegada tarde, permiso por horas, salió antes, incumplimiento) forman una barra unida, sin líneas punteadas.',
    'Ronda: el interruptor «Con estudiantes / Sin estudiantes» queda siempre visible en la línea del área de cada docente (no aparece para orientación ni tutoría). Al tocar «Sin estudiantes» el docente queda presente y se elige el motivo en una lista debajo. El nombre del docente baja a 13,5 px en celular.'] },
  { version: '2026.10.23-f', fecha: '2026-10-23', cambios: [
    'Vuelve el encabezado de celular reordenado (título a todo el ancho y con letra más grande, escudo proporcional, hora y fecha junto a los botones Menú, Ver panel y Reuniones) y la alternancia automática de las parejas que dictan por semana.',
    'Ronda: quien inició sesión queda siempre como responsable por defecto (se puede cambiar), aunque su nombre no esté en la hoja Directivos.'] },
  { version: '2026.10.23-e', fecha: '2026-10-23', cambios: [
    'Parejas que alternan (clases y énfasis de 6° y 7°): si la semana pasada ya se definió quién dictó, esta semana se alterna sola y la tarjeta lo dice («alternancia automática»); sigue la cadena hasta 8 semanas después de la última definición, y quien tiene permiso puede cambiarla con «Cambiar». Lo que se defina a mano en una semana tiene prioridad.',
    'Ronda (celular): el título ocupa todo el ancho con el escudo proporcional, el sello de la versión queda a continuación de «ICET», la hora y la fecha bajan junto a los botones Menú, Ver panel y Reuniones, y las filas del encabezado son más bajas.'] },
  { version: '2026.10.23-d', fecha: '2026-10-23', cambios: [
    'Ronda: llegada tarde, permiso por horas, salió antes e incumplimiento ahora SE SUMAN a «Presente» (el docente está en el colegio): al marcar una de ellas «Presente» también queda marcado; tocarla de nuevo deja al docente solo «Presente». Los botones principales (Presente, No asistió, Otro docente a cargo, Evento SED) siguen siendo excluyentes. Aparecen en una segunda fila con borde punteado.',
    'Ronda (celular): los botones y los contadores muestran el nombre completo con letra más pequeña (los contadores en cero de novedades poco comunes se ocultan para ahorrar espacio).'] },
  { version: '2026.10.23-c', fecha: '2026-10-23', cambios: [
    'Ronda: el encabezado dice «Institución Ciudadela Educativa Tumac · ICET» con el sello de la versión justo a continuación, en la misma línea.',
    'Ronda: casilla «Sin estudiantes» en los docentes presentes (con motivo: los despachó, están en taller o actividad fuera del aula, no asistieron los estudiantes u otro). Por defecto todos están con estudiantes; no aparece para orientación ni tutoría PTA, que no tienen estudiantes asignados. Queda en Registro_Ronda (columna atendido_por) y el informe de rondas marca «(sin estudiantes)». En las demás novedades, la lista «quién atendió al grupo» también trae «Sin estudiantes».',
    'Ronda: al guardar se muestra el resumen y, al cerrarlo (botón «Cerrar y salir al menú»), se vuelve al menú principal.'] },
  { version: '2026.10.23-b', fecha: '2026-10-23', cambios: [
    'Ronda: encabezado ordenado (escudo y título, reloj grande en vivo con segundos y fecha, «Menú», «Ver panel» y «Reuniones» en tres botones del mismo ancho, ◀ Bloque ▶ con día, modo y «Ahora» alineados, y el horario, el total y el directivo debajo).',
    'Ronda: los 8 botones de estado quedan repartidos (4×2 en celular con texto corto y más bajos para que quepan más docentes; en computador 8 en una fila con el nombre largo: Otro docente a cargo, Evento SED, Permiso por horas, Llegada tarde, Salió antes (sin informar), Reportar incumplimiento).'] },
  { version: '2026.10.23-a', fecha: '2026-10-23', cambios: [
    'Velocidad: guardar una ronda de ~40 docentes ahora hace 2 escrituras en la hoja (antes ~50, una por fila) y consulta las reuniones una vez por sesión; el respaldo se escribe de una vez y después de soltar el bloqueo. Si otro guardado está en curso, avisa «Espere unos segundos» en vez de fallar (el bloqueo espera hasta 45 s).',
    'Velocidad: el horario, las franjas, los motivos, los grupos, las parejas, las listas y los docentes se guardan 10 minutos en la memoria del sistema (se borran solos al editar esas hojas) en vez de leerse de la hoja en cada pantalla. Los registros (rondas, novedades) siempre se leen frescos.',
    'Menú principal: la dirección y los datos del usuario se piden a la vez, así la primera pantalla sale antes.'] },
  { version: '2026.10.21-e', fecha: '2026-10-21', cambios: [
    'Respaldo: cada vez que se guarda una ronda, las marcas se anotan también en un libro de respaldo aparte («ICET · Respaldo de rondas (no borrar)», se crea solo en Drive). Menú «Respaldar rondas ahora» copia completas Registro_Ronda, Novedades e Incumplimientos.',
    'Menú «Recuperar rondas desde una copia del libro»: con el enlace de una copia anterior (hecha desde el historial de versiones) o del libro de respaldo, agrega solo las filas que faltan (rondas, novedades, incumplimientos) sin cambiar ni borrar lo que ya está.'] },
  { version: '2026.10.21-d', fecha: '2026-10-21', cambios: [
    'Ronda: las marcas ya guardadas del bloque se ven siempre. Si una marca quedó a nombre de un docente que ya no tiene esa sesión (cambios de horario), aparece en la tarjeta de quien hoy la tiene (por fecha, sesión, grupo y área) y al guardar se reemplaza en vez de duplicarse; no hace falta tocar la hoja.',
    'Ronda: botones más cortos y con colores propios (Presente, No asistió, Otro a cargo, SED, Permiso, Tarde, Salió, Incumple). «SED» no pide motivo, horas ni actividad: registra la jornada completa con el tiempo que el docente tiene con estudiantes.',
    'Ronda: el botón «❗ Faltan: N · ver» abre una ventana con los nombres de quienes aún no tienen marca; tocar un nombre lleva a su tarjeta.'] },
  { version: '2026.10.21-c', fecha: '2026-10-21', cambios: [
    'Ronda: nuevo botón «Evento SED» (capacitación, taller, charla o citación de la Secretaría de Educación, SED o SEM): queda como ausencia de toda la jornada con el motivo «Evento SED / SEM», sin justificar, y el tiempo sin atender es el que el docente tiene con estudiantes ese día (240 min en preescolar).',
    'Menú del libro «Revisar y recuperar marcas de la ronda»: cuenta las marcas de Registro_Ronda por fecha, detecta las que la ronda no muestra porque quedaron a nombre de quien ya no tiene esa sesión (por cambios de horario) y, al confirmar, las devuelve a la vista; no borra nada.'] },
  { version: '2026.10.21-b', fecha: '2026-10-21', cambios: [
    'Preescolar (transición): una ausencia de jornada completa mostraba 300 minutos porque el libro conservaba el horario viejo de 5 periodos de 60 min. Ahora el libro corrige solo el horario de preescolar al abrirse (4 periodos de 60 min, de 7:30 a 11:30 = 240 min al día) y baja a 240 las ausencias de jornada completa ya guardadas de quien solo tiene grupos de preescolar (también desde el menú «Actualizar horario de preescolar»).'] },
  { version: '2026.10.21-a', fecha: '2026-10-21', cambios: [
    'Parejas que alternan (ética/religión, sociales/inglés, ciencias naturales): la alternancia semanal ahora también cambia a la persona en los equipos de énfasis (antes solo las clases), de modo que en la ronda y en Horarios aparece la tarjeta con «Cambiar» y lo definido vale de lunes a viernes para clases y énfasis a la vez.',
    'Corrección de quién dicta: ahora pasa las marcas de la ronda y las novedades por sesión de cada docente de la pareja al otro (en los dos sentidos) y también sirve para restablecer la asignación original, algo que antes fallaba al volver atrás.'] },
  { version: '2026.10.20-k', fecha: '2026-10-20', cambios: [
    'Educación Física: el rector intercambió sin avisar el horario de Docente 1 (Arizala Castro Roberto Carlos) y Docente 2 (Armero Dájome Jesús, reemplazo de Terán). Se intercambia el horario completo de los dos (Educación Física y Ciencias Naturales). Se corrigió el horario en los datos y el menú «Corregir Docente 1 y 2 de Educación Física (una vez)» muestra primero lo que cambiaría y, al confirmar, pasa de uno al otro el horario, las marcas de la ronda, las novedades por sesión, los incumplimientos, las parejas de énfasis y Matriz_Grupos; no toca ausencias de jornada completa ni novedades de formulario o WhatsApp (las cuenta para revisarlas). Queda en Bitacora_Cambios.'] },
  { version: '2026.10.20-j', fecha: '2026-10-20', cambios: [
    'Aviso del día: cada reunión muestra la hora destacada con color según la prioridad (HOY naranja, MAÑANA amarillo, próximas azul, en curso rojo y parpadeante, sin asistencia rojo), el nombre en negrita y más grande, un icono de prioridad (🔥, ⏰, 📅, ⚠️) y el fondo del mismo color que en la lista de reuniones.',
    'Ronda: el nombre del directivo que hace la ronda pasa de la barra inferior al encabezado (se ve en amarillo; en rojo si falta elegirlo), lo que libera espacio para los contadores; el escudo del colegio se ve más grande en el celular; el encabezado muestra el nombre completo de la institución (Institución Ciudadela Educativa Tumac · ICET).'] },
  { version: '2026.10.20-i', fecha: '2026-10-20', cambios: [
    'Aviso del día: ahora se queda el doble de tiempo (10 segundos y 4 más por cada aviso; los recordatorios urgentes, 14 y 4 por aviso).',
    'Reuniones: «Salida anticipada de estudiantes»: hora en que se despachan, minutos antes en que terminan las clases (10, 15, 20 o 30, para el aseo y el comedor) y si se lleva a los estudiantes al comedor antes de despacharlos. Las clases se suspenden desde que terminan (la ronda de aula no se hace en ese horario) y el aviso del día lo recuerda a los directivos.',
    'Reuniones: casilla «Informar a docentes, estudiantes y padres de familia» y botón «📣 Comunicados» con textos listos para docentes (que informan a estudiantes y padres) y para padres de familia, para copiar o enviar por WhatsApp. El aviso del día lo recuerda el día de la reunión y la víspera; el viernes también recuerda lo del lunes para empezar la semana.',
    'La hoja Reuniones recibe las columnas salida_est, min_antes_salida, llevar_comedor e informar_padres.'] },
  { version: '2026.10.20-h', fecha: '2026-10-20', cambios: [
    'Reuniones: nuevo campo «Asunto u observaciones (opcional)» para aclarar de qué trata la reunión; se ve en la tarjeta y, solo si se escribió, en el aviso del día y en los recordatorios. La hoja Reuniones recibe la columna observaciones.',
    'Reuniones: los tipos «Jornada pedagógica» y «Reunión de desarrollo institucional» se unificaron en «Jornada pedagógica o de desarrollo institucional» (las reuniones ya guardadas se muestran con el nombre nuevo). Tipos nuevos: taller pedagógico, charla o conferencia, reunión de área o de grado, reunión con padres de familia o acudientes, escuela de padres, acto cívico o cultural y simulacro de evacuación.'] },
  { version: '2026.10.20-g', fecha: '2026-10-20', cambios: [
    'Reuniones: el lugar se elige de una lista por grupos: espacios del colegio (sala de profesores, polideportivo (canchas), patio principal, sala múltiple (auditorio), biblioteca, comedor escolar, emisora escolar), salas de tecnología e informática 1 a 4 y aulas digitales (sala 5), laboratorio de química y otros laboratorios o entornos por área (se escribe cuál y su número), salones (se escribe el número o grupo), oficinas (rectoría, coordinaciones y orientación escolar, tomadas de las hojas Directivos y Docentes) y otros (virtual, fuera del colegio, otro lugar).'] },
  { version: '2026.10.20-f', fecha: '2026-10-20', cambios: [
    'Reuniones: «¿A quiénes se convoca?» ahora tiene opciones globales: todo el personal, directivos docentes, docentes orientadoras, tutora PTAFI, docentes de preescolar, de básica primaria, de bachillerato, docentes de un área (una o varias) y personalizado (docente por docente, con buscador). Además organismos e invitados: consejo directivo, académico, estudiantil, de padres, comité de convivencia, comité de comedor escolar, padres de familia o acudientes, egresados y entidad o invitado externo (con su nombre). Los organismos e invitados se anuncian pero no llevan lista de asistencia por persona; el personal sí. La hoja Reuniones recibe las columnas convocados_grupos, invitados e invitado_nombre.'] },
  { version: '2026.10.20-e', fecha: '2026-10-20', cambios: [
    'Reuniones y actividades: nuevos datos al crear o editar: hora en que comienza y cómo termina (hora fija, hora tentativa o hasta finalizar la jornada), lugar, quién convoca (rectoría, coordinaciones, líder de área, docente, orientador(a), PTAFI, Secretaría de Educación…) con el área o entidad, quién solicita y responsables a cargo, además de los convocados. Las columnas nuevas de la hoja Reuniones se agregan solas.',
    'Crear una reunión ya no se repite si se toca el botón varias veces mientras el libro responde (queda una sola) y, al terminar, vuelve a la lista de reuniones (antes abría la lista de docentes para la asistencia). Quien administra ve «Quitar las repetidas» para limpiar las que ya estén duplicadas (también en el menú del libro: Quitar reuniones repetidas); la que tiene asistencia se conserva y las demás quedan en Reuniones_Anuladas.'] },
  { version: '2026.10.20-d', fecha: '2026-10-20', cambios: [
    'Aviso del día: ventana emergente de unos segundos sobre cualquier pantalla (menú, ronda, novedades, reuniones, horarios y panel) con las reuniones de hoy (hora, tipo, si se suspenden las clases), las que ya terminaron sin asistencia registrada y las salidas con estudiantes. Vuelve a aparecer al terminar de guardar la ronda.',
    'Recordatorios por reunión: al crearla o editarla se elige avisar con 1, 2, 3 o 7 días de anticipación, el mismo día (15 min, 30 min, 1 o 2 horas antes, con parpadeo y vibración en el celular) y si sale al comenzar y al terminar la ronda. Durante la jornada la app lo revisa cada 3 minutos y avisa una sola vez. La hoja Reuniones recibe las columnas avisar_dias, avisar_min y avisar_ronda (se agregan solas).'] },
  { version: '2026.10.20-c', fecha: '2026-10-20', cambios: [
    'Menú principal: el botón «Horarios y consultas» ahora se llama «Horarios y listados» (también en el título de la pantalla y en el manual de Ayuda).'] },
  { version: '2026.10.20-b', fecha: '2026-10-20', cambios: [
    'Reuniones: las listas (del día, próximas y últimas) van después del formulario y del botón de crear, también dentro del formulario de crear o editar. Marcas de prioridad: HOY (alta, naranja), MAÑANA (media, amarillo), próximas (azul); las pasadas se atenúan: verdes «Aplicada» si ya tienen asistencia, grises si no.',
    'Reuniones: botón «🗑 Anular» solo para quien administra (dueño del libro, columna administra = SI en Directivos o coordinación académica); exige motivo y deja la reunión en la hoja Reuniones_Anuladas con quién, cuándo y por qué.',
    'Registrar novedades: las últimas novedades llevan la misma marca de prioridad (HOY, próxima, pasada) y etiquetas de incumplimiento y de grupo cubierto.'] },
  { version: '2026.10.20-a', fecha: '2026-10-20', cambios: [
    'Registrar novedades: nueva lista «Últimas novedades registradas» (lo más reciente primero), con las de la ronda y las del formulario, indicando de dónde vienen, quién las registró y los minutos.',
    'Reuniones: listas de «Próximas reuniones» y «Últimas reuniones», y botón «✏ Editar» para cambiar tipo, nombre, fecha, horas, clases suspendidas y convocados (la asistencia ya registrada no se borra; queda en la bitácora).'] },
  { version: '2026.10.19-e', fecha: '2026-10-19', cambios: [
    'Ronda: indicador de guardado. Verde «✔ Ronda guardada y completa» (con la hora) cuando todo está guardado; naranja «Pendiente de guardar: N reportes nuevos y M cambios» cuando hay algo sin guardar. El botón pasa a «Guardar · N» (pulsa) o «✔ Guardada», y cada 2 minutos aparece un recordatorio mientras haya algo pendiente.'] },
  { version: '2026.10.19-d', fecha: '2026-10-19', cambios: [
    'Nueva opción «Ayuda y manual de uso» en el menú principal (y en la pantalla de ingreso): guía paso a paso para los directivos y docentes, con impresión en PDF.',
    'Rectoría: el tiempo de ausencia del docente (incapacidad, licencia, permiso) se cuenta completo según su asignación aunque el grupo haya sido cubierto por un reemplazo. Panel e informe muestran «Ausencia total de docentes» y, aparte, «Horas de clase sin atender».',
    'Quién dicta en las parejas que alternan: definirlo por primera vez en la semana puede hacerlo cualquier directivo; cambiarlo solo el administrador, la coordinación académica, la rectoría o quien tenga SI en la columna cambia_asignacion (hoja Directivos).'] },
  { version: '2026.10.19-c', fecha: '2026-10-19', cambios: [
    'Ronda: nuevo estado «Con reemplazo (otra persona a cargo)»: el titular no está pero otra persona atiende el grupo (reemplazo acordado con rectoría, persona de apoyo contratada, practicante, otro docente con espacio libre). La ausencia cuenta, el grupo no queda sin atender; contador propio en la barra y lista aparte en el informe de rondas.',
    'Incapacidad, licencia, duelo, comisión de servicios y otros motivos de toda la jornada: se marca «toda la jornada» sola y el tiempo es el asignado en su horario de ese día (no se calcula a mano). Motivos nuevos: licencia de maternidad o paternidad, por luto, no remunerada, comisión de servicios, descanso compensatorio.',
    'Salida temprana: se puede escribir la hora a la que salió y el sistema calcula el tiempo sin atender con el horario del docente.',
    '«¿Quién atendió al grupo?»: nuevas opciones «No aplica (no tiene grupo asignado)» (orientación, PTAFI), persona de apoyo contratada y otro docente con espacio libre.',
    'Quién dicta en las parejas: la confirmación y la corrección ya no usan cuadros del navegador (podían bloquearse en el celular); si falla se pueden reintentar los botones.',
    'Pantalla: título, número de versión y contadores («Faltan por reportar», presentes) más grandes, sobre todo en computador; botones de estado en 3 columnas en el celular; texto sin ampliación automática en iPhone.'] },
  { version: '2026.10.19-b', fecha: '2026-10-19', cambios: [
    'Ronda: al marcar «No asistió» se muestra el total de minutos sin atender y cuántas sesiones son (antes decía «Automático»).',
    'Nuevo «Reemplazo (acordado con rectoría)» en «¿Quién atendió al grupo?». Si el grupo lo atendió un reemplazo, practicante, auxiliar u otro docente, la ausencia del docente (incapacidad, licencia) sigue contando, pero esos minutos no cuentan como «sin atender»; el panel y el informe muestran aparte los minutos cubiertos.'] },
  { version: '2026.10.19-a', fecha: '2026-10-19', cambios: [
    'Ronda en celular más compacta: barra inferior más baja, botones y tarjetas más pequeños para ver al menos dos docentes por pantalla.',
    'Hoja LEEME con título grande, versión vigente e historial de cambios (se actualiza sola al abrir el libro).'] },
  { version: '2026.10.16-d', fecha: '2026-10-16', cambios: [
    'Ronda: barra fija de conexión («Sin conexión · N marcas pendientes» / «N marcas sin guardar») y advertencia al cerrar con marcas sin guardar.'] },
  { version: '2026.10.16-c', fecha: '2026-10-16', cambios: [
    'Informe de rondas: filtro por directivo; restricción opcional con la columna ve_todo (NO = solo ve sus rondas) en la hoja Directivos.',
    'Al imprimir o guardar en PDF las rondas salen desplegadas.'] },
  { version: '2026.10.16-b', fecha: '2026-10-16', cambios: [
    'Al guardar la ronda se muestra el resumen (presentes, no asistieron, permisos, tarde, reunión, incumplimientos) con envío al correo.',
    'Panel: sección «Rondas de verificación» por bloque; las rondas van también en los informes por correo (día, semana, mes).',
    'Ronda: aparece preseleccionado el directivo que inició sesión; se puede elegir a otro (sesión prestada) y queda constancia en Bitacora_Cambios.'] },
  { version: '2026.10.16-a', fecha: '2026-10-16', cambios: [
    'Ronda: aviso amarillo con las marcas sin guardar de otros bloques del día (si la página se recarga en otro bloque).'] },
  { version: '2026.10.13-j', fecha: '2026-10-13', cambios: [
    'Ronda: botón rojo «Limpiar» (quita las marcas aún no guardadas, con «Deshacer»).',
    'Estudiantes: «Quitar marca» por estudiante o por selección (la marca queda como «Levantada» con quién y cuándo).'] },
  { version: '2026.10.13-i', fecha: '2026-10-13', cambios: [
    'Ronda: borrador local de las marcas (se recupera si se cae la señal o se recarga) y chip «N sin guardar».'] },
  { version: '2026.10.13-a a -h', fecha: '2026-10-13', cambios: [
    'Ronda: tiempos de 5 a 360 minutos (cortos para llegada tarde), «hasta el final de la jornada» con el tiempo calculado, confirmar quién dicta en parejas, cita médica y grupo despachado temprano.',
    'Ronda: «Faltan por reportar» destacado en la barra de estado.',
    'Reuniones: aseo general, examen general periódico y otra reunión con nombre; más motivos de salida con estudiantes; 90 minutos por defecto.',
    'Estudiantes: filas sombreadas por marca (retirado, deserción, ausencias, fuga) con leyenda.',
    'Corrección de quién dicta en parejas, con bitácora de cambios; correo del directivo opcional (cualquier proveedor).'] },
  { version: '2026.10.06 y anteriores', fecha: '2026-10-06', cambios: [
    'Ingreso con PIN (hash, sesiones con token, claves temporales con cambio obligatorio, restablecer clave).',
    'Ronda por bloque, parejas que alternan y quién dicta cada semana, preescolar en 4 periodos, ausencia de jornada completa una sola vez.',
    'Incumplimientos con rigor, reuniones y actividades institucionales, salidas pedagógicas, informes por correo (día, semana, mes).',
    'Pestaña Estudiantes: listado por grupo y nivel, marcas de seguimiento, grupos, selecciones y proyectos, nuevos y promovidos.',
    'Consulta de horarios, panel por rol (rector, coordinación, docente), soportes de ausencias, importación desde WhatsApp.'] }
];

var LEEME_USO = [
  'Presente / No asistió / Otro a cargo (antes Con reemplazo) / SED (evento, capacitación o taller de la Secretaría de Educación, toda la jornada) / Permiso por horas / Llegada tarde / Salida temprana / Incumplimiento: estados de cada docente en la ronda.',
  'Con reemplazo: el titular no está (incapacidad, licencia, permiso…) pero otra persona atiende el grupo en su horario. Queda «No asistió» con quién atendió; no suma minutos sin atender.',
  'No asistió sin reemplazo: el tiempo sin atender es el asignado en su horario (sesiones del bloque o toda la jornada). Incapacidad y licencia marcan «toda la jornada» solas.',
  'Salida temprana: puede escribirse la hora de salida; el tiempo se calcula con el horario del docente de ese día.',
  'Quién atendió el grupo → «No aplica (no tiene grupo asignado)» para orientación y PTAFI: no hay estudiantes sin atender.',
  'Parejas que alternan (ética/religión, etc.): se confirma quién dicta una vez por semana; «Cambiar» (solo coordinación académica, rectoría o administrador) corrige y puede pasar a la persona correcta lo ya registrado.',
  'Panel e informes: «Ausencia total de docentes» (incluye lo cubierto por reemplazo) y «Horas de clase sin atender» (solo lo que quedó sin quien atendiera).',
  'Menú principal > «Ayuda y manual de uso»: manual para los usuarios.',
  'Aviso del día: ventana de unos segundos con las reuniones y actividades de hoy sobre cualquier pantalla y al terminar de guardar la ronda; cada reunión puede tener recordatorios (días antes, minutos antes con parpadeo, al comenzar la ronda).',
  'Ronda: las marcas sin guardar se conservan en el teléfono (borrador). La barra de abajo dice «✔ Ronda guardada» (verde) o «Pendiente de guardar: N reportes nuevos y M cambios» (naranja); si no hay señal avisa «Sin conexión».'
];

var LEEME_HOJAS = [
  'Docentes          Lista oficial de docentes con su nivel.',
  'Horario           Una fila por docente / día / sesión de 45 minutos.',
  'Direccion_Grupo   Dinamizadores o directores de cada grupo.',
  'Matriz_Grupos     Para cada día y sesión, quién atiende a cada grupo.',
  'Motivos / Listas  Catálogos de motivos (salud, permisos, licencias, comisión de servicios, calamidad…) con su categoría y si son justificados.',
  'Novedades         Novedades de asistencia (una fila por docente, día y sesión); Novedades_Anuladas guarda las anuladas.',
  'Registro_Ronda    Cada marca de la ronda (presente, no asistió, tarde…) con el directivo que la hizo.',
  'Reuniones / Asistencia_Reunion / Reuniones_Anuladas   Reuniones y actividades sin estudiantes y su asistencia (se pueden editar; los cambios quedan en Bitacora_Cambios). Solo quien administra las anula y quedan en Reuniones_Anuladas. Datos de cada reunión: lugar, quién convoca, quién solicita, responsables, cómo termina (fija, tentativa o hasta finalizar la jornada) y recordatorios.',
  'Incumplimientos   Reportes con rigor (solo se agrega; seguimiento por estados).',
  'Estudiantes / Marcas_Estudiantes / Grupos_Proyectos   Listado por grupo y marcas de seguimiento (los levantados quedan en la hoja).',
  'Semana_Alternancia / Alternancias   Quién dicta cada semana en las parejas que alternan.',
  'Usuarios / Soportes / Parametros   Cuentas de docentes, soportes de ausencias y parámetros.',
  'Notas_Ronda / Bandeja_WhatsApp   Observaciones de la ronda y novedades propuestas desde WhatsApp.',
  'Directivos        Quiénes registran: claves (hash), correo, ve_todo (NO = solo ve sus rondas), cambia_asignacion (SI/NO: puede cambiar quién dicta en las parejas), administra (SI/NO: puede anular reuniones). No escriba PIN a mano.',
  'Respaldo           Libro aparte en Drive «ICET · Respaldo de rondas (no borrar)» (su id está en Parametros: respaldo_id) con cada ronda guardada.',
  'Bitacora_Cambios  Quién cambió qué y cuándo (correcciones, sesiones prestadas, intercambio de Docente 1 y 2).',
  'Datos personales de docentes y estudiantes: acceso solo para directivos (Ley 1581 de 2012).'
];

/** Filas de la hoja: [texto, tipo] con tipo titulo | version | autor | seccion | version_h | texto. */
function leemeFilas_() {
  var f = [];
  f.push(['CONTROL DE ASISTENCIA DOCENTE · I.E. ICET', 'titulo']);
  f.push(['Versión ' + VERSION_SISTEMA + ' · actualizada el ' + FECHA_VERSION, 'version']);
  f.push(['Autor: Francisco Javier Cortés Cabezas · Coordinador académico · Especialista en Informática y Telemática · Magíster en Educación · Doctorando en Desarrollo de la Educación · I.E. ICET, San Andrés de Tumaco (Nariño, Colombia) · © 2026', 'autor']);
  f.push(['', 'texto']);
  f.push(['CÓMO SE REGISTRA LA ASISTENCIA EN LA RONDA', 'seccion']);
  LEEME_USO.forEach(function (t) { f.push([t, 'texto']); });
  f.push(['', 'texto']);
  f.push(['QUÉ CONTIENE ESTE LIBRO', 'seccion']);
  LEEME_HOJAS.forEach(function (t) { f.push([t, 'texto']); });
  f.push(['', 'texto']);
  f.push(['CÓMO PUBLICAR UN CAMBIO SIN CAMBIAR LA DIRECCIÓN: pegar los archivos nuevos, guardar, Implementar > Administrar implementaciones > lápiz > Nueva versión. No usar «Nueva implementación» (crea otra dirección).', 'texto']);
  f.push(['', 'texto']);
  f.push(['HISTORIAL DE VERSIONES (la más nueva primero)', 'seccion']);
  HISTORIAL_VERSIONES.forEach(function (h) {
    f.push(['Versión ' + h.version + ' · ' + h.fecha, 'version_h']);
    h.cambios.forEach(function (c) { f.push(['   • ' + c, 'texto']); });
  });
  return f;
}

/** Escribe la hoja LEEME (la crea al principio si no existe). Se puede ejecutar cuantas veces se quiera. */
function actualizarLeeme() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('LEEME');
  if (!sh) { sh = ss.insertSheet('LEEME', 0); }
  var filas = leemeFilas_();
  sh.clear();
  sh.setColumnWidth(1, 980);
  sh.getRange(1, 1, filas.length, 1).setValues(filas.map(function (x) { return [x[0]]; })).setWrap(true).setVerticalAlignment('middle');
  filas.forEach(function (x, i) {
    var r = sh.getRange(i + 1, 1);
    if (x[1] === 'titulo') { r.setFontSize(28).setFontWeight('bold').setFontColor('#ffffff').setBackground('#0f2a5c'); sh.setRowHeight(i + 1, 64); }
    else if (x[1] === 'version') { r.setFontSize(16).setFontWeight('bold').setFontColor('#0f2a5c').setBackground('#fff3c4'); sh.setRowHeight(i + 1, 34); }
    else if (x[1] === 'autor') { r.setFontSize(10).setFontColor('#456'); }
    else if (x[1] === 'seccion') { r.setFontSize(14).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1b4a8f'); sh.setRowHeight(i + 1, 28); }
    else if (x[1] === 'version_h') { r.setFontSize(12).setFontWeight('bold').setFontColor('#0f2a5c').setBackground('#e8eef8'); }
    else { r.setFontSize(11); }
  });
  sh.setFrozenRows(2);
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);
  return { ok: true, filas: filas.length, version: VERSION_SISTEMA };
}

/** Al abrir el libro: si LEEME no muestra la versión vigente, se regenera (sin molestar si falla). */
function leemeAlDia_() {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName('LEEME');
    var a2 = sh ? String(sh.getRange(2, 1).getValue()) : '';
    if (a2.indexOf('Versión ' + VERSION_SISTEMA + ' ') !== 0) actualizarLeeme();
  } catch (e) { Logger.log('LEEME no se pudo actualizar: ' + e); }
}
