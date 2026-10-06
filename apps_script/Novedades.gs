/**
 * Registro de novedades SIN necesidad de hacer la ronda (reemplaza el formulario de Google): permisos, incapacidades, talleres, llegadas tarde
 * o salidas tempranas avisadas, calamidades, salidas pedagógicas con estudiantes (paseos, intercolegiados, charlas, recorridos), etc.
 * Se puede registrar para hoy, para días anteriores o para días futuros (un solo día o varios). Escribe en la hoja Novedades con el mismo
 * esquema del formulario: la ronda las muestra al otro directivo ("Reportado hoy") y el panel y los informes las cuentan sin duplicar.
 * Cada registro lleva un "ID registro" para poder anularlo (la anulación queda anotada en la hoja Novedades_Anuladas).
 *
 * Salida pedagógica / actividad con estudiantes fuera del colegio: es una actividad institucional; no suma "tiempo sin atender" y en la ronda
 * ese docente aparece como "Fuera con estudiantes" (no se marca ausente).
 *
 * Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
 */
var TIPO_EXTERNA = 'Actividad externa con estudiantes';
var COL_ANULADAS = ['id', 'docente', 'fecha', 'tipo', 'filas', 'anulado_por', 'fecha_anulacion'];
/** id de la pantalla -> tipo que se guarda en la hoja Novedades y qué horas pide. */
var TIPOS_NOVEDAD = [
  { id: 'AUSENCIA', texto: 'No asistirá (o no asistió) el día completo', tipo: 'No asistió', pide: 'dias' },
  { id: 'TARDE', texto: 'Llegará tarde (o llegó tarde)', tipo: 'Llegada tarde informada', pide: 'llegada' },
  { id: 'SALIDA', texto: 'Saldrá temprano (o salió temprano)', tipo: 'Salida temprana informada', pide: 'salida' },
  { id: 'HORAS', texto: 'Permiso por horas', tipo: 'Ausente temporal', pide: 'rango' },
  { id: 'EXTERNA', texto: 'Salida pedagógica o actividad con estudiantes fuera del colegio', tipo: TIPO_EXTERNA, pide: 'rango_o_dia' }
];
/** Motivos de las salidas con estudiantes (se agregan solos a la hoja Motivos si faltan; ver asegurarMotivos_). */
var MOTIVOS_EXTERNA = ['Salida pedagógica o recorrido con estudiantes', 'Paseo o salida recreativa con estudiantes', 'Intercolegiados o evento deportivo con estudiantes',
  'Charla o actividad externa con estudiantes'];

function aMin_(hhmm) { var m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function esFechaIso_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(new Date(s + 'T12:00:00Z').getTime()); }

/** La hoja Novedades de libros anteriores no trae "ID registro": se agrega la columna al final. Devuelve el encabezado. */
function encabezadoNovedades_() {
  var sh = hoja_('Novedades'), cab = sh.getDataRange().getValues()[0];
  if (cab.indexOf('ID registro') < 0) { sh.getRange(1, cab.length + 1).setValue('ID registro'); cab.push('ID registro'); }
  return cab;
}
function filaNovedad_(cab, o) { return cab.map(function (c) { return o[c] == null ? '' : o[c]; }); }

/** Datos para la pantalla de novedades. */
function datosNovedades() {
  exigirDirectivo_();
  asegurarMotivos_();
  var hoy = ymd_(new Date());
  var motivos = datos_('Motivos').map(function (m) { return { motivo: m.motivo, categoria: m.categoria, justificada: m.justificada }; });
  var l = function (n) { return datos_('Listas').filter(function (x) { return x.lista === n; }).map(function (x) { return x.valor; }); };
  return {
    hoy: hoy,
    docentes: datos_('Docentes').filter(function (d) { return String(d.tiene_horario) === 'SI'; }).map(function (d) { return { nombre: d.nombre_completo, nivel: d.nivel }; })
      .sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; }),
    tipos: TIPOS_NOVEDAD.map(function (t) { return { id: t.id, texto: t.texto, pide: t.pide }; }),
    motivos: motivos, motivosExterna: MOTIVOS_EXTERNA,
    medios: l('medio'), fuentes: l('fuente'),
    registros: registrosRecientes_(hoy)
  };
}

