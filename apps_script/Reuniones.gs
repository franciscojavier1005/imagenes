/**
 * Reuniones, actividades institucionales y jornadas sin clases (entrega de boletines, clausura, actividades institucionales generales, jornada pedagógica, desarrollo institucional, planeación, asamblea de docentes, consejo académico,
 * comité de convivencia, capacitación, etc.). La asistencia se registra UNA vez por reunión, no por sesión, y no genera minutos de
 * "tiempo sin atender" (no hay estudiantes). La ronda de aula usa estos registros para no marcar como ausente a quien está en la reunión.
 *
 * Hojas: Reuniones (una fila por reunión) y Asistencia_Reunion (una fila por persona y reunión; se reemplaza al volver a guardar).
 * Fechas y horas se guardan como TEXTO (con apóstrofo) para que Sheets no las convierta.
 */
var COL_REUNIONES = ['id', 'fecha', 'tipo', 'nombre', 'inicio', 'fin', 'sin_estudiantes', 'convocados', 'creado_por', 'fecha_creacion', 'avisar_dias', 'avisar_min', 'avisar_ronda', 'lugar', 'fin_tipo', 'convoca_tipo', 'convoca_detalle', 'solicita_por', 'responsables'];
/** Quién convoca (lista del formulario). */
var CONVOCA_TIPOS = ['Rectoría', 'Coordinación académica', 'Coordinación de convivencia', 'Coordinación de redes de apoyo', 'Líder de área', 'Docente', 'Docente orientador(a)', 'Tutora PTAFI', 'Directivo docente', 'Secretaría de Educación', 'Otra entidad o persona'];
var LUGARES_REUNION = ['Sala de profesores', 'Biblioteca', 'Coliseo', 'Aula máxima', 'Sala de sistemas', 'Rectoría', 'Patio principal', 'Virtual (enlace)', 'Fuera del colegio'];
var FIN_TIPOS = { FIJA: 'Hora fija', TENTATIVA: 'Hora tentativa', JORNADA: 'Hasta finalizar la jornada' };
/** Hora en que termina la jornada escolar (fin de la última sesión de la hoja Franjas). */
function finJornada_() {
  var fin = '';
  datos_('Franjas').forEach(function (f) { var h = hhmm_(f.fin); if (h > fin) fin = h; });
  return fin || '13:30';
}
/** La hoja Reuniones de libros anteriores no tiene las columnas de recordatorio: se agregan al final. */
function reunionesHoja_() {
  var sh = hojaOCrea_('Reuniones', COL_REUNIONES), cab = sh.getDataRange().getValues()[0];
  COL_REUNIONES.forEach(function (c) { if (cab.indexOf(c) < 0) { sh.getRange(1, cab.length + 1).setValue(c); cab.push(c); } });
  return sh;
}
function reunionesDatos_() { reunionesHoja_(); return datos_('Reuniones'); }
/** Recordatorios de una reunión: días antes (0 = ninguno), minutos antes el mismo día (0 = ninguno) y si sale al comenzar y al terminar la ronda. Vacío = 1 día, 60 min y sí. */
function recordatorioDe_(r) {
  function num(v, d) { var t = String(v == null ? '' : v).trim(); return t === '' ? d : (isNaN(Number(t)) ? d : Number(t)); }
  return { avisarDias: num(r.avisar_dias, 1), avisarMin: num(r.avisar_min, 60), avisarRonda: String(r.avisar_ronda || 'SI').toUpperCase() !== 'NO' };
}
function recordatorioDeP_(p) {
  var dias = Number(p.avisarDias), min = Number(p.avisarMin);
  return { dias: [0, 1, 2, 3, 7].indexOf(dias) >= 0 ? dias : 1, min: [0, 15, 30, 60, 120].indexOf(min) >= 0 ? min : 60, ronda: p.avisarRonda === false ? 'NO' : 'SI' };
}
var COL_ASIST_REUNION = ['id_reunion', 'fecha', 'persona', 'estado', 'motivo', 'observacion', 'registrado_por', 'fecha_registro'];
var ESTADOS_REUNION = ['Asistió', 'No asistió', 'Llegada tarde', 'Salida temprana'];
var ESTADOS_REUNION_PRESENTE = ['Asistió', 'Llegada tarde', 'Salida temprana'];
/** tipo -> valores sugeridos (la pantalla los propone y el directivo los puede cambiar). sinEstudiantes: no hay clases en ese horario. */
var TIPOS_REUNION = [
  { tipo: 'Jornada pedagógica', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión de desarrollo institucional', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión de planeación', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Capacitación en el colegio', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión pedagógica', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Asamblea de docentes', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión extraordinaria del rector', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión informativa o actividad institucional', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Consejo académico', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de convivencia', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de calidad', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Reunión PTAFI con la tutora', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Entrega de boletines', sinEstudiantes: false, inicio: '07:00', fin: '13:30' },
  { tipo: 'Aseo general', sinEstudiantes: true, inicio: '07:00', fin: '09:00' },
  { tipo: 'Examen general periódico', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Clausura', sinEstudiantes: true, inicio: '08:00', fin: '12:00' },
  { tipo: 'Actividad institucional general', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Otra reunión o actividad (escriba el nombre)', sinEstudiantes: false, inicio: '08:00', fin: '09:00' }
];

function limpiaTxt_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function txtForzado_(v) { return "'" + v; }

/** Personas que se pueden convocar: docentes con horario, orientadoras y directivos (sin repetir). */
function personasReunion_() {
  var out = [], vistos = {};
  function agrega(n, rol) { n = String(n || '').trim(); if (n && !vistos[n]) { vistos[n] = 1; out.push({ nombre: n, rol: rol }); } }
  datos_('Docentes').forEach(function (d) { if (String(d.tiene_horario) === 'SI') agrega(d.nombre_completo, /PTAFI/i.test(String(d.nivel)) ? 'Tutora PTAFI' : 'Docente'); });
  datos_('Directivos').forEach(function (d) { agrega(d.nombre, 'Directivo'); });
  return out;
}

function reunionDeFila_(r) {
  var conv = String(r.convocados || 'TODOS');
  return { id: r.id, fecha: fechaIso_(limpiaTxt_(r.fecha)), tipo: r.tipo, nombre: r.nombre, inicio: limpiaTxt_(r.inicio), fin: limpiaTxt_(r.fin),
           sinEstudiantes: String(r.sin_estudiantes) === 'SI', convocados: conv === 'TODOS' ? 'TODOS' : conv.split(';').map(function (x) { return x.trim(); }).filter(String),
           creadoPor: r.creado_por, avisarDias: recordatorioDe_(r).avisarDias, avisarMin: recordatorioDe_(r).avisarMin, avisarRonda: recordatorioDe_(r).avisarRonda,
           lugar: String(r.lugar || ''), finTipo: FIN_TIPOS[r.fin_tipo] ? r.fin_tipo : 'FIJA', convocaTipo: String(r.convoca_tipo || ''), convocaDetalle: String(r.convoca_detalle || ''), solicitaPor: String(r.solicita_por || ''),
           responsables: String(r.responsables || '').split(';').map(function (x) { return x.trim(); }).filter(String) };
}
function reunionesDe_(fecha) {
  return reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha === fecha; });
}
function asistenciaDe_(id) {
  var m = {};
  datosOCrea_('Asistencia_Reunion', COL_ASIST_REUNION).forEach(function (a) {
    if (a.id_reunion === id) m[a.persona] = { estado: a.estado, motivo: a.motivo, observacion: a.observacion };
  });
  return m;
}
function convocadosDe_(reunion) {
  var todos = personasReunion_().map(function (p) { return p.nombre; });
  return reunion.convocados === 'TODOS' ? todos : reunion.convocados;
}

