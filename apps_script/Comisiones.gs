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
 *  - Quien no firma se entiende que no asistió. La firma se pone al finalizar en el acta impresa, junto a la cédula y el celular o correo del integrante.
 *  - Los informes que ven los docentes se calculan por reglas; la IA (si se activa) es solo para directivos y no vive aquí.
 * TODO en Drive vive en una sola carpeta, «APP ASISTENCIA DOCENTE»: COMISIONES año / Comisiones Evaluación P1 ICET año / Grado X / Anexos (PIAR, DUA, compromisos) y / Borradores (copia legible de lo que se lleva).
 * Los respaldos de los libros van en «App Asistencia / Respaldos» (Respaldo.gs).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var COL_CACTAS = ['id', 'anio', 'periodo', 'grado', 'acta_no', 'estado', 'responsable', 'creada_por', 'fecha_creacion', 'cerrada_por', 'fecha_cierre', 'hora_cierre', 'reaperturas'];
var COL_CSEC = ['acta_id', 'seccion', 'version', 'json', 'actualizado_por', 'fecha'];
var COL_CLOG = ['fecha', 'acta_id', 'usuario', 'accion', 'detalle'];
var COL_CHIST = ['fecha', 'acta_id', 'seccion', 'version', 'por', 'json'];
var COL_CHOJA = ['id', 'fecha', 'por', 'hoja', 'fila', 'columna', 'anterior', 'nuevo', 'acta_id'];
var COM_HIST_DIAS = 8;   // se conserva una semana (más un día) de versiones anteriores y de cambios en hojas
var PERIODOS_COM = ['Primero', 'Segundo', 'Tercero', 'Final'];
var LIM_RECONOC = [1, 2, 2];                  // cupos por curso: excelencia, rendimiento académico, convivencia escolar
var MAX_JSON_SECCION = 45000;                  // una celda de Sheets admite 50.000 caracteres
var MAX_BYTES_COM = 8 * 1024 * 1024;
var MIME_COM = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
var SECCIONES_COM = /^(general|integrantes|requisitos|firmas|faltantes|listos|presencia|(matricula|estudiantes|reconocimientos|promocion|obs):[0-9A-Za-z]+|(areas|recomendaciones):.{1,80})$/;

/* ------------------------------ hojas y registro ------------------------------ */
function comisionPrepararHojas() {
  hojaOCrea_('Comision_Actas', COL_CACTAS); hojaOCrea_('Comision_Secciones', COL_CSEC); hojaOCrea_('Comision_Log', COL_CLOG);
  return 'Hojas de comisiones listas.';
}
function comisionLog_(acta, usuario, accion, detalle) {
  hojaOCrea_('Comision_Log', COL_CLOG).appendRow([ahoraTxt_(), acta, usuario, accion, String(detalle || '').slice(0, 500)]);
}
/** Hojas de cálculo convierte «05» en el número 5 al guardar: el código de grado se normaliza siempre a dos cifras (00-11) o CS1/CS2. */
function comisionGradoKey_(v, periodo) { var s = String(v == null ? '' : v).trim(); s = /^\d$/.test(s) ? '0' + s : s; return comisionUnion_(periodo)[s] || s; }
/** Actas vigentes (las marcadas DUPLICADA por la unificación no se muestran). */
function comisionActas_() { return datosOCrea_('Comision_Actas', COL_CACTAS).map(function (a) { a.grado = comisionGradoKey_(a.grado, a.periodo); return a; }).filter(function (a) { return a.estado !== 'DUPLICADA'; }); }
/** Cuántas partes (secciones) tiene guardadas cada acta. */
function comisionContarSecciones_() { var c = {}; datosOCrea_('Comision_Secciones', COL_CSEC).forEach(function (s) { c[String(s.acta_id)] = (c[String(s.acta_id)] || 0) + 1; }); return c; }
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
      try { comisionHistoria_(id, seccion, v[i][2], v[i][3], v[i][4]); } catch (eh) { /* el historial nunca impide guardar */ }
      sh.getRange(i + 1, 3, 1, 4).setValues([[nv, json, por, ahoraTxt_()]]);
      return nv;
    }
  }
  sh.appendRow([id, seccion, 1, json, por, ahoraTxt_()]);
  return 1;
}

/** Guarda el estado ANTERIOR de la sección para poder retroceder; no más de una vez cada 10 minutos por sección. */
function comisionHistoria_(id, seccion, version, json, porAnterior) {
  if (!json || String(json).length < 3) return;
  var clave = 'ch:' + String(id).slice(0, 8) + ':' + seccion, c = null;
  try { c = CacheService.getScriptCache(); if (c.get(clave)) return; } catch (e) { c = null; }
  hojaOCrea_('Comision_Historial', COL_CHIST).appendRow([ahoraTxt_(), id, seccion, version, porAnterior, String(json)]);
  try { if (c) c.put(clave, '1', 600); } catch (e) { /* sin caché: se guarda cada vez */ }
}
/** Un cambio de una celda en las hojas del libro, con su valor anterior (para deshacerlo). */
function comisionSetHoja_(sh, fila, col, nombreCol, valor, por, acta) {
  var ant = sh.getRange(fila, col).getValue();
  if (String(ant) === String(valor)) return;
  sh.getRange(fila, col).setValue(valor);
  hojaOCrea_('Comision_CambiosHojas', COL_CHOJA).appendRow([Utilities.getUuid(), ahoraTxt_(), por || '', sh.getName(), fila, nombreCol, String(ant), String(valor), acta || '']);
}
/** Versiones anteriores del acta y cambios hechos en las hojas (solo directivos o personas con control total). */
function comisionHistorial(p) {
  var quien = comisionQuien_(), a = comisionActa_((p || {}).acta);
  if (quien.rol !== 'directivo' && !quien.total) throw new Error('Solo coordinación, directivos o quien tenga control total ve el historial.');
  var hs = hojaOCrea_('Comision_Historial', COL_CHIST), v = hs.getDataRange().getValues(), sec = [];
  for (var i = v.length - 1; i >= 1 && sec.length < 150; i--) if (String(v[i][1]) === String(a.id)) sec.push({ fila: i + 1, fecha: String(v[i][0]), seccion: String(v[i][2]), version: v[i][3], por: String(v[i][4]), bytes: String(v[i][5]).length });
  var ch = hojaOCrea_('Comision_CambiosHojas', COL_CHOJA), w = ch.getDataRange().getValues(), hoj = [];
  for (var j = w.length - 1; j >= 1 && hoj.length < 150; j--) if (String(w[j][8]) === String(a.id)) hoj.push({ id: String(w[j][0]), fecha: String(w[j][1]), por: String(w[j][2]), hoja: String(w[j][3]), columna: String(w[j][5]), anterior: String(w[j][6]), nuevo: String(w[j][7]) });
  return { secciones: sec, hojas: hoj, dias: COM_HIST_DIAS, puedeDeshacerHojas: !!quien.coord };
}
/** Vuelve una sección del acta a una versión anterior (queda como versión nueva; la actual pasa al historial). */
function comisionRestaurar(p) {
  var quien = comisionQuien_(); p = p || {};
  if (quien.rol !== 'directivo' && !quien.total) throw new Error('Solo coordinación, directivos o quien tenga control total puede restaurar.');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
    var hs = hojaOCrea_('Comision_Historial', COL_CHIST), f = Number(p.fila), fila = f >= 2 ? hs.getRange(f, 1, 1, 6).getValues()[0] : null;
    if (!fila || String(fila[1]) !== String(a.id) || String(fila[0]) !== String(p.fecha)) throw new Error('Esa versión ya no está disponible.');
    var seccion = String(fila[2]); if (!SECCIONES_COM.test(seccion)) throw new Error('Sección no válida.');
    var datos = JSON.parse(String(fila[5])), c = null; try { c = CacheService.getScriptCache(); c.remove('ch:' + String(a.id).slice(0, 8) + ':' + seccion); } catch (e) { c = null; }
    var v = comisionEscribe_(a.id, seccion, datos, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'RESTAURAR', seccion + ' ← versión del ' + fila[0]);
    return { ok: true, version: v, seccion: seccion };
  } finally { lock.releaseLock(); }
}
/** Devuelve una celda de las hojas a su valor anterior (solo coordinación académica). */
function comisionHojaDeshacer(p) {
  var quien = comisionQuien_(); p = p || {};
  if (!quien.coord) throw new Error('Solo coordinación académica deshace cambios en las hojas.');
  var ch = hojaOCrea_('Comision_CambiosHojas', COL_CHOJA), w = ch.getDataRange().getValues(), reg = null;
  for (var j = 1; j < w.length; j++) if (String(w[j][0]) === String(p.id)) { reg = w[j]; break; }
  if (!reg) throw new Error('Ese cambio ya no está disponible.');
  var sh = SpreadsheetApp.getActive().getSheetByName(String(reg[3])); if (!sh) throw new Error('La hoja ya no existe.');
  var col = 0, h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  for (var k = 0; k < h.length; k++) if (String(h[k]) === String(reg[5])) col = k + 1;
  if (!col) throw new Error('La columna ya no existe.');
  comisionSetHoja_(sh, Number(reg[4]), col, String(reg[5]), String(reg[6]), quien.nombre, String(reg[8]));
  comisionLog_(String(reg[8]), quien.nombre, 'DESHACER_HOJA', reg[3] + ' fila ' + reg[4] + ' · ' + reg[5]);
  return { ok: true };
}
/** Cada noche (Respaldo.gs): borra del historial lo que tiene más de COM_HIST_DIAS días. */
function comisionPurgaHistorial_() {
  var corte = Utilities.formatDate(new Date(Date.now() - COM_HIST_DIAS * 86400000), TZ, 'yyyy-MM-dd HH:mm'), n = 0;
  [['Comision_Historial', COL_CHIST, 0], ['Comision_CambiosHojas', COL_CHOJA, 1]].forEach(function (x) {
    var sh = hojaOCrea_(x[0], x[1]), v = sh.getDataRange().getValues();
    for (var i = v.length - 1; i >= 1; i--) if (String(v[i][x[2]]) < corte) { sh.deleteRow(i + 1); n++; }
  });
  return n;
}

