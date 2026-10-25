/**
 * Reuniones, actividades institucionales y jornadas sin clases (entrega de boletines, clausura, actividades institucionales generales, jornada pedagógica, desarrollo institucional, planeación, asamblea de docentes, consejo académico,
 * comité de convivencia, capacitación, etc.). La asistencia se registra UNA vez por reunión, no por sesión, y no genera minutos de
 * "tiempo sin atender" (no hay estudiantes). La ronda de aula usa estos registros para no marcar como ausente a quien está en la reunión.
 *
 * Hojas: Reuniones (una fila por reunión) y Asistencia_Reunion (una fila por persona y reunión; se reemplaza al volver a guardar).
 * Fechas y horas se guardan como TEXTO (con apóstrofo) para que Sheets no las convierta.
 */
var COL_REUNIONES = ['id', 'fecha', 'tipo', 'nombre', 'inicio', 'fin', 'sin_estudiantes', 'convocados', 'creado_por', 'fecha_creacion', 'avisar_dias', 'avisar_min', 'avisar_ronda', 'lugar', 'fin_tipo', 'convoca_tipo', 'convoca_detalle', 'solicita_por', 'responsables', 'convocados_grupos', 'invitados', 'invitado_nombre', 'observaciones', 'salida_est', 'min_antes_salida', 'llevar_comedor', 'informar_padres'];
/** A quiénes se convoca. Personal (genera lista de asistencia) y organismos e invitados (solo se anuncian). */
var GRUPOS_PERSONAL = [
  ['TODOS', 'Todo el personal de la institución', 'Docentes, orientadoras, tutora PTAFI y directivos'],
  ['DIRECTIVOS', 'Directivos docentes', 'Rector y coordinadores'],
  ['ORIENTADORAS', 'Docentes orientadoras', ''],
  ['PTAFI', 'Tutora PTAFI', ''],
  ['PREESCOLAR', 'Docentes de preescolar', ''],
  ['PRIMARIA', 'Docentes de básica primaria', ''],
  ['BACHILLERATO', 'Docentes de bachillerato', 'Secundaria y media']
];
var NOMBRES_AREA = { ART: 'Artística', ETR: 'Ética y religión', CSI: 'Ciencias sociales e inglés', ERD: 'Educación física, recreación y deporte', TEI: 'Tecnología e informática', CAS: 'Lengua castellana', CNA: 'Ciencias naturales', MAT: 'Matemáticas' };
var ORGANISMOS_REUNION = [
  ['CONSEJO_DIRECTIVO', 'Consejo directivo'], ['CONSEJO_ACADEMICO', 'Consejo académico'], ['CONSEJO_ESTUDIANTIL', 'Consejo estudiantil'], ['CONSEJO_PADRES', 'Consejo de padres'],
  ['COMITE_CONVIVENCIA', 'Comité de convivencia'], ['COMITE_COMEDOR', 'Comité de comedor escolar'], ['PADRES', 'Padres de familia o acudientes'], ['EGRESADOS', 'Egresados'],
  ['ENTIDAD', 'Entidad o invitado externo (escriba el nombre)']
];
/** Nombres de las personas que pertenecen a cada grupo de personal ('AREA:CNA' = docentes que dictan esa área; 'PERSONAS' = los nombres elegidos a mano). */
function personasDeGrupos_(grupos, elegidos) {
  var out = [], visto = {};
  function add(n) { n = String(n || '').trim(); if (n && !visto[n]) { visto[n] = 1; out.push(n); } }
  var todas = personasReunion_(), validos = todas.map(function (x) { return x.nombre; });
  var docs = datos_('Docentes').filter(function (d) { return String(d.tiene_horario) === 'SI'; });
  var areasDe = null;
  function areas() { if (!areasDe) { areasDe = {}; datos_('Horario').forEach(function (h) { (areasDe[h.docente] = areasDe[h.docente] || {})[h.area] = 1; }); } return areasDe; }
  (grupos || []).forEach(function (g) {
    if (g === 'TODOS') todas.forEach(function (x) { add(x.nombre); });
    else if (g === 'DIRECTIVOS') datos_('Directivos').forEach(function (d) { add(d.nombre); });
    else if (g === 'ORIENTADORAS') docs.forEach(function (d) { if (/ORIENT/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'PTAFI') docs.forEach(function (d) { if (/PTAFI/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'PREESCOLAR') docs.forEach(function (d) { if (/PREESCOLAR/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'PRIMARIA') docs.forEach(function (d) { if (/PRIMARIA/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'BACHILLERATO') docs.forEach(function (d) { if (/SECUNDARIA|MEDIA|BACHILLERATO/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (/^AREA:/.test(g)) { var cod = g.slice(5); docs.forEach(function (d) { if ((areas()[d.nombre_completo] || {})[cod]) add(d.nombre_completo); }); }
    else if (g === 'PERSONAS') (elegidos || []).forEach(function (n) { if (validos.indexOf(n) >= 0) add(n); });
  });
  return out;
}
/** Catálogo para el formulario: grupos de personal con sus integrantes, áreas disponibles y organismos. */
function catalogoConvocados_() {
  var porGrupo = {}, hojas = {};
  GRUPOS_PERSONAL.forEach(function (g) { porGrupo[g[0]] = personasDeGrupos_([g[0]]); });
  var areas = {}; datos_('Horario').forEach(function (h) { if (NOMBRES_AREA[h.area]) areas[h.area] = 1; });
  var listaAreas = Object.keys(areas).sort(function (a, b) { return NOMBRES_AREA[a] < NOMBRES_AREA[b] ? -1 : 1; }).map(function (c) { porGrupo['AREA:' + c] = personasDeGrupos_(['AREA:' + c]); return { codigo: c, nombre: NOMBRES_AREA[c], n: porGrupo['AREA:' + c].length }; });
  return { personal: GRUPOS_PERSONAL.map(function (g) { return { codigo: g[0], nombre: g[1], detalle: g[2], n: porGrupo[g[0]].length }; }), areas: listaAreas, organismos: ORGANISMOS_REUNION.map(function (o) { return { codigo: o[0], nombre: o[1] }; }), integrantes: porGrupo };
}
/** Lee de p a quiénes se convoca (formato nuevo con grupos; o el anterior: 'TODOS' / lista de nombres). */
function convocadosDeP_(p) {
  var grupos, elegidos = p.convocados, nuevo = Array.isArray(p.grupos);
  if (nuevo) grupos = p.grupos.filter(function (g) { return g === 'TODOS' || g === 'PERSONAS' || /^AREA:/.test(g) || GRUPOS_PERSONAL.some(function (x) { return x[0] === g; }); });
  else grupos = p.convocados === 'TODOS' || p.convocados == null ? ['TODOS'] : ['PERSONAS'];
  var invitados = (p.invitados || []).filter(function (c) { return ORGANISMOS_REUNION.some(function (o) { return o[0] === c; }); });
  var entidad = invitados.indexOf('ENTIDAD') >= 0 ? String(p.entidad || '').trim().slice(0, 100) : '';
  if (invitados.indexOf('ENTIDAD') >= 0 && entidad.length < 3) throw new Error('Escriba el nombre de la entidad o del invitado externo.');
  var personas = personasDeGrupos_(grupos, Array.isArray(elegidos) ? elegidos : []);
  if (!personas.length && !invitados.length) throw new Error('Elija a quiénes se convoca (al menos un grupo o una persona).');
  var conv = grupos.indexOf('TODOS') >= 0 ? 'TODOS' : (personas.length ? personas.join('; ') : 'NINGUNO');
  var rotulos = [];
  GRUPOS_PERSONAL.forEach(function (g) { if (grupos.indexOf(g[0]) >= 0) rotulos.push(g[1]); });
  grupos.forEach(function (g) { if (/^AREA:/.test(g)) rotulos.push('Docentes de ' + (NOMBRES_AREA[g.slice(5)] || g.slice(5))); });
  if (grupos.indexOf('PERSONAS') >= 0) rotulos.push((Array.isArray(elegidos) ? elegidos.length : 0) + ' persona(s) elegida(s)');
  return { conv: conv, grupos: grupos.join(';'), invitados: invitados.join(';'), entidad: entidad, personas: personas };
}
/** Texto corto con a quiénes se convoca, para las tarjetas y avisos. */
function resumenConvocados_(x) {
  var t = [];
  var gr = x.grupos || [];
  if (!gr.length) t.push(x.convocados === 'TODOS' ? 'Todo el personal de la institución' : (x.convocados.length ? x.convocados.length + ' persona(s) elegida(s)' : ''));
  GRUPOS_PERSONAL.forEach(function (g) { if (gr.indexOf(g[0]) >= 0) t.push(g[1]); });
  gr.forEach(function (g) { if (/^AREA:/.test(g)) t.push('Docentes de ' + (NOMBRES_AREA[g.slice(5)] || g.slice(5))); });
  if (gr.indexOf('PERSONAS') >= 0) t.push((x.convocados === 'TODOS' ? 0 : x.convocados.length) + ' persona(s) elegida(s)');
  (x.invitados || []).forEach(function (c) { var o = ORGANISMOS_REUNION.filter(function (z) { return z[0] === c; })[0]; if (o) t.push(c === 'ENTIDAD' ? (x.invitadoNombre || o[1]) : o[1]); });
  return t.filter(String).join(' · ');
}

/** Quién convoca (lista del formulario). */
var CONVOCA_TIPOS = ['Rectoría', 'Coordinación académica', 'Coordinación de convivencia', 'Coordinación de redes de apoyo', 'Líder de área', 'Docente', 'Docente orientador(a)', 'Tutora PTAFI', 'Directivo docente', 'Secretaría de Educación', 'Otra entidad o persona'];
/** Lugares donde se hacen reuniones y actividades, por grupos. `pide`: el lugar necesita un dato (número de salón, cuál laboratorio…); `solo`: el dato reemplaza al nombre. */
/** «Apellido1 Apellido2 Nombre1 …» → «Nombre1 Apellido1». */
function nombreCortoDocente_(n) { var t = String(n || '').trim().split(/\s+/); return t.length >= 3 ? t[2] + ' ' + t[0] : String(n || ''); }
function lugaresReunion_() {
  var coord = datos_('Directivos').filter(function (d) { return !/rector/i.test(String(d.rol)); }).map(function (d) { return { v: 'Coordinación – ' + d.nombre }; });
  var orient = datos_('Docentes').filter(function (d) { return /ORIENT/i.test(String(d.nivel)); }).map(function (d) { return { v: 'Orientación escolar – ' + nombreCortoDocente_(d.nombre_completo) }; });
  return [
    { grupo: 'Espacios del colegio', items: [{ v: 'Sala de profesores' }, { v: 'Polideportivo (canchas)' }, { v: 'Patio principal' }, { v: 'Sala múltiple (auditorio)' }, { v: 'Biblioteca' }, { v: 'Comedor escolar' }, { v: 'Emisora escolar' }] },
    { grupo: 'Salas de tecnología e informática', items: [{ v: 'Sala de tecnología e informática 1' }, { v: 'Sala de tecnología e informática 2' }, { v: 'Sala de tecnología e informática 3' }, { v: 'Sala de tecnología e informática 4' }, { v: 'Aulas digitales (sala 5)' }] },
    { grupo: 'Laboratorios y entornos por área', items: [{ v: 'Laboratorio de química' }, { v: 'Otro laboratorio o entorno de área', pide: '¿Cuál y qué número? (ej.: Laboratorio de física 2)' }] },
    { grupo: 'Salones', items: [{ v: 'Salón', pide: 'Número o grupo del salón (ej.: 8-1)' }] },
    { grupo: 'Oficinas', items: [{ v: 'Rectoría' }].concat(coord, orient) },
    { grupo: 'Otro', items: [{ v: 'Virtual (enlace)' }, { v: 'Fuera del colegio', pide: '¿Dónde?' }, { v: 'Otro lugar', pide: 'Escriba cuál', solo: true }] }
  ];
}
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
var TIPO_JORNADA = 'Jornada pedagógica o de desarrollo institucional';
/** Tipos que se unificaron: las reuniones ya guardadas con el nombre anterior se muestran y se editan con el nuevo. */
var TIPOS_ALIAS_REUNION = { 'Jornada pedagógica': TIPO_JORNADA, 'Reunión de desarrollo institucional': TIPO_JORNADA };
function tipoReunion_(t) { return TIPOS_ALIAS_REUNION[t] || t; }
var TIPOS_REUNION = [
  { tipo: TIPO_JORNADA, sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Taller pedagógico', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Capacitación en el colegio', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Charla o conferencia', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Reunión de planeación', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión pedagógica', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión de área o de grado', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Asamblea de docentes', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión extraordinaria del rector', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión informativa o actividad institucional', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Consejo académico', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de convivencia', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de calidad', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Reunión PTAFI con la tutora', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Reunión con padres de familia o acudientes', sinEstudiantes: false, inicio: '07:00', fin: '09:00' },
  { tipo: 'Escuela de padres', sinEstudiantes: false, inicio: '07:00', fin: '09:00' },
  { tipo: 'Entrega de boletines', sinEstudiantes: false, inicio: '07:00', fin: '13:30' },
  { tipo: 'Acto cívico o cultural', sinEstudiantes: false, inicio: '07:00', fin: '08:00' },
  { tipo: 'Simulacro de evacuación', sinEstudiantes: false, inicio: '09:00', fin: '09:30' },
  { tipo: 'Aseo general', sinEstudiantes: true, inicio: '07:00', fin: '09:00' },
  { tipo: 'Examen general periódico', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Clausura', sinEstudiantes: true, inicio: '08:00', fin: '12:00' },
  { tipo: 'Actividad institucional general', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Otra reunión o actividad (escriba el nombre)', sinEstudiantes: false, inicio: '08:00', fin: '09:00' }
];

/** Resta minutos a una hora HH:MM. */
function restaMin_(hhmm, n) {
  var m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/); if (!m) return '';
  var t = Number(m[1]) * 60 + Number(m[2]) - n; if (t < 0) t = 0;
  return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
}
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
  var x = { id: r.id, fecha: fechaIso_(limpiaTxt_(r.fecha)), tipo: tipoReunion_(r.tipo), nombre: r.nombre, inicio: limpiaTxt_(r.inicio), fin: limpiaTxt_(r.fin),
           sinEstudiantes: String(r.sin_estudiantes) === 'SI', convocados: conv === 'TODOS' ? 'TODOS' : (conv === 'NINGUNO' ? [] : conv.split(';').map(function (x) { return x.trim(); }).filter(String)),
           creadoPor: r.creado_por, avisarDias: recordatorioDe_(r).avisarDias, avisarMin: recordatorioDe_(r).avisarMin, avisarRonda: recordatorioDe_(r).avisarRonda,
           lugar: String(r.lugar || ''), finTipo: FIN_TIPOS[r.fin_tipo] ? r.fin_tipo : 'FIJA', convocaTipo: String(r.convoca_tipo || ''), convocaDetalle: String(r.convoca_detalle || ''), solicitaPor: String(r.solicita_por || ''),
           responsables: String(r.responsables || '').split(';').map(function (x) { return x.trim(); }).filter(String),
           grupos: String(r.convocados_grupos || '').split(';').filter(String), invitados: String(r.invitados || '').split(';').filter(String), invitadoNombre: String(r.invitado_nombre || ''), observaciones: String(r.observaciones || '') };
  // salida anticipada de estudiantes: se despachan a salidaEst; las clases terminan minAntesSalida antes (aseo y comedor)
  x.salidaEst = hora_(String(r.salida_est || '').replace(/^'/, ''));
  x.minAntesSalida = [10, 15, 20, 30].indexOf(Number(r.min_antes_salida)) >= 0 ? Number(r.min_antes_salida) : 15;
  x.llevarComedor = String(r.llevar_comedor || '').toUpperCase() === 'SI';
  x.informarPadres = String(r.informar_padres || '').toUpperCase() === 'SI';
  x.finClases = x.salidaEst ? restaMin_(x.salidaEst, x.minAntesSalida) : '';
  x.inicioClases = x.finClases && x.finClases < x.inicio ? x.finClases : x.inicio;
  x.convocadosResumen = resumenConvocados_(x);
  return x;
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
  return { puedeAnular: puedeAdministrar_(identidad_()), duplicadas: duplicadasDe_().length, catalogo: catalogoConvocados_(), convocaTipos: CONVOCA_TIPOS, lugares: lugaresReunion_(), finTipos: FIN_TIPOS, jornadaFin: finJornada_(), fecha: fecha, hoy: hoy, proximas: proximas, ultimas: ultimas, reuniones: reuniones, tipos: TIPOS_REUNION, personas: personasReunion_(), motivos: datos_('Motivos').map(function (m) { return m.motivo; }) };
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
  var salida = hora_(p.salidaEst || ''), minAntes = [10, 15, 20, 30].indexOf(Number(p.minAntesSalida)) >= 0 ? Number(p.minAntesSalida) : 15;
  if (p.salidaEst && !salida) throw new Error('Revise la hora de salida de los estudiantes.');
  if (salida && restaMin_(salida, minAntes) < '06:00') throw new Error('Revise la hora de salida de los estudiantes: las clases terminarían antes de las 6:00.');
  var convoca = CONVOCA_TIPOS.indexOf(p.convocaTipo) >= 0 ? p.convocaTipo : '';
  var validos = personasReunion_().map(function (x) { return x.nombre; });
  var resp = (p.responsables || []).filter(function (n) { return validos.indexOf(n) >= 0; });
  return { ini: ini, fin: fin, finTipo: finTipo, lugar: String(p.lugar || '').trim().slice(0, 80), convocaTipo: convoca, convocaDetalle: String(p.convocaDetalle || '').trim().slice(0, 100),
           solicitaPor: String(p.solicitaPor || '').trim().slice(0, 80), responsables: resp.join('; '), observaciones: String(p.observaciones || '').trim().slice(0, 400), salida: salida, minAntes: minAntes, comedor: salida && p.llevarComedor ? 'SI' : 'NO', padres: (p.informarPadres || salida) ? 'SI' : 'NO' };
}
/** Crea una reunión. p = {fecha?, tipo, nombre?, inicio, fin, sinEstudiantes, convocados: 'TODOS' | [nombres]} */
function crearReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === tipoReunion_(p.tipo); })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  if (/^Otra/.test(def.tipo) && String(p.nombre || '').trim().length < 3) throw new Error('Escriba el nombre de la reunión o actividad.');
  var d = datosReunionDeP_(p);
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  var cv = convocadosDeP_(p), conv = cv.conv;
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
      (p.sinEstudiantes || d.salida) ? 'SI' : 'NO', conv, por, ahoraTxt_(), recordatorioDeP_(p).dias, recordatorioDeP_(p).min, recordatorioDeP_(p).ronda,
      d.lugar, d.finTipo, d.convocaTipo, d.convocaDetalle, d.solicitaPor, d.responsables, cv.grupos, cv.invitados, cv.entidad, d.observaciones, txtForzado_(d.salida), d.minAntes, d.comedor, d.padres]);
    var aus = ausentesConvocados_(id);
    return { id: id, ausentes: aus };
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
             lugar: r.lugar, observaciones: r.observaciones, salidaEst: r.salidaEst, finClases: r.finClases, llevarComedor: r.llevarComedor, informarPadres: r.informarPadres, finTipo: r.finTipo, convocadosResumen: r.convocadosResumen, minutosHasta: faltan, avisarRonda: r.avisarRonda, avisarMin: r.avisarMin,
             urgente: estado === 'ahora' || (estado === 'proxima' && r.avisarMin > 0 && faltan <= r.avisarMin) };   // parpadea y vuelve a avisar durante la jornada
  });
  var previas = todas.filter(function (r) {
    var d = Math.round((new Date(r.fecha + 'T12:00:00Z') - new Date(hoy + 'T12:00:00Z')) / 86400000);
    r.dias = d;
    var viernes = Utilities.formatDate(ahora, TZ, 'u') === '5';   // el viernes también se recuerda lo del lunes (para empezar la semana)
    return d > 0 && r.avisarDias > 0 && (d <= r.avisarDias || (viernes && d === 3));
  }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : (a.inicio < b.inicio ? -1 : 1)); }).map(function (r) {
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, fecha: r.fecha, dias: r.dias, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, lugar: r.lugar, observaciones: r.observaciones, salidaEst: r.salidaEst, finClases: r.finClases, llevarComedor: r.llevarComedor, informarPadres: r.informarPadres };
  });
  var por = {}, orden = [];
  datos_('Novedades').forEach(function (n) {
    if (n['Tipo Novedad'] !== TIPO_EXTERNA || fechaIso_(n['Fecha Novedad']) !== hoy) return;
    var k = n['Motivo Ausencia'] || 'Actividad con estudiantes';
    if (!por[k]) { por[k] = { motivo: k, docentes: [] }; orden.push(k); }
    if (por[k].docentes.indexOf(n['Docente']) < 0) por[k].docentes.push(n['Docente']);
  });
  return { hoy: hoy, hora: hh, reuniones: reuniones, previas: previas, actividades: orden.map(function (k) { return por[k]; }), ausentes: ausentesDelDia_(hoy) };
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
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === tipoReunion_(p.tipo); })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  if (/^Otra/.test(def.tipo) && String(p.nombre || '').trim().length < 3) throw new Error('Escriba el nombre de la reunión o actividad.');
  var d = datosReunionDeP_(p), ini = d.ini, fin = d.fin;
  if (!esFechaIso_(p.fecha)) throw new Error('Revise la fecha.');
  var cv = convocadosDeP_(p), conv = cv.conv;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = reunionesHoja_(), v = sh.getDataRange().getValues(), cab = v[0], fila = -1, c = {};
    cab.forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === String(p.id)) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la reunión.');
    var antes = reunionDeFila_((function () { var o = {}; cab.forEach(function (k, i) { o[k] = v[fila][i]; }); return o; })());
    var nueva = v[fila].slice();
    nueva[c.fecha] = txtForzado_(p.fecha); nueva[c.tipo] = def.tipo; nueva[c.nombre] = String(p.nombre || '').slice(0, 120) || def.tipo;
    nueva[c.inicio] = txtForzado_(ini); nueva[c.fin] = txtForzado_(fin); nueva[c.sin_estudiantes] = (p.sinEstudiantes || d.salida) ? 'SI' : 'NO'; nueva[c.convocados] = conv; var rd = recordatorioDeP_(p); nueva[c.avisar_dias] = rd.dias; nueva[c.avisar_min] = rd.min; nueva[c.avisar_ronda] = rd.ronda;
    nueva[c.lugar] = d.lugar; nueva[c.fin_tipo] = d.finTipo; nueva[c.convoca_tipo] = d.convocaTipo; nueva[c.convoca_detalle] = d.convocaDetalle; nueva[c.solicita_por] = d.solicitaPor; nueva[c.responsables] = d.responsables; nueva[c.convocados_grupos] = cv.grupos; nueva[c.invitados] = cv.invitados; nueva[c.invitado_nombre] = cv.entidad; nueva[c.observaciones] = d.observaciones; nueva[c.salida_est] = txtForzado_(d.salida); nueva[c.min_antes_salida] = d.minAntes; nueva[c.llevar_comedor] = d.comedor; nueva[c.informar_padres] = d.padres;
    sh.getRange(fila + 1, 1, 1, nueva.length).setValues([nueva]);
    bitacora_('Editó reunión', antes.nombre + ' (' + antes.fecha + ' ' + antes.inicio + '-' + antes.fin + ') → ' + nueva[c.nombre] + ' (' + p.fecha + ' ' + ini + '-' + fin + ')' + (antes.sinEstudiantes !== !!p.sinEstudiantes ? ' · clases ' + (p.sinEstudiantes ? 'suspendidas' : 'no suspendidas') : '') + ' · por ' + por);
  } finally { lock.releaseLock(); }
  return { ok: true, id: p.id, ausentes: ausentesConvocados_(p.id) };
}

