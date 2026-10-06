/**
 * Estudiantes por grupo (hoja «Estudiantes», importada del listado RCEE: solo grupo, curso, n.º de lista, apellidos y nombres) y marcas de
 * seguimiento que el directivo puede poner: no asiste (posible deserción), se ausenta o se fuga con frecuencia, remitido a orientación escolar,
 * retirado formalmente, matrícula cancelada, en proyecto o programa. Las marcas quedan en la hoja Marcas_Estudiantes (se levantan, no se borran:
 * queda quién y cuándo). Solo las ven los directivos con sesión; son datos de menores y de seguimiento: manéjelos con reserva.
 *
 * Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
 */
var COL_MARCAS_EST = ['id', 'clave', 'grupo', 'curso', 'apellidos', 'nombres', 'tipo', 'nota', 'registrado_por', 'fecha_registro', 'estado', 'levantada_por', 'fecha_levantada'];
var TIPOS_MARCA_EST = [
  { id: 'NO_ASISTE', texto: 'No asiste (posible deserción)' },
  { id: 'AUSENTE', texto: 'Se ausenta con frecuencia' },
  { id: 'FUGA', texto: 'Se fuga con frecuencia (se evade de clase)' },
  { id: 'ORIENTACION', texto: 'Remitido a orientación escolar' },
  { id: 'PROYECTO', texto: 'En proyecto o programa especial' },
  { id: 'RETIRADO', texto: 'Retirado formalmente' },
  { id: 'CANCELADA', texto: 'Matrícula cancelada' },
  { id: 'NUEVO', texto: 'Estudiante nuevo (llegó en el año)' },
  { id: 'PROMOVIDO', texto: 'Promovido al siguiente grado' }
];

function quitaTildes_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function codGrupoEst_(g) { g = String(g == null ? '' : g).replace(/^'/, '').trim().toUpperCase(); return /^\d+$/.test(g) && g.length < 4 ? ('0000' + g).slice(-4) : g; }   // Sheets puede quitar el cero de «0101»
function claveEst_(g, a, n) { return codGrupoEst_(g) + '|' + quitaTildes_(a).trim().toUpperCase().replace(/\s+/g, ' ') + '|' + quitaTildes_(n).trim().toUpperCase().replace(/\s+/g, ' '); }

function listadoEstudiantes_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Estudiantes');
  if (!sh) return null;
  return datos_('Estudiantes').filter(function (r) { return String(r.apellidos || '').trim() || String(r.nombres || '').trim(); }).map(function (r) {
    return { g: codGrupoEst_(r.grupo), curso: String(r.curso || ''), no: Number(r.no) || 0, a: String(r.apellidos || '').trim(), n: String(r.nombres || '').trim() };
  });
}

/** Datos de la pestaña Estudiantes: grupos con totales, estudiantes (con sus marcas vigentes) y los tipos de marca. */
function datosEstudiantes() {
  exigirDirectivo_();
  var lista = listadoEstudiantes_();
  if (!lista) return { sinDatos: true, tipos: TIPOS_MARCA_EST };
  var vig = {};
  datosOCrea_('Marcas_Estudiantes', COL_MARCAS_EST).forEach(function (m) {
    if (String(m.estado) !== 'Vigente') return;
    (vig[m.clave] = vig[m.clave] || []).push({ id: m.id, tipo: m.tipo, nota: String(m.nota || ''), por: m.registrado_por, fecha: String(m.fecha_registro || '').slice(0, 10) });
  });
  var grupos = {}, orden = [];
  lista.sort(function (x, y) { return claveGrupo_(x.g) - claveGrupo_(y.g) || x.no - y.no; });   // orden de lista: preescolar a 11° (CS tras sextos y novenos)
  var est = lista.map(function (e) {
    if (!grupos[e.g]) { grupos[e.g] = { codigo: e.g, curso: e.curso, total: 0 }; orden.push(e.g); }
    grupos[e.g].total++;
    var m = vig[claveEst_(e.g, e.a, e.n)];
    return m ? { g: e.g, no: e.no, a: e.a, n: e.n, m: m } : { g: e.g, no: e.no, a: e.a, n: e.n };
  });
  orden.sort(function (x, y) { return claveGrupo_(x) - claveGrupo_(y); });
  return { grupos: orden.map(function (c) { return grupos[c]; }), estudiantes: est, tipos: TIPOS_MARCA_EST };
}

/** Pone una marca a uno o varios estudiantes. p = {items:[{g, a, n}], tipo, nota?} */
function marcarEstudiantes(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var tipo = TIPOS_MARCA_EST.filter(function (t) { return t.id === p.tipo; })[0];
  if (!tipo) throw new Error('Elija el tipo de marca.');
  var items = p.items || [];
  if (!items.length) throw new Error('Elija al menos un estudiante.');
  if (items.length > 200) throw new Error('Máximo 200 estudiantes a la vez.');
  var lista = listadoEstudiantes_() || [], existe = {};
  lista.forEach(function (e) { existe[claveEst_(e.g, e.a, e.n)] = e; });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), v = sh.getDataRange().getValues(), c = {}, ya = {};
    v[0].forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (v[i][c.estado] === 'Vigente') ya[v[i][c.clave] + '|' + v[i][c.tipo]] = 1;
    var res = { marcados: 0, yaTenian: 0 }, nota = String(p.nota || '').trim().slice(0, 300);
    items.forEach(function (it) {
      var k = claveEst_(it.g, it.a, it.n), e = existe[k];
      if (!e) return;
      if (ya[k + '|' + tipo.texto]) { res.yaTenian++; return; }
      sh.appendRow([Utilities.getUuid(), k, e.g, e.curso, e.a, e.n, tipo.texto, nota, por, ahoraTxt_(), 'Vigente', '', '']);
      ya[k + '|' + tipo.texto] = 1; res.marcados++;
    });
    if (!res.marcados && !res.yaTenian) throw new Error('No se encontró a los estudiantes elegidos.');
    return res;
  } finally { lock.releaseLock(); }
}