/* ------------------------------ quién es y qué le corresponde ------------------------------ */
function comisionQuien_() {
  var id = identidad_();
  if (id.rol === 'directivo') return { rol: 'directivo', nombre: nombreDirectivoCompleto_(id.nombre) || id.email, email: id.email, coord: puedeAdministrar_(id) };
  if (id.rol === 'docente') {
    if (!id.autorizado && !id.preregistro) { /* mismo criterio que el resto: el docente debe haber aceptado la autorización al registrarse */ }
    return { rol: 'docente', nombre: id.docente, email: id.email, coord: false, total: comisionControlTotal_().indexOf(comisionSinTildes_(id.docente)) >= 0 };
  }
  throw new Error('Debe iniciar sesión con una cuenta autorizada.');
}
function comisionSinTildes_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
/** Cursos (grupos) que dirige y áreas que dicta el docente en un grado. Coordinación y rectoría ven todo. */
/* Permisos por nivel (configurables por coordinación): ver y editar las actas. Valor por defecto: todos pueden ver y editar. */
var COM_NIVELES_PERM = [['PRIMARIA', 'Docentes de preescolar y primaria'], ['SECUNDARIA', 'Docentes de secundaria y media'], ['ORIENTACION', 'Docentes orientadoras'], ['PTAFI', 'Tutora PTAFI']];
function comisionNivelPerm_(nombre) {
  var d = datos_('Docentes').filter(function (x) { return comisionSinTildes_(x.nombre_completo) === comisionSinTildes_(nombre); })[0], n = comisionSinTildes_(d ? d.nivel : '');
  if (/ORIENTACI/.test(n)) return 'ORIENTACION';
  if (/PTAFI|TUTOR/.test(n)) return 'PTAFI';
  if (/PREESC|PRIMARIA|TRANSICI/.test(n)) return 'PRIMARIA';
  return 'SECUNDARIA';
}
function comisionPermisosConfig_() {
  var c = {}; try { c = JSON.parse(parametro_('comisiones_permisos', '')) || {}; } catch (e) { c = {}; }
  COM_NIVELES_PERM.forEach(function (n) { var x = c[n[0]] || {}; c[n[0]] = { ver: x.ver !== false, editar: x.editar !== false && x.ver !== false }; });
  return c;
}
function comisionControlTotal_() { var c = []; try { c = JSON.parse(parametro_('comisiones_controltotal', '[]')) || []; } catch (e) { c = []; } return c.map(comisionSinTildes_); }
function comisionPermisoNivel_(quien) { return quien.rol === 'docente' && !quien.total ? comisionPermisosConfig_()[comisionNivelPerm_(quien.nombre)] : { ver: true, editar: true }; }
function comisionPermisosLeer() {
  var quien = comisionQuien_(); if (quien.rol !== 'directivo') throw new Error('Solo directivos.');
  var tot = []; try { tot = JSON.parse(parametro_('comisiones_controltotal', '[]')) || []; } catch (e) { tot = []; }
  return { niveles: COM_NIVELES_PERM.map(function (n) { return { clave: n[0], nombre: n[1] }; }), config: comisionPermisosConfig_(), total: tot, docentes: datos_('Docentes').map(function (d) { return String(d.nombre_completo); }).filter(Boolean).sort(function (a, b) { return a.localeCompare(b, 'es'); }), puedeEditar: !!quien.coord };
}
function comisionPermisosGuardar(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica cambia estos permisos.');
  var c = {}; COM_NIVELES_PERM.forEach(function (n) { var x = ((p || {}).config || {})[n[0]] || {}; c[n[0]] = { ver: x.ver !== false, editar: x.editar !== false && x.ver !== false }; });
  guardarParametro_('comisiones_permisos', JSON.stringify(c));
  var tot = (((p || {}).total) || []).map(String).filter(function (n) { return n && n.length < 120; }).slice(0, 60);
  guardarParametro_('comisiones_controltotal', JSON.stringify(tot));
  return { ok: true, config: c, total: tot };
}
/* Turno de edición (decisión del coordinador, 2026-11-23): todos pueden editar, pero en cada acta solo UNA persona a la vez (el «responsable del registro»), que puede soltar o pasar el turno.
   Directivos (coordinación, desarrollador, rectoría) editan siempre. Firmas, declaraciones, revisión, presencia y datos faltantes son de cada quien y siempre se pueden escribir. */