/** Resumen de asistencia a reuniones y actividades de un periodo, para el informe por correo. Devuelve '' si no hubo. */
function htmlReunionesInforme_(desde, hasta) {
  var rs = reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha >= desde && r.fecha <= hasta; });
  if (!rs.length) return '';
  var e = resEsc_;
  return '<div style="margin-top:12px;border-left:4px solid #1b5e20;padding:6px 10px;background:#e8f5e9"><div style="font-weight:600;color:#1b5e20">Reuniones y actividades institucionales (' + rs.length + ')</div>' +
    rs.map(function (r) {
      var a = asistenciaDe_(r.id), conv = convocadosDe_(r), no = [], pres = 0, sin = 0;
      conv.forEach(function (n) { var x = a[n]; if (!x) sin++; else if (x.estado === 'No asistió') no.push(n + ' (' + (x.motivo || 'Sin justificación') + ')'); else pres++; });
      return '<div style="font-size:13px;margin-top:6px"><b>' + e(r.nombre) + '</b> · ' + e(r.fecha) + ' · ' + e(r.inicio) + '-' + e(r.fin) + '<br>Asistieron ' + pres + ' de ' + conv.length +
        (sin ? ' · <span style="color:#a31515">sin registrar: ' + sin + '</span>' : '') + (no.length ? '<br>No asistieron: ' + e(no.join('; ')) : '') + '</div>';
    }).join('') + '</div>';
}

