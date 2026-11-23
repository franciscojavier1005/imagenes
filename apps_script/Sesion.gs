/**
 * Ingreso con clave (sin pantallas de Google).
 *
 * La aplicación web se publica "Ejecutar como: yo" y "Cualquier persona": nadie tiene que iniciar sesión en Google ni aceptar permisos
 * ("Google no ha verificado esta aplicación" ya no aparece). En su lugar, cada directivo entra con su nombre y una clave de 6 dígitos
 * que genera el propietario desde el menú del libro. Con una clave correcta el servidor entrega un token aleatorio (se guarda solo su
 * hash en la hoja Sesiones, 14 días) y desde ese momento TODA llamada de las pantallas pasa por llamarSeguro(), que valida el token,
 * toma la identidad del directivo y aplica la matriz de permisos (Api.gs). Las funciones públicas llevan además su propia
 * comprobación de identidad, de modo que nadie puede invocarlas directamente desde la consola del navegador.
 *
 * Claves: se guarda SHA-256(sal + clave), nunca la clave. 5 intentos fallidos bloquean al directivo 15 minutos.
 */
var COL_SESIONES = ['token_hash', 'nombre', 'correo', 'creada', 'expira', 'ultimo_uso'];
var COL_CLAVE = ['pin_hash', 'pin_sal', 'intentos', 'bloqueado_hasta', 'correo', 'informe_dia', 'informe_semana', 'informe_mes', 'clave_temporal', 've_todo', 'cambia_asignacion', 'administra'];
var SESION_DIAS = 14, PIN_INTENTOS = 5, BLOQUEO_MIN = 15;

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}
function ahoraMs_() { return new Date().getTime(); }

/** La hoja Directivos de libros anteriores no tiene las columnas de clave: se agregan al final. */
function hojaDirectivos_() {
  var sh = hoja_('Directivos'), cab = sh.getDataRange().getValues()[0];
  COL_CLAVE.forEach(function (c) { if (cab.indexOf(c) < 0) { sh.getRange(1, cab.length + 1).setValue(c); cab.push(c); } });
  return sh;
}
function filaDirectivo_(nombre) {
  var sh = hojaDirectivos_(), v = sh.getDataRange().getValues(), cab = v[0], col = {};
  cab.forEach(function (k, i) { col[k] = i; });
  for (var i = 1; i < v.length; i++) if (String(v[i][col.nombre]).trim() === String(nombre).trim()) return { sh: sh, fila: i + 1, v: v[i], col: col };
  return null;
}

/** Nombres que se muestran en la pantalla de ingreso (públicos). */
function listarDirectivosPublicos() {
  hojaDirectivos_();
  return datos_('Directivos').map(function (d) { return { nombre: d.nombre, etiqueta: nombreDirectivoCompleto_(d.nombre, d), rol: d.rol, tieneClave: !!String(d.pin_hash || '').trim() }; });
}
/** Nombre completo con apellidos primero (como los docentes). La clave interna de cada directivo no cambia: solo lo que se muestra.
 *  Se toma de la columna opcional «nombre_completo» de la hoja Directivos; si no existe, de esta lista. */
var DIRECTIVOS_COMPLETO = { 'Francisco Cortés': 'Cortés Cabezas Francisco Javier', 'Verónica Barreiro': 'Barreiro Caicedo Carmen Verónica', 'Harold Angulo': 'Angulo Merchancano Harold Wilson', 'Jorge Hernández': 'Hernández Cortés Jorge Enrique' };
function nombreDirectivoCompleto_(nombre, fila) {
  var n = String(nombre || '').trim();
  if (fila && String(fila.nombre_completo || '').trim()) return String(fila.nombre_completo).trim();
  return DIRECTIVOS_COMPLETO[n] || n;
}

function pinValido_(pin) { return /^\d{6}$/.test(String(pin)); }

/** Comprueba la clave de un directivo con control de intentos. Devuelve la fila si es correcta; si no, lanza un error. */
function verificarClave_(nombre, pin) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = filaDirectivo_(nombre);
    if (!d) throw new Error('Nombre o clave incorrectos.');
    var c = d.col, bloq = Number(d.v[c.bloqueado_hasta]) || 0;
    if (bloq > ahoraMs_()) throw new Error('Demasiados intentos. Espere unos minutos e intente de nuevo.');
    if (!String(d.v[c.pin_hash] || '').trim()) throw new Error('Aún no tiene clave. Pídala a quien administra el libro.');
    var ok = pinValido_(pin) && igualConstante_(hash_(d.v[c.pin_sal] + pin), d.v[c.pin_hash]);
    if (!ok) {
      var n = (Number(d.v[c.intentos]) || 0) + 1;
      d.sh.getRange(d.fila, c.intentos + 1).setValue(n >= PIN_INTENTOS ? 0 : n);
      if (n >= PIN_INTENTOS) d.sh.getRange(d.fila, c.bloqueado_hasta + 1).setValue(ahoraMs_() + BLOQUEO_MIN * 60000);
      throw new Error(n >= PIN_INTENTOS ? 'Demasiados intentos. Espere ' + BLOQUEO_MIN + ' minutos.' : 'Nombre o clave incorrectos.');
    }
    d.sh.getRange(d.fila, c.intentos + 1).setValue(0);
    return d;
  } finally { lock.releaseLock(); }
}