var COM_INACTIVO_MIN = 15;
function comisionEditorActivo_(acta, secs) {
  var pr = ((secs && secs.presencia && secs.presencia.datos) || {}).pers || {}, x = pr[acta.responsable];
  if (!x || !x.visto || x.dia !== Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')) return false;
  var m = /^(\d\d):(\d\d)$/.exec(String(x.visto)); if (!m) return false;
  var ahora = Number(Utilities.formatDate(new Date(), TZ, 'HH')) * 60 + Number(Utilities.formatDate(new Date(), TZ, 'mm')), v = Number(m[1]) * 60 + Number(m[2]);
  return ahora >= v && ahora - v <= COM_INACTIVO_MIN;
}
/** Devuelve '' si esta persona tiene hoy el turno de edición, o el mensaje de por qué no. */
function comisionTurno_(quien, acta) {
  if (quien.rol === 'directivo' || quien.total) return '';
  if (!comisionPermisoNivel_(quien).editar) return 'La coordinación no habilitó la edición de las actas para su nivel (solo lectura).';
  var r = acta && acta.responsable; if (!r || r === quien.nombre) return '';
  return 'Ahora tiene la edición ' + r + ' (solo una persona edita a la vez). Pídale que la suelte o la pase, o use «Tomar la edición» si lleva más de ' + COM_INACTIVO_MIN + ' minutos sin actividad.';
}
function comisionSinAlcance_(al) { return !al.todo && !al.cursos.length && !al.areas.length && !al.multiareas && !al.acompana; }
function comisionAlcance_(quien, grado) {
  /* Decisión del coordinador (2026-11-23): todo el personal (docentes, orientación, tutoría PTAFI y directivos) puede trabajar el acta completa,
     para que una sola persona haga el ejercicio. Las firmas, declaraciones y presencia siguen siendo de cada quien. */
  return { todo: true, cursos: [], areas: [], multiareas: true };
}
/** ¿Puede escribir esta sección? Devuelve null si puede o el motivo si no. */
function comisionEsEditor_(quien, secciones) {
  var d = secciones && secciones.integrantes && secciones.integrantes.datos, L = (d && d.int) || [];
  return L.some(function (x) { return x && x.n === quien.nombre && (x.roles || []).indexOf('Editor del acta') >= 0; });
}
function comisionPermisoSeccion_(quien, alcance, seccion, secciones, acta) {
  if (!SECCIONES_COM.test(seccion)) return 'Sección no válida.';
  var p = seccion.split(':'), tipo = p[0], clave = p.slice(1).join(':');
  var editor = comisionEsEditor_(quien, secciones);
  if (tipo === 'firmas' || tipo === 'faltantes' || tipo === 'listos' || tipo === 'presencia') return null;
  var turno = comisionTurno_(quien, acta); if (turno) return turno;   // cada persona pone lo suyo (firma, declaración, revisión) y los datos faltantes
  if (tipo === 'general' || tipo === 'integrantes' || tipo === 'requisitos') {   // asistencia, etiquetas y datos generales: el responsable del registro, quien tenga la etiqueta «Editor del acta» o coordinación
    var resp = acta && acta.responsable;
    return null;
  }
  if (alcance.todo || editor) { /* coordinación, rectoría y quien tenga la etiqueta «Editor del acta» pueden corregir cualquier curso o área */ } else if (['matricula', 'estudiantes', 'reconocimientos', 'promocion', 'obs'].indexOf(tipo) >= 0) {
    if (alcance.cursos.indexOf(clave) < 0) return 'Solo el director o directora del curso puede editar esta sección.';
  } else if (alcance.areas.indexOf(clave) < 0 && !alcance.multiareas && !(clave === 'Convivencia' && alcance.cursos.length)) {
    return 'Solo el docente de esta área puede editarla.';
  }
  var conf = secciones && secciones['confirm:' + tipo + ':' + clave];
  if ((tipo === 'matricula' || tipo === 'reconocimientos') && conf && conf.datos && conf.datos.ok && !quien.coord && quien.rol !== 'directivo' && !quien.total) {
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
  var quien = comisionQuien_(), perm = comisionPermisoNivel_(quien), anio = Number(parametro_('anio_lectivo', String(new Date().getFullYear()))), grados = {};
  datos_('Grupos').forEach(function (g) { var p = partesGrupo_(g.grupo); if (p.grado !== 'N/A' && p.grado !== 'ORI' && p.grado !== 'PTA') grados[comisionGradoActa_(g.grupo, 'Final')] = 1; });
  var lista = comisionActas_().filter(function (a) { return String(a.anio) === String(anio); }).map(function (a) {
    return { id: a.id, periodo: a.periodo, grado: a.grado, acta_no: a.acta_no, estado: a.estado, responsable: a.responsable, hora_cierre: a.hora_cierre };
  });
  var visibles = lista, gr = Object.keys(grados).sort();
  if (!quien.coord && quien.rol === 'docente') gr = gr.filter(function (c) { var al = comisionAlcance_(quien, c); return al.cursos.length || al.areas.length || al.multiareas || al.acompana; });
  if (!quien.coord && quien.rol === 'docente') visibles = lista.filter(function (a) { var al = comisionAlcance_(quien, String(a.grado)); return al.cursos.length || al.areas.length || al.multiareas || al.acompana; });
  if (!perm.ver) return { version: (typeof VERSION_SISTEMA !== 'undefined' ? VERSION_SISTEMA : ''), anio: anio, quien: { nombre: quien.nombre, rol: quien.rol, coord: false, dev: false, ver: false, editar: false }, periodos: PERIODOS_COM, grados: [], actas: [], bloqueado: 'La coordinación no habilitó la consulta de las actas para su nivel.' };
  return { version: (typeof VERSION_SISTEMA !== 'undefined' ? VERSION_SISTEMA : ''), anio: anio, quien: { total: !!quien.total, ver: true, editar: perm.editar, nombre: quien.nombre, rol: quien.rol, coord: quien.coord, dev: !!(quien.coord && quien.email && editoresLibro_().indexOf(String(quien.email).toLowerCase()) >= 0) }, periodos: PERIODOS_COM, grados: gr, actas: visibles };
}
/** Abre el acta del grado y periodo (la crea si no existe; fecha, hora y grado empiezan en blanco: los llena el equipo). */
function comisionAbrir(p) {
  var quien = comisionQuien_(); p = p || {};
  var anio = Number(p.anio) || Number(parametro_('anio_lectivo', String(new Date().getFullYear())));
  if (PERIODOS_COM.indexOf(p.periodo) < 0) throw new Error('Elija el periodo.');
  var grado = String(p.grado || '');
  if (!datos_('Grupos').some(function (g) { return comisionGradoActa_(g.grupo, p.periodo) === grado; })) throw new Error('Ese grado no existe.');
  var al = comisionAlcance_(quien, grado);
  if (!comisionPermisoNivel_(quien).ver) throw new Error('La coordinación no habilitó la consulta de las actas para su nivel.');
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var cont = comisionContarSecciones_();
    var ex = comisionActas_().filter(function (a) { return String(a.anio) === String(anio) && a.periodo === p.periodo && comisionGradoKey_(a.grado, a.periodo) === grado; })
      .sort(function (x, y) { return (cont[String(y.id)] || 0) - (cont[String(x.id)] || 0); })[0];   // si hay varias, la que más trabajo tiene
    if (!ex) {
      var id = Utilities.getUuid(), no = comisionNumeroSugerido_(anio, grado);
      hojaOCrea_('Comision_Actas', COL_CACTAS).appendRow([id, anio, p.periodo, txtForzado_(grado), no, 'ABIERTA', (quien.rol === 'docente' ? quien.nombre : ''), quien.nombre, ahoraTxt_(), '', '', '', 0]);
      comisionLog_(id, quien.nombre, 'ABRIR', p.periodo + ' · grado ' + grado + ' · acta ' + no);
      ex = comisionActa_(id);
    }
    return comisionCargar({ acta: ex.id });
  } finally { lock.releaseLock(); }
}
function comisionCargar(p) {
  var quien = comisionQuien_(); if (!comisionPermisoNivel_(quien).ver) throw new Error('La coordinación no habilitó la consulta de las actas para su nivel.');
  var  a = comisionActa_((p || {}).acta), al = comisionAlcance_(quien, String(a.grado));
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
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
    if (a.estado !== 'ABIERTA' && !quien.coord) throw new Error('El acta está cerrada (solo lectura). Solo coordinación académica o el desarrollador pueden modificarla.');
    var al = comisionAlcance_(quien, String(a.grado)), secs = comisionSecciones_(a.id);
    var no = comisionPermisoSeccion_(quien, al, String(p.seccion || ''), secs, a);
    if (no) throw new Error(no);
    var dup = comisionDuplicados_(String(p.seccion || ''), p.datos); if (dup) throw new Error(dup);
    var actual = secs[p.seccion];
    if (actual && (Number(p.version) || 0) !== actual.version) return { conflicto: true, version: actual.version, datos: actual.datos, por: actual.por };
    if (!actual && Number(p.version)) return { conflicto: true, version: 0, datos: null, por: '' };
    var v = comisionEscribe_(a.id, p.seccion, p.datos, quien.nombre);
    try { comisionAHojas_(String(p.seccion), p.datos, quien.nombre, a.id); } catch (eh) { comisionLog_(a.id, quien.nombre, 'HOJA_ERROR', String(eh && eh.message || eh).slice(0, 120)); }
    return { ok: true, version: v };
  } finally { lock.releaseLock(); }
}
/** Un estudiante no puede estar dos veces en la misma lista (reprobación, convivencia, compromisos, PIAR, reconocimientos). Devuelve el mensaje o ''. */
function comisionDuplicados_(seccion, datos) {
  if (!/^(estudiantes|reconocimientos):/.test(seccion) || !datos || typeof datos !== 'object') return '';
  var msg = '';
  Object.keys(datos).forEach(function (k) {
    var arr = datos[k]; if (!Array.isArray(arr) || msg) return;
    var vistos = {};
    arr.forEach(function (x) {
      if (msg || !x || typeof x !== 'object') return;
      var nom = x.estudiante || x.nombre, id = x.id != null ? 'i' + x.id : (nom ? 'n' + comisionSinTildes_(nom) : '');
      if (!id) return;
      if (vistos[id]) msg = 'Hay un estudiante repetido (' + (nom || x.id) + ') en «' + k + '». No se puede registrar dos veces: edite el que ya está.';
      vistos[id] = 1;
    });
  });
  return msg;
}
/** Elige al docente responsable del registro y del cierre (cualquier integrante puede proponerlo; queda en la fila del acta). */
function comisionResponsable(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
  var nuevoR = String(p.nombre || '');
  if (quien.rol !== 'directivo' && !quien.total && a.responsable && a.responsable !== quien.nombre) {
    if (!(nuevoR === quien.nombre && !comisionEditorActivo_(a, comisionSecciones_(a.id)))) throw new Error(comisionTurno_(quien, a));
  }
  var fila = comisionFilaActa_(a.id); hojaOCrea_('Comision_Actas', COL_CACTAS).getRange(fila, 7).setValue(nuevoR);
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
    var turnoE = comisionTurno_(quien, a); if (turnoE) throw new Error(turnoE);
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
  datos_('Grupos').forEach(function (g) { if (comisionGradoActa_(g.grupo, a.periodo) === String(a.grado)) cursos.push(String(g.grupo)); });
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
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
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
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
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
var MOTIVOS_RETIRO_COM = ['Se retiró: pasó a otra institución educativa', 'Se retiró: cambio de domicilio', 'Canceló la matrícula', 'No asiste'];
function comisionEstudiante(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
    var turnoE = comisionTurno_(quien, a); if (turnoE) throw new Error(turnoE);
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
      if (MOTIVOS_RETIRO_COM.indexOf(p.motivo) < 0 && !/^(Se retiró|Canceló|No asist|Desertó|Nunca asistió)/.test(String(p.motivo || ''))) throw new Error('Elija el motivo del retiro.');
      if (!String(p.nombre || '').trim()) throw new Error('Falta el nombre del estudiante.');
      reg = { tipo: 'RETIRAR', nombre: String(p.nombre).trim(), motivo: p.motivo, por: quien.nombre, t: ahoraTxt_() };
    } else throw new Error('Acción no válida.');
    lista.push(reg);
    comisionEscribe_(a.id, clave, lista, quien.nombre);
    var pr = secs['confirm:promocion:' + curso] && secs['confirm:promocion:' + curso].datos;
    if (pr && pr.ok) comisionEscribe_(a.id, 'confirm:promocion:' + curso, { ok: false, por: quien.nombre, fecha: ahoraTxt_(), veces: pr.veces || 0 }, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'ESTUDIANTE_' + p.accion, curso + ' · ' + reg.nombre + ' · ' + (reg.motivo || ''));
    return { ok: true, cambios: lista.length, ajuste_matricula: p.accion === 'AGREGAR' ? 'sumar 1 a Nuevos' : (/^(No asist|Desert|Nunca)/.test(p.motivo) ? 'sumar 1 a No asistentes' : 'sumar 1 a Retirados') };
  } finally { lock.releaseLock(); }
}
/** Evidencia opcional (PIAR, formato de DUA, compromiso firmado): imagen o PDF a Drive «App Asistencia / Soportes / Comisiones / año / grado / acta». */
function comisionSubirSoporte(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta), al = comisionAlcance_(quien, String(a.grado));
  var turnoS = comisionTurno_(quien, a); if (turnoS) throw new Error(turnoS);
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