/** Levanta una marca (queda anotado quién y cuándo; no se borra). p = {id, nota?} */
function levantarMarcaEstudiante(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email, id = String((p && p.id) || '');
  var sh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), v = sh.getDataRange().getValues(), c = {};
  v[0].forEach(function (k, i) { c[k] = i; });
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][c.id]) !== id) continue;
    if (v[i][c.estado] !== 'Vigente') throw new Error('Esa marca ya estaba levantada.');
    sh.getRange(i + 1, c.estado + 1).setValue('Levantada');
    sh.getRange(i + 1, c.levantada_por + 1).setValue(por);
    sh.getRange(i + 1, c.fecha_levantada + 1).setValue(ahoraTxt_());
    return { ok: true };
  }
  throw new Error('No se encontró la marca.');
}

function textoMarca_(id) { return TIPOS_MARCA_EST.filter(function (t) { return t.id === id; })[0].texto; }
function ponMarcaEst_(sh, e, tipoId, nota, por) {
  sh.appendRow([Utilities.getUuid(), claveEst_(e.g, e.a, e.n), e.g, e.curso, e.a, e.n, textoMarca_(tipoId), String(nota || '').slice(0, 300), por, ahoraTxt_(), 'Vigente', '', '']);
}

/** Estudiante que llega nuevo durante el año: se agrega a la lista del grupo (al final) con la marca «nuevo». p = {g, a, n, nota?} */
function agregarEstudiante(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var g = codGrupoEst_(p.g), a = String(p.a || '').trim().replace(/\s+/g, ' ').toUpperCase(), n = String(p.n || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!a || !n) throw new Error('Escriba apellidos y nombres.');
  var lista = listadoEstudiantes_();
  if (!lista) throw new Error('Primero cargue el listado de estudiantes (hoja Estudiantes).');
  var delGrupo = lista.filter(function (e) { return e.g === g; });
  if (!delGrupo.length) throw new Error('Elija un grupo de la lista.');
  if (lista.some(function (e) { return claveEst_(e.g, e.a, e.n) === claveEst_(g, a, n); })) throw new Error('Ese estudiante ya está en el grupo.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var no = delGrupo.reduce(function (m, e) { return Math.max(m, e.no); }, 0) + 1, curso = delGrupo[0].curso;
    hoja_('Estudiantes').appendRow([txtForzado_(g), curso, no, a, n]);
    ponMarcaEst_(hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), { g: g, curso: curso, a: a, n: n }, 'NUEVO', (p.nota ? p.nota + ' · ' : '') + 'Ingresó el ' + ymd_(new Date()), por);
    return { ok: true, no: no };
  } finally { lock.releaseLock(); }
}

/** Pasa a un estudiante a otro grupo (p. ej. promovido al siguiente grado). Conserva sus marcas vigentes y deja la marca «promovido» con el detalle. p = {g, a, n, destino, nota?} */
function moverEstudiante(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var lista = listadoEstudiantes_();
  if (!lista) throw new Error('No hay listado de estudiantes.');
  var k = claveEst_(p.g, p.a, p.n), destino = codGrupoEst_(p.destino);
  var orig = lista.filter(function (e) { return claveEst_(e.g, e.a, e.n) === k; })[0];
  if (!orig) throw new Error('No se encontró al estudiante.');
  var delDestino = lista.filter(function (e) { return e.g === destino; });
  if (!delDestino.length) throw new Error('Elija el grupo de destino.');
  if (destino === orig.g) throw new Error('El grupo de destino es el mismo.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hoja_('Estudiantes'), v = sh.getDataRange().getValues(), c = {}, fila = -1;
    v[0].forEach(function (x, i) { c[x] = i; });
    for (var i = 1; i < v.length; i++) if (claveEst_(v[i][c.grupo], v[i][c.apellidos], v[i][c.nombres]) === k) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró al estudiante.');
    var no = delDestino.reduce(function (m, e) { return Math.max(m, e.no); }, 0) + 1, curso = delDestino[0].curso;
    sh.getRange(fila + 1, c.grupo + 1).setValue(txtForzado_(destino));
    sh.getRange(fila + 1, c.curso + 1).setValue(curso);
    sh.getRange(fila + 1, c.no + 1).setValue(no);
    var mh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), mv = mh.getDataRange().getValues(), mc = {}, nk = claveEst_(destino, orig.a, orig.n);
    mv[0].forEach(function (x, i) { mc[x] = i; });
    for (var j = 1; j < mv.length; j++) if (mv[j][mc.clave] === k && mv[j][mc.estado] === 'Vigente') {   // las marcas vigentes lo siguen al nuevo grupo
      mh.getRange(j + 1, mc.clave + 1).setValue(nk); mh.getRange(j + 1, mc.grupo + 1).setValue(txtForzado_(destino)); mh.getRange(j + 1, mc.curso + 1).setValue(curso);
    }
    ponMarcaEst_(mh, { g: destino, curso: curso, a: orig.a, n: orig.n }, 'PROMOVIDO', 'De ' + orig.curso + ' a ' + curso + (p.nota ? ' · ' + p.nota : '') + ' (' + ymd_(new Date()) + ')', por);
    return { ok: true, curso: curso, no: no };
  } finally { lock.releaseLock(); }
}
