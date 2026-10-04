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
  var iF = nh.indexOf('Fecha Novedad'), iD = nh.indexOf('Docente'), iT = nh.indexOf('Tipo Novedad'), iM = nh.indexOf('Medio Información'), iS = nh.indexOf('Sesiones');
  var res = { importadas: 0, duplicadas: 0, sinDocente: 0 };

  for (var i = 1; i < vals.length; i++) {
    var f = vals[i];
    if (String(f[col.confirmar]).toUpperCase() !== 'SI' || String(f[col.importado]).trim()) continue;
    var doc = String(f[col.docente] || '').trim();
    if (!doc) { res.sinDocente++; continue; }
    var fecha = fechaIso_(f[col.fecha]);
    var dia = DIAS[Number(Utilities.formatDate(new Date(fecha + 'T12:00:00'), TZ, 'u'))];
    var tipo = String(f[col.tipo_novedad]);
    var ses = col.sesion === undefined ? 0 : Number(f[col.sesion]) || 0;     // 0 = jornada completa (WhatsApp); 1-8 = una sesión (nota de ronda)
    var origen = col.origen === undefined || !f[col.origen] ? 'WhatsApp grupal' : String(f[col.origen]);
    var noAsistio = /no asisti/i.test(tipo);
    var dup = novVals.slice(1).some(function (r) {
      var rs = String(r[iS]), mismo = fechaIso_(r[iF]) === fecha && r[iD] === doc;
      if (!mismo) return false;
      if (noAsistio && /no asisti/i.test(String(r[iT]))) return rs === 'JC' || !ses || rs === 'S' + ses;   // ya hay ausencia que cubre este reporte
      return r[iT] === tipo && String(r[iM]) === origen && (rs === (ses ? 'S' + ses : 'JC'));
    });
    if (dup) { sh.getRange(i + 1, col.importado + 1).setValue('DUPLICADO'); res.duplicadas++; continue; }

    // sesiones que el docente tenía ese día; si es un solo grupo/área se usa, si no, "todas" (como en su formulario actual)
    var mias = hz.filter(function (x) { return x.docente === doc && x.dia === dia; });
    var pg, area, jornadaTxt, minutos, codSes;
    if (ses) {
      var fs1 = mias.filter(function (x) { return Number(x.hora) === ses; })[0];
      var gtxt = fs1 ? (fs1.tipo === 'ENFASIS' ? fs1.grupos_enfasis : fs1.grupo) : (col.grupo === undefined ? '' : f[col.grupo]);
      pg = gtxt ? partesGrupo_(String(gtxt).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
      area = fs1 && fs1.area ? fs1.area : (fs1 ? '(énfasis)' : 'N/A');
      jornadaTxt = 'H' + ses; codSes = 'S' + ses;
      minutos = noAsistio ? 45 : '';
    } else {
      var gr = {}, ar = {};
      mias.forEach(function (x) { gr[x.tipo === 'ENFASIS' ? x.grupos_enfasis : x.grupo] = 1; ar[x.area || '(énfasis)'] = 1; });
      var grupos = Object.keys(gr), areas = Object.keys(ar);
      pg = grupos.length === 1 ? partesGrupo_(String(grupos[0]).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
      area = areas.length === 1 ? areas[0] : (mias.length ? 'Todas' : 'N/A');
      jornadaTxt = 'Jornada completa'; codSes = 'JC';
      minutos = noAsistio && mias.length ? mias.length * 45 : '';
    }
    var m = motivos[f[col.motivo]] || {};
    var fila = [new Date(), fecha, doc, tipo, 'N/A', f[col.motivo], String(f[col.mensaje] || '').slice(0, 300), 'Coordinador(a)', origen,
                pg.grado, pg.grupo, area, jornadaTxt, minutos, f[col.remitente], codSes, m.justificada === 'SI' ? 'Sí' : 'No', m.categoria || ''];
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
