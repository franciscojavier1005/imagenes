/**
 * FRONT: la aplicación web que abren docentes y directivos (el enlace que se comparte).
 *
 * Se despliega como proyecto independiente de Apps Script, "Ejecutar como: el usuario que accede a la aplicación". Así Google
 * identifica a cada persona por su cuenta (Gmail u otra con cuenta Google) en el celular o el computador, sin que el docente
 * tenga acceso al libro. Cada función llama al BACK (proyecto vinculado al libro, ver Api.gs) enviando el correo ya verificado
 * y un secreto compartido. Las pantallas (Consulta.html y Dashboard.html) son las mismas del proyecto principal.
 *
 * Propiedades del script (Configuración del proyecto): BACK_URL = URL /exec del back, API_SECRET = el mismo secreto del back.
 */
function doGet(e) {
  var p = (e && e.parameter && e.parameter.p) || 'menu';   // sin parámetros abre el menú de entrada
  var PAGINAS = { menu: ['Menu', 'ICET - Control de asistencia docente'], ronda: ['Consulta', 'ICET - Ronda de asistencia docente'], reunion: ['Reunion', 'ICET - Reuniones y jornadas'], horarios: ['Horarios', 'ICET - Horarios y consultas'], panel: ['Dashboard', 'ICET - Asistencia docente'] };
  var pg = PAGINAS[p] || PAGINAS.menu;
  return HtmlService.createHtmlOutputFromFile(pg[0])
    .setTitle(pg[1])
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function urlBase() { return ScriptApp.getService().getUrl(); }

function llamar_(fn, args) {
  var props = PropertiesService.getScriptProperties();
  var respuesta = UrlFetchApp.fetch(props.getProperty('BACK_URL'), {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify({ secret: props.getProperty('API_SECRET'), email: Session.getActiveUser().getEmail(), fn: fn, args: args })
  });
  var salida;
  try { salida = JSON.parse(respuesta.getContentText()); } catch (e) { throw new Error('El servicio no respondió correctamente. Intente de nuevo.'); }
  if (!salida.ok) throw new Error(salida.error || 'Error');
  return salida.data;
}

/* Cada función que usan las pantallas con google.script.run. */
function contextoPanel() { return llamar_('contextoPanel', []); }
function solicitarAcceso(p) { return llamar_('solicitarAcceso', [p]); }
function aceptarAutorizacion() { return llamar_('aceptarAutorizacion', []); }
function listarSolicitudes() { return llamar_('listarSolicitudes', []); }
function resolverSolicitud(p) { return llamar_('resolverSolicitud', [p]); }
function consultarSesion(dia, sesion) { return llamar_('consultarSesion', [dia, sesion]); }
function guardarRonda(p) { return llamar_('guardarRonda', [p]); }
function datosDashboard(desde, hasta, filtros) { return llamar_('datosDashboard', [desde, hasta, filtros]); }
function misSoportes() { return llamar_('misSoportes', []); }
function subirSoporte(p) { return llamar_('subirSoporte', [p]); }
function soportesPorRevisar() { return llamar_('soportesPorRevisar', []); }
function revisarSoporte(p) { return llamar_('revisarSoporte', [p]); }
function guardarNotaRonda(p) { return llamar_('guardarNotaRonda', [p]); }
function listarPropuestas() { return llamar_('listarPropuestas', []); }
function resolverPropuesta(p) { return llamar_('resolverPropuesta', [p]); }
function definirAlternancia(p) { return llamar_('definirAlternancia', [p]); }
function listarReuniones(p) { return llamar_('listarReuniones', [p]); }
function crearReunion(p) { return llamar_('crearReunion', [p]); }
function cargarReunion(p) { return llamar_('cargarReunion', [p]); }
function guardarAsistenciaReunion(p) { return llamar_('guardarAsistenciaReunion', [p]); }
function listarIncumplimientos(p) { return llamar_('listarIncumplimientos', [p]); }
function actualizarSeguimiento(p) { return llamar_('actualizarSeguimiento', [p]); }
function consultaHorarios(p) { return llamar_('consultaHorarios', [p]); }
function guardarCorreo(p) { return llamar_('guardarCorreo', [p]); }
