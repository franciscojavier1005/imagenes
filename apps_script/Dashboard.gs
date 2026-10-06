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
  var resumen = calcularResumen_({
    desde: desde, hasta: hasta, filtros: filtros || {}, novedades: nov, registro: reg, horario: hz,
    docentes: docs.map(function (d) { return { nombre_completo: d.nombre_completo, nivel: d.nivel }; }),
    motivos: datos_('Motivos').map(function (m) { return { motivo: m.motivo, categoria: m.categoria, justificada: m.justificada }; })
  });
  var obl = obligaciones_((filtros && filtros.docente) || '');   // soportes pendientes y vencidos (dentro del filtro de docente)
  resumen.soportes = { resumen: resumenObligaciones_(obl), vencidos: obl.filter(function (o) { return o.estado === 'Vencido'; }).slice(0, 10) };
  return resumen;
}

/** Resumen para el panel (lo llama Dashboard.html). Un docente solo recibe su propio informe. */
function datosDashboard(desde, hasta, filtros) {
  var id = identidad_();
  if (id.rol === 'directivo') return resumenInterno_(desde, hasta, filtros);
  if (id.rol === 'docente') return resumenInterno_(desde, hasta, { docente: id.docente });
  throw new Error('No tiene acceso a este panel. Pida al coordinador que lo agregue.');
}

function urlBase() { return ScriptApp.getService().getUrl(); }

/* ------------------------------ informe diario al rector ------------------------------ */
var NOMBRE_DIA_ = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Correo real de un directivo: la columna `correo` (la captura el propio directivo al ingresar) o, si no hay, un correo_temporal que no sea de ejemplo. */
function correoDe_(d) {
  var c = String(d.correo || '').trim(), t = String(d.correo_temporal || '').trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return c;
  return t && !/@example\.com$/i.test(t) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : '';
}
/** Quién recibe cada tipo de informe ('dia', 'semana', 'mes'): directivos con correo real que no lo hayan desactivado. */
function destinatarios_(tipo) {
  hojaDirectivos_();
  var out = [];
  datos_('Directivos').forEach(function (d) {
    var c = correoDe_(d), pref = String(d['informe_' + tipo] || '').trim().toUpperCase();
    if (c && pref !== 'NO' && out.indexOf(c) < 0) out.push(c);
  });
  return out;
}
function correoRector_() {
  var r = datos_('Directivos').filter(function (d) { return /rector/i.test(String(d.rol)); })[0];
  return r ? correoDe_(r) : '';
}

/** Incumplimientos reportados en un periodo (sección del informe por correo). */
function htmlIncumplimientos_(desde, hasta) {
  var l = datosOCrea_('Incumplimientos', COL_INCUMPL).filter(function (r) { var f = fechaIso_(limpiaTxt_(r.fecha)); return f >= desde && f <= hasta; });
  if (!l.length) return '';
  var e = resEsc_;
  return '<div style="margin-top:12px;border-left:4px solid #7b1fa2;padding:6px 10px;background:#f6e9fa"><div style="font-weight:600;color:#5a1273">Incumplimientos reportados (' + l.length + ')</div>' +
    l.map(function (r) { return '<div style="font-size:13px;margin-top:6px"><b>' + e(r.docente) + '</b> · ' + e(String(r.tipo).replace('Incumplimiento: ', '')) + ' · ' + e(r.sesiones) +
      (Number(r.reincidencia) > 1 ? ' · ' + e(r.reincidencia) + '.º reporte' : '') + '<br>' + e(r.descripcion) + ' <span style="color:#74736d">(' + e(r.registrado_por) + ')</span></div>'; }).join('') + '</div>';
}

/**
 * Envía el informe del día, de la semana o del mes a los directivos con correo. tipo: 'dia' | 'semana' | 'mes'.
 * soloA: lista de correos (prueba). Devuelve {enviado, para:[...], motivo?}.
 */
