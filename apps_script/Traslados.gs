/**
 * Traslados de estudiantes entre cursos o grados (desde los listados de la comisión).
 * Autor: Francisco Javier Cortés Cabezas · I.E. ICET, Tumaco.
 *
 * Quien tiene control (coordinación académica o desarrollador) traslada de inmediato. Cualquier otra persona SOLICITA el traslado con una
 * justificación: queda PENDIENTE en la hoja Traslados_Estudiantes, se avisa por correo a coordinación y solo se aplica cuando se aprueba.
 * Al aplicar se cambian las columnas «grupo» y «curso» de la hoja Estudiantes y queda registro en Bitacora_Cambios.
 */
var COL_TRASLADOS = ['id', 'fecha', 'solicitante', 'rol', 'fila', 'documento', 'estudiante', 'desde', 'hacia', 'justificacion', 'estado', 'resuelto_por', 'fecha_resolucion', 'nota'];

function trasladoCodigo_(x) { var s = String(x == null ? '' : x).trim(); if (/^\d+(\.0+)?$/.test(s)) { s = String(Math.round(Number(s))); while (s.length < 4) s = '0' + s; } return s; }
function trasladoGrupos_() { return datos_('Grupos').map(function (g) { return { grupo: trasladoCodigo_(g.grupo), curso: String(g.nombre || g.grupo) }; }); }
function trasladoCols_(h) { var o = {}; h.forEach(function (n, i) { o[String(n).trim().toLowerCase()] = i; }); return o; }

/** Busca estudiantes de todo el colegio por nombre o documento (mínimo 3 caracteres). */
function trasladoBuscar(p) {
  comisionQuien_();
  var q = comisionSinTildes_((p || {}).q); if (q.replace(/\s/g, '').length < 3) throw new Error('Escriba al menos 3 letras o números.');
  var v = hoja_('Estudiantes').getDataRange().getValues(), c = trasladoCols_(v[0]), r = [];
  for (var i = 1; i < v.length && r.length < 30; i++) {
    var gr = trasladoCodigo_(v[i][c.grupo]); if (!gr) continue;
    var nom = String(v[i][c.apellidos] || '') + ' ' + String(v[i][c.nombres] || ''), doc = String(v[i][c.documento] || '');
    if (comisionSinTildes_(nom + ' ' + doc).indexOf(q) >= 0) r.push({ fila: i + 1, nombre: nom.trim(), doc: doc, grupo: gr, curso: String(v[i][c.curso] || '') });
  }
  return { res: r, grupos: trasladoGrupos_() };
}

/** Cambia grupo y curso del estudiante en la hoja Estudiantes (verifica que la fila siga siendo la misma persona). */
function trasladoAplicar_(fila, doc, nombre, hacia, por, motivo) {
  var sh = hoja_('Estudiantes'), v = sh.getDataRange().getValues(), c = trasladoCols_(v[0]), row = v[fila - 1];
  if (!row) throw new Error('La fila del estudiante ya no existe: busque de nuevo.');
  var nomAct = comisionSinTildes_(String(row[c.apellidos] || '') + ' ' + String(row[c.nombres] || '')), docAct = String(row[c.documento] || '').trim();
  if (nomAct !== comisionSinTildes_(nombre) || docAct !== String(doc || '').trim()) throw new Error('La hoja Estudiantes cambió desde la búsqueda (esa fila ya es otra persona). Busque de nuevo.');
  var g = trasladoGrupos_().filter(function (x) { return x.grupo === hacia; })[0]; if (!g) throw new Error('El grupo de destino no existe en la hoja Grupos.');
  var desde = trasladoCodigo_(row[c.grupo]); if (desde === hacia) throw new Error('El estudiante ya está en ese grupo.');
  var rg = sh.getRange(fila, c.grupo + 1); if (rg.setNumberFormat) rg.setNumberFormat('@'); rg.setValue(hacia);
  sh.getRange(fila, c.curso + 1).setValue(g.curso);
  bitacora_('Traslado de estudiante', nombre + ' (' + doc + '): ' + desde + ' → ' + hacia + ' · por ' + por + (motivo ? ' · ' + String(motivo).slice(0, 200) : ''));
  return { desde: desde, hacia: hacia, curso: g.curso };
}

