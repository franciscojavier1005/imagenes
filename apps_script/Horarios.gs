/**
 * Consulta de horarios (solo lectura) para los coordinadores: horario semanal de un docente o de un grupo de bachillerato (6° a 11° y CS),
 * quiénes deben estar ahora, directores de grupo y docentes de bachillerato por área. Tiene en cuenta las parejas que alternan cada
 * semana: si un directivo ya definió quién dicta esa semana (Semana_Alternancia) se muestra el horario efectivo; si no, se muestran
 * los dos nombres como "por definir". Primaria y preescolar no se consultan aquí.
 */
function esBachillerato_(codigo) { return /^(0[6-9]|1[01])\d\d$/.test(String(codigo)) || /^CS\d{3}$/.test(String(codigo)); }

/**
 * Horario de bachillerato de una semana con las alternancias aplicadas. Devuelve filas
 * {dia, hora, inicio, fin, grupoCodigo, grupo, area, tipo, docente, posibles:[...], pendiente, equipo}
 * (una fila por celda; en parejas por definir, docente = el titular y posibles = los dos).
 */
function horarioEfectivo_(semana) {
  var altern = alternancias_(), estados = estadosSemana_(semana), nombres = mapaGrupos_(), filas = [], pares = {};
  datos_('Horario').forEach(function (h) {
    var enf = h.tipo === 'ENFASIS', cod = String(enf ? h.grupos_enfasis : h.grupo).split('+')[0];
    if (!(h.tipo === 'CLASE' || enf) || !esBachillerato_(cod)) return;
    var base = { dia: h.dia, hora: Number(h.hora), inicio: hhmm_(h.inicio), fin: hhmm_(h.fin), grupoCodigo: String(enf ? h.grupos_enfasis : h.grupo), tipo: h.tipo,
                 grupo: enf ? 'ÉNFASIS ' + String(h.grupos_enfasis).split('+').map(function (g) { return nombres[g] || g; }).join(' + ') : (nombres[h.grupo] || h.grupo),
                 area: h.area || '(énfasis)', docente: h.docente, posibles: [], pendiente: false, equipo: enf && /^EQUIPO/.test(String(h.alternancia)) };
    var par = parAlterna_(h, altern);
    if (par) {                                           // clase de una pareja que alterna: el estado de la semana decide quién la dicta
      var pareja = [h.docente, par].sort(), st = estados['CLASE|' + h.area + '|' + pareja.join('|')];
      if (st) base.docente = st.intercambio === 'SI' ? par : h.docente;
      else { base.pendiente = true; base.posibles = pareja; }
      filas.push(base); return;
    }
    if (enf && /^PAREJA/.test(String(h.alternancia))) {  // énfasis en pareja: un solo grupo, un docente por semana
      var k = h.dia + '|' + h.hora + '|' + h.grupos_enfasis, ya = pares[k];
      if (!ya) { pares[k] = { fila: base, nombres: [h.docente] }; filas.push(base); return; }
      ya.nombres.push(h.docente);
      var pj = ya.nombres.slice().sort(), s2 = estados['ENFASIS|' + h.grupos_enfasis + '|' + pj.join('|')];
      if (s2) ya.fila.docente = s2.elegido; else { ya.fila.pendiente = true; ya.fila.posibles = pj; }
      return;
    }
    filas.push(base);
  });
  return filas;
}

/** Docentes de bachillerato con sus áreas, grupos, áreas y días disponibles. */
function catalogoHorarios_() {
  var filas = horarioEfectivo_(lunesDe_(ymd_(new Date()))), docs = {}, info = {};
  datos_('Docentes').forEach(function (d) { info[d.nombre_completo] = d; });
  filas.forEach(function (f) { (f.posibles.length ? f.posibles : [f.docente]).forEach(function (n) { docs[n] = 1; }); });
  var lista = Object.keys(docs).sort().map(function (n) { var d = info[n] || {}; return { nombre: n, areas: String(d.areas || ''), nota: String(d.nota || '') }; });
  var grupos = datos_('Grupos').filter(function (g) { return esBachillerato_(g.grupo); }).map(function (g) { return { codigo: g.grupo, nombre: g.nombre }; });
  grupos.sort(function (a, b) { return claveGrupo_(a.codigo) - claveGrupo_(b.codigo); });
  var areas = {}; lista.forEach(function (d) { d.areas.split('/').forEach(function (a) { a = a.trim(); if (a) areas[a] = 1; }); });
  return { docentes: lista, grupos: grupos, areas: Object.keys(areas).sort(), franjas: datos_('Franjas').map(function (f) { return { hora: Number(f.hora), inicio: hhmm_(f.inicio), fin: hhmm_(f.fin) }; }) };
}