/** Inicia sesión. p = {nombre, pin}. Devuelve {token, nombre, rol}. */
function ingresar(p) {
  p = p || {};
  var d = verificarClave_(p.nombre, p.pin);
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var ahora = ahoraMs_(), sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (Number(v[i][4]) < ahora) sh.deleteRow(i + 1);   // limpia sesiones vencidas
  sh.appendRow([hash_(token), d.v[d.col.nombre], String(d.v[d.col.correo_temporal]).toLowerCase(), ahora, ahora + SESION_DIAS * 86400000, ahora]);
  return { token: token, nombre: d.v[d.col.nombre], rol: d.v[d.col.rol], debeCambiar: String(d.v[d.col.clave_temporal] || '') === 'SI' };
}

function cerrarSesion(token) {
  var h = hash_(token || ''), sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (v[i][0] === h) sh.deleteRow(i + 1);
  return { ok: true };
}

function validarToken_(token) {
  if (!token || String(token).length < 40) return null;
  var h = hash_(token), v = hojaOCrea_('Sesiones', COL_SESIONES).getDataRange().getValues(), ahora = ahoraMs_();
  for (var i = 1; i < v.length; i++) if (igualConstante_(v[i][0], h)) {
    if (Number(v[i][4]) <= ahora) return null;
    if (ahora - Number(v[i][5] || 0) > 600000) { try { hojaOCrea_('Sesiones', COL_SESIONES).getRange(i + 1, 6).setValue(ahora); } catch (e) { /* solo informativo */ } }   // último uso (se actualiza cada 10 min como máximo)
    return { nombre: v[i][1], correo: String(v[i][2]).toLowerCase() };
  }
  return null;
}

/** ÚNICA puerta de entrada de las pantallas: valida el token y ejecuta la función permitida con la identidad del directivo. */
var TOKEN_ACTUAL_ = '';   // token de la llamada en curso (para que cambiarClave deje abierta solo la sesión que la cambia)
function llamarSeguro(token, fn, args) {
  var ses = validarToken_(token);
  if (!ses) throw new Error('SESION_VENCIDA');
  TOKEN_ACTUAL_ = token;
  var out = apiDespachar_(ses.correo, fn, args);
  if (!out.ok) throw new Error(out.error);
  return out.data;
}

/** El directivo cambia su propia clave. p = {actual, nueva} (se ejecuta con su sesión). */
function cambiarClave(p) {
  p = p || {};
  var id = exigirDirectivo_();
  if (!pinValido_(p.nueva)) throw new Error('La clave nueva debe tener 6 números.');
  if (String(p.nueva) === String(p.actual)) throw new Error('La clave nueva debe ser distinta.');
  var d = verificarClave_(id.nombre, p.actual);
  guardarClave_(d, p.nueva);
  /* al cambiar la clave se cierran las demás sesiones abiertas de esa persona (otros teléfonos o computadores): quien tenía la clave anterior sale */
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues(), actual = TOKEN_ACTUAL_ ? hash_(TOKEN_ACTUAL_) : '', cerradas = 0;
  for (var i = v.length - 1; i >= 1; i--) if (v[i][1] === d.v[d.col.nombre] && v[i][0] !== actual) { sh.deleteRow(i + 1); cerradas++; }
  return { ok: true, sesionesCerradas: cerradas };
}
function guardarClave_(d, pin, temporal) {
  var sal = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  d.sh.getRange(d.fila, d.col.pin_sal + 1).setValue(sal);
  d.sh.getRange(d.fila, d.col.pin_hash + 1).setValue(hash_(sal + pin));
  d.sh.getRange(d.fila, d.col.intentos + 1).setValue(0);
  d.sh.getRange(d.fila, d.col.bloqueado_hasta + 1).setValue('');
  d.sh.getRange(d.fila, d.col.clave_temporal + 1).setValue(temporal ? 'SI' : '');
}
function pinAleatorio_() {
  var u = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  return ('00000' + (parseInt(u, 16) % 1000000)).slice(-6);
}

/** Genera una clave nueva para cada directivo (o solo para los que no tienen). Devuelve las claves UNA vez; en la hoja queda solo el hash. */
function generarClavesDirectivos_(soloFaltantes) {
  hojaDirectivos_();
  var out = [];
  datos_('Directivos').forEach(function (x) {
    var d = filaDirectivo_(x.nombre);
    if (soloFaltantes && String(d.v[d.col.pin_hash] || '').trim()) return;
    var pin = pinAleatorio_(); guardarClave_(d, pin, true); out.push({ nombre: x.nombre, pin: pin });
  });
  return out;
}
function generarClavesDirectivos() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi();
  var faltan = datos_('Directivos').filter(function (x) { return !String(x.pin_hash || '').trim(); }).length;
  if (!faltan) { ui.alert('Claves de ingreso', 'Todos los directivos ya tienen clave. Si alguien la olvidó, use "Restablecer la clave de un directivo".', ui.ButtonSet.OK); registrarCorreoPropietario_(); return; }
  var r = ui.alert('Claves de ingreso', 'Se creará una clave TEMPORAL de 6 números para cada directivo que aún no tiene (' + faltan + ') y se mostrará UNA sola vez. Al ingresar por primera vez cada uno elegirá su propia clave. No se tocan las claves ya creadas. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  var cl = generarClavesDirectivos_(true);
  var correoP = registrarCorreoPropietario_();
  ui.alert((correoP ? 'Se registró el correo del propietario (' + correoP + ') para el informe del coordinador académico.\n\n' : '') + 'Anote y entregue a cada persona su clave temporal (no se podrá volver a ver):\n\n' + cl.map(function (x) { return x.nombre + ': ' + x.pin; }).join('\n') +
           '\n\nAl entrar, la aplicación le pedirá elegir su propia clave. Si alguien la olvida: menú "Restablecer la clave de un directivo".');
}