function trasladoCorreosCoord_() {
  var c = []; datos_('Directivos').forEach(function (d) { var m = String(d.correo || d.correo_temporal || '').trim(); if (m && /@/.test(m) && !/@example\./i.test(m) && (/coordinador acad/i.test(String(d.rol)) || String(d.administra || '').toUpperCase() === 'SI') && c.indexOf(m) < 0) c.push(m); });
  return c;
}

/** Solicita (o, con control total, aplica) el traslado de un estudiante. p = { fila, doc, nombre, hacia, just }. */
function trasladoSolicitar(p, sinCorreo) {
  var quien = comisionQuien_(); p = p || {};
  var just = String(p.just || '').trim(); if (!quien.coord && just.length < 10) throw new Error('Escriba la justificación del traslado (mínimo 10 caracteres).');
  var hacia = trasladoCodigo_(p.hacia), fila = Number(p.fila);
  if (!fila || !hacia) throw new Error('Falta el estudiante o el grupo de destino.');
  var sh = hojaOCrea_('Traslados_Estudiantes', COL_TRASLADOS), id = Utilities.getUuid();
  if (quien.coord) {
    var r = trasladoAplicar_(fila, p.doc, p.nombre, hacia, quien.nombre, just);
    sh.appendRow([id, ahoraTxt_(), quien.nombre, quien.rol, fila, txtForzado_(String(p.doc || '')), p.nombre, txtForzado_(r.desde), txtForzado_(hacia), just, 'APLICADO', quien.nombre, ahoraTxt_(), 'Con control total: sin autorización']);
    return { estado: 'APLICADO', desde: r.desde, hacia: hacia, curso: r.curso };
  }
  var v = hoja_('Estudiantes').getDataRange().getValues(), c = trasladoCols_(v[0]), row = v[fila - 1];
  if (!row) throw new Error('La fila del estudiante ya no existe: busque de nuevo.');
  var desde = trasladoCodigo_(row[c.grupo]);
  sh.appendRow([id, ahoraTxt_(), quien.nombre, quien.rol, fila, txtForzado_(String(p.doc || '')), p.nombre, txtForzado_(desde), txtForzado_(hacia), just, 'PENDIENTE', '', '', '']);
  bitacora_('Traslado solicitado', p.nombre + ' (' + p.doc + '): ' + desde + ' → ' + hacia + ' · por ' + quien.nombre + ' · ' + just.slice(0, 200));
  var para = sinCorreo ? [] : trasladoCorreosCoord_();
  if (para.length) { try { MailApp.sendEmail({ to: para.join(','), subject: 'ICET · Traslado de estudiante por autorizar: ' + p.nombre, htmlBody: '<p><b>' + quien.nombre + '</b> solicita trasladar a <b>' + p.nombre + '</b> (' + p.doc + ') de <b>' + desde + '</b> a <b>' + hacia + '</b>.</p><p>Justificación: ' + just.replace(/</g, '&lt;') + '</p><p>Apruébelo o recházelo en Comisiones → Listados → «Traslados».</p>', name: 'Control de Procesos ICET' }); } catch (e) { /* el aviso es opcional */ } }
  return { estado: 'PENDIENTE', desde: desde, hacia: hacia };
}

/** Lista los traslados (pendientes primero) para coordinación; el resto solo ve los suyos. */
function trasladoListar() {
  var quien = comisionQuien_(), t = datos_('Traslados_Estudiantes').reverse();
  var res = t.filter(function (x) { return quien.coord || String(x.solicitante) === quien.nombre; }).slice(0, 80);
  res.sort(function (a, b) { return (a.estado === 'PENDIENTE' ? 0 : 1) - (b.estado === 'PENDIENTE' ? 0 : 1); });
  return { coord: !!quien.coord, traslados: res.map(function (x) { var o = {}; COL_TRASLADOS.forEach(function (k) { o[k] = String(x[k] == null ? '' : x[k]); }); return o; }) };
}

