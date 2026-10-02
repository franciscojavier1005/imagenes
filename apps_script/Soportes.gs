/**
 * Carga y revisión de soportes de las ausencias (incapacidades, citas, actas, epicrisis, etc.).
 *
 * Los archivos van a una carpeta de Drive PRIVADA del propietario (subcarpeta por docente); solo los directivos con acceso a esa carpeta
 * los abren. El docente nunca ve archivos de otros ni los suyos después de cargarlos: ve el estado (Entregado, Aceptado, Rechazado...).
 * Plazos y estados: ver Plazos.gs.
 */
var COL_SOPORTES = ['id', 'fecha_carga', 'docente', 'clave', 'inicio', 'fin', 'motivo_declarado', 'tipo_documento', 'archivo_id', 'archivo_url',
                    'estado', 'extemporaneo', 'comentario', 'revisado_por', 'fecha_revision', 'observacion_revision'];
var MIME_SOPORTES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
var MAX_BYTES_SOPORTE = 8 * 1024 * 1024;

/* ------------------------------ parámetros (hoja Parametros) ------------------------------ */
function parametro_(clave, defecto) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Parametros');
  if (!sh) return defecto;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === clave && v[i][1] !== '' && v[i][1] != null) return v[i][1] instanceof Date ? ymd_(v[i][1]) : String(v[i][1]);
  return defecto;
}
function guardarParametro_(clave, valor) {
  var sh = hojaOCrea_('Parametros', ['clave', 'valor']), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === clave) { sh.getRange(i + 1, 2).setValue(valor); return; }
  sh.appendRow([clave, valor]);
}
/** Las ausencias anteriores a esta fecha no generan obligación de soporte (evita que lo anterior aparezca como vencido). */
function soportesDesde_() { return fechaIso_(parametro_('soportes_desde', '2026-10-05')); }

/* ------------------------------ obligaciones ------------------------------ */
function contextoObligaciones_(docente) {
  hojaOCrea_('Soportes', COL_SOPORTES);
  return {
    hoy: ymd_(new Date()), desde: soportesDesde_(), docente: docente || '',
    novedades: datos_('Novedades').map(function (n) { return { fecha: fechaIso_(n['Fecha Novedad']), docente: n['Docente'], tipo: n['Tipo Novedad'], motivo: n['Motivo Ausencia'], minutos: n['Minutos Desatendidos'] }; }),
    soportes: datos_('Soportes').map(function (s) { return { clave: s.clave, id: s.id, estado: s.estado, fecha_carga: String(s.fecha_carga) }; }),
    motivos: datos_('Motivos').map(function (m) { return { motivo: m.motivo, requiere_soporte: m.requiere_soporte, plazo_dias: m.plazo_dias }; })
  };
}
function obligaciones_(docente) { return calcularObligaciones_(contextoObligaciones_(docente)); }

function lista_(nombre) { return datos_('Listas').filter(function (x) { return x.lista === nombre; }).map(function (x) { return x.valor; }); }

/** Pantalla "Mis soportes" del docente. */
function misSoportes() {
  var id = identidad_();
  if (id.rol !== 'docente') throw new Error('Solo un docente puede ver sus soportes.');
  hojaOCrea_('Soportes', COL_SOPORTES);
  var mios = datos_('Soportes').filter(function (s) { return s.docente === id.docente; }).map(function (s) {
    return { id: s.id, fecha: String(s.fecha_carga).slice(0, 10), tipo: s.tipo_documento, estado: s.estado, extemporaneo: s.extemporaneo, observacion: s.observacion_revision, clave: s.clave };
  });
  return { docente: id.docente, autorizado: id.autorizado, obligaciones: obligaciones_(id.docente), cargados: mios,
           tiposDocumento: lista_('tipo_documento'), motivos: datos_('Motivos').map(function (m) { return m.motivo; }), maxMB: MAX_BYTES_SOPORTE / 1048576 };
}

/* ------------------------------ Drive ------------------------------ */
function carpetaRaiz_() {
  var id = parametro_('carpeta_soportes_id', '');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* si se borró, se crea otra */ } }
  var f = DriveApp.createFolder('ICET Soportes 2026 (privada)');
  guardarParametro_('carpeta_soportes_id', f.getId());
  return f;
}
function carpetaDocente_(docente) {
  var raiz = carpetaRaiz_(), it = raiz.getFoldersByName(docente);
  return it.hasNext() ? it.next() : raiz.createFolder(docente);
}

/**
 * El docente carga un soporte. p = {clave, tipoDocumento, motivoDeclarado, mime, base64, comentario}
 * El nombre del archivo lo genera el sistema (fecha + tipo), no el que traiga el teléfono.
 */
