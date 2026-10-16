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
  var cuerpo = htmlInforme_(r, fechaTexto, ScriptApp.getService().getUrl() + '?p=panel') + htmlReunionesInforme_(desde, f) + htmlIncumplimientos_(desde, f) + htmlRondas_(desde, f, '', tipo === 'dia');
  var para = soloA || destinatarios_(tipo);
  if (!para.length) { Logger.log('Informe NO enviado: ningún directivo tiene correo real registrado.'); return { enviado: false, motivo: 'sin correos', html: cuerpo }; }
  para.forEach(function (c) {
    MailApp.sendEmail({ to: c, subject: 'ICET - Informe ' + nombre + ' (' + f + '): ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  });
  return { enviado: true, para: para, tipo: tipo };
}
/**
 * El directivo se envía a sí mismo el informe del periodo que está viendo. El correo puede ser de cualquier proveedor (no solo Google) y se pide
 * en ese momento si aún no lo tiene registrado: p = {desde, hasta, correo?, recordar?}. Sin correo registrado ni enviado responde NECESITA_CORREO.
 */
function enviarInformeAMi(p) {
  var id = exigirDirectivo_();
  p = p || {};
  var desde = String(p.desde || ''), hasta = String(p.hasta || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde || hasta > resSumaDias_(desde, 400)) throw new Error('Revise las fechas del informe.');
  var correo = String(p.correo || '').trim().toLowerCase();
  if (correo) {
    if (!correoValido_(correo)) throw new Error('Escriba un correo válido.');
    if (p.recordar) { var ec0 = estadoCorreo_(id), inf = ec0.informes || { dia: true, semana: true, mes: true }; guardarCorreo({ correo: correo, dia: inf.dia, semana: inf.semana, mes: inf.mes }); }
  } else {
    correo = String(estadoCorreo_(id).correo || '');
  }
  if (!correo) throw new Error('NECESITA_CORREO');
  var r = resumenInterno_(desde, hasta, {});
  var cuerpo = htmlInforme_(r, 'Del ' + desde + ' al ' + hasta, ScriptApp.getService().getUrl() + '?p=panel') + htmlReunionesInforme_(desde, hasta) + htmlIncumplimientos_(desde, hasta) + htmlRondas_(desde, hasta, '', hasta === desde);
  MailApp.sendEmail({ to: correo, subject: 'ICET - Informe del ' + desde + ' al ' + hasta + ': ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  return { ok: true, para: correo };
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

/* ------------------------------ informe de rondas (quién estuvo, quién no, quién tiene novedad) ------------------------------ */
var PRIORIDAD_RONDA_ = ['Presente', 'En reunión', 'En actividad externa', 'Llegada tarde', 'Salida temprana', 'Ausente temporal', 'No asistió'];
function escRonda_(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function categoriaRonda_(estado) {
  if (estado === 'Presente') return 'presentes';
  if (estado === 'No asistió') return 'noAsistieron';
  if (estado === 'Ausente temporal') return 'permisos';
  if (estado === 'Llegada tarde' || estado === 'Salida temprana') return 'tardes';
  if (estado === 'En reunión' || estado === 'En actividad externa') return 'fuera';
  return 'incumplimientos';
}
/**
 * Rondas guardadas entre dos fechas, una por (fecha, bloque, directivo). Cada docente aparece una sola vez por bloque, con su situación más
 * seria. directivo: nombre exacto o vacío para todos. Devuelve {bloques:[{fecha,dia,bloque,directivo,presentes:[],noAsistieron:[],...}], directivos:[]}.
 */
function rondasInterno_(desde, hasta, directivo) {
  var mapa = {}, dirs = {};
  datos_('Registro_Ronda').forEach(function (r) {
    var f = fechaIso_(r.fecha); if (f < desde || f > hasta) return;
    var d = String(r.directivo || ''); if (d) dirs[d] = 1;
    if (directivo && d !== directivo) return;
    var b = Math.ceil(Number(r.sesion) / 2), k = f + '|' + b + '|' + d;
    var o = mapa[k] || (mapa[k] = { fecha: f, dia: r.dia, bloque: b, directivo: d, porDocente: {} });
    var ant = o.porDocente[r.docente], pr = PRIORIDAD_RONDA_.indexOf(r.estado);
    if (!ant || pr > PRIORIDAD_RONDA_.indexOf(ant.estado) || (pr < 0 && ant.estado === 'Presente')) o.porDocente[r.docente] = { docente: r.docente, estado: r.estado, motivo: r.motivo || '', minutos: r.minutos || '', obs: r.observaciones || '' };
  });
  var bloques = Object.keys(mapa).sort().map(function (k) {
    var o = mapa[k], out = { fecha: o.fecha, dia: o.dia, bloque: o.bloque, directivo: o.directivo, presentes: [], noAsistieron: [], permisos: [], tardes: [], fuera: [], incumplimientos: [] };
    Object.keys(o.porDocente).sort().forEach(function (n) { var x = o.porDocente[n]; out[categoriaRonda_(x.estado)].push(x); });
    out.total = Object.keys(o.porDocente).length;
    return out;
  });
  return { bloques: bloques, directivos: Object.keys(dirs).sort() };
}
/** Si en la hoja Directivos la columna `ve_todo` dice NO para quien inició sesión, solo ve sus propias rondas (vacío o SI = ve todas). */
function soloSusRondas_(id) {
  var nom = id.nombre || id.email, f = datos_('Directivos').filter(function (d) { return d.nombre === nom; })[0];
  return !!f && String(f.ve_todo || '').trim().toUpperCase() === 'NO' ? nom : '';
}
function informeRondas(p) {
  var id = exigirDirectivo_(), propio = soloSusRondas_(id);
  p = p || {};
  var desde = String(p.desde || ''), hasta = String(p.hasta || p.desde || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde || hasta > resSumaDias_(desde, 400)) throw new Error('Revise las fechas del informe.');
  var r = rondasInterno_(desde, hasta, propio || String(p.directivo || ''));
  if (propio) { r.directivos = [propio]; r.soloPropias = true; }
  return r;
}
/** HTML del informe de rondas para correo. conPresentes=false (semana o mes) deja solo los conteos de presentes. */
function htmlRondas_(desde, hasta, directivo, conPresentes) {
  var r = rondasInterno_(desde, hasta, directivo || '');
  if (!r.bloques.length) return '<h3 style="font-family:Arial;color:#0f2a5c">Rondas</h3><p style="font-family:Arial;font-size:14px;color:#456">No hay rondas guardadas en este periodo.</p>';
  var sec = [['noAsistieron', '✖ No asistieron', '#a31515'], ['permisos', '⏳ Permiso por horas', '#8a5a00'], ['tardes', '⏰ Llegada tarde o salida temprana', '#8a5a00'], ['fuera', '📋 En reunión o actividad externa', '#245'], ['incumplimientos', '⚠ Incumplimientos', '#7b1fa2']];
  var h = '<h3 style="font-family:Arial;color:#0f2a5c;margin-bottom:4px">Rondas de verificación</h3>';
  r.bloques.forEach(function (b) {
    h += '<div style="font-family:Arial;font-size:14px;border:1px solid #d5dbe3;border-radius:8px;padding:8px 10px;margin:8px 0"><b>' + escRonda_(b.dia + ' ' + b.fecha + ' · Bloque ' + b.bloque) + '</b> · ronda de ' + escRonda_(b.directivo || '—') +
         ' · <span style="color:#1b5e20">✔ ' + b.presentes.length + ' presentes</span> de ' + b.total;
    sec.forEach(function (s) {
      var l = b[s[0]]; if (!l.length) return;
      h += '<div style="margin-top:5px;color:' + s[2] + '"><b>' + s[1] + ' (' + l.length + ')</b>: ' + l.map(function (x) {
        return escRonda_(x.docente) + (x.motivo ? ' <i>(' + escRonda_(x.motivo) + (x.minutos ? ', ' + escRonda_(x.minutos) + ' min' : '') + ')</i>' : '');
      }).join('; ') + '</div>';
    });
    if (conPresentes && b.presentes.length) h += '<div style="margin-top:5px;color:#1b5e20"><b>✔ Presentes</b>: ' + b.presentes.map(function (x) { return escRonda_(x.docente); }).join('; ') + '</div>';
    h += '</div>';
  });
  return h;
}
/** El directivo se envía a sí mismo el informe de rondas del periodo (y, si quiere, solo de un directivo). p = {desde, hasta, directivo?, correo?, recordar?}. */
function enviarRondasAMi(p) {
  var id = exigirDirectivo_();
  p = p || {};
  var desde = String(p.desde || ''), hasta = String(p.hasta || p.desde || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde || hasta > resSumaDias_(desde, 400)) throw new Error('Revise las fechas del informe.');
  var correo = String(p.correo || '').trim().toLowerCase();
  if (correo) {
    if (!correoValido_(correo)) throw new Error('Escriba un correo válido.');
    if (p.recordar) { var ec0 = estadoCorreo_(id), inf = ec0.informes || { dia: true, semana: true, mes: true }; guardarCorreo({ correo: correo, dia: inf.dia, semana: inf.semana, mes: inf.mes }); }
  } else {
    correo = String(estadoCorreo_(id).correo || '');
  }
  if (!correo) throw new Error('NECESITA_CORREO');
  var cuerpo = htmlRondas_(desde, hasta, soloSusRondas_(id) || String(p.directivo || ''), hasta === desde);
  MailApp.sendEmail({ to: correo, subject: 'ICET - Rondas del ' + desde + (hasta !== desde ? ' al ' + hasta : ''), htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  return { ok: true, para: correo };
}