/** Coordinación aprueba o rechaza una solicitud pendiente. p = { id, aprobar, nota }. */
function trasladoResolver(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica o el desarrollador autorizan los traslados.');
  var sh = hojaOCrea_('Traslados_Estudiantes', COL_TRASLADOS), v = sh.getDataRange().getValues(), h = trasladoCols_(v[0]), fila = 0;
  for (var i = 1; i < v.length; i++) if (String(v[i][h.id]) === String((p || {}).id)) { fila = i + 1; break; }
  if (!fila) throw new Error('No existe esa solicitud.');
  var r = v[fila - 1]; if (String(r[h.estado]) !== 'PENDIENTE') throw new Error('Esa solicitud ya fue resuelta.');
  var estado = 'RECHAZADO';
  if (p.aprobar) { trasladoAplicar_(Number(r[h.fila]), String(r[h.documento]), String(r[h.estudiante]), trasladoCodigo_(r[h.hacia]), String(r[h.solicitante]) + ' (autorizó ' + quien.nombre + ')', String(r[h.justificacion])); estado = 'APLICADO'; }
  else bitacora_('Traslado rechazado', r[h.estudiante] + ' · ' + String((p || {}).nota || '').slice(0, 200));
  sh.getRange(fila, h.estado + 1).setValue(estado); sh.getRange(fila, h.resuelto_por + 1).setValue(quien.nombre); sh.getRange(fila, h.fecha_resolucion + 1).setValue(ahoraTxt_()); sh.getRange(fila, h.nota + 1).setValue(String((p || {}).nota || ''));
  return { estado: estado };
}


/* ------------------------------ cambios masivos (menú de directivos) ------------------------------ */
/** Estudiantes de un grupo para elegir varios. p = { grupo }. */
function estudiantesDelGrupo(p) {
  comisionQuien_(); var g = trasladoCodigo_((p || {}).grupo), v = hoja_('Estudiantes').getDataRange().getValues(), c = trasladoCols_(v[0]), r = [];
  for (var i = 1; i < v.length; i++) if (trasladoCodigo_(v[i][c.grupo]) === g) r.push({ fila: i + 1, nombre: (String(v[i][c.apellidos] || '') + ' ' + String(v[i][c.nombres] || '')).trim(), doc: String(v[i][c.documento] || ''), sexo: String(v[i][c.sexo] == null ? '' : v[i][c.sexo]) });
  return { estudiantes: r, grupos: trasladoGrupos_() };
}
/** Traslada varios estudiantes al mismo curso. p = { estudiantes:[{fila,doc,nombre}], hacia, just }. Coordinación aplica; los demás solicitan (un solo aviso). */
function trasladoMasivo(p) {
  var quien = comisionQuien_(); p = p || {}; var L = (p.estudiantes || []).slice(0, 60);
  if (!L.length) throw new Error('Elija al menos un estudiante.');
  var res = { aplicados: 0, pendientes: 0, errores: [] };
  L.forEach(function (e) { try { var r = trasladoSolicitar({ fila: e.fila, doc: e.doc, nombre: e.nombre, hacia: p.hacia, just: p.just }, true); if (r.estado === 'APLICADO') res.aplicados++; else res.pendientes++; } catch (x) { res.errores.push(e.nombre + ': ' + String(x.message || x)); } });
  if (res.pendientes) { var para = trasladoCorreosCoord_(); if (para.length) { try { MailApp.sendEmail({ to: para.join(','), subject: 'ICET · ' + res.pendientes + ' traslados de estudiantes por autorizar', htmlBody: '<p><b>' + quien.nombre + '</b> solicitó trasladar a ' + res.pendientes + ' estudiantes al grupo ' + trasladoCodigo_(p.hacia) + '.</p><p>Justificación: ' + String(p.just || '').replace(/</g, '&lt;') + '</p><p>Revíselos en Comisiones → Listados → «Traslados».</p>', name: 'Control de Procesos ICET' }); } catch (e) { /* aviso opcional */ } } }
  return res;
}
var CAMPOS_ESTUDIANTE = { sexo: 'sexo', tipo_doc: 'tipo_doc', nacionalidad: 'nacionalidad', lugar_expedicion: 'lugar_expedicion', tel_acudiente: 'tel_acudiente' };
/** Cambia UN dato de varios estudiantes (solo coordinación o desarrollador). p = { estudiantes:[{fila,doc,nombre}], campo, valor }. */
function estudiantesCampoMasivo(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica o el desarrollador modifican datos de estudiantes en la hoja.');
  p = p || {}; var campo = CAMPOS_ESTUDIANTE[p.campo]; if (!campo) throw new Error('Dato no permitido.');
  var valor = String(p.valor == null ? '' : p.valor).trim(); if (campo === 'sexo' && !/^[FM]$/.test(valor)) throw new Error('El sexo debe ser F o M.');
  var sh = hoja_('Estudiantes'), v = sh.getDataRange().getValues(), c = trasladoCols_(v[0]); if (c[campo] === undefined) throw new Error('La hoja Estudiantes no tiene la columna «' + campo + '».');
  var n = 0, err = [];
  (p.estudiantes || []).slice(0, 300).forEach(function (e) {
    var row = v[e.fila - 1]; if (!row) { err.push(e.nombre); return; }
    var nom = comisionSinTildes_(String(row[c.apellidos] || '') + ' ' + String(row[c.nombres] || ''));
    if (nom !== comisionSinTildes_(e.nombre) || String(row[c.documento] || '').trim() !== String(e.doc || '').trim()) { err.push(e.nombre + ' (la fila cambió)'); return; }
    sh.getRange(e.fila, c[campo] + 1).setValue(valor); n++;
  });
  bitacora_('Cambio masivo de estudiantes', campo + ' = ' + valor + ' en ' + n + ' estudiantes · por ' + quien.nombre);
  return { cambiados: n, errores: err };
}
var CAMPOS_DOCENTE = { nivel: 'nivel', direccion_grupo: 'direccion_grupo', areas: 'areas', nota: 'nota', correo: 'correo' };
/** Cambia UN dato de varios docentes (solo coordinación o desarrollador). p = { nombres:[nombre_completo], campo, valor }. */
function docentesCampoMasivo(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica o el desarrollador modifican datos de docentes.');
  p = p || {}; var campo = CAMPOS_DOCENTE[p.campo]; if (!campo) throw new Error('Dato no permitido.');
  var valor = String(p.valor == null ? '' : p.valor).trim();
  if (campo === 'nivel' && ['SECUNDARIA', 'PRIMARIA', 'PREESCOLAR', 'ORIENTACIÓN', 'TUTORA PTAFI', 'REEMPLAZADO'].indexOf(valor) < 0) throw new Error('Nivel no válido.');
  var sh = hoja_('Docentes'), v = sh.getDataRange().getValues(), c = trasladoCols_(v[0]), n = 0, quiere = {};
  (p.nombres || []).forEach(function (x) { quiere[comisionSinTildes_(x)] = 1; });
  for (var i = 1; i < v.length; i++) if (quiere[comisionSinTildes_(v[i][c.nombre_completo])]) { sh.getRange(i + 1, c[campo] + 1).setValue(valor); n++; }
  try { invalidarCache_('Docentes'); } catch (e) { /* sin caché */ }
  bitacora_('Cambio masivo de docentes', campo + ' = ' + valor + ' en ' + n + ' docentes · por ' + quien.nombre);
  return { cambiados: n };
}