/** Registros hechos desde esta pantalla, de los últimos 7 días y los futuros (agrupados por ID). */
function registrosRecientes_(hoy) {
  var v = hoja_('Novedades').getDataRange().getValues(), cab = v[0], c = {}, desde = resSumaDias_(hoy, -7), por = {}, orden = [];
  cab.forEach(function (k, i) { c[k] = i; });
  if (c['ID registro'] == null) return [];
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][c['ID registro']] || ''); if (!id) continue;
    var f = fechaIso_(v[i][c['Fecha Novedad']]); if (f < desde) continue;
    var k = id + '|' + v[i][c['Docente']];
    if (!por[k]) { por[k] = { id: id, docente: v[i][c['Docente']], tipo: v[i][c['Tipo Novedad']], motivo: v[i][c['Motivo Ausencia']], fechas: {}, descripcion: String(v[i][c['Descripción']] || ''), por: v[i][c['Directivo Docente']] }; orden.push(k); }
    por[k].fechas[f] = 1;
  }
  return orden.map(function (k) {
    var r = por[k], fs = Object.keys(r.fechas).sort();
    return { id: r.id, docente: r.docente, tipo: r.tipo, motivo: r.motivo, desde: fs[0], hasta: fs[fs.length - 1], dias: fs.length, descripcion: r.descripcion.slice(0, 120), por: r.por };
  }).sort(function (a, b) { return a.desde < b.desde ? 1 : (a.desde > b.desde ? -1 : 0); });
}

function diasHabilesRango_(desde, hasta) {
  var out = [], f = desde, g = 0;
  while (f <= hasta && g++ < 60) { var d = resDia_(f); if (d >= 1 && d <= 5) out.push(f); f = resSumaDias_(f, 1); }
  return out;
}

/**
 * Registra una novedad para uno o varios docentes y uno o varios días.
 * p = {docentes:[...], tipo:'AUSENCIA'|'TARDE'|'SALIDA'|'HORAS'|'EXTERNA', desde:'aaaa-mm-dd', hasta?, horaIni?, horaFin?, todoElDia?, motivo, medio?, fuente?, descripcion?, actividad?}
 */
