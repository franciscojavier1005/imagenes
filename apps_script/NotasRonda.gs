/**
 * Observación de la ronda (voz o texto). Al terminar la ronda el directivo dicta o graba una observación; el sistema la analiza
 * (Notas.gs) y deja PROPUESTAS de novedades en la hoja Bandeja_WhatsApp (origen "Nota de ronda"). Nada pasa a Novedades hasta que
 * un directivo confirma cada propuesta. El audio, si se guarda, va a una subcarpeta PRIVADA de Drive y se borra a los
 * audio_conservar_dias días (parámetro, por defecto 30). No grabe a estudiantes ni datos de salud más allá de lo necesario.
 */
var COL_NOTAS = ['id', 'fecha_registro', 'fecha', 'directivo', 'sesion', 'texto', 'audio_id', 'audio_url', 'duracion_seg', 'propuestas'];
var COL_BANDEJA = ['fecha', 'hora', 'remitente', 'docente', 'tipo_novedad', 'motivo', 'categoria', 'justificada', 'confianza', 'mensaje', 'confirmar', 'importado',
                   'id', 'origen', 'sesion', 'grupo'];
var MIME_AUDIO = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a', 'audio/3gpp': '3gp' };
var MAX_BYTES_AUDIO = 8 * 1024 * 1024;
var ORIGEN_NOTA = 'Nota de ronda';

/** La hoja Bandeja_WhatsApp de libros anteriores no tiene las columnas nuevas: se agregan al final. */
function bandeja_() {
  var sh = hojaOCrea_('Bandeja_WhatsApp', COL_BANDEJA), cab = sh.getDataRange().getValues()[0];
  COL_BANDEJA.forEach(function (c) { if (cab.indexOf(c) < 0) { sh.getRange(1, cab.length + 1).setValue(c); cab.push(c); } });
  return sh;
}

function carpetaAudios_() {
  var raiz = carpetaRaiz_(), it = raiz.getFoldersByName('Audios de ronda');
  return it.hasNext() ? it.next() : raiz.createFolder('Audios de ronda');
}

function contextoNota_(texto, fecha) {
  return {
    texto: texto, fecha: fecha, docentes: datos_('Docentes'), grupos: datos_('Grupos'), franjas: datos_('Franjas'),
    horario: datos_('Horario').map(function (h) { return { docente: h.docente, dia: h.dia, hora: h.hora, tipo: h.tipo, grupo: h.grupo, grupos_enfasis: h.grupos_enfasis }; })
  };
}

/**
 * Guarda la observación y devuelve las propuestas.
 * p = {fecha?, sesion?, texto, mime?, base64?, duracion?}   (texto: dictado o transcripción; puede venir vacío si solo hay audio)
 */
function guardarNotaRonda(p) {
  var id = identidad_();
  if (id.rol !== 'directivo') throw new Error('Solo un directivo puede registrar observaciones de la ronda.');
  p = p || {};
  var texto = String(p.texto || '').trim().slice(0, 4000);
  if (!texto && !p.base64) throw new Error('Escriba, dicte o grabe la observación.');
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  var audioId = '', audioUrl = '';
  if (p.base64) {
    var ext = MIME_AUDIO[String(p.mime || '').split(';')[0]];
    if (!ext) throw new Error('Formato de audio no permitido.');
    var bytes = Utilities.base64Decode(String(p.base64));
    if (!bytes.length) throw new Error('El audio está vacío.');
    if (bytes.length > MAX_BYTES_AUDIO) throw new Error('El audio supera ' + (MAX_BYTES_AUDIO / 1048576) + ' MB.');
    var archivo = carpetaAudios_().createFile(Utilities.newBlob(bytes, String(p.mime).split(';')[0], 'ronda_' + fecha + '_' + ahoraTxt_().replace(/[^0-9]/g, '') + '.' + ext));
    try { archivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) { /* ya es privado */ }
    audioId = archivo.getId(); audioUrl = archivo.getUrl();
  }
  var nid = Utilities.getUuid(), quien = id.nombre || id.email, props = [];
  if (texto) {
    var a = analizarNota_(contextoNota_(texto, fecha));
    var sh = bandeja_(), cab = sh.getDataRange().getValues()[0], hora = Utilities.formatDate(new Date(), TZ, 'HH:mm');
    a.propuestas.forEach(function (x, i) {
      var pid = nid + '-' + (i + 1), fila = [];
      var v = { fecha: fecha, hora: hora, remitente: quien, docente: x.docente, tipo_novedad: x.tipo_novedad, motivo: x.motivo, categoria: x.categoria,
                justificada: x.justificada === 'Sí' ? 'Sí' : 'No', confianza: x.confianza, mensaje: x.mensaje, confirmar: '', importado: '', id: pid, origen: ORIGEN_NOTA,
                sesion: x.sesion || '', grupo: textoCod_(x.grupo || '') };
      cab.forEach(function (c) { fila.push(v[c] === undefined ? '' : v[c]); });
      sh.appendRow(fila); props.push(Object.assign({ id: pid }, v));
    });
  }
  hojaOCrea_('Notas_Ronda', COL_NOTAS).appendRow([nid, ahoraTxt_(), fecha, quien, p.sesion || '', texto, audioId, audioUrl, Number(p.duracion) || '', props.length]);
  return { id: nid, propuestas: props, audioGuardado: !!audioId };
}