/** Reuniones de una fecha (por defecto hoy), con los tipos y las personas convocables. p = {fecha?} */
function listarReuniones(p) {
  exigirDirectivo_();
  p = p || {};
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  var reuniones = reunionesDe_(fecha).map(function (r) {
    var a = asistenciaDe_(r.id), conv = convocadosDe_(r), reg = 0;
    conv.forEach(function (n) { if (a[n]) reg++; });
    return Object.assign({}, r, { convocadosN: conv.length, registrados: reg });
  });
  // próximas (hoy en adelante, la más cercana primero) y últimas (días anteriores, la más reciente primero)
  var hoy = ymd_(new Date()), todas = reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha; });
  function resumida(r) { var a = asistenciaDe_(r.id), conv = convocadosDe_(r), reg = 0; conv.forEach(function (n) { if (a[n]) reg++; }); return Object.assign({}, r, { convocadosN: conv.length, registrados: reg }); }
  var proximas = todas.filter(function (r) { return r.fecha >= hoy; }).sort(function (a, b) { return a.fecha === b.fecha ? (a.inicio < b.inicio ? -1 : 1) : (a.fecha < b.fecha ? -1 : 1); }).slice(0, 12).map(resumida);
  var ultimas = todas.filter(function (r) { return r.fecha < hoy; }).sort(function (a, b) { return a.fecha === b.fecha ? (a.inicio < b.inicio ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1); }).slice(0, 10).map(resumida);
  return { puedeAnular: puedeAdministrar_(identidad_()), duplicadas: duplicadasDe_().length, convocaTipos: CONVOCA_TIPOS, lugares: LUGARES_REUNION, finTipos: FIN_TIPOS, jornadaFin: finJornada_(), fecha: fecha, hoy: hoy, proximas: proximas, ultimas: ultimas, reuniones: reuniones, tipos: TIPOS_REUNION, personas: personasReunion_(), motivos: datos_('Motivos').map(function (m) { return m.motivo; }) };
}

function hora_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)) ? String(s) : ''; }
function nombreRegistrador_(p) {
  var quien = identidad_();
  if (quien.rol !== 'directivo') throw new Error('Solo un directivo puede registrar reuniones.');
  return quien.nombre || quien.email || String(p.directivo || '');
}

