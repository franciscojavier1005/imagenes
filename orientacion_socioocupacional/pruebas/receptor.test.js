// Prueba del receptor Code.gs con Hojas, Lock y Propiedades simuladas. Ejecutar: node pruebas/receptor.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const codigo = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
function libro() {
  const celdas = {}; let borradas = [];
  const sh = {
    getRange(a, b, c, d) {
      if (typeof a === 'string') { const m = a.match(/^A1:A(\d+)$/); return { getValues: () => Array.from({ length: +m[1] }, (_, i) => [celdas[(i + 1) + ',1'] === undefined ? '' : celdas[(i + 1) + ',1']]) }; }
      return {
        getValues: () => Array.from({ length: c || 1 }, (_, i) => Array.from({ length: d || 1 }, (_, j) => celdas[(a + i) + ',' + (b + j)] === undefined ? '' : celdas[(a + i) + ',' + (b + j)])),
        setValues: (v) => v.forEach((fila, i) => fila.forEach((x, j) => { celdas[(a + i) + ',' + (b + j)] = x; })),
        getValue: () => celdas[a + ',' + b]
      };
    },
    deleteRow(n) { borradas.push(n); Object.keys(celdas).forEach(k => { if (k.split(',')[0] == n) delete celdas[k]; }); },
    getName: () => 'Respuestas', getParent: () => ({ getName: () => 'Libro de prueba' })
  };
  return { celdas, sh, borradas };
}
function entorno(L) {
  const props = {};
  const ctx = {
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => n === 'Respuestas' ? L.sh : null }), flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    ContentService: { createTextOutput: (t) => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 1 }, createTemplateFromFile: () => ({ evaluate() { return { setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } }; } }) },
    console, Date, JSON, Array, String, Math
  };
  vm.createContext(ctx); vm.runInContext(codigo, ctx); return ctx;
}
const fila = (cod, txt) => { const f = Array.from({ length: 44 }, (_, i) => 'x' + i); f[0] = '2026-11-20'; f[43] = cod; if (txt !== undefined) f[41] = txt; return f; };
const extra = ['pv', 'carrera', 'No', '', 'Tal vez', 'Dinero'];
let L = libro(), C = entorno(L);
// 1) configurar crea encabezados AT:AY
let r = C.configurar(); assert.strictEqual(r.encabezadosAT_AY, 'creados'); assert.strictEqual(L.celdas['1,46'], 'Proyecto de vida'); assert.strictEqual(L.celdas['1,51'], 'Barreras');
assert.strictEqual(C.configurar().encabezadosAT_AY, 'ya existían');
// 2) primera fila de datos en la 2 (con encabezado en la 1)
for (let j = 1; j <= 44; j++) L.celdas['1,' + j] = 'enc' + j;
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.guardar(JSON.stringify({ row: fila('RUMBO1:A'), extra })))), { ok: true });
assert.strictEqual(L.celdas['2,1'], '2026-11-20'); assert.strictEqual(L.celdas['2,44'], 'RUMBO1:A'); assert.strictEqual(L.celdas['2,46'], 'pv'); assert.strictEqual(L.celdas['2,51'], 'Dequeda'.length ? 'Dinero' : '');
// 3) segunda respuesta va a la fila 3; la columna AS (45) no se toca
assert.ok(C.guardar(JSON.stringify({ row: fila('RUMBO1:B'), extra })).ok); assert.strictEqual(L.celdas['3,44'], 'RUMBO1:B'); assert.strictEqual(L.celdas['3,45'], undefined);
// 4) duplicado
const d = C.guardar(JSON.stringify({ row: fila('RUMBO1:B'), extra })); assert.ok(d.ok && d.repetido); assert.strictEqual(L.celdas['4,1'], undefined);
// 5) formato inválido
assert.strictEqual(C.guardar(JSON.stringify({ row: [1, 2], extra })).ok, false);
assert.strictEqual(C.guardar('no es json').ok, false);
// 6) fórmulas y saltos de línea
C.guardar(JSON.stringify({ row: fila('RUMBO1:C', '=IMPORTRANGE("x")\nlínea 2'), extra })); assert.strictEqual(L.celdas['4,42'], "'=IMPORTRANGE(\"x\") línea 2");
// 7) probar() deja el libro como estaba
const antes = Object.keys(L.celdas).length; const p = C.probar(); assert.ok(p.ok); assert.strictEqual(Object.keys(L.celdas).length, antes);
// 8) ping
assert.ok(JSON.parse(C.doGet({ parameter: { ping: '1' } }).t).ok);
console.log('receptor.test.js: todo OK');