function subirSoporte(p) {
  var id = identidad_();
  if (id.rol !== 'docente') throw new Error('Solo un docente puede cargar soportes.');
  if (!id.autorizado) throw new Error('Primero acepte la autorización de tratamiento de datos.');
  p = p || {};
  var ob = obligaciones_(id.docente).filter(function (o) { return o.clave === p.clave; })[0];
  if (!ob) throw new Error('Ese soporte no corresponde a una ausencia suya.');
  if (['Entregado', 'Aceptado', 'No aplica'].indexOf(ob.estado) >= 0) throw new Error('Esa ausencia ya tiene un soporte (' + ob.estado + ').');
  var ext = MIME_SOPORTES[p.mime];
  if (!ext) throw new Error('Formato no permitido. Use foto (JPG, PNG) o PDF.');
  if (lista_('tipo_documento').indexOf(p.tipoDocumento) < 0) throw new Error('Elija el tipo de documento.');
  var motivos = datos_('Motivos').map(function (m) { return m.motivo; });
  var motivo = p.motivoDeclarado && motivos.indexOf(p.motivoDeclarado) >= 0 ? p.motivoDeclarado : '';
  var bytes = Utilities.base64Decode(String(p.base64 || ''));
  if (!bytes.length) throw new Error('El archivo está vacío.');
  if (bytes.length > MAX_BYTES_SOPORTE) throw new Error('El archivo supera ' + (MAX_BYTES_SOPORTE / 1048576) + ' MB.');

  var ahora = ahoraTxt_();
  var nombre = ob.inicio + '_' + String(p.tipoDocumento).replace(/[^A-Za-z0-9ÁÉÍÓÚáéíóúñÑ]+/g, '-') + '_' + ahora.replace(/[^0-9]/g, '') + '.' + ext;
  var archivo = carpetaDocente_(id.docente).createFile(Utilities.newBlob(bytes, p.mime, nombre));
  try { archivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) { /* ya es privado */ }
  var extemporaneo = ymd_(new Date()) > ob.limite ? 'SI' : 'NO';
  var sid = Utilities.getUuid();
  hojaOCrea_('Soportes', COL_SOPORTES).appendRow([sid, ahora, id.docente, ob.clave, ob.inicio, ob.fin, motivo, p.tipoDocumento, archivo.getId(), archivo.getUrl(),
    'Entregado', extemporaneo, String(p.comentario || '').slice(0, 300), '', '', '']);
  return { id: sid, estado: 'Entregado', extemporaneo: extemporaneo };
}

/* ------------------------------ revisión (directivos) ------------------------------ */
/** Soportes por revisar y obligaciones vencidas, para coordinación. */
function soportesPorRevisar() {
  hojaOCrea_('Soportes', COL_SOPORTES);
  var obl = obligaciones_(''), por = {};
  obl.forEach(function (o) { por[o.clave] = o; });
  var revisar = datos_('Soportes').filter(function (s) { return s.estado === 'Entregado'; }).map(function (s) {
    var o = por[s.clave] || {};
    return { id: s.id, docente: s.docente, inicio: s.inicio, fin: s.fin, motivoDeclarado: s.motivo_declarado, tipo: s.tipo_documento, fecha: String(s.fecha_carga).slice(0, 16),
             extemporaneo: s.extemporaneo, comentario: s.comentario, url: s.archivo_url, motivos: o.motivos || [], minutos: o.minutos || 0 };
  });
  return { porRevisar: revisar, vencidos: obl.filter(function (o) { return o.estado === 'Vencido'; }),
           pendientes: obl.filter(function (o) { return o.estado === 'Pendiente'; }), resumen: resumenObligaciones_(obl) };
}

/** p = {id, accion: ACEPTAR | RECHAZAR | NO_APLICA, observacion}. Al aceptar, las novedades injustificadas de esa ausencia pasan a justificadas. */
function revisarSoporte(p) {
  var id = identidad_();
  if (id.rol !== 'directivo') throw new Error('Solo un directivo puede revisar soportes.');
  var estado = { ACEPTAR: 'Aceptado', RECHAZAR: 'Rechazado', NO_APLICA: 'No aplica' }[p && p.accion];
  if (!estado) throw new Error('Acción no válida.');
  if (estado === 'Rechazado' && !String(p.observacion || '').trim()) throw new Error('Explique por qué se rechaza para que el docente pueda corregirlo.');
  var sh = hojaOCrea_('Soportes', COL_SOPORTES), v = sh.getDataRange().getValues(), h = v[0], fila = -1;
  for (var i = 1; i < v.length; i++) if (v[i][0] === p.id) { fila = i; break; }
  if (fila < 0) throw new Error('No se encontró el soporte.');
  var c = function (k) { return h.indexOf(k) + 1; };
  sh.getRange(fila + 1, c('estado')).setValue(estado);
  sh.getRange(fila + 1, c('revisado_por')).setValue(id.nombre || id.email);
  sh.getRange(fila + 1, c('fecha_revision')).setValue(ahoraTxt_());
  sh.getRange(fila + 1, c('observacion_revision')).setValue(String(p.observacion || '').slice(0, 300));
  var corregidas = 0;
  if (estado === 'Aceptado') {
    var s = {}; h.forEach(function (k, j) { s[k] = v[fila][j]; });
    var m = datos_('Motivos').filter(function (x) { return x.motivo === s.motivo_declarado; })[0];
    var nov = hoja_('Novedades'), nv = nov.getDataRange().getValues(), nh = nv[0];
    var iF = nh.indexOf('Fecha Novedad') + 1, iD = nh.indexOf('Docente') + 1, iT = nh.indexOf('Tipo Novedad') + 1,
        iM = nh.indexOf('Motivo Ausencia') + 1, iJ = nh.indexOf('Justificada') + 1, iC = nh.indexOf('Categoría motivo') + 1;
    for (var r = 1; r < nv.length; r++) {
      var f = fechaIso_(nv[r][iF - 1]);
      if (nv[r][iD - 1] === s.docente && f >= String(s.inicio) && f <= String(s.fin) && /no asisti/i.test(String(nv[r][iT - 1])) && String(nv[r][iJ - 1]) !== 'Sí') {
        if (m && m.motivo !== 'Sin justificación') nov.getRange(r + 1, iM).setValue(m.motivo);
        nov.getRange(r + 1, iJ).setValue('Sí');
        if (m && iC) nov.getRange(r + 1, iC).setValue(m.categoria);
        corregidas++;
      }
    }
  }
  return { id: p.id, estado: estado, novedadesCorregidas: corregidas };
}