/** Valida y normaliza hora de inicio/fin y datos de organización (lugar, quién convoca, quién solicita, responsables). */
function datosReunionDeP_(p) {
  var ini = hora_(p.inicio), finTipo = FIN_TIPOS[p.finTipo] ? p.finTipo : 'FIJA', fin = finTipo === 'JORNADA' ? finJornada_() : hora_(p.fin);
  if (!ini || !fin || fin <= ini) throw new Error(finTipo === 'JORNADA' ? 'La hora de inicio debe ser antes de que termine la jornada (' + finJornada_() + ').' : 'Revise la hora de inicio y de fin.');
  var convoca = CONVOCA_TIPOS.indexOf(p.convocaTipo) >= 0 ? p.convocaTipo : '';
  var validos = personasReunion_().map(function (x) { return x.nombre; });
  var resp = (p.responsables || []).filter(function (n) { return validos.indexOf(n) >= 0; });
  return { ini: ini, fin: fin, finTipo: finTipo, lugar: String(p.lugar || '').trim().slice(0, 80), convocaTipo: convoca, convocaDetalle: String(p.convocaDetalle || '').trim().slice(0, 100),
           solicitaPor: String(p.solicitaPor || '').trim().slice(0, 80), responsables: resp.join('; ') };
}
/** Crea una reunión. p = {fecha?, tipo, nombre?, inicio, fin, sinEstudiantes, convocados: 'TODOS' | [nombres]} */
function crearReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === p.tipo; })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  if (/^Otra/.test(def.tipo) && String(p.nombre || '').trim().length < 3) throw new Error('Escriba el nombre de la reunión o actividad.');
  var d = datosReunionDeP_(p);
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  var conv = 'TODOS';
  if (p.convocados !== 'TODOS') {
    var validos = personasReunion_().map(function (x) { return x.nombre; });
    var lista = (p.convocados || []).filter(function (n) { return validos.indexOf(n) >= 0; });
    if (!lista.length) throw new Error('Elija al menos una persona convocada.');
    conv = lista.join('; ');
  }
  var nombre = String(p.nombre || '').slice(0, 120) || def.tipo;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    // si se tocó «crear» varias veces seguidas (el libro tarda en responder), no se repite: se devuelve la que ya se creó hace instantes
    var hace = Utilities.formatDate(new Date(Date.now() - 5 * 60000), TZ, 'yyyy-MM-dd HH:mm');
    var ya = reunionesDatos_().filter(function (r) {
      var x = reunionDeFila_(r);
      return x.fecha === fecha && x.tipo === def.tipo && x.nombre === nombre && x.inicio === d.ini && x.fin === d.fin && String(r.creado_por) === String(por) &&
             String(r.convocados || 'TODOS') === conv && String(r.fecha_creacion) >= hace;
    })[0];
    if (ya) return { id: ya.id, repetida: true };
    var id = Utilities.getUuid();
    reunionesHoja_().appendRow([id, txtForzado_(fecha), def.tipo, nombre, txtForzado_(d.ini), txtForzado_(d.fin),
      p.sinEstudiantes ? 'SI' : 'NO', conv, por, ahoraTxt_(), recordatorioDeP_(p).dias, recordatorioDeP_(p).min, recordatorioDeP_(p).ronda,
      d.lugar, d.finTipo, d.convocaTipo, d.convocaDetalle, d.solicitaPor, d.responsables]);
    return { id: id };
  } finally { lock.releaseLock(); }
}

/** Administra el sistema: dueño o editor del libro, quien tenga SI en la columna administra (hoja Directivos) o la coordinación académica (si no dice NO). */
function puedeAdministrar_(quien) {
  try {
    if (quien && quien.email && editoresLibro_().indexOf(String(quien.email).toLowerCase()) >= 0) return true;
    var d = datos_('Directivos').filter(function (x) { return x.nombre === (quien && quien.nombre); })[0];
    if (!d) return false;
    var col = String(d.administra || '').trim().toUpperCase();
    if (col === 'SI') return true;
    if (col === 'NO') return false;
    return /coordinador(a)?\s+acad[eé]mic/i.test(String(d.rol || ''));
  } catch (e) { return false; }
}
var COL_REUNIONES_ANULADAS = COL_REUNIONES.concat(['anulada_por', 'fecha_anulacion', 'motivo_anulacion']);

/** Anula una reunión (solo quien administra): sale de Reuniones y queda guardada en Reuniones_Anuladas con quién, cuándo y por qué. La asistencia registrada se conserva. p = {id, motivo} */
function anularReunion(p) {
  p = p || {};
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  if (!puedeAdministrar_(quien)) throw new Error('Solo quien administra el sistema puede anular una reunión.');
  var motivo = String(p.motivo || '').trim();
  if (motivo.length < 5) throw new Error('Escriba el motivo de la anulación (mínimo 5 letras).');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = reunionesHoja_(), v = sh.getDataRange().getValues(), cab = v[0], ci = cab.indexOf('id'), fila = -1;
    for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === String(p.id)) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la reunión.');
    var guardada = COL_REUNIONES.map(function (k) { var j = cab.indexOf(k); return j < 0 ? '' : v[fila][j]; }).concat([por, ahoraTxt_(), motivo.slice(0, 200)]);
    hojaOCrea_('Reuniones_Anuladas', COL_REUNIONES_ANULADAS).appendRow(guardada);
    sh.deleteRow(fila + 1);
    bitacora_('Anuló reunión', String(guardada[3]) + ' (' + limpiaTxt_(guardada[1]) + ') · ' + motivo.slice(0, 120));
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/**
 * Aviso del día (se muestra unos segundos sobre cualquier pantalla): reuniones de hoy (en curso, próximas y las ya terminadas sin asistencia registrada)
 * y actividades con estudiantes fuera del colegio registradas para hoy.
 */
