/**
 * Estudiantes por grupo (hoja «Estudiantes», importada del listado RCEE: solo grupo, curso, n.º de lista, apellidos y nombres) y marcas de
 * seguimiento que el directivo puede poner: no asiste (posible deserción), se ausenta o se fuga con frecuencia, remitido a orientación escolar,
 * retirado formalmente, matrícula cancelada, en proyecto o programa. Las marcas quedan en la hoja Marcas_Estudiantes (se levantan, no se borran:
 * queda quién y cuándo). Solo las ven los directivos con sesión; son datos de menores y de seguimiento: manéjelos con reserva.
 *
 * Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
 */
var COL_GRUPOS_PROY = ['tipo', 'nombre', 'creado_por', 'fecha'];
var COL_MARCAS_EST = ['id', 'clave', 'grupo', 'curso', 'apellidos', 'nombres', 'tipo', 'nota', 'registrado_por', 'fecha_registro', 'estado', 'levantada_por', 'fecha_levantada'];
var TIPOS_MARCA_EST = [   // cat: grupo en la pantalla; emo/color: distintivo visual; nombre: pide el nombre del proyecto o programa (queda en la nota)
  { id: 'NO_ASISTE', texto: 'No asiste (posible deserción)', cat: 'Alertas y seguimiento', emo: '🚫', color: '#c62828' },
  { id: 'AUSENTE', texto: 'Se ausenta con frecuencia', cat: 'Alertas y seguimiento', emo: '📉', color: '#e65100' },
  { id: 'FUGA', texto: 'Se fuga con frecuencia (se evade de clase)', cat: 'Alertas y seguimiento', emo: '🏃', color: '#b8860b' },
  { id: 'CONVIVENCIA', texto: 'Dificultad de convivencia o conducta violenta', cat: 'Alertas y seguimiento', emo: '⚠️', color: '#ad1457' },
  { id: 'SPA', texto: 'Caso de consumo de SPA', cat: 'Alertas y seguimiento', emo: '🚭', color: '#6d4c41' },
  { id: 'SALUD_MENTAL', texto: 'Salud mental o condición psiquiátrica (para orientación)', cat: 'Alertas y seguimiento', emo: '🧠', color: '#5e35b1' },
  { id: 'ORIENTACION', texto: 'Remitido a orientación escolar', cat: 'Alertas y seguimiento', emo: '🧭', color: '#6a1b9a' },
  { id: 'MATRICULA_COND', texto: 'Matrícula condicional', cat: 'Alertas y seguimiento', emo: '📝', color: '#d84315' },
  { id: 'PROYECTO', texto: 'Proyecto interno del colegio', cat: 'Proyectos y programas', emo: '📘', color: '#1565c0', nombre: true },
  { id: 'REDES_APOYO', texto: 'Beneficiario de red de apoyo u ONG', cat: 'Proyectos y programas', emo: '🤲', color: '#00897b', nombre: true },
  { id: 'GRUPO_ARTISTICO', texto: 'Grupo artístico o cultural (danza, música, banda de paz…)', cat: 'Grupos, selecciones y clubes', emo: '🎭', color: '#8e24aa', nombre: true },
  { id: 'SELECCION', texto: 'Selección o equipo deportivo (atletismo, fútbol sala, natación…)', cat: 'Grupos, selecciones y clubes', emo: '🏆', color: '#ef6c00', nombre: true },
  { id: 'CLUB', texto: 'Club académico o científico (robótica, matemáticas…)', cat: 'Grupos, selecciones y clubes', emo: '🔬', color: '#0277bd', nombre: true },
  { id: 'SENA_ARTICULACION', texto: 'Articulación con el SENA (media técnica)', cat: 'Proyectos y programas', emo: '🛠️', color: '#2e7d32', nombre: true },
  { id: 'SENA_CURSO', texto: 'Aprendiz SENA (curso o programa)', cat: 'Proyectos y programas', emo: '🎓', color: '#558b2f', nombre: true },
  { id: 'NUEVO', texto: 'Estudiante nuevo (llegó en el año)', cat: 'Matrícula', emo: '🆕', color: '#2e7d32' },
  { id: 'PROMOVIDO', texto: 'Promovido al siguiente grado', cat: 'Matrícula', emo: '⬆️', color: '#00838f' },
  { id: 'NO_LISTADO', texto: 'Agregado: no aparecía en el listado', cat: 'Matrícula', emo: '➕', color: '#00796b' },
  { id: 'OTRA_INSTITUCION', texto: 'Matriculado en otra institución', cat: 'Matrícula', emo: '🏫', color: '#6d4c41', nombre: true },
  { id: 'RETIRADO', texto: 'Retirado formalmente', cat: 'Matrícula', emo: '📤', color: '#546e7a' },
  { id: 'CANCELADA', texto: 'Matrícula cancelada', cat: 'Matrícula', emo: '⛔', color: '#37474f' },
  { id: 'SALUD', texto: 'Condición de salud o tratamiento médico', cat: 'Condición o población', emo: '🩺', color: '#00695c' },
  { id: 'LACTANTE', texto: 'Estudiante lactante', cat: 'Condición o población', emo: '🍼', color: '#c2185b' },
  { id: 'GESTANTE', texto: 'Estudiante gestante', cat: 'Condición o población', emo: '🤰', color: '#8e24aa' },
  { id: 'EXTRANJERO', texto: 'Población extranjera (venezolana, ecuatoriana u otra)', cat: 'Condición o población', emo: '🌎', color: '#0277bd' },
  { id: 'DISCAPACIDAD', texto: 'Discapacidad o necesidades educativas especiales', cat: 'Condición o población', emo: '♿', color: '#3949ab' },
  { id: 'DESPLAZADO', texto: 'Población desplazada', cat: 'Condición o población', emo: '🏚️', color: '#795548' },
  { id: 'MADRE_SUSTITUTA', texto: 'Con madre sustituta (hogar sustituto)', cat: 'Condición o población', emo: '🏠', color: '#5d4037' },
  { id: 'DEPORTISTA', texto: 'Deportista destacado', cat: 'Fortalezas y reconocimientos', emo: '🏅', color: '#ef6c00' },
  { id: 'SOBRESALIENTE', texto: 'Sobresaliente académicamente', cat: 'Fortalezas y reconocimientos', emo: '🌟', color: '#f9a825' },
  { id: 'COLABORADOR', texto: 'Colaborador del colegio (apoyo y sentido de pertenencia)', cat: 'Fortalezas y reconocimientos', emo: '🤝', color: '#2e7d32' }
];

