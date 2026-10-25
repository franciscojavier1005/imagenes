/**
 * ICET 2026 - Control de asistencia docente (ronda de verificación)
 * Autor: Francisco Javier Cortés Cabezas, coordinador académico; especialista en informática y telemática, magíster en educación, doctorando en desarrollo de la educación. I.E. ICET (Tumaco, Nariño). © 2026
 *
 * Instalación: abrir el libro en Google Sheets > Extensiones > Apps Script,
 * pegar este archivo como Codigo.gs y crear el archivo HTML "Consulta" con Consulta.html.
 * Luego: Implementar > Nueva implementación > Aplicación web
 *        (ejecutar como: el usuario que accede; acceso: solo directivos).
 *
 * Panel: Dashboard.gs + Dashboard.html. Informe al rector: Dashboard.gs. Cálculo del resumen: Resumen.gs.
 * Hojas que usa: Horario, Franjas, Grupos, Direccion_Grupo, Motivos, Listas, Directivos, Registro_Ronda, Novedades.
 */
/**
 * Sistema de control de asistencia docente - I.E. ICET, San Andrés de Tumaco (Nariño, Colombia).
 * Autor: Francisco Javier Cortés Cabezas, coordinador académico. © 2026.
 */
var AUTORIA = 'Sistema de control de asistencia docente\nAutor: Francisco Javier Cortés Cabezas\nCoordinador académico\nEspecialista en Informática y Telemática · Magíster en Educación · Doctorando en Desarrollo de la Educación\nI.E. ICET, San Andrés de Tumaco (Nariño, Colombia)\n© 2026';

var TZ = 'America/Bogota';
var DIAS = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
var MEDIO_RONDA = 'Inspección ocular/Ronda supervisión';
var FUENTE_RONDA = 'Coordinador(a)';

function onOpen() {
  try { if (hoja_('Horario') && datos_('Horario').some(function (h) { return /^00/.test(String(h.grupo)) && Number(h.hora) === 2; })) actualizarHorarioPreescolar_(); } catch (e) { /* sin permiso de edición: se hace desde el menú */ }   // horario viejo de preescolar (5 periodos = 300 min)
  if (typeof leemeAlDia_ === 'function') leemeAlDia_();
  SpreadsheetApp.getUi().createMenu('Asistencia ICET')
    .addItem('Crear formulario de novedades (desplegables)', 'crearFormulario')
    .addItem('Actualizar horario de preescolar (una sola vez)', 'actualizarHorarioPreescolar')
    .addItem('Importar bandeja de WhatsApp (filas marcadas SI)', 'importarBandejaWhatsApp')
    .addItem('Generar claves de ingreso de los directivos', 'generarClavesDirectivos')
    .addItem('Restablecer la clave de un directivo', 'restablecerClaveDirectivo')
    .addItem('Acerca de este sistema', 'acercaDe')
    .addItem('Actualizar hoja LEEME (versión y cambios)', 'actualizarLeeme')
    .addItem('Quitar reuniones repetidas', 'quitarReunionesDuplicadasLibro')
    .addItem('Corregir Docente 1 y 2 de Educación Física (una vez)', 'corregirDocentes1y2EducacionFisica')
    .addItem('Revisar y recuperar marcas de la ronda', 'recuperarMarcasRonda')
    .addItem('Recuperar rondas desde una copia del libro', 'recuperarRondasDesdeCopia')
    .addItem('Respaldar rondas ahora (libro de respaldo)', 'respaldarTodoAhora')
    .addItem('Borrar audios de ronda antiguos', 'purgarAudios')
    .addItem('Compartir con directivos (correos reales)', 'compartirConDirectivos')
    .addItem('Ver instrucciones de la ronda', 'mostrarUrlConsulta')
    .addSeparator()
    .addItem('Informe al rector: enviar prueba ahora', 'probarInformeDiario')
    .addItem('Informe al rector: programar envío diario', 'programarInformeDiario')
    .addToUi();
}

/* ------------------------------ utilidades ------------------------------ */
function hoja_(n) { return SpreadsheetApp.getActive().getSheetByName(n); }

/**
 * Hojas que casi nunca cambian (horario, franjas, motivos, grupos, parejas, docentes, listas): se guardan 10 minutos en la caché del script para no
 * releerlas de la hoja de cálculo en cada pantalla (leer es lo que más tarda). Se borran solas al editar esas hojas (onEdit) y desde las herramientas
 * que las cambian (invalidarCache_()).
 */
var HOJAS_CACHE = { Horario: 1, Franjas: 1, Motivos: 1, Grupos: 1, Direccion_Grupo: 1, Alternancias: 1, Listas: 1, Docentes: 1 };
var CACHE_SEG = 600, CACHE_TROZO = 90000;
function cacheOk_() { return typeof CacheService !== 'undefined' && CacheService.getScriptCache; }
function cacheLee_(n) {
  try {
    var c = CacheService.getScriptCache(), k = 'ICETv1:' + n, meta = c.get(k + ':n');
    if (!meta) return null;
    var claves = []; for (var i = 0; i < Number(meta); i++) claves.push(k + ':' + i);
    var got = c.getAll(claves), txt = '';
    for (var j = 0; j < claves.length; j++) { if (got[claves[j]] == null) return null; txt += got[claves[j]]; }
    return JSON.parse(txt, function (key, val) { return val && val.__d != null ? new Date(val.__d) : val; });
  } catch (e) { return null; }
}
function cacheEscribe_(n, v) {
  try {
    var c = CacheService.getScriptCache(), k = 'ICETv1:' + n, txt = JSON.stringify(v, function (key, val) { var raw = this[key]; return raw instanceof Date ? { __d: raw.getTime() } : val; }), obj = {}, t = 0;
    for (var i = 0; i < txt.length; i += CACHE_TROZO) obj[k + ':' + (t++)] = txt.substr(i, CACHE_TROZO);
    if (t > 40) return;   // demasiado grande para la caché: se lee siempre de la hoja
    obj[k + ':n'] = String(t); c.putAll(obj, CACHE_SEG);
  } catch (e) { /* sin caché: se lee de la hoja */ }
}
/** Borra la caché de una hoja (o de todas). Llamar después de cambiar esas hojas desde el código. */
function invalidarCache_(n) {
  if (!cacheOk_()) return;
  try {
    var c = CacheService.getScriptCache(), nombres = n ? [n] : Object.keys(HOJAS_CACHE), claves = [];
    nombres.forEach(function (x) { var meta = c.get('ICETv1:' + x + ':n'); claves.push('ICETv1:' + x + ':n'); for (var i = 0; i < Number(meta || 0); i++) claves.push('ICETv1:' + x + ':' + i); });
    c.removeAll(claves);
  } catch (e) { /* nada que borrar */ }
}
/** Se ejecuta sola al editar la hoja a mano: si es una hoja en caché, la borra para que el cambio se vea de inmediato. */
function onEdit(e) { try { var nom = e && e.range && e.range.getSheet().getName(); if (nom && HOJAS_CACHE[nom]) invalidarCache_(nom); } catch (x) { /* nada */ } }
function valores_(n) {
  if (HOJAS_CACHE[n] && cacheOk_()) {
    var c = cacheLee_(n); if (c) return c;
    var v = hoja_(n).getDataRange().getValues(); cacheEscribe_(n, v); return v;
  }
  return hoja_(n).getDataRange().getValues();
}
function datos_(n) {
  var v = valores_(n), h = v.shift();
  return v.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o;
  });
}

function hhmm_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'HH:mm') : String(v).trim(); }
function ymd_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }

function mapaGrupos_() {
  var m = {};
  datos_('Grupos').forEach(function (g) { m[g.grupo] = g.nombre; });
  return m;
}

/** {grupo: {dir: 'Quiñones M. / Montaño F.', modalidad: 'ACELERACIÓN DEL APRENDIZAJE'}} */
function mapaDireccion_() {
  var m = {};
  datos_('Direccion_Grupo').forEach(function (g) { m[g.grupo] = { dir: g.dinamizadores, modalidad: g.modalidad }; });
  return m;
}

/** '0601' -> {grado:'06', grupo:'1'}; 'CS101' -> {grado:'CS1', grupo:'1'} */
function partesGrupo_(g) {
  g = String(g || '');
  if (g === 'ORIENT') return { grado: 'ORI', grupo: '0' };
  if (g === 'PTAFI') return { grado: 'PTA', grupo: '0' };
  if (/^CS\d{3}$/.test(g)) return { grado: g.substr(0, 3), grupo: g.substr(4) };
  if (/^\d{4}$/.test(g)) return { grado: g.substr(0, 2), grupo: String(Number(g.substr(2))) };
  return { grado: 'N/A', grupo: 'N/A' };
}