function directoresDeGrupo_() {
  var nombres = mapaGrupos_(), dir = datos_('Direccion_Grupo'), tienen = {};
  var lista = dir.map(function (g) {
    var docs = [g.docente_1, g.docente_2].filter(function (x) { return String(x || '').trim(); });
    docs.forEach(function (n) { tienen[n] = 1; });
    return { codigo: g.grupo, nombre: nombres[g.grupo] || g.nombre, directores: docs, modalidad: g.modalidad || '' };
  });
  lista.sort(function (a, b) { return claveGrupo_(a.codigo) - claveGrupo_(b.codigo); });
  var bach = {}; horarioEfectivo_(lunesDe_(ymd_(new Date()))).forEach(function (f) { (f.posibles.length ? f.posibles : [f.docente]).forEach(function (n) { bach[n] = 1; }); });
  var sin = Object.keys(bach).filter(function (n) { return !tienen[n]; }).sort();
  return { grupos: lista, sinDireccion: sin };
}

/**
 * Consultas de horarios. p = {modo, ...}
 *  'catalogo'  -> docentes de bachillerato, grupos, áreas, franjas
 *  'docente'   -> {docente, fecha?}  horario semanal (alternancias de esa semana aplicadas)
 *  'grupo'     -> {grupo, fecha?}    horario semanal del grupo
 *  'ahora'     -> {dia?, sesion?}    quiénes deben estar (por bloque), sin necesidad de haber hecho la ronda
 *  'lote'      -> {tipo:'docente'|'grupo', fecha?}  todos los horarios de la semana, para imprimir
 *  'directores'-> directores de grupo de todos los cursos y docentes de bachillerato sin dirección
 */
function consultaHorarios(p) {
  exigirDirectivo_();
  p = p || {};
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date()), semana = lunesDe_(fecha);
  if (p.modo === 'catalogo') return catalogoHorarios_();
  if (p.modo === 'directores') return directoresDeGrupo_();
  if (p.modo === 'docente') {
    var nom = String(p.docente || '');
    var celdas = horarioEfectivo_(semana).filter(function (f) { return f.docente === nom || f.posibles.indexOf(nom) >= 0; });
    return { modo: 'docente', docente: nom, semana: semana, celdas: celdas.map(function (f) {
      var otros = f.posibles.filter(function (n) { return n !== nom; });
      return { dia: f.dia, hora: f.hora, inicio: f.inicio, fin: f.fin, grupo: f.grupo, area: f.area, tipo: f.tipo, equipo: f.equipo, pendiente: f.pendiente,
               alternaCon: f.pendiente ? otros[0] : '', titular: f.pendiente && f.docente === nom };
    }) };
  }
  if (p.modo === 'grupo') {
    var cod = String(p.grupo || '');
    var cel = horarioEfectivo_(semana).filter(function (f) { return f.grupoCodigo.split('+').indexOf(cod) >= 0; });
    return { modo: 'grupo', grupo: (mapaGrupos_()[cod] || cod), semana: semana, celdas: cel.map(function (f) {
      return { dia: f.dia, hora: f.hora, inicio: f.inicio, fin: f.fin, area: f.area, tipo: f.tipo, equipo: f.equipo, pendiente: f.pendiente, docentes: f.pendiente ? f.posibles : [f.docente] };
    }) };
  }
  if (p.modo === 'ahora') {
    var r = consultarSesion(p.dia || null, p.sesion || null, 'bloque');
    return { modo: 'ahora', dia: r.dia, sesion: r.sesion, bloque: r.bloque, franja: r.franja, hora: r.hora, sinEstudiantes: !!r.sinEstudiantes, nota: r.nota,
             reuniones: r.reuniones, filas: r.filas.map(function (f) { return { docente: f.docente, alternos: f.alternos, definido: !!f.definido, grupo: f.grupo, area: f.area, tipo: f.tipo, nota: f.nota,
               sesiones: f.sesiones.map(function (x) { return x.sesion; }) }; }) };
  }
  if (p.modo === 'lote') {   // todos los docentes o todos los grupos de una vez (para imprimir)
    var ef = horarioEfectivo_(semana), cat = catalogoHorarios_();
    if (p.tipo === 'grupo') return { modo: 'lote', tipo: 'grupo', semana: semana, items: cat.grupos.map(function (g) {
      return { grupo: g.nombre, celdas: ef.filter(function (f) { return f.grupoCodigo.split('+').indexOf(g.codigo) >= 0; }).map(function (f) {
        return { dia: f.dia, hora: f.hora, area: f.area, equipo: f.equipo, pendiente: f.pendiente, docentes: f.pendiente ? f.posibles : [f.docente] }; }) }; }) };
    return { modo: 'lote', tipo: 'docente', semana: semana, items: cat.docentes.map(function (d) {
      return { docente: d.nombre, celdas: ef.filter(function (f) { return f.docente === d.nombre || f.posibles.indexOf(d.nombre) >= 0; }).map(function (f) {
        var otros = f.posibles.filter(function (n) { return n !== d.nombre; });
        return { dia: f.dia, hora: f.hora, grupo: f.grupo, area: f.area, equipo: f.equipo, pendiente: f.pendiente, alternaCon: f.pendiente ? otros[0] : '' }; }) }; }) };
  }
  throw new Error('Consulta no válida.');
}