/**
 * Alternativa SIN menú (para ejecutar desde el editor de Apps Script: elegir esta función y pulsar Ejecutar): crea una clave temporal al azar
 * para TODOS los directivos, reemplazando las anteriores, y las escribe en el "Registro de ejecución" del editor (solo lo ve quien administra).
 * Cada directivo debe elegir su clave propia al primer ingreso.
 */
function claveTemporalParaTodosEnRegistro() {
  exigirEditor_();
  var cl = generarClavesDirectivos_(false), correoP = registrarCorreoPropietario_();
  Logger.log('CLAVES TEMPORALES (entréguelas y no las comparta por otro medio):\n' + cl.map(function (x) { return x.nombre + ': ' + x.pin; }).join('\n'));
  return cl;
}

/** Diagnóstico de claves para el administrador (ejecutar desde el editor; solo escribe en el Registro de ejecución, nunca muestra claves). */
function diagnosticoClaves() {
  exigirEditor_();
  hojaDirectivos_();
  var l = [];
  datos_('Directivos').forEach(function (x) {
    var h = String(x.pin_hash || ''), sal = String(x.pin_sal || '');
    l.push(x.nombre + ' · huella ' + (/^[0-9a-f]{64}$/.test(h) ? 'OK' : 'MAL (' + typeof x.pin_hash + ', ' + h.length + ' car.)') + ' · sal ' + (/^[0-9a-f]{64}$/.test(sal) ? 'OK' : 'MAL (' + sal.length + ' car.)') +
      ' · intentos ' + (x.intentos === '' ? 0 : x.intentos) + ' · bloqueado hasta ' + (Number(x.bloqueado_hasta) > ahoraMs_() ? 'SÍ' : 'no') + ' · clave temporal ' + (x.clave_temporal || 'no') + ' · correo_temporal ' + (String(x.correo_temporal || '').trim() ? 'tiene' : 'VACÍO'));
  });
  Logger.log('DIAGNÓSTICO DE CLAVES\n' + l.join('\n'));
}

/** Restablece la clave de UN directivo (solo el propietario del libro): genera una temporal, desbloquea y cierra sus sesiones abiertas. Devuelve la clave una vez. */
function restablecerClave_(nombre, pinElegido) {
  exigirEditor_();
  hojaDirectivos_();
  var d = filaDirectivo_(nombre);
  if (!d) throw new Error('No se encontró a ' + nombre + '.');
  if (pinElegido && !pinValido_(pinElegido)) throw new Error('La clave debe tener 6 números.');
  var pin = pinElegido ? String(pinElegido) : pinAleatorio_(); guardarClave_(d, pin, true);
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (v[i][1] === d.v[d.col.nombre]) sh.deleteRow(i + 1);
  return { nombre: d.v[d.col.nombre], pin: pin };
}
function restablecerClaveDirectivo() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi(), nombres = datos_('Directivos').map(function (x) { return x.nombre; });
  var r = ui.prompt('Restablecer la clave de un directivo', 'Escriba el NÚMERO de la persona:\n\n' + nombres.map(function (n, i) { return (i + 1) + '. ' + n; }).join('\n'), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var n = Number(String(r.getResponseText()).trim());
  if (!(n >= 1 && n <= nombres.length)) { ui.alert('Número no válido.'); return; }
  var r2 = ui.prompt('Clave temporal de ' + nombres[n - 1], 'Escriba la clave temporal de 6 números que quiere asignarle, o deje vacío para que se genere una al azar.', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var elegido = String(r2.getResponseText()).trim();
  var out;
  try { out = restablecerClave_(nombres[n - 1], elegido); } catch (e) { ui.alert(e.message); return; }
  ui.alert('Clave temporal de ' + out.nombre + ': ' + out.pin + '\n\nEntréguesela; al ingresar deberá elegir una clave propia. Se cerraron sus sesiones abiertas.');
}

function correoValido_(c) { c = String(c || '').trim().toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) && !/@example\.com$/.test(c); }

