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

/** Resumen para el panel. Lo llama la página Dashboard.html. */
function datosDashboard(desde, hasta) {
  var nov = datos_('Novedades').map(function (n) {
    return { fecha: fechaIso_(n['Fecha Novedad']), docente: n['Docente'], tipo: n['Tipo Novedad'], motivo: n['Motivo Ausencia'],
             justificada: n['Justificada'], categoria: n['Categoría motivo'], grado: n['Grado'], grupo: n['Grupo'], area: n['Área/Asignatura'],
             minutos: n['Minutos Desatendidos'], directivo: n['Directivo Docente'] };
  });
  var reg = datos_('Registro_Ronda').map(function (r) { return { fecha: fechaIso_(r.fecha), sesion: r.sesion, docente: r.docente, estado: r.estado }; });
  var hz = datos_('Horario').map(function (h) { return { dia: h.dia, hora: Number(h.hora) }; });
  return calcularResumen_({
    desde: desde, hasta: hasta, novedades: nov, registro: reg, horario: hz,
    docentes: datos_('Docentes').map(function (d) { return { nombre_completo: d.nombre_completo, nivel: d.nivel }; }),
    motivos: datos_('Motivos').map(function (m) { return { motivo: m.motivo, categoria: m.categoria, justificada: m.justificada }; })
  });
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
  var f = ymd_(hoy), r = datosDashboard(f, f);
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
