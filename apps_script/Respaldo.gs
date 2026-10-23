/**
 * Respaldo de las rondas y recuperación desde una copia anterior del libro.
 * - Cada vez que se guarda una ronda, las marcas guardadas se anotan también en un libro de respaldo aparte (se crea solo en Drive,
 *   «ICET · Respaldo de rondas (no borrar)»; su id queda en Parametros). Si algo falla, el guardado de la ronda NO se afecta.
 * - «Respaldar todo ahora» copia completas Registro_Ronda, Novedades e Incumplimientos al libro de respaldo.
 * - «Recuperar rondas desde una copia» agrega a las hojas actuales las filas que falten en una copia anterior del libro (o del respaldo),
 *   sin cambiar ni borrar nada de lo que ya existe (lo de hoy y lo que se haya modificado se respeta).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var NOMBRE_RESPALDO = 'ICET · Respaldo de rondas (no borrar)';
var HOJAS_RECUPERABLES = [
  { hoja: 'Registro_Ronda', alternas: ['Registro_Ronda_log'], clave: function (f, c) { return [fechaClave_(f[c.fecha]), Number(f[c.sesion]), codClave_(f[c.grupo]), String(f[c.area] || '')].join('|'); } },
  { hoja: 'Novedades', alternas: [], clave: function (f, c) { return [fechaClave_(f[c['Fecha Novedad']]), f[c['Docente']], f[c['Tipo Novedad']], f[c['Sesiones']], f[c['Área/Asignatura']]].join('|'); } },
  { hoja: 'Incumplimientos', alternas: [], clave: function (f, c) { return String(f[c.id]); } }
];
function fechaClave_(x) { return x instanceof Date ? ymd_(x) : String(x == null ? '' : x).slice(0, 10); }
function codClave_(g) { g = String(g == null ? '' : g).replace(/^'/, ''); while (/^\d+$/.test(g) && g.length < 4) g = '0' + g; return g; }

/** Libro de respaldo: el de Parametros (respaldo_id) o uno nuevo. */
function libroRespaldo_() {
  var id = parametro_('respaldo_id', '');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* se crea otro */ } }
  var libro = SpreadsheetApp.create(NOMBRE_RESPALDO);
  guardarParametro_('respaldo_id', libro.getId());
  return libro;
}

var COL_RESPALDO_REGISTRO = ['marca_temporal', 'fecha', 'dia', 'sesion', 'franja', 'docente', 'grupo', 'area', 'estado', 'motivo', 'justificada', 'minutos', 'observaciones', 'directivo', 'atendido_por', 'guardado_en'];
/** Anota en el respaldo, en una sola escritura, las filas de Registro_Ronda recién guardadas. Nunca lanza error. */
function respaldarRonda_(filas) {
  try {
    if (!filas || !filas.length) return;
    var libro = libroRespaldo_(), sh = libro.getSheetByName('Registro_Ronda_log'), n = COL_RESPALDO_REGISTRO.length;
    if (!sh) { sh = libro.insertSheet('Registro_Ronda_log'); sh.appendRow(COL_RESPALDO_REGISTRO); }
    var ahora = ahoraTxt_(), datos = filas.map(function (f) { return rellena_(f, n - 1).concat([ahora]); });
    sh.getRange(sh.getLastRow() + 1, 1, datos.length, n).setValues(datos);
  } catch (e) { Logger.log('Respaldo de ronda no disponible: ' + e); }
}

/** Menú: copia completa de las hojas de registro al libro de respaldo. */
function respaldarTodoAhora() {
  exigirEditor_();
  var libro = libroRespaldo_(), ui = SpreadsheetApp.getUi(), resumen = [];
  HOJAS_RECUPERABLES.forEach(function (d) {
    var o = hoja_(d.hoja); if (!o) return;
    var v = o.getDataRange().getValues(), sh = libro.getSheetByName(d.hoja) || libro.insertSheet(d.hoja);
    sh.clear(); if (v.length) sh.getRange(1, 1, v.length, v[0].length).setValues(v);
    resumen.push(d.hoja + ': ' + Math.max(0, v.length - 1) + ' filas');
  });
  bitacora_('Respaldo completo', resumen.join(' · '));
  ui.alert('Respaldo hecho', resumen.join('\n') + '\n\nLibro de respaldo: ' + libro.getUrl(), ui.ButtonSet.OK);
}

