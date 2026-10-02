/**
 * Bandeja de novedades reportadas por WhatsApp.
 *
 * Flujo: 1) exportar el chat del grupo de directivos (sin archivos), 2) python3 scripts/importar_whatsapp.py chat.txt,
 * 3) pegar el CSV resultante en la hoja Bandeja_WhatsApp (desde la fila 2), 4) revisar y marcar SI en "confirmar",
 * 5) menú Asistencia ICET > Importar bandeja de WhatsApp. Cada fila confirmada pasa a la hoja Novedades.
 */

/** Pasa a Novedades las filas confirmadas (confirmar = SI) que aún no se importaron. Sin servicios de interfaz: se puede probar. */
function importarBandeja_() {
  var sh = hoja_('Bandeja_WhatsApp');
  var vals = sh.getDataRange().getValues();
  var col = {}; vals[0].forEach(function (k, i) { col[k] = i; });
  var motivos = {}; datos_('Motivos').forEach(function (m) { motivos[m.motivo] = m; });
  var hz = datos_('Horario');
  var nov = hoja_('Novedades');
  var novVals = nov.getDataRange().getValues(), nh = novVals[0];
  var iF = nh.indexOf('Fecha Novedad'), iD = nh.indexOf('Docente'), iT = nh.indexOf('Tipo Novedad'), iM = nh.indexOf('Medio Información');
  var res = { importadas: 0, duplicadas: 0, sinDocente: 0 };

  for (var i = 1; i < vals.length; i++) {
    var f = vals[i];
    if (String(f[col.confirmar]).toUpperCase() !== 'SI' || String(f[col.importado]).trim()) continue;
    var doc = String(f[col.docente] || '').trim();
    if (!doc) { res.sinDocente++; continue; }
    var fecha = fechaIso_(f[col.fecha]);
    var dia = DIAS[Number(Utilities.formatDate(new Date(fecha + 'T12:00:00'), TZ, 'u'))];
    var tipo = String(f[col.tipo_novedad]);
    var dup = novVals.slice(1).some(function (r) { return fechaIso_(r[iF]) === fecha && r[iD] === doc && r[iT] === tipo && String(r[iM]) === 'WhatsApp grupal'; });
    if (dup) { sh.getRange(i + 1, col.importado + 1).setValue('DUPLICADO'); res.duplicadas++; continue; }

    // sesiones que el docente tenía ese día; si es un solo grupo/área se usa, si no, "todas" (como en su formulario actual)
    var mias = hz.filter(function (x) { return x.docente === doc && x.dia === dia; });
    var gr = {}, ar = {};
    mias.forEach(function (x) { gr[x.tipo === 'ENFASIS' ? x.grupos_enfasis : x.grupo] = 1; ar[x.area || '(énfasis)'] = 1; });
    var grupos = Object.keys(gr), areas = Object.keys(ar);
    var pg = grupos.length === 1 ? partesGrupo_(String(grupos[0]).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
    var area = areas.length === 1 ? areas[0] : (mias.length ? 'Todas' : 'N/A');
    var minutos = /no asisti/i.test(tipo) && mias.length ? mias.length * 45 : '';
    var m = motivos[f[col.motivo]] || {};
    var fila = [new Date(), fecha, doc, tipo, 'N/A', f[col.motivo], String(f[col.mensaje] || '').slice(0, 300), 'Coordinador(a)', 'WhatsApp grupal',
                pg.grado, pg.grupo, area, 'Jornada completa', minutos, f[col.remitente], 'JC', m.justificada === 'SI' ? 'Sí' : 'No', m.categoria || ''];
    nov.appendRow(fila); novVals.push(fila);
    sh.getRange(i + 1, col.importado + 1).setValue('SI');
    res.importadas++;
  }
  return res;
}

function importarBandejaWhatsApp() {
  var r = importarBandeja_();
  SpreadsheetApp.getUi().alert('Importadas a Novedades: ' + r.importadas + '\nYa estaban (duplicadas): ' + r.duplicadas +
    '\nConfirmadas pero sin docente (complete la columna docente): ' + r.sinDocente);
}