/* ------------------------------ prueba de humo (la ejecuta quien administra desde el menú del libro) ------------------------------ */
/** Abre un acta de PRUEBA (año 2099), guarda, lee, provoca un conflicto, pide pendientes y borra todo lo que creó. Devuelve [{paso, ok, msg}]. */
function comisionesPruebaDeHumo_() {
  var out = [], id = '', grado = '';
  function paso(nombre, f) { try { var r = f(); out.push({ paso: nombre, ok: r !== false, msg: r === false ? 'no cumplió lo esperado' : '' }); } catch (e) { out.push({ paso: nombre, ok: false, msg: String(e && e.message || e) }); } }
  var g = datos_('Grupos').map(function (x) { return partesGrupo_(x.grupo).grado; }).filter(function (c) { return /^\d\d$/.test(c); })[0] || '';
  paso('Elegir un grado para la prueba', function () { grado = g; return !!grado; });
  if (!grado) return out;
  paso('Abrir un acta de prueba (año 2099)', function () { var r = comisionAbrir({ anio: 2099, periodo: PERIODOS_COM[0], grado: grado }); id = r.acta.id; return !!id && r.acta.estado === 'ABIERTA'; });
  if (id) {
    paso('Guardar una sección', function () { var r = comisionGuardar({ acta: id, seccion: 'general', datos: { texto: 'prueba' }, version: 0 }); return r.ok && r.version === 1; });
    paso('Leer lo guardado', function () { var r = comisionCargar({ acta: id }); return r.secciones.general && r.secciones.general.datos.texto === 'prueba'; });
    paso('Detectar un conflicto (otra persona ya cambió la sección)', function () { return comisionGuardar({ acta: id, seccion: 'general', datos: { texto: 'otra' }, version: 0 }).conflicto === true; });
    paso('Guardar con la versión correcta', function () { var r = comisionGuardar({ acta: id, seccion: 'general', datos: { texto: 'dos' }, version: 1 }); return r.ok && r.version === 2; });
    paso('Pedir los cambios desde la versión cero', function () { return !!comisionCambios({ acta: id, versiones: {} }).cambios.general; });
    paso('Rechazar un estudiante repetido en una lista', function () { try { comisionGuardar({ acta: id, seccion: 'estudiantes:' + (datos_('Grupos').filter(function (x) { return partesGrupo_(x.grupo).grado === grado; })[0] || {}).grupo, datos: { rep: [{ id: 1 }, { id: 1 }] }, version: 0 }); return false; } catch (e) { return /repetido/.test(String(e.message)); } });
    paso('Calcular los pendientes del acta', function () { var r = comisionPendientes({ acta: id }); return !!r; });
    paso('Borrar el acta de prueba', function () { comisionBorrarActaPrueba_(id); return !comisionActas_().some(function (a) { return a.id === id; }); });
  }
  return out;
}
function comisionBorrarActaPrueba_(id) {
  [['Comision_Actas', COL_CACTAS, 0], ['Comision_Secciones', COL_CSEC, 0], ['Comision_Log', COL_CLOG, 1]].forEach(function (t) {
    var sh = hojaOCrea_(t[0], t[1]), v = sh.getDataRange().getValues();
    for (var i = v.length - 1; i >= 1; i--) if (String(v[i][t[2]]) === String(id)) sh.deleteRow(i + 1);
  });
}
function comisionesPruebaDeHumo() {
  exigirEditor_();
  var r = comisionesPruebaDeHumo_(), malos = r.filter(function (x) { return !x.ok; });
  SpreadsheetApp.getUi().alert('Prueba de comisiones: ' + (malos.length ? malos.length + ' paso(s) con problema' : 'TODO BIEN'),
    r.map(function (x) { return (x.ok ? '✔ ' : '✖ ') + x.paso + (x.msg ? ' → ' + x.msg : ''); }).join('\n') + '\n\nLa prueba usa un acta del año 2099 y la borra al terminar.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Menú: resumen de lo que hay guardado en las hojas de comisiones (sin abrir el JSON): por acta, cuántas partes y cuándo se guardó por última vez. */
/** Menú: cuando por el defecto del «05→5» se crearon varias actas del mismo grado y periodo, deja vigente la que más trabajo tiene y marca las demás DUPLICADA (no borra nada). */
function comisionesUnificarDuplicadas() {
  exigirEditor_();
  var sh = hojaOCrea_('Comision_Actas', COL_CACTAS), v = sh.getDataRange().getValues(), cont = comisionContarSecciones_(), grupos = {};
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0] || v[i][5] === 'DUPLICADA') continue;
    var k = v[i][1] + '|' + v[i][2] + '|' + comisionGradoKey_(v[i][3], v[i][2]);
    (grupos[k] = grupos[k] || []).push({ fila: i + 1, id: String(v[i][0]), n: cont[String(v[i][0])] || 0, fecha: String(v[i][8]), resp: String(v[i][6]), estado: String(v[i][5]) });
  }
  var plan = [], lineas = [];
  Object.keys(grupos).forEach(function (k) {
    var L = grupos[k]; if (L.length < 2) return;
    L.sort(function (a, b) { return b.n - a.n || (a.fecha < b.fecha ? 1 : -1); });
    var d = k.split('|'), et = COM_GRADO_LABEL[d[2]] || d[2];
    lineas.push('• ' + et + ' · ' + d[1] + ': se queda la del ' + L[0].fecha + ' (' + L[0].n + ' partes' + (L[0].resp ? ', edita ' + L[0].resp : '') + ') y se ocultan ' + (L.length - 1) + ' más (' + L.slice(1).map(function (x) { return x.n; }).join(', ') + ' partes).');
    L.slice(1).forEach(function (x) { plan.push(x); });
  });
  var ui = SpreadsheetApp.getUi();
  if (!plan.length) { ui.alert('Actas duplicadas', 'No hay actas duplicadas.', ui.ButtonSet.OK); return 0; }
  var r = ui.alert('Unificar actas duplicadas', lineas.join('\n') + '\n\nNo se borra nada: las ocultas quedan en la hoja con estado DUPLICADA. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return 0;
  plan.forEach(function (x) { sh.getRange(x.fila, 6).setValue('DUPLICADA'); comisionLog_(x.id, 'menú', 'DUPLICADA', 'Acta duplicada oculta (quedó vigente otra con más trabajo)'); });
  return plan.length;
}
function comisionesVerGuardado() {
  exigirEditor_();
  var actas = comisionActas_(), secs = datosOCrea_('Comision_Secciones', COL_CSEC), lineas = [];
  actas.forEach(function (a) {
    var mias = secs.filter(function (s) { return String(s.acta_id) === String(a.id); }), ult = mias.reduce(function (m, s) { return String(s.fecha) > m.f ? { f: String(s.fecha), p: String(s.actualizado_por) } : m; }, { f: '', p: '' });
    var cod = String(a.grado), et = COM_GRADO_LABEL[cod] || ('grado ' + cod), mat = mias.filter(function (s) { return /^matricula:/.test(s.seccion); }).length, est = mias.filter(function (s) { return /^estudiantes:/.test(s.seccion); }).length, rec = mias.filter(function (s) { return /^reconocimientos:/.test(s.seccion); }).length;
    lineas.push('• Acta ' + a.acta_no + ' · ' + et + ' · ' + a.periodo + ' · ' + a.estado + (a.responsable ? ' · edita: ' + a.responsable : '') + '\n   ' + mias.length + ' partes guardadas (matrícula de ' + mat + ' cursos, listas de ' + est + ' cursos, reconocimientos de ' + rec + ' cursos) · último guardado: ' + (ult.f || '—') + (ult.p ? ' por ' + ult.p : ''));
  });
  var msg = lineas.length ? lineas.join('\n') : 'Todavía no hay actas guardadas.';
  msg += '\n\nDónde está cada cosa:\n· Comision_Actas: una fila por acta.\n· Comision_Secciones: cada parte del acta (columna json) con su versión, quién y cuándo.\n· Comision_Historial y Comision_CambiosHojas: versiones anteriores y cambios en las hojas (una semana).\n· Estudiantes e Identidad_Docentes: los datos que se completaron (documento, tipo, lugar de expedición, sexo, nacionalidad, celular, correo).\n· Drive: APP ASISTENCIA DOCENTE / COMISIONES / Borradores (copia legible).';
  SpreadsheetApp.getUi().alert('Comisiones guardadas', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  return lineas;
}

/* ------------------------------ datos del grado para la pantalla real ------------------------------ */
/* Docentes que ALTERNAN cada semana con quien figura en el Horario (el Horario trae una sola persona por franja). Se suman al equipo del acta con la misma área.
   Defecto: María del Carmen Quintero alterna Sociales/Inglés (CSI) con Adiela Ortiz en 8.º (0801 y 0802). Otros casos: parámetro comisiones_alternan = [{"docente":"...","grupos":["0801"],"area":"CSI"}]. */
var COM_ALTERNAN_DEFECTO = [{ docente: 'Quintero Ramírez María del Carmen', grupos: ['0801', '0802'], area: 'CSI' }];
function comisionAlternan_() {
  var c = []; try { c = JSON.parse(parametro_('comisiones_alternan', '[]')) || []; } catch (e) { c = []; }
  return COM_ALTERNAN_DEFECTO.concat(Array.isArray(c) ? c : []);
}
function comisionHorarioConAlternan_() {
  var h = datos_('Horario').slice();
  comisionAlternan_().forEach(function (a) { (a.grupos || []).forEach(function (g) { if (a.docente && g) h.push({ docente: String(a.docente), grupo: String(g), area: String(a.area || '') }); }); });
  return h;
}
/* Decisión del coordinador (2026-11-24): los grupos de «Caminar en Secundaria» se trabajan en el acta del grado al que corresponden: CS 1 con 7.º y CS 2 con 9.º. */
var COM_PERIODOS = ['Primero', 'Segundo', 'Tercero', 'Final'];
function comisionUnionDefecto_(periodo) { return { CS1: '06', CS2: '08' }; }  // decisión 2026-11-24 (esta vez): CS 1 con 6.º y CS 2 con 8.º en todos los períodos; coordinación puede cambiarlo por período
/* Coordinación puede cambiar la integración por período (parámetro comisiones_union): CS1 con 6.º o 7.º y CS2 con 8.º o 9.º. */
function comisionUnionConfig_() { var c = {}; try { c = JSON.parse(parametro_('comisiones_union', '{}')) || {}; } catch (e) { c = {}; } return c; }
function comisionUnion_(periodo) {
  var d = comisionUnionDefecto_(periodo), o = comisionUnionConfig_()[String(periodo || 'Final')] || {};
  return { CS1: o.CS1 === '06' || o.CS1 === '07' ? o.CS1 : d.CS1, CS2: o.CS2 === '08' || o.CS2 === '09' ? o.CS2 : d.CS2 };
}
function comisionUnionLeer() {
  var r = {}; COM_PERIODOS.forEach(function (p) { r[p] = comisionUnion_(p); });
  return { periodos: COM_PERIODOS, union: r, defecto: { Primero: comisionUnionDefecto_('Primero'), Segundo: comisionUnionDefecto_('Segundo'), Tercero: comisionUnionDefecto_('Tercero'), Final: comisionUnionDefecto_('Final') } };
}
function comisionUnionGuardar(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica o el desarrollador cambian la integración de Caminar en Secundaria.');
  p = p || {}; var per = String(p.periodo || ''); if (COM_PERIODOS.indexOf(per) < 0) throw new Error('Período no válido.');
  if (['06', '07'].indexOf(String(p.CS1)) < 0 || ['08', '09'].indexOf(String(p.CS2)) < 0) throw new Error('CS 1 se integra con 6.º o 7.º; CS 2 con 8.º o 9.º.');
  var c = comisionUnionConfig_(); c[per] = { CS1: String(p.CS1), CS2: String(p.CS2) };
  guardarParametro_('comisiones_union', JSON.stringify(c));
  return comisionUnionLeer();
}
function comisionGradoActa_(grupo, periodo) { var g = partesGrupo_(grupo).grado; return comisionUnion_(periodo)[g] || g; }
var COM_GRADO_LABEL = { '00': '0° Preescolar', '01': '1° Primaria', '02': '2° Primaria', '03': '3° Primaria', '04': '4° Primaria', '05': '5° Primaria', '06': '6° Secundaria', 'CS1': 'CS 1 (Caminar en Secundaria 1, 6°-7°)', '07': '7° Secundaria', '08': '8° Secundaria', '09': '9° Secundaria', 'CS2': 'CS 2 (Caminar en Secundaria 2, 8°-9°)', '10': '10° Media', '11': '11° Media' };
var COM_GRADO_SIG = { '00': '1°', '01': '2°', '02': '3°', '03': '4°', '04': '5°', '05': '6°', '06': '7°', 'CS1': 'Caminar en Secundaria 2', '07': '8°', '08': '9°', '09': '10°', 'CS2': '10°', '10': '11°', '11': 'egreso (graduandos)' };
/** Lee una columna opcional de una fila de la hoja sin importar mayúsculas, tildes, espacios ni guiones del encabezado (documento, Documento, tipo_doc, Tipo doc…). */
function comisionCol_(fila, nombres) {
  var ks = Object.keys(fila), norm = function (s) { return comisionSinTildes_(String(s)).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  for (var i = 0; i < nombres.length; i++) for (var j = 0; j < ks.length; j++) if (norm(ks[j]) === nombres[i]) { var v = fila[ks[j]]; if (v === null || v === undefined) return ''; if (typeof v === 'number' && isFinite(v) && Math.floor(v) === v) return v.toFixed(0); return String(v).trim(); }
  return '';
}
/** Celular y correo institucional del docente desde la hoja Identidad_Docentes (columnas opcionales «celular» y «correo_institucional»). */
/** El correo institucional (@icet.edu.co) no sirve como contacto: cada docente debe registrar uno personal. */
function comisionMailPersonal_(m) { m = String(m || '').trim(); return /@([a-z0-9-]+\.)*icet\.edu\.co$/i.test(m) ? '' : m; }
function comisionIdentidad_(nombre) {
  var f = datosOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC).filter(function (x) { return comisionSinTildes_(x.docente) === comisionSinTildes_(nombre); })[0];
  if (!f) return { cel: '', mail: '' };
  var cel = comisionCol_(f, ['celular', 'telefono', 'telefonomovil', 'movil']).replace(/\D/g, '');
  return { cel: cel, mail: comisionMailPersonal_(comisionCol_(f, ['correopersonal'])) };
}
/** Devuelve la columna (1..n) de un encabezado en la hoja; si no existe la agrega al final. */
function comisionColHoja_(sh, nombre) {
  var h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0], i, n = comisionSinTildes_(nombre).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (i = 0; i < h.length; i++) if (comisionSinTildes_(h[i]).toLowerCase().replace(/[^a-z0-9]/g, '') === n) return i + 1;
  sh.getRange(1, h.length + 1).setValue(nombre); return h.length + 1;
}
/** Lo que se completa en el acta también queda en las hojas del libro: celular y correo de los docentes (Identidad_Docentes) y teléfono del acudiente (Estudiantes). */
function comisionAHojas_(seccion, datos, por, acta) {
  if (!datos || typeof datos !== 'object') return;
  if (seccion === 'firmas') {
    var pers = datos.pers || {}, nombres = Object.keys(pers); if (!nombres.length) return;
    var sh = hojaOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC), v = sh.getDataRange().getValues(), cCel = comisionColHoja_(sh, 'celular'), cMail = comisionColHoja_(sh, 'correo_personal');
    nombres.forEach(function (n) {
      var x = pers[n] || {}, cel = String(x.tel || '').replace(/\D/g, ''), mail = String(x.correo || '').trim();
      if (!cel && !mail && !String(x.ced || '').trim()) return;
      var fila = 0; for (var i = 1; i < v.length; i++) if (comisionSinTildes_(v[i][0]) === comisionSinTildes_(n)) { fila = i + 1; break; }
      if (!fila) { sh.appendRow([n, '']); v.push([n, '']); fila = v.length; }
      if (/^3\d{9}$/.test(cel)) comisionSetHoja_(sh, fila, cCel, 'celular', cel, por, acta);
      var ced = String(x.ced || '').replace(/\D/g, ''); if (/^\d{5,12}$/.test(ced) && !String(v[fila - 1] && v[fila - 1][1] || '').trim()) comisionSetHoja_(sh, fila, 2, 'cedula', ced, por, acta);
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) && !/@icet\./i.test(mail)) comisionSetHoja_(sh, fila, cMail, 'correo_personal', mail, por, acta);
    });
  } else if (seccion === 'faltantes') {
    var d = datos.datos || {}, ids = Object.keys(d).filter(function (k) { var x = d[k]; return x && (String(x.tel || '').replace(/\D/g, '').length >= 7 || x.mod || x.gest); }); if (!ids.length) return;
    var he = hojaOCrea_('Estudiantes', ['grupo', 'curso', 'no', 'apellidos', 'nombres']), ve = he.getDataRange().getValues(), filas = [];
    for (var j = 1; j < ve.length; j++) if (ve[j][0] !== '') filas.push(j + 1);   // mismo orden que datos_('Estudiantes'): id = posición
    var col = {}; var c = function (n) { return col[n] || (col[n] = comisionColHoja_(he, n)); };
    ids.forEach(function (k) {
      var f = filas[Number(k) - 1], x = d[k]; if (!f) return;
      if (String(x.tel || '').replace(/\D/g, '').length >= 7) comisionSetHoja_(he, f, c('tel_acudiente'), 'tel_acudiente', String(x.tel).replace(/\D/g, ''), por, acta);
      if (x.gest) comisionSetHoja_(he, f, c('gestion_acta'), 'gestion_acta', String(x.gest), por, acta);
      if (x.mod) {
        if (x.ndoc) { comisionSetHoja_(he, f, c('documento'), 'documento', String(x.ndoc), por, acta); if (x.tdoc) comisionSetHoja_(he, f, c('tipo_doc'), 'tipo_doc', String(x.tdoc), por, acta); }
        if (x.lex) comisionSetHoja_(he, f, c('lugar_expedicion'), 'lugar_expedicion', String(x.lex), por, acta);
        if (x.sx) comisionSetHoja_(he, f, c('sexo'), 'sexo', String(x.sx), por, acta);
        if (x.nac) comisionSetHoja_(he, f, c('nacionalidad'), 'nacionalidad', String(x.nac), por, acta);
      }
    });
  }
}
function comisionTitulo_(s) { return String(s == null ? '' : s).toLowerCase().replace(/(^|[\s\-])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/ (De|Del|La|Las|Los|Y) /g, function (m) { return m.toLowerCase(); }).trim(); }
function comisionCorreoDe_(nombre) {
  var f = null; try { f = filaClaveDoc_(nombre); } catch (e) { f = null; }
  var c = f && String(f.v[f.col.correo_contacto] || '').trim();
  if (c) return c;
  var d = datos_('Docentes').filter(function (x) { return comisionSinTildes_(x.nombre_completo) === comisionSinTildes_(nombre); })[0];
  return d && d.correo ? String(d.correo).trim() : '';
}
/** Todo lo que la pantalla necesita de UN grado: cursos, directores, áreas y sus docentes, estudiantes y datos de los integrantes. */
function comisionGradoDatos(p) {
  var quien = comisionQuien_(); p = p || {};
  var cod = String(p.grado || ''), label = COM_GRADO_LABEL[cod];
  if (!label) throw new Error('Ese grado no existe.');
  var al = comisionAlcance_(quien, cod);
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  var grupos = datos_('Grupos').filter(function (g) { return comisionGradoActa_(g.grupo, p.periodo) === cod; }).sort(function (a, b) { return String(a.grupo).localeCompare(String(b.grupo)); });
  var gs = grupos.map(function (g) { return String(g.nombre); }), codes = grupos.map(function (g) { return String(g.grupo); });
  var niv = cod === '00' ? 'pre' : /^0[1-4]$/.test(cod) ? 'pri' : cod === '05' ? 'rot' : 'sec';
  var dir = [], dir2 = [], dirs = {};
  grupos.forEach(function (g, i) {
    var d = datos_('Direccion_Grupo').filter(function (x) { return String(x.grupo) === String(g.grupo); })[0] || {};
    dir.push(String(d.docente_1 || '')); if (d.docente_2) dir2.push({ n: String(d.docente_2), gr: gs[i] });
    [d.docente_1, d.docente_2].forEach(function (n) { if (n) dirs[comisionSinTildes_(n)] = 1; });
  });
  var areas = {}, nomAreas = {}, ap = {};
  comisionHorarioConAlternan_().forEach(function (h) {
    if (!h.docente || comisionGradoActa_(h.grupo, p.periodo) !== cod) return;
    var a = String(h.area || '').trim(); if (/MULTIPLES/i.test(comisionSinTildes_(a))) return;
    (COM_COD_AREA[comisionSinTildes_(a)] || []).forEach(function (x) { nomAreas[x] = nomAreas[x] || {}; nomAreas[x][String(h.docente)] = 1; });
    if (!dirs[comisionSinTildes_(h.docente)]) ap[String(h.docente)] = 1;
  });
  Object.keys(nomAreas).forEach(function (a) { areas[a] = Object.keys(nomAreas[a]).sort().join(' / '); });
  var apoyo = [];
  datos_('Directivos').forEach(function (d) { var n = nombreDirectivoCompleto_(d.nombre, d); apoyo.push({ n: n, rol: String(d.rol), p: false, correo: String(d.correo || d.correo_temporal || '') }); });
  datos_('Docentes').forEach(function (d) { if (/ORIENTACI/i.test(String(d.nivel))) apoyo.push({ n: d.nombre_completo, rol: 'Docente orientadora', p: false }); else if (/PTAFI/i.test(String(d.nivel))) apoyo.push({ n: d.nombre_completo, rol: 'Tutora PTAFI', p: false }); });
  var gnames = {}; dir.forEach(function (n) { if (n) gnames[n] = 1; }); dir2.forEach(function (d) { gnames[d.n] = 1; }); Object.keys(ap).forEach(function (n) { gnames[n] = 1; }); apoyo.forEach(function (a) { gnames[a.n] = 1; });
  var personas = {};
  Object.keys(gnames).forEach(function (n) { var ap0 = apoyo.filter(function (a) { return a.n === n; })[0]; var idn = comisionIdentidad_(n); personas[n] = { ced: cedulaDoc_(n), correo: comisionMailPersonal_((ap0 && ap0.correo) || comisionCorreoDe_(n) || idn.mail), tel: idn.cel }; });
  var setg = {}; codes.forEach(function (c) { setg[c] = gs[codes.indexOf(c)]; });
  var est = [];
  datos_('Estudiantes').forEach(function (e, i) { var g = String(e.grupo); if (!setg[g]) return; var sx = comisionCol_(e, ['sexo', 'genero']); est.push({ id: i + 1, g: setg[g], a: comisionTitulo_(e.apellidos), n: comisionTitulo_(e.nombres), ndoc: comisionCol_(e, ['documento', 'nodoc', 'numerodocumento', 'numdoc', 'ndoc', 'identificacion', 'cedula']).replace(/\D/g, ''), tdoc: comisionCol_(e, ['tipodoc', 'tipodedocumento', 'tipodocumento', 'tdoc', 'tipo']).replace(/[^A-Za-z]/g, '').toUpperCase(), tel: comisionCol_(e, ['telacudiente', 'telefonoacudiente', 'celularacudiente']).replace(/\D/g, ''), lex: comisionCol_(e, ['lugarexpedicion', 'lugardeexpedicion', 'expedicion']), nac: comisionCol_(e, ['nacionalidad']), sx: /^(m|h|hombre|masculino)$/i.test(sx) ? 'M' : /^(f|mujer|femenino)$/i.test(sx) ? 'F' : '' }); });
  var e0 = datos_('Estudiantes')[0] || {}, kn = function (s) { return comisionSinTildes_(String(s)).toLowerCase().replace(/[^a-z0-9]/g, ''); }, ks0 = Object.keys(e0).map(kn);
  var diag = { colDoc: ks0.indexOf('documento') >= 0 || ks0.indexOf('nodoc') >= 0 || ks0.indexOf('numerodocumento') >= 0, colTipo: ks0.indexOf('tipodoc') >= 0 || ks0.indexOf('tipodedocumento') >= 0 || ks0.indexOf('tipodocumento') >= 0, conDoc: est.filter(function (x) { return x.ndoc; }).length, total: est.length, version: (typeof VERSION_SISTEMA !== 'undefined' ? VERSION_SISTEMA : '') };
  return { diag: diag, codigo: cod, label: label, niv: niv, sig: COM_GRADO_SIG[cod], gs: gs, codes: codes, dir: dir, dir2: dir2, ap: Object.keys(ap).sort(), areas: areas, apoyo: apoyo, personas: personas, estudiantes: est };
}
/** Cierre del acta desde la pantalla (la pantalla ya verificó los pendientes): solo el responsable o coordinación; la hora es la del servidor. */
function comisionCierreSimple(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta ya está cerrada.');
    var turnoC = comisionTurno_(quien, a); if (turnoC) throw new Error(turnoC);
    return comisionCerrarActa_(a, { por: quien.nombre }, quien);
  } finally { lock.releaseLock(); }
}

