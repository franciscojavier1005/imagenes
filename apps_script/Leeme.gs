/**
 * Hoja LEEME del libro: título grande, versión vigente, qué contiene cada hoja e historial de cambios.
 * Se regenera sola al abrir el libro si la versión escrita en LEEME no es la de este código, o desde el menú
 * «Actualizar hoja LEEME». REGLA: cada vez que se cambie la versión (sello en el pie de las pantallas), actualizar
 * VERSION_SISTEMA e HISTORIAL_VERSIONES aquí (la prueba leeme.test.js lo verifica).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var VERSION_SISTEMA = '2026.10.19-a';
var FECHA_VERSION = '2026-10-19';

/** De la más nueva a la más antigua. */
var HISTORIAL_VERSIONES = [
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

var LEEME_HOJAS = [
  'Docentes          Lista oficial de docentes con su nivel.',
  'Horario           Una fila por docente / día / sesión de 45 minutos.',
  'Direccion_Grupo   Dinamizadores o directores de cada grupo.',
  'Matriz_Grupos     Para cada día y sesión, quién atiende a cada grupo.',
  'Motivos / Listas  Catálogos de motivos (con su categoría y si son justificados) y de opciones.',
  'Novedades         Novedades de asistencia (una fila por docente, día y sesión); Novedades_Anuladas guarda las anuladas.',
  'Registro_Ronda    Cada marca de la ronda (presente, no asistió, tarde…) con el directivo que la hizo.',
  'Reuniones / Asistencia_Reunion   Reuniones y actividades sin estudiantes y su asistencia.',
  'Incumplimientos   Reportes con rigor (solo se agrega; seguimiento por estados).',
  'Estudiantes / Marcas_Estudiantes / Grupos_Proyectos   Listado por grupo y marcas de seguimiento (los levantados quedan en la hoja).',
  'Semana_Alternancia / Alternancias   Quién dicta cada semana en las parejas que alternan.',
  'Usuarios / Soportes / Parametros   Cuentas de docentes, soportes de ausencias y parámetros.',
  'Notas_Ronda / Bandeja_WhatsApp   Observaciones de la ronda y novedades propuestas desde WhatsApp.',
  'Directivos        Quiénes registran: claves (hash), correo, ve_todo (NO = solo ve sus rondas). No escriba PIN a mano.',
  'Bitacora_Cambios  Quién cambió qué y cuándo (correcciones, sesiones prestadas).',
  'Datos personales de docentes y estudiantes: acceso solo para directivos (Ley 1581 de 2012).'
];

/** Filas de la hoja: [texto, tipo] con tipo titulo | version | autor | seccion | version_h | texto. */
function leemeFilas_() {
  var f = [];
  f.push(['CONTROL DE ASISTENCIA DOCENTE · I.E. ICET', 'titulo']);
  f.push(['Versión ' + VERSION_SISTEMA + ' · actualizada el ' + FECHA_VERSION, 'version']);
  f.push(['Autor: Francisco Javier Cortés Cabezas · Coordinador académico · Especialista en Informática y Telemática · Magíster en Educación · Doctorando en Desarrollo de la Educación · I.E. ICET, San Andrés de Tumaco (Nariño, Colombia) · © 2026', 'autor']);
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