function quitaTildes_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function codGrupoEst_(g) { g = String(g == null ? '' : g).replace(/^'/, '').trim().toUpperCase(); return /^\d+$/.test(g) && g.length < 4 ? ('0000' + g).slice(-4) : g; }   // Sheets puede quitar el cero de «0101»
function claveEst_(g, a, n) { return codGrupoEst_(g) + '|' + quitaTildes_(a).trim().toUpperCase().replace(/\s+/g, ' ') + '|' + quitaTildes_(n).trim().toUpperCase().replace(/\s+/g, ' '); }

/** Nombres de grupos, selecciones, clubes y proyectos ya creados (hoja Grupos_Proyectos + los usados en marcas vigentes), sin repetir. */
function catalogoGrupos_() {
  var vistos = {}, out = [];
  function agrega(tipoTexto, nombre) {
    nombre = String(nombre || '').trim(); if (!nombre) return;
    var k = tipoTexto + '|' + quitaTildes_(nombre).toUpperCase(); if (vistos[k]) return; vistos[k] = 1; out.push({ tipo: tipoTexto, nombre: nombre });
  }
  datosOCrea_('Grupos_Proyectos', COL_GRUPOS_PROY).forEach(function (r) { agrega(r.tipo, r.nombre); });
  var conNombre = {}; TIPOS_MARCA_EST.forEach(function (t) { if (t.nombre) conNombre[t.texto] = 1; });
  datosOCrea_('Marcas_Estudiantes', COL_MARCAS_EST).forEach(function (m) { if (m.estado === 'Vigente' && conNombre[m.tipo]) agrega(m.tipo, m.nota); });
  return out.sort(function (a, b) { return a.tipo < b.tipo ? -1 : (a.tipo > b.tipo ? 1 : (a.nombre < b.nombre ? -1 : 1)); });
}
/** Si el nombre ya existe (ignorando mayúsculas y tildes) devuelve su escritura original. */
function canonGrupo_(tipoTexto, nombre) {
  var n = quitaTildes_(nombre).toUpperCase(), hit = catalogoGrupos_().filter(function (c) { return c.tipo === tipoTexto && quitaTildes_(c.nombre).toUpperCase() === n; })[0];
  return hit ? hit.nombre : String(nombre).trim().replace(/\s+/g, ' ');
}
/** Crea (sin asignar a nadie) el nombre de un grupo, selección, club o proyecto para tenerlo en la lista. p = {tipo, nombre} */
function agregarGrupoProyecto(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var tipo = TIPOS_MARCA_EST.filter(function (t) { return t.id === p.tipo && t.nombre; })[0];
  if (!tipo) throw new Error('Elija el tipo de grupo o proyecto.');
  var nombre = String(p.nombre || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  if (nombre.length < 3) throw new Error('Escriba el nombre.');
  if (catalogoGrupos_().some(function (c) { return c.tipo === tipo.texto && quitaTildes_(c.nombre).toUpperCase() === quitaTildes_(nombre).toUpperCase(); })) throw new Error('Ese nombre ya existe.');
  hojaOCrea_('Grupos_Proyectos', COL_GRUPOS_PROY).appendRow([tipo.texto, nombre, por, ahoraTxt_()]);
  return { ok: true };
}

/** Nivel de un grupo por su código: 00 preescolar (transición), 01-05 primaria, 06-09 secundaria, CS caminar en secundaria, 10-11 media, C3/C5 ciclos de adultos. */
function nivelGrupoEst_(cod) {
  cod = String(cod || '');
  if (/^CS/.test(cod)) return 'Caminar en Secundaria';
  if (/^C\d/.test(cod)) return 'Adultos (ciclos)';
  var n = Number(cod.slice(0, 2));
  return n === 0 ? 'Preescolar (transición)' : n <= 5 ? 'Primaria (1° a 5°)' : n <= 9 ? 'Secundaria (6° a 9°)' : 'Media (10° y 11°)';
}
var NIVELES_EST = ['Preescolar (transición)', 'Primaria (1° a 5°)', 'Secundaria (6° a 9°)', 'Caminar en Secundaria', 'Media (10° y 11°)', 'Adultos (ciclos)'];

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
    if (!grupos[e.g]) { grupos[e.g] = { codigo: e.g, curso: e.curso, total: 0, nivel: nivelGrupoEst_(e.g) }; orden.push(e.g); }
    grupos[e.g].total++;
    var m = vig[claveEst_(e.g, e.a, e.n)];
    return m ? { g: e.g, no: e.no, a: e.a, n: e.n, m: m } : { g: e.g, no: e.no, a: e.a, n: e.n };
  });
  orden.sort(function (x, y) { return claveGrupo_(x) - claveGrupo_(y); });
  return { grupos: orden.map(function (c) { return grupos[c]; }), estudiantes: est, tipos: TIPOS_MARCA_EST, catalogo: catalogoGrupos_(), niveles: NIVELES_EST };
}

