/**
 * Comisiones de evaluación y promoción: el acta del grado que arman entre todos los docentes.
 *
 * Una acta = un grado en un periodo del año. Se guarda en tres hojas del libro:
 *  - Comision_Actas:     una fila por acta (estado ABIERTA / CERRADA, responsable del cierre, número de acta, hora de cierre).
 *  - Comision_Secciones: una fila por sección y acta (JSON + versión). Cada docente guarda SU sección (su curso o su área) y así no se pisan.
 *  - Comision_Log:       quién hizo qué (confirmaciones, reaperturas, cierres, soportes).
 *
 * Reglas (acordadas con la coordinación académica):
 *  - Matrícula y reconocimientos se confirman por curso; lo confirmado queda OFICIAL y se bloquea para el docente. Solo coordinación académica
 *    (quien administra) lo reabre, con justificación escrita (mínimo 10 caracteres) que queda en el registro.
 *  - La matrícula debe cuadrar. En el acta final, promovidos + no promovidos = matrícula actual de cada curso.
 *  - Los requisitos previos (notas cargadas, planillas, resúmenes, cuadernos, observaciones, información faltante) se verifican antes de iniciar.
 *  - El cierre lo propone una persona y lo confirman todos los integrantes (o se excluyen los no conectados); la hora de cierre la pone el sistema.
 *  - Quien no firma se entiende que no asistió. Las firmas se registran al comienzo y al finalizar en el acta impresa.
 *  - Los informes que ven los docentes se calculan por reglas; la IA (si se activa) es solo para directivos y no vive aquí.
 * TODO en Drive vive en una sola carpeta, «APP ASISTENCIA DOCENTE»: COMISIONES año / Comisiones Evaluación P1 ICET año / Grado X / Anexos (PIAR, DUA, compromisos) y / Borradores (copia legible de lo que se lleva).
 * Los respaldos de los libros van en «App Asistencia / Respaldos» (Respaldo.gs).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var COL_CACTAS = ['id', 'anio', 'periodo', 'grado', 'acta_no', 'estado', 'responsable', 'creada_por', 'fecha_creacion', 'cerrada_por', 'fecha_cierre', 'hora_cierre', 'reaperturas'];
var COL_CSEC = ['acta_id', 'seccion', 'version', 'json', 'actualizado_por', 'fecha'];
var COL_CLOG = ['fecha', 'acta_id', 'usuario', 'accion', 'detalle'];
var PERIODOS_COM = ['Primero', 'Segundo', 'Tercero', 'Final'];
var LIM_RECONOC = [1, 2, 2];                  // cupos por curso: excelencia, rendimiento académico, convivencia escolar
var MAX_JSON_SECCION = 45000;                  // una celda de Sheets admite 50.000 caracteres
var MAX_BYTES_COM = 8 * 1024 * 1024;
var MIME_COM = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
var SECCIONES_COM = /^(general|integrantes|requisitos|firmas|faltantes|listos|(matricula|estudiantes|reconocimientos|promocion|obs):[0-9A-Za-z]+|(areas|recomendaciones):.{1,80})$/;

/* ------------------------------ hojas y registro ------------------------------ */
function comisionPrepararHojas() {
  hojaOCrea_('Comision_Actas', COL_CACTAS); hojaOCrea_('Comision_Secciones', COL_CSEC); hojaOCrea_('Comision_Log', COL_CLOG);
  return 'Hojas de comisiones listas.';
}
function comisionLog_(acta, usuario, accion, detalle) {
  hojaOCrea_('Comision_Log', COL_CLOG).appendRow([ahoraTxt_(), acta, usuario, accion, String(detalle || '').slice(0, 500)]);
}
function comisionActas_() { return datosOCrea_('Comision_Actas', COL_CACTAS); }
function comisionActa_(id) {
  var a = comisionActas_().filter(function (x) { return String(x.id) === String(id); })[0];
  if (!a) throw new Error('No existe esa acta.');
  return a;
}
function comisionFilaActa_(id) {
  var v = hojaOCrea_('Comision_Actas', COL_CACTAS).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) return i + 1;
  return 0;
}
function comisionSecciones_(id) {
  var out = {};
  datosOCrea_('Comision_Secciones', COL_CSEC).forEach(function (s) {
    if (String(s.acta_id) !== String(id)) return;
    var d = null; try { d = JSON.parse(s.json); } catch (e) { d = null; }
    out[s.seccion] = { version: Number(s.version) || 0, datos: d, por: s.actualizado_por, fecha: String(s.fecha) };
  });
  return out;
}
/** Escribe (o crea) una sección. Uso interno: la verificación de permisos va antes. */
function comisionEscribe_(id, seccion, datos, por) {
  var sh = hojaOCrea_('Comision_Secciones', COL_CSEC), v = sh.getDataRange().getValues(), json = JSON.stringify(datos == null ? null : datos);
  if (json.length > MAX_JSON_SECCION) throw new Error('La sección «' + seccion + '» es demasiado grande (' + json.length + ' caracteres; el máximo es ' + MAX_JSON_SECCION + ').');
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id) && v[i][1] === seccion) {
      var nv = (Number(v[i][2]) || 0) + 1;
      sh.getRange(i + 1, 3, 1, 4).setValues([[nv, json, por, ahoraTxt_()]]);
      return nv;
    }
  }
  sh.appendRow([id, seccion, 1, json, por, ahoraTxt_()]);
  return 1;
}