/* ------------------------------ intercambio de Docente 1 y Docente 2 (corrección de horario) ------------------------------ */
/**
 * El rector intercambió en Educación Física (ERD) el horario de «Docente 1» (Arizala Castro Roberto Carlos) con el de «Docente 2» (Terán, hoy
 * reemplazado por Armero Dájome Jesús) y no lo informó a tiempo. Esta corrección pasa de uno al otro el horario y lo ya registrado.
 * Con area vacía se intercambia el horario completo de los dos (Educación Física y Ciencias Naturales, como se hizo con Arte); con area = 'ERD' solo esa área.
 * Con aplicar = false solo cuenta lo que cambiaría. Se hace una sola vez (marca en Parametros) y queda constancia en Bitacora_Cambios.
 * No toca ausencias de jornada completa (JC), «hasta el final» (S#-FIN) ni novedades que no vienen de la ronda: solo las cuenta para revisar.
 */
var ERD_DOCENTE_1 = 'Arizala Castro Roberto Carlos', ERD_DOCENTE_2 = 'Armero Dájome Jesús', MARCA_INTERCAMBIO_ERD = 'intercambio_erd_docente1_2';

function cortoDocente_(nombre) {
  var d = datos_('Docentes').filter(function (x) { return x.nombre_completo === nombre; })[0];
  return d ? String(d.apellidos).split(/\s+/)[0] + ' ' + String(d.nombres).split(/\s+/)[0].charAt(0) + '.' : nombre;
}

