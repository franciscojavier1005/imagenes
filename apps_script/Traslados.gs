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
function trasladoSolicitar(p) {
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
  var para = trasladoCorreosCoord_();
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
