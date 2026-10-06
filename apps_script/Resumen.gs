/**
 * Cálculo del resumen para el tablero (dashboard) y el informe diario.
 * Función pura: no usa servicios de Google, así que se prueba en Node y también corre en la vista previa.
 *
 * ctx = {
 *   desde, hasta:  'yyyy-MM-dd'
 *   novedades:     [{fecha, docente, tipo, motivo, justificada, categoria, grado, grupo, area, minutos, directivo}]
 *   registro:      [{fecha, sesion, docente, estado}]          (marcas de la ronda)
 *   horario:       [{dia, hora, docente, nivel}]                (una fila por docente-día-sesión programada)
 *   filtros:       {nivel, docente}  (opcional)
 *   docentes:      [{nombre_completo, nivel}]
 *   motivos:       [{motivo, categoria, justificada}]
 * }
 */
var RES_DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

function resDia_(s) { return new Date(s + 'T12:00:00Z').getUTCDay(); }
function resSumaDias_(s, n) { var d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/** Días hábiles (lunes a viernes) entre dos fechas, ambas incluidas. */
function resDiasHabiles_(desde, hasta) {
  var out = [], f = desde, tope = 0;
  while (f <= hasta && tope++ < 400) { var d = resDia_(f); if (d >= 1 && d <= 5) out.push(f); f = resSumaDias_(f, 1); }
  return out;
}

/** Nombre legible del grupo a partir de las columnas Grado y Grupo de Novedades. */
function resGrupo_(grado, grupo) {
  grado = String(grado || '').trim(); grupo = String(grupo || '').trim();
  if (grado === 'ORI') return 'Orientación';
  if (grado === 'PTA') return 'Tutoría PTAFI';
  if (/^CS\d$/.test(grado) && /^\d$/.test(grupo)) return 'CS ' + grado.charAt(2) + '-' + grupo;
  if (/^\d{1,2}$/.test(grado) && /^\d$/.test(grupo)) return Number(grado) + '°-' + grupo;
  return 'Sin grupo';
}

function resSuma_(arr, f) { var t = 0; arr.forEach(function (x) { t += f(x); }); return t; }

function resAgrupa_(filas, clave, valor) {
  var m = {}, orden = [];
  filas.forEach(function (f) { var k = clave(f); if (!(k in m)) { m[k] = 0; orden.push(k); } m[k] += valor(f); });
  return orden.map(function (k) { return { nombre: k, minutos: m[k] }; }).sort(function (a, b) { return b.minutos - a.minutos || (a.nombre < b.nombre ? -1 : 1); });
}

function calcularResumen_(ctx) {
  var desde = ctx.desde, hasta = ctx.hasta;
  var fil = ctx.filtros || {}, fNivel = fil.nivel || '', fDoc = fil.docente || '';
  var nivel = {}, mot = {};
  (ctx.docentes || []).forEach(function (d) { nivel[d.nombre_completo] = d.nivel; });
  (ctx.motivos || []).forEach(function (m) { mot[m.motivo] = m; });
  function pasa(docente, nv) { return (!fNivel || nv === fNivel) && (!fDoc || docente === fDoc); }

  function norm(n) {
    var m = mot[n.motivo] || {}, tipo = String(n.tipo), minutos = Number(n.minutos);
    if (!(minutos > 0)) minutos = /no asisti/i.test(tipo) ? 45 : 0;
    var just = n.justificada || (m.justificada === 'SI' ? 'Sí' : (m.justificada === 'NO' ? 'No' : ''));
    return {
      fecha: n.fecha, docente: n.docente, tipo: tipo, motivo: n.motivo || '', minutos: minutos, justificada: just === 'Sí' || just === 'SI' || just === 'Si' ? 'Sí' : 'No',
      categoria: n.categoria || m.categoria || 'OTRO', grupo: resGrupo_(n.grado, n.grupo), area: n.area || '', directivo: n.directivo || '',
      nivel: nivel[n.docente] || 'SIN NIVEL', ausencia: /no asisti/i.test(tipo), temporal: /temporal/i.test(tipo), tarde: /tarde/i.test(tipo), salida: /salida/i.test(tipo)
    };
  }
  // todas las novedades (sin límite de fechas) que cumplen el filtro; de ahí salen el periodo y la tendencia
  var todas = (ctx.novedades || []).filter(function (n) { return n.tipo && n.tipo !== 'Presente'; }).map(norm).filter(function (n) { return pasa(n.docente, n.nivel); });
  var nov = todas.filter(function (n) { return n.fecha >= desde && n.fecha <= hasta; });

  // programadas: sesiones docente-día que debían dictarse en los días hábiles del rango (del filtro)
  var dias = resDiasHabiles_(desde, hasta);
  var hz = (ctx.horario || []).filter(function (h) { return pasa(h.docente, h.nivel); });
  var porDia = {};
  hz.forEach(function (h) { porDia[h.dia] = (porDia[h.dia] || 0) + 1; });
  var programadas = resSuma_(dias, function (f) { return porDia[RES_DIAS[resDia_(f)]] || 0; });

  var minutos = resSuma_(nov, function (n) { return n.minutos; });
  var ausDocDia = {}; nov.forEach(function (n) { if (n.ausencia) ausDocDia[n.docente + '|' + n.fecha] = 1; });
  var docentes = {}; nov.forEach(function (n) { docentes[n.docente] = 1; });
  var just = nov.filter(function (n) { return n.justificada === 'Sí'; });
  var kpis = {
    programadas: programadas,
    minutos: minutos,
    horas: Math.round(minutos / 60 * 10) / 10,
    sesiones: Math.round(minutos / 45 * 10) / 10,
    cumplimiento: programadas > 0 ? Math.max(0, Math.round((1 - minutos / (programadas * 45)) * 1000) / 10) : null,
    docentesConNovedad: Object.keys(docentes).length,
    ausencias: Object.keys(ausDocDia).length,
    llegadasTarde: nov.filter(function (n) { return n.tarde; }).length,
    salidasTempranas: nov.filter(function (n) { return n.salida; }).length,
    permisosTemporales: nov.filter(function (n) { return n.temporal; }).length,
    eventos: nov.length,
    pctJustificadas: nov.length ? Math.round(just.length / nov.length * 1000) / 10 : null,
    minutosSinJustificar: resSuma_(nov.filter(function (n) { return n.justificada !== 'Sí'; }), function (n) { return n.minutos; })
  };

  // tendencia: últimos 10 días hábiles que terminan en "hasta"
  var tend = [], f = hasta, c = 0, guard = 0;
  while (c < 10 && guard++ < 40) { var dd = resDia_(f); if (dd >= 1 && dd <= 5) { tend.unshift(f); c++; } f = resSumaDias_(f, -1); }
  var tendencia = tend.map(function (d) {
    var del = todas.filter(function (x) { return x.fecha === d; });
    return { fecha: d, minutos: resSuma_(del, function (x) { return x.minutos; }), eventos: del.length };
  });

  // por nivel, con la parte justificada y la sin justificar (barra apilada)
  var niveles = {}, ordenN = [];
  nov.forEach(function (x) {
    if (!niveles[x.nivel]) { niveles[x.nivel] = { nombre: x.nivel, justificada: 0, sinJustificar: 0 }; ordenN.push(x.nivel); }
    niveles[x.nivel][x.justificada === 'Sí' ? 'justificada' : 'sinJustificar'] += x.minutos;
  });
  var porNivel = ordenN.map(function (k) { return niveles[k]; }).sort(function (a, b) { return (b.justificada + b.sinJustificar) - (a.justificada + a.sinJustificar) || (a.nombre < b.nombre ? -1 : 1); });

  // docentes
  var docs = {}, ordenD = [];
  nov.forEach(function (x) {
    if (!docs[x.docente]) { docs[x.docente] = { docente: x.docente, nivel: x.nivel, eventos: 0, dias: {}, minutos: 0, sinJustificar: 0 }; ordenD.push(x.docente); }
    var d = docs[x.docente]; d.eventos++; d.dias[x.fecha] = 1; d.minutos += x.minutos; if (x.justificada !== 'Sí') d.sinJustificar += x.minutos;
  });
  var porDocente = ordenD.map(function (k) { var d = docs[k]; return { docente: d.docente, nivel: d.nivel, eventos: d.eventos, dias: Object.keys(d.dias).length, minutos: d.minutos, sinJustificar: d.sinJustificar }; })
    .sort(function (a, b) { return b.minutos - a.minutos || (a.docente < b.docente ? -1 : 1); });

  // ronda del último día del rango (esperados y verificados, dentro del filtro)
  var dh = RES_DIAS[resDia_(hasta)], ronda = [];
  for (var s = 1; s <= 8; s++) {
    var esp = hz.filter(function (h) { return h.dia === dh && Number(h.hora) === s; }).length;
    var marc = {}; (ctx.registro || []).forEach(function (r) { if (r.fecha === hasta && Number(r.sesion) === s && pasa(r.docente, nivel[r.docente] || 'SIN NIVEL')) marc[r.docente] = 1; });
    ronda.push({ sesion: s, esperados: esp, marcados: Object.keys(marc).length });
  }

  function fila(x) { return { fecha: x.fecha, docente: x.docente, grupo: x.grupo, area: x.area, tipo: x.tipo, motivo: x.motivo, minutos: x.minutos, justificada: x.justificada, directivo: x.directivo }; }
  return {
    desde: desde, hasta: hasta, diasHabiles: dias.length, filtros: { nivel: fNivel, docente: fDoc }, kpis: kpis, tendencia: tendencia,
    porCategoria: resAgrupa_(nov, function (x) { return x.categoria; }, function (x) { return x.minutos; }),
    porMotivo: resAgrupa_(nov, function (x) { return x.motivo || '(sin motivo)'; }, function (x) { return x.minutos; }),
    porTipo: resAgrupa_(nov, function (x) { return x.tipo; }, function (x) { return x.minutos; }),
    porNivel: porNivel,
    porGrupo: resAgrupa_(nov, function (x) { return x.grupo; }, function (x) { return x.minutos; }),
    porArea: resAgrupa_(nov, function (x) { return x.area || '(sin área)'; }, function (x) { return x.minutos; }),
    porDocente: porDocente, ronda: ronda,
    dia: nov.filter(function (x) { return x.fecha === hasta; }).map(fila),
    lista: nov.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : (a.docente < b.docente ? -1 : 1)); }).slice(0, 300).map(fila)
  };
}