function avisosHoy() {
  exigirDirectivo_();
  var ahora = new Date(), hoy = ymd_(ahora), hh = Utilities.formatDate(ahora, TZ, 'HH:mm');
  function aMinutos(t) { var m = String(t).match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; }
  var ahoraMin = aMinutos(hh);
  function resumida(r) { var a = asistenciaDe_(r.id), conv = convocadosDe_(r), reg = 0; conv.forEach(function (n) { if (a[n]) reg++; }); return { conv: conv.length, reg: reg }; }
  var todas = reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha; });
  var reuniones = todas.filter(function (r) { return r.fecha === hoy; }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : (a.inicio > b.inicio ? 1 : 0); }).map(function (r) {
    var x = resumida(r), estado = hh < r.inicio ? 'proxima' : (hh <= r.fin ? 'ahora' : 'pasada'), faltan = aMinutos(r.inicio) - ahoraMin;
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, convocadosN: x.conv, registrados: x.reg, estado: estado,
             lugar: r.lugar, finTipo: r.finTipo, minutosHasta: faltan, avisarRonda: r.avisarRonda, avisarMin: r.avisarMin,
             urgente: estado === 'ahora' || (estado === 'proxima' && r.avisarMin > 0 && faltan <= r.avisarMin) };   // parpadea y vuelve a avisar durante la jornada
  });
  var previas = todas.filter(function (r) {
    var d = Math.round((new Date(r.fecha + 'T12:00:00Z') - new Date(hoy + 'T12:00:00Z')) / 86400000);
    r.dias = d; return d > 0 && r.avisarDias > 0 && d <= r.avisarDias;
  }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : (a.inicio < b.inicio ? -1 : 1)); }).map(function (r) {
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, fecha: r.fecha, dias: r.dias, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, lugar: r.lugar };
  });
  var por = {}, orden = [];
  datos_('Novedades').forEach(function (n) {
    if (n['Tipo Novedad'] !== TIPO_EXTERNA || fechaIso_(n['Fecha Novedad']) !== hoy) return;
    var k = n['Motivo Ausencia'] || 'Actividad con estudiantes';
    if (!por[k]) { por[k] = { motivo: k, docentes: [] }; orden.push(k); }
    if (por[k].docentes.indexOf(n['Docente']) < 0) por[k].docentes.push(n['Docente']);
  });
  return { hoy: hoy, hora: hh, reuniones: reuniones, previas: previas, actividades: orden.map(function (k) { return por[k]; }) };
}

