/**
 * API del "back": el proyecto vinculado al libro, desplegado como aplicación web que se ejecuta COMO EL PROPIETARIO
 * (así lee el libro y la carpeta de soportes sin dar acceso a los docentes) y accesible para cualquiera con el enlace.
 *
 * Solo responde a peticiones POST firmadas con un secreto compartido (propiedad del script API_SECRET) que conoce únicamente el
 * proyecto "front" (apps_script/front). El front es quien verifica el correo del usuario con Google y lo reenvía; el back confía
 * en ese correo solo si el secreto es correcto, y luego aplica la matriz de permisos de abajo.
 */
var API_PERMISOS = {   // función -> roles que pueden llamarla ('*' = cualquiera)
  contextoPanel: ['*'],
  solicitarAcceso: ['sin_registro'],
  aceptarAutorizacion: ['docente'],
  listarSolicitudes: ['directivo'],
  resolverSolicitud: ['directivo'],
  consultarSesion: ['directivo'],
  guardarRonda: ['directivo'],
  datosDashboard: ['directivo', 'docente'],
  misSoportes: ['docente'],
  subirSoporte: ['docente'],
  soportesPorRevisar: ['directivo'],
  revisarSoporte: ['directivo'],
  guardarNotaRonda: ['directivo'],
  listarPropuestas: ['directivo'],
  resolverPropuesta: ['directivo'],
  definirAlternancia: ['directivo'],
  listarReuniones: ['directivo'],
  crearReunion: ['directivo'],
  cargarReunion: ['directivo'],
  guardarAsistenciaReunion: ['directivo'],
  cambiarClave: ['directivo']
};

function apiFunciones_() {
  return {
    contextoPanel: contextoPanel, solicitarAcceso: solicitarAcceso, aceptarAutorizacion: aceptarAutorizacion,
    listarSolicitudes: listarSolicitudes, resolverSolicitud: resolverSolicitud, consultarSesion: consultarSesion, guardarRonda: guardarRonda,
    datosDashboard: datosDashboard, misSoportes: misSoportes, subirSoporte: subirSoporte,
    soportesPorRevisar: soportesPorRevisar, revisarSoporte: revisarSoporte,
    guardarNotaRonda: guardarNotaRonda, listarPropuestas: listarPropuestas, resolverPropuesta: resolverPropuesta, definirAlternancia: definirAlternancia,
    listarReuniones: listarReuniones, crearReunion: crearReunion, cargarReunion: cargarReunion, guardarAsistenciaReunion: guardarAsistenciaReunion,
    cambiarClave: cambiarClave
  };
}

/** Comparación en tiempo constante para no revelar el secreto por diferencias de tiempo. */
function igualConstante_(a, b) {
  a = String(a || ''); b = String(b || '');
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/** Ejecuta una función de la API para un correo ya verificado (por el front con secreto, o por una sesión con clave). */
function apiDespachar_(email, fn, args) {
  var permitidos = API_PERMISOS[fn], tabla = apiFunciones_();
  if (!permitidos || !tabla[fn]) return { ok: false, error: 'Función no permitida' };
  REQ_EMAIL = email || '';
  try {
    var rol = identidad_().rol;
    if (permitidos.indexOf('*') < 0 && permitidos.indexOf(rol) < 0) return { ok: false, error: 'Sin permiso para esta acción (' + rol + ').' };
    return { ok: true, data: tabla[fn].apply(null, args || []) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { REQ_EMAIL = null; }
}

/** Petición del proyecto "front" (modo B): exige el secreto compartido. Separada de doPost para poder probarla. */
function apiEjecutar_(req, secretoEsperado) {
  if (!secretoEsperado || !igualConstante_(req && req.secret, secretoEsperado)) return { ok: false, error: 'No autorizado' };
  return apiDespachar_(req.email, req.fn, req.args);
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Petición inválida' })).setMimeType(ContentService.MimeType.JSON); }
  var out = apiEjecutar_(req, PropertiesService.getScriptProperties().getProperty('API_SECRET'));
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
