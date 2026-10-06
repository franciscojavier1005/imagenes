/**
 * Identidad y acceso por correo.
 *
 * Cada persona se identifica con su cuenta de Google (Gmail u otro correo con cuenta Google), desde el celular o el computador.
 *  - directivo:    editor del libro o listado en la hoja Directivos.
 *  - docente:      correo activo en la hoja Usuarios (o escrito de antemano en Docentes.correo). Ve solo lo suyo.
 *  - pendiente:    pidió acceso y espera la aprobación de un directivo.
 *  - sin_registro: primera vez: elige su nombre, acepta la autorización de datos y queda pendiente (se registra una sola vez).
 *  - bloqueado / anonimo: sin acceso.
 *
 * Cuando la petición llega desde el proyecto "front" (ver Api.gs), el correo viene verificado por el front en REQ_EMAIL.
 */
var REQ_EMAIL = null;
var TEXTO_AUTORIZACION_VERSION = 'v1-borrador';
var TEXTO_AUTORIZACION =
  'BORRADOR para revisión de la institución (no es asesoría jurídica). ' +
  'Autorizo a la Institución Educativa [NOMBRE DE LA INSTITUCIÓN], como responsable del tratamiento, a recolectar, almacenar y usar mis datos personales ' +
  '(nombre, correo, horario, asistencia y novedades) y los soportes que yo cargue, que pueden incluir datos sensibles de salud (incapacidades, constancias, ' +
  'epicrisis) y de mi familia (actas, citaciones), con la finalidad exclusiva de controlar la asistencia, justificar mis ausencias y cumplir la normatividad laboral. ' +
  'Los datos sensibles son facultativos: puedo no entregarlos, aunque sin soporte la ausencia no podrá justificarse. ' +
  'Solo los verán los directivos docentes. Conozco mis derechos de conocer, actualizar, rectificar y suprimir mis datos y de revocar esta autorización ' +
  '(Ley 1581 de 2012 y Decreto 1377 de 2013), que ejerzo escribiendo a [CORREO DE CONTACTO]. Se conservarán mientras dure la relación laboral y el tiempo que exija la ley.';

/** Quien llama debe haber iniciado sesión como directivo (con clave, o con cuenta de Google en el modo anterior). */
function exigirDirectivo_() {
  var id = identidad_();
  if (id.rol !== 'directivo') throw new Error('Debe iniciar sesión.');
  return id;
}
/** Acciones del menú del libro: solo quien es editor del libro (nadie desde la aplicación web pública). */
function exigirEditor_() {
  var email = emailActual_();
  if (!email || editoresLibro_().indexOf(email) < 0) throw new Error('Esta acción solo se hace desde el libro, con su cuenta.');
}

function emailActual_() {
  if (REQ_EMAIL !== null) return String(REQ_EMAIL).toLowerCase();
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}

function editoresLibro_() {
  var out = [];
  try {
    var ss = SpreadsheetApp.getActive();
    ss.getEditors().forEach(function (u) { out.push(String(u.getEmail()).toLowerCase()); });
    var o = ss.getOwner(); if (o) out.push(String(o.getEmail()).toLowerCase());
  } catch (e) { /* sin permiso para listar editores */ }
  return out;
}

/** Devuelve la hoja; si no existe la crea con los encabezados (los libros anteriores no tienen Usuarios ni Soportes). */
function hojaOCrea_(nombre, cabeceras) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.appendRow(cabeceras); }
  return sh;
}
/** Como datos_(), pero si la hoja no existe todavía (libros anteriores) la crea con sus encabezados. */
function datosOCrea_(nombre, cabeceras) { hojaOCrea_(nombre, cabeceras); return datos_(nombre); }
var COL_USUARIOS = ['email', 'docente', 'estado', 'fecha_solicitud', 'autoriza_datos', 'fecha_autorizacion', 'version_texto', 'aprobado_por', 'fecha_aprobacion'];

function ahoraTxt_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }

function nombreDirectivo_(email) {
  var d = datos_('Directivos').filter(function (x) { return String(x.correo_temporal).toLowerCase() === email; })[0];
  return d ? d.nombre : '';
}

/** Quién es la persona que llama. No escribe nada. */
function identidad_() {
  var email = emailActual_();
  if (!email) return { rol: 'anonimo', email: '' };
  var dir = datos_('Directivos').filter(function (d) { return String(d.correo_temporal).toLowerCase() === email; })[0];
  if (editoresLibro_().indexOf(email) >= 0 || dir) {
    return { rol: 'directivo', email: email, nombre: dir ? dir.nombre : email, vistaInicial: dir && /rector/i.test(String(dir.rol)) ? 'rector' : 'coordinacion' };
  }
  var us = datosOCrea_('Usuarios', COL_USUARIOS).filter(function (u) { return String(u.email).toLowerCase() === email; })[0];
  if (us) {
    if (us.estado === 'ACTIVO') return { rol: 'docente', email: email, docente: us.docente, autorizado: String(us.autoriza_datos).toUpperCase() === 'SI' };
    if (us.estado === 'PENDIENTE') return { rol: 'pendiente', email: email, docente: us.docente };
    return { rol: 'bloqueado', email: email };
  }
  var pre = datos_('Docentes').filter(function (d) { return d.correo && String(d.correo).toLowerCase() === email; })[0];   // correo escrito de antemano
  if (pre) return { rol: 'docente', email: email, docente: pre.nombre_completo, autorizado: false, preregistro: true };
  return { rol: 'sin_registro', email: email };
}