/** Grupos de reuniones repetidas (mismo día, tipo, nombre, horas y convocados): devuelve las SOBRANTES (se conserva la que tiene asistencia o, si no, la primera). */
function duplicadasDe_() {
  var grupos = {}, orden = [], sobrantes = [];
  var asist = {}; datosOCrea_('Asistencia_Reunion', COL_ASIST_REUNION).forEach(function (a) { asist[a.id_reunion] = (asist[a.id_reunion] || 0) + 1; });
  reunionesDatos_().forEach(function (r) {
    var x = reunionDeFila_(r), k = [x.fecha, x.tipo, x.nombre, x.inicio, x.fin, String(r.convocados || 'TODOS')].join('|');
    if (!grupos[k]) { grupos[k] = []; orden.push(k); }
    grupos[k].push({ id: r.id, asistencia: asist[r.id] || 0 });
  });
  orden.forEach(function (k) {
    var g = grupos[k]; if (g.length < 2) return;
    var mejor = g.reduce(function (a, b) { return b.asistencia > a.asistencia ? b : a; }, g[0]);
    g.forEach(function (x) { if (x.id !== mejor.id) sobrantes.push(x.id); });
  });
  return sobrantes;
}
/** Quita (anula, sin pedir motivo) las reuniones repetidas por haber tocado «crear» varias veces. Solo quien administra. */
function quitarReunionesDuplicadas() {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  if (!puedeAdministrar_(quien)) throw new Error('Solo quien administra el sistema puede quitar reuniones.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var n2 = 0;
  try { n2 = quitarReunionesDuplicadasInterno_(por); } finally { lock.releaseLock(); }
  if (n2) bitacora_('Quitó reuniones duplicadas', n2 + ' reunión(es) repetida(s)');
  return { ok: true, quitadas: n2 };
}
/** Desde el menú del libro: quitar reuniones duplicadas. */
function quitarReunionesDuplicadasLibro() {
  exigirEditor_();
  if (!duplicadasDe_().length) { SpreadsheetApp.getUi().alert('No hay reuniones repetidas.'); return; }
  var n = quitarReunionesDuplicadasInterno_(emailActual_());
  SpreadsheetApp.getUi().alert('Se quitaron ' + n + ' reuniones repetidas (quedaron en Reuniones_Anuladas).');
}
function quitarReunionesDuplicadasInterno_(por) {
  var n = 0, sob = duplicadasDe_(), sh = reunionesHoja_();
  sob.forEach(function (id) {
    var v = sh.getDataRange().getValues(), cab = v[0], ci = cab.indexOf('id'), fila = -1;
    for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === String(id)) { fila = i; break; }
    if (fila < 0) return;
    var guardada = COL_REUNIONES.map(function (k) { var j = cab.indexOf(k); return j < 0 ? '' : v[fila][j]; }).concat([por, ahoraTxt_(), 'Duplicada (registro repetido)']);
    hojaOCrea_('Reuniones_Anuladas', COL_REUNIONES_ANULADAS).appendRow(guardada); sh.deleteRow(fila + 1); n++;
  });
  return n;
}

/** Edita una reunión ya creada (tipo, nombre, fecha, horas, clases suspendidas, convocados). La asistencia ya registrada no se borra. p = {id, ...igual que crearReunion} */
function editarReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === p.tipo; })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  if (/^Otra/.test(def.tipo) && String(p.nombre || '').trim().length < 3) throw new Error('Escriba el nombre de la reunión o actividad.');
  var d = datosReunionDeP_(p), ini = d.ini, fin = d.fin;
  if (!esFechaIso_(p.fecha)) throw new Error('Revise la fecha.');
  var conv = 'TODOS';
  if (p.convocados !== 'TODOS') {
    var validos = personasReunion_().map(function (x) { return x.nombre; });
    var lista = (p.convocados || []).filter(function (n) { return validos.indexOf(n) >= 0; });
    if (!lista.length) throw new Error('Elija al menos una persona convocada.');
    conv = lista.join('; ');
  }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = reunionesHoja_(), v = sh.getDataRange().getValues(), cab = v[0], fila = -1, c = {};
    cab.forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === String(p.id)) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la reunión.');
    var antes = reunionDeFila_((function () { var o = {}; cab.forEach(function (k, i) { o[k] = v[fila][i]; }); return o; })());
    var nueva = v[fila].slice();
    nueva[c.fecha] = txtForzado_(p.fecha); nueva[c.tipo] = def.tipo; nueva[c.nombre] = String(p.nombre || '').slice(0, 120) || def.tipo;
    nueva[c.inicio] = txtForzado_(ini); nueva[c.fin] = txtForzado_(fin); nueva[c.sin_estudiantes] = p.sinEstudiantes ? 'SI' : 'NO'; nueva[c.convocados] = conv; var rd = recordatorioDeP_(p); nueva[c.avisar_dias] = rd.dias; nueva[c.avisar_min] = rd.min; nueva[c.avisar_ronda] = rd.ronda;
    nueva[c.lugar] = d.lugar; nueva[c.fin_tipo] = d.finTipo; nueva[c.convoca_tipo] = d.convocaTipo; nueva[c.convoca_detalle] = d.convocaDetalle; nueva[c.solicita_por] = d.solicitaPor; nueva[c.responsables] = d.responsables;
    sh.getRange(fila + 1, 1, 1, nueva.length).setValues([nueva]);
    bitacora_('Editó reunión', antes.nombre + ' (' + antes.fecha + ' ' + antes.inicio + '-' + antes.fin + ') → ' + nueva[c.nombre] + ' (' + p.fecha + ' ' + ini + '-' + fin + ')' + (antes.sinEstudiantes !== !!p.sinEstudiantes ? ' · clases ' + (p.sinEstudiantes ? 'suspendidas' : 'no suspendidas') : '') + ' · por ' + por);
  } finally { lock.releaseLock(); }
  return { ok: true, id: p.id };
}