function registrarNovedad(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var def = TIPOS_NOVEDAD.filter(function (t) { return t.id === p.tipo; })[0];
  if (!def) throw new Error('Elija qué pasó (tipo de novedad).');
  var validos = {}; datos_('Docentes').forEach(function (d) { if (String(d.tiene_horario) === 'SI') validos[d.nombre_completo] = 1; });
  var docentes = (p.docentes || []).filter(function (n, i, a) { return validos[n] && a.indexOf(n) === i; });
  if (!docentes.length) throw new Error('Elija al menos un docente.');
  var desde = String(p.desde || ''), hasta = String(p.hasta || p.desde || '');
  if (!esFechaIso_(desde) || !esFechaIso_(hasta) || hasta < desde) throw new Error('Revise las fechas.');
  if (hasta > resSumaDias_(desde, 45)) throw new Error('El rango máximo es de 45 días; haga varios registros.');
  asegurarMotivos_();
  var motivos = {}; datos_('Motivos').forEach(function (m) { motivos[m.motivo] = m; });
  var motivo = String(p.motivo || '');
  if (!motivos[motivo]) throw new Error('Elija el motivo.');
  var m = motivos[motivo];
  // horas que cubre la novedad (en minutos del día)
  var ini = 0, fin = 24 * 60, texto = '';
  if (def.pide === 'llegada') { fin = aMin_(p.horaFin); if (fin == null) throw new Error('Escriba la hora a la que llega.'); texto = 'Llega a las ' + p.horaFin + '. '; }
  else if (def.pide === 'salida') { ini = aMin_(p.horaIni); if (ini == null) throw new Error('Escriba la hora a la que sale.'); texto = 'Sale a las ' + p.horaIni + '. '; }
  else if (def.pide === 'rango' || (def.pide === 'rango_o_dia' && !p.todoElDia)) {
    ini = aMin_(p.horaIni); fin = aMin_(p.horaFin);
    if (ini == null || fin == null || fin <= ini) throw new Error('Revise la hora de inicio y la de fin.');
    texto = 'De ' + p.horaIni + ' a ' + p.horaFin + '. ';
  } else if (def.pide === 'rango_o_dia') texto = 'Todo el día. ';
  var l = datos_('Listas'), medios = l.filter(function (x) { return x.lista === 'medio'; }).map(function (x) { return x.valor; }), fuentes = l.filter(function (x) { return x.lista === 'fuente'; }).map(function (x) { return x.valor; });
  var medio = medios.indexOf(p.medio) >= 0 ? p.medio : 'WhatsApp directo', fuente = fuentes.indexOf(p.fuente) >= 0 ? p.fuente : 'Docente ausente';
  var descripcion = (texto + String(p.descripcion || '')).trim().slice(0, 300);

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var nov = hoja_('Novedades'), cab = encabezadoNovedades_(), v = nov.getDataRange().getValues(), c = {};
    cab.forEach(function (k, i) { c[k] = i; });
    var hz = datos_('Horario'), id = Utilities.getUuid(), ahora = new Date(), res = { id: id, filas: 0, dias: 0, sinClases: [], yaAusente: [] };
    var fechas = diasHabilesRango_(desde, hasta);
    if (!fechas.length) throw new Error('El rango no tiene días hábiles (lunes a viernes).');
    function quita(fecha, docente, fn) {
      for (var j = v.length - 1; j >= 1; j--) {
        if (fechaIso_(v[j][c['Fecha Novedad']]) === fecha && v[j][c['Docente']] === docente && fn(String(v[j][c['Tipo Novedad']]), String(v[j][c['Sesiones']]))) { nov.deleteRow(j + 1); v.splice(j, 1); }
      }
    }
    function agrega(o) { var fila = filaNovedad_(cab, o); nov.appendRow(fila); v.push(fila); res.filas++; }
    fechas.forEach(function (fecha) {
      var dia = DIAS[Number(Utilities.formatDate(new Date(fecha + 'T12:00:00'), TZ, 'u'))], algun = false;
      docentes.forEach(function (doc) {
        var mias = hz.filter(function (h) { return h.docente === doc && h.dia === dia; }).sort(function (a, b) { return Number(a.hora) - Number(b.hora); });
        if (!mias.length) { res.sinClases.push(doc + ' (' + fecha + ')'); return; }
        var base = { 'Marca temporal': ahora, 'Fecha Novedad': fecha, 'Docente': doc, 'Tipo Novedad': def.tipo, 'Actividad de Aprendizaje': p.actividad || 'N/A', 'Motivo Ausencia': motivo,
          'Descripción': descripcion, 'Fuente Novedad': fuente, 'Medio Información': medio, 'Directivo Docente': por, 'Justificada': m.justificada === 'SI' ? 'Sí' : 'No', 'Categoría motivo': m.categoria || '', 'ID registro': id };
        var jcPrevio = v.slice(1).some(function (x) { return fechaIso_(x[c['Fecha Novedad']]) === fecha && x[c['Docente']] === doc && String(x[c['Sesiones']]) === 'JC' && /no asisti/i.test(String(x[c['Tipo Novedad']])); });
        if (def.id === 'AUSENCIA') {   // una sola novedad por día con el total de minutos (reemplaza lo anterior de ese día)
          quita(fecha, doc, function (t) { return /no asisti/i.test(t); });
          var total = 0, gs = {}, as = {};
          mias.forEach(function (h) { var g = h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo; total += minutosSesion_(g); gs[g] = 1; as[h.area || '(énfasis)'] = 1; });
          var gk = Object.keys(gs), ak = Object.keys(as), pj = gk.length === 1 ? partesGrupo_(String(gk[0]).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
          agrega(Object.assign({}, base, { 'Grado': pj.grado, 'Grupo': pj.grupo, 'Área/Asignatura': ak.length === 1 ? ak[0] : 'Todas', 'Horario': 'Jornada completa', 'Minutos Desatendidos': total, 'Sesiones': 'JC' }));
          algun = true; return;
        }
        if (jcPrevio) { res.yaAusente.push(doc + ' (' + fecha + ')'); return; }
        mias.forEach(function (h) {
          var hi = aMin_(hhmm_(h.inicio)), hf = aMin_(hhmm_(h.fin)), g = h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo;
          var sol = Math.min(fin, hf) - Math.max(ini, hi);
          if (sol <= 0) return;
          var pg = partesGrupo_(String(g).split('+')[0]), pre = /^00/.test(String(h.grupo)), s = Number(h.hora);
          quita(fecha, doc, function (t, ses) { return ses === 'S' + s && t === def.tipo; });
          agrega(Object.assign({}, base, { 'Grado': pg.grado, 'Grupo': pg.grupo, 'Área/Asignatura': h.area || '(énfasis)',
            'Horario': 'H' + s + ' ' + hhmm_(h.inicio) + ' - ' + hhmm_(h.fin) + (pre ? '' : ' Bloque ' + Math.ceil(s / 2)),
            'Minutos Desatendidos': def.id === 'EXTERNA' ? '' : Math.min(sol, hf - hi), 'Sesiones': 'S' + s }));
          algun = true;
        });
      });
      if (algun) res.dias++;
    });
    if (!res.filas) throw new Error('No se guardó nada: ' + (res.sinClases.length ? 'los docentes no tienen clases en esos horarios o días. ' : '') + (res.yaAusente.length ? 'ya estaban reportados como ausentes todo el día. ' : '') + (!res.sinClases.length && !res.yaAusente.length ? 'ninguna de sus clases se cruza con esas horas.' : ''));
    return res;
  } finally { lock.releaseLock(); }
}