/* ------------------------------ importar datos desde otro libro ------------------------------ */
function importNorm_(x) { return comisionSinTildes_(x).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
var IMPORT_SINONIMOS = { tipo_de_documento: 'tipo_doc', tipo_documento: 'tipo_doc', tipo: 'tipo_doc', numero_de_documento: 'documento', numero_documento: 'documento', identificacion: 'documento', cedula: 'documento', genero: 'sexo', telefono: 'tel_acudiente', celular: 'tel_acudiente', telefono_acudiente: 'tel_acudiente', celular_acudiente: 'tel_acudiente', lugar_de_expedicion: 'lugar_expedicion', expedicion: 'lugar_expedicion', correo_electronico: 'correo', email: 'correo' };
/** Lee otro libro y calcula (o aplica) qué datos cambiarían. p = { id (o enlace), hoja, tipo:'estudiantes'|'docentes', aplicar }. Solo coordinación o desarrollador. */
function importarLibro(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica o el desarrollador importan datos.');
  p = p || {}; var m = /\/d\/([A-Za-z0-9_-]{20,})/.exec(String(p.id || '')), id = m ? m[1] : String(p.id || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new Error('Pegue el enlace o el identificador del libro.');
  var ss; try { ss = SpreadsheetApp.openById(id); } catch (e) { throw new Error('No se pudo abrir ese libro: compártalo con su cuenta o revise el enlace.'); }
  var orig = (p.hoja ? ss.getSheetByName(String(p.hoja)) : null) || ss.getSheets()[0]; if (!orig) throw new Error('El libro no tiene hojas.');
  var ov = orig.getDataRange().getValues(); if (ov.length < 2) throw new Error('La hoja no tiene datos.');
  var oc = {}; ov[0].forEach(function (h, i) { var k = importNorm_(h); oc[IMPORT_SINONIMOS[k] || k] = i; });
  var est = p.tipo !== 'docentes', hoja = hoja_(est ? 'Estudiantes' : 'Docentes'), dv = hoja.getDataRange().getValues(), dc = trasladoCols_(dv[0]);
  var campos = est ? ['sexo', 'tipo_doc', 'nacionalidad', 'lugar_expedicion', 'tel_acudiente', 'apellidos', 'nombres'] : ['correo', 'nivel', 'areas', 'direccion_grupo', 'nota'];
  var usar = campos.filter(function (k) { return oc[k] !== undefined && dc[k] !== undefined; });
  if (!usar.length) throw new Error('No hay columnas en común. Use títulos como: ' + (est ? 'documento, sexo, tipo_doc, nacionalidad, lugar_expedicion, tel_acudiente' : 'nombre_completo, correo, nivel, areas, direccion_grupo') + '.');
  var llave = est ? function (r, c) { return String(r[c.documento] == null ? '' : r[c.documento]).replace(/\D/g, ''); } : function (r, c) { return comisionSinTildes_(r[c.nombre_completo]); };
  if (est && oc.documento === undefined) throw new Error('La hoja debe traer la columna «documento» para reconocer a cada estudiante.');
  if (!est && oc.nombre_completo === undefined) throw new Error('La hoja debe traer la columna «nombre_completo» para reconocer a cada docente.');
  var indice = {}; for (var i = 1; i < dv.length; i++) { var k = llave(dv[i], dc); if (k) indice[k] = i; }
  var cambios = [], sin = 0, coinciden = 0;
  for (var j = 1; j < ov.length; j++) {
    var kk = llave(ov[j], oc); if (!kk) continue; var fila = indice[kk]; if (fila === undefined) { sin++; continue; } coinciden++;
    usar.forEach(function (campo) { var nv = String(ov[j][oc[campo]] == null ? '' : ov[j][oc[campo]]).trim(), an = String(dv[fila][dc[campo]] == null ? '' : dv[fila][dc[campo]]).trim(); if (nv && nv !== an) cambios.push({ fila: fila + 1, campo: campo, antes: an, despues: nv, quien: est ? (String(dv[fila][dc.apellidos] || '') + ' ' + String(dv[fila][dc.nombres] || '')).trim() : String(dv[fila][dc.nombre_completo]) }); });
  }
  if (p.aplicar) {
    if (cambios.length > 1500) throw new Error('Son demasiados cambios (' + cambios.length + '). Divida el libro en partes.');
    cambios.forEach(function (x) { var rg = hoja.getRange(x.fila, dc[x.campo] + 1); rg.setValue(x.despues); });
    if (!est) { try { invalidarCache_('Docentes'); } catch (e) { /* sin caché */ } }
    bitacora_('Importación de datos', (est ? 'Estudiantes' : 'Docentes') + ': ' + cambios.length + ' cambios desde otro libro · por ' + quien.nombre);
  }
  return { aplicado: !!p.aplicar, campos: usar, coinciden: coinciden, sinCoincidencia: sin, total: cambios.length, muestra: cambios.slice(0, 40) };
}

/* ------------------------------ copia de revisión al entrar coordinación o desarrollador ------------------------------ */
/** Copia compacta del libro en «App Asistencia / Respaldos / Revisiones» como mucho cada 6 horas; conserva las últimas 6. */
function respaldoRevision_() {
  var ult = Number(parametro_('respaldo_revision_ts', '0')) || 0, ahora = Date.now(); if (ahora - ult < 6 * 3600 * 1000) return false;
  guardarParametro_('respaldo_revision_ts', String(ahora));
  var carpeta = carpetaHija_(carpetaRespaldos_(), 'Revisiones'), libro = SpreadsheetApp.getActive();
  DriveApp.getFileById(libro.getId()).makeCopy(libro.getName() + ' · revisión ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), carpeta);
  var fs = [], it = carpeta.getFiles(); while (it.hasNext()) fs.push(it.next());
  fs.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); }); fs.slice(6).forEach(function (f) { f.setTrashed(true); });
  return true;
}

/** Lo llama la pantalla en segundo plano al entrar coordinación o el desarrollador (no retrasa la carga). */
function respaldoRevisionAhora() { var q = comisionQuien_(); if (!q.coord) return { copiado: false }; try { return { copiado: !!respaldoRevision_() }; } catch (e) { return { copiado: false, error: String(e && e.message || e).slice(0, 100) }; } }