/** Pone una marca a uno o varios estudiantes. p = {items:[{g, a, n}], tipo, nota?} */
function marcarEstudiantes(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var tipo = TIPOS_MARCA_EST.filter(function (t) { return t.id === p.tipo; })[0];
  if (!tipo) throw new Error('Elija el tipo de marca.');
  if (tipo.nombre && String(p.nota || '').trim().length < 3) throw new Error('Escriba el nombre (del proyecto, programa o institución).');
  var items = p.items || [];
  if (!items.length) throw new Error('Elija al menos un estudiante.');
  if (items.length > 200) throw new Error('Máximo 200 estudiantes a la vez.');
  var lista = listadoEstudiantes_() || [], existe = {};
  lista.forEach(function (e) { existe[claveEst_(e.g, e.a, e.n)] = e; });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), v = sh.getDataRange().getValues(), c = {}, ya = {}, nombrePorTexto = {};
    TIPOS_MARCA_EST.forEach(function (t) { if (t.nombre) nombrePorTexto[t.texto] = 1; });
    v[0].forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (v[i][c.estado] === 'Vigente') ya[v[i][c.clave] + '|' + v[i][c.tipo] + '|' + (nombrePorTexto[v[i][c.tipo]] ? v[i][c.nota] : '')] = 1;
    var res = { marcados: 0, yaTenian: 0 }, nota = String(p.nota || '').trim().slice(0, 300);
    if (tipo.nombre) {   // el nombre del grupo o proyecto se escribe igual siempre y se agrega a la lista de nombres
      nota = canonGrupo_(tipo.texto, nota);
      if (!catalogoGrupos_().some(function (c) { return c.tipo === tipo.texto && c.nombre === nota; })) hojaOCrea_('Grupos_Proyectos', COL_GRUPOS_PROY).appendRow([tipo.texto, nota, por, ahoraTxt_()]);
    }
    items.forEach(function (it) {
      var k = claveEst_(it.g, it.a, it.n), e = existe[k];
      if (!e) return;
      if (ya[k + '|' + tipo.texto + '|' + (tipo.nombre ? nota : '')]) { res.yaTenian++; return; }
      sh.appendRow([Utilities.getUuid(), k, e.g, e.curso, e.a, e.n, tipo.texto, nota, por, ahoraTxt_(), 'Vigente', '', '']);
      ya[k + '|' + tipo.texto + '|' + (tipo.nombre ? nota : '')] = 1; res.marcados++;
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

/** Agrega a un estudiante que no aparece en el listado (llegó nuevo, o se omitió): al final del grupo, con la marca «nuevo» o «no aparecía en el listado». p = {g, a, n, nota?, motivo?: 'NUEVO'|'NO_LISTADO'} */
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
    ponMarcaEst_(hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), { g: g, curso: curso, a: a, n: n }, p.motivo === 'NO_LISTADO' ? 'NO_LISTADO' : 'NUEVO', (p.nota ? p.nota + ' · ' : '') + (p.motivo === 'NO_LISTADO' ? 'Agregado el ' : 'Ingresó el ') + ymd_(new Date()), por);
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