function nombresRegistro_() {
  return datos_('Docentes').filter(function (d) { return d.nivel !== 'REEMPLAZADO'; }).map(function (d) { return d.nombre_completo; })
    .sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

/** Lo primero que pide la pantalla: qué rol tiene quien la abre y qué datos necesita. */
function contextoPanel() {
  var id = identidad_();
  if (id.rol === 'directivo') {
    var docs = datos_('Docentes').filter(function (d) { return d.nivel !== 'REEMPLAZADO'; }), niveles = {};
    docs.forEach(function (d) { niveles[d.nivel] = 1; });
    var ec = estadoCorreo_(id);
    return { rol: 'directivo', nombre: id.nombre, vistaInicial: id.vistaInicial, necesitaCorreo: ec.necesitaCorreo, correo: ec.correo || '', informes: ec.informes || null,
             docentes: docs.map(function (d) { return { nombre: d.nombre_completo, nivel: d.nivel }; }), niveles: Object.keys(niveles).sort() };
  }
  if (id.rol === 'docente') {
    return { rol: 'docente', vistaInicial: 'docente', docente: id.docente, autorizado: id.autorizado, textoAutorizacion: TEXTO_AUTORIZACION, version: TEXTO_AUTORIZACION_VERSION };
  }
  if (id.rol === 'sin_registro') {
    return { rol: 'sin_registro', email: id.email, docentes: nombresRegistro_(), textoAutorizacion: TEXTO_AUTORIZACION, version: TEXTO_AUTORIZACION_VERSION };
  }
  return { rol: id.rol, email: id.email, docente: id.docente || '' };
}

/* ------------------------------ registro de docentes ------------------------------ */
/** Primera vez: la persona elige su nombre y acepta la autorización. Queda PENDIENTE hasta que un directivo la apruebe. */
function solicitarAcceso(p) {
  var id = identidad_();
  if (id.rol !== 'sin_registro') throw new Error('Esta cuenta ya está registrada.');
  if (!p || p.autoriza !== true) throw new Error('Debe aceptar la autorización de tratamiento de datos.');
  if (nombresRegistro_().indexOf(p.docente) < 0) throw new Error('Elija su nombre de la lista.');
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), ahora = ahoraTxt_();
  sh.appendRow([id.email, p.docente, 'PENDIENTE', ahora, 'SI', ahora, TEXTO_AUTORIZACION_VERSION, '', '']);
  return { estado: 'PENDIENTE' };
}

/** Docente preregistrado por correo (hoja Docentes): acepta la autorización la primera vez. */
function aceptarAutorizacion() {
  var id = identidad_();
  if (id.rol !== 'docente') throw new Error('Solo un docente puede aceptar la autorización.');
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), v = sh.getDataRange().getValues(), ahora = ahoraTxt_();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === id.email) {
      sh.getRange(i + 1, 5).setValue('SI'); sh.getRange(i + 1, 6).setValue(ahora); sh.getRange(i + 1, 7).setValue(TEXTO_AUTORIZACION_VERSION);
      return { autorizado: true };
    }
  }
  sh.appendRow([id.email, id.docente, 'ACTIVO', ahora, 'SI', ahora, TEXTO_AUTORIZACION_VERSION, 'preregistro (hoja Docentes)', ahora]);
  return { autorizado: true };
}

/** Directivos: solicitudes pendientes y cuentas activas. */
function listarSolicitudes() {
  exigirDirectivo_();
  var us = datosOCrea_('Usuarios', COL_USUARIOS);
  return {
    pendientes: us.filter(function (u) { return u.estado === 'PENDIENTE'; }).map(function (u) { return { email: u.email, docente: u.docente, fecha: u.fecha_solicitud }; }),
    activos: us.filter(function (u) { return u.estado === 'ACTIVO'; }).map(function (u) { return { email: u.email, docente: u.docente }; })
  };
}

/** Directivos: aprueban, rechazan o bloquean una cuenta. p = {email, accion: APROBAR | RECHAZAR | BLOQUEAR} */
function resolverSolicitud(p) {
  var id = identidad_();
  if (id.rol !== 'directivo') throw new Error('Solo un directivo puede resolver solicitudes.');
  var estado = { APROBAR: 'ACTIVO', RECHAZAR: 'RECHAZADO', BLOQUEAR: 'BLOQUEADO' }[p && p.accion];
  if (!estado) throw new Error('Acción no válida.');
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), v = sh.getDataRange().getValues(), ok = false;
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === String(p.email).toLowerCase()) {
      sh.getRange(i + 1, 3).setValue(estado); sh.getRange(i + 1, 8).setValue(id.nombre || id.email); sh.getRange(i + 1, 9).setValue(ahoraTxt_()); ok = true;
    }
  }
  if (!ok) throw new Error('No se encontró esa solicitud.');
  return { email: p.email, estado: estado };
}