/* ------------------------------ informe diario (correo HTML) ------------------------------ */
function resEsc_(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function resMin_(m) { return m < 60 ? Math.round(m) + ' min' : (Math.round(m / 60 * 10) / 10) + ' h'; }

/** Correo HTML con estilos en línea (los clientes de correo no cargan hojas de estilo). */
function htmlInforme_(r, fechaTexto, urlPanel) {
  var k = r.kpis, e = resEsc_;
  var td = 'style="padding:6px 8px;border-bottom:1px solid #e6e5e0;font-size:13px;vertical-align:top;color:#0b0b0b"';
  var th = 'style="padding:6px 8px;border-bottom:2px solid #c9c8c2;font-size:12px;text-align:left;color:#52514e"';
  function tabla(cols, filas) {
    return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 16px"><tr>' +
      cols.map(function (c) { return '<th ' + th + '>' + e(c) + '</th>'; }).join('') + '</tr>' +
      filas.map(function (f) { return '<tr>' + f.map(function (v) { return '<td ' + td + '>' + e(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }
  function barras(items, n) {
    var top = items.slice(0, n), max = top.length ? top[0].minutos || 1 : 1;
    return '<table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px">' + top.map(function (i) {
      return '<tr><td ' + td + ' width="38%">' + e(i.nombre) + '</td><td ' + td + '><div style="background:#2a78d6;height:10px;border-radius:0 4px 4px 0;width:' +
        Math.max(2, Math.round(i.minutos / max * 100)) + '%"></div></td><td ' + td + ' width="70" align="right">' + resMin_(i.minutos) + '</td></tr>';
    }).join('') + '</table>';
  }
  var ronda = r.ronda.filter(function (x) { return x.esperados > 0; }).map(function (x) { return 'S' + x.sesion + ': ' + x.marcados + '/' + x.esperados; }).join(' · ');
  var h = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:auto;color:#0b0b0b">' +
    '<h2 style="margin:0 0 2px;font-size:18px">Asistencia docente · ICET 2026</h2><div style="color:#52514e;font-size:13px;margin-bottom:14px">' + e(fechaTexto) + '</div>' +
    '<div style="background:#f3f3f0;border-radius:10px;padding:14px 16px;margin-bottom:12px"><div style="font-size:12.5px;color:#52514e">Horas de clase sin atender</div>' +
    '<div style="font-size:40px;font-weight:600;line-height:1.1">' + e(k.horas) + ' <span style="font-size:16px;color:#52514e;font-weight:500">horas</span></div>' +
    '<div style="font-size:13px;color:#52514e">' + e(k.sesiones) + ' sesiones de 45 min de ' + e(k.programadas) + ' programadas · cumplimiento ' + (k.cumplimiento == null ? '—' : e(k.cumplimiento) + '%') + '</div></div>' +
    '<table width="100%" cellpadding="0" cellspacing="6" style="margin-bottom:10px"><tr>' +
    [['Docentes con novedad', k.docentesConNovedad], ['Ausencias', k.ausencias], ['Llegadas tarde', k.llegadasTarde], ['Salidas tempranas', k.salidasTempranas], ['Permisos por horas', k.permisosTemporales],
     ['Justificadas', k.pctJustificadas == null ? '—' : k.pctJustificadas + '%']].map(function (t) {
      return '<td style="background:#f3f3f0;border-radius:8px;padding:8px 10px;width:16%"><div style="font-size:11.5px;color:#52514e">' + e(t[0]) + '</div><div style="font-size:20px;font-weight:600">' + e(t[1]) + '</div></td>';
    }).join('') + '</tr></table>';
  if (!r.dia.length) {
    h += '<p style="font-size:14px">No se registraron novedades en el día.</p>';
  } else {
    h += '<h3 style="font-size:14px;margin:14px 0 0">Novedades del día</h3>' +
      tabla(['Docente', 'Grupo', 'Área', 'Novedad', 'Motivo', 'Minutos', 'Justif.'],
            r.dia.slice(0, 40).map(function (x) { return [x.docente, x.grupo, x.area, x.tipo, x.motivo, x.minutos, x.justificada]; })) +
      (r.dia.length > 40 ? '<p style="font-size:12px;color:#52514e">Se muestran 40 de ' + r.dia.length + '. El detalle completo está en el panel.</p>' : '');
    h += '<h3 style="font-size:14px;margin:6px 0 0">Motivos (tiempo sin atender)</h3>' + barras(r.porCategoria, 6) +
         '<h3 style="font-size:14px;margin:6px 0 0">Grupos más afectados</h3>' + barras(r.porGrupo, 6);
  }
  h += '<p style="font-size:12.5px;color:#52514e">Ronda de verificación (docentes verificados/esperados): ' + e(ronda || 'sin registros') + '</p>' +
       (urlPanel ? '<p><a href="' + e(urlPanel) + '" style="color:#1c5cab">Abrir el panel completo</a></p>' : '') +
       '<p style="font-size:11.5px;color:#74736d;border-top:1px solid #e6e5e0;padding-top:8px">Información confidencial de uso directivo (Ley 1581 de 2012).<br>Sistema de control de asistencia docente · Autor: Francisco Javier Cortés Cabezas, coordinador académico, I.E. ICET.</p></div>';
  return h;
}