/* ------------------------------ quién es y qué le corresponde ------------------------------ */
function comisionQuien_() {
  var id = identidad_();
  if (id.rol === 'directivo') return { rol: 'directivo', nombre: nombreDirectivoCompleto_(id.nombre) || id.email, email: id.email, coord: puedeAdministrar_(id) };
  if (id.rol === 'docente') {
    if (!id.autorizado && !id.preregistro) { /* mismo criterio que el resto: el docente debe haber aceptado la autorización al registrarse */ }
    return { rol: 'docente', nombre: id.docente, email: id.email, coord: false };
  }
  throw new Error('Debe iniciar sesión con una cuenta autorizada.');
}
function comisionSinTildes_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
/** Cursos (grupos) que dirige y áreas que dicta el docente en un grado. Coordinación y rectoría ven todo. */
function comisionAlcance_(quien, grado) {
  if (quien.rol === 'directivo') return { todo: true, cursos: [], areas: [], multiareas: true };
  var nom = comisionSinTildes_(quien.nombre), cursos = [], areas = [], multi = false, esDelGrado = function (g) { return partesGrupo_(g).grado === grado; };
  datos_('Direccion_Grupo').forEach(function (d) {
    if (!esDelGrado(d.grupo)) return;
    if (comisionSinTildes_(d.docente_1) === nom || comisionSinTildes_(d.docente_2) === nom) cursos.push(String(d.grupo));
  });
  datos_('Horario').forEach(function (h) {
    if (comisionSinTildes_(h.docente) !== nom || !esDelGrado(h.grupo)) return;
    var a = String(h.area || '').trim();
    if (/MULTIPLES/i.test(comisionSinTildes_(a))) { multi = true; return; }
    /* el Horario del libro usa códigos (MAT, CAS, CSI…): se traducen a las áreas del acta */
    (COM_COD_AREA[comisionSinTildes_(a)] || [a]).forEach(function (x) { if (x && areas.indexOf(x) < 0) areas.push(x); });
  });
  return { todo: false, cursos: cursos, areas: areas, multiareas: multi || (cursos.length > 0 && /^0[0-5]$/.test(String(grado))) };
}
/** ¿Puede escribir esta sección? Devuelve null si puede o el motivo si no. */
function comisionPermisoSeccion_(quien, alcance, seccion, secciones) {
  if (!SECCIONES_COM.test(seccion)) return 'Sección no válida.';
  var p = seccion.split(':'), tipo = p[0], clave = p.slice(1).join(':');
  if (tipo === 'general' || tipo === 'integrantes' || tipo === 'requisitos' || tipo === 'firmas' || tipo === 'faltantes' || tipo === 'listos') return null;
  if (alcance.todo) { /* coordinación y rectoría pueden corregir */ } else if (['matricula', 'estudiantes', 'reconocimientos', 'promocion', 'obs'].indexOf(tipo) >= 0) {
    if (alcance.cursos.indexOf(clave) < 0) return 'Solo el director o directora del curso puede editar esta sección.';
  } else if (alcance.areas.indexOf(clave) < 0 && !alcance.multiareas) {
    return 'Solo el docente de esta área puede editarla.';
  }
  var conf = secciones && secciones['confirm:' + tipo + ':' + clave];
  if ((tipo === 'matricula' || tipo === 'reconocimientos') && conf && conf.datos && conf.datos.ok && !quien.coord) {
    return 'Esta sección está confirmada y es oficial: solo coordinación académica puede reabrirla.';
  }
  return null;
}

/* ------------------------------ reglas puras (probadas aparte) ------------------------------ */
function comisionTotalMatricula_(m) { return (Number(m.ini) || 0) + (Number(m.nu) || 0) - (Number(m.re) || 0) - (Number(m.de) || 0); }
/** Mensajes de lo que no cuadra en la matrícula de un curso (vacío = balanceada). */
function comisionBalanceMatricula_(m) {
  var t = comisionTotalMatricula_(m || {}), r = [];
  if (t <= 0) r.push('el total actual debe ser mayor que 0.');
  var d = t - ((Number(m.m) || 0) + (Number(m.f) || 0));
  if (d) r.push('hombres + mujeres no igualan el total actual (' + t + '): ' + (d > 0 ? 'faltan ' + d : 'sobran ' + (-d)) + '.');
  if ((Number(m.ve) || 0) + (Number(m.ec) || 0) > t) r.push('VEN + ECU supera el total actual.');
  return r;
}
/** Cupos y regla de puestos de los reconocimientos de un curso. filas = [{tipo: 0..4, puesto, prom}] */
function comisionValidaReconocimientos_(filas) {
  var r = [], porTipo = [0, 0, 0, 0, 0];
  (filas || []).forEach(function (f) {
    var t = Number(f.tipo);
    if (t >= 0 && t < 5) porTipo[t]++;
    if (t <= 2) { var n = parseFloat(String(f.prom).replace(',', '.')); if (!(n >= 1 && n <= 5)) r.push('falta el promedio (1,0 a 5,0) de un reconocido.'); }
  });
  LIM_RECONOC.forEach(function (lim, i) { if (porTipo[i] > lim) r.push('el tipo ' + (i + 1) + ' tiene ' + porTipo[i] + ' y el máximo es ' + lim + '.'); });
  var ex = (filas || []).filter(function (f) { return Number(f.tipo) === 0; }), rd = (filas || []).filter(function (f) { return Number(f.tipo) === 1; });
  if (ex.some(function (f) { return Number(f.puesto) !== 1; })) r.push('la excelencia es para el 1.er puesto académico.');
  var ok = ex.length ? [2, 3] : [1, 2];
  rd.forEach(function (f) { if (ok.indexOf(Number(f.puesto)) < 0) r.push('el rendimiento académico va a los puestos ' + ok.join(' y ') + ' (hay uno en el ' + f.puesto + ').'); });
  return r;
}
/** Promoción de un curso: promovidos + no promovidos debe ser la matrícula actual. prom = {lista, no_promovidos} */
function comisionPromocionCuadra_(mat, prom) {
  var t = comisionTotalMatricula_(mat || {}), n = Number(prom && prom.lista) || 0, np = Number(prom && prom.no_promovidos) || 0, r = [];
  if (n > t) r.push('la lista tiene ' + n + ' estudiantes y la matrícula actual es ' + t + ': no puede haber más estudiantes que matriculados.');
  else if (n < t) r.push('la lista tiene ' + n + ' estudiantes y la matrícula actual es ' + t + ': faltan ' + (t - n) + ' por registrar.');
  if (np > n) r.push('hay más no promovidos (' + np + ') que estudiantes en la lista (' + n + ').');
  return r;
}
/** El cierre está completo cuando cada integrante que firma confirmó o fue excluido. */
function comisionCierreCompleto_(integrantes, cierre) {
  if (!cierre) return false;
  var P = (integrantes || []).filter(function (x) { return x.p && x.cierre !== false; });
  return P.length > 0 && P.every(function (x) { return cierre.conf && cierre.conf[x.n] || cierre.excl && cierre.excl[x.n]; });
}
/** Siguiente número de acta: consecutivo de las actas del grado en el año (si el 3.er periodo no se presentó, la final es la número 3). */
function comisionNumeroSugerido_(anio, grado) {
  return comisionActas_().filter(function (a) { return String(a.anio) === String(anio) && String(a.grado) === String(grado); }).length + 1;
}