function intercambioDocentes_(a, b, area, aplicar) {
  var res = { horario: 0, registro: 0, novedades: 0, incumplimientos: 0, alternancia: 0, matriz: 0, jornadaRevisar: 0, otrasRevisar: 0, choques: [] };
  function cambia(x) { return x === a ? b : (x === b ? a : x); }
  function mueve(areaFila) { return !area || String(areaFila) === area; }
  /** Cambia los nombres de una columna de una hoja en las filas que cumplan «cond»; escribe solo esa columna. Devuelve las filas cambiadas. */
  function columna(nombreHoja, columnaNombre, cond) {
    var sh = hoja_(nombreHoja); if (!sh) return 0;
    var v = sh.getDataRange().getValues(), cab = v[0], c = {}; cab.forEach(function (k, i) { c[k] = i; });
    if (c[columnaNombre] == null) return 0;
    var n = 0, sal = [];
    for (var i = 1; i < v.length; i++) {
      var x = v[i][c[columnaNombre]], y = x;
      if ((x === a || x === b) && cond(v[i], c)) { y = cambia(x); n++; }
      sal.push([y]);
    }
    if (aplicar && n) sh.getRange(2, c[columnaNombre] + 1, sal.length, 1).setValues(sal);
    return n;
  }
  // 1) Horario (docente y número de docente)
  var hz = hoja_('Horario'), hv = hz.getDataRange().getValues(), hc = {}; hv[0].forEach(function (k, i) { hc[k] = i; });
  var numero = {}; for (var i = 1; i < hv.length; i++) numero[hv[i][hc.docente]] = hv[i][hc.docente_n];
  var colN = [], colD = [], enfasis = {}, ocupa = {};
  for (var j = 1; j < hv.length; j++) {
    var fila = hv[j], nom = fila[hc.docente], toca = (nom === a || nom === b) && mueve(fila[hc.area]);
    var nuevo = toca ? cambia(nom) : nom;
    if (toca) { res.horario++; if (fila[hc.tipo] === 'ENFASIS') enfasis[String(fila[hc.grupos_enfasis])] = 1; }
    colN.push([toca ? numero[nuevo] : fila[hc.docente_n]]); colD.push([nuevo]);
    var k = nuevo + '|' + fila[hc.dia] + '|' + fila[hc.hora]; (ocupa[k] = ocupa[k] || []).push(String(fila[hc.celda_original] || fila[hc.grupo] || fila[hc.area]));
  }
  Object.keys(ocupa).forEach(function (k) { if (ocupa[k].length > 1 && (k.indexOf(a + '|') === 0 || k.indexOf(b + '|') === 0)) res.choques.push(k.replace(/\|/g, ' · ') + ': ' + ocupa[k].join(' y ')); });
  if (aplicar && res.horario) {
    hz.getRange(2, hc.docente_n + 1, colN.length, 1).setValues(colN); hz.getRange(2, hc.docente + 1, colD.length, 1).setValues(colD);
  }
  // 2) Lo registrado: son marcas por sesión (de quien tenía asignado el horario), así que pasan al otro docente
  res.registro = columna('Registro_Ronda', 'docente', function (f, c) { return mueve(f[c.area]); });
  var nv = hoja_('Novedades');
  if (nv) {
    var vv = nv.getDataRange().getValues(), cn = {}; vv[0].forEach(function (k, i) { cn[k] = i; });
    var iDoc = cn['Docente'], iArea = cn['Área/Asignatura'], iSes = cn['Sesiones'], iFu = cn['Fuente Novedad'];
    var sal = [], n = 0;
    for (var m = 1; m < vv.length; m++) {
      var r = vv[m], nombre = r[iDoc], nuevoN = nombre;
      if ((nombre === a || nombre === b) && mueve(r[iArea])) {
        var ses = String(r[iSes]);
        if (r[iFu] === FUENTE_RONDA && /^S\d$/.test(ses)) { nuevoN = cambia(nombre); n++; }
        else if (ses === 'JC' || /-FIN$/.test(ses)) res.jornadaRevisar++;
        else res.otrasRevisar++;
      }
      sal.push([nuevoN]);
    }
    res.novedades = n;
    if (aplicar && n) nv.getRange(2, iDoc + 1, sal.length, 1).setValues(sal);
  }
  res.incumplimientos = columna('Incumplimientos', 'docente', function (f, c) { return mueve(f[c.area]); });
  // 3) Parejas de énfasis (Semana_Alternancia): la clave lleva los dos nombres en orden alfabético
  var sa = hoja_('Semana_Alternancia');
  if (sa) {
    var sv = sa.getDataRange().getValues(), cs = {}; sv[0].forEach(function (k, i) { cs[k] = i; });
    var claves = [], elegidos = [], tocados = 0;
    for (var q = 1; q < sv.length; q++) {
      var cl = String(sv[q][cs.clave]), el = sv[q][cs.elegido], partes = cl.split('|'), cl2 = cl, el2 = el;
      if (partes[0] === 'ENFASIS' && (!area || enfasis[partes[1]]) && (partes.slice(2).indexOf(a) >= 0 || partes.slice(2).indexOf(b) >= 0)) {
        cl2 = partes.slice(0, 2).concat(partes.slice(2).map(cambia).sort()).join('|'); el2 = cambia(el); tocados++;
      }
      claves.push([cl2]); elegidos.push([el2]);
    }
    res.alternancia = tocados;
    if (aplicar && tocados) { sa.getRange(2, cs.clave + 1, claves.length, 1).setValues(claves); sa.getRange(2, cs.elegido + 1, elegidos.length, 1).setValues(elegidos); }
  }
  // 4) Matriz_Grupos (texto «Apellido N. (ÁREA)» en cada celda)
  var mx = hoja_('Matriz_Grupos');
  if (mx && mx.getLastRow() > 1) {
    var rg = mx.getRange(2, 4, mx.getLastRow() - 1, mx.getLastColumn() - 3), mv = rg.getValues(), ca = cortoDocente_(a), cb = cortoDocente_(b), cambiadas = 0;
    var suf = area ? ' (' + area + ')' : ' (';
    mv.forEach(function (fm) { fm.forEach(function (t, i) {
      if (typeof t !== 'string' || (t.indexOf(ca + suf) < 0 && t.indexOf(cb + suf) < 0)) return;
      fm[i] = t.split(ca + suf).join('\u0001').split(cb + suf).join(ca + suf).split('\u0001').join(cb + suf); cambiadas++;
    }); });
    res.matriz = cambiadas;
    if (aplicar && cambiadas) rg.setValues(mv);
  }
  return res;
}

