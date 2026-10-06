/**
 * Reuniones y jornadas sin estudiantes (jornada pedagógica, desarrollo institucional, planeación, asamblea de docentes, consejo académico,
 * comité de convivencia, capacitación, etc.). La asistencia se registra UNA vez por reunión, no por sesión, y no genera minutos de
 * "tiempo sin atender" (no hay estudiantes). La ronda de aula usa estos registros para no marcar como ausente a quien está en la reunión.
 *
 * Hojas: Reuniones (una fila por reunión) y Asistencia_Reunion (una fila por persona y reunión; se reemplaza al volver a guardar).
 * Fechas y horas se guardan como TEXTO (con apóstrofo) para que Sheets no las convierta.
 */
var COL_REUNIONES = ['id', 'fecha', 'tipo', 'nombre', 'inicio', 'fin', 'sin_estudiantes', 'convocados', 'creado_por', 'fecha_creacion'];
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
  { tipo: 'Otra reunión', sinEstudiantes: false, inicio: '08:00', fin: '09:00' }
];

function limpiaTxt_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function txtForzado_(v) { return "'" + v; }

/** Personas que se pueden convocar: docentes con horario, orientadoras y directivos (sin repetir). */
function personasReunion_() {
  var out = [], vistos = {};
  function agrega(n, rol) { n = String(n || '').trim(); if (n && !vistos[n]) { vistos[n] = 1; out.push({ nombre: n, rol: rol }); } }
  datos_('Docentes').forEach(function (d) { if (String(d.tiene_horario) === 'SI') agrega(d.nombre_completo, 'Docente'); });
  datos_('Directivos').forEach(function (d) { agrega(d.nombre, 'Directivo'); });
  return out;
}

function reunionDeFila_(r) {
  var conv = String(r.convocados || 'TODOS');
  return { id: r.id, fecha: fechaIso_(limpiaTxt_(r.fecha)), tipo: r.tipo, nombre: r.nombre, inicio: limpiaTxt_(r.inicio), fin: limpiaTxt_(r.fin),
           sinEstudiantes: String(r.sin_estudiantes) === 'SI', convocados: conv === 'TODOS' ? 'TODOS' : conv.split(';').map(function (x) { return x.trim(); }).filter(String),
           creadoPor: r.creado_por };
}
function reunionesDe_(fecha) {
  return datosOCrea_('Reuniones', COL_REUNIONES).map(reunionDeFila_).filter(function (r) { return r.fecha === fecha; });
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
  return { fecha: fecha, reuniones: reuniones, tipos: TIPOS_REUNION, personas: personasReunion_(), motivos: datos_('Motivos').map(function (m) { return m.motivo; }) };
}

function hora_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)) ? String(s) : ''; }
function nombreRegistrador_(p) {
  var quien = identidad_();
  if (quien.rol !== 'directivo') throw new Error('Solo un directivo puede registrar reuniones.');
  return quien.nombre || quien.email || String(p.directivo || '');
}

/** Crea una reunión. p = {fecha?, tipo, nombre?, inicio, fin, sinEstudiantes, convocados: 'TODOS' | [nombres]} */
function crearReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === p.tipo; })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  var ini = hora_(p.inicio), fin = hora_(p.fin);
  if (!ini || !fin || fin <= ini) throw new Error('Revise la hora de inicio y de fin.');
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  var conv = 'TODOS';
  if (p.convocados !== 'TODOS') {
    var validos = personasReunion_().map(function (x) { return x.nombre; });
    var lista = (p.convocados || []).filter(function (n) { return validos.indexOf(n) >= 0; });
    if (!lista.length) throw new Error('Elija al menos una persona convocada.');
    conv = lista.join('; ');
  }
  var id = Utilities.getUuid();
  hojaOCrea_('Reuniones', COL_REUNIONES).appendRow([id, txtForzado_(fecha), def.tipo, String(p.nombre || '').slice(0, 120) || def.tipo, txtForzado_(ini), txtForzado_(fin),
    p.sinEstudiantes ? 'SI' : 'NO', conv, por, ahoraTxt_()]);
  return { id: id };
}

/** Datos para registrar la asistencia de una reunión: convocados y lo ya registrado. */
function cargarReunion(p) {
  exigirDirectivo_();
  var r = datosOCrea_('Reuniones', COL_REUNIONES).map(reunionDeFila_).filter(function (x) { return x.id === (p && p.id); })[0];
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
  var r = datosOCrea_('Reuniones', COL_REUNIONES).map(reunionDeFila_).filter(function (x) { return x.id === p.id; })[0];
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
