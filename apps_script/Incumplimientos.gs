/**
 * Incumplimientos de los deberes docentes que se reportan con rigor:
 *  - "Incumplimiento: no atiende al grupo": el docente está en el colegio pero no atiende a los estudiantes.
 *  - "Incumplimiento: despidió a los estudiantes sin autorización": envió a los niños a la casa sin autorización de un directivo.
 * Se guardan en la hoja Incumplimientos, que es un REGISTRO DE SOLO AGREGAR: la ronda no la borra ni la reemplaza (aunque después se
 * cambie la marca de esa sesión), cada fila lleva quién la registró y cuándo, la reincidencia (n.º de reportes del docente) y un
 * seguimiento (estado + notas que solo se agregan). Nada de esto es una sanción: es el soporte para el debido proceso.
 */
var COL_INCUMPL = ['id', 'fecha', 'docente', 'tipo', 'sesiones', 'grupo', 'area', 'minutos', 'donde', 'descripcion', 'explicacion_docente',
                   'registrado_por', 'fecha_registro', 'estado', 'seguimiento', 'reincidencia'];
var TIPOS_INCUMPL = { NO_ATIENDE: 'Incumplimiento: no atiende al grupo', DESPIDIO: 'Incumplimiento: despidió a los estudiantes sin autorización' };
var DONDE_INCUMPL = ['En la sala de profesores', 'En el patio o pasillos', 'En otra dependencia del colegio', 'En coordinación o secretaría', 'No se sabe dónde estaba'];
var ESTADOS_SEGUIMIENTO = ['Reportado', 'En seguimiento', 'Citado a descargos', 'Con llamado de atención', 'Cerrado'];
var MIN_DESCRIPCION_INCUMPL = 15;

function hojaIncumplimientos_() { return hojaOCrea_('Incumplimientos', COL_INCUMPL); }

/** Agrega un reporte (si ya existe el mismo docente-fecha-tipo-sesiones no lo duplica). Devuelve {id, reincidencia, nuevo}. */
function registrarIncumplimiento_(d) {
  var sh = hojaIncumplimientos_(), v = sh.getDataRange().getValues(), cab = v[0], col = {}, previos = 0;
  cab.forEach(function (k, i) { col[k] = i; });
  for (var i = 1; i < v.length; i++) {
    if (v[i][col.docente] !== d.docente) continue;
    previos++;
    if (fechaIso_(limpiaTxt_(v[i][col.fecha])) === d.fecha && v[i][col.tipo] === d.tipo && String(v[i][col.sesiones]) === String(d.sesiones))
      return { id: v[i][col.id], reincidencia: Number(v[i][col.reincidencia]) || previos, nuevo: false };
  }
  var id = Utilities.getUuid(), rei = previos + 1;
  sh.appendRow([id, txtForzado_(d.fecha), d.docente, d.tipo, d.sesiones, textoCod_(d.grupo || ''), d.area || '', d.minutos || '', d.donde || '',
    String(d.descripcion || '').slice(0, 1000), String(d.explicacion || '').slice(0, 500), d.por || '', ahoraTxt_(), 'Reportado', '', rei]);
  return { id: id, reincidencia: rei, nuevo: true };
}

/** Lista los reportes de un periodo. p = {desde?, hasta?} (por defecto, todo el año). */
function listarIncumplimientos(p) {
  exigirDirectivo_();
  p = p || {};
  var desde = p.desde ? fechaIso_(p.desde) : '0000-00-00', hasta = p.hasta ? fechaIso_(p.hasta) : '9999-99-99';
  var todos = datosOCrea_('Incumplimientos', COL_INCUMPL).map(function (r) {
    return { id: r.id, fecha: fechaIso_(limpiaTxt_(r.fecha)), docente: r.docente, tipo: r.tipo, sesiones: r.sesiones, grupo: limpiaTxt_(r.grupo), area: r.area, minutos: r.minutos,
             donde: r.donde, descripcion: r.descripcion, explicacion: r.explicacion_docente, registradoPor: r.registrado_por, fechaRegistro: String(r.fecha_registro),
             estado: r.estado, seguimiento: r.seguimiento, reincidencia: Number(r.reincidencia) || 1 };
  });
  var lista = todos.filter(function (r) { return r.fecha >= desde && r.fecha <= hasta; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : 0); });
  var por = {}; todos.forEach(function (r) { por[r.docente] = (por[r.docente] || 0) + 1; });
  return { lista: lista, totalPorDocente: por, estados: ESTADOS_SEGUIMIENTO };
}

/** Cambia el estado del seguimiento y agrega una nota (las notas anteriores se conservan). p = {id, estado, nota?} */
function actualizarSeguimiento(p) {
  var quien = exigirDirectivo_();
  p = p || {};
  if (ESTADOS_SEGUIMIENTO.indexOf(p.estado) < 0) throw new Error('Estado no válido.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaIncumplimientos_(), v = sh.getDataRange().getValues(), col = {};
    v[0].forEach(function (k, i) { col[k] = i; });
    for (var i = 1; i < v.length; i++) if (v[i][col.id] === p.id) {
      var nota = String(p.nota || '').trim().slice(0, 500);
      var linea = ahoraTxt_() + ' · ' + (quien.nombre || quien.email) + ' · ' + p.estado + (nota ? ': ' + nota : '');
      sh.getRange(i + 1, col.estado + 1).setValue(p.estado);
      sh.getRange(i + 1, col.seguimiento + 1).setValue((v[i][col.seguimiento] ? v[i][col.seguimiento] + '\n' : '') + linea);
      return { ok: true };
    }
    throw new Error('No se encontró el reporte.');
  } finally { lock.releaseLock(); }
}