/** Filas de «origen» (matriz con encabezado) que no existen en «destino» según la clave de la hoja; la última versión de cada clave gana. */
function filasFaltantes_(def, origen, destino) {
  var co = {}, cd = {}; origen[0].forEach(function (k, i) { co[k] = i; }); destino[0].forEach(function (k, i) { cd[k] = i; });
  var hay = {}; for (var i = 1; i < destino.length; i++) hay[def.clave(destino[i], cd)] = 1;
  var ultimas = {}, orden = [];
  for (var j = 1; j < origen.length; j++) {
    if (origen[j][0] === '' || origen[j][0] == null) continue;
    var k = def.clave(origen[j], co); if (hay[k]) continue;
    if (!(k in ultimas)) orden.push(k);
    ultimas[k] = origen[j];
  }
  return orden.map(function (k) { return destino[0].map(function (h) { return co[h] == null ? '' : ultimas[k][co[h]]; }); });
}

function recuperarRondasDesdeCopia() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Recuperar rondas desde una copia', 'Pegue el enlace (o el id) de la copia del libro hecha desde el historial de versiones, o del libro de respaldo.\nSolo se agregan las filas que faltan: no se cambia ni se borra nada de lo actual.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var m = String(r.getResponseText()).match(/[-\w]{25,}/);
  if (!m) { ui.alert('No reconocí el enlace o el id. Copie la dirección completa del libro.'); return; }
  var origen;
  try { origen = SpreadsheetApp.openById(m[0]); } catch (e) { ui.alert('No pude abrir esa copia. Revise que su cuenta tenga acceso.'); return; }
  var plan = [];
  HOJAS_RECUPERABLES.forEach(function (d) {
    var so = [d.hoja].concat(d.alternas).map(function (n) { return origen.getSheetByName(n); }).filter(function (s) { return s; });
    var dest = hoja_(d.hoja); if (!dest || !so.length) return;
    var vd = dest.getDataRange().getValues(), falt = [];
    so.forEach(function (s) { var vo = s.getDataRange().getValues(); if (vo.length > 1) falt = falt.concat(filasFaltantes_(d, vo, vd)); });
    var vistos = {}, unicas = [], cd = {}; vd[0].forEach(function (k, i) { cd[k] = i; });
    falt.forEach(function (f) { var k = d.clave(f, cd); if (!vistos[k]) { vistos[k] = 1; unicas.push(f); } });
    plan.push({ def: d, filas: unicas, dest: dest, cd: cd });
  });
  var total = plan.reduce(function (a, p) { return a + p.filas.length; }, 0);
  var txt = plan.map(function (p) { return p.def.hoja + ': ' + p.filas.length + ' filas que faltan'; }).join('\n');
  var fr = plan.filter(function (p) { return p.def.hoja === 'Registro_Ronda'; })[0], fechas = {};
  if (fr) fr.filas.forEach(function (f) { var d = fechaClave_(f[fr.cd.fecha]); fechas[d] = (fechas[d] || 0) + 1; });
  if (!total) { ui.alert('Nada que recuperar', 'La copia no tiene filas que falten en el libro actual.\n\n' + txt, ui.ButtonSet.OK); return; }
  if (ui.alert('Recuperar rondas', txt + (Object.keys(fechas).length ? '\n\nMarcas de la ronda por fecha:\n' + Object.keys(fechas).sort().map(function (d) { return d + ': ' + fechas[d]; }).join('\n') : '') + '\n\n¿Agregarlas ahora? (no cambia ni borra lo que ya está)', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  plan.forEach(function (p) { p.filas.forEach(function (f) { p.dest.appendRow(f); }); });
  bitacora_('Recuperó rondas desde una copia', txt.replace(/\n/g, ' · '));
  ui.alert('Listo: se agregaron ' + total + ' filas.');
}