/** El directivo registra su correo (la primera vez que ingresa) y elige qué informes quiere recibir. p = {correo, dia, semana, mes} */
function guardarCorreo(p) {
  p = p || {};
  var id = exigirDirectivo_(), correo = String(p.correo || '').trim().toLowerCase();
  if (!correoValido_(correo)) throw new Error('Escriba un correo válido.');
  var d = filaDirectivo_(id.nombre);
  if (!d) throw new Error('No se encontró su registro.');
  var c = d.col, si = function (v) { return v === false || v === 'NO' ? 'NO' : 'SI'; };
  d.sh.getRange(d.fila, c.correo + 1).setValue(correo);
  d.sh.getRange(d.fila, c.informe_dia + 1).setValue(si(p.dia));
  d.sh.getRange(d.fila, c.informe_semana + 1).setValue(si(p.semana));
  d.sh.getRange(d.fila, c.informe_mes + 1).setValue(si(p.mes));
  return { ok: true };
}
/** Datos del correo del directivo que ingresó (para la pantalla de inicio). */
function estadoCorreo_(id) {
  hojaDirectivos_();
  var d = filaDirectivo_(id.nombre);
  if (!d) return { necesitaCorreo: false };
  var v = d.v, c = d.col, correo = String(v[c.correo] || '').trim();
  return { debeCambiar: String(v[c.clave_temporal] || '') === 'SI', necesitaCorreo: !correo, correo: correo, informes: { dia: String(v[c.informe_dia]) !== 'NO', semana: String(v[c.informe_semana]) !== 'NO', mes: String(v[c.informe_mes]) !== 'NO' } };
}
/** El propietario del libro es el coordinador académico: su correo se registra solo (a los demás se les pide al ingresar). */
function registrarCorreoPropietario_() {
  var dueno = '';
  try { dueno = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { /* sin dato */ }
  if (!dueno) return '';
  hojaDirectivos_();
  var fila = datos_('Directivos').filter(function (x) { return /acad[eé]mico/i.test(String(x.rol)) && !String(x.correo || '').trim(); })[0];
  if (!fila) return '';
  var d = filaDirectivo_(fila.nombre);
  d.sh.getRange(d.fila, d.col.correo + 1).setValue(dueno);
  return dueno;
}

/** Menú: quién tiene sesiones abiertas (por directivo: cuántas, desde cuándo y último uso). Sirve para detectar si alguien usa la sesión de otra persona. */
function verSesionesAbiertas() {
  exigirEditor_();
  var v = hojaOCrea_('Sesiones', COL_SESIONES).getDataRange().getValues(), ahora = ahoraMs_(), por = {};
  for (var i = 1; i < v.length; i++) {
    if (Number(v[i][4]) <= ahora) continue;
    var o = por[v[i][1]] = por[v[i][1]] || { n: 0, desde: Infinity, uso: 0 };
    o.n++; o.desde = Math.min(o.desde, Number(v[i][3])); o.uso = Math.max(o.uso, Number(v[i][5]) || 0);
  }
  var f = function (ms) { return ms && isFinite(ms) ? Utilities.formatDate(new Date(ms), TZ, 'dd/MM HH:mm') : '—'; };
  var txt = Object.keys(por).map(function (n) { return n + ': ' + por[n].n + ' sesión(es) abierta(s) · la más antigua desde ' + f(por[n].desde) + ' · último uso ' + f(por[n].uso); }).join('\n') || 'No hay sesiones abiertas.';
  var ui = SpreadsheetApp.getUi();
  ui.alert('Sesiones abiertas', txt + '\n\nSi alguien tiene más sesiones de las que usa (por ejemplo otra persona con su usuario), restablezca su clave: «Restablecer la clave de un directivo» cierra todas sus sesiones.', ui.ButtonSet.OK);
}

/* ======================================================================================================================
 * Docentes con clave (sin cuenta de Google). Autor del sistema: Francisco Javier Cortés Cabezas.
 *  - Pantalla de ingreso: la persona elige el GRADO que atiende y de ese grado se muestran sus docentes (más orientación y tutoría, que
 *    trabajan con todos); elige su nombre, escribe un correo de contacto (cualquiera, no tiene que ser de Google) y su clave.
 *  - Primera vez: la clave es su número de cédula (hoja reservada Identidad_Docentes: docente, cedula). Al entrar elige una clave propia (6 a 12 números).
 *  - Si la olvida: coordinación la restablece desde el menú del libro (vuelve a su cédula o a la temporal que se escriba).
 *  - 5 intentos fallidos bloquean 15 minutos. Todo se guarda con sal y hash (hoja Claves_Docentes); la cédula nunca viaja a las pantallas.
 *  - Internamente cada docente tiene un correo interno (docNN@docente.icet.local) con una fila en Usuarios: el resto del sistema (permisos de
 *    rol docente, soportes, comisiones) funciona igual y NO ve nada de rondas ni de directivos.
 * ====================================================================================================================== */
var COL_CLAVES_DOC = ['docente', 'pin_hash', 'pin_sal', 'intentos', 'bloqueado_hasta', 'clave_temporal', 'correo_interno', 'creada', 'correo_contacto'];
var COL_IDENTIDAD_DOC = ['docente', 'cedula'];
var DOMINIO_DOC = '@docente.icet.local';
function sinTildesDoc_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function claveDocValida_(pin) { return /^\d{6,12}$/.test(String(pin)); }
function docentesParaClave_() { return datos_('Docentes').filter(function (d) { return d.nivel !== 'REEMPLAZADO' && d.nombre_completo; }); }
function docenteExacto_(nombre) { var n = sinTildesDoc_(nombre); return docentesParaClave_().filter(function (d) { return sinTildesDoc_(d.nombre_completo) === n; })[0] || null; }
function hojaClavesDoc_() { return hojaOCrea_('Claves_Docentes', COL_CLAVES_DOC); }
function filaClaveDoc_(nombre) {
  var sh = hojaClavesDoc_(), v = sh.getDataRange().getValues(), cab = v[0], col = {};
  COL_CLAVES_DOC.forEach(function (k) { if (cab.indexOf(k) < 0) { sh.getRange(1, cab.length + 1).setValue(k); cab.push(k); v[0] = cab; } });
  cab.forEach(function (k, i) { col[k] = i; });
  for (var i = 1; i < v.length; i++) if (sinTildesDoc_(v[i][col.docente]) === sinTildesDoc_(nombre)) return { sh: sh, fila: i + 1, v: v[i], col: col };
  return null;
}
function correoInternoDoc_(d) { return 'doc' + String(d.n || sinTildesDoc_(d.nombre_completo).replace(/[^A-Z0-9]/g, '').slice(0, 12)).toLowerCase() + DOMINIO_DOC; }
function esCorreoInternoDoc_(e) { return String(e || '').toLowerCase().slice(-DOMINIO_DOC.length) === DOMINIO_DOC; }
function cedulaDoc_(nombre) {
  var f = datosOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC).filter(function (x) { return sinTildesDoc_(x.docente) === sinTildesDoc_(nombre); })[0];
  return f ? String(f.cedula == null ? '' : f.cedula).replace(/\D/g, '') : '';
}
function asegurarUsuarioDoc_(d, correo) {
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).toLowerCase() === correo) { if (v[i][2] !== 'ACTIVO') sh.getRange(i + 1, 3).setValue('ACTIVO'); return; }
  sh.appendRow([correo, d.nombre_completo, 'ACTIVO', ahoraTxt_(), '', '', '', 'clave', '']);
}
/** Grados para la pantalla de ingreso: [{codigo, etiqueta}] en orden. */
function listarGradosPublicos() {
  var visto = {}, out = [];
  datos_('Grupos').forEach(function (g) {
    var c = partesGrupo_(g.grupo).grado; if (c === 'N/A' || c === 'ORI' || c === 'PTA' || visto[c]) return; visto[c] = 1;
    out.push({ codigo: c, etiqueta: /^CS/.test(c) ? 'Caminar en Secundaria ' + c.slice(2) : c === '00' ? 'Preescolar (0°)' : Number(c) + '°' + (Number(c) <= 5 ? ' (primaria)' : '') });
  });
  return out.sort(function (a, b) { var x = /^CS/.test(a.codigo) ? 100 + Number(a.codigo.slice(2)) : Number(a.codigo), y = /^CS/.test(b.codigo) ? 100 + Number(b.codigo.slice(2)) : Number(b.codigo); return x - y; });
}
/** Nombres de los docentes de un grado (dirección de grupo y horario) más orientación y tutoría. */
function docentesDelGrado_(grado) {
  var nom = {};
  datos_('Direccion_Grupo').forEach(function (d) { if (partesGrupo_(d.grupo).grado === grado) [d.docente_1, d.docente_2].forEach(function (n) { if (n) nom[sinTildesDoc_(n)] = 1; }); });
  datos_('Horario').forEach(function (h) { if (h.docente && partesGrupo_(h.grupo).grado === grado) nom[sinTildesDoc_(h.docente)] = 1; });
  return docentesParaClave_().filter(function (d) { return nom[sinTildesDoc_(d.nombre_completo)] || /ORIENTACI|TUTORA|PTAFI/i.test(String(d.nivel)); });
}
/** Docentes del grado elegido para la pantalla de ingreso (solo nombres y si ya tienen clave propia). */
function listarDocentesPublicos(grado) {
  hojaClavesDoc_();
  var con = {}; datos_('Claves_Docentes').forEach(function (c) { if (String(c.pin_hash || '').trim() && String(c.clave_temporal || '') !== 'SI') con[sinTildesDoc_(c.docente)] = 1; });
  var lista = grado ? docentesDelGrado_(String(grado)) : docentesParaClave_();
  return lista.map(function (d) { return { nombre: d.nombre_completo, tieneClave: !!con[sinTildesDoc_(d.nombre_completo)] }; })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
}
function verificarClaveDoc_(nombre, pin) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var doc = docenteExacto_(nombre); if (!doc) throw new Error('Nombre o clave incorrectos.');
    var d = filaClaveDoc_(doc.nombre_completo);
    if (!d) { hojaClavesDoc_().appendRow([doc.nombre_completo, '', '', 0, '', '', correoInternoDoc_(doc), ahoraTxt_(), '']); d = filaClaveDoc_(doc.nombre_completo); }
    var c = d.col, bloq = Number(d.v[c.bloqueado_hasta]) || 0;
    if (bloq > ahoraMs_()) throw new Error('Demasiados intentos. Espere unos minutos e intente de nuevo.');
    var ok = false, primera = false;
    if (String(d.v[c.pin_hash] || '').trim()) ok = /^\d{4,12}$/.test(String(pin)) && igualConstante_(hash_(d.v[c.pin_sal] + pin), d.v[c.pin_hash]);
    else {   // primera vez: la clave es la cédula registrada por coordinación
      var ced = cedulaDoc_(doc.nombre_completo);
      if (!ced) throw new Error('Coordinación aún no registró su cédula. Avise a coordinación.');
      ok = igualConstante_(String(pin).replace(/\D/g, ''), ced); primera = ok;
    }
    if (!ok) {
      var n = (Number(d.v[c.intentos]) || 0) + 1;
      d.sh.getRange(d.fila, c.intentos + 1).setValue(n >= PIN_INTENTOS ? 0 : n);
      if (n >= PIN_INTENTOS) d.sh.getRange(d.fila, c.bloqueado_hasta + 1).setValue(ahoraMs_() + BLOQUEO_MIN * 60000);
      throw new Error(n >= PIN_INTENTOS ? 'Demasiados intentos. Espere ' + BLOQUEO_MIN + ' minutos.' : 'Nombre o clave incorrectos.');
    }
    d.sh.getRange(d.fila, c.intentos + 1).setValue(0);
    if (primera) guardarClaveDoc_(d, String(pin).replace(/\D/g, ''), true);   // queda como temporal: debe elegir la suya
    return { d: d, doc: doc, temp: primera || String(d.v[c.clave_temporal] || '') === 'SI' };
  } finally { lock.releaseLock(); }
}
function guardarClaveDoc_(d, pin, temporal) {
  var sal = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  d.sh.getRange(d.fila, d.col.pin_sal + 1).setValue(sal);
  d.sh.getRange(d.fila, d.col.pin_hash + 1).setValue(hash_(sal + pin));
  d.sh.getRange(d.fila, d.col.intentos + 1).setValue(0);
  d.sh.getRange(d.fila, d.col.bloqueado_hasta + 1).setValue('');
  d.sh.getRange(d.fila, d.col.clave_temporal + 1).setValue(temporal ? 'SI' : '');
}
function abrirSesionDoc_(nombre, correo, debeCambiar) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var ahora = ahoraMs_(), sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (Number(v[i][4]) < ahora) sh.deleteRow(i + 1);
  sh.appendRow([hash_(token), nombre, correo, ahora, ahora + SESION_DIAS * 86400000, ahora]);
  return { token: token, nombre: nombre, rol: 'docente', debeCambiar: !!debeCambiar };
}
var DOMINIOS_ERRATA_ = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmil.com': 'gmail.com', 'gmail.cm': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hormail.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahoo.es.com': 'yahoo.es', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com' };
/** Revisa un correo lo mejor posible sin poder verificarlo: forma válida, sin errores comunes de escritura. Devuelve {ok, correo, msg}. */
function correoRevisar_(e) {
  var c = String(e == null ? '' : e).trim().toLowerCase().replace(/\s+/g, '');
  if (!c) return { ok: false, correo: '', msg: 'Escriba su correo electrónico.' };
  if (c.length > 254 || !/^[a-z0-9._%+\-]{1,64}@([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(c) || /\.\./.test(c) || /^\.|\.@|@\.|@-/.test(c)) return { ok: false, correo: c, msg: 'El correo no es válido. Debe verse así: nombre@gmail.com' };
  var dom = c.split('@')[1];
  if (DOMINIOS_ERRATA_[dom]) return { ok: false, correo: c, msg: '¿Quiso escribir ' + c.split('@')[0] + '@' + DOMINIOS_ERRATA_[dom] + '?' };
  return { ok: true, correo: c, msg: '' };
}
function correoValidoDoc_(e) { return correoRevisar_(e).ok; }
/** Ingreso de un docente. p = {nombre, pin, correo (la primera vez, cualquier proveedor)}. */
function ingresarDocente(p) {
  p = p || {};
  var r = verificarClaveDoc_(p.nombre, p.pin), d = r.d, doc = r.doc, correo = correoInternoDoc_(doc);
  var rc = correoRevisar_(p.correo), sinCorreo = !String(d.v[d.col.correo_contacto] || '').trim();
  if (rc.ok) d.sh.getRange(d.fila, d.col.correo_contacto + 1).setValue(rc.correo);
  else if (r.temp && sinCorreo) throw new Error(rc.msg);   // la primera vez el correo es obligatorio y debe verse válido
  asegurarUsuarioDoc_(doc, correo);
  return abrirSesionDoc_(doc.nombre_completo, correo, r.temp);
}
/** El docente cambia su propia clave. p = {actual, nueva}. Sirve también para reemplazar la clave inicial (la cédula). */
function cambiarClaveDocente(p) {
  p = p || {};
  var id = identidad_();
  if (id.rol !== 'docente' || !esCorreoInternoDoc_(id.email)) throw new Error('Solo un docente que entró con clave puede cambiarla aquí.');
  if (!claveDocValida_(p.nueva)) throw new Error('La clave nueva debe tener de 6 a 12 números.');
  if (String(p.nueva) === String(p.actual)) throw new Error('La clave nueva debe ser distinta.');
  var r = verificarClaveDoc_(id.docente, p.actual);
  guardarClaveDoc_(r.d, String(p.nueva), false);
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues(), actual = TOKEN_ACTUAL_ ? hash_(TOKEN_ACTUAL_) : '', cerradas = 0;
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][2]).toLowerCase() === id.email && v[i][0] !== actual) { sh.deleteRow(i + 1); cerradas++; }
  return { ok: true, sesionesCerradas: cerradas };
}
/** ¿Esta persona (docente con clave) debe elegir una clave nueva? Lo usa contextoPanel. */
function docenteDebeCambiarClave_(id) {
  if (!id || id.rol !== 'docente' || !esCorreoInternoDoc_(id.email)) return false;
  var d = filaClaveDoc_(id.docente);
  return !!(d && String(d.v[d.col.clave_temporal] || '') === 'SI');
}
/** Coordinación: restablece la clave de un docente (vuelve a su cédula, o a la temporal que se escriba) y cierra sus sesiones. */
function restablecerClaveDocente_(nombre, pinElegido) {
  exigirEditor_();
  var doc = docenteExacto_(nombre); if (!doc) throw new Error('No se encontró a ' + nombre + '.');
  var pin = String(pinElegido || '').trim() || cedulaDoc_(doc.nombre_completo);
  if (!pin) throw new Error('Esa persona no tiene cédula registrada en la hoja Identidad_Docentes: escriba una clave temporal de 6 a 12 números.');
  if (!claveDocValida_(pin)) throw new Error('La clave temporal debe tener de 6 a 12 números.');
  var correo = correoInternoDoc_(doc), d = filaClaveDoc_(doc.nombre_completo);
  if (!d) { hojaClavesDoc_().appendRow([doc.nombre_completo, '', '', 0, '', '', correo, ahoraTxt_(), '']); d = filaClaveDoc_(doc.nombre_completo); }
  guardarClaveDoc_(d, pin, true); asegurarUsuarioDoc_(doc, correo);
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][2]).toLowerCase() === correo) sh.deleteRow(i + 1);
  return { nombre: doc.nombre_completo, pin: pin, esCedula: !pinElegido };
}
function restablecerClaveDocente() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('Restablecer la clave de un docente', 'Escriba el apellido o parte del nombre del docente:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var q = sinTildesDoc_(r.getResponseText()); if (!q) return;
  var hall = docentesParaClave_().filter(function (d) { return sinTildesDoc_(d.nombre_completo).indexOf(q) >= 0; });
  if (!hall.length) { ui.alert('No encontré a nadie con «' + r.getResponseText() + '».'); return; }
  var elegido = hall[0];
  if (hall.length > 1) {
    var r1 = ui.prompt('Varios docentes', 'Escriba el NÚMERO:\n\n' + hall.slice(0, 15).map(function (d, i) { return (i + 1) + '. ' + d.nombre_completo; }).join('\n'), ui.ButtonSet.OK_CANCEL);
    if (r1.getSelectedButton() !== ui.Button.OK) return;
    var n = Number(String(r1.getResponseText()).trim()); if (!(n >= 1 && n <= Math.min(15, hall.length))) { ui.alert('Número no válido.'); return; }
    elegido = hall[n - 1];
  }
  var r2 = ui.prompt('Clave de ' + elegido.nombre_completo, 'Deje vacío para que la clave vuelva a ser su número de cédula, o escriba una clave temporal de 6 a 12 números.', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var out; try { out = restablecerClaveDocente_(elegido.nombre_completo, String(r2.getResponseText()).trim()); } catch (e) { ui.alert(e.message); return; }
  ui.alert(out.nombre + ': ' + (out.esCedula ? 'su clave volvió a ser su número de cédula.' : 'clave temporal ' + out.pin + '.') + '\n\nAl ingresar deberá elegir una clave propia. Se cerraron sus sesiones abiertas.');
}
function verDocentesActivos() {
  exigirEditor_();
  var act = {}; datos_('Claves_Docentes').forEach(function (c) { if (String(c.pin_hash || '').trim() && String(c.clave_temporal || '') !== 'SI') act[sinTildesDoc_(c.docente)] = 1; });
  var todos = docentesParaClave_(), faltan = todos.filter(function (d) { return !act[sinTildesDoc_(d.nombre_completo)]; }),
      sinCed = todos.filter(function (d) { return !cedulaDoc_(d.nombre_completo); });
  SpreadsheetApp.getUi().alert('Docentes con clave propia: ' + (todos.length - faltan.length) + ' de ' + todos.length + '\n\nFaltan por entrar y elegir su clave:\n' + (faltan.map(function (d) { return '· ' + d.nombre_completo; }).join('\n') || 'ninguno') +
    (sinCed.length ? '\n\nSin cédula en la hoja Identidad_Docentes (no podrán entrar la primera vez):\n' + sinCed.map(function (d) { return '· ' + d.nombre_completo; }).join('\n') : ''));
}


/* ------------------------------ coordinación: agregar o editar docentes y sus datos ------------------------------ */
var NIVELES_DOC = ['SECUNDARIA', 'PRIMARIA', 'PREESCOLAR', 'ORIENTACIÓN', 'TUTORA PTAFI', 'REEMPLAZADO'];
function exigirAdminDocentes_() {
  var id = identidad_();
  if (id.rol !== 'directivo' || !puedeAdministrar_(id)) throw new Error('Solo coordinación académica o quien administra puede ver y editar los datos de los docentes.');
  return id;
}
function listarDocentesAdmin() {
  exigirAdminDocentes_();
  return datos_('Docentes').map(function (d) {
    return { n: d.n, nombre_completo: d.nombre_completo, apellidos: d.apellidos, nombres: d.nombres, nivel: d.nivel, direccion_grupo: d.direccion_grupo || '', areas: d.areas || '', nota: d.nota || '',
      cedula: cedulaDoc_(d.nombre_completo) ? 'sí' : '', correo: (typeof comisionCorreoDe_ === 'function' ? comisionCorreoDe_(d.nombre_completo) : '') };
  }).sort(function (a, b) { return String(a.nombre_completo).localeCompare(String(b.nombre_completo), 'es'); });
}
function celdaPorNombre_(sh, fila, cab, nombre, valor) { var i = cab.indexOf(nombre); if (i >= 0) sh.getRange(fila, i + 1).setValue(valor); }
/** p = {actual (nombre completo si edita; vacío si es nuevo), apellidos, nombres, nivel, direccion_grupo, areas, cedula, correo, nota}. */
function guardarDocenteAdmin(p) {
  var id = exigirAdminDocentes_(); p = p || {};
  var sh = hoja_('Docentes'), v = sh.getDataRange().getValues(), cab = v[0], ap = String(p.apellidos || '').trim().replace(/\s+/g, ' '), nm = String(p.nombres || '').trim().replace(/\s+/g, ' ');
  if (!ap || !nm) throw new Error('Escriba los apellidos y los nombres.');
  var nivel = String(p.nivel || 'SECUNDARIA').toUpperCase(); if (NIVELES_DOC.indexOf(nivel) < 0) throw new Error('Elija el nivel.');
  var ced = String(p.cedula || '').replace(/\D/g, ''); if (ced && !/^\d{5,12}$/.test(ced)) throw new Error('La cédula debe tener entre 5 y 12 números.');
  var mail = String(p.correo || '').trim(), rc = mail ? correoRevisar_(mail) : { ok: true, correo: '' }; if (!rc.ok) throw new Error(rc.msg);
  var completo = (ap + ' ' + nm).trim(), colN = cab.indexOf('nombre_completo'), colNum = cab.indexOf('n'), fila = 0, maxN = 0, actual = String(p.actual || '').trim();
  for (var i = 1; i < v.length; i++) {
    maxN = Math.max(maxN, Number(v[i][colNum]) || 0);
    if (actual && sinTildesDoc_(v[i][colN]) === sinTildesDoc_(actual)) fila = i + 1;
    else if (sinTildesDoc_(v[i][colN]) === sinTildesDoc_(completo) && (!actual || sinTildesDoc_(actual) !== sinTildesDoc_(completo))) throw new Error('Ya existe un docente con ese nombre.');
  }
  if (actual && !fila) throw new Error('No se encontró al docente que se quiere editar.');
  if (!fila) {
    var n = maxN + 1, nueva = cab.map(function (c) { return ''; });
    var set = { codigo: 'D' + ('00' + n).slice(-3), n: n, apellidos: ap, nombres: nm, nombre_completo: completo, nivel: nivel, direccion_grupo: String(p.direccion_grupo || ''), areas: String(p.areas || ''), tiene_horario: 'NO', nota: String(p.nota || '') };
    Object.keys(set).forEach(function (k) { var j = cab.indexOf(k); if (j >= 0) nueva[j] = set[k]; });
    sh.appendRow(nueva);
  } else {
    var nuevo = { apellidos: ap, nombres: nm, nombre_completo: completo, nivel: nivel, direccion_grupo: String(p.direccion_grupo || ''), areas: String(p.areas || ''), nota: String(p.nota || '') };
    Object.keys(nuevo).forEach(function (k) { celdaPorNombre_(sh, fila, cab, k, nuevo[k]); });
  }
  if (ced) {
    var hi = hojaOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC), vi = hi.getDataRange().getValues(), fi = 0, base = actual || completo;
    for (var k = 1; k < vi.length; k++) if (sinTildesDoc_(vi[k][0]) === sinTildesDoc_(base)) fi = k + 1;
    if (fi) { hi.getRange(fi, 1).setValue(completo); hi.getRange(fi, 2).setValue(ced); } else hi.appendRow([completo, ced]);
  }
  if (rc.correo) {
    var d = filaClaveDoc_(completo) || filaClaveDoc_(actual || completo);
    if (!d) { hojaClavesDoc_().appendRow([completo, '', '', 0, '', '', '', ahoraTxt_(), rc.correo]); }
    else d.sh.getRange(d.fila, d.col.correo_contacto + 1).setValue(rc.correo);
  }
  try { invalidarCache_('Docentes'); } catch (e) { /* sin caché */ }
  try { bitacora_(fila ? 'Docente editado' : 'Docente agregado', completo + ' · por ' + (id.nombre || id.email)); } catch (e) { /* solo informativo */ }
  return { ok: true, nombre: completo, nuevo: !fila, aviso: !fila ? 'Se agregó sin horario (tiene_horario = NO). Cuando cargue su horario en la hoja Horario, cambie esa columna a SI.' : '' };
}