/* ------------------------------ API ------------------------------ */
/** Lo que necesita la pantalla al abrir: quién es, qué grados hay y las actas del año. */
function comisionContexto() {
  var quien = comisionQuien_(), anio = Number(parametro_('anio_lectivo', String(new Date().getFullYear()))), grados = {};
  datos_('Grupos').forEach(function (g) { var p = partesGrupo_(g.grupo); if (p.grado !== 'N/A' && p.grado !== 'ORI' && p.grado !== 'PTA') grados[p.grado] = 1; });
  var lista = comisionActas_().filter(function (a) { return String(a.anio) === String(anio); }).map(function (a) {
    return { id: a.id, periodo: a.periodo, grado: a.grado, acta_no: a.acta_no, estado: a.estado, responsable: a.responsable, hora_cierre: a.hora_cierre };
  });
  var visibles = lista;
  if (!quien.coord && quien.rol === 'docente') visibles = lista.filter(function (a) { var al = comisionAlcance_(quien, String(a.grado)); return al.cursos.length || al.areas.length || al.multiareas; });
  return { anio: anio, quien: { nombre: quien.nombre, rol: quien.rol, coord: quien.coord }, periodos: PERIODOS_COM, grados: Object.keys(grados).sort(), actas: visibles };
}
/** Abre el acta del grado y periodo (la crea si no existe; fecha, hora y grado empiezan en blanco: los llena el equipo). */
function comisionAbrir(p) {
  var quien = comisionQuien_(); p = p || {};
  var anio = Number(p.anio) || Number(parametro_('anio_lectivo', String(new Date().getFullYear())));
  if (PERIODOS_COM.indexOf(p.periodo) < 0) throw new Error('Elija el periodo.');
  var grado = String(p.grado || '');
  if (!datos_('Grupos').some(function (g) { return partesGrupo_(g.grupo).grado === grado; })) throw new Error('Ese grado no existe.');
  var al = comisionAlcance_(quien, grado);
  if (!al.todo && !al.cursos.length && !al.areas.length && !al.multiareas) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var ex = comisionActas_().filter(function (a) { return String(a.anio) === String(anio) && a.periodo === p.periodo && String(a.grado) === grado; })[0];
    if (!ex) {
      var id = Utilities.getUuid(), no = comisionNumeroSugerido_(anio, grado);
      hojaOCrea_('Comision_Actas', COL_CACTAS).appendRow([id, anio, p.periodo, grado, no, 'ABIERTA', (quien.rol === 'docente' ? quien.nombre : ''), quien.nombre, ahoraTxt_(), '', '', '', 0]);
      comisionLog_(id, quien.nombre, 'ABRIR', p.periodo + ' · grado ' + grado + ' · acta ' + no);
      ex = comisionActa_(id);
    }
    return comisionCargar({ acta: ex.id });
  } finally { lock.releaseLock(); }
}
function comisionCargar(p) {
  var quien = comisionQuien_(), a = comisionActa_((p || {}).acta), al = comisionAlcance_(quien, String(a.grado));
  if (!al.todo && !al.cursos.length && !al.areas.length && !al.multiareas) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  return { acta: a, alcance: al, quien: { nombre: quien.nombre, rol: quien.rol, coord: quien.coord }, secciones: comisionSecciones_(a.id) };
}
/** Solo lo que cambió desde la versión que ya tiene la pantalla (para refrescar cada pocos segundos sin traer todo). */
function comisionCambios(p) {
  comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta), vistas = p.versiones || {}, todas = comisionSecciones_(a.id), cambios = {};
  Object.keys(todas).forEach(function (k) { if ((vistas[k] || 0) !== todas[k].version) cambios[k] = todas[k]; });
  return { estado: a.estado, responsable: a.responsable, hora_cierre: a.hora_cierre, cambios: cambios };
}
/** Guarda UNA sección. p = {acta, seccion, datos, version}. Si otra persona la cambió antes, devuelve el conflicto sin pisar nada. */
function comisionGuardar(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta);
    if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada (solo lectura). Solo coordinación académica puede reabrirla.');
    var al = comisionAlcance_(quien, String(a.grado)), secs = comisionSecciones_(a.id);
    var no = comisionPermisoSeccion_(quien, al, String(p.seccion || ''), secs);
    if (no) throw new Error(no);
    var actual = secs[p.seccion];
    if (actual && (Number(p.version) || 0) !== actual.version) return { conflicto: true, version: actual.version, datos: actual.datos, por: actual.por };
    if (!actual && Number(p.version)) return { conflicto: true, version: 0, datos: null, por: '' };
    var v = comisionEscribe_(a.id, p.seccion, p.datos, quien.nombre);
    return { ok: true, version: v };
  } finally { lock.releaseLock(); }
}
/** Elige al docente responsable del registro y del cierre (cualquier integrante puede proponerlo; queda en la fila del acta). */
function comisionResponsable(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
  var fila = comisionFilaActa_(a.id); hojaOCrea_('Comision_Actas', COL_CACTAS).getRange(fila, 7).setValue(String(p.nombre || ''));
  comisionLog_(a.id, quien.nombre, 'RESPONSABLE', p.nombre);
  return { ok: true };
}
/** Confirma o reabre la matrícula, los reconocimientos o la promoción de un curso. p = {acta, tipo, curso, on, justificacion} */
function comisionConfirmar(p) {
  var quien = comisionQuien_(); p = p || {};
  if (['matricula', 'reconocimientos', 'promocion'].indexOf(p.tipo) < 0) throw new Error('Tipo de confirmación no válido.');
  var curso = String(p.curso || '');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
    var al = comisionAlcance_(quien, String(a.grado)), secs = comisionSecciones_(a.id), clave = 'confirm:' + p.tipo + ':' + curso;
    var ya = secs[clave] && secs[clave].datos || { ok: false, veces: 0 };
    if (p.on) {
      if (!al.todo && al.cursos.indexOf(curso) < 0) throw new Error('Solo el director o directora del curso confirma.');
      if (ya.ok) throw new Error('Ya está confirmado.');
      var mat = secs['matricula:' + curso] && secs['matricula:' + curso].datos;
      if (p.tipo === 'matricula') {
        if (!mat) throw new Error('Falta registrar la matrícula del curso.');
        var m = comisionBalanceMatricula_(mat); if (m.length) throw new Error('La matrícula no cuadra: ' + m.join(' '));
      } else if (p.tipo === 'reconocimientos') {
        var rc = secs['reconocimientos:' + curso] && secs['reconocimientos:' + curso].datos, m2 = comisionValidaReconocimientos_(rc && rc.filas || []);
        if (m2.length) throw new Error('No se puede confirmar los reconocimientos: ' + m2.join(' '));
      } else {
        if (a.periodo !== 'Final') throw new Error('La promoción solo se confirma en el acta final.');
        var pr = secs['promocion:' + curso] && secs['promocion:' + curso].datos;
        if (!mat) throw new Error('Falta registrar la matrícula del curso.');
        var m3 = comisionPromocionCuadra_(mat, pr); if (m3.length) throw new Error('La promoción no cuadra con la matrícula: ' + m3.join(' '));
      }
      comisionEscribe_(a.id, clave, { ok: true, por: quien.nombre, fecha: ahoraTxt_(), veces: (ya.veces || 0) + 1 }, quien.nombre);
      comisionLog_(a.id, quien.nombre, 'CONFIRMAR', p.tipo + ' · ' + curso);
    } else {
      if (!quien.coord) throw new Error('Lo confirmado es oficial: solo coordinación académica puede reabrirlo. Búsquela para que active de nuevo la confirmación.');
      var j = String(p.justificacion || '').trim();
      if (j.length < 10) throw new Error('Escriba una justificación clara (mínimo 10 caracteres).');
      if (!ya.ok) throw new Error('No está confirmado.');
      comisionEscribe_(a.id, clave, { ok: false, por: quien.nombre, fecha: ahoraTxt_(), veces: ya.veces || 0 }, quien.nombre);
      comisionLog_(a.id, quien.nombre, 'REABRIR_CONFIRMACION', p.tipo + ' · ' + curso + ' · ' + j);
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/** Códigos de área del Horario → áreas del acta (CSI = Ciencias Sociales e Inglés; ETR = Ética y Religión). */
var COM_COD_AREA = { MAT: ['Matemáticas'], CAS: ['Humanidades y Lengua Castellana'], CNA: ['Ciencias Naturales y Educación Ambiental'], CSI: ['Ciencias Sociales', 'Inglés'], ETR: ['Educación Ética y Valores Humanos', 'Educación Religiosa Escolar'], ART: ['Educación Artística (Arte y Cultura Afro)'], ERD: ['Educación Física, Recreación y Deportes'], TEI: ['Tecnología e Informática'] };
var COM_AREAS = ['Matemáticas', 'Humanidades y Lengua Castellana', 'Ciencias Naturales y Educación Ambiental', 'Ciencias Sociales', 'Inglés', 'Educación Ética y Valores Humanos', 'Educación Religiosa Escolar', 'Educación Artística (Arte y Cultura Afro)', 'Educación Física, Recreación y Deportes', 'Tecnología e Informática'];
var COM_PRE_CLAVES = ['Propósito 1. Construcción de identidad y relaciones sociales', 'Propósito 2. Comunicación activa, expresión y representación', 'Propósito 3. Exploración del medio y aprendizaje significativo', 'Experiencias y pensamiento computacional'];
/** '00' preescolar · '01'..'05' primaria · el resto, secundaria y media. */
function comisionNivel_(grado) { grado = String(grado); return grado === '00' ? 'pre' : /^0[1-5]$/.test(grado) ? 'pri' : 'sec'; }
function comisionOkMail_(e) { e = String(e || '').trim(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !/@icet\.edu\.co$/i.test(e); }
function comisionOkTel_(t) { return /^\d{7,12}$/.test(String(t || '').replace(/\D/g, '')); }
/**
 * Lista de pendientes del acta (la MISMA regla que la pantalla). Cada ítem: {paso, comp, curso, persona, msg, donde, adv}.
 * adv = advertencia (no impide cerrar). Todo lo demás impide cerrar y hay que regresar a corregirlo.
 * Cada componente debe tener registros o la declaración «sin casos»; así no llegan actas con componentes vacíos.
 */
function comisionPendientes_(a, secs) {
  var L = [], nivel = comisionNivel_(a.grado), pre = nivel === 'pre', fin = a.periodo === 'Final';
  var d = function (k) { return secs[k] && secs[k].datos; };
  var add = function (paso, comp, curso, persona, msg, donde, adv) { L.push({ paso: paso, comp: comp, curso: curso || '', persona: persona || '', msg: msg, donde: donde || '', adv: !!adv }); };
  var req = d('requisitos') || {}, ints = d('integrantes') || [], P = ints.filter(function (x) { return x.p; });
  ['notas', 'planillas', 'resumenes', 'cuadernos', 'observ', 'faltantes'].forEach(function (k) { if (!req[k]) add('s0', 'Requisitos previos', '', '', 'Falta verificar el requisito «' + k + '».', 'Cada docente'); });
  if (!a.responsable) add('s0', 'Asistencia', '', '', 'Falta elegir al docente responsable del cierre.', 'El equipo');
  if (!P.length) add('s0', 'Asistencia', '', '', 'Faltan los integrantes que asistieron.', 'El equipo');
  P.forEach(function (x) {
    if (!comisionOkMail_(x.correo)) add('s0', 'Docentes', '', x.n, 'Falta el correo PERSONAL válido (no el institucional).', 'El propio docente');
    if (!comisionOkTel_(x.tel)) add('s0', 'Docentes', '', x.n, 'Falta un celular válido.', 'El propio docente');
    if (!/^\d{5,12}$/.test(String(x.ced || '').replace(/\D/g, ''))) add('p2', 'Docentes', '', x.n, 'Falta el número de cédula.', 'Rectoría, archivo o coordinador');
    if (x.cierre !== false && !(d('firmas') || {})[x.n]) add('s8', 'Firmas', '', x.n, 'Falta su firma de cierre.', 'El propio docente');
  });
  var cursos = [];
  datos_('Grupos').forEach(function (g) { if (partesGrupo_(g.grupo).grado === String(a.grado)) cursos.push(String(g.grupo)); });
  var cf = function (t, c) { var x = d('confirm:' + t + ':' + c); return !!(x && x.ok); };
  var areasReg = pre ? [] : COM_AREAS;
  cursos.forEach(function (c) {
    var mat = d('matricula:' + c), est = d('estudiantes:' + c) || {}, sc = est.sc || {}, rec = d('reconocimientos:' + c) || {};
    if (!mat) add('s1', 'Matrícula', c, '', 'Falta registrar la matrícula del curso.', 'Director/a de grupo');
    else { comisionBalanceMatricula_(mat).forEach(function (m) { add('s1', 'Matrícula', c, '', m, 'Director/a de grupo'); }); if (!cf('matricula', c)) add('s1', 'Matrícula', c, '', 'Falta confirmar la matrícula del curso.', 'Director/a de grupo'); }
    // áreas / propósitos: cifras o «ningún área con reprobados»
    var hay = pre ? COM_PRE_CLAVES.length && (d('areas:propositos') || {}).por_consolidar > 0 : areasReg.some(function (ar) { var x = d('areas:' + ar); return x && x.por_curso && Number(x.por_curso[c]) > 0; });
    if (!hay && !sc.areas) add('s2', pre ? 'Propósitos' : 'Áreas', c, '', 'Registre ' + (pre ? 'los propósitos por consolidar' : 'los reprobados por área') + ' o declare que no hubo.', 'Docentes del área y director/a de grupo');
    // reprobación (o deserción e inasistencia en preescolar): estudiantes o «sin casos»
    var rep = est.rep || [];
    if (!rep.length && !sc.rep) add('s3', pre ? 'Deserción e inasistencia' : 'Reprobación', c, '', 'Agregue los estudiantes o declare que no hubo casos.', 'Director/a de grupo');
    if (!pre) areasReg.forEach(function (ar) {
      var x = d('areas:' + ar), cifra = x && x.por_curso ? Number(x.por_curso[c]) || 0 : 0, n = rep.filter(function (r) { return (r.areas || []).indexOf(ar) >= 0; }).length;
      if (cifra !== n) add('s3', 'Reprobación', c, '', ar + ': la cifra dice ' + cifra + ' y hay ' + n + ' estudiantes registrados con esa área.', 'Director/a de grupo y docente del área');
    });
    if (fin && !pre) {
      var pr = d('promocion:' + c);
      if (mat) comisionPromocionCuadra_(mat, pr).forEach(function (m) { add('sP', 'Promoción', c, '', m, 'Director/a de grupo'); });
      else add('sP', 'Promoción', c, '', 'Falta la matrícula para verificar la promoción.', 'Director/a de grupo');
      if (!cf('promocion', c)) add('sP', 'Promoción', c, '', 'Falta confirmar la promoción del curso.', 'Director/a de grupo');
    }
    // reconocimientos
    if ((rec.filas || []).length) {
      comisionValidaReconocimientos_(rec.filas).forEach(function (m) { add('s4', 'Reconocimientos', c, '', m, 'Director/a de grupo'); });
      if (!cf('reconocimientos', c)) add('s4', 'Reconocimientos', c, '', 'Falta confirmar los reconocimientos del curso.', 'Director/a de grupo');
    } else if (!rec.sc) add('s4', 'Reconocimientos', c, '', 'Agregue los reconocimientos o declare que no hubo.', 'Director/a de grupo');
    [['con', 'Convivencia', 's5'], ['com', 'Compromisos con acudientes', 's6'], ['piar', 'PIAR y dificultades', 's7']].forEach(function (t) {
      if (!(est[t[0]] || []).length && !sc[t[0]]) add(t[2], t[1], c, '', 'Agregue los casos o declare que no hubo.', 'Director/a de grupo');
    });
    (est.con || []).forEach(function (r) { if (r.rc === 'No' || r.ro === 'No' || r.rp === 'No') add('s5', 'Convivencia', c, r.nombre || '', 'Falta reportar o notificar.', 'Director/a de grupo', true); });
  });
  (pre ? COM_PRE_CLAVES : COM_AREAS).forEach(function (k) {
    var x = d('recomendaciones:' + k);
    if (!x || (!String(x.texto || '').trim() && !(x.etiquetas || []).length)) add('s7', 'Recomendaciones', '', '', k + ': falta escribir una recomendación o marcar etiquetas.', 'Docente del ' + (pre ? 'propósito' : 'área'));
  });
  var fa = d('faltantes') || {};
  (fa.docentes || []).forEach(function (x) { if ((x.falta || []).length) add('p2', 'Datos de docentes', '', x.n, 'Falta: ' + x.falta.join(', ') + '.', 'Rectoría, archivo o coordinador'); });
  (fa.estudiantes || []).forEach(function (x) { if ((x.falta || []).length) add('p2', 'Datos de estudiantes', x.g || '', x.n, 'Falta: ' + x.falta.join(', ') + '.', 'Llamar a la familia; si no, rectoría, archivo o coordinador'); });
  P.forEach(function (x) { if (!(d('listos') || {})[x.n]) add('s8', 'Mi parte lista', '', x.n, 'No ha marcado «Mi parte lista».', 'El propio docente', true); });
  var orden = ['s0', 's1', 's2', 's3', 'sP', 's4', 's5', 's6', 's7', 's8', 'p2'];
  L.forEach(function (x) { x.o = orden.indexOf(x.paso); });
  return L.sort(function (p, q) { return p.o - q.o; });
}
/** Lo que impide cerrar (mensajes). Vacía = se puede cerrar. */
function comisionPendientesCierre_(a, secs) {
  return comisionPendientes_(a, secs).filter(function (x) { return !x.adv; }).map(function (x) { return (x.curso ? x.curso + ': ' : '') + (x.persona ? x.persona + ': ' : '') + x.comp + ' · ' + x.msg; });
}
/** Informe de pendientes para la pantalla y para el PDF del responsable. */
function comisionPendientes(p) {
  comisionQuien_(); var a = comisionActa_((p || {}).acta), L = comisionPendientes_(a, comisionSecciones_(a.id));
  return { acta: a.id, por_resolver: L.filter(function (x) { return !x.adv; }).length, advertencias: L.filter(function (x) { return x.adv; }).length, lista: L };
}
/** Cierre compartido. accion: 'proponer' | 'confirmar' (p.en_nombre = integrante que confirma desde este equipo) | 'objetar' | 'excluir' | 'cancelar'. */
function comisionCierre(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta ya está cerrada.');
    var secs = comisionSecciones_(a.id), ints = secs.integrantes && secs.integrantes.datos || [], c = secs.cierre && secs.cierre.datos || null;
    var soyResp = !a.responsable || a.responsable === quien.nombre || quien.coord;
    if (p.accion === 'proponer') {
      if (!a.responsable) throw new Error('Falta elegir al docente responsable del cierre.');
      if (a.responsable !== quien.nombre && !quien.coord) throw new Error('Solo ' + (a.responsable || 'el docente responsable') + ' puede proponer el cierre.');
      var falta = comisionPendientesCierre_(a, secs); if (falta.length) throw new Error('No se puede cerrar todavía:\n' + falta.join('\n'));
      c = { por: quien.nombre, t: ahoraTxt_(), conf: {}, obj: {}, excl: {}, via: {} }; c.conf[quien.nombre] = true;
    } else {
      if (!c) throw new Error('No hay un cierre propuesto.');
      if (p.accion === 'cancelar') { if (c.por !== quien.nombre && !quien.coord) throw new Error('Solo quien propuso el cierre puede cancelarlo.'); c = null; }
      else if (p.accion === 'excluir') { if (c.por !== quien.nombre && !quien.coord) throw new Error('Solo quien propuso el cierre puede excluir a un integrante.'); c.excl[p.persona] = true; }
      else if (p.accion === 'confirmar' || p.accion === 'objetar') {
        var quienConf = p.en_nombre ? String(p.en_nombre) : quien.nombre;
        if (!ints.some(function (x) { return x.n === quienConf && x.p; })) throw new Error('Esa persona no está entre los integrantes que asistieron.');
        c.conf[quienConf] = p.accion === 'confirmar'; c.obj[quienConf] = p.accion === 'objetar';
        if (p.en_nombre && p.en_nombre !== quien.nombre) c.via[quienConf] = quien.nombre;
      } else throw new Error('Acción de cierre no válida.');
    }
    comisionEscribe_(a.id, 'cierre', c, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'CIERRE_' + String(p.accion).toUpperCase(), p.persona || p.en_nombre || '');
    if (c && comisionCierreCompleto_(ints, c)) return comisionCerrarActa_(a, c, quien);
    return { ok: true, cerrada: false };
  } finally { lock.releaseLock(); }
}
function comisionCerrarActa_(a, c, quien) {
  var hora = Utilities.formatDate(new Date(), TZ, 'HH:mm'), fila = comisionFilaActa_(a.id), sh = hojaOCrea_('Comision_Actas', COL_CACTAS);
  sh.getRange(fila, 6, 1, 1).setValue('CERRADA');
  sh.getRange(fila, 10, 1, 3).setValues([[c.por || quien.nombre, ymd_(new Date()), hora]]);
  comisionLog_(a.id, quien.nombre, 'CERRAR', 'hora ' + hora);
  var copia = false;
  try { comisionBorradorDrive_(comisionActa_(a.id)); copia = true; } catch (e) { comisionLog_(a.id, quien.nombre, 'COPIA_FALLO', String(e.message || e)); }
  return { ok: true, cerrada: true, hora_cierre: hora, copia_en_drive: copia };
}
/** Reabre un acta cerrada: solo coordinación académica, con justificación. */
function comisionReabrir(p) {
  var quien = comisionQuien_(); p = p || {};
  if (!quien.coord) throw new Error('Solo coordinación académica puede reabrir el acta.');
  var j = String(p.justificacion || '').trim(); if (j.length < 10) throw new Error('Escriba una justificación clara (mínimo 10 caracteres).');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'CERRADA') throw new Error('El acta no está cerrada.');
    var fila = comisionFilaActa_(a.id), sh = hojaOCrea_('Comision_Actas', COL_CACTAS);
    sh.getRange(fila, 6, 1, 1).setValue('ABIERTA'); sh.getRange(fila, 10, 1, 4).setValues([['', '', '', (Number(a.reaperturas) || 0) + 1]]);
    comisionEscribe_(a.id, 'cierre', null, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'REABRIR_ACTA', j);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/** Carpeta del acta dentro de la carpeta de la aplicación: COMISIONES año / Comisiones Evaluación P1 ICET año (como las que ya existen) / Grado X [/ subcarpeta]. */
function comisionCarpeta_(a, sub) {
  var pcorto = { Primero: 'P1', Segundo: 'P2', Tercero: 'P3', Final: 'Final' }[a.periodo] || String(a.periodo);
  var f = carpetaHija_(carpetaApp_(), 'COMISIONES ' + a.anio);
  f = carpetaHija_(f, 'Comisiones Evaluación ' + pcorto + ' ICET ' + a.anio);
  f = carpetaHija_(f, 'Grado ' + a.grado);
  return sub ? carpetaHija_(f, sub) : f;
}
function comisionGuardaJson_(carpeta, nombre, obj) {
  var it = carpeta.getFilesByName(nombre); while (it.hasNext()) it.next().setTrashed(true);
  return carpeta.createFile(Utilities.newBlob(JSON.stringify(obj, null, 1), 'application/json', nombre));
}
/** Copia legible (JSON) del acta y todas sus secciones, en «Borradores» del acta. Si el acta ya está cerrada, además queda la copia «cerrada». */
function comisionBorradorDrive_(a) {
  var datos = { acta: a, secciones: comisionSecciones_(a.id), copiado: ahoraTxt_() }, c = comisionCarpeta_(a, 'Borradores');
  comisionGuardaJson_(c, 'Acta ' + a.acta_no + ' ' + a.periodo + ' · borrador.json', datos);
  if (a.estado === 'CERRADA') comisionGuardaJson_(c, 'Acta ' + a.acta_no + ' ' + a.periodo + ' · cerrada.json', datos);
  return c;
}
/** Botón «Guardar borrador en Drive»: cualquier integrante del acta. */
function comisionBorrador(p) {
  var quien = comisionQuien_(), a = comisionActa_((p || {}).acta), al = comisionAlcance_(quien, String(a.grado));
  if (!al.todo && !al.cursos.length && !al.areas.length && !al.multiareas) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  comisionBorradorDrive_(a); comisionLog_(a.id, quien.nombre, 'BORRADOR_DRIVE', '');
  return { ok: true };
}
/** Cada noche (Respaldo.gs): copia legible de todas las actas del año, para que todo quede en la carpeta de la aplicación. */
function comisionRespaldarActas_() {
  var anio = Number(parametro_('anio_lectivo', String(new Date().getFullYear()))), n = 0;
  comisionActas_().forEach(function (a) { if (Number(a.anio) === anio) { comisionBorradorDrive_(a); n++; } });
  return n ? 'borradores de comisiones: ' + n : '';
}
/**
 * PDF del acta cerrada (respaldo): la pantalla envía el HTML del imprimible y aquí se convierte a PDF y se guarda en «Borradores» de la carpeta del acta.
 * El PDF principal sale siempre de la impresión del navegador; este es la copia de seguridad por si algo falla.
 */
function comisionGuardarPdf(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta), al = comisionAlcance_(quien, String(a.grado));
  if (!al.todo && !al.cursos.length && !al.areas.length && !al.multiareas) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  var html = String(p.html || ''); if (html.length < 200) throw new Error('El acta está vacía.'); if (html.length > 3000000) throw new Error('El acta es demasiado grande para convertirla.');
  var nombre = 'Acta ' + a.acta_no + ' ' + a.periodo + (a.estado === 'CERRADA' ? ' · cerrada' : ' · borrador') + '.pdf';
  var pdf = Utilities.newBlob('<html><head><meta charset="utf-8"></head><body>' + html + '</body></html>', 'text/html', nombre).getAs('application/pdf');
  pdf.setName(nombre);
  var c = comisionCarpeta_(a, 'Borradores'), it = c.getFilesByName(nombre); while (it.hasNext()) it.next().setTrashed(true);
  var f = c.createFile(pdf);
  comisionLog_(a.id, quien.nombre, 'PDF_DRIVE', nombre);
  return { ok: true, nombre: nombre, url: f.getUrl() };
}
/**
 * El director o directora del curso agrega a un estudiante que falta (con los datos esenciales, sin inventarlos) o retira a quien ya no vino o nunca vino.
 * p = {acta, curso, accion: 'AGREGAR'|'RETIRAR', a, n, motivo, falta: [datos que no se tienen], nombre (al retirar)}
 * Con la matrícula del curso confirmada no se puede (solo coordinación la reabre). Se confirma de nuevo la promoción. Todo queda en «cambios:curso» y en el registro.
 * Los números de documento no se guardan aquí: van a la hoja reservada de identidad (fase 2).
 */
var MOTIVOS_RETIRO_COM = ['Se retiró (traslado u otra razón)', 'Desertó: no volvió', 'Nunca asistió (matriculado que no se presentó)'];
function comisionEstudiante(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
    var curso = String(p.curso || ''), al = comisionAlcance_(quien, String(a.grado)), secs = comisionSecciones_(a.id);
    if (!al.todo && al.cursos.indexOf(curso) < 0) throw new Error('Solo el director o directora del curso agrega o retira estudiantes.');
    var conf = secs['confirm:matricula:' + curso] && secs['confirm:matricula:' + curso].datos;
    if (conf && conf.ok && !quien.coord) throw new Error('La matrícula del curso está confirmada y es oficial: pida a coordinación académica que la reabra.');
    var clave = 'cambios:' + curso, lista = (secs[clave] && secs[clave].datos) || [], reg;
    if (p.accion === 'AGREGAR') {
      var ap = String(p.a || '').trim(), nm = String(p.n || '').trim();
      if (!ap || !nm) throw new Error('Escriba apellidos y nombres.');
      agregarEstudiante_({ g: curso, a: ap, n: nm, motivo: /no aparec/i.test(String(p.motivo || '')) ? 'NO_LISTADO' : 'NUEVO', nota: String(p.motivo || '').slice(0, 120) }, quien.nombre);
      reg = { tipo: 'AGREGAR', nombre: ap + ' ' + nm, motivo: String(p.motivo || ''), falta: (p.falta || []).slice(0, 8), por: quien.nombre, t: ahoraTxt_() };
    } else if (p.accion === 'RETIRAR') {
      if (MOTIVOS_RETIRO_COM.indexOf(p.motivo) < 0) throw new Error('Elija el motivo del retiro.');
      if (!String(p.nombre || '').trim()) throw new Error('Falta el nombre del estudiante.');
      reg = { tipo: 'RETIRAR', nombre: String(p.nombre).trim(), motivo: p.motivo, por: quien.nombre, t: ahoraTxt_() };
    } else throw new Error('Acción no válida.');
    lista.push(reg);
    comisionEscribe_(a.id, clave, lista, quien.nombre);
    var pr = secs['confirm:promocion:' + curso] && secs['confirm:promocion:' + curso].datos;
    if (pr && pr.ok) comisionEscribe_(a.id, 'confirm:promocion:' + curso, { ok: false, por: quien.nombre, fecha: ahoraTxt_(), veces: pr.veces || 0 }, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'ESTUDIANTE_' + p.accion, curso + ' · ' + reg.nombre + ' · ' + (reg.motivo || ''));
    return { ok: true, cambios: lista.length, ajuste_matricula: p.accion === 'AGREGAR' ? 'sumar 1 a Nuevos' : (/^Desertó/.test(p.motivo) ? 'sumar 1 a Desertados' : 'sumar 1 a Retirados') };
  } finally { lock.releaseLock(); }
}
/** Evidencia opcional (PIAR, formato de DUA, compromiso firmado): imagen o PDF a Drive «App Asistencia / Soportes / Comisiones / año / grado / acta». */
function comisionSubirSoporte(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta), al = comisionAlcance_(quien, String(a.grado));
  if (!al.todo && !al.cursos.length) throw new Error('Solo el director o directora de grupo carga evidencias.');
  var ext = MIME_COM[p.mime]; if (!ext) throw new Error('Formato no permitido. Use foto (JPG, PNG) o PDF.');
  if (['PIAR', 'DUA', 'COMPROMISO'].indexOf(p.tipo) < 0) throw new Error('Tipo de evidencia no válido.');
  var bytes = Utilities.base64Decode(String(p.base64 || '')); if (!bytes.length) throw new Error('El archivo está vacío.');
  if (bytes.length > MAX_BYTES_COM) throw new Error('El archivo supera ' + (MAX_BYTES_COM / 1048576) + ' MB.');
  var f = comisionCarpeta_(a, 'Anexos');
  var nombre = p.tipo + '_' + String(p.curso || '').replace(/[^0-9A-Za-z]/g, '') + '_' + ahoraTxt_().replace(/[^0-9]/g, '') + '.' + ext;
  var archivo = f.createFile(Utilities.newBlob(bytes, p.mime, nombre));
  try { archivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) { /* ya es privado */ }
  comisionLog_(a.id, quien.nombre, 'SOPORTE', nombre);
  return { nombre: nombre, id: archivo.getId(), url: archivo.getUrl() };
}