/** Anula un registro hecho desde esta pantalla (todas sus filas). Queda anotado quién y cuándo en Novedades_Anuladas. p = {id, docente?} */
function quitarNovedad(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email, id = String((p && p.id) || '');
  if (!id) throw new Error('Falta el registro.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var nov = hoja_('Novedades'), v = nov.getDataRange().getValues(), c = {}, quitadas = 0, resumen = {};
    v[0].forEach(function (k, i) { c[k] = i; });
    if (c['ID registro'] == null) throw new Error('No se encontró el registro.');
    for (var j = v.length - 1; j >= 1; j--) {
      if (String(v[j][c['ID registro']]) !== id) continue;
      if (p.docente && v[j][c['Docente']] !== p.docente) continue;
      var k = v[j][c['Docente']] + '|' + v[j][c['Tipo Novedad']];
      resumen[k] = resumen[k] || { docente: v[j][c['Docente']], tipo: v[j][c['Tipo Novedad']], fechas: [] };
      resumen[k].fechas.push(fechaIso_(v[j][c['Fecha Novedad']]));
      nov.deleteRow(j + 1); v.splice(j, 1); quitadas++;
    }
    if (!quitadas) throw new Error('No se encontró el registro (puede que ya se haya anulado).');
    var an = hojaOCrea_('Novedades_Anuladas', COL_ANULADAS);
    Object.keys(resumen).forEach(function (k) {
      var r = resumen[k], fs = r.fechas.sort();
      an.appendRow([id, r.docente, fs[0] + (fs.length > 1 ? ' a ' + fs[fs.length - 1] : ''), r.tipo, r.fechas.length, por, ahoraTxt_()]);
    });
    return { quitadas: quitadas };
  } finally { lock.releaseLock(); }
}

/** ¿Ese docente está fuera con estudiantes en esa sesión? (lee Novedades; para la ronda) Devuelve {motivo, texto} o null. */
function externaDe_(fecha, docente, sesion, novedades) {
  var hit = null;
  (novedades || datos_('Novedades')).forEach(function (n) {
    if (hit || n['Tipo Novedad'] !== TIPO_EXTERNA || n['Docente'] !== docente || fechaIso_(n['Fecha Novedad']) !== fecha) return;
    var s = String(n['Sesiones']);
    if (s === 'JC' || s === 'S' + sesion) hit = { motivo: n['Motivo Ausencia'], texto: String(n['Descripción'] || '').slice(0, 160) };
  });
  return hit;
}