/** Datos para registrar la asistencia de una reunión: convocados y lo ya registrado. */
function cargarReunion(p) {
  exigirDirectivo_();
  var r = reunionesDatos_().map(reunionDeFila_).filter(function (x) { return x.id === (p && p.id); })[0];
  if (!r) throw new Error('No se encontró la reunión.');
  var a = asistenciaDe_(r.id), roles = {}, ausentes = {};   // ausentes: ya reportados en Novedades para el día de la reunión (toda la jornada)
  try { ausentesDelDia_(r.fecha).forEach(function (x) { if (x.jornada) ausentes[x.docente] = x; }); } catch (e) { /* sin novedades */ }
  personasReunion_().forEach(function (x) { roles[x.nombre] = x.rol; });
  return { reunion: r, motivos: datos_('Motivos').map(function (m) { return m.motivo; }),
           personas: convocadosDe_(r).map(function (n) { var au = ausentes[n]; return { nombre: n, rol: roles[n] || 'Docente', registro: a[n] || null, ausente: au ? { motivo: au.motivo, dias: au.dias, desde: au.desde, hasta: au.hasta } : null }; }) };
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
  return reunionesDe_(fecha).filter(function (r) { return (r.sinEstudiantes ? r.inicioClases : r.inicio) < fin && r.fin > ini; }).map(function (r) {
    var a = asistenciaDe_(r.id), est = {}; Object.keys(a).forEach(function (n) { est[n] = a[n].estado; });
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, salidaEst: r.salidaEst, finClases: r.finClases, convocados: r.convocados, asistencia: est };
  });
}
/** ¿Esa persona está convocada a la reunión? */
function convocadoA_(reunion, nombre) { return reunion.convocados === 'TODOS' || reunion.convocados.indexOf(nombre) >= 0; }