function textoIntercambio_(r, aplicado) {
  return (aplicado ? 'Corrección aplicada.\n' : 'Esto es lo que se cambiaría:\n') +
    '\nHorario: ' + r.horario + ' filas\nMarcas de la ronda: ' + r.registro + '\nNovedades de la ronda (por sesión): ' + r.novedades + '\nIncumplimientos: ' + r.incumplimientos +
    '\nParejas de énfasis definidas: ' + r.alternancia + '\nCeldas de Matriz_Grupos: ' + r.matriz +
    (r.jornadaRevisar || r.otrasRevisar ? '\n\nNO se tocan (revisar a mano en Novedades): ' + r.jornadaRevisar + ' de jornada completa o «hasta el final» y ' + r.otrasRevisar + ' reportadas por formulario o WhatsApp, que son de la persona.' : '') +
    (r.choques.length ? '\n\nATENCIÓN, quedarían ' + r.choques.length + ' casos de un docente en dos sitios a la vez:\n' + r.choques.slice(0, 8).join('\n') : '');
}

/** Menú: «Corregir Docente 1 y 2 de Educación Física». Muestra primero lo que cambiaría y pide confirmar; se hace una sola vez. */
function corregirDocentes1y2EducacionFisica() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi();
  if (parametro_(MARCA_INTERCAMBIO_ERD, '')) { ui.alert('Esta corrección ya se aplicó el ' + parametro_(MARCA_INTERCAMBIO_ERD, '') + '. No se repite.'); return; }
  var area = '';   // horario completo de los dos (Educación Física y Ciencias Naturales), confirmado por el coordinador
  var previa = intercambioDocentes_(ERD_DOCENTE_1, ERD_DOCENTE_2, area, false);
  if (ui.alert('Vista previa', textoIntercambio_(previa, false) + '\n\n¿Aplicar ahora? (se hace una sola vez)', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var r = intercambioDocentes_(ERD_DOCENTE_1, ERD_DOCENTE_2, area, true);
  guardarParametro_(MARCA_INTERCAMBIO_ERD, ymd_(new Date()) + (area ? ' (solo ' + area + ')' : ' (horario completo)'));
  bitacora_('Intercambio Docente 1 y 2', ERD_DOCENTE_1 + ' ↔ ' + ERD_DOCENTE_2 + (area ? ' solo ' + area : ' todo') + ': horario ' + r.horario + ', marcas ' + r.registro + ', novedades ' + r.novedades + ', incumplimientos ' + r.incumplimientos);
  ui.alert(textoIntercambio_(r, true));
}

/* ------------------------------ recuperar la visibilidad de las marcas de la ronda ------------------------------ */
/**
 * Las marcas de la ronda (Registro_Ronda) se ven en la tarjeta del docente que hoy tiene ese horario (o su pareja que alterna). Si el horario
 * cambió y una marca quedó a nombre de alguien que ya no tiene esa sesión, la ronda la muestra «sin marcar». Aquí se cuentan esas marcas
 * y, al aplicar, se pasan al docente que hoy tiene esa sesión y ese grupo (el docente puede quedar «cambiado», pero la marca vuelve a verse).
 * No borra nada ni toca las demás columnas.
 */
function revisarRegistrosRonda_(aplicar) {
  var altern = alternancias_(), ocupa = {}, hz = datos_('Horario');
  function cod(x) { x = String(x == null ? '' : x).replace(/^'/, ''); while (/^\d+$/.test(x) && x.length < 4) x = '0' + x; return x; }
  hz.forEach(function (h) {
    var k = h.dia + '|' + Number(h.hora), grupos = String(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo).split('+').map(cod);
    (ocupa[k] = ocupa[k] || []).push({ docente: h.docente, area: String(h.area || ''), grupos: grupos, socio: parAlterna_(h, altern) });
  });
  var sh = hoja_('Registro_Ronda'), res = { total: 0, porFecha: {}, huerfanas: 0, corregidas: 0, sinResolver: 0, ejemplos: [] };
  if (!sh) return res;
  var v = sh.getDataRange().getValues(), c = {}; v[0].forEach(function (k, i) { c[k] = i; });
  var sal = [];
  for (var i = 1; i < v.length; i++) {
    var fila = v[i], doc = fila[c.docente], nuevo = doc;
    res.total++;
    var f = fechaIso_(fila[c.fecha]); res.porFecha[f] = (res.porFecha[f] || 0) + 1;
    var lista = ocupa[fila[c.dia] + '|' + Number(fila[c.sesion])] || [];
    var validos = {}; lista.forEach(function (o) { validos[o.docente] = 1; if (o.socio) validos[o.socio] = 1; });
    if (lista.length && !validos[doc]) {
      res.huerfanas++;
      var g = cod(fila[c.grupo]), area = String(fila[c.area] || '');
      var cand = lista.filter(function (o) { return o.grupos.indexOf(g) >= 0 && (o.area === area || !area); });
      if (!cand.length) cand = lista.filter(function (o) { return o.grupos.indexOf(g) >= 0; });
      if (cand.length === 1) { nuevo = cand[0].docente; res.corregidas++; if (res.ejemplos.length < 6) res.ejemplos.push(f + ' S' + fila[c.sesion] + ': ' + doc + ' → ' + nuevo); }
      else res.sinResolver++;
    }
    sal.push([nuevo]);
  }
  if (aplicar && res.corregidas) sh.getRange(2, c.docente + 1, sal.length, 1).setValues(sal);
  return res;
}

/** Menú: «Revisar y recuperar marcas de la ronda». Cuenta las marcas por fecha, muestra cuántas no se ven y, al confirmar, las devuelve a la vista. */
function recuperarMarcasRonda() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi(), r = revisarRegistrosRonda_(false);
  var fechas = Object.keys(r.porFecha).sort().slice(-8).map(function (f) { return f + ': ' + r.porFecha[f]; }).join('\n');
  var txt = 'Marcas guardadas en Registro_Ronda: ' + r.total + '\nÚltimas fechas:\n' + fechas + '\n\nMarcas que la ronda hoy no muestra (a nombre de quien ya no tiene esa sesión): ' + r.huerfanas +
    '\nSe pueden devolver a la vista: ' + r.corregidas + '\nSin poder decidir: ' + r.sinResolver + (r.ejemplos.length ? '\n\nEjemplos:\n' + r.ejemplos.join('\n') : '');
  if (!r.corregidas) { ui.alert('Marcas de la ronda', txt + '\n\nNo hay nada que recuperar con este método.', ui.ButtonSet.OK); return; }
  if (ui.alert('Marcas de la ronda', txt + '\n\n¿Devolverlas a la vista ahora? (solo cambia el nombre del docente en esas filas)', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var a = revisarRegistrosRonda_(true);
  bitacora_('Recuperó marcas de la ronda', a.corregidas + ' marcas pasadas al docente que hoy tiene esa sesión');
  ui.alert('Listo: ' + a.corregidas + ' marcas vuelven a verse en la ronda.');
}