/** Datos para registrar la asistencia de una reunión: convocados y lo ya registrado. */
function cargarReunion(p) {
  exigirDirectivo_();
  var r = reunionesDatos_().map(reunionDeFila_).filter(function (x) { return x.id === (p && p.id); })[0];
  if (!r) throw new Error('No se encontró la reunión.');
  var a = asistenciaDe_(r.id), roles = {};
  personasReunion_().forEach(function (x) { roles[x.nombre] = x.rol; });
  return { reunion: r, motivos: datos_('Motivos').map(function (m) { return m.motivo; }),
           personas: convocadosDe_(r).map(function (n) { return { nombre: n, rol: roles[n] || 'Docente', registro: a[n] || null }; }) };
}

/** Guarda la asistencia (reemplaza lo anterior de cada persona). p = {id, registros:[{persona, estado, motivo?, observacion?}]} */
function guardarAsistenciaReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var r = reunionesDatos_().map(reunionDeFila_).filter(function (x) { return x.id === p.id; })[0];
  if (!r) throw new Error('No se encontró la reunión.');
  var motivos = datos_('Motivos').map(function (m) { return m.motivo; }), convocados = convocadosDe_(r);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Asistencia_Reunion', COL_ASIST_REUNION), v = sh.getDataRange().getValues(), cuenta = { guardados: 0 };
    (p.registros || []).forEach(function (x) {
      if (ESTADOS_REUNION.indexOf(x.estado) < 0 || convocados.indexOf(x.persona) < 0) return;
      var motivo = x.estado === 'No asistió' ? (motivos.indexOf(x.motivo) >= 0 ? x.motivo : 'Sin justificación') : '';
      var fila = [r.id, txtForzado_(r.fecha), x.persona, x.estado, motivo, String(x.observacion || '').slice(0, 200), por, ahoraTxt_()], idx = -1;
      for (var i = 1; i < v.length; i++) if (v[i][0] === r.id && v[i][2] === x.persona) { idx = i; break; }
      if (idx > 0) { sh.getRange(idx + 1, 1, 1, fila.length).setValues([fila]); v[idx] = fila; } else { sh.appendRow(fila); v.push(fila); }
      cuenta.guardados++;
    });
    return cuenta;
  } finally { lock.releaseLock(); }
}

/**
 * Reuniones de la fecha que se cruzan con las sesiones indicadas (horas de Franjas), para la ronda de aula.
 * Devuelve [{id, nombre, tipo, inicio, fin, sinEstudiantes, convocados: 'TODOS'|[...], asistencia: {persona: estado}}].
 */
function reunionesEnSesiones_(fecha, sesiones, franjas) {
  var hs = franjas.filter(function (f) { return sesiones.indexOf(Number(f.hora)) >= 0; });
  if (!hs.length) return [];
  var ini = hhmm_(hs[0].inicio), fin = hhmm_(hs[hs.length - 1].fin);
  hs.forEach(function (f) { if (hhmm_(f.inicio) < ini) ini = hhmm_(f.inicio); if (hhmm_(f.fin) > fin) fin = hhmm_(f.fin); });
  return reunionesDe_(fecha).filter(function (r) { return r.inicio < fin && r.fin > ini; }).map(function (r) {
    var a = asistenciaDe_(r.id), est = {}; Object.keys(a).forEach(function (n) { est[n] = a[n].estado; });
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, convocados: r.convocados, asistencia: est };
  });
}
/** ¿Esa persona está convocada a la reunión? */
function convocadoA_(reunion, nombre) { return reunion.convocados === 'TODOS' || reunion.convocados.indexOf(nombre) >= 0; }