function enviarInformes_(tipo, soloProbar, soloA) {
  var hoy = new Date(), u = Number(Utilities.formatDate(hoy, TZ, 'u'));
  if (u > 5 && !soloProbar) return { enviado: false, motivo: 'fin de semana' };
  var f = ymd_(hoy), desde = f, nombre = 'del día', fechaTexto = NOMBRE_DIA_[u] + ' ' + Utilities.formatDate(hoy, TZ, "d 'de' MMMM 'de' yyyy");
  if (tipo === 'semana') { desde = lunesDe_(f); nombre = 'de la semana'; fechaTexto = 'Semana del ' + desde + ' al ' + f; }
  if (tipo === 'mes') { desde = f.slice(0, 8) + '01'; nombre = 'del mes'; fechaTexto = 'Mes de ' + Utilities.formatDate(hoy, TZ, 'MMMM yyyy') + ' (hasta el ' + f + ')'; }
  var r = resumenInterno_(desde, f, {});
  var cuerpo = htmlInforme_(r, fechaTexto, ScriptApp.getService().getUrl() + '?p=panel') + htmlReunionesInforme_(desde, f) + htmlIncumplimientos_(desde, f);
  var para = soloA || destinatarios_(tipo);
  if (!para.length) { Logger.log('Informe NO enviado: ningún directivo tiene correo real registrado.'); return { enviado: false, motivo: 'sin correos', html: cuerpo }; }
  para.forEach(function (c) {
    MailApp.sendEmail({ to: c, subject: 'ICET - Informe ' + nombre + ' (' + f + '): ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  });
  return { enviado: true, para: para, tipo: tipo };
}
/** Compatibilidad: informe del día. */
function enviarInformeDiario_(soloProbar) { var r = enviarInformes_('dia', soloProbar); if (r.enviado) r.para = r.para.join(', '); return r; }

/** Prueba desde el menú del libro: se envía el informe del día solo a quien lo pide. */
function probarInformeDiario() {
  exigirEditor_();
  var yo = emailActual_(), r = enviarInformes_('dia', true, yo ? [yo] : []);
  SpreadsheetApp.getUi().alert(r.enviado ? 'Informe de prueba enviado a ' + yo + '.'
    : 'No se envió: ' + (r.motivo || 'sin correo') + '.');
}

/** ¿Es hoy el último día hábil (lunes a viernes) del mes? */
function ultimoHabilDelMes_(f) {
  var s = resSumaDias_(f, 1), d = resDia_(s);
  while (d === 0 || d === 6) { s = resSumaDias_(s, 1); d = resDia_(s); }
  return s.slice(0, 7) !== f.slice(0, 7);
}
/**
 * Función que ejecuta el reloj del libro (lunes a viernes, hacia la 1:35 p. m., al terminar la jornada). Pública pero inofensiva:
 * envía como máximo una vez por día y no devuelve datos. Los viernes agrega el informe de la semana y el último día hábil del mes, el del mes.
 */
function informeDiarioProgramado() {
  var props = PropertiesService.getScriptProperties(), hoy = ymd_(new Date());
  if (props.getProperty('ultimo_informe') === hoy) return;
  props.setProperty('ultimo_informe', hoy);
  enviarInformes_('dia', false);
  if (Number(Utilities.formatDate(new Date(), TZ, 'u')) === 5) enviarInformes_('semana', false);
  if (ultimoHabilDelMes_(hoy)) enviarInformes_('mes', false);
}
function programarInformeDiario() {
  exigirEditor_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['enviarInformeDiario', 'informeDiarioProgramado'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('informeDiarioProgramado').timeBased().everyDays(1).atHour(13).nearMinute(35).inTimezone(TZ).create();
  SpreadsheetApp.getUi().alert('Programado: de lunes a viernes, hacia la 1:35 p. m., se envía el informe del día a los directivos con correo registrado (los viernes también el de la semana; el último día hábil del mes, el del mes).');
}
