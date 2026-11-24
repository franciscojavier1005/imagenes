/* Servidor de demostración que corre DENTRO del navegador (iframe oculto): el código real de ICET_completo.gs con una hoja de cálculo simulada y
   datos INVENTADOS. Sirve para ver y probar las pantallas en cualquier computador (Mac, Windows) sin Google ni servidor.
   Autor del sistema: Francisco Javier Cortés Cabezas. Los datos son ficticios; nada se guarda fuera de la página. */
(function () {
  var HEADERS = __CABECERAS__;
  function Hoja(v) { this.v = v; this.nombre = ''; }
  Hoja.prototype.getDataRange = function () { var s = this; return { getValues: function () { return JSON.parse(JSON.stringify(s.v)); } }; };
  Hoja.prototype.appendRow = function (r) { this.v.push(r); };
  Hoja.prototype.getName = function () { return this.nombre; };
  Hoja.prototype.getLastColumn = function () { return Math.max.apply(null, [0].concat(this.v.map(function (r) { return r.length; }))); };
  Hoja.prototype.deleteRow = function (r) { this.v.splice(r - 1, 1); };
  Hoja.prototype.getRange = function (r, c, nr, nc) {
    var s = this;
    return {
      getValue: function () { var x = (s.v[r - 1] || [])[c - 1]; return x === undefined ? '' : x; },
      getValues: function () { var o = []; for (var i = 0; i < (nr || 1); i++) { var row = []; for (var j = 0; j < (nc || 1); j++) { var x = (s.v[r - 1 + i] || [])[c - 1 + j]; row.push(x === undefined ? '' : x); } o.push(row); } return o; },
      setValue: function (x) { while (s.v.length < r) s.v.push([]); while (s.v[r - 1].length < c) s.v[r - 1].push(''); s.v[r - 1][c - 1] = x; },
      setValues: function (a) { a.forEach(function (row, i) { while (s.v.length < r + i) s.v.push([]); row.forEach(function (x, j) { while (s.v[r - 1 + i].length < c + j) s.v[r - 1 + i].push(''); s.v[r - 1 + i][c - 1 + j] = x; }); }); }
    };
  };
  var hojas = {};
  Object.keys(HEADERS).forEach(function (n) { hojas[n] = new Hoja([HEADERS[n]]); });

  /* ---------- datos inventados ---------- */
  function fila(nombre, o) { var h = HEADERS[nombre]; return h.map(function (k) { return o[k] === undefined ? '' : o[k]; }); }
  var DOCS = [
    ['Prueba Uno', 'Ana', 'PRIMARIA', '0501'], ['Prueba Dos', 'Beto', 'SECUNDARIA', ''], ['Prueba Tres', 'Carla', 'SECUNDARIA', '0701'],
    ['Prueba Cuatro', 'Dani', 'PREESCOLAR', '0001'], ['Prueba Cinco', 'Elena', 'PRIMARIA', '0502'], ['Prueba Seis', 'Fabio', 'SECUNDARIA', '0901'],
    ['Prueba Siete', 'Gina', 'SECUNDARIA', '1101'], ['Prueba Ocho', 'Hugo', 'PREESCOLAR', '0002'], ['Prueba Orientadora', 'Olga', 'ORIENTACIÓN', '']
  ];
  var NOM = function (d) { return d[0] + ' ' + d[1]; };
  DOCS.forEach(function (d, i) { hojas.Docentes.v.push(fila('Docentes', { codigo: 'D' + (i + 1), n: i + 1, apellidos: d[0], nombres: d[1], nombre_completo: NOM(d), nivel: d[2], direccion_grupo: d[3], tiene_horario: 'SI' })); });
  var GRUPOS = [['0001', '0°-1', '00'], ['0002', '0°-2', '00'], ['0501', '5°-1', '05'], ['0502', '5°-2', '05'], ['0701', '7°-1', '07'], ['CS101', 'CS 1-1', 'CS1'], ['0901', '9°-1', '09'], ['CS201', 'CS 2-1', 'CS2'], ['1101', '11°-1', '11']];
  var DIRS = { '0001': 'Prueba Cuatro Dani', '0002': 'Prueba Ocho Hugo', '0501': 'Prueba Uno Ana', '0502': 'Prueba Cinco Elena', '0701': 'Prueba Tres Carla', 'CS101': 'Prueba Tres Carla', '0901': 'Prueba Seis Fabio', 'CS201': 'Prueba Seis Fabio', '1101': 'Prueba Siete Gina' };
  var APELL = ['Acosta Prueba', 'Benítez Ejemplo', 'Cabrera Demo', 'Delgado Modelo', 'Escobar Muestra', 'Figueroa Prueba', 'Gómez Ejemplo', 'Herrera Demo', 'Ibarra Modelo', 'Jiménez Muestra', 'Lozano Prueba', 'Mejía Ejemplo', 'Naranjo Demo', 'Ortiz Modelo'];
  var NOMB = ['Luna Sofía', 'Mateo José', 'Valentina', 'Santiago', 'Camila Andrea', 'Samuel David', 'Isabella', 'Emilio', 'Daniela', 'Tomás', 'Salomé', 'Nicolás', 'Mariana', 'Juan Pablo'];
  GRUPOS.forEach(function (g) {
    hojas.Grupos.v.push(fila('Grupos', { grupo: g[0], tipo: g[2].indexOf('CS') === 0 ? 'CAMINAR' : 'REGULAR', grado: g[1].split('-')[0], nombre: g[1] }));
    hojas.Direccion_Grupo.v.push(fila('Direccion_Grupo', { grupo: g[0], nombre: g[1], tipo_direccion: 'SIMPLE', docente_1: DIRS[g[0]] }));
    hojas.Horario.v.push(fila('Horario', { docente_n: 0, docente: DIRS[g[0]], dia: 'LUNES', hora: 1, bloque: 1, sesion: 1, inicio: '06:30', fin: '07:15', tipo: 'CLASE', grupo: g[0], area: g[2] === '00' || g[2] === '05' ? 'MULTIPLES' : 'CAS' }));
    if (g[2] !== '00' && g[2] !== '05') hojas.Horario.v.push(fila('Horario', { docente_n: 0, docente: 'Prueba Dos Beto', dia: 'MARTES', hora: 2, bloque: 1, sesion: 2, inicio: '07:15', fin: '08:00', tipo: 'CLASE', grupo: g[0], area: 'MAT' }));
    for (var i = 0; i < 14; i++) hojas.Estudiantes.v.push(fila('Estudiantes', { grupo: g[0], curso: g[1], no: i + 1, apellidos: APELL[i].toUpperCase(), nombres: NOMB[i].toUpperCase(), documento: '10' + g[0].replace(/\D/g, '') + String(1000 + i), tipo_doc: g[2] === '00' || g[2] === '05' || g[2] === '07' ? 'RC' : 'TI' }));
  });
  DOCS.forEach(function (d, i) { hojas.Identidad_Docentes.v.push(fila('Identidad_Docentes', { docente: NOM(d), cedula: String(10000001 + i), celular: i % 2 ? '' : '3001234' + String(500 + i) })); });
  hojas.Directivos.v.push(fila('Directivos', { nombre: 'Coordinador de Prueba', rol: 'Coordinador académico', correo_temporal: 'coord@prueba.com', correo: 'coord@prueba.com' }));

  /* ---------- Google simulado ---------- */
  function sha256(str) {   /* SHA-256 mínimo y síncrono */
    var K = [], H = [], i, j, w = [], bytes = [], l, a, b, c, d, e, f, g, h, t1, t2;
    var u = unescape(encodeURIComponent(str)); for (i = 0; i < u.length; i++) bytes.push(u.charCodeAt(i));
    var isP = function (n) { for (var q = 2; q * q <= n; q++) if (n % q === 0) return false; return true; }, fr = function (x) { return ((x - Math.floor(x)) * 4294967296) | 0; };
    for (i = 2, j = 0; j < 64; i++) if (isP(i)) { K[j] = fr(Math.pow(i, 1 / 3)); if (j < 8) H[j] = fr(Math.pow(i, 1 / 2)); j++; }
    l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
    var rr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var o = 0; o < bytes.length; o += 64) {
      for (i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i] << 24) | (bytes[o + 4 * i + 1] << 16) | (bytes[o + 4 * i + 2] << 8) | bytes[o + 4 * i + 3];
      for (i = 16; i < 64; i++) w[i] = (w[i - 16] + (rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 7] + (rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10))) | 0;
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (i = 0; i < 64; i++) { t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0; t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = []; H.forEach(function (x) { out.push((x >> 24) & 255, (x >> 16) & 255, (x >> 8) & 255, x & 255); }); return out.map(function (b) { return b > 127 ? b - 256 : b; });
  }
  var pad = function (n) { return ('0' + n).slice(-2); };
  var fmt = function (d, tz, p) {
    var o = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
    if (p === 'yyyy-MM-dd') return o.year + '-' + o.month + '-' + o.day;
    if (p === 'u') return String({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[o.weekday]);
    var h = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    if (p === 'HH:mm') return h; if (p === 'HH') return h.split(':')[0]; if (p === 'mm') return h.split(':')[1]; if (p === 'yyyy-MM-dd HH:mm') return o.year + '-' + o.month + '-' + o.day + ' ' + h; return String(d);
  };
  var props = {}, cacheMem = {};
  var carpeta = function (ruta) { return { ruta: ruta, moveTo: function () {}, getFilesByName: function () { return { hasNext: function () { return false; } }; }, getFoldersByName: function () { return { hasNext: function () { return false; } }; }, createFolder: function (n) { return carpeta(ruta + '/' + n); }, createFile: function () { return { setSharing: function () {}, getId: function () { return 'F1'; }, getUrl: function () { return '#'; } }; } }; };
  window.EMAIL = 'dueno@prueba.com';
  window.Utilities = { formatDate: fmt, getUuid: function () { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }, base64Decode: function (s) { return Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }, newBlob: function (b, m, n) { return { b: b, m: m, n: n }; }, computeDigest: function (a, s) { return sha256(String(s)); }, DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 } };
  window.Logger = { log: function () {} };
  window.LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
  window.Session = { getActiveUser: function () { return { getEmail: function () { return window.EMAIL; } }; } };
  window.CacheService = { getScriptCache: function () { return { get: function (k) { return cacheMem[k] === undefined ? null : cacheMem[k]; }, getAll: function (ks) { var o = {}; ks.forEach(function (k) { if (cacheMem[k] !== undefined) o[k] = cacheMem[k]; }); return o; }, put: function (k, v) { cacheMem[k] = v; }, putAll: function (o) { Object.keys(o).forEach(function (k) { cacheMem[k] = o[k]; }); }, remove: function (k) { delete cacheMem[k]; }, removeAll: function (ks) { ks.forEach(function (k) { delete cacheMem[k]; }); } }; } };
  window.PropertiesService = { getScriptProperties: function () { return { getProperty: function (k) { return props[k] === undefined ? null : props[k]; }, setProperty: function (k, v) { props[k] = v; } }; } };
  window.SpreadsheetApp = { getActive: function () { return { getId: function () { return 'L1'; }, getName: function () { return 'Libro de demostración'; }, getEditors: function () { return [{ getEmail: function () { return 'dueno@prueba.com'; } }]; }, getOwner: function () { return { getEmail: function () { return 'dueno@prueba.com'; } }; }, getSheetByName: function (n) { if (hojas[n]) hojas[n].nombre = n; return hojas[n] || null; }, insertSheet: function (n) { hojas[n] = new Hoja([]); hojas[n].nombre = n; return hojas[n]; } }; }, getUi: function () { return { alert: function () {}, ButtonSet: { YES_NO: 1, OK: 1 }, Button: { YES: 'YES' } }; } };
  window.ScriptApp = { getService: function () { return { getUrl: function () { return '#vista-previa'; } }; }, getProjectTriggers: function () { return []; } };
  window.MailApp = { sendEmail: function () {} };
  window.DriveApp = { getFoldersByName: function () { return { hasNext: function () { return false; } }; }, createFolder: function (n) { return carpeta(n); }, getRootFolder: function () { return carpeta('raiz'); }, getFolderById: function () { return carpeta('x'); }, createFile: function () { return {}; }, getFileById: function () { return { moveTo: function () {} }; } };
  window.HtmlService = { createHtmlOutput: function () { return { getBlob: function () { return { getAs: function () { return {}; } }; } }; } };

  /* ---------- puente con la página ---------- */
  window.__prepara = function () {
    var tokens = {};
    restablecerClave_('Coordinador de Prueba', '123456');
    tokens.coord = ingresar({ nombre: 'Coordinador de Prueba', pin: '123456' }).token;
    var ced = function (n) { return String(10000001 + DOCS.map(NOM).indexOf(n)); };
    var ses = function (n) { return ingresarDocente({ nombre: n, pin: ced(n), correo: 'demo@prueba.com' }).token; };
    tokens.docente = ses('Prueba Uno Ana'); tokens.docente2 = ses('Prueba Dos Beto'); tokens.docente3 = ses('Prueba Cuatro Dani');
    return tokens;
  };
  window.addEventListener('message', function (e) {
    var d = e.data || {}; if (d.tipo !== 'llama') return;
    var res = { tipo: 'res', id: d.id };
    try {
      var r;
      if (d.fn === 'llamarSeguro') r = llamarSeguro(d.args[0], d.args[1], d.args[2]);
      else if (d.fn === 'urlBase') r = '#vista-previa';
      else if (typeof window[d.fn] === 'function') r = window[d.fn].apply(null, d.args);
      else throw new Error('Función no disponible en la vista previa: ' + d.fn);
      res.ok = JSON.parse(JSON.stringify(r === undefined ? null : r, function (k, v) { return v; }));
    } catch (err) { res.err = String(err && err.message || err); }
    e.source.postMessage(res, '*');
  });
  window.__listo = function () { window.parent.postMessage({ tipo: 'listo', tokens: window.__prepara() }, '*'); };
})();
