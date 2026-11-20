/**
 * Rumbo ICET · Orientación socioocupacional · Aplicación web independiente.
 * Sirve el cuestionario (Index.html) y guarda cada respuesta como una fila nueva en el libro
 * «Orientación Vocacional ICET 2026 - Respuestas» (hoja «Respuestas»).
 * Autoría del sistema: Francisco Javier Cortés Cabezas · I.E. ICET, Tumaco.
 *
 * Columnas A:AR  -> respuestas del cuestionario (44 datos)
 * Columna AS     -> «Grupo de análisis» (fórmula del libro; este script NO la toca)
 * Columnas AT:AY -> proyecto de vida y vinculación (6 datos)
 *
 * PRIMERA VEZ: ejecutar «configurar» desde el editor (pide permiso para hojas de cálculo), luego
 * Implementar > Nueva implementación > Aplicación web (Ejecutar como: Yo · Acceso: Cualquier persona).
 */
var ID_LIBRO_POR_DEFECTO = '1ygvFydmv1X-9U9Ephq_dQbp8wVz9RUgahW405bA598M';   // se puede cambiar en Propiedades del script (ID_LIBRO)
var HOJA = 'Respuestas';
var N_FILA = 44, N_EXTRA = 6, COL_CODIGO = 44, COL_EXTRA = 46;                 // AR = 44 · AT = 46
var ENC_EXTRA = ['Proyecto de vida', 'Carrera o programa que quiere', 'Matrícula en educación superior', 'Institución', 'Intención de inscripción', 'Barreras'];

function idLibro_() {
  var id = PropertiesService.getScriptProperties().getProperty('ID_LIBRO');
  return id || ID_LIBRO_POR_DEFECTO;
}
function hoja_() {
  var sh = SpreadsheetApp.openById(idLibro_()).getSheetByName(HOJA);
  if (!sh) throw new Error('No existe la hoja «' + HOJA + '» en el libro.');
  return sh;
}

/** Ejecutar una vez desde el editor. Guarda el libro y pone los encabezados de AT:AY si faltan. */
function configurar() {
  PropertiesService.getScriptProperties().setProperty('ID_LIBRO', idLibro_());
  var sh = hoja_();
  var enc = sh.getRange(1, COL_EXTRA, 1, N_EXTRA).getValues()[0];
  var falta = enc.some(function (v) { return v === ''; });
  if (falta) sh.getRange(1, COL_EXTRA, 1, N_EXTRA).setValues([ENC_EXTRA]);
  return { ok: true, libro: sh.getParent().getName(), hoja: sh.getName(), encabezadosAT_AY: falta ? 'creados' : 'ya existían' };
}

/** Prueba desde el editor: escribe y borra una fila de ensayo. */
function probar() {
  var fila = []; for (var i = 0; i < N_FILA; i++) fila.push('prueba');
  fila[COL_CODIGO - 1] = 'PRUEBA-' + Date.now();
  var r = procesar(JSON.stringify({ v: 2, row: fila, extra: ['a', 'b', 'c', 'd', 'e', 'f'] }));
  if (r.ok) {
    var sh = hoja_(), a = sh.getRange('A1:A5000').getValues(), ult = 1;
    for (var k = a.length - 1; k >= 0; k--) { if (a[k][0] !== '') { ult = k + 1; break; } }
    if (String(sh.getRange(ult, 1).getValue()) === 'prueba') sh.deleteRow(ult);
  }
  return r;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return salida_({ ok: true, servicio: 'Rumbo ICET', hora: new Date().toISOString() });
  var t = HtmlService.createTemplateFromFile('Index');
  t.panel = !!(e && e.parameter && e.parameter.panel === '1');
  return t.evaluate().setTitle('Rumbo · Orientación vocacional ICET')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Envío por fetch (si el cuestionario se aloja fuera de Apps Script). */
function doPost(e) { return salida_(procesar(e.postData.contents)); }
/** Envío desde la página servida por Apps Script (google.script.run). */
function guardar(texto) { return procesar(texto); }

function procesar(texto) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var datos = JSON.parse(texto);
    var fila = datos.row, extra = datos.extra;
    if (!Array.isArray(fila) || fila.length !== N_FILA || !Array.isArray(extra) || extra.length !== N_EXTRA) return { ok: false, error: 'formato' };
    fila = fila.map(limpiar_); extra = extra.map(limpiar_);
    var codigo = fila[COL_CODIGO - 1], sh = hoja_();
    // Primera fila libre según la columna A (la columna AS tiene fórmula y no sirve para medir)
    var a = sh.getRange('A1:A5000').getValues(), ultima = 1;
    for (var i = a.length - 1; i >= 0; i--) { if (a[i][0] !== '') { ultima = i + 1; break; } }
    if (codigo && ultima > 1) {            // evita duplicados si el estudiante reenvía el mismo código
      var cods = sh.getRange(2, COL_CODIGO, ultima - 1, 1).getValues();
      for (var j = 0; j < cods.length; j++) { if (cods[j][0] === codigo) return { ok: true, repetido: true }; }
    }
    var destino = ultima + 1;
    sh.getRange(destino, 1, 1, N_FILA).setValues([fila]);
    sh.getRange(destino, COL_EXTRA, 1, N_EXTRA).setValues([extra]);
    SpreadsheetApp.flush();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function limpiar_(v) {
  v = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').slice(0, 400);
  if (/^[=+\-@]/.test(v)) v = "'" + v;        // evita que Sheets lo interprete como fórmula
  return v;
}
function salida_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