/** Sesión actual (1-8) o null en descanso / fuera de jornada. */
function sesionAhora_(d) {
  var hm = Utilities.formatDate(d, TZ, 'HH:mm'), r = null;
  datos_('Franjas').forEach(function (f) {
    if (hhmm_(f.inicio) <= hm && hm < hhmm_(f.fin)) r = Number(f.hora);
  });
  return r;
}

/* ------------------------------ ronda (aplicación web) ------------------------------ */
/** ?p=ronda (por defecto) abre la ronda; ?p=panel abre el panel (dashboard). */
function doGet(e) {
  // En el BACK (propiedad MODO_BACK = SI) esta dirección solo responde a la API: no se sirve ninguna pantalla, porque el back se
  // ejecuta con los permisos del propietario y cualquiera con el enlace podría abrirla.
  if (PropertiesService.getScriptProperties().getProperty('MODO_BACK') === 'SI') {
    return ContentService.createTextOutput('ICET API').setMimeType(ContentService.MimeType.TEXT);
  }
  var pag = (e && e.parameter && e.parameter.p) || 'menu';   // sin parámetros abre el menú de entrada
  var PAGINAS = { menu: ['Menu', 'ICET - Control de asistencia docente'], novedad: ['Novedad', 'ICET - Registrar novedades'], ronda: ['Consulta', 'ICET - Ronda de asistencia docente'], reunion: ['Reunion', 'ICET - Reuniones y actividades'], horarios: ['Horarios', 'ICET - Horarios y listados'], ayuda: ['Ayuda', 'ICET - Ayuda y manual de uso'], panel: ['Dashboard', 'ICET - Panel de asistencia docente'] };
  var pg = PAGINAS[pag] || PAGINAS.menu;
  return HtmlService.createHtmlOutputFromFile(pg[0])
    .setTitle(pg[1])
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Docentes que deben estar en la sesión indicada. Sin argumentos usa el día y la hora actuales.
 * También devuelve las listas para los radios (motivos, medios, fuentes).
 */
/**
 * Novedades del día de un docente que corresponden a las sesiones de esta pantalla: la de toda la jornada (JC) siempre; las de una sesión (S3), las de «hasta el final»
 * (S3-FIN: esa sesión y las siguientes) solo si caen en las sesiones mostradas. Devuelve null si ninguna aplica. Si son por horas, trae «parcial» con el estado a marcar.
 */
function reporteParaSesiones_(rep, sesiones) {
  if (!rep) return null;
  var jc = rep.filas.some(function (f) { return f.sesiones === 'JC'; });
  var aplican = rep.filas.filter(function (f) {
    if (f.sesiones === 'JC') return true;
    var m = String(f.sesiones).match(/^S(\d)(-FIN)?$/); if (!m) return false;
    var n = Number(m[1]);
    return sesiones.some(function (x) { return m[2] ? x >= n : x === n; });
  });
  if (!aplican.length) return null;
  var o = {}; for (var k in rep) o[k] = rep[k];
  o.jornada = jc;
  if (!jc) {
    var f0 = aplican[0], min = 0; aplican.forEach(function (f) { min += f.minutos; });
    var est = { 'No asistió': 'No asistió', 'Ausente temporal': 'Ausente temporal', 'Llegada tarde informada': 'Llegada tarde', 'Salida temprana informada': 'Salida temprana' }[f0.tipo];
    o.tipo = f0.tipo; o.motivo = f0.motivo || o.motivo; o.atiende = f0.atiende; o.actividad = f0.actividad;
    if (est) o.parcial = { estado: est, motivo: f0.motivo || 'Sin justificación', minutos: min, atiende: f0.atiende, actividad: f0.actividad };
  }
  delete o.filas;
  return o;
}
function consultarSesion(dia, sesion, modo, fecha) {
  exigirDirectivo_();
  asegurarMotivos_();
  var ahora = new Date(), hoyS = ymd_(ahora), revision = false;
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(fecha)) && String(fecha) !== hoyS) {   // consulta de la ronda de otra fecha (solo lectura): día hábil de hoy hacia atrás
    if (String(fecha) > hoyS) throw new Error('Elija una fecha de hoy o anterior.');
    var dw = resDia_(String(fecha));
    if (dw < 1 || dw > 5) throw new Error('Elija un día hábil (lunes a viernes).');
    revision = true; dia = DIAS[dw];
  }
  var auto = !dia && !sesion;
  dia = dia || DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))];
  var s = sesion ? Number(sesion) : (revision ? 1 : sesionAhora_(ahora));
  var fr = datos_('Franjas').filter(function (f) { return Number(f.hora) === s; })[0];
  var out = {
    dia: dia, diaHoy: DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))], sesion: s, auto: auto, hora: Utilities.formatDate(ahora, TZ, 'HH:mm'), fecha: revision ? String(fecha) : hoyS, revision: revision,
    franja: fr ? hhmm_(fr.inicio) + ' - ' + hhmm_(fr.fin) : '', bloque: fr ? Number(fr.bloque) : null, modo: modo === 'bloque' ? 'bloque' : 'sesion',
    sesionesBloque: [],
    filas: [], motivos: datos_('Motivos'), listas: datos_('Listas'),
    directivos: datos_('Directivos').map(function (d) { return d.nombre; }),
    puedeCambiarAlt: (function () { try { return puedeCambiarAsignacion_(identidad_()); } catch (e) { return false; } })(),
    sesionDe: (function () { try { var i = identidad_(); return i.rol === 'directivo' ? (i.nombre || '') : ''; } catch (e) { return ''; } })(),   // quien inició sesión: sale preseleccionado como responsable de la ronda
    nota: s ? '' : (auto ? 'Descanso o fuera de jornada' : 'Sesión no válida')
  };
  if (!s) return out;
  // por bloque: la visita cuenta para las dos sesiones del bloque (si no llegó en la primera, no estará en la segunda)
  var hs = [s];
  if (out.modo === 'bloque' && fr) {
    var delBloque = datos_('Franjas').filter(function (f) { return Number(f.bloque) === Number(fr.bloque); }).sort(function (a, b) { return Number(a.hora) - Number(b.hora); });
    hs = delBloque.map(function (f) { return Number(f.hora); });
    out.sesionesBloque = hs;
    out.franja = hhmm_(delBloque[0].inicio) + ' - ' + hhmm_(delBloque[delBloque.length - 1].fin);
  }
  var nombres = mapaGrupos_(), direccion = mapaDireccion_();
  var reportes = {}, externas = {};   // novedades de hoy ya registradas (pantalla de novedades, formulario, WhatsApp o ronda anterior)
  var novHoy = datos_('Novedades');
  novHoy.forEach(function (n) {
    if (fechaIso_(n['Fecha Novedad']) === out.fecha && n['Tipo Novedad'] === TIPO_EXTERNA) {
      var e = externas[n['Docente']] = externas[n['Docente']] || { sesiones: {}, jc: false, motivo: n['Motivo Ausencia'], texto: String(n['Descripción'] || '').slice(0, 160) };
      if (String(n['Sesiones']) === 'JC') e.jc = true; else e.sesiones[String(n['Sesiones']).replace('S', '')] = 1;
      return;
    }
    if (fechaIso_(n['Fecha Novedad']) === out.fecha && n['Tipo Novedad'] && n['Tipo Novedad'] !== 'Presente') {
      var d = n['Docente'], medio = String(n['Medio Información'] || '');
      var rp = reportes[d] = { tipo: n['Tipo Novedad'], motivo: n['Motivo Ausencia'], texto: String(n['Descripción'] || '').slice(0, 160), medio: medio,
                      jornada: String(n['Sesiones']) === 'JC', atiende: String(n['Grupo atendido por'] || ''), actividad: String(n['Actividad de Aprendizaje'] || ''), filas: (reportes[d] && reportes[d].filas) || [] };
      rp.filas.push({ sesiones: String(n['Sesiones']), tipo: String(n['Tipo Novedad']), motivo: String(n['Motivo Ausencia'] || ''), minutos: Number(n['Minutos Desatendidos']) || 0,
                      atiende: String(n['Grupo atendido por'] || ''), actividad: String(n['Actividad de Aprendizaje'] || '') });
    }
  });
  var yaMarcados = {}, regHoy = [];
  datos_('Registro_Ronda').forEach(function (r) {
    var f = r.fecha instanceof Date ? ymd_(r.fecha) : String(r.fecha);
    if (f === out.fecha && hs.indexOf(Number(r.sesion)) >= 0) { regHoy.push(r); if (!yaMarcados[r.docente]) yaMarcados[r.docente] = r; }
  });
  var altern = alternancias_(), totDia = {};
  var horarioDia = datos_('Horario').filter(function (h) { return h.dia === dia; });
  horarioDia.forEach(function (h) { totDia[h.docente] = (totDia[h.docente] || 0) + minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
  var fuente = horarioDia.filter(function (h) { return hs.indexOf(Number(h.hora)) >= 0; })
    .sort(function (a, b) { return Number(a.hora) - Number(b.hora); });
  /* Marcas a nombre de quien ya no tiene esa sesión (cambios de horario): se muestran en la tarjeta de quien hoy tiene esa sesión y ese grupo, para que nada se vea «sin marcar» */
  var ocupantes = {}, huerfanas = {};
  fuente.forEach(function (h) { ocupantes[h.docente] = 1; var so = parAlterna_(h, altern); if (so) ocupantes[so] = 1; });
  regHoy.forEach(function (r) { if (!ocupantes[r.docente]) huerfanas[claveSlot_(r.sesion, r.grupo, r.area)] = huerfanas[claveSlot_(r.sesion, r.grupo, r.area)] || r; });
  out.filas = fuente.map(function (h) {
    var enf = h.tipo === 'ENFASIS';
    var nota = [/^00/.test(String(h.grupo)) ? 'Preescolar ' + hhmm_(h.inicio) + ' - ' + hhmm_(h.fin) : '', h.alternancia, h.equipo_enfasis ? 'Con: ' + h.equipo_enfasis : ''].filter(String).join(' · ');
    var ya = yaMarcados[h.docente] || huerfanas[claveSlot_(h.hora, enf ? h.grupos_enfasis : h.grupo, h.area || '(énfasis)')];
    return {
      docente: h.docente, grupoCodigo: enf ? h.grupos_enfasis : h.grupo,
      grupo: enf ? 'ÉNFASIS ' + String(h.grupos_enfasis).split('+').map(function (g) { return nombres[g] || g; }).join(' + ')
                 : (nombres[h.grupo] || h.grupo),
      area: h.area || '(énfasis)', tipo: h.tipo, nota: nota,
      dir: h.tipo === 'AREAS_MULTIPLES' ? '' : ((direccion[String(enf ? h.grupos_enfasis : h.grupo).split('+')[0]] || {}).dir || ''),
      modalidad: (direccion[String(enf ? h.grupos_enfasis : h.grupo).split('+')[0]] || {}).modalidad || '',
      sesiones: [{ sesion: Number(h.hora), grupoCodigo: enf ? h.grupos_enfasis : h.grupo, area: h.area || '(énfasis)',
                   grupo: enf ? 'ÉNFASIS ' + String(h.grupos_enfasis).split('+').map(function (g) { return nombres[g] || g; }).join(' + ') : (nombres[h.grupo] || h.grupo) }],
      _par: h.tipo === 'ENFASIS' && /^PAREJA/.test(String(h.alternancia)) ? h.hora + '|' + h.grupos_enfasis : '',
      alternos: parAlterna_(h, altern) ? [parAlterna_(h, altern)] : [],   // pareja que alterna por semana: se elige quién dicta
      primario: h.docente,
      pareja: parAlterna_(h, altern) ? [h.docente, parAlterna_(h, altern)].sort() : null,
      claveAlt: parAlterna_(h, altern) ? 'CLASE|' + h.area + '|' + [h.docente, parAlterna_(h, altern)].sort().join('|') : '',
      minutosDia: totDia[h.docente] || 0,
      reporte: reportes[h.docente] || null,
      previo: ya ? { estado: ya.estado, motivo: ya.motivo, minutos: ya.minutos, observaciones: ya.observaciones, atendidoPor: ya.atendido_por || '' } : null
    };
  });
  // énfasis en pareja (7°): un solo grupo que atiende un docente por semana, no se divide: una tarjeta con los dos nombres
  var pares = {}, sinPar = [];
  out.filas.forEach(function (f) {
    if (!f._par) { sinPar.push(f); return; }
    var k = pares[f._par];
    if (!k) { pares[f._par] = f; sinPar.push(f); return; }
    var pri = f.docente < k.docente ? f : k, otro = pri === f ? k : f;
    pri.alternos = (pri.alternos || []).concat([otro.docente]);
    pri.pareja = [pri.docente, otro.docente].sort(); pri.claveAlt = 'ENFASIS|' + String(pri.grupoCodigo) + '|' + pri.pareja.join('|');
    if (pri === f) { pares[f._par] = f; sinPar[sinPar.indexOf(k)] = f; }
  });
  out.filas = sinPar;
  out.filas.forEach(function (f) { delete f._par; });
  // lo ya definido para la semana: aparece solo quien dicta (y su pareja queda como la otra persona)
  var estados = estadosSemana_(lunesDe_(out.fecha));
  out.filas.forEach(function (f) {
    var st = f.claveAlt ? estados[f.claveAlt] : null;
    if (!st) return;
    var nuevo = /^CLASE/.test(f.claveAlt) ? (st.intercambio === 'SI' ? f.pareja.filter(function (n) { return n !== f.primario; })[0] : f.primario) : st.elegido;
    f.docente = nuevo; f.alternos = []; f.definido = { por: st.por, auto: !!st.auto };
    f.reporte = reportes[nuevo] || null; f.minutosDia = totDia[nuevo] || 0;
    var ya2 = yaMarcados[nuevo]; if (!ya2) f.sesiones.forEach(function (x) { ya2 = ya2 || huerfanas[claveSlot_(x.sesion, x.grupoCodigo, x.area)]; });
    f.previo = ya2 ? { estado: ya2.estado, motivo: ya2.motivo, minutos: ya2.minutos, observaciones: ya2.observaciones, atendidoPor: ya2.atendido_por || '' } : null;
  });
  out.filas.forEach(function (f) { f.reporte = reporteParaSesiones_(reportes[f.docente], hs); });   // solo las novedades que caen en las sesiones mostradas
  if (out.modo === 'bloque') {   // una tarjeta por docente: sus sesiones del bloque quedan juntas
    var por = {}, uni = [];
    out.filas.forEach(function (f) {
      var k = por[f.docente];
      if (!k) { por[f.docente] = f; uni.push(f); return; }
      k.sesiones = k.sesiones.concat(f.sesiones);
      f.alternos.forEach(function (a) { if (k.alternos.indexOf(a) < 0) k.alternos.push(a); });
    });
    uni.forEach(function (f) {
      var gs = f.sesiones.map(function (x) { return x.grupo; }).filter(function (g, i, a) { return a.indexOf(g) === i; });
      if (gs.length > 1) f.nota = [f.sesiones.map(function (x) { return 'S' + x.sesion + ': ' + x.grupo; }).join(' · '), f.nota].filter(String).join(' · ');
      else if (f.sesiones.length === 1 && hs.length > 1) f.nota = ['Solo S' + f.sesiones[0].sesion, f.nota].filter(String).join(' · ');
    });
    out.filas = uni;
  }
  // reuniones que se cruzan con este horario (se registran en la pantalla de reuniones): quien está en la reunión no se marca ausente
  var reun = reunionesEnSesiones_(out.fecha, hs, datos_('Franjas'));
  out.reuniones = reun.map(function (r) { return { id: r.id, nombre: r.nombre, tipo: r.tipo, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes }; });
  if (reun.some(function (r) { return r.sinEstudiantes; })) {
    out.sinEstudiantes = true; out.filas = [];
    out.nota = 'Hay una reunión, actividad o jornada sin clases en este horario (' + reun.filter(function (r) { return r.sinEstudiantes; })[0].nombre + '): no se hace ronda de aula. La asistencia se registra en Reuniones.';
  } else {
    out.filas.forEach(function (f) {
      for (var i = 0; i < reun.length; i++) if (convocadoA_(reun[i], f.docente)) { f.reunion = { id: reun[i].id, nombre: reun[i].nombre, inicio: reun[i].inicio, fin: reun[i].fin, estado: reun[i].asistencia[f.docente] || '' }; break; }
    });
  }
  out.filas.forEach(function (f) {   // minutos que le quedan a ese docente desde esta sesión hasta el final de la jornada (para «hasta el final»)
    var desde = Math.min.apply(null, f.sesiones.map(function (x) { return x.sesion; })), tot = 0;
    horarioDia.forEach(function (h) { if (h.docente === f.docente && Number(h.hora) >= desde) tot += minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
    f.minutosResto = tot;
  });
  out.filas.forEach(function (f) {   // fuera con estudiantes (salida pedagógica, intercolegiados, charla...): no se marca ausente
    var e = externas[f.docente];
    if (e && (e.jc || f.sesiones.some(function (x) { return e.sesiones[x.sesion]; }))) f.externa = { motivo: e.motivo, texto: e.texto };
  });
  out.filas.sort(function (a, b) { return claveGrupo_(a.grupoCodigo) - claveGrupo_(b.grupoCodigo); });   // orden de lista: preescolar a 11°
  return out;
}

/** Orden de los grupos: preescolar, 1° a 11°; Caminar en Secundaria 1 justo tras los sextos y el 2 justo tras los novenos. */
function claveGrupo_(codigo) {
  var g = String(codigo).split('+')[0], m;
  if ((m = g.match(/^CS([12])0?(\d)$/))) return (m[1] === '1' ? 6 : 9) * 1000 + 500 + Number(m[2]);
  if ((m = g.match(/^(\d\d)(\d\d)$/))) return Number(m[1]) * 1000 + Number(m[2]);
  return 99000;
}

/**
 * Guarda las marcas de la ronda.
 * p = {directivo, dia, sesion, fecha?, registros:[{docente, grupoCodigo, area, estado, motivo, minutos, obs, fuente, medio}]}
 */
var SIN_ESTUDIANTES = ['Sin estudiantes: los despachó', 'Sin estudiantes: están en taller o actividad fuera del aula', 'Sin estudiantes: no asistieron (padres avisados)', 'Sin estudiantes: están en otra dependencia (laboratorio, biblioteca, sala)', 'Sin estudiantes: el docente no los está atendiendo', 'Sin estudiantes: el docente no quiso atenderlos', 'Sin estudiantes: otro motivo (ver observaciones)', 'Sin estudiantes: los despachó temprano (con autorización)', 'Sin estudiantes: los despachó sin autorización'];   // docente presente, pero sin estudiantes en ese momento
var ATIENDE_GRUPO = ['Nadie (grupo solo)', 'Se despachó al grupo temprano (autorizado)', 'Sin clase: los niños no asistieron (padres avisados)', 'Reemplazo (docente)', 'Reemplazo (acordado con rectoría)', 'Persona de apoyo contratada (alcaldía u otra entidad)', 'Otro docente (con espacio libre)', 'No aplica (no tiene grupo asignado)', 'Practicante', 'Auxiliar o persona de apoyo del docente', 'Otro docente o directivo'];

/** Motivos agregados después de la primera versión del libro: se añaden solos a la hoja Motivos si faltan. */
var MOTIVOS_NUEVOS = [
  ['PERMISO SINDICAL', 'Invitación sindical (encuentro, asamblea, delegados)', 'SI', 'Invitación o citación del sindicato', 'SI', 5],
  ['PERMISO INSTITUCIONAL', 'Evento SED / SEM (capacitación, taller, charla)', 'SI', 'Citación o invitación de la Secretaría de Educación', 'NO', 5],
  ['LICENCIA', 'Licencia de maternidad o paternidad', 'SI', 'Resolución o certificado de la licencia', 'SI', 5],
  ['LICENCIA', 'Licencia por luto', 'SI', 'Acta de defunción u otro soporte', 'SI', 5],
  ['LICENCIA', 'Licencia no remunerada', 'SI', 'Resolución o autorización de la licencia', 'SI', 5],
  ['LICENCIA', 'Comisión de servicios', 'SI', 'Resolución o acto administrativo de la comisión', 'SI', 5],
  ['PERMISO INSTITUCIONAL', 'Descanso compensatorio', 'SI', 'Autorización del rector', 'NO', 5],
  ['SALUD', 'Cita médica', 'SI', 'Constancia o comprobante de la cita médica', 'SI', 5],
  ['CALAMIDAD DOMÉSTICA', 'Reunión o acto escolar de hijo(a)', 'SI', 'Citación o constancia del colegio', 'SI', 5],
  ['PERMISO INSTITUCIONAL', 'Reunión o actividad institucional', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['PERMISO INSTITUCIONAL', 'Permiso por horas (personal)', 'SI', 'Autorización del rector o coordinación', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Comité o consejo (calidad, académico, convivencia)', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Reunión PTAFI con la tutora', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Reunión de docentes o de área', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Atención a padre de familia o acudiente', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Atención en coordinación (estudiante o acudiente)', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Reunión de cierre de jornada', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['FORTUITO', 'Lluvia intensa o emergencia climática', 'SI', 'No requiere soporte (situación general)', 'NO', 5],
  ['CALAMIDAD DOMÉSTICA', 'Sepelio o duelo de un familiar', 'SI', 'Acta de defunción u otro soporte', 'SI', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Salida pedagógica o recorrido con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Paseo o salida recreativa con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Intercolegiados o evento deportivo con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Charla o actividad externa con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Visita a empresa, institución o feria con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Salida cultural o artística con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Otra salida con estudiantes (escribir en el detalle)', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5]
];
function asegurarMotivos_() {
  var sh = hoja_('Motivos'), existentes = datos_('Motivos').map(function (m) { return m.motivo; });
  var agregado = false;
  MOTIVOS_NUEVOS.forEach(function (f) { if (existentes.indexOf(f[1]) < 0) { sh.appendRow(f); agregado = true; } });
  if (agregado) invalidarCache_('Motivos');
}

/** Parejas que alternan cada semana (hoja Alternancias; si no existe se crea con las dos parejas de ética y religión). */
var ALTERNANCIAS_DEFECTO = [
  ['ETR', 'Casanova Quiñones Yoli del Carmen', 'Castillo Angulo Martha Cecilia', 'Alternan cada semana (Ética / Religión) entre 7° y 8° (+ CS 2)'],
  ['ETR', 'Estacio Estupiñán Rosario', 'Montaño Arizala Leidis Claudina', 'Alternan cada semana (Ética / Religión) entre 9° - 10°-1 y 10°-2 - 11°'],
  ['CSI', 'Quintero Ramírez María del Carmen', 'Ortiz Araujo Adiela Carlota', 'Alternan cada semana (Sociales / Inglés) entre 7° y 8° (+ CS 2)'],
  ['CSI', 'Betancourth Ocampo Yohana Patricia', 'Pulgarín Ortiz César Marino', 'Alternan cada semana (Sociales / Inglés) entre 9° - 10°-1 y 10°-2 - 11°'],
  ['CNA', 'Lemos Guancha Miriam', 'Villota Rubio Héctor Hugo', 'Alternan cada semana (Ciencias Naturales: química / física) entre 9° - 10°-1 y 10°-2 - 11°']
];
/** area|docente -> el otro docente de la pareja. */
function alternancias_() {
  var sh = hojaOCrea_('Alternancias', ['area', 'docente_a', 'docente_b', 'nota']);
  var areas = {}; datos_('Alternancias').forEach(function (a) { areas[a.area] = 1; });
  var nuevoAlt = false; ALTERNANCIAS_DEFECTO.forEach(function (f) { if (!areas[f[0]]) { sh.appendRow(f); nuevoAlt = true; } }); if (nuevoAlt) invalidarCache_('Alternancias');   // un área sin ninguna pareja recibe las de la versión inicial (no toca lo que ya editó)
  var m = {};
  datos_('Alternancias').forEach(function (a) {
    m[a.area + '|' + a.docente_a] = a.docente_b; m[a.area + '|' + a.docente_b] = a.docente_a;
  });
  return m;
}

/** Lunes de la semana de una fecha 'yyyy-MM-dd'. */
function lunesDe_(f) { var d = resDia_(f); return resSumaDias_(f, -(d === 0 ? 6 : d - 1)); }
var COL_SEMANA_ALT = ['semana', 'clave', 'elegido', 'intercambio', 'definido_por', 'fecha_definicion'];

/** Quién dicta cada pareja esta semana: clave -> {intercambio, elegido, por}. Lo define un directivo una vez y vale de lunes a viernes. */
var SEMANAS_AUTO = 8;   // la alternancia automática se arrastra hasta 8 semanas después de la última definición (después, vacaciones o cambios: se vuelve a definir)
function estadosSemana_(semana) {
  var m = {}, hist = {};
  datosOCrea_('Semana_Alternancia', COL_SEMANA_ALT).forEach(function (r) {
    var sw = fechaIso_(String(r.semana).replace(/^'/, ''));
    (hist[r.clave] = hist[r.clave] || []).push({ sw: sw, r: r });
    if (sw === semana) m[r.clave] = { intercambio: r.intercambio, elegido: r.elegido, por: r.definido_por };
  });
  /* alternancia automática: si esa pareja no está definida esta semana pero sí en una semana anterior, cada semana que pasa se alterna sola */
  var ms = new Date(semana + 'T12:00:00Z').getTime();
  Object.keys(hist).forEach(function (clave) {
    if (m[clave]) return;
    var mejor = null; hist[clave].forEach(function (h) { if (h.sw < semana && (!mejor || h.sw > mejor.sw)) mejor = h; });
    if (!mejor) return;
    var k = Math.round((ms - new Date(mejor.sw + 'T12:00:00Z').getTime()) / 604800000);
    if (k < 1 || k > SEMANAS_AUTO) return;
    var r = mejor.r, par = clave.split('|').slice(2), cambia = k % 2 === 1;
    m[clave] = { intercambio: String(clave).indexOf('CLASE|') === 0 ? (cambia ? (r.intercambio === 'SI' ? 'NO' : 'SI') : r.intercambio) : '',
                 elegido: cambia ? (par.filter(function (n) { return n !== r.elegido; })[0] || r.elegido) : r.elegido, por: 'la alternancia automática', auto: true };
  });
  return m;
}

/**
 * Un directivo define quién dicta esta semana. p = {clave, elegido, primario?, fecha?}
 * clave 'CLASE|area|docenteA|docenteB' (parejas de la hoja Alternancias: se guarda si la pareja intercambia sus grupos; primario = a quién
 * le corresponde la clase en el horario) o 'ENFASIS|grupos|docenteA|docenteB' (énfasis en pareja: se guarda quién atiende el grupo completo).
 */
/**
 * Corrige lo ya registrado en la semana cuando se descubre que quien dictaba era otro docente de la pareja: pasa las marcas de la ronda
 * (Registro_Ronda) y las novedades por sesión (Novedades) de «antes» a «despues», solo en las sesiones de esa pareja. No toca las ausencias de
 * jornada completa (JC). Devuelve cuántas filas cambió.
 */
/** Compañero de alternancia semanal de una fila de horario: en las clases de la pareja y también en los equipos de énfasis donde participa (el docente de la pareja que va al equipo cambia con la semana). */
function claveSlot_(sesion, grupo, area) {
  var g = String(grupo == null ? '' : grupo).replace(/^'/, ''); while (/^\d+$/.test(g) && g.length < 4) g = '0' + g;
  return Number(sesion) + '|' + g + '|' + String(area || '');
}
function parAlterna_(h, altern) {
  if (!(h.tipo === 'CLASE' || (h.tipo === 'ENFASIS' && /^EQUIPO/.test(String(h.alternancia))))) return '';
  return altern[h.area + '|' + h.docente] || '';
}
function corregirRegistrosPar_(semana, clave, antes, despues, primario) {
  var partes = String(clave).split('|'), hz = datos_('Horario'), res = { registro: 0, novedades: 0 };
  function delPar(h) { return partes[0] === 'ENFASIS' ? (h.tipo === 'ENFASIS' && String(h.grupos_enfasis) === partes[1]) : ((h.tipo === 'CLASE' || (h.tipo === 'ENFASIS' && /^EQUIPO/.test(String(h.alternancia)))) && h.area === partes[1]); }
  var par = [partes[2], partes[3]], otro = function (n) { return n === par[0] ? par[1] : par[0]; };
  var porSlot = {};   // (dia|hora|docente base) -> fila base de la pareja
  hz.forEach(function (h) { if (delPar(h)) porSlot[h.dia + '|' + Number(h.hora) + '|' + h.docente] = h; });
  /** Nuevo docente de una marca hecha por «d» en el horario (dia|hora), o null si no cambia. */
  function nuevoDocente(d, dia, hora) {
    if (par.indexOf(d) < 0) return null;
    if (partes[0] === 'CLASE' && primario && par.indexOf(primario) >= 0) {   // clases y equipos: cada puesto del horario base lo ocupa su titular o su pareja, según lo definido antes y ahora
      var antesInter = antes !== primario, despuesInter = despues !== primario;
      if (antesInter === despuesInter) return null;
      var titular = antesInter ? otro(d) : d;   // de quién es el puesto que ocupaba d
      var h = porSlot[dia + '|' + hora + '|' + titular];
      return h ? (despuesInter ? otro(titular) : titular) : null;
    }
    return d === antes && porSlot[dia + '|' + hora + '|' + d] ? despues : null;   // énfasis en pareja (o sin dato del titular): de «antes» a «despues»
  }
  var fechas = {}; for (var d = 0; d < 5; d++) fechas[resSumaDias_(semana, d)] = DIAS[d + 1];
  var rsh = hoja_('Registro_Ronda'), rv = rsh.getDataRange().getValues(), rc = {};
  rv[0].forEach(function (k, i) { rc[k] = i; });
  for (var i = 1; i < rv.length; i++) {
    var f = fechaIso_(rv[i][rc.fecha]), dia = fechas[f];
    if (!dia) continue;
    var nd = nuevoDocente(rv[i][rc.docente], dia, Number(rv[i][rc.sesion])); if (!nd || nd === rv[i][rc.docente]) continue;
    rsh.getRange(i + 1, rc.docente + 1).setValue(nd);
    res.registro++;
  }
  var nsh = hoja_('Novedades'), nv = nsh.getDataRange().getValues(), nc = {};
  nv[0].forEach(function (k, i) { nc[k] = i; });
  for (var j = 1; j < nv.length; j++) {
    var fj = fechaIso_(nv[j][nc['Fecha Novedad']]), dj = fechas[fj], ses = String(nv[j][nc['Sesiones']]).match(/^S(\d)$/);
    if (!dj || !ses) continue;
    var nj = nuevoDocente(nv[j][nc['Docente']], dj, Number(ses[1])); if (!nj || nj === nv[j][nc['Docente']]) continue;
    nsh.getRange(j + 1, nc['Docente'] + 1).setValue(nj);
    res.novedades++;
  }
  return res;
}
/** Bitácora de correcciones (quién, cuándo y qué se cambió). */
function bitacora_(accion, detalle) {
  var quien = identidad_();
  hojaOCrea_('Bitacora_Cambios', ['fecha_hora', 'quien', 'accion', 'detalle']).appendRow([ahoraTxt_(), quien.nombre || quien.email, accion, String(detalle).slice(0, 500)]);
}

/**
 * Quién puede CAMBIAR una asignación semanal ya definida (parejas que alternan): el administrador del libro, la coordinación académica, la rectoría
 * y quien tenga SI en la columna cambia_asignacion de la hoja Directivos. Definirla por primera vez en la semana puede hacerlo cualquier directivo.
 */
function puedeCambiarAsignacion_(quien) {
  try {
    if (quien && quien.email && editoresLibro_().indexOf(String(quien.email).toLowerCase()) >= 0) return true;
    var d = datos_('Directivos').filter(function (x) { return x.nombre === (quien && quien.nombre); })[0];
    if (!d) return false;
    var col = String(d.cambia_asignacion || '').trim().toUpperCase();
    if (col === 'SI') return true;
    if (col === 'NO') return false;
    return /acad[eé]mic|rector/i.test(String(d.rol || ''));
  } catch (e) { return false; }
}
function definirAlternancia(p) {
  p = p || {};
  var quien = exigirDirectivo_();
  var por = quien.nombre || quien.email;
  var partes = String(p.clave || '').split('|');
  if (partes.length !== 4 || ['CLASE', 'ENFASIS'].indexOf(partes[0]) < 0) throw new Error('Pareja no válida.');
  var par = [partes[2], partes[3]];
  if (par.indexOf(p.elegido) < 0) throw new Error('El docente elegido no pertenece a la pareja.');
  var inter = '';
  if (partes[0] === 'CLASE') {
    var otro = alternancias_()[partes[1] + '|' + par[0]];
    if (otro !== par[1]) throw new Error('Esa pareja no está en la hoja Alternancias.');
    if (par.indexOf(p.primario) < 0) throw new Error('Falta indicar a quién le corresponde la clase.');
    inter = p.elegido !== p.primario ? 'SI' : 'NO';
  }
  var semana = lunesDe_(p.fecha ? fechaIso_(p.fecha) : ymd_(new Date()));
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Semana_Alternancia', COL_SEMANA_ALT), v = sh.getDataRange().getValues(), fila = -1;
    for (var i = 1; i < v.length; i++) if (fechaIso_(String(v[i][0]).replace(/^'/, '')) === semana && v[i][1] === p.clave) { fila = i + 1; break; }
    if (fila > 0 && v[fila - 1][2] !== p.elegido && !puedeCambiarAsignacion_(quien)) throw new Error('Esta semana ya está definida (' + v[fila - 1][2] + '). Solo la coordinación académica o la rectoría puede cambiarla: pídaselo para no alterar la asignación de la semana.');
    var datos = ["'" + semana, p.clave, p.elegido, inter, por, ahoraTxt_()];
    if (fila > 0) sh.getRange(fila, 1, 1, datos.length).setValues([datos]); else sh.appendRow(datos);
    var corregidos = null;
    if (p.antes && p.antes !== p.elegido && par.indexOf(p.antes) >= 0) {   // se corrige quién dicta: opcionalmente también lo ya registrado
      if (p.corregirRegistrado) corregidos = corregirRegistrosPar_(semana, p.clave, p.antes, p.elegido, p.primario);
      bitacora_('Cambió quién dicta', par.join(' / ') + ' (' + semana + '): de ' + p.antes + ' a ' + p.elegido + (corregidos ? ' · corrigió ' + corregidos.registro + ' marcas de ronda y ' + corregidos.novedades + ' novedades' : ' · sin tocar lo ya registrado'));
    }
  } finally { lock.releaseLock(); }
  return { ok: true, semana: semana, intercambio: inter, corregidos: corregidos };
}

/** Google Sheets convierte '0101' en el número 101: los códigos con cero inicial se escriben como texto (apóstrofo). */
/** Estados de la ronda que NO son novedad (el docente está cumpliendo su labor). */
function sinNovedad_(estado) { return estado === 'Presente' || estado === 'En reunión' || estado === 'En actividad externa'; }

function textoCod_(v) { v = String(v == null ? '' : v); return /^0\d+$/.test(v) ? "'" + v : v; }

/** Minutos de una sesión: 45 en general; 60 en preescolar (4 horas de clase entre 7:30 y 11:30). */
/** Minutos de clase asignados a un docente ese día que quedan sin atender desde una hora (HH:MM) hasta el final de su jornada (cuenta la parte que falta de la sesión en curso). */
function minutosDesdeHora_(docente, dia, hhmm, hz, franjas) {
  function aMin(t) { var m = String(t).match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  var desde = aMin(hhmm), total = 0;
  if (desde == null) return 0;
  hz.forEach(function (h) {
    if (h.docente !== docente || h.dia !== dia) return;
    var fr = franjas.filter(function (f) { return Number(f.hora) === Number(h.hora); })[0] || {};
    var ini = aMin(hhmm_(h.inicio || fr.inicio || '')), fin = aMin(hhmm_(h.fin || fr.fin || ''));
    if (ini == null || fin == null || fin <= desde) return;
    total += Math.min(minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo), fin - Math.max(ini, desde));
  });
  return total;
}
function minutosSesion_(grupoCodigo) { return /^00/.test(String(grupoCodigo).split('+')[0]) ? 60 : 45; }

function guardarRonda(p) {
  var quien = exigirDirectivo_();
  // el responsable de la ronda es quien inició sesión, salvo que preste su teléfono o su sesión a otro directivo registrado: ese nombre sí se acepta
  var sesionDe = quien.nombre || quien.email, elegido = String(p.directivo || '').trim();
  var valido = elegido && datos_('Directivos').some(function (d) { return d.nombre === elegido; });
  p.directivo = valido ? elegido : sesionDe;
  if (valido && elegido !== sesionDe) bitacora_('Ronda con sesión prestada', 'La ronda de ' + (p.fecha || '') + ' (sesión ' + (p.sesion || '') + ') la hizo ' + elegido + ' con la sesión de ' + sesionDe);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(45000); } catch (e) { throw new Error('Hay otro guardado en curso en el libro. Espere unos segundos y toque Guardar de nuevo.'); }
  var filasRespaldo = [];
  try {
    var ahora = new Date(), fecha = p.fecha || ymd_(ahora);
    var franjas = datos_('Franjas');
    var hz = datos_('Horario');
    var motivos = {};
    datos_('Motivos').forEach(function (m) { motivos[m.motivo] = m; });
    var reg = hoja_('Registro_Ronda'), nov = hoja_('Novedades');
    var regVals = reg.getDataRange().getValues();   // para reemplazar marcas repetidas
    var novVals = nov.getDataRange().getValues();
    var novCol = novVals[0].indexOf('Sesiones');
    var guardados = 0, pendReg = [], pendNov = [];
    /* las filas nuevas se escriben de una sola vez (una llamada a la hoja en vez de una por fila); antes de borrar filas se vuelcan las pendientes */
    function volcarReg() { if (!pendReg.length) return; reg.getRange(regVals.length - pendReg.length + 1, 1, pendReg.length, regVals[0].length).setValues(pendReg.map(function (f) { return rellena_(f, regVals[0].length); })); pendReg = []; }
    function volcarNov() { if (!pendNov.length) return; nov.getRange(novVals.length - pendNov.length + 1, 1, pendNov.length, novVals[0].length).setValues(pendNov.map(function (f) { return rellena_(f, novVals[0].length); })); pendNov = []; }
    var reunPorSesion = {};
    function reunDe(ses) { return reunPorSesion[ses] || (reunPorSesion[ses] = reunionesEnSesiones_(fecha, [ses], franjas)); }
    (p.registros || []).forEach(function (r) {
      var sesion = Number(r.sesion || p.sesion);   // en la ronda por bloque cada marca trae su sesión (el bloque se guarda como sus dos sesiones)
      var fr = franjas.filter(function (f) { return Number(f.hora) === sesion; })[0];
      if (!fr) throw new Error('Sesión no válida: ' + sesion);
      var franjaBase = hhmm_(fr.inicio) + ' - ' + hhmm_(fr.fin);
      // quien asistió a una reunión que se cruza con esta sesión no se marca ausente: queda "En reunión" y no suma tiempo
      if (r.estado === 'No asistió' || r.estado === 'Ausente temporal') {
        var rr = reunDe(sesion).filter(function (x) { return convocadoA_(x, r.docente) && ESTADOS_REUNION_PRESENTE.indexOf(x.asistencia[r.docente]) >= 0; })[0];
        if (rr) r = Object.assign({}, r, { estado: 'En reunión', motivo: rr.nombre, minutos: '' });
      }
      // quien está fuera con estudiantes (salida pedagógica, intercolegiados...) registrada en Novedades no se marca ausente
      if (r.estado === 'No asistió' || r.estado === 'Ausente temporal') {
        var ex = externaDe_(fecha, r.docente, sesion, novVals.slice(1).map(function (x) { var o = {}; novVals[0].forEach(function (k, i) { o[k] = x[i]; }); return o; }));
        if (ex) r = Object.assign({}, r, { estado: 'En actividad externa', motivo: ex.motivo, minutos: '' });
      }
      // incumplimientos: se registran con rigor (descripción obligatoria, siempre sin justificación, y quedan además en la hoja Incumplimientos)
      var inc = null;
      if (r.estado === 'Incumplimiento') {
        var ti = r.incumplimiento || {};
        if (!TIPOS_INCUMPL[ti.tipo]) throw new Error('Elija el tipo de incumplimiento de ' + r.docente + '.');
        if (String(r.obs || '').trim().length < MIN_DESCRIPCION_INCUMPL) throw new Error('Describa lo que verificó de ' + r.docente + ' (mínimo ' + MIN_DESCRIPCION_INCUMPL + ' letras).');
        var resto = ti.tipo === 'DESPIDIO' && ti.alcance === 'RESTO', minInc = minutosSesion_(r.grupoCodigo);
        if (resto) { minInc = 0; hz.forEach(function (h) { if (h.docente === r.docente && h.dia === p.dia && Number(h.hora) >= sesion) minInc += minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); }); }
        inc = { tipo: ti.tipo, texto: TIPOS_INCUMPL[ti.tipo], resto: resto, minutos: minInc, donde: DONDE_INCUMPL.indexOf(ti.donde) >= 0 ? ti.donde : '', explicacion: ti.explicacion };
        r = Object.assign({}, r, { estado: inc.texto, motivo: 'Sin justificación', minutos: inc.minutos });
      }
      var m = inc ? { justificada: 'NO', categoria: 'INCUMPLIMIENTO' } : (motivos[r.motivo] || {});
      var just = sinNovedad_(r.estado) ? '' : (m.justificada === 'SI' ? 'Sí' : 'No');
      var atiende = (SIN_ESTUDIANTES.indexOf(r.atiende) >= 0 && (r.estado === 'Presente' || !sinNovedad_(r.estado))) ? r.atiende : (sinNovedad_(r.estado) ? '' : (ATIENDE_GRUPO.indexOf(r.atiende) >= 0 ? r.atiende : ''));   // quién cubrió el grupo; NO cuenta como asistencia del docente
      var pre = /^00/.test(String(r.grupoCodigo));
      var hrow = pre ? hz.filter(function (h) { return h.docente === r.docente && h.dia === p.dia && Number(h.hora) === sesion; })[0] : null;
      var franja = hrow ? hhmm_(hrow.inicio) + ' - ' + hhmm_(hrow.fin) : franjaBase;   // preescolar tiene sus propios periodos
      var minutos = r.estado === 'No asistió' ? minutosSesion_(r.grupoCodigo) : (Number(r.minutos) || '');
      // salida temprana o permiso por horas «hasta el final de la jornada»: el tiempo se calcula solo (todas sus sesiones desde esta hasta la última)
      var horaS = r.estado === 'Salida temprana' && /^\d{1,2}:\d{2}$/.test(String(r.horaSalida || '')) ? String(r.horaSalida) : '';   // hora a la que salió: el tiempo se calcula con su horario de ese día
      var resto = ((r.estado === 'Salida temprana' || r.estado === 'Ausente temporal') && r.alcance === 'RESTO') || !!horaS;
      if (resto) {
        minutos = 0;
        if (horaS) {
          minutos = minutosDesdeHora_(r.docente, p.dia, horaS, hz, franjas);
          if (!(minutos > 0)) throw new Error('Con la hora de salida de ' + r.docente + ' (' + horaS + ') no queda tiempo de clase sin atender. Revise la hora.');
          r = Object.assign({}, r, { obs: (r.obs ? r.obs + ' · ' : '') + 'Salió a las ' + horaS });
        } else hz.forEach(function (h) { if (h.docente === r.docente && h.dia === p.dia && Number(h.hora) >= sesion) minutos += minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
      }
      // 1) Registro_Ronda: una fila por docente-fecha-sesión (se reemplaza si ya existía)
      var fila = [ahora, fecha, p.dia, sesion, franja, r.docente, textoCod_(r.grupoCodigo), r.area, r.estado,
                  r.motivo || '', just, minutos, r.obs || '', p.directivo || '', atiende];
      var idx = -1;
      for (var i = 1; i < regVals.length; i++) {
        var f = regVals[i][1] instanceof Date ? ymd_(regVals[i][1]) : String(regVals[i][1]);
        if (f === fecha && Number(regVals[i][3]) === sesion && regVals[i][5] === r.docente) { idx = i; break; }
      }
      if (idx < 0) {   // una marca anterior del mismo puesto (fecha, sesión, grupo y área) a nombre de alguien que ya no tiene esa sesión se reemplaza en vez de duplicarse
        var ocup = {}; hz.forEach(function (h) { if (h.dia === p.dia && Number(h.hora) === sesion) ocup[h.docente] = 1; });
        for (var i2 = 1; i2 < regVals.length; i2++) {
          var f2 = regVals[i2][1] instanceof Date ? ymd_(regVals[i2][1]) : String(regVals[i2][1]);
          if (f2 === fecha && Number(regVals[i2][3]) === sesion && !ocup[regVals[i2][5]] && claveSlot_(sesion, regVals[i2][6], regVals[i2][7]) === claveSlot_(sesion, r.grupoCodigo, r.area)) { idx = i2; break; }
        }
      }
      if (idx > 0) { if (idx >= regVals.length - pendReg.length) pendReg[idx - (regVals.length - pendReg.length)] = fila; else reg.getRange(idx + 1, 1, 1, fila.length).setValues([fila]); regVals[idx] = fila; }
      else { pendReg.push(fila); regVals.push(fila); }
      filasRespaldo.push(fila);
      // 2) Novedades (esquema del formulario de ausentismo): quitar la anterior y agregar si hay novedad
      for (var j = novVals.length - 1; j >= 1; j--) {
        var fj = novVals[j][1] instanceof Date ? ymd_(novVals[j][1]) : String(novVals[j][1]);
        var fechaStr = fecha.split('-').reverse().map(Number).join('/');
        var sj = String(novVals[j][novCol]), mj = sj.match(/^S(\d)$/);
        if (novVals[j][3] === TIPO_EXTERNA) continue;   // la salida con estudiantes se anula solo desde la pantalla de novedades
        if ((fj === fecha || fj === fechaStr) && novVals[j][2] === r.docente && (sj === 'S' + sesion || sj === 'S' + sesion + '-FIN' || ((inc && inc.resto || resto) && mj && Number(mj[1]) >= sesion))) {
          volcarNov(); nov.deleteRow(j + 1); novVals.splice(j, 1);
        }
      }
      var completa = r.estado === 'No asistió' && r.alcance === 'JC';
      if (completa) {   // ausente toda la jornada: UNA sola novedad con el total de minutos; reemplaza las de sesiones y cualquier jornada ya registrada
        var mias = hz.filter(function (h) { return h.docente === r.docente && h.dia === p.dia; });
        var total = 0; mias.forEach(function (h) { total += minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
        for (var q = novVals.length - 1; q >= 1; q--) {
          if (fechaIso_(novVals[q][1]) === fecha && novVals[q][2] === r.docente && /no asisti/i.test(String(novVals[q][3])) &&
              (String(novVals[q][novCol]) === 'JC' || /^S\d$/.test(String(novVals[q][novCol])))) { volcarNov(); nov.deleteRow(q + 1); novVals.splice(q, 1); }
        }
        var gs = {}, as = {};
        mias.forEach(function (h) { gs[h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo] = 1; as[h.area || '(énfasis)'] = 1; });
        var gk = Object.keys(gs), ak = Object.keys(as);
        var pj = gk.length === 1 ? partesGrupo_(String(gk[0]).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
        var nj = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', r.motivo || '', r.obs || '', r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA,
                  pj.grado, pj.grupo, ak.length === 1 ? ak[0] : (mias.length ? 'Todas' : r.area), 'Jornada completa', total || minutos, p.directivo || '',
                  'JC', just, m.categoria || '', atiende];
        pendNov.push(nj); novVals.push(nj);
        guardados++;
        return;
      }
      var jornada = (r.estado === 'No asistió' || r.estado === 'Ausente temporal') && novVals.slice(1).some(function (x) {
        return fechaIso_(x[1]) === fecha && x[2] === r.docente && String(x[novCol]) === 'JC' && /no asisti/i.test(String(x[3]));
      });  // ya reportado como ausencia de jornada completa: se verifica en Registro_Ronda sin duplicar minutos en Novedades
      if (!jornada && !resto && (r.estado === 'No asistió' || r.estado === 'Ausente temporal' || r.estado === 'Salida temprana')) {   // ya cubierto por una salida «hasta el final de la jornada» registrada desde una sesión anterior
        jornada = novVals.slice(1).some(function (x) {
          var mf = String(x[novCol]).match(/^S(\d)-FIN$/);
          return mf && fechaIso_(x[1]) === fecha && x[2] === r.docente && Number(mf[1]) < sesion;
        });
      }
      if (inc) {   // el incumplimiento siempre queda en la hoja Incumplimientos; en Novedades suma minutos salvo que la jornada completa ya los contenga
        var jc = novVals.slice(1).some(function (x) { return fechaIso_(x[1]) === fecha && x[2] === r.docente && String(x[novCol]) === 'JC' && /no asisti/i.test(String(x[3])); });
        var pgi = partesGrupo_(String(r.grupoCodigo).split('+')[0]);
        var ni = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', 'Sin justificación', String(r.obs || '').slice(0, 300), r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA, pgi.grado, pgi.grupo, r.area,
                  'H' + sesion + ' ' + franja + (pre ? '' : ' Bloque ' + Math.ceil(sesion / 2)), jc ? '' : minutos, p.directivo || '', 'S' + sesion + (inc.resto ? '-FIN' : ''), 'No', 'INCUMPLIMIENTO', atiende];
        pendNov.push(ni); novVals.push(ni);
        registrarIncumplimiento_({ fecha: fecha, docente: r.docente, tipo: inc.texto, sesiones: 'S' + sesion + (inc.resto ? ' a fin de jornada' : ''), grupo: String(r.grupoCodigo), area: r.area,
          minutos: minutos, donde: inc.donde, descripcion: r.obs, explicacion: inc.explicacion, por: p.directivo });
        guardados++;
        return;
      }
      if (!sinNovedad_(r.estado) && !jornada) {
        var pg = partesGrupo_(String(r.grupoCodigo).split('+')[0]);
        var nf = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', r.motivo || '', r.obs || '',
                  r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA, pg.grado, pg.grupo, r.area,
                  'H' + sesion + ' ' + franja + (pre ? '' : ' Bloque ' + Math.ceil(sesion / 2)), minutos, p.directivo || '',
                  'S' + sesion + (resto ? '-FIN' : ''), just, m.categoria || '', atiende];
        if (resto) nf[12] = 'H' + sesion + ' ' + franja + ' · resto de la jornada';
        pendNov.push(nf); novVals.push(nf);
      }
      guardados++;
    });
    volcarReg(); volcarNov();
    return { ok: true, guardados: guardados };
  } finally { lock.releaseLock(); if (typeof respaldarRonda_ === 'function') respaldarRonda_(filasRespaldo); }   // el respaldo va después de soltar el bloqueo y, si falla, el guardado no se afecta
}
function rellena_(f, n) { f = f.slice(0, n); while (f.length < n) f.push(''); return f; }

/* ------------------------------ formulario de Google (radios) ------------------------------ */
function crearFormulario() {
  exigirEditor_();
  var docentes = datos_('Docentes').map(function (d) { return d.nombre_completo; });
  var dirs = datos_('Directivos').map(function (d) { return d.nombre; });
  var listas = datos_('Listas');
  var l = function (n) { return listas.filter(function (x) { return x.lista === n; }).map(function (x) { return x.valor; }); };
  var motivos = datos_('Motivos').map(function (m) { return m.motivo; });
  var f = FormApp.create('ICET 2026 - Registro de novedades docentes');
  f.setDescription('Uso exclusivo de directivos docentes. Para la ronda en vivo use la aplicación web.');
  f.addDateItem().setTitle('Fecha Novedad').setRequired(true);
  f.addListItem().setTitle('Directivo Docente').setChoiceValues(dirs).setRequired(true);
  f.addListItem().setTitle('Docente').setChoiceValues(docentes).setRequired(true);
  var estado = f.addListItem().setTitle('Tipo Novedad').setRequired(true);
  var pDetalle = f.addPageBreakItem().setTitle('Detalle de la novedad');
  f.addListItem().setTitle('Motivo Ausencia').setChoiceValues(motivos).setRequired(true);
  f.addListItem().setTitle('Actividad de Aprendizaje').setChoiceValues(['N/A', 'Sí', 'No']).setRequired(true);
  f.addCheckboxItem().setTitle('Sesiones afectadas').setChoiceValues(['S1 06:30-07:15', 'S2 07:15-08:00', 'S3 08:20-09:05', 'S4 09:05-09:50',
    'S5 10:10-10:55', 'S6 10:55-11:40', 'S7 12:00-12:45', 'S8 12:45-13:30']).setRequired(true);
  f.addListItem().setTitle('Fuente Novedad').setChoiceValues(l('fuente')).setRequired(true);
  f.addListItem().setTitle('Medio Información').setChoiceValues(l('medio')).setRequired(true);
  f.addParagraphTextItem().setTitle('Descripción');
  // "Presente" termina el formulario; el resto pasa a la página de detalle
  estado.setChoices(l('tipo_novedad').map(function (t) {
    return t === 'Presente' ? estado.createChoice(t, FormApp.PageNavigationType.SUBMIT) : estado.createChoice(t, pDetalle);
  }));
  ScriptApp.newTrigger('alEnviarFormulario').forForm(f).onFormSubmit().create();
  SpreadsheetApp.getUi().alert('Formulario creado:\n' + f.getEditUrl() + '\n\nEnlace para responder:\n' + f.getPublishedUrl());
}

function alEnviarFormulario(e) {
  if (!e || !e.source || typeof e.source.getId !== 'function') throw new Error('Evento no válido.');   // solo lo dispara el formulario real
  var g = {};
  e.response.getItemResponses().forEach(function (i) { g[i.getItem().getTitle()] = i.getResponse(); });
  var motivos = {};
  datos_('Motivos').forEach(function (m) { motivos[m.motivo] = m; });
  var m = motivos[g['Motivo Ausencia']] || {};
  var d = String(g['Fecha Novedad']);                    // yyyy-MM-dd
  var dia = DIAS[Number(Utilities.formatDate(new Date(d + 'T12:00:00'), TZ, 'u'))];
  var ses = [].concat(g['Sesiones afectadas'] || []).map(function (s) { return Number(s.charAt(1)); });
  var hz = datos_('Horario');
  ses.forEach(function (s) {
    var h = hz.filter(function (x) { return x.docente === g['Docente'] && x.dia === dia && Number(x.hora) === s; })[0];
    var grupo = h ? (h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo) : '';
    var pg = partesGrupo_(String(grupo).split('+')[0]);
    var minutos = g['Tipo Novedad'] === 'No asistió' ? 45 : '';
    hoja_('Novedades').appendRow([e.response.getTimestamp(), d, g['Docente'], g['Tipo Novedad'], g['Actividad de Aprendizaje'],
      g['Motivo Ausencia'], g['Descripción'] || '', g['Fuente Novedad'], g['Medio Información'], pg.grado, pg.grupo,
      h ? (h.area || '(énfasis)') : 'SIN CLASE EN HORARIO', 'S' + s, minutos, g['Directivo Docente'], 'S' + s,
      m.justificada === 'SI' ? 'Sí' : 'No', m.categoria || '']);
  });
}

/* ------------------------------ administración ------------------------------ */
/** Comparte el libro con los directivos; omite los correos temporales (@example.com). */
function compartirConDirectivos() {
  exigirEditor_();
  var ok = [], omitidos = [];
  datos_('Directivos').forEach(function (d) {
    var c = String(d.correo_temporal).trim();
    if (!c || /@example\.com$/i.test(c)) { omitidos.push(d.nombre); return; }
    SpreadsheetApp.getActive().addEditor(c); ok.push(d.nombre);
    try { carpetaRaiz_().addViewer(c); } catch (e) { /* sin carpeta de soportes todavía */ }
  });
  SpreadsheetApp.getUi().alert('Compartido con: ' + (ok.join(', ') || 'nadie') + '\nPendientes (correo temporal): ' + (omitidos.join(', ') || 'ninguno'));
}

function mostrarUrlConsulta() {
  exigirEditor_();
  SpreadsheetApp.getUi().alert('Para la ronda y el panel:\nImplementar > Nueva implementación > Aplicación web.\n' +
    'Ejecutar como: el usuario que accede. Quién tiene acceso: solo directivos.\nRonda: la URL. Panel: la URL con ?p=panel al final. Agréguelas a la pantalla de inicio.');
}

/**
 * Una sola vez: pasa el horario de preescolar a 4 periodos de 60 min entre 7:30 y 11:30 (sesiones 3 a 6 de la ronda).
 * Quita las filas de la sesión 2 y corrige inicio y fin de las demás. No toca ninguna otra hoja. Se puede repetir sin daño.
 */
var PERIODOS_PREESCOLAR = { 3: ['07:30', '08:30'], 4: ['08:30', '09:30'], 5: ['09:30', '10:30'], 6: ['10:30', '11:30'] };
function actualizarHorarioPreescolar_() {
  var sh = hoja_('Horario'), v = sh.getDataRange().getValues(), h = v[0];
  var iG = h.indexOf('grupo'), iH = h.indexOf('hora'), iI = h.indexOf('inicio'), iF = h.indexOf('fin');
  var quitadas = 0, corregidas = 0;
  for (var i = v.length - 1; i >= 1; i--) {
    var cod = String(v[i][iG]); while (/^\d+$/.test(cod) && cod.length < 4) cod = '0' + cod;   // 1 -> 0001 si Sheets perdió los ceros
    if (cod.indexOf('00') !== 0) continue;
    var hora = Number(v[i][iH]);
    if (!PERIODOS_PREESCOLAR[hora]) { sh.deleteRow(i + 1); quitadas++; continue; }
    var ini = sh.getRange(i + 1, iI + 1), fin = sh.getRange(i + 1, iF + 1);
    ini.setNumberFormat('@'); fin.setNumberFormat('@');
    if (hhmm_(v[i][iI]) !== PERIODOS_PREESCOLAR[hora][0] || hhmm_(v[i][iF]) !== PERIODOS_PREESCOLAR[hora][1]) {
      ini.setValue(PERIODOS_PREESCOLAR[hora][0]); fin.setValue(PERIODOS_PREESCOLAR[hora][1]); corregidas++;
    }
  }
  invalidarCache_('Horario');
  var ajustes = ajustarMinutosPreescolar_();
  return { quitadas: quitadas, corregidas: corregidas, minutosAjustados: ajustes };
}
/**
 * Las docentes de preescolar atienden 4 periodos de 60 min (240 min al día). Con el horario viejo (5 periodos) una ausencia de jornada completa
 * quedó en 300 min: aquí se bajan a 240 las de jornada completa (Novedades y Registro_Ronda) de quien solo tiene grupos de preescolar.
 */
function ajustarMinutosPreescolar_() {
  var solo = {}, tope = 0;
  for (var k in PERIODOS_PREESCOLAR) tope += 60;
  var hz = datos_('Horario'), otros = {};
  hz.forEach(function (h) { var cod = String(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); while (/^\d+$/.test(cod) && cod.length < 4) cod = '0' + cod; if (cod.indexOf('00') === 0) solo[h.docente] = 1; else otros[h.docente] = 1; });
  var n = 0;
  [['Novedades', 'Docente', 'Minutos Desatendidos', 'Sesiones'], ['Registro_Ronda', 'docente', 'minutos', '']].forEach(function (d) {
    var sh = hoja_(d[0]); if (!sh) return;
    var v = sh.getDataRange().getValues(), cab = v[0], iD = cab.indexOf(d[1]), iM = cab.indexOf(d[2]), iS = d[3] ? cab.indexOf(d[3]) : -1;
    if (iD < 0 || iM < 0) return;
    for (var i = 1; i < v.length; i++) {
      if (!solo[v[i][iD]] || otros[v[i][iD]] || Number(v[i][iM]) <= tope || (iS >= 0 && String(v[i][iS]) !== 'JC')) continue;
      sh.getRange(i + 1, iM + 1).setValue(tope); n++;
    }
  });
  return n;
}
function actualizarHorarioPreescolar() {
  exigirEditor_();
  var r = actualizarHorarioPreescolar_();
  SpreadsheetApp.getUi().alert('Horario de preescolar actualizado.\nFilas de la sesión 2 quitadas: ' + r.quitadas + '\nPeriodos corregidos: ' + r.corregidas + '\nAusencias de jornada completa bajadas a 240 min: ' + r.minutosAjustados);
}

function acercaDe() { SpreadsheetApp.getUi().alert('Acerca de este sistema', AUTORIA, SpreadsheetApp.getUi().ButtonSet.OK); }
