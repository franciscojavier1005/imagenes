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
    var par = h.tipo === 'CLASE' ? altern[h.area + '|' + h.docente] : '';
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
  throw new Error('Consulta no válida.');
}
