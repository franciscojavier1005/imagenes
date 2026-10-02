/**
 * Panel (dashboard) e informe diario al rector.
 * Hojas que lee: Novedades, Registro_Ronda, Horario, Docentes, Motivos, Directivos.
 */

function fechaIso_(v) {
  if (v instanceof Date) return ymd_(v);
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);          // dd/mm/aaaa (formato del formulario actual)
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s.slice(0, 10);
}

/* ------------------------------ acceso por rol ------------------------------ */
function emailActual_() { try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; } }

function editoresLibro_() {
  var out = [];
  try {
    var ss = SpreadsheetApp.getActive();
    ss.getEditors().forEach(function (u) { out.push(String(u.getEmail()).toLowerCase()); });
    var o = ss.getOwner(); if (o) out.push(String(o.getEmail()).toLowerCase());
  } catch (e) { /* sin permiso para listar editores */ }
  return out;
}

/**
 * Quién es quien abre el panel:
 *  - directivo: editor del libro o listado en la hoja Directivos (rector -> vista rector; los demás -> coordinación)
 *  - docente:   su correo está en la hoja Docentes -> solo ve su propio informe
 *  - sin_acceso: cualquier otra persona
 */
function contextoPanel() {
  var email = emailActual_();
  var docs = datos_('Docentes');
  var dir = datos_('Directivos').filter(function (d) { return email && String(d.correo_temporal).toLowerCase() === email; })[0];
  if (email && (editoresLibro_().indexOf(email) >= 0 || dir)) {
    var niveles = {}; docs.forEach(function (d) { niveles[d.nivel] = 1; });
    return {
      rol: 'directivo', vistaInicial: dir && /rector/i.test(String(dir.rol)) ? 'rector' : 'coordinacion',
      docentes: docs.filter(function (d) { return d.nivel !== 'REEMPLAZADO'; }).map(function (d) { return { nombre: d.nombre_completo, nivel: d.nivel }; }),
      niveles: Object.keys(niveles).filter(function (n) { return n !== 'REEMPLAZADO'; }).sort()
    };
  }
  var yo = docs.filter(function (d) { return email && d.correo && String(d.correo).toLowerCase() === email; })[0];
  if (yo) return { rol: 'docente', vistaInicial: 'docente', docente: yo.nombre_completo };
  return { rol: 'sin_acceso' };
}

/** Cálculo sin control de acceso (lo usan el informe diario y el panel ya autorizado). */
function resumenInterno_(desde, hasta, filtros) {
  var nivelDe = {};
  var docs = datos_('Docentes');
  docs.forEach(function (d) { nivelDe[d.nombre_completo] = d.nivel; });
  var nov = datos_('Novedades').map(function (n) {
    return { fecha: fechaIso_(n['Fecha Novedad']), docente: n['Docente'], tipo: n['Tipo Novedad'], motivo: n['Motivo Ausencia'],
             justificada: n['Justificada'], categoria: n['Categoría motivo'], grado: n['Grado'], grupo: n['Grupo'], area: n['Área/Asignatura'],
             minutos: n['Minutos Desatendidos'], directivo: n['Directivo Docente'] };
  });
  var reg = datos_('Registro_Ronda').map(function (r) { return { fecha: fechaIso_(r.fecha), sesion: r.sesion, docente: r.docente, estado: r.estado }; });
  var hz = datos_('Horario').map(function (h) { return { dia: h.dia, hora: Number(h.hora), docente: h.docente, nivel: nivelDe[h.docente] || 'SIN NIVEL' }; });
  return calcularResumen_({
    desde: desde, hasta: hasta, filtros: filtros || {}, novedades: nov, registro: reg, horario: hz,
    docentes: docs.map(function (d) { return { nombre_completo: d.nombre_completo, nivel: d.nivel }; }),
    motivos: datos_('Motivos').map(function (m) { return { motivo: m.motivo, categoria: m.categoria, justificada: m.justificada }; })
  });
}

/** Resumen para el panel (lo llama Dashboard.html). Un docente solo recibe su propio informe. */
function datosDashboard(desde, hasta, filtros) {
  var c = contextoPanel();
  if (c.rol === 'sin_acceso') throw new Error('No tiene acceso a este panel. Pida al coordinador que lo agregue.');
  if (c.rol === 'docente') filtros = { docente: c.docente };
  return resumenInterno_(desde, hasta, filtros);
}

function urlBase() { return ScriptApp.getService().getUrl(); }

/* ------------------------------ informe diario al rector ------------------------------ */
var NOMBRE_DIA_ = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function correoRector_() {
  var r = datos_('Directivos').filter(function (d) { return /rector/i.test(String(d.rol)); })[0];
  var c = r ? String(r.correo_temporal).trim() : '';
  return c && !/@example\.com$/i.test(c) ? c : '';
}

/** Envía el informe del día al rector. Se ejecuta por disparador (lunes a viernes) o desde el menú. */
function enviarInformeDiario(soloProbar) {
  var hoy = new Date(), u = Number(Utilities.formatDate(hoy, TZ, 'u'));
  if (u > 5 && !soloProbar) return { enviado: false, motivo: 'fin de semana' };
  var f = ymd_(hoy), r = resumenInterno_(f, f, {});
  var fechaTexto = NOMBRE_DIA_[u] + ' ' + Utilities.formatDate(hoy, TZ, "d 'de' MMMM 'de' yyyy");
  var cuerpo = htmlInforme_(r, fechaTexto, ScriptApp.getService().getUrl() + '?p=panel');
  var para = correoRector_();
  if (!para) { Logger.log('Informe NO enviado: el correo del rector es temporal (hoja Directivos).'); return { enviado: false, motivo: 'correo temporal', html: cuerpo }; }
  MailApp.sendEmail({ to: para, subject: 'ICET - Asistencia docente ' + f + ': ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  return { enviado: true, para: para };
}

function probarInformeDiario() {
  var r = enviarInformeDiario(true);
  SpreadsheetApp.getUi().alert(r.enviado ? 'Informe enviado a ' + r.para
    : 'No se envió: ' + r.motivo + '.\nCuando la hoja Directivos tenga el correo real del rector, vuelva a probar.');
}

/** Programa el envío diario a las 2:30 p. m. (después de la jornada). */
function programarInformeDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'enviarInformeDiario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('enviarInformeDiario').timeBased().everyDays(1).atHour(14).nearMinute(30).inTimezone(TZ).create();
  SpreadsheetApp.getUi().alert('Programado: el informe se enviará al rector de lunes a viernes, hacia las 2:30 p. m.');
}