/** Propuestas de notas de ronda pendientes (sin confirmar ni descartar). */
function listarPropuestas() {
  var sh = bandeja_(), v = sh.getDataRange().getValues(), cab = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    var o = {}; cab.forEach(function (c, j) { o[c] = v[i][j]; });
    if (o.origen !== ORIGEN_NOTA || String(o.confirmar).trim() || String(o.importado).trim()) continue;
    o.fecha = fechaIso_(o.fecha); delete o.confirmar; delete o.importado;
    out.push(o);
  }
  return { propuestas: out, docentes: datos_('Docentes').filter(function (d) { return d.tiene_horario === 'SI'; }).map(function (d) { return d.nombre_completo; }),
           motivos: datos_('Motivos').map(function (m) { return m.motivo; }) };
}

/** p = {id, accion: 'confirmar'|'descartar', docente?, motivo?}. Al confirmar pasa a Novedades con el mismo importador de WhatsApp. */
function resolverPropuesta(p) {
  var id = identidad_();
  if (id.rol !== 'directivo') throw new Error('Solo un directivo puede resolver propuestas.');
  p = p || {};
  if (['confirmar', 'descartar'].indexOf(p.accion) < 0) throw new Error('Acción no válida.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = bandeja_(), v = sh.getDataRange().getValues(), col = {};
    v[0].forEach(function (k, i) { col[k] = i; });
    var fila = -1;
    for (var i = 1; i < v.length; i++) if (v[i][col.id] === p.id) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la propuesta.');
    if (String(v[fila][col.importado]).trim() || String(v[fila][col.confirmar]).trim()) throw new Error('Esa propuesta ya fue resuelta.');
    if (p.accion === 'descartar') { sh.getRange(fila + 1, col.confirmar + 1).setValue('NO'); return { estado: 'descartada' }; }
    var docentes = datos_('Docentes').map(function (d) { return d.nombre_completo; });
    var doc = p.docente ? String(p.docente) : String(v[fila][col.docente]);
    if (docentes.indexOf(doc) < 0) throw new Error('Elija el docente.');
    sh.getRange(fila + 1, col.docente + 1).setValue(doc);
    if (p.motivo) {
      var mot = datos_('Motivos').filter(function (m) { return m.motivo === p.motivo; })[0];
      if (!mot) throw new Error('Motivo no válido.');
      sh.getRange(fila + 1, col.motivo + 1).setValue(p.motivo);
      sh.getRange(fila + 1, col.categoria + 1).setValue(mot.categoria);
    }
    sh.getRange(fila + 1, col.confirmar + 1).setValue('SI');
    var r = importarBandeja_();
    var estado = sh.getDataRange().getValues()[fila][col.importado];
    return { estado: estado === 'SI' ? 'registrada' : (estado === 'DUPLICADO' ? 'ya estaba registrada' : 'pendiente'), resumen: r };
  } finally { lock.releaseLock(); }
}

/** Borra los audios más antiguos que audio_conservar_dias (por defecto 30). Se puede programar o ejecutar desde el menú. */
function purgarAudios_(ahora) {
  var dias = Number(parametro_('audio_conservar_dias', '30')) || 30, limite = (ahora || new Date()).getTime() - dias * 86400000, n = 0;
  var sh = SpreadsheetApp.getActive().getSheetByName('Notas_Ronda');
  if (!sh) return 0;
  var v = sh.getDataRange().getValues(), cab = v[0], iA = cab.indexOf('audio_id'), iU = cab.indexOf('audio_url'), iF = cab.indexOf('fecha_registro');
  for (var i = 1; i < v.length; i++) {
    if (!v[i][iA]) continue;
    var t = new Date(String(v[i][iF]).replace(' ', 'T') + ':00-05:00').getTime();
    if (isNaN(t) || t > limite) continue;
    try { DriveApp.getFileById(v[i][iA]).setTrashed(true); } catch (e) { /* ya no existe */ }
    sh.getRange(i + 1, iA + 1).setValue(''); sh.getRange(i + 1, iU + 1).setValue('(borrado por retención)'); n++;
  }
  return n;
}
function purgarAudios() { var n = purgarAudios_(); SpreadsheetApp.getUi().alert('Audios borrados por retención: ' + n); }