/**
 * Docentes con novedad de ausencia en un día (no asiste, permiso por horas, llega tarde o sale temprano), con el motivo, el rango de días de esa novedad
 * (las novedades de varios días comparten «ID registro»), quién queda a cargo y si se dejó actividad. Para el aviso del día.
 */
function ausentesDelDia_(hoy) {
  var tipos = ['No asistió', 'Ausente temporal', 'Salida temprana informada', 'Llegada tarde informada'];
  var v = hoja_('Novedades').getDataRange().getValues(), cab = v[0], c = {}; cab.forEach(function (k, i) { c[k] = i; });
  function g(f, k) { return c[k] == null ? '' : f[c[k]]; }
  var rango = {};   // id|docente -> {desde, hasta}
  for (var i = 1; i < v.length; i++) {
    var id = String(g(v[i], 'ID registro') || ''); if (!id) continue;
    var f = fechaIso_(g(v[i], 'Fecha Novedad')), k = id + '|' + g(v[i], 'Docente'), o = rango[k] = rango[k] || { desde: f, hasta: f, dias: {} };
    if (f < o.desde) o.desde = f; if (f > o.hasta) o.hasta = f; o.dias[f] = 1;
  }
  var por = {}, orden = [];
  for (var j = 1; j < v.length; j++) {
    var fila = v[j], doc = g(fila, 'Docente'), tipo = String(g(fila, 'Tipo Novedad'));
    if (!doc || tipos.indexOf(tipo) < 0 || fechaIso_(g(fila, 'Fecha Novedad')) !== hoy) continue;
    var jc = String(g(fila, 'Sesiones')) === 'JC' || (tipo === 'No asistió' && String(g(fila, 'Horario')) === 'Jornada completa');
    var ant = por[doc];
    if (ant && (ant.jornada || !jc)) continue;
    var ri = rango[String(g(fila, 'ID registro') || '') + '|' + doc];
    if (!ant) orden.push(doc);
    por[doc] = { docente: doc, corto: nombreCortoDocente_(doc), motivo: String(g(fila, 'Motivo Ausencia') || ''), tipo: tipo, jornada: jc || tipo === 'No asistió',
      desde: ri ? ri.desde : hoy, hasta: ri ? ri.hasta : hoy, dias: ri ? Object.keys(ri.dias).length : 1,
      atiende: String(g(fila, 'Grupo atendido por') || ''), actividad: String(g(fila, 'Actividad de Aprendizaje') || '') };
  }
  return orden.map(function (d) { return por[d]; });
}

/** Convocados a una reunión que ya tienen una ausencia de toda la jornada reportada en Novedades ese día (para avisar al crear o editar). */
function ausentesConvocados_(id) {
  try {
    var r = reunionesDatos_().map(reunionDeFila_).filter(function (x) { return x.id === id; })[0];
    if (!r) return [];
    var conv = convocadosDe_(r);
    return ausentesDelDia_(r.fecha).filter(function (a) { return a.jornada && conv.indexOf(a.docente) >= 0; })
      .map(function (a) { return { docente: a.corto || a.docente, motivo: a.motivo, dias: a.dias }; });
  } catch (e) { return []; }
}
