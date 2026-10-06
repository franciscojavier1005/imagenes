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
var COL_CLAVE = ['pin_hash', 'pin_sal', 'intentos', 'bloqueado_hasta', 'correo', 'informe_dia', 'informe_semana', 'informe_mes', 'clave_temporal'];
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
  return datos_('Directivos').map(function (d) { return { nombre: d.nombre, rol: d.rol, tieneClave: !!String(d.pin_hash || '').trim() }; });
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
  for (var i = 1; i < v.length; i++) if (igualConstante_(v[i][0], h)) return Number(v[i][4]) > ahora ? { nombre: v[i][1], correo: String(v[i][2]).toLowerCase() } : null;
  return null;
}

/** ÚNICA puerta de entrada de las pantallas: valida el token y ejecuta la función permitida con la identidad del directivo. */
function llamarSeguro(token, fn, args) {
  var ses = validarToken_(token);
  if (!ses) throw new Error('SESION_VENCIDA');
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
  return { ok: true };
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

/** Restablece la clave de UN directivo (solo el propietario del libro): genera una temporal, desbloquea y cierra sus sesiones abiertas. Devuelve la clave una vez. */
function restablecerClave_(nombre) {
  exigirEditor_();
  hojaDirectivos_();
  var d = filaDirectivo_(nombre);
  if (!d) throw new Error('No se encontró a ' + nombre + '.');
  var pin = pinAleatorio_(); guardarClave_(d, pin, true);
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
  var out = restablecerClave_(nombres[n - 1]);
  ui.alert('Clave temporal de ' + out.nombre + ': ' + out.pin + '\n\nEntréguesela; al ingresar deberá elegir una clave propia. Se cerraron sus sesiones abiertas.');
}

/** El directivo registra su correo (la primera vez que ingresa) y elige qué informes quiere recibir. p = {correo, dia, semana, mes} */
function guardarCorreo(p) {
  p = p || {};
  var id = exigirDirectivo_(), correo = String(p.correo || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || /@example\.com$/.test(correo)) throw new Error('Escriba un correo válido.');
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