/* ------------------------------ seguimiento para directivos ------------------------------ */
/** Avance de cada acta del año: qué componentes ya están, quién tocó algo por última vez y qué porcentaje lleva. Solo directivos. */
function comisionSeguimiento() {
  var id = identidad_(); if (id.rol !== 'directivo') throw new Error('Solo directivos ven el seguimiento de las comisiones.');
  var anio = Number(parametro_('anio_lectivo', String(new Date().getFullYear()))), out = [];
  var grupos = datos_('Grupos');
  comisionActas_().filter(function (a) { return String(a.anio) === String(anio); }).forEach(function (a) {
    var secs = comisionSecciones_(a.id), cod = String(a.grado), pre = cod === '00', fin = a.periodo === 'Final';
    function d(k) { return secs[k] && secs[k].datos; }
    var cursos = grupos.filter(function (g) { return comisionGradoActa_(g.grupo, a.periodo) === cod; }).map(function (g) { return String(g.grupo); });
    var c = { matricula: 0, reprobacion: 0, reconocimientos: 0, convivencia: 0, compromisos: 0, piar: 0, promocion: 0 };
    cursos.forEach(function (k) {
      var m = d('matricula:' + k); if (m && m.mat && m.mat.ok) c.matricula++;
      var e = d('estudiantes:' + k) || {}, sc = e.sc || {};
      if ((e.rep || []).length || sc.rep) c.reprobacion++; if ((e.con || []).length || sc.con) c.convivencia++; if ((e.com || []).length || sc.com) c.compromisos++; if ((e.piar || []).length || sc.piar) c.piar++;
      var r = d('reconocimientos:' + k) || {}; if (r.recOk || r.sc) c.reconocimientos++;
      var p = d('promocion:' + k); if (p && p.promOk) c.promocion++;
    });
    var nAreas = pre ? 1 : COM_AREAS.length, nRec = pre ? COM_PRE_CLAVES.length : COM_AREAS.length, areas = 0, recs = 0;
    Object.keys(secs).forEach(function (k) { if (/^areas:/.test(k)) areas++; if (/^recomendaciones:/.test(k) && secs[k].datos && String(secs[k].datos.texto || '').trim()) recs++; });
    var integ = (d('integrantes') || {}).int || [], pres = integ.filter(function (x) { return x && x.p; }).length, jur = Object.keys((d('listos') || {}).jur || {}).length, firm = Object.keys((d('firmas') || {}).firm || {}).length;
    var comp = [['Matrícula confirmada', c.matricula, cursos.length], ['Reprobación declarada', c.reprobacion, cursos.length], ['Reconocimientos confirmados', c.reconocimientos, cursos.length], ['Convivencia declarada', c.convivencia, cursos.length], ['Compromisos declarados', c.compromisos, cursos.length], ['PIAR declarado', c.piar, cursos.length]];
    if (fin && !pre) comp.push(['Promoción confirmada', c.promocion, cursos.length]);
    comp.push([pre ? 'Propósitos registrados' : 'Áreas con cifras', Math.min(areas, nAreas), nAreas], ['Recomendaciones escritas', Math.min(recs, nRec), nRec]);
    var hecho = 0, total = 0; comp.forEach(function (x) { hecho += x[1]; total += x[2]; });
    var pr = (d('presencia') || {}).pers || {}, ahoraMin = Number(Utilities.formatDate(new Date(), TZ, 'HH')) * 60 + Number(Utilities.formatDate(new Date(), TZ, 'mm')), hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    var redactando = Object.keys(pr).map(function (n) { var x = pr[n] || {}, v = String(x.visto || ''), m = /^(\d\d):(\d\d)$/.exec(v); return { n: n, rol: String(x.rol || ''), lugar: String(x.lugar || ''), detalle: String(x.detalle || '').slice(0, 40), desde: String(x.desde || ''), visto: v, dia: String(x.dia || ''), activo: !!(m && x.dia === hoy && ahoraMin - (Number(m[1]) * 60 + Number(m[2])) <= 10 && ahoraMin >= (Number(m[1]) * 60 + Number(m[2]))) }; }).filter(function (x) { return x.dia === hoy; });
    var ult = { por: '', fecha: '' }; Object.keys(secs).forEach(function (k) { if (secs[k].fecha > ult.fecha) ult = { por: secs[k].por, fecha: secs[k].fecha }; });
    out.push({ id: a.id, grado: cod, label: COM_GRADO_LABEL[cod] || cod, periodo: a.periodo, estado: a.estado, responsable: a.responsable, acta_no: a.acta_no, asistentes: pres, declaraciones: jur, firmas: firm, ultima: ult,
      redactando: redactando, porcentaje: total ? Math.round(hecho / total * 100) : 0, componentes: comp.map(function (x) { return { nombre: x[0], hecho: x[1], total: x[2] }; }) });
  });
  return out.sort(function (x, y) { return String(y.ultima.fecha).localeCompare(String(x.ultima.fecha)); });
}
