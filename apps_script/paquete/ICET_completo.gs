// ===================== Codigo.gs =====================
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
    .addItem('Docentes: restablecer la clave de un docente', 'restablecerClaveDocente')
    .addItem('Docentes: ver quién ya activó su acceso', 'verDocentesActivos')
    .addItem('Ver sesiones abiertas (quién está usando el sistema)', 'verSesionesAbiertas')
    .addItem('Comisiones: ver qué hay guardado (y en qué hoja)', 'comisionesVerGuardado')
    .addItem('Comisiones: unificar actas duplicadas', 'comisionesUnificarDuplicadas')
    .addItem('Comisiones: prueba de funcionamiento (guarda y borra un acta de prueba)', 'comisionesPruebaDeHumo')
    .addItem('Acerca de este sistema', 'acercaDe')
    .addItem('Actualizar hoja LEEME (versión y cambios)', 'actualizarLeeme')
    .addItem('Quitar reuniones repetidas', 'quitarReunionesDuplicadasLibro')
    .addItem('Corregir Docente 1 y 2 de Educación Física (una vez)', 'corregirDocentes1y2EducacionFisica')
    .addItem('Revisar y recuperar marcas de la ronda', 'recuperarMarcasRonda')
    .addItem('Recuperar rondas desde una copia del libro', 'recuperarRondasDesdeCopia')
    .addItem('Respaldar rondas ahora (libro de respaldo)', 'respaldarTodoAhora')
    .addItem('Respaldos: copiar libros a Drive ahora', 'respaldoLibrosAhora')
    .addItem('Respaldos: programar copia diaria (Drive)', 'instalarRespaldoDiario')
    .addItem('Reunir todo en la carpeta «APP ASISTENCIA DOCENTE» (una vez)', 'reunirEnCarpetaApp')
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
/* Lecturas repetidas dentro de UNA solicitud de solo lectura (p. ej. abrir el acta): se leen una vez y se entregan copias. Se activa con VAL_REQ = {}. */
var VAL_REQ = null;
function valores_(n) {
  if (VAL_REQ) { if (!VAL_REQ[n]) VAL_REQ[n] = valoresDirecto_(n); return VAL_REQ[n].map(function (r) { return r.slice(); }); }
  return valoresDirecto_(n);
}
function valoresDirecto_(n) {
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
var MEMO_YMD_ = {};
/** Fecha aaaa-mm-dd de un Date. Se recuerda por instante: formatear una fecha es lo más lento que hace el script (milisegundos) y al guardar la ronda se pregunta por la fecha de miles de filas, que son pocos días distintos. */
function ymd_(d) {
  var k = d.getTime(), v = MEMO_YMD_[k];
  if (v === undefined) v = MEMO_YMD_[k] = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return v;
}

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
/** ¿Ahora es un descanso (entre dos sesiones o los minutos siguientes a la última)? Con esto la ronda sigue mostrando la sesión que terminó y lo rotula «Descanso». */
function enDescanso_(d) {
  var hm = Utilities.formatDate(d, TZ, 'HH:mm'), enSesion = false;
  datos_('Franjas').forEach(function (f) { if (hhmm_(f.inicio) <= hm && hm < hhmm_(f.fin)) enSesion = true; });
  return !enSesion && sesionAhora_(d) !== null;
}
function sesionAhora_(d) {
  var hm = Utilities.formatDate(d, TZ, 'HH:mm'), r = null;
  var fr = datos_('Franjas').slice().sort(function (x, y) { return Number(x.hora) - Number(y.hora); });
  fr.forEach(function (f) {
    if (hhmm_(f.inicio) <= hm && hm < hhmm_(f.fin)) r = Number(f.hora);
  });
  /* en el descanso (o los 20 minutos siguientes a la última sesión de un bloque) sigue la sesión que acaba de terminar: así a las 11:42 aún se puede marcar el bloque 3
     (preescolar y orientación terminan o llegan en esos minutos) en vez de mostrar «Descanso» */
  if (r === null) fr.forEach(function (f, i) {
    var aMin = function (t) { t = hhmm_(t); return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); };
    var sig = fr[i + 1], finMin = aMin(f.fin), hmMin = aMin(hm);
    if (finMin <= hmMin && hmMin < finMin + 20 && (!sig || hmMin < aMin(sig.inicio))) r = Number(f.hora);
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
  var PAGINAS = { menu: ['Menu', 'Control de Procesos ICET'], novedad: ['Novedad', 'ICET - Registrar novedades'], ronda: ['Consulta', 'ICET - Ronda de asistencia docente'], reunion: ['Reunion', 'ICET - Reuniones y actividades'], horarios: ['Horarios', 'ICET - Horarios y listados'], ayuda: ['Ayuda', 'ICET - Ayuda y manual de uso'], manuales: ['Manuales', 'ICET - Manuales en PDF'], panel: ['Dashboard', 'ICET - Panel de asistencia docente'], comisiones: ['Comisiones', 'ICET - Comisiones de evaluación y promoción'] };
  var pg = PAGINAS[pag] || PAGINAS.menu;
  // La versión sale SOLO de VERSION_SISTEMA (Leeme.gs): las pantallas la reciben con <?= VERSION ?>, no hay que tocar los .html para subir de versión.
  var plantilla = HtmlService.createTemplateFromFile(pg[0]); plantilla.VERSION = VERSION_SISTEMA;
  return plantilla.evaluate()
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
/** Hasta qué hora (HH:MM) pueden registrar la ronda del día los directivos que no administran: fin de la jornada escolar + margen (Parametros: ronda_horas_margen, 3 por defecto). Quien administra no tiene límite. */
function cierreRonda_() {
  var fin = finJornada_(), m = String(fin).match(/^(\d{1,2}):(\d{2})/), minutos = (m ? Number(m[1]) * 60 + Number(m[2]) : 13 * 60 + 30) + Math.round((Number(parametro_('ronda_horas_margen', '3')) || 0) * 60);
  minutos = Math.min(minutos, 23 * 60 + 59);
  return ('0' + Math.floor(minutos / 60)).slice(-2) + ':' + ('0' + (minutos % 60)).slice(-2);
}
function rondaCerrada_() { return Utilities.formatDate(new Date(), TZ, 'HH:mm') > cierreRonda_(); }
/** Cuántos días atrás (además de hoy) pueden registrar la ronda los directivos que no administran: 0 por defecto (Parametros: ronda_dias_atras). */
function diasAtrasRonda_() { return Math.max(0, Math.min(5, Number(parametro_('ronda_dias_atras', '0')) || 0)); }
function consultarSesion(dia, sesion, modo, fecha, ignorarReunion) {
  exigirDirectivo_();
  asegurarMotivos_();
  var ahora = new Date(), hoyS = ymd_(ahora), revision = false;
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(fecha)) && String(fecha) !== hoyS) {   // consulta de la ronda de otra fecha (solo lectura): día hábil de hoy hacia atrás
    if (String(fecha) > hoyS) throw new Error('Elija una fecha de hoy o anterior.');
    var dw = resDia_(String(fecha));
    if (dw < 1 || dw > 5) throw new Error('Elija un día hábil (lunes a viernes).');
    var atrasC = Math.round((new Date(hoyS + 'T12:00:00Z') - new Date(String(fecha) + 'T12:00:00Z')) / 86400000), adminC = false;
    try { adminC = puedeAdministrar_(identidad_()); } catch (e) { adminC = false; }
    if (!adminC && !(atrasC >= 1 && atrasC <= diasAtrasRonda_())) throw new Error('Las rondas de fechas anteriores se consultan en los informes (Ver panel → Rondas guardadas). Aquí solo las abre quien administra.');
    revision = true; dia = DIAS[dw];
  }
  var auto = !dia && !sesion;
  var descanso = (function () { try { return auto && !sesion && enDescanso_(ahora); } catch (e) { return false; } })();   // «Ahora» cae en el descanso entre bloques: se sigue mostrando el bloque que terminó
  dia = dia || DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))];
  var s = sesion ? Number(sesion) : (revision ? 1 : sesionAhora_(ahora));
  var fr = datos_('Franjas').filter(function (f) { return Number(f.hora) === s; })[0];
  var out = {
    dia: dia, diaHoy: DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))], sesion: s, auto: auto, hora: Utilities.formatDate(ahora, TZ, 'HH:mm'), fecha: revision ? String(fecha) : hoyS, revision: revision,
    franja: fr ? hhmm_(fr.inicio) + ' - ' + hhmm_(fr.fin) : '', bloque: fr ? Number(fr.bloque) : null, modo: modo === 'bloque' ? 'bloque' : 'sesion',
    sesionesBloque: [],
    filas: [], motivos: datos_('Motivos'), listas: datos_('Listas'),
    directivos: datos_('Directivos').map(function (d) { return d.nombre; }),
    puedeEditarPasadas: (function () { try { if (puedeAdministrar_(identidad_())) return true; var at = revision ? Math.round((new Date(hoyS + 'T12:00:00Z') - new Date(String(fecha) + 'T12:00:00Z')) / 86400000) : 0; return revision && at >= 1 && at <= diasAtrasRonda_(); } catch (e) { return false; } })(),   // quien administra (y, si se configura, los demás directivos unos días atrás) puede registrar o corregir rondas de fechas anteriores
    rondaCerrada: (function () { try { return !revision && !puedeAdministrar_(identidad_()) && rondaCerrada_(); } catch (e) { return false; } })(), cierreRonda: cierreRonda_(),
    puedeCambiarAlt: (function () { try { return puedeCambiarAsignacion_(identidad_()); } catch (e) { return false; } })(),
    sesionDe: (function () { try { var i = identidad_(); return i.rol === 'directivo' ? (i.nombre || '') : ''; } catch (e) { return ''; } })(),   // quien inició sesión: sale preseleccionado como responsable de la ronda
    nota: s ? '' : (auto ? 'Descanso o fuera de jornada' : 'Sesión no válida'), descanso: descanso
  };
  if (fr) out.turno = turnoDe_(dia, Number(fr.bloque));
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
  var yaMarcados = {}, regHoy = [], regFecha = [];
  datos_('Registro_Ronda').forEach(function (r) {
    var f = r.fecha instanceof Date ? ymd_(r.fecha) : String(r.fecha);
    if (f !== out.fecha) return;
    regFecha.push(r);
  });
  var altern = alternancias_(), totDia = {};
  var horarioDia = datos_('Horario').filter(function (h) { return h.dia === dia; });
  horarioDia.forEach(function (h) { totDia[h.docente] = (totDia[h.docente] || 0) + minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
  /* Preescolar entra a las 7:30 con los niños y tiene periodos propios de 60 min (07:30, 08:30, 09:30, 10:30): se muestran en el bloque donde EMPIEZA cada periodo
     (07:30 → bloque 1; 08:30 y 09:30 → bloque 2; 10:30 → bloque 3), no por el número de hora del horario general. Los demás, por sus sesiones del bloque. */
  var aMinF = function (t) { t = hhmm_(t); return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); };
  var franjasSel = datos_('Franjas').filter(function (f) { return hs.indexOf(Number(f.hora)) >= 0; });
  var ventIni = franjasSel.length ? Math.min.apply(null, franjasSel.map(function (f) { return aMinF(f.inicio); })) : 0, ventFin = franjasSel.length ? Math.max.apply(null, franjasSel.map(function (f) { return aMinF(f.fin); })) : 0;
  var fuente = horarioDia.filter(function (h) {
    if (/^00/.test(String(h.grupo))) { var ini = aMinF(h.inicio); return ini >= ventIni && ini < ventFin; }
    return hs.indexOf(Number(h.hora)) >= 0;
  }).sort(function (a, b) { return Number(a.hora) - Number(b.hora); });
  var hsEf = hs.slice(); fuente.forEach(function (h) { if (hsEf.indexOf(Number(h.hora)) < 0) hsEf.push(Number(h.hora)); });   // sesiones que realmente se muestran (preescolar usa las suyas)
  regFecha.forEach(function (r) {
    if (hsEf.indexOf(Number(r.sesion)) >= 0) { regHoy.push(r); if (!yaMarcados[r.docente]) yaMarcados[r.docente] = r; }
  });
  /* Marcas a nombre de quien ya no tiene esa sesión (cambios de horario): se muestran en la tarjeta de quien hoy tiene esa sesión y ese grupo, para que nada se vea «sin marcar» */
  var ocupantes = {}, huerfanas = {};
  fuente.forEach(function (h) { ocupantes[h.docente] = 1; var so = parAlterna_(h, altern); if (so) ocupantes[so] = 1; });
  regHoy.forEach(function (r) { if (!ocupantes[r.docente]) huerfanas[claveSlot_(r.sesion, r.grupo, r.area)] = huerfanas[claveSlot_(r.sesion, r.grupo, r.area)] || r; });
  out.filas = fuente.map(function (h) {
    var enf = h.tipo === 'ENFASIS';
    var nota = [/^00/.test(String(h.grupo)) ? 'Preescolar ' + hhmm_(h.inicio) + ' - ' + hhmm_(h.fin) + (hhmm_(h.fin) >= '11:30' ? ' (siguen en el colegio hasta las 12:00: organizan y despachan a los niños)' : '') : '', h.alternancia, h.equipo_enfasis ? 'Con: ' + h.equipo_enfasis : ''].filter(String).join(' · ');
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
  out.filas.forEach(function (f) { f.reporte = reporteParaSesiones_(reportes[f.docente], hsEf); });   // solo las novedades que caen en las sesiones mostradas
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
  var hayBloqueo = reun.some(function (r) { return r.sinEstudiantes; });
  if (hayBloqueo && ignorarReunion) out.reunionIgnorada = true;   // el directivo eligió hacer la ronda aunque haya una actividad sin clases (la actividad puede ser solo de algunos grupos)
  if (hayBloqueo && !ignorarReunion) {
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
/** Opciones de las listas agregadas después de la primera versión del libro (hoja Listas): se añaden solas si faltan. */
var LISTAS_NUEVAS = [['fuente', 'Conocimiento de la comunidad (público)']];
function asegurarListas_() {
  var sh = hoja_('Listas'); if (!sh) return;
  var existentes = datos_('Listas').map(function (x) { return x.lista + '|' + x.valor; }), agregado = false;
  LISTAS_NUEVAS.forEach(function (f) { if (existentes.indexOf(f[0] + '|' + f[1]) < 0) { sh.appendRow(f); agregado = true; } });
  if (agregado) invalidarCache_('Listas');
}
function asegurarMotivos_() {
  var sh = hoja_('Motivos'), existentes = datos_('Motivos').map(function (m) { return m.motivo; });
  var agregado = false;
  MOTIVOS_NUEVOS.forEach(function (f) { if (existentes.indexOf(f[1]) < 0) { sh.appendRow(f); agregado = true; } });
  if (agregado) invalidarCache_('Motivos');
}

/**
 * Turnos de la ronda: quién debe hacerla en cada bloque de cada día (hoja Turnos_Ronda, que se crea sola con estos valores y se puede editar).
 * Sirve para avisar en la ronda cuando alguien hace el bloque de otra persona y para mostrarlo en el panel de informes. No bloquea nada.
 * dia, bloque, titular, alterno (quien suele reemplazar al titular; vacío si no hay).
 */
var COL_TURNOS = ['dia', 'bloque', 'titular', 'alterno'];
var TURNOS_DEFECTO = (function () {
  var R = 'Jorge Hernández', H = 'Harold Angulo', V = 'Verónica Barreiro', F = 'Francisco Cortés', t = [];
  [['LUNES', R, H], ['MARTES', H, ''], ['MIERCOLES', R, H], ['JUEVES', H, '']].forEach(function (d) {   // el que abre la jornada la cierra en el cuarto bloque
    t.push([d[0], 1, d[1], d[2]], [d[0], 2, V, ''], [d[0], 3, F, ''], [d[0], 4, d[1], d[2]]);
  });
  t.push(['VIERNES', 1, F, ''], ['VIERNES', 2, V, ''], ['VIERNES', 3, R, H], ['VIERNES', 4, F, '']);
  return t;
})();
function turnosRonda_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Turnos_Ronda');
  if (!sh) { sh = SpreadsheetApp.getActive().insertSheet('Turnos_Ronda'); sh.appendRow(COL_TURNOS); sh.getRange(2, 1, TURNOS_DEFECTO.length, COL_TURNOS.length).setValues(TURNOS_DEFECTO); }
  return datos_('Turnos_Ronda');
}
/** {titular, alterno} del bloque de un día, o null si no está definido. */
function turnoDe_(dia, bloque) {
  try {
    var f = turnosRonda_().filter(function (t) { return String(t.dia).toUpperCase() === String(dia).toUpperCase() && Number(t.bloque) === Number(bloque); })[0];
    return f ? { titular: String(f.titular || '').trim(), alterno: String(f.alterno || '').trim() } : null;
  } catch (e) { return null; }
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
  var t0 = new Date().getTime(), tLect = 0, nReg = 0, nNov = 0;
  var quien = exigirDirectivo_();
  // el responsable de la ronda es quien inició sesión, salvo que preste su teléfono o su sesión a otro directivo registrado: ese nombre sí se acepta
  var sesionDe = quien.nombre || quien.email, elegido = String(p.directivo || '').trim();
  var valido = elegido && datos_('Directivos').some(function (d) { return d.nombre === elegido; });
  p.directivo = valido ? elegido : sesionDe;
  if (valido && elegido !== sesionDe) bitacora_('Ronda con sesión prestada', 'La ronda de ' + (p.fecha || '') + ' (sesión ' + (p.sesion || '') + ') la hizo ' + elegido + ' con la sesión de ' + sesionDe);
  // rondas de otra fecha: solo quien administra puede corregirlas, con el motivo de la corrección (queda en cada marca y en la bitácora)
  var hoyG = ymd_(new Date()), fechaG = p.fecha ? fechaIso_(p.fecha) : hoyG, correccion = '', sufCorr = '', adminG = puedeAdministrar_(quien);
  if (fechaG === hoyG && !adminG && rondaCerrada_()) throw new Error('La ronda de hoy se cerró a las ' + cierreRonda_() + '. Pídale a quien administra que la registre.');
  if (fechaG !== hoyG) {
    var atras = Math.round((new Date(hoyG + 'T12:00:00Z') - new Date(fechaG + 'T12:00:00Z')) / 86400000);
    if (!adminG && !(atras >= 1 && atras <= diasAtrasRonda_())) throw new Error('Solo quien administra puede guardar o corregir la ronda de otra fecha.');
    if (fechaG > hoyG) throw new Error('No se puede guardar una ronda de una fecha futura.');
    var dwG = resDia_(fechaG); if (dwG < 1 || dwG > 5) throw new Error('Elija un día hábil (lunes a viernes).');
    correccion = String(p.correccion || '').trim();
    if (correccion.length < 5) throw new Error('Escriba el motivo de la corrección (mínimo 5 letras).');
    sufCorr = ' · Corregido por ' + sesionDe + ' el ' + hoyG + ': ' + correccion;   // queda en cada marca y novedad
  }
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
    tLect = new Date().getTime() - t0; nReg = regVals.length; nNov = novVals.length;
    var guardados = 0, pendReg = [], pendNov = [];
    /* las filas nuevas se escriben de una sola vez (una llamada a la hoja en vez de una por fila); antes de borrar filas se vuelcan las pendientes */
    function volcarReg() { if (!pendReg.length) return; reg.getRange(regVals.length - pendReg.length + 1, 1, pendReg.length, regVals[0].length).setValues(pendReg.map(function (f) { return rellena_(f, regVals[0].length); })); pendReg = []; }
    function volcarNov() { if (!pendNov.length) return; nov.getRange(novVals.length - pendNov.length + 1, 1, pendNov.length, novVals[0].length).setValues(pendNov.map(function (f) { return rellena_(f, novVals[0].length); })); pendNov = []; }
    var delDia = [];   // posiciones (en regVals) de las filas de la fecha que se guarda
    for (var rr_ = 1; rr_ < regVals.length; rr_++) { var fr_ = regVals[rr_][1]; if ((fr_ instanceof Date ? ymd_(fr_) : String(fr_)) === fecha) delDia.push(rr_); }
    var extCache = null;   // solo las novedades de actividad externa, convertidas una vez (antes se convertía toda la hoja por cada docente ausente)
    function novExternas() {
      if (extCache) return extCache;
      var ct = novVals[0].indexOf('Tipo Novedad'); extCache = [];
      for (var q = 1; q < novVals.length; q++) if (novVals[q][ct] === TIPO_EXTERNA) { var o = {}; novVals[0].forEach(function (k, i) { o[k] = novVals[q][i]; }); extCache.push(o); }
      return extCache;
    }
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
        var ex = externaDe_(fecha, r.docente, sesion, novExternas());
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
                  r.motivo || '', just, minutos, ((r.obs || '') + sufCorr).slice(0, 300), p.directivo || '', atiende];
      var idx = -1;
      for (var ii = 0; ii < delDia.length; ii++) {   // solo las filas de esa fecha (antes se recorría toda la hoja por cada marca)
        var i = delDia[ii];
        if (Number(regVals[i][3]) === sesion && regVals[i][5] === r.docente) { idx = i; break; }
      }
      if (idx < 0) {   // una marca anterior del mismo puesto (fecha, sesión, grupo y área) a nombre de alguien que ya no tiene esa sesión se reemplaza en vez de duplicarse
        var ocup = {}; hz.forEach(function (h) { if (h.dia === p.dia && Number(h.hora) === sesion) ocup[h.docente] = 1; });
        for (var jj = 0; jj < delDia.length; jj++) {
          var i2 = delDia[jj];
          if (Number(regVals[i2][3]) === sesion && !ocup[regVals[i2][5]] && claveSlot_(sesion, regVals[i2][6], regVals[i2][7]) === claveSlot_(sesion, r.grupoCodigo, r.area)) { idx = i2; break; }
        }
      }
      if (idx > 0) { if (idx >= regVals.length - pendReg.length) pendReg[idx - (regVals.length - pendReg.length)] = fila; else reg.getRange(idx + 1, 1, 1, fila.length).setValues([fila]); regVals[idx] = fila; }
      else { pendReg.push(fila); regVals.push(fila); delDia.push(regVals.length - 1); }
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
        /* el tiempo de la jornada nunca baja a los 45 minutos de una sesión: se respeta el mayor entre el horario del docente, el total que calculó la pantalla
           (incluye las clases de su pareja de alternancia) y lo que ya estaba anotado en una novedad de jornada completa de ese día */
        total = Math.max(total, Number(r.minutosJornada) || 0);
        var colMin = novVals[0].indexOf('Minutos Desatendidos');
        for (var q = novVals.length - 1; q >= 1; q--) {
          if (fechaIso_(novVals[q][1]) === fecha && novVals[q][2] === r.docente && /no asisti/i.test(String(novVals[q][3])) &&
              (String(novVals[q][novCol]) === 'JC' || /^S\d$/.test(String(novVals[q][novCol])))) {
            if (String(novVals[q][novCol]) === 'JC' && colMin >= 0) total = Math.max(total, Number(novVals[q][colMin]) || 0);
            volcarNov(); nov.deleteRow(q + 1); novVals.splice(q, 1);
          }
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
        var nf = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', r.motivo || '', ((r.obs || '') + sufCorr).slice(0, 300),
                  r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA, pg.grado, pg.grupo, r.area,
                  'H' + sesion + ' ' + franja + (pre ? '' : ' Bloque ' + Math.ceil(sesion / 2)), minutos, p.directivo || '',
                  'S' + sesion + (resto ? '-FIN' : ''), just, m.categoria || '', atiende];
        if (resto) nf[12] = 'H' + sesion + ' ' + franja + ' · resto de la jornada';
        pendNov.push(nf); novVals.push(nf);
      }
      guardados++;
    });
    volcarReg(); volcarNov();
    if (correccion) bitacora_('Corrigió ronda anterior', fechaG + ' (' + (p.dia || '') + ', sesión ' + (p.sesion || '') + '): ' + guardados + ' marcas · motivo: ' + correccion);
    return { ok: true, guardados: guardados };
  } finally {
    lock.releaseLock(); var tAntesResp = new Date().getTime();
    if (typeof respaldarRonda_ === 'function') respaldarRonda_(filasRespaldo);
    var tTot = new Date().getTime() - t0;
    if (tTot > 5000) { try { bitacora_('Guardado de ronda lento', 'total ' + tTot + ' ms · hasta leer hojas ' + tLect + ' ms · respaldo ' + (new Date().getTime() - tAntesResp) + ' ms · filas Registro_Ronda ' + nReg + ' · Novedades ' + nNov + ' · marcas ' + (p.registros || []).length); } catch (e) { /* solo informativo */ } }
  }   // el respaldo va después de soltar el bloqueo y, si falla, el guardado no se afecta
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

// ===================== Resumen.gs =====================
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
/** Quién atendió al grupo cuando el docente falta: si lo cubrió alguien, la ausencia del docente cuenta pero el grupo no queda «sin atender». */
var RES_COBERTURA_ = ['Reemplazo (docente)', 'Reemplazo (acordado con rectoría)', 'Persona de apoyo contratada (alcaldía u otra entidad)', 'Otro docente (con espacio libre)', 'Practicante', 'Auxiliar o persona de apoyo del docente', 'Otro docente o directivo'];
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
    var cubierto = RES_COBERTURA_.indexOf(String(n.atiende || '').trim()) >= 0 && !/incumplimiento/i.test(tipo);   // el incumplimiento nunca se considera cubierto
    var sinGrupo = /^No aplica/i.test(String(n.atiende || '').trim()) && !/incumplimiento/i.test(tipo);   // orientación, PTAFI…: no tienen grupo, no hay estudiantes sin atender
    var minAus = minutos; if (cubierto || sinGrupo) minutos = 0;
    return {
      cubierto: cubierto, sinGrupo: sinGrupo, minutosAusencia: minAus,
      fecha: n.fecha, docente: n.docente, tipo: tipo, motivo: n.motivo || '', minutos: minutos, justificada: just === 'Sí' || just === 'SI' || just === 'Si' ? 'Sí' : 'No',
      categoria: n.categoria || m.categoria || 'OTRO', grupo: resGrupo_(n.grado, n.grupo), area: n.area || '', directivo: n.directivo || '',
      nivel: nivel[n.docente] || 'SIN NIVEL', ausencia: /no asisti/i.test(tipo), temporal: /temporal/i.test(tipo), incumplimiento: /incumplimiento/i.test(tipo), tarde: /tarde/i.test(tipo), salida: /salida/i.test(tipo)
    };
  }
  // todas las novedades (sin límite de fechas) que cumplen el filtro; de ahí salen el periodo y la tendencia
  var externas = (ctx.novedades || []).filter(function (n) { return n.tipo === 'Actividad externa con estudiantes'; });   // salidas pedagógicas: actividad institucional, no suman tiempo sin atender
  var todas = (ctx.novedades || []).filter(function (n) { return n.tipo && n.tipo !== 'Presente' && n.tipo !== 'Actividad externa con estudiantes'; }).map(norm).filter(function (n) { return pasa(n.docente, n.nivel); });
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
    minutosAusencia: resSuma_(nov, function (n) { return n.minutosAusencia; }),   // tiempo de ausencia de los docentes, con o sin grupo cubierto (lo que rectoría necesita)
    horasAusencia: Math.round(resSuma_(nov, function (n) { return n.minutosAusencia; }) / 60 * 10) / 10,
    horas: Math.round(minutos / 60 * 10) / 10,
    sesiones: Math.round(minutos / 45 * 10) / 10,
    cumplimiento: programadas > 0 ? Math.max(0, Math.round((1 - minutos / (programadas * 45)) * 1000) / 10) : null,
    docentesConNovedad: Object.keys(docentes).length,
    ausencias: Object.keys(ausDocDia).length,
    llegadasTarde: nov.filter(function (n) { return n.tarde; }).length,
    salidasTempranas: nov.filter(function (n) { return n.salida; }).length,
    permisosTemporales: nov.filter(function (n) { return n.temporal; }).length,
    incumplimientos: nov.filter(function (n) { return n.incumplimiento; }).length,
    salidasPedagogicas: (function () { var u = {}; externas.forEach(function (n) { if (n.fecha >= desde && n.fecha <= hasta && pasa(n.docente, nivel[n.docente] || 'SIN NIVEL')) u[n.docente + '|' + n.fecha] = 1; }); return Object.keys(u).length; })(),
    eventos: nov.length,
    minutosCubiertos: resSuma_(nov.filter(function (n) { return n.cubierto; }), function (n) { return n.minutosAusencia; }),
    eventosCubiertos: nov.filter(function (n) { return n.cubierto; }).length,
    pctJustificadas: nov.length ? Math.round(just.length / nov.length * 1000) / 10 : null,
    minutosSinJustificar: resSuma_(nov.filter(function (n) { return n.justificada !== 'Sí'; }), function (n) { return n.minutosAusencia; })
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
    if (!docs[x.docente]) { docs[x.docente] = { docente: x.docente, nivel: x.nivel, eventos: 0, dias: {}, minutos: 0, sinAtender: 0, sinJustificar: 0 }; ordenD.push(x.docente); }
    var d = docs[x.docente]; d.eventos++; d.dias[x.fecha] = 1; d.minutos += x.minutosAusencia; d.sinAtender += x.minutos; if (x.justificada !== 'Sí') d.sinJustificar += x.minutosAusencia;
  });
  var porDocente = ordenD.map(function (k) { var d = docs[k]; return { docente: d.docente, nivel: d.nivel, eventos: d.eventos, dias: Object.keys(d.dias).length, minutos: d.minutos, sinAtender: d.sinAtender, sinJustificar: d.sinJustificar }; })
    .sort(function (a, b) { return b.minutos - a.minutos || (a.docente < b.docente ? -1 : 1); });

  // ronda del último día del rango (esperados y verificados, dentro del filtro)
  var dh = RES_DIAS[resDia_(hasta)], ronda = [];
  for (var s = 1; s <= 8; s++) {
    var esp = hz.filter(function (h) { return h.dia === dh && Number(h.hora) === s; }).length;
    var marc = {}; (ctx.registro || []).forEach(function (r) { if (r.fecha === hasta && Number(r.sesion) === s && pasa(r.docente, nivel[r.docente] || 'SIN NIVEL')) marc[r.docente] = 1; });
    ronda.push({ sesion: s, esperados: esp, marcados: Object.keys(marc).length });
  }

  function fila(x) { return { fecha: x.fecha, docente: x.docente, grupo: x.grupo, area: x.area, tipo: x.tipo, motivo: x.motivo + (x.cubierto ? ' · grupo atendido por reemplazo (' + x.minutosAusencia + ' min cubiertos)' : (x.sinGrupo ? ' · sin grupo asignado' : '')), minutos: x.minutos, minutosAusencia: x.minutosAusencia, justificada: x.justificada, directivo: x.directivo }; }
  return {
    desde: desde, hasta: hasta, diasHabiles: dias.length, filtros: { nivel: fNivel, docente: fDoc }, kpis: kpis, tendencia: tendencia,
    porCategoria: resAgrupa_(nov, function (x) { return x.categoria; }, function (x) { return x.minutosAusencia; }),
    porMotivo: resAgrupa_(nov, function (x) { return x.motivo || '(sin motivo)'; }, function (x) { return x.minutosAusencia; }),
    porTipo: resAgrupa_(nov, function (x) { return x.tipo; }, function (x) { return x.minutosAusencia; }),
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
    '<div style="font-size:13px;color:#52514e">' + e(k.sesiones) + ' sesiones de 45 min de ' + e(k.programadas) + ' programadas · cumplimiento ' + (k.cumplimiento == null ? '—' : e(k.cumplimiento) + '%') + (k.minutosCubiertos ? ' · ' + resMin_(k.minutosCubiertos) + ' de grupos atendidos por reemplazo (no cuentan como sin atender)' : '') + '</div><div style="font-size:13px;color:#52514e;margin-top:4px"><b>Ausencia total de docentes:</b> ' + e(k.horasAusencia) + ' horas (incluye lo cubierto por reemplazo)</div></div>' +
    '<table width="100%" cellpadding="0" cellspacing="6" style="margin-bottom:10px"><tr>' +
    [['Docentes con novedad', k.docentesConNovedad], ['Ausencias', k.ausencias], ['Llegadas tarde', k.llegadasTarde], ['Salidas tempranas', k.salidasTempranas], ['Permisos por horas', k.permisosTemporales], ['Salidas pedagógicas (docente-día)', k.salidasPedagogicas], ['Incumplimientos', k.incumplimientos],
     ['Justificadas', k.pctJustificadas == null ? '—' : k.pctJustificadas + '%']].map(function (t) {
      return '<td style="background:#f3f3f0;border-radius:8px;padding:8px 10px;width:14%"><div style="font-size:11.5px;color:#52514e">' + e(t[0]) + '</div><div style="font-size:20px;font-weight:600">' + e(t[1]) + '</div></td>';
    }).join('') + '</tr></table>';
  if (!r.dia.length) {
    h += '<p style="font-size:14px">No se registraron novedades en el día.</p>';
  } else {
    h += '<h3 style="font-size:14px;margin:14px 0 0">Novedades del día</h3>' +
      tabla(['Docente', 'Grupo', 'Área', 'Novedad', 'Motivo', 'Minutos', 'Justif.'],
            r.dia.slice(0, 40).map(function (x) { return [x.docente, x.grupo, x.area, x.tipo, x.motivo, x.minutos, x.justificada]; })) +
      (r.dia.length > 40 ? '<p style="font-size:12px;color:#52514e">Se muestran 40 de ' + r.dia.length + '. El detalle completo está en el panel.</p>' : '');
    h += '<h3 style="font-size:14px;margin:6px 0 0">Motivos (tiempo de ausencia de los docentes)</h3>' + barras(r.porCategoria, 6) +
         '<h3 style="font-size:14px;margin:6px 0 0">Grupos más afectados</h3>' + barras(r.porGrupo, 6);
  }
  h += '<p style="font-size:12.5px;color:#52514e">Ronda de verificación (docentes verificados/esperados): ' + e(ronda || 'sin registros') + '</p>' +
       (urlPanel ? '<p><a href="' + e(urlPanel) + '" style="color:#1c5cab">Abrir el panel completo</a></p>' : '') +
       '<p style="font-size:11.5px;color:#74736d;border-top:1px solid #e6e5e0;padding-top:8px">Información confidencial de uso directivo (Ley 1581 de 2012).<br>Sistema de control de asistencia docente · Autor: Francisco Javier Cortés Cabezas, coordinador académico; especialista en informática y telemática, magíster en educación, doctorando en desarrollo de la educación. I.E. ICET.</p></div>';
  return h;
}

// ===================== Plazos.gs =====================
/**
 * Plazos para entregar soportes de las ausencias. Función pura (sin servicios de Google): se prueba en Node.
 *
 * Reglas (definidas por el coordinador):
 *  - Se cuentan DÍAS HÁBILES (lunes a viernes) desde el REINTEGRO, que es el día hábil siguiente al último día de la ausencia.
 *  - Ausencia sin justificación: 3 días para justificarla. Los demás motivos: máximo 5 días (incapacidad, viaje, etc.).
 *  - Varios días hábiles seguidos con "No asistió" son UNA sola ausencia y un solo soporte (el fin de semana no la corta).
 *  - Solo las ausencias (No asistió) y solo los motivos que requieren soporte; llegadas tarde y salidas tempranas no.
 *
 * ctx = { hoy, desde, docente (opcional), novedades:[{fecha, docente, tipo, motivo, minutos}],
 *         soportes:[{clave, id, estado, fecha_carga}], motivos:[{motivo, requiere_soporte, plazo_dias}] }
 * Cada obligación tiene la clave "docente|fecha de inicio" y estado:
 *   En curso (aún no se cumple el reintegro) · Pendiente · Vencido · Entregado (por revisar) · Aceptado · Rechazado · No aplica
 */
function plzHabil_(f) { var d = resDia_(f); return d >= 1 && d <= 5; }
function plzSiguiente_(f) { var x = resSumaDias_(f, 1), g = 0; while (!plzHabil_(x) && g++ < 10) x = resSumaDias_(x, 1); return x; }
function plzSuma_(f, n) { var x = f; for (var i = 0; i < n; i++) x = plzSiguiente_(x); return x; }
/** Días hábiles después de "a" hasta "b" incluido (0 si b no es posterior). */
function plzEntre_(a, b) { var c = 0, x = a, g = 0; while (x < b && g++ < 400) { x = resSumaDias_(x, 1); if (plzHabil_(x)) c++; } return c; }

function calcularObligaciones_(ctx) {
  var hoy = ctx.hoy, desde = ctx.desde || '0000-00-00';
  var mot = {}; (ctx.motivos || []).forEach(function (m) { mot[m.motivo] = m; });
  var requiere = function (m) { return !mot[m] || String(mot[m].requiere_soporte).toUpperCase() === 'SI'; };
  var plazoDe = function (m) { return mot[m] && Number(mot[m].plazo_dias) > 0 ? Number(mot[m].plazo_dias) : 5; };

  var porDoc = {};
  (ctx.novedades || []).forEach(function (n) {
    if (!/no asisti/i.test(String(n.tipo)) || n.fecha < desde || !plzHabil_(n.fecha)) return;
    if (ctx.docente && n.docente !== ctx.docente) return;
    var d = porDoc[n.docente] = porDoc[n.docente] || {};
    var x = d[n.fecha] = d[n.fecha] || { motivos: {}, minutos: 0 };
    x.motivos[n.motivo || ''] = 1;
    var mi = Number(n.minutos); x.minutos += mi > 0 ? mi : 45;
  });

  var salida = [];
  Object.keys(porDoc).forEach(function (doc) {
    var fechas = Object.keys(porDoc[doc]).sort(), runs = [], act = null;
    fechas.forEach(function (f) {
      if (act && plzSiguiente_(act.fin) === f) { act.fin = f; act.fechas.push(f); }
      else { act = { inicio: f, fin: f, fechas: [f] }; runs.push(act); }
    });
    runs.forEach(function (r) {
      var motivos = {}, minutos = 0;
      r.fechas.forEach(function (f) { Object.keys(porDoc[doc][f].motivos).forEach(function (m) { motivos[m] = 1; }); minutos += porDoc[doc][f].minutos; });
      var lista = Object.keys(motivos);
      var piden = lista.filter(requiere);
      if (!piden.length) return;                                   // ningún motivo de la ausencia exige soporte
      var todasInjust = lista.every(function (m) { return m === 'Sin justificación'; });
      var plazo = todasInjust ? plazoDe('Sin justificación') : Math.max.apply(null, piden.filter(function (m) { return m !== 'Sin justificación'; }).map(plazoDe).concat([0]));
      var reintegro = plzSiguiente_(r.fin), limite = plzSuma_(reintegro, plazo);
      var clave = doc + '|' + r.inicio;
      var sop = (ctx.soportes || []).filter(function (s) { return s.clave === clave; })
        .sort(function (a, b) { return String(a.fecha_carga) < String(b.fecha_carga) ? 1 : -1; })[0] || null;
      var estado, dias = hoy <= limite ? plzEntre_(hoy, limite) : -plzEntre_(limite, hoy);
      if (sop && sop.estado) estado = sop.estado;                   // Entregado, Aceptado, Rechazado, No aplica
      else if (hoy <= r.fin) estado = 'En curso';
      else estado = hoy <= limite ? 'Pendiente' : 'Vencido';
      salida.push({ clave: clave, docente: doc, inicio: r.inicio, fin: r.fin, dias: r.fechas.length, reintegro: reintegro, limite: limite, plazoDias: plazo,
                    motivos: lista, minutos: minutos, estado: estado, diasRestantes: dias,
                    soporte: sop ? { id: sop.id, estado: sop.estado, fecha_carga: sop.fecha_carga } : null });
    });
  });
  var orden = { 'Vencido': 0, 'Rechazado': 1, 'Pendiente': 2, 'En curso': 3, 'Entregado': 4, 'Aceptado': 5, 'No aplica': 6 };
  return salida.sort(function (a, b) { return (orden[a.estado] - orden[b.estado]) || (a.limite < b.limite ? -1 : (a.limite > b.limite ? 1 : (a.docente < b.docente ? -1 : 1))); });
}

/** Resumen para coordinación: cuántas obligaciones hay por estado. */
function resumenObligaciones_(obl) {
  var r = { vencidos: 0, pendientes: 0, porRevisar: 0, rechazados: 0, aceptados: 0 };
  obl.forEach(function (o) {
    if (o.estado === 'Vencido') r.vencidos++; else if (o.estado === 'Pendiente') r.pendientes++;
    else if (o.estado === 'Entregado') r.porRevisar++; else if (o.estado === 'Rechazado') r.rechazados++; else if (o.estado === 'Aceptado') r.aceptados++;
  });
  return r;
}

// ===================== Acceso.gs =====================
/**
 * Identidad y acceso por correo.
 *
 * Cada persona se identifica con su cuenta de Google (Gmail u otro correo con cuenta Google), desde el celular o el computador.
 *  - directivo:    editor del libro o listado en la hoja Directivos.
 *  - docente:      correo activo en la hoja Usuarios (o escrito de antemano en Docentes.correo). Ve solo lo suyo.
 *  - pendiente:    pidió acceso y espera la aprobación de un directivo.
 *  - sin_registro: primera vez: elige su nombre, acepta la autorización de datos y queda pendiente (se registra una sola vez).
 *  - bloqueado / anonimo: sin acceso.
 *
 * Cuando la petición llega desde el proyecto "front" (ver Api.gs), el correo viene verificado por el front en REQ_EMAIL.
 */
var REQ_EMAIL = null;
var TEXTO_AUTORIZACION_VERSION = 'v1-borrador';
var TEXTO_AUTORIZACION =
  'BORRADOR para revisión de la institución (no es asesoría jurídica). ' +
  'Autorizo a la Institución Educativa [NOMBRE DE LA INSTITUCIÓN], como responsable del tratamiento, a recolectar, almacenar y usar mis datos personales ' +
  '(nombre, correo, horario, asistencia y novedades) y los soportes que yo cargue, que pueden incluir datos sensibles de salud (incapacidades, constancias, ' +
  'epicrisis) y de mi familia (actas, citaciones), con la finalidad exclusiva de controlar la asistencia, justificar mis ausencias y cumplir la normatividad laboral. ' +
  'Los datos sensibles son facultativos: puedo no entregarlos, aunque sin soporte la ausencia no podrá justificarse. ' +
  'Solo los verán los directivos docentes. Conozco mis derechos de conocer, actualizar, rectificar y suprimir mis datos y de revocar esta autorización ' +
  '(Ley 1581 de 2012 y Decreto 1377 de 2013), que ejerzo escribiendo a [CORREO DE CONTACTO]. Se conservarán mientras dure la relación laboral y el tiempo que exija la ley.';

/** Quien llama debe haber iniciado sesión como directivo (con clave, o con cuenta de Google en el modo anterior). */
function exigirDirectivo_() {
  var id = identidad_();
  if (id.rol !== 'directivo') throw new Error('Debe iniciar sesión.');
  return id;
}
/** Acciones del menú del libro: solo quien es editor del libro (nadie desde la aplicación web pública). */
function exigirEditor_() {
  var email = emailActual_();
  if (!email || editoresLibro_().indexOf(email) < 0) throw new Error('Esta acción solo se hace desde el libro, con su cuenta.');
}

/** Diagnóstico para quien administra: ejecutarla desde el editor y mirar el Registro de ejecución. No devuelve nada (solo escribe en el registro). */
function diagnosticoAcceso() {
  var a = '', e = '', ed = [], o = '', err = '';
  try { a = Session.getActiveUser().getEmail(); } catch (x) { err += ' activo:' + x.message; }
  try { e = Session.getEffectiveUser().getEmail(); } catch (x) { err += ' efectivo:' + x.message; }
  try { var ss = SpreadsheetApp.getActive(); ss.getEditors().forEach(function (u) { ed.push(u.getEmail()); }); var ow = ss.getOwner(); o = ow ? ow.getEmail() : '(sin propietario visible)'; } catch (x) { err += ' libro:' + x.message; }
  Logger.log('Usuario activo: [' + a + '] · Usuario efectivo: [' + e + '] · Propietario: [' + o + '] · Editores: [' + ed.join(', ') + ']' + (err ? ' · Errores:' + err : ''));
}

function emailActual_() {
  if (REQ_EMAIL !== null) return String(REQ_EMAIL).toLowerCase();
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}

function editoresLibro_() {
  var out = [];
  try {
    var ss = SpreadsheetApp.getActive();
    ss.getEditors().forEach(function (u) { out.push(String(u.getEmail()).toLowerCase()); });
    var o = ss.getOwner(); if (o) out.push(String(o.getEmail()).toLowerCase());
  } catch (e) { /* sin permiso para listar editores */ }
  return out;
}

/** Devuelve la hoja; si no existe la crea con los encabezados (los libros anteriores no tienen Usuarios ni Soportes). */
function hojaOCrea_(nombre, cabeceras) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.appendRow(cabeceras); }
  return sh;
}
/** Como datos_(), pero si la hoja no existe todavía (libros anteriores) la crea con sus encabezados. */
function datosOCrea_(nombre, cabeceras) { hojaOCrea_(nombre, cabeceras); return datos_(nombre); }
var COL_USUARIOS = ['email', 'docente', 'estado', 'fecha_solicitud', 'autoriza_datos', 'fecha_autorizacion', 'version_texto', 'aprobado_por', 'fecha_aprobacion'];

function ahoraTxt_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }

function nombreDirectivo_(email) {
  var d = datos_('Directivos').filter(function (x) { return String(x.correo_temporal).toLowerCase() === email; })[0];
  return d ? d.nombre : '';
}

/** Quién es la persona que llama. No escribe nada. */
function identidad_() {
  var email = emailActual_();
  if (!email) return { rol: 'anonimo', email: '' };
  var dir = datos_('Directivos').filter(function (d) { return String(d.correo_temporal).toLowerCase() === email; })[0];
  if (editoresLibro_().indexOf(email) >= 0 || dir) {
    return { rol: 'directivo', email: email, nombre: dir ? dir.nombre : email, vistaInicial: dir && /rector/i.test(String(dir.rol)) ? 'rector' : 'coordinacion' };
  }
  var us = datosOCrea_('Usuarios', COL_USUARIOS).filter(function (u) { return String(u.email).toLowerCase() === email; })[0];
  if (us) {
    if (us.estado === 'ACTIVO') return { rol: 'docente', email: email, docente: us.docente, autorizado: String(us.autoriza_datos).toUpperCase() === 'SI' };
    if (us.estado === 'PENDIENTE') return { rol: 'pendiente', email: email, docente: us.docente };
    return { rol: 'bloqueado', email: email };
  }
  var pre = datos_('Docentes').filter(function (d) { return d.correo && String(d.correo).toLowerCase() === email; })[0];   // correo escrito de antemano
  if (pre) return { rol: 'docente', email: email, docente: pre.nombre_completo, autorizado: false, preregistro: true };
  return { rol: 'sin_registro', email: email };
}

function nombresRegistro_() {
  return datos_('Docentes').filter(function (d) { return d.nivel !== 'REEMPLAZADO'; }).map(function (d) { return d.nombre_completo; })
    .sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

/** Lo primero que pide la pantalla: qué rol tiene quien la abre y qué datos necesita. */
function contextoPanel() {
  var id = identidad_();
  if (id.rol === 'directivo') {
    var docs = datos_('Docentes').filter(function (d) { return d.nivel !== 'REEMPLAZADO'; }), niveles = {};
    docs.forEach(function (d) { niveles[d.nivel] = 1; });
    var ec = estadoCorreo_(id);
    return { rol: 'directivo', nombre: id.nombre, vistaInicial: id.vistaInicial, administra: puedeAdministrar_(id), debeCambiar: !!ec.debeCambiar, necesitaCorreo: ec.necesitaCorreo, correo: ec.correo || '', informes: ec.informes || null,
             docentes: docs.map(function (d) { return { nombre: d.nombre_completo, nivel: d.nivel }; }), niveles: Object.keys(niveles).sort() };
  }
  if (id.rol === 'docente') {
    return { rol: 'docente', vistaInicial: 'docente', docente: id.docente, nombre: id.docente, autorizado: id.autorizado, debeCambiar: docenteDebeCambiarClave_(id), conClave: esCorreoInternoDoc_(id.email), textoAutorizacion: TEXTO_AUTORIZACION, version: TEXTO_AUTORIZACION_VERSION };
  }
  if (id.rol === 'sin_registro') {
    return { rol: 'sin_registro', email: id.email, docentes: nombresRegistro_(), textoAutorizacion: TEXTO_AUTORIZACION, version: TEXTO_AUTORIZACION_VERSION };
  }
  return { rol: id.rol, email: id.email, docente: id.docente || '' };
}

/* ------------------------------ registro de docentes ------------------------------ */
/** Primera vez: la persona elige su nombre y acepta la autorización. Queda PENDIENTE hasta que un directivo la apruebe. */
function solicitarAcceso(p) {
  var id = identidad_();
  if (id.rol !== 'sin_registro') throw new Error('Esta cuenta ya está registrada.');
  if (!p || p.autoriza !== true) throw new Error('Debe aceptar la autorización de tratamiento de datos.');
  if (nombresRegistro_().indexOf(p.docente) < 0) throw new Error('Elija su nombre de la lista.');
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), ahora = ahoraTxt_();
  sh.appendRow([id.email, p.docente, 'PENDIENTE', ahora, 'SI', ahora, TEXTO_AUTORIZACION_VERSION, '', '']);
  return { estado: 'PENDIENTE' };
}

/** Docente preregistrado por correo (hoja Docentes): acepta la autorización la primera vez. */
function aceptarAutorizacion() {
  var id = identidad_();
  if (id.rol !== 'docente') throw new Error('Solo un docente puede aceptar la autorización.');
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), v = sh.getDataRange().getValues(), ahora = ahoraTxt_();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === id.email) {
      sh.getRange(i + 1, 5).setValue('SI'); sh.getRange(i + 1, 6).setValue(ahora); sh.getRange(i + 1, 7).setValue(TEXTO_AUTORIZACION_VERSION);
      return { autorizado: true };
    }
  }
  sh.appendRow([id.email, id.docente, 'ACTIVO', ahora, 'SI', ahora, TEXTO_AUTORIZACION_VERSION, 'preregistro (hoja Docentes)', ahora]);
  return { autorizado: true };
}

/** Directivos: solicitudes pendientes y cuentas activas. */
function listarSolicitudes() {
  exigirDirectivo_();
  var us = datosOCrea_('Usuarios', COL_USUARIOS);
  return {
    pendientes: us.filter(function (u) { return u.estado === 'PENDIENTE'; }).map(function (u) { return { email: u.email, docente: u.docente, fecha: u.fecha_solicitud }; }),
    activos: us.filter(function (u) { return u.estado === 'ACTIVO'; }).map(function (u) { return { email: u.email, docente: u.docente }; })
  };
}

/** Directivos: aprueban, rechazan o bloquean una cuenta. p = {email, accion: APROBAR | RECHAZAR | BLOQUEAR} */
function resolverSolicitud(p) {
  var id = identidad_();
  if (id.rol !== 'directivo') throw new Error('Solo un directivo puede resolver solicitudes.');
  var estado = { APROBAR: 'ACTIVO', RECHAZAR: 'RECHAZADO', BLOQUEAR: 'BLOQUEADO' }[p && p.accion];
  if (!estado) throw new Error('Acción no válida.');
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), v = sh.getDataRange().getValues(), ok = false;
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).toLowerCase() === String(p.email).toLowerCase()) {
      sh.getRange(i + 1, 3).setValue(estado); sh.getRange(i + 1, 8).setValue(id.nombre || id.email); sh.getRange(i + 1, 9).setValue(ahoraTxt_()); ok = true;
    }
  }
  if (!ok) throw new Error('No se encontró esa solicitud.');
  return { email: p.email, estado: estado };
}

// ===================== Dashboard.gs =====================
/**
 * Panel (dashboard) e informe diario al rector.
 * Hojas que lee: Novedades, Registro_Ronda, Horario, Docentes, Motivos, Directivos.
 */

function fechaIso_(v) {
  if (v instanceof Date) return ymd_(v);
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);          // dd/mm/aaaa (formato del formulario actual)
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s.slice(0, 10);
}

/** Cálculo sin control de acceso (lo usan el informe diario y el panel ya autorizado). */
function resumenInterno_(desde, hasta, filtros) {
  var nivelDe = {};
  var docs = datos_('Docentes');
  docs.forEach(function (d) { nivelDe[d.nombre_completo] = d.nivel; });
  var nov = datos_('Novedades').map(function (n) {
    return { fecha: fechaIso_(n['Fecha Novedad']), docente: n['Docente'], tipo: n['Tipo Novedad'], motivo: n['Motivo Ausencia'],
             justificada: n['Justificada'], categoria: n['Categoría motivo'], grado: n['Grado'], grupo: n['Grupo'], area: n['Área/Asignatura'],
             minutos: n['Minutos Desatendidos'], directivo: n['Directivo Docente'], atiende: n['Grupo atendido por'] };
  });
  var reg = datos_('Registro_Ronda').map(function (r) { return { fecha: fechaIso_(r.fecha), sesion: r.sesion, docente: r.docente, estado: r.estado }; });
  var hz = datos_('Horario').map(function (h) { return { dia: h.dia, hora: Number(h.hora), docente: h.docente, nivel: nivelDe[h.docente] || 'SIN NIVEL' }; });
  var resumen = calcularResumen_({
    desde: desde, hasta: hasta, filtros: filtros || {}, novedades: nov, registro: reg, horario: hz,
    docentes: docs.map(function (d) { return { nombre_completo: d.nombre_completo, nivel: d.nivel }; }),
    motivos: datos_('Motivos').map(function (m) { return { motivo: m.motivo, categoria: m.categoria, justificada: m.justificada }; })
  });
  var obl = obligaciones_((filtros && filtros.docente) || '');   // soportes pendientes y vencidos (dentro del filtro de docente)
  resumen.soportes = { resumen: resumenObligaciones_(obl), vencidos: obl.filter(function (o) { return o.estado === 'Vencido'; }).slice(0, 10) };
  return resumen;
}

/** Resumen para el panel (lo llama Dashboard.html). Un docente solo recibe su propio informe. */
function datosDashboard(desde, hasta, filtros) {
  var id = identidad_();
  if (id.rol === 'directivo') return resumenInterno_(desde, hasta, filtros);
  if (id.rol === 'docente') return resumenInterno_(desde, hasta, { docente: id.docente });
  throw new Error('No tiene acceso a este panel. Pida al coordinador que lo agregue.');
}

function urlBase() { return ScriptApp.getService().getUrl(); }

/* ------------------------------ informe diario al rector ------------------------------ */
var NOMBRE_DIA_ = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Correo real de un directivo: la columna `correo` (la captura el propio directivo al ingresar) o, si no hay, un correo_temporal que no sea de ejemplo. */
function correoDe_(d) {
  var c = String(d.correo || '').trim(), t = String(d.correo_temporal || '').trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return c;
  return t && !/@example\.com$/i.test(t) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : '';
}
/** Quién recibe cada tipo de informe ('dia', 'semana', 'mes'): directivos con correo real que no lo hayan desactivado. */
function destinatarios_(tipo) {
  hojaDirectivos_();
  var out = [];
  datos_('Directivos').forEach(function (d) {
    var c = correoDe_(d), pref = String(d['informe_' + tipo] || '').trim().toUpperCase();
    if (c && pref !== 'NO' && out.indexOf(c) < 0) out.push(c);
  });
  return out;
}
function correoRector_() {
  var r = datos_('Directivos').filter(function (d) { return /rector/i.test(String(d.rol)); })[0];
  return r ? correoDe_(r) : '';
}

/** Incumplimientos reportados en un periodo (sección del informe por correo). */
function htmlIncumplimientos_(desde, hasta) {
  var l = datosOCrea_('Incumplimientos', COL_INCUMPL).filter(function (r) { var f = fechaIso_(limpiaTxt_(r.fecha)); return f >= desde && f <= hasta; });
  if (!l.length) return '';
  var e = resEsc_;
  return '<div style="margin-top:12px;border-left:4px solid #7b1fa2;padding:6px 10px;background:#f6e9fa"><div style="font-weight:600;color:#5a1273">Incumplimientos reportados (' + l.length + ')</div>' +
    l.map(function (r) { return '<div style="font-size:13px;margin-top:6px"><b>' + e(r.docente) + '</b> · ' + e(String(r.tipo).replace('Incumplimiento: ', '')) + ' · ' + e(r.sesiones) +
      (Number(r.reincidencia) > 1 ? ' · ' + e(r.reincidencia) + '.º reporte' : '') + '<br>' + e(r.descripcion) + ' <span style="color:#74736d">(' + e(r.registrado_por) + ')</span></div>'; }).join('') + '</div>';
}

/**
 * Envía el informe del día, de la semana o del mes a los directivos con correo. tipo: 'dia' | 'semana' | 'mes'.
 * soloA: lista de correos (prueba). Devuelve {enviado, para:[...], motivo?}.
 */
function enviarInformes_(tipo, soloProbar, soloA) {
  var hoy = new Date(), u = Number(Utilities.formatDate(hoy, TZ, 'u'));
  if (u > 5 && !soloProbar) return { enviado: false, motivo: 'fin de semana' };
  var f = ymd_(hoy), desde = f, nombre = 'del día', fechaTexto = NOMBRE_DIA_[u] + ' ' + Utilities.formatDate(hoy, TZ, "d 'de' MMMM 'de' yyyy");
  if (tipo === 'semana') { desde = lunesDe_(f); nombre = 'de la semana'; fechaTexto = 'Semana del ' + desde + ' al ' + f; }
  if (tipo === 'mes') { desde = f.slice(0, 8) + '01'; nombre = 'del mes'; fechaTexto = 'Mes de ' + Utilities.formatDate(hoy, TZ, 'MMMM yyyy') + ' (hasta el ' + f + ')'; }
  var r = resumenInterno_(desde, f, {});
  var cuerpo = htmlInforme_(r, fechaTexto, ScriptApp.getService().getUrl() + '?p=panel') + htmlReunionesInforme_(desde, f) + htmlIncumplimientos_(desde, f) + htmlRondas_(desde, f, '', tipo === 'dia');
  var para = soloA || destinatarios_(tipo);
  if (!para.length) { Logger.log('Informe NO enviado: ningún directivo tiene correo real registrado.'); return { enviado: false, motivo: 'sin correos', html: cuerpo }; }
  para.forEach(function (c) {
    MailApp.sendEmail({ to: c, subject: 'ICET - Informe ' + nombre + ' (' + f + '): ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  });
  return { enviado: true, para: para, tipo: tipo };
}
/**
 * El directivo se envía a sí mismo el informe del periodo que está viendo. El correo puede ser de cualquier proveedor (no solo Google) y se pide
 * en ese momento si aún no lo tiene registrado: p = {desde, hasta, correo?, recordar?}. Sin correo registrado ni enviado responde NECESITA_CORREO.
 */
function enviarInformeAMi(p) {
  var id = exigirDirectivo_();
  p = p || {};
  var desde = String(p.desde || ''), hasta = String(p.hasta || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde || hasta > resSumaDias_(desde, 400)) throw new Error('Revise las fechas del informe.');
  var correo = String(p.correo || '').trim().toLowerCase();
  if (correo) {
    if (!correoValido_(correo)) throw new Error('Escriba un correo válido.');
    if (p.recordar) { var ec0 = estadoCorreo_(id), inf = ec0.informes || { dia: true, semana: true, mes: true }; guardarCorreo({ correo: correo, dia: inf.dia, semana: inf.semana, mes: inf.mes }); }
  } else {
    correo = String(estadoCorreo_(id).correo || '');
  }
  if (!correo) throw new Error('NECESITA_CORREO');
  var r = resumenInterno_(desde, hasta, {});
  var cuerpo = htmlInforme_(r, 'Del ' + desde + ' al ' + hasta, ScriptApp.getService().getUrl() + '?p=panel') + htmlReunionesInforme_(desde, hasta) + htmlIncumplimientos_(desde, hasta) + htmlRondas_(desde, hasta, '', hasta === desde);
  MailApp.sendEmail({ to: correo, subject: 'ICET - Informe del ' + desde + ' al ' + hasta + ': ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  return { ok: true, para: correo };
}
/** Compatibilidad: informe del día. */
function enviarInformeDiario_(soloProbar) { var r = enviarInformes_('dia', soloProbar); if (r.enviado) r.para = r.para.join(', '); return r; }

/** Prueba desde el menú del libro: se envía el informe del día solo a quien lo pide. */
function probarInformeDiario() {
  exigirEditor_();
  var yo = emailActual_(), r = enviarInformes_('dia', true, yo ? [yo] : []);
  SpreadsheetApp.getUi().alert(r.enviado ? 'Informe de prueba enviado a ' + yo + '.'
    : 'No se envió: ' + (r.motivo || 'sin correo') + '.');
}

/** ¿Es hoy el último día hábil (lunes a viernes) del mes? */
function ultimoHabilDelMes_(f) {
  var s = resSumaDias_(f, 1), d = resDia_(s);
  while (d === 0 || d === 6) { s = resSumaDias_(s, 1); d = resDia_(s); }
  return s.slice(0, 7) !== f.slice(0, 7);
}
/**
 * Función que ejecuta el reloj del libro (lunes a viernes, hacia la 1:35 p. m., al terminar la jornada). Pública pero inofensiva:
 * envía como máximo una vez por día y no devuelve datos. Los viernes agrega el informe de la semana y el último día hábil del mes, el del mes.
 */
function informeDiarioProgramado() {
  var props = PropertiesService.getScriptProperties(), hoy = ymd_(new Date());
  if (props.getProperty('ultimo_informe') === hoy) return;
  props.setProperty('ultimo_informe', hoy);
  enviarInformes_('dia', false);
  if (Number(Utilities.formatDate(new Date(), TZ, 'u')) === 5) enviarInformes_('semana', false);
  if (ultimoHabilDelMes_(hoy)) enviarInformes_('mes', false);
}
function programarInformeDiario() {
  exigirEditor_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['enviarInformeDiario', 'informeDiarioProgramado'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('informeDiarioProgramado').timeBased().everyDays(1).atHour(13).nearMinute(35).inTimezone(TZ).create();
  SpreadsheetApp.getUi().alert('Programado: de lunes a viernes, hacia la 1:35 p. m., se envía el informe del día a los directivos con correo registrado (los viernes también el de la semana; el último día hábil del mes, el del mes).');
}

/* ------------------------------ informe de rondas (quién estuvo, quién no, quién tiene novedad) ------------------------------ */
var PRIORIDAD_RONDA_ = ['Presente', 'En reunión', 'En actividad externa', 'Llegada tarde', 'Salida temprana', 'Ausente temporal', 'No asistió'];
function escRonda_(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function categoriaRonda_(estado, atiende) {
  if (estado === 'Presente') return 'presentes';
  if (estado === 'No asistió' && RES_COBERTURA_.indexOf(String(atiende || '').trim()) >= 0) return 'conReemplazo';   // el titular no está, pero otra persona atendió el grupo
  if (estado === 'No asistió') return 'noAsistieron';
  if (estado === 'Ausente temporal') return 'permisos';
  if (estado === 'Llegada tarde' || estado === 'Salida temprana') return 'tardes';
  if (estado === 'En reunión' || estado === 'En actividad externa') return 'fuera';
  return 'incumplimientos';
}
/**
 * Rondas guardadas entre dos fechas, una por (fecha, bloque, directivo). Cada docente aparece una sola vez por bloque, con su situación más
 * seria. directivo: nombre exacto o vacío para todos. Devuelve {bloques:[{fecha,dia,bloque,directivo,presentes:[],noAsistieron:[],...}], directivos:[]}.
 */
function rondasInterno_(desde, hasta, directivo) {
  var mapa = {}, dirs = {};
  datos_('Registro_Ronda').forEach(function (r) {
    var f = fechaIso_(r.fecha); if (f < desde || f > hasta) return;
    var d = String(r.directivo || ''); if (d) dirs[d] = 1;
    if (directivo && d !== directivo) return;
    var b = Math.ceil(Number(r.sesion) / 2), k = f + '|' + b + '|' + d;
    var o = mapa[k] || (mapa[k] = { fecha: f, dia: r.dia, bloque: b, directivo: d, porDocente: {} });
    var ant = o.porDocente[r.docente], pr = PRIORIDAD_RONDA_.indexOf(r.estado);
    if (!ant || pr > PRIORIDAD_RONDA_.indexOf(ant.estado) || (pr < 0 && ant.estado === 'Presente')) o.porDocente[r.docente] = { docente: r.docente, estado: r.estado, atiende: r.atendido_por || '', motivo: r.motivo || '', minutos: r.minutos || '', obs: r.observaciones || '' };
  });
  var bloques = Object.keys(mapa).sort().map(function (k) {
    var o = mapa[k], tn = turnoDe_(o.dia, o.bloque), out = { fecha: o.fecha, dia: o.dia, bloque: o.bloque, directivo: o.directivo, correspondia: tn && tn.titular && tn.titular !== o.directivo && tn.alterno !== o.directivo ? tn.titular : '', presentes: [], noAsistieron: [], conReemplazo: [], permisos: [], tardes: [], fuera: [], incumplimientos: [] };
    Object.keys(o.porDocente).sort().forEach(function (n) { var x = o.porDocente[n]; out[categoriaRonda_(x.estado, x.atiende)].push(x); });
    out.total = Object.keys(o.porDocente).length;
    return out;
  });
  return { bloques: bloques, directivos: Object.keys(dirs).sort() };
}
/** Si en la hoja Directivos la columna `ve_todo` dice NO para quien inició sesión, solo ve sus propias rondas (vacío o SI = ve todas). */
function soloSusRondas_(id) {
  var nom = id.nombre || id.email, f = datos_('Directivos').filter(function (d) { return d.nombre === nom; })[0];
  return !!f && String(f.ve_todo || '').trim().toUpperCase() === 'NO' ? nom : '';
}
function informeRondas(p) {
  var id = exigirDirectivo_(), propio = soloSusRondas_(id);
  p = p || {};
  var desde = String(p.desde || ''), hasta = String(p.hasta || p.desde || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde || hasta > resSumaDias_(desde, 400)) throw new Error('Revise las fechas del informe.');
  var r = rondasInterno_(desde, hasta, propio || String(p.directivo || ''));
  if (propio) { r.directivos = [propio]; r.soloPropias = true; }
  return r;
}
/** HTML del informe de rondas para correo. conPresentes=false (semana o mes) deja solo los conteos de presentes. */
function htmlRondas_(desde, hasta, directivo, conPresentes) {
  var r = rondasInterno_(desde, hasta, directivo || '');
  if (!r.bloques.length) return '<h3 style="font-family:Arial;color:#0f2a5c">Rondas</h3><p style="font-family:Arial;font-size:14px;color:#456">No hay rondas guardadas en este periodo.</p>';
  var sec = [['noAsistieron', '✖ No asistieron', '#a31515'], ['conReemplazo', '👥 Con reemplazo (otra persona a cargo del grupo)', '#00695c'], ['permisos', '⏳ Permiso por horas', '#8a5a00'], ['tardes', '⏰ Llegada tarde o salida temprana', '#8a5a00'], ['fuera', '📋 En reunión o actividad externa', '#245'], ['incumplimientos', '⚠ Incumplimientos', '#7b1fa2']];
  var h = '<h3 style="font-family:Arial;color:#0f2a5c;margin-bottom:4px">Rondas de verificación</h3>';
  r.bloques.forEach(function (b) {
    h += '<div style="font-family:Arial;font-size:14px;border:1px solid #d5dbe3;border-radius:8px;padding:8px 10px;margin:8px 0"><b>' + escRonda_(b.dia + ' ' + b.fecha + ' · Bloque ' + b.bloque) + '</b> · ronda de ' + escRonda_(b.directivo || '—') +
         ' · <span style="color:#1b5e20">✔ ' + b.presentes.length + ' presentes</span> de ' + b.total;
    sec.forEach(function (s) {
      var l = b[s[0]]; if (!l.length) return;
      h += '<div style="margin-top:5px;color:' + s[2] + '"><b>' + s[1] + ' (' + l.length + ')</b>: ' + l.map(function (x) {
        return escRonda_(x.docente) + (x.motivo ? ' <i>(' + escRonda_(x.motivo) + (x.minutos ? ', ' + escRonda_(x.minutos) + ' min' : '') + ')</i>' : '');
      }).join('; ') + '</div>';
    });
    if (conPresentes && b.presentes.length) h += '<div style="margin-top:5px;color:#1b5e20"><b>✔ Presentes</b>: ' + b.presentes.map(function (x) { return escRonda_(x.docente) + (/^Sin estudiantes/.test(String(x.atiende || '')) ? ' <i style="color:#567">(' + escRonda_(String(x.atiende).toLowerCase()) + ')</i>' : ''); }).join('; ') + '</div>';
    h += '</div>';
  });
  return h;
}
/** El directivo se envía a sí mismo el informe de rondas del periodo (y, si quiere, solo de un directivo). p = {desde, hasta, directivo?, correo?, recordar?}. */
function enviarRondasAMi(p) {
  var id = exigirDirectivo_();
  p = p || {};
  var desde = String(p.desde || ''), hasta = String(p.hasta || p.desde || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde || hasta > resSumaDias_(desde, 400)) throw new Error('Revise las fechas del informe.');
  var correo = String(p.correo || '').trim().toLowerCase();
  if (correo) {
    if (!correoValido_(correo)) throw new Error('Escriba un correo válido.');
    if (p.recordar) { var ec0 = estadoCorreo_(id), inf = ec0.informes || { dia: true, semana: true, mes: true }; guardarCorreo({ correo: correo, dia: inf.dia, semana: inf.semana, mes: inf.mes }); }
  } else {
    correo = String(estadoCorreo_(id).correo || '');
  }
  if (!correo) throw new Error('NECESITA_CORREO');
  var cuerpo = htmlRondas_(desde, hasta, soloSusRondas_(id) || String(p.directivo || ''), hasta === desde);
  MailApp.sendEmail({ to: correo, subject: 'ICET - Rondas del ' + desde + (hasta !== desde ? ' al ' + hasta : ''), htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  return { ok: true, para: correo };
}

// ===================== Whatsapp.gs =====================
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
      var gtxt = fs1 ? (fs1.tipo === 'ENFASIS' ? fs1.grupos_enfasis : fs1.grupo) : (col.grupo === undefined ? '' : String(f[col.grupo]).replace(/^'/, ''));
      pg = gtxt ? partesGrupo_(String(gtxt).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
      area = fs1 && fs1.area ? fs1.area : (fs1 ? '(énfasis)' : 'N/A');
      jornadaTxt = 'H' + ses; codSes = 'S' + ses;
      minutos = (noAsistio || /temporal|incumplimiento/i.test(tipo)) ? (fs1 ? minutosSesion_(fs1.tipo === 'ENFASIS' ? fs1.grupos_enfasis : fs1.grupo) : 45) : '';
    } else {
      var gr = {}, ar = {};
      mias.forEach(function (x) { gr[x.tipo === 'ENFASIS' ? x.grupos_enfasis : x.grupo] = 1; ar[x.area || '(énfasis)'] = 1; });
      var grupos = Object.keys(gr), areas = Object.keys(ar);
      pg = grupos.length === 1 ? partesGrupo_(String(grupos[0]).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
      area = areas.length === 1 ? areas[0] : (mias.length ? 'Todas' : 'N/A');
      jornadaTxt = 'Jornada completa'; codSes = 'JC';
      minutos = noAsistio && mias.length ? mias.reduce(function (t, x) { return t + minutosSesion_(x.tipo === 'ENFASIS' ? x.grupos_enfasis : x.grupo); }, 0) : '';
    }
    var m = motivos[f[col.motivo]] || {};
    var fila = [new Date(), fecha, doc, tipo, 'N/A', f[col.motivo], String(f[col.mensaje] || '').slice(0, 300), 'Coordinador(a)', origen,
                pg.grado, pg.grupo, area, jornadaTxt, minutos, f[col.remitente], codSes, m.justificada === 'SI' ? 'Sí' : 'No', m.categoria || ''];
    nov.appendRow(fila); novVals.push(fila);
    if (/^Incumplimiento/i.test(tipo)) registrarIncumplimiento_({ fecha: fecha, docente: doc, tipo: tipo, sesiones: ses ? 'S' + ses : 'Jornada', grupo: pg.grado === 'N/A' ? '' : String(f[col.grupo] || ''), area: area,
      minutos: minutos, donde: '', descripcion: String(f[col.mensaje] || ''), explicacion: '', por: f[col.remitente] });
    sh.getRange(i + 1, col.importado + 1).setValue('SI');
    res.importadas++;
  }
  return res;
}

function importarBandejaWhatsApp() {
  exigirEditor_();
  var r = importarBandeja_();
  SpreadsheetApp.getUi().alert('Importadas a Novedades: ' + r.importadas + '\nYa estaban (duplicadas): ' + r.duplicadas +
    '\nConfirmadas pero sin docente (complete la columna docente): ' + r.sinDocente);
}

// ===================== Soportes.gs =====================
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
  var v;
  if (typeof VAL_REQ !== 'undefined' && VAL_REQ) {   // solicitud de solo lectura: se lee una sola vez
    if (!VAL_REQ.__par) { var sh0 = SpreadsheetApp.getActive().getSheetByName('Parametros'); VAL_REQ.__par = sh0 ? sh0.getDataRange().getValues() : []; }
    v = VAL_REQ.__par; if (!v.length) return defecto;
  } else {
    var sh = SpreadsheetApp.getActive().getSheetByName('Parametros');
    if (!sh) return defecto;
    v = sh.getDataRange().getValues();
  }
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
  var f; try { f = carpetaHija_(carpetaApp_(), 'Soportes de ausencias (privada)'); } catch (e) { f = DriveApp.createFolder('ICET Soportes 2026 (privada)'); }
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
  exigirDirectivo_();
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

// ===================== Patrones.gs =====================
/** GENERADO por scripts/generar_patrones.py desde data/patrones_novedades.json. No edite a mano. */
var PATRONES = {
 "tipos": [
  [
   "Llegada tarde informada",
   "llega(ra|rá)? tarde|llegar(a|á) tarde|llego tarde|se va a demorar|retraso|llegara mas tarde|llego (con )?retraso|llegando tarde|tarde a (su )?clase"
  ],
  [
   "Salida temprana informada",
   "(salir|sale|salio|se retira|retirara|se va|se fue)\\s+(mas\\s+)?(temprano|antes)|salida temprana|permiso para salir|se fue (antes|temprano)|se retiro|salio antes|dejo (el grupo|a los estudiantes)|abandono (el|la) (aula|salon|clase)"
  ],
  [
   "Incumplimiento: no atiende al grupo",
   "vista gorda|esta en el colegio pero no (atiende|dicta|dio clase|esta con)|no (atiende|dicta|esta atendiendo) (al|el|a los|a las) (grupo|curso|estudiantes|ninos|alumnos)|estando en el colegio no|no quiso dar clase|no dio clase estando"
  ],
  [
   "Incumplimiento: despidió a los estudiantes sin autorización",
   "(mando|envio|despacho|devolvio|despidio)\\s+(a\\s+)?(los\\s+)?(estudiantes|ninos|alumnos|muchachos|chicos)\\s+(para\\s+)?(a\\s+)?(la\\s+)?casa|(despidio|despacho) (a )?(los )?(estudiantes|ninos|alumnos)|sin autorizacion.{0,40}(estudiantes|ninos|alumnos).{0,25}casa"
  ],
  [
   "Ausente temporal",
   "permiso (por|de) (una|dos|tres|cuatro|media|\\d+)\\s*(hora|horas|minutos)|permiso por (horas|un rato)|(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?(reunion de (docentes|profesores|area)|comite|consejo|coordinacion|ptafi)|atendiendo (a )?(un|una|el|la|los|las)\\s+(padre|madre|acudiente|estudiante|alumno)|por (una|dos|tres|cuatro|\\d+)\\s*horas?\\b|por (media hora|un rato)|(una|dos|tres|\\d+) horas? para"
  ],
  [
   "No asistió",
   "no (asisti|vien[e]|vendr|va a (venir|asistir)|puede (venir|asistir)|pudo (venir|asistir)|se present|estara|podra|puede ir|fue)|falt(a|o|ara)|ausent|incapacitad|amaneci|no hay clase|no estaba|no estaban|estaba solo|estaban solos|no vino|no vinieron|no la vi|no lo vi|no se encontraba|no esta en (el|su) (aula|salon)|no ha llegado|no llego|no aparecio|no se presento|grupo solo|grupo sin (profesor|profesora|docente)|sin (profesor|profesora|docente)|estudiantes solos|solos en (el|la) (aula|salon|clase)|salon solo"
  ]
 ],
 "motivos": [
  [
   "Incapacidad Médica",
   "SALUD",
   "incapacid|licencia (medica|de maternidad|de paternidad)"
  ],
  [
   "Sepelio o duelo de un familiar",
   "CALAMIDAD DOMÉSTICA",
   "sepelio|velorio|entierro|exequias|funeral|duelo|(asistio|fue|va|van) a (un |el )?(sepelio|velorio|entierro)"
  ],
  [
   "Calamidad familiar",
   "CALAMIDAD DOMÉSTICA",
   "calamidad|falleci|murio|fallecimiento|velorio|sepelio|luto|defuncion|se murio"
  ],
  [
   "Traslado hijo(a) a colegio/médico",
   "CALAMIDAD DOMÉSTICA",
   "llev(ar|o|a|ara)\\s+a\\s+(su|la|el)\\s+(hij|ni)|trasladar a su hij|traslado a su hij"
  ],
  [
   "Salud de hijo(a) o familiar",
   "CALAMIDAD DOMÉSTICA",
   "(hij[oa]s?|esposo|esposa|mama|papa|madre|padre|familiar|nieto|nieta|abuel[oa]).{0,45}(enferm|hospital|urgencia|cirug|medico|clinica|fiebre|accidente|cita)"
  ],
  [
   "Reunión o acto escolar de hijo(a)",
   "CALAMIDAD DOMÉSTICA",
   "reunion de padres|entrega de boletin|entrega de notas de su hij|citacion del colegio|acto (escolar|civico|de grado|de graduacion).{0,30}(hij|su)|graduacion de su hij|hij[oa]s?.{0,30}(reunion|acto escolar|izada)"
  ],
  [
   "Tema académico de hijo(a)",
   "CALAMIDAD DOMÉSTICA",
   "reunion de padres|entrega de boletin|citacion del colegio|hij[oa]s?.{0,30}(colegio|escuela|reunion|matricula|examen|graduacion)"
  ],
  [
   "Exámenes clínicos",
   "SALUD",
   "examen(es)? (medic|clinic)|examenes de laboratorio|laboratorio|resonancia|ecograf|cita medica|cita con (el |la )?(medico|especialista|odontolog)|odontolog|control medico|toma de muestra|rayos x"
  ],
  [
   "Mal estado de salud",
   "SALUD",
   "enferm|malestar|gripa|gripe|fiebre|dolor|vomit|diarrea|mareo|mal de salud|mal estado de salud|problemas? de salud|quebranto|amaneci mal|se siente mal|migra[nñ]a|covid|dengue|alergia|infeccion|se sintio mal"
  ],
  [
   "Permiso del rector",
   "PERMISO INSTITUCIONAL",
   "permiso.{0,30}(rector|rectoria)|(rector|rectoria).{0,30}(autoriz|permiso|aprob)|autorizo el rector"
  ],
  [
   "Permiso por horas (personal)",
   "PERMISO INSTITUCIONAL",
   "permiso (por|de) (una|dos|tres|cuatro|media|\\d+)\\s*(hora|horas|minutos)|permiso por (horas|un rato)"
  ],
  [
   "Evento Secretaría de Educación",
   "EVENTO EXTERNO",
   "secretaria de educacion|\\bsed\\b|comision de servicio|mesa de trabajo|reunion en la secretaria"
  ],
  [
   "Comité o consejo (calidad, académico, convivencia)",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?(comite|consejo)\\b"
  ],
  [
   "Reunión PTAFI con la tutora",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?.{0,25}(ptafi|tutora)"
  ],
  [
   "Reunión de docentes o de área",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?reunion de (docentes|profesores|area)"
  ],
  [
   "Atención a padre de familia o acudiente",
   "ACTIVIDAD INSTITUCIONAL",
   "atendiendo (a )?(un|una|el|la|los|las)\\s+(padre|madre|acudiente)|atencion a (padres|acudiente)"
  ],
  [
   "Reunión de cierre de jornada",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?(reunion|jornada) de cierre|reunion de cierre"
  ],
  [
   "Atención en coordinación (estudiante o acudiente)",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?coordinacion|atendiendo (a )?(un|una)\\s+(estudiante|alumno)"
  ],
  [
   "Reunión o actividad institucional",
   "PERMISO INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en)\\s+(la\\s+|una\\s+)?(reunion|consejo|comite|comision)\\b.{0,25}(institucional|de area|de docentes|academic|directiv|evaluacion|promocion)|actividad institucional|acto civico institucional"
  ],
  [
   "Capacitación/Taller",
   "EVENTO EXTERNO",
   "capacitacion|taller|formacion|seminario|diplomado|\\bforo\\b|jornada pedagogica|encuentro"
  ],
  [
   "Tema académico del docente",
   "ACADÉMICO DEL DOCENTE",
   "universidad|doctorado|maestria|posgrado|sustentacion|clase presencial|tutoria de tesis|encuentro tutorial"
  ],
  [
   "Remisión otra ciudad",
   "TRASLADO",
   "remision|remitid|remiti|\\bcali\\b|\\bpasto\\b|bogota|medellin|viaje|otra ciudad|se traslado a|desplaz"
  ],
  [
   "Lluvia intensa o emergencia climática",
   "FORTUITO",
   "lluvia (intensa|fuerte)|aguacero|inundacion|temporal de lluvia|emergencia climatica|tormenta|derrumbe"
  ],
  [
   "Situación fortuita camino al trabajo",
   "FORTUITO",
   "camino al (trabajo|colegio)|se vario|se varo|llanta|pinch|accidente de transito|trancon|trafico|lancha|marea|derrumbe|lluvia|inundacion|aguacero"
  ]
 ]
};

// ===================== Notas.gs =====================
/**
 * Analizador de observaciones de la ronda (texto dictado, escrito o transcrito de un audio).
 * Función pura: no usa servicios de Google; se prueba en Node y la usan el servidor (Soportes/Notas) y la vista previa.
 *
 * Por cada oración busca: qué docente se menciona, qué pasó (no asistió, llegada tarde, salida temprana), el motivo si se dice,
 * el grupo (6°-1, "séptimo dos", "CS 1-2") y la sesión ("tercera hora", "bloque 2", "a las 9"). Si solo se nombra el grupo y la sesión,
 * deduce el docente por el horario. Las reglas de tipo y motivo vienen de Patrones.gs (las mismas del importador de WhatsApp).
 * Es una ayuda por reglas: propone, nunca registra por sí sola.
 */
var NT_STOP = { de: 1, del: 1, la: 1, las: 1, los: 1, el: 1, y: 1, e: 1 };

function ntNorm_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function ntPalabras_(s) { return ntNorm_(s).match(/[a-z]+/g) || []; }

/** Prepara las partes del nombre de cada docente y cuántos comparten cada apellido o nombre. */
function ntPreparaDocentes_(docentes) {
  var lista = [], cont = {};
  (docentes || []).forEach(function (d) {
    var ap = ntPalabras_(d.apellidos).filter(function (t) { return !NT_STOP[t]; }), no = ntPalabras_(d.nombres).filter(function (t) { return !NT_STOP[t]; });
    var x = { nombre: d.nombre_completo, ap1: ap[0] || '', ap2: ap[1] || '', n1: no[0] || '', n2: no[1] || '' };
    lista.push(x);
    [x.ap1, x.ap2].forEach(function (k, i) { if (k && !(i === 1 && k === x.ap1)) cont['ap:' + k] = (cont['ap:' + k] || 0) + 1; });
    if (x.n1) cont['n:' + x.n1] = (cont['n:' + x.n1] || 0) + 1;
  });
  return { lista: lista, cont: cont };
}

/** Docentes mencionados en el texto, con puntaje: 3 nombre y apellido, 2 apellido único, 1 nombre único o apellido repetido. */
function ntMenciones_(texto, prep) {
  var toks = {}; ntPalabras_(texto).forEach(function (t) { toks[t] = 1; });
  var out = [];
  prep.lista.forEach(function (d) {
    var ap1 = !!toks[d.ap1], ap2 = !!d.ap2 && !!toks[d.ap2], n1 = !!d.n1 && !!toks[d.n1], n2 = !!d.n2 && !!toks[d.n2];
    var score;
    if ((ap1 && (n1 || n2)) || (ap1 && ap2) || ((n1 || n2) && ap2)) score = 3;
    else if (ap1 && prep.cont['ap:' + d.ap1] === 1 && d.ap1.length >= 5) score = 2;
    else if (n1 && prep.cont['n:' + d.n1] === 1 && d.n1.length >= 4) score = 1;
    else return;
    out.push({ score: score, nombre: d.nombre });
  });
  if (!out.length) {   // apellido o nombre repetido: se ofrecen todos los candidatos (hasta 4) para que el directivo elija
    var amb = prep.lista.filter(function (d) { return [d.ap1, d.ap2, d.n1].some(function (k) { return k && k.length >= 4 && toks[k]; }); });
    return amb.length > 0 && amb.length <= 4 ? amb.map(function (d) { return { score: 1, nombre: d.nombre }; }) : [];
  }
  var mejor = Math.max.apply(null, out.map(function (o) { return o.score; }));
  return out.filter(function (o) { return o.score === mejor; });
}

function ntClasificar_(texto) {
  var t = ntNorm_(texto), tipo = '', motivo = '', cat = '', i;
  for (i = 0; i < PATRONES.tipos.length && !tipo; i++) if (new RegExp(PATRONES.tipos[i][1]).test(t)) tipo = PATRONES.tipos[i][0];
  for (i = 0; i < PATRONES.motivos.length && !motivo; i++) if (new RegExp(PATRONES.motivos[i][2]).test(t)) { motivo = PATRONES.motivos[i][0]; cat = PATRONES.motivos[i][1]; }
  return { tipo: tipo, motivo: motivo, categoria: cat };
}

var NT_GRADOS = { sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10, undecimo: 11, once: 11 };
var NT_NUM = { uno: 1, dos: 2, tres: 3, cuatro: 4 };
var NT_ORD = { primera: 1, segunda: 2, tercera: 3, cuarta: 4, quinta: 5, sexta: 6, septima: 7, octava: 8 };
function ntNum_(x) { return NT_NUM[x] || Number(x); }

/** Código de grupo mencionado ('0701', '1002', 'CS102') o ''. Si se da la lista de grupos válidos, solo devuelve uno que exista. */
function ntGrupo_(texto, validos) {
  var t = ntNorm_(texto), m, cod = '';
  if ((m = t.match(/\b(?:cs|caminar(?: en secundaria)?)\s*([12])\s*[-.\s]?\s*([12])\b/))) cod = 'CS' + m[1] + '0' + m[2];
  else if ((m = t.match(/\b(sexto|septimo|octavo|noveno|decimo|undecimo|once)\s*(?:grupo\s*)?(uno|dos|tres|cuatro|[1-4])\b/))) cod = ('0' + NT_GRADOS[m[1]]).slice(-2) + '0' + ntNum_(m[2]);
  else if ((m = t.match(/\b(0?[6-9]|1[01])\s*(?:°|º|-|\/)\s*0?([1-4])\b/))) cod = ('0' + Number(m[1])).slice(-2) + '0' + m[2];
  else if ((m = t.match(/\b(?:grupo|curso|grado)\s+(0?[6-9]|1[01])\s*[\s\-°º\/]\s*0?(uno|dos|tres|cuatro|[1-4])\b/))) cod = ('0' + Number(m[1])).slice(-2) + '0' + ntNum_(m[2]);
  if (cod && validos && validos.indexOf(cod) < 0) return '';
  return cod;
}

/** Sesión (1 a 8) mencionada: "tercera hora", "3ra sesión", "bloque 2" (= su primera sesión), "a las 9:10" (con las franjas). */
function ntSesion_(texto, franjas) {
  var t = ntNorm_(texto), m;
  if ((m = t.match(/\b(primera|segunda|tercera|cuarta|quinta|sexta|septima|octava)\s+(?:hora|sesion|clase)\b/))) return NT_ORD[m[1]];
  if ((m = t.match(/\b(?:hora|sesion)\s*([1-8])\b/))) return Number(m[1]);
  if ((m = t.match(/\b([1-8])\s*(?:a|ra|da|era|ta|º|°|ª)?\s*(?:hora|sesion)\b/))) return Number(m[1]);
  if ((m = t.match(/\bbloque\s*(uno|dos|tres|cuatro|[1-4])\b/))) return (ntNum_(m[1]) - 1) * 2 + 1;
  if ((m = t.match(/\ba\s+las\s+(\d{1,2})(?::(\d{2}))?\b/)) && franjas) {
    var h = Number(m[1]); if (h < 6) h += 12;
    var min = h * 60 + Number(m[2] || 0), r = '';
    franjas.forEach(function (f) { if (Number(f.inicio_min) <= min && min < Number(f.fin_min)) r = Number(f.hora); });
    return r;
  }
  return '';
}

var NT_DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

/**
 * ctx = { texto, fecha 'yyyy-MM-dd', docentes:[{nombre_completo, apellidos, nombres}], grupos:[{grupo}], franjas:[{hora, inicio_min, fin_min}],
 *         horario:[{docente, dia, hora, tipo, grupo, grupos_enfasis}], motivoPorDefecto }
 * Devuelve { propuestas:[{docente, tipo_novedad, motivo, categoria, justificada, confianza, mensaje, grupo, sesion, resuelto_por}], ignoradas }
 */
function analizarNota_(ctx) {
  var prep = ntPreparaDocentes_(ctx.docentes), validos = (ctx.grupos || []).map(function (g) { return g.grupo; });
  var dia = NT_DIAS[new Date(ctx.fecha + 'T12:00:00Z').getUTCDay()];
  var defecto = ctx.motivoPorDefecto || 'Sin justificación';
  var oraciones = String(ctx.texto || '').replace(/\n+/g, '. ').split(/[.!?;]+\s*/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 3; });
  var props = [], ignoradas = 0;
  oraciones.forEach(function (o) {
    var c = ntClasificar_(o);
    if (!c.tipo && !c.motivo) { ignoradas++; return; }
    var tipo = c.tipo || 'No asistió', motivo = c.motivo || defecto, cat = c.motivo ? c.categoria : (defecto === 'Sin justificación' ? 'SIN JUSTIFICACIÓN' : 'OTRO');
    var grupo = ntGrupo_(o, validos), sesion = ntSesion_(o, ctx.franjas);
    var just = motivo === 'Sin justificación' ? 'No' : 'Sí';
    var base = { tipo_novedad: tipo, motivo: motivo, categoria: cat, justificada: just, mensaje: o, grupo: grupo, sesion: sesion };
    var quienes = ntMenciones_(o, prep).map(function (m) { return { docente: m.nombre, score: m.score, por: 'mencion' }; });
    if (!quienes.length && grupo && sesion) {                      // solo se nombra el grupo: ¿quién debía estar?
      var filas = (ctx.horario || []).filter(function (h) {
        return h.dia === dia && Number(h.hora) === Number(sesion) && (h.grupo === grupo || String(h.grupos_enfasis || '').split('+').indexOf(grupo) >= 0);
      });
      quienes = filas.map(function (h) { return { docente: h.docente, score: filas.length === 1 ? 2 : 1, por: 'horario' }; });
    }
    if (!quienes.length) { props.push(Object.assign({}, base, { docente: '', confianza: 'sin docente', resuelto_por: '' })); return; }
    quienes.forEach(function (q) {
      var puntos = q.score + (c.tipo ? 1 : 0) + (c.motivo ? 1 : 0);
      var conf = (q.score === 3 && c.tipo && c.motivo) ? 'alta' : (puntos >= 4 ? 'media' : 'baja');
      if (quienes.length > 1) conf = 'baja';
      if (q.por === 'horario') conf = (quienes.length === 1 && c.tipo) ? 'media' : 'baja';   // deducido por horario: nunca "alta"
      props.push(Object.assign({}, base, { docente: q.docente, confianza: conf, resuelto_por: q.por }));
    });
  });
  return { propuestas: props, ignoradas: ignoradas };
}

// ===================== NotasRonda.gs =====================
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
  exigirDirectivo_();
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
function purgarAudios() {
  exigirEditor_(); var n = purgarAudios_(); SpreadsheetApp.getUi().alert('Audios borrados por retención: ' + n); }

// ===================== Reuniones.gs =====================
/**
 * Reuniones, actividades institucionales y jornadas sin clases (entrega de boletines, clausura, actividades institucionales generales, jornada pedagógica, desarrollo institucional, planeación, asamblea de docentes, consejo académico,
 * comité de convivencia, capacitación, etc.). La asistencia se registra UNA vez por reunión, no por sesión, y no genera minutos de
 * "tiempo sin atender" (no hay estudiantes). La ronda de aula usa estos registros para no marcar como ausente a quien está en la reunión.
 *
 * Hojas: Reuniones (una fila por reunión) y Asistencia_Reunion (una fila por persona y reunión; se reemplaza al volver a guardar).
 * Fechas y horas se guardan como TEXTO (con apóstrofo) para que Sheets no las convierta.
 */
var COL_REUNIONES = ['id', 'fecha', 'tipo', 'nombre', 'inicio', 'fin', 'sin_estudiantes', 'convocados', 'creado_por', 'fecha_creacion', 'avisar_dias', 'avisar_min', 'avisar_ronda', 'lugar', 'fin_tipo', 'convoca_tipo', 'convoca_detalle', 'solicita_por', 'responsables', 'convocados_grupos', 'invitados', 'invitado_nombre', 'observaciones', 'salida_est', 'min_antes_salida', 'llevar_comedor', 'informar_padres', 'excepcional', 'cerrada', 'cierre_hora'];
/** A quiénes se convoca. Personal (genera lista de asistencia) y organismos e invitados (solo se anuncian). */
var GRUPOS_PERSONAL = [
  ['TODOS', 'Todo el personal de la institución', 'Docentes, orientadoras, tutora PTAFI y directivos'],
  ['DIRECTIVOS', 'Directivos docentes', 'Rector y coordinadores'],
  ['ORIENTADORAS', 'Docentes orientadoras', ''],
  ['PTAFI', 'Tutora PTAFI', ''],
  ['PREESCOLAR', 'Docentes de preescolar', ''],
  ['PRIMARIA', 'Docentes de básica primaria', ''],
  ['BACHILLERATO', 'Docentes de bachillerato', 'Secundaria y media']
];
var NOMBRES_AREA = { ART: 'Artística', ETR: 'Ética y religión', CSI: 'Ciencias sociales e inglés', ERD: 'Educación física, recreación y deporte', TEI: 'Tecnología e informática', CAS: 'Lengua castellana', CNA: 'Ciencias naturales', MAT: 'Matemáticas' };
var ORGANISMOS_REUNION = [
  ['CONSEJO_DIRECTIVO', 'Consejo directivo'], ['CONSEJO_ACADEMICO', 'Consejo académico'], ['CONSEJO_ESTUDIANTIL', 'Consejo estudiantil'], ['CONSEJO_PADRES', 'Consejo de padres'],
  ['COMITE_CONVIVENCIA', 'Comité de convivencia'], ['COMITE_COMEDOR', 'Comité de comedor escolar'], ['PADRES', 'Padres de familia o acudientes'], ['EGRESADOS', 'Egresados'],
  ['ENTIDAD', 'Entidad o invitado externo (escriba el nombre)']
];
/** Nombres de las personas que pertenecen a cada grupo de personal ('AREA:CNA' = docentes que dictan esa área; 'PERSONAS' = los nombres elegidos a mano). */
function personasDeGrupos_(grupos, elegidos) {
  var out = [], visto = {};
  function add(n) { n = String(n || '').trim(); if (n && !visto[n]) { visto[n] = 1; out.push(n); } }
  var todas = personasReunion_(), validos = todas.map(function (x) { return x.nombre; });
  var docs = datos_('Docentes').filter(function (d) { return String(d.tiene_horario) === 'SI'; });
  var areasDe = null;
  function areas() { if (!areasDe) { areasDe = {}; datos_('Horario').forEach(function (h) { (areasDe[h.docente] = areasDe[h.docente] || {})[h.area] = 1; }); } return areasDe; }
  (grupos || []).forEach(function (g) {
    if (g === 'TODOS') todas.forEach(function (x) { add(x.nombre); });
    else if (g === 'DIRECTIVOS') datos_('Directivos').forEach(function (d) { add(d.nombre); });
    else if (g === 'ORIENTADORAS') docs.forEach(function (d) { if (/ORIENT/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'PTAFI') docs.forEach(function (d) { if (/PTAFI/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'PREESCOLAR') docs.forEach(function (d) { if (/PREESCOLAR/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'PRIMARIA') docs.forEach(function (d) { if (/PRIMARIA/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (g === 'BACHILLERATO') docs.forEach(function (d) { if (/SECUNDARIA|MEDIA|BACHILLERATO/i.test(String(d.nivel))) add(d.nombre_completo); });
    else if (/^AREA:/.test(g)) { var cod = g.slice(5); docs.forEach(function (d) { if ((areas()[d.nombre_completo] || {})[cod]) add(d.nombre_completo); }); }
    else if (g === 'PERSONAS') (elegidos || []).forEach(function (n) { if (validos.indexOf(n) >= 0) add(n); });
  });
  return out;
}
/** Catálogo para el formulario: grupos de personal con sus integrantes, áreas disponibles y organismos. */
function catalogoConvocados_() {
  var porGrupo = {}, hojas = {};
  GRUPOS_PERSONAL.forEach(function (g) { porGrupo[g[0]] = personasDeGrupos_([g[0]]); });
  var areas = {}; datos_('Horario').forEach(function (h) { if (NOMBRES_AREA[h.area]) areas[h.area] = 1; });
  var listaAreas = Object.keys(areas).sort(function (a, b) { return NOMBRES_AREA[a] < NOMBRES_AREA[b] ? -1 : 1; }).map(function (c) { porGrupo['AREA:' + c] = personasDeGrupos_(['AREA:' + c]); return { codigo: c, nombre: NOMBRES_AREA[c], n: porGrupo['AREA:' + c].length }; });
  return { personal: GRUPOS_PERSONAL.map(function (g) { return { codigo: g[0], nombre: g[1], detalle: g[2], n: porGrupo[g[0]].length }; }), areas: listaAreas, organismos: ORGANISMOS_REUNION.map(function (o) { return { codigo: o[0], nombre: o[1] }; }), integrantes: porGrupo };
}
/** Lee de p a quiénes se convoca (formato nuevo con grupos; o el anterior: 'TODOS' / lista de nombres). */
function convocadosDeP_(p) {
  var grupos, elegidos = p.convocados, nuevo = Array.isArray(p.grupos);
  if (nuevo) grupos = p.grupos.filter(function (g) { return g === 'TODOS' || g === 'PERSONAS' || /^AREA:/.test(g) || GRUPOS_PERSONAL.some(function (x) { return x[0] === g; }); });
  else grupos = p.convocados === 'TODOS' || p.convocados == null ? ['TODOS'] : ['PERSONAS'];
  var invitados = (p.invitados || []).filter(function (c) { return ORGANISMOS_REUNION.some(function (o) { return o[0] === c; }); });
  var entidad = invitados.indexOf('ENTIDAD') >= 0 ? String(p.entidad || '').trim().slice(0, 100) : '';
  if (invitados.indexOf('ENTIDAD') >= 0 && entidad.length < 3) throw new Error('Escriba el nombre de la entidad o del invitado externo.');
  var personas = personasDeGrupos_(grupos, Array.isArray(elegidos) ? elegidos : []);
  if (!personas.length && !invitados.length) throw new Error('Elija a quiénes se convoca (al menos un grupo o una persona).');
  var conv = grupos.indexOf('TODOS') >= 0 ? 'TODOS' : (personas.length ? personas.join('; ') : 'NINGUNO');
  var rotulos = [];
  GRUPOS_PERSONAL.forEach(function (g) { if (grupos.indexOf(g[0]) >= 0) rotulos.push(g[1]); });
  grupos.forEach(function (g) { if (/^AREA:/.test(g)) rotulos.push('Docentes de ' + (NOMBRES_AREA[g.slice(5)] || g.slice(5))); });
  if (grupos.indexOf('PERSONAS') >= 0) rotulos.push((Array.isArray(elegidos) ? elegidos.length : 0) + ' persona(s) elegida(s)');
  return { conv: conv, grupos: grupos.join(';'), invitados: invitados.join(';'), entidad: entidad, personas: personas };
}
/** Texto corto con a quiénes se convoca, para las tarjetas y avisos. */
function resumenConvocados_(x) {
  var t = [];
  var gr = x.grupos || [];
  if (!gr.length) t.push(x.convocados === 'TODOS' ? 'Todo el personal de la institución' : (x.convocados.length ? x.convocados.length + ' persona(s) elegida(s)' : ''));
  GRUPOS_PERSONAL.forEach(function (g) { if (gr.indexOf(g[0]) >= 0) t.push(g[1]); });
  gr.forEach(function (g) { if (/^AREA:/.test(g)) t.push('Docentes de ' + (NOMBRES_AREA[g.slice(5)] || g.slice(5))); });
  if (gr.indexOf('PERSONAS') >= 0) t.push((x.convocados === 'TODOS' ? 0 : x.convocados.length) + ' persona(s) elegida(s)');
  (x.invitados || []).forEach(function (c) { var o = ORGANISMOS_REUNION.filter(function (z) { return z[0] === c; })[0]; if (o) t.push(c === 'ENTIDAD' ? (x.invitadoNombre || o[1]) : o[1]); });
  return t.filter(String).join(' · ');
}

/** Quién convoca (lista del formulario). */
var CONVOCA_TIPOS = ['Rectoría', 'Coordinación académica', 'Coordinación de convivencia', 'Coordinación de redes de apoyo', 'Líder de área', 'Docente', 'Docente orientador(a)', 'Tutora PTAFI', 'Directivo docente', 'Secretaría de Educación', 'Otra entidad o persona'];
/** Lugares donde se hacen reuniones y actividades, por grupos. `pide`: el lugar necesita un dato (número de salón, cuál laboratorio…); `solo`: el dato reemplaza al nombre. */
/** «Apellido1 Apellido2 Nombre1 …» → «Nombre1 Apellido1». */
function nombreCortoDocente_(n) { var t = String(n || '').trim().split(/\s+/); return t.length >= 3 ? t[2] + ' ' + t[0] : String(n || ''); }
function lugaresReunion_() {
  var coord = datos_('Directivos').filter(function (d) { return !/rector/i.test(String(d.rol)); }).map(function (d) { return { v: 'Coordinación – ' + d.nombre }; });
  var orient = datos_('Docentes').filter(function (d) { return /ORIENT/i.test(String(d.nivel)); }).map(function (d) { return { v: 'Orientación escolar – ' + nombreCortoDocente_(d.nombre_completo) }; });
  return [
    { grupo: 'Espacios del colegio', items: [{ v: 'Sala de profesores' }, { v: 'Polideportivo (canchas)' }, { v: 'Patio principal' }, { v: 'Sala múltiple (auditorio)' }, { v: 'Biblioteca' }, { v: 'Comedor escolar' }, { v: 'Emisora escolar' }] },
    { grupo: 'Salas de tecnología e informática', items: [{ v: 'Sala de tecnología e informática 1' }, { v: 'Sala de tecnología e informática 2' }, { v: 'Sala de tecnología e informática 3' }, { v: 'Sala de tecnología e informática 4' }, { v: 'Aulas digitales (sala 5)' }] },
    { grupo: 'Laboratorios y entornos por área', items: [{ v: 'Laboratorio de química' }, { v: 'Otro laboratorio o entorno de área', pide: '¿Cuál y qué número? (ej.: Laboratorio de física 2)' }] },
    { grupo: 'Salones', items: [{ v: 'Salón', pide: 'Número o grupo del salón (ej.: 8-1)' }] },
    { grupo: 'Oficinas', items: [{ v: 'Rectoría' }].concat(coord, orient) },
    { grupo: 'Otro', items: [{ v: 'Virtual (enlace)' }, { v: 'Fuera del colegio', pide: '¿Dónde?' }, { v: 'Otro lugar', pide: 'Escriba cuál', solo: true }] }
  ];
}
var FIN_TIPOS = { FIJA: 'Hora fija', TENTATIVA: 'Hora tentativa', JORNADA: 'Hasta finalizar la jornada' };
/** Hora en que termina la jornada escolar (fin de la última sesión de la hoja Franjas). */
function finJornada_() {
  var fin = '';
  datos_('Franjas').forEach(function (f) { var h = hhmm_(f.fin); if (h > fin) fin = h; });
  return fin || '13:30';
}
/** La hoja Reuniones de libros anteriores no tiene las columnas de recordatorio: se agregan al final. */
function reunionesHoja_() {
  var sh = hojaOCrea_('Reuniones', COL_REUNIONES), cab = sh.getDataRange().getValues()[0];
  COL_REUNIONES.forEach(function (c) { if (cab.indexOf(c) < 0) { sh.getRange(1, cab.length + 1).setValue(c); cab.push(c); } });
  return sh;
}
function reunionesDatos_() { reunionesHoja_(); return datos_('Reuniones'); }
/** Recordatorios de una reunión: días antes (0 = ninguno), minutos antes el mismo día (0 = ninguno) y si sale al comenzar y al terminar la ronda. Vacío = 1 día, 60 min y sí. */
function recordatorioDe_(r) {
  function num(v, d) { var t = String(v == null ? '' : v).trim(); return t === '' ? d : (isNaN(Number(t)) ? d : Number(t)); }
  return { avisarDias: num(r.avisar_dias, 1), avisarMin: num(r.avisar_min, 60), avisarRonda: String(r.avisar_ronda || 'SI').toUpperCase() !== 'NO' };
}
function recordatorioDeP_(p) {
  var dias = Number(p.avisarDias), min = Number(p.avisarMin);
  return { dias: [0, 1, 2, 3, 7].indexOf(dias) >= 0 ? dias : 1, min: [0, 15, 30, 60, 120].indexOf(min) >= 0 ? min : 60, ronda: p.avisarRonda === false ? 'NO' : 'SI' };
}
var COL_ASIST_REUNION = ['id_reunion', 'fecha', 'persona', 'estado', 'motivo', 'observacion', 'registrado_por', 'fecha_registro'];
var ESTADOS_REUNION = ['Asistió', 'No asistió', 'Llegada tarde', 'Salida temprana'];
var ESTADOS_REUNION_PRESENTE = ['Asistió', 'Llegada tarde', 'Salida temprana'];
/** tipo -> valores sugeridos (la pantalla los propone y el directivo los puede cambiar). sinEstudiantes: no hay clases en ese horario. */
var TIPO_JORNADA = 'Jornada pedagógica o de desarrollo institucional';
/** Tipos que se unificaron: las reuniones ya guardadas con el nombre anterior se muestran y se editan con el nuevo. */
var TIPOS_ALIAS_REUNION = { 'Jornada pedagógica': TIPO_JORNADA, 'Reunión de desarrollo institucional': TIPO_JORNADA };
function tipoReunion_(t) { return TIPOS_ALIAS_REUNION[t] || t; }
var TIPOS_REUNION = [
  { tipo: TIPO_JORNADA, sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Taller pedagógico', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Capacitación en el colegio', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Charla o conferencia', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Reunión de planeación', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión pedagógica', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión de área o de grado', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Asamblea de docentes', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión extraordinaria del rector', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión informativa o actividad institucional', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Consejo académico', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de convivencia', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de calidad', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Reunión PTAFI con la tutora', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Reunión con padres de familia o acudientes', sinEstudiantes: false, inicio: '07:00', fin: '09:00' },
  { tipo: 'Escuela de padres', sinEstudiantes: false, inicio: '07:00', fin: '09:00' },
  { tipo: 'Ceremonia de grado o proclamación', sinEstudiantes: false, inicio: '14:00', fin: '17:00' },
  { tipo: 'Entrega de boletines', sinEstudiantes: false, inicio: '07:00', fin: '13:30' },
  { tipo: 'Acto cívico o cultural', sinEstudiantes: false, inicio: '07:00', fin: '08:00' },
  { tipo: 'Simulacro de evacuación', sinEstudiantes: false, inicio: '09:00', fin: '09:30' },
  { tipo: 'Aseo general', sinEstudiantes: true, inicio: '07:00', fin: '09:00' },
  { tipo: 'Examen general periódico', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Clausura', sinEstudiantes: true, inicio: '08:00', fin: '12:00' },
  { tipo: 'Actividad institucional general', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Otra reunión o actividad (escriba el nombre)', sinEstudiantes: false, inicio: '08:00', fin: '09:00' }
];

/** Tipos de actividad que se hacen normalmente en sábado (entrega de boletines, jornada pedagógica de compensatorios, escuela de padres, ceremonias de grado, clausura): no necesitan la marca «excepcional» para ese día. */
var TIPOS_SABADO = [TIPO_JORNADA, 'Entrega de boletines', 'Escuela de padres', 'Ceremonia de grado o proclamación', 'Clausura', 'Reunión con padres de familia o acudientes'];

/** Resta minutos a una hora HH:MM. */
function restaMin_(hhmm, n) {
  var m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/); if (!m) return '';
  var t = Number(m[1]) * 60 + Number(m[2]) - n; if (t < 0) t = 0;
  return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
}
function limpiaTxt_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function txtForzado_(v) { return "'" + v; }

/** Personas que se pueden convocar: docentes con horario, orientadoras y directivos (sin repetir). */
function personasReunion_() {
  var out = [], vistos = {};
  function agrega(n, rol) { n = String(n || '').trim(); if (n && !vistos[n]) { vistos[n] = 1; out.push({ nombre: n, rol: rol }); } }
  datos_('Docentes').forEach(function (d) { if (String(d.tiene_horario) === 'SI') agrega(d.nombre_completo, /PTAFI/i.test(String(d.nivel)) ? 'Tutora PTAFI' : 'Docente'); });
  datos_('Directivos').forEach(function (d) { agrega(d.nombre, 'Directivo'); });
  String(parametro_('reunion_personas_extra', '')).split(/[;,]/).forEach(function (n) { agrega(n, 'Docente'); });   // opción para quien desarrolla: personas que siempre deben aparecer (p. ej. docentes sin horario)
  return out;
}

function reunionDeFila_(r) {
  var conv = String(r.convocados || 'TODOS');
  var x = { id: r.id, fecha: fechaIso_(limpiaTxt_(r.fecha)), tipo: tipoReunion_(r.tipo), nombre: r.nombre, inicio: limpiaTxt_(r.inicio), fin: limpiaTxt_(r.fin),
           sinEstudiantes: String(r.sin_estudiantes) === 'SI', convocados: conv === 'TODOS' ? 'TODOS' : (conv === 'NINGUNO' ? [] : conv.split(';').map(function (x) { return x.trim(); }).filter(String)),
           creadoPor: r.creado_por, avisarDias: recordatorioDe_(r).avisarDias, avisarMin: recordatorioDe_(r).avisarMin, avisarRonda: recordatorioDe_(r).avisarRonda,
           lugar: String(r.lugar || ''), finTipo: FIN_TIPOS[r.fin_tipo] ? r.fin_tipo : 'FIJA', convocaTipo: String(r.convoca_tipo || ''), convocaDetalle: String(r.convoca_detalle || ''), solicitaPor: String(r.solicita_por || ''),
           responsables: String(r.responsables || '').split(';').map(function (x) { return x.trim(); }).filter(String),
           grupos: String(r.convocados_grupos || '').split(';').filter(String), invitados: String(r.invitados || '').split(';').filter(String), invitadoNombre: String(r.invitado_nombre || ''), observaciones: String(r.observaciones || '') };
  // salida anticipada de estudiantes: se despachan a salidaEst; las clases terminan minAntesSalida antes (aseo y comedor)
  x.salidaEst = hora_(String(r.salida_est || '').replace(/^'/, ''));
  x.minAntesSalida = [10, 15, 20, 30].indexOf(Number(r.min_antes_salida)) >= 0 ? Number(r.min_antes_salida) : 15;
  x.llevarComedor = String(r.llevar_comedor || '').toUpperCase() === 'SI';
  x.informarPadres = String(r.informar_padres || '').toUpperCase() === 'SI';
  x.excepcional = String(r.excepcional || '').toUpperCase() === 'SI';
  /* reunión o actividad dada por terminada (cerrada) antes de su hora de fin: deja de avisar y de ocupar el horario desde la hora de cierre */
  x.cerrada = String(r.cerrada || '').toUpperCase() === 'SI';
  x.cierreHora = hora_(String(r.cierre_hora || '').replace(/^'/, ''));
  if (x.cerrada && x.cierreHora) { x.finOriginal = x.fin; var cf = x.cierreHora < x.inicio ? x.inicio : (x.cierreHora < x.fin ? x.cierreHora : x.fin); x.fin = cf; }
  x.finClases = x.salidaEst ? restaMin_(x.salidaEst, x.minAntesSalida) : '';
  x.inicioClases = x.finClases && x.finClases < x.inicio ? x.finClases : x.inicio;
  x.convocadosResumen = resumenConvocados_(x);
  return x;
}
function reunionesDe_(fecha) {
  return reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha === fecha; });
}
function asistenciaDe_(id) {
  var m = {};
  datosOCrea_('Asistencia_Reunion', COL_ASIST_REUNION).forEach(function (a) {
    if (a.id_reunion === id) m[a.persona] = { estado: a.estado, motivo: a.motivo, observacion: a.observacion };
  });
  return m;
}
function convocadosDe_(reunion) {
  var todos = personasReunion_().map(function (p) { return p.nombre; });
  return reunion.convocados === 'TODOS' ? todos : reunion.convocados;
}

/** Resumen de asistencia a reuniones y actividades de un periodo, para el informe por correo. Devuelve '' si no hubo. */
function htmlReunionesInforme_(desde, hasta) {
  var rs = reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha >= desde && r.fecha <= hasta; });
  if (!rs.length) return '';
  var e = resEsc_;
  return '<div style="margin-top:12px;border-left:4px solid #1b5e20;padding:6px 10px;background:#e8f5e9"><div style="font-weight:600;color:#1b5e20">Reuniones y actividades institucionales (' + rs.length + ')</div>' +
    rs.map(function (r) {
      var a = asistenciaDe_(r.id), conv = convocadosDe_(r), no = [], pres = 0, sin = 0;
      conv.forEach(function (n) { var x = a[n]; if (!x) sin++; else if (x.estado === 'No asistió') no.push(n + ' (' + (x.motivo || 'Sin justificación') + ')'); else pres++; });
      return '<div style="font-size:13px;margin-top:6px"><b>' + e(r.nombre) + '</b> · ' + e(r.fecha) + ' · ' + e(r.inicio) + '-' + e(r.fin) + '<br>Asistieron ' + pres + ' de ' + conv.length +
        (sin ? ' · <span style="color:#a31515">sin registrar: ' + sin + '</span>' : '') + (no.length ? '<br>No asistieron: ' + e(no.join('; ')) : '') + '</div>';
    }).join('') + '</div>';
}

/** {id_reunion: {persona: true}} con una sola lectura de la hoja de asistencia. */
function asistenciaPorReunion_() {
  var m = {};
  datosOCrea_('Asistencia_Reunion', COL_ASIST_REUNION).forEach(function (a) { (m[a.id_reunion] = m[a.id_reunion] || {})[a.persona] = true; });
  return m;
}
/** Página de reuniones anteriores o próximas para «Últimas reuniones» / «Próximas reuniones» (desplazamiento infinito). p = {tipo:'ultimas'|'proximas', offset, limite} */
function historialReuniones(p) {
  exigirDirectivo_(); p = p || {};
  var off = Math.max(0, Number(p.offset) || 0), lim = Math.min(40, Math.max(5, Number(p.limite) || 20)), hoy = ymd_(new Date()), asist = asistenciaPorReunion_();
  var todas = reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha; }), ult = p.tipo !== 'proximas';
  var l = todas.filter(function (r) { return ult ? r.fecha < hoy : r.fecha >= hoy; }).sort(function (a, b) {
    var d = a.fecha === b.fecha ? (a.inicio < b.inicio ? -1 : 1) : (a.fecha < b.fecha ? -1 : 1); return ult ? -d : d; });
  var items = l.slice(off, off + lim).map(function (r) {
    var a = asist[r.id] || {}, conv = convocadosDe_(r), reg = 0; conv.forEach(function (n) { if (a[n]) reg++; });
    return Object.assign({}, r, { convocadosN: conv.length, registrados: reg });
  });
  return { items: items, hayMas: l.length > off + lim, total: l.length };
}
/** Reuniones de una fecha (por defecto hoy), con los tipos y las personas convocables. p = {fecha?} */
function listarReuniones(p) {
  exigirDirectivo_();
  p = p || {};
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  var reuniones = reunionesDe_(fecha).map(function (r) {
    var a = asistenciaDe_(r.id), conv = convocadosDe_(r), reg = 0;
    conv.forEach(function (n) { if (a[n]) reg++; });
    return Object.assign({}, r, { convocadosN: conv.length, registrados: reg });
  });
  // próximas (hoy en adelante, la más cercana primero) y últimas (días anteriores, la más reciente primero)
  var hoy = ymd_(new Date()), todas = reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha; });
  var asist = asistenciaPorReunion_();   // una sola lectura de Asistencia_Reunion (antes una por reunión)
  function resumida(r) { var a = asist[r.id] || {}, conv = convocadosDe_(r), reg = 0; conv.forEach(function (n) { if (a[n]) reg++; }); return Object.assign({}, r, { convocadosN: conv.length, registrados: reg }); }
  var proximas = todas.filter(function (r) { return r.fecha >= hoy; }).sort(function (a, b) { return a.fecha === b.fecha ? (a.inicio < b.inicio ? -1 : 1) : (a.fecha < b.fecha ? -1 : 1); }).slice(0, 12).map(resumida);
  var ultimas = todas.filter(function (r) { return r.fecha < hoy; }).sort(function (a, b) { return a.fecha === b.fecha ? (a.inicio < b.inicio ? 1 : -1) : (a.fecha < b.fecha ? 1 : -1); }).slice(0, 10).map(resumida);
  return { sesionDe: (function () { try { var i = identidad_(); return i.rol === 'directivo' ? (i.nombre || '') : ''; } catch (e) { return ''; } })(), puedeAnular: puedeAdministrar_(identidad_()), duplicadas: duplicadasDe_().length, catalogo: catalogoConvocados_(), convocaTipos: CONVOCA_TIPOS, lugares: lugaresReunion_(), finTipos: FIN_TIPOS, jornadaFin: finJornada_(), fecha: fecha, hoy: hoy, proximas: proximas, ultimas: ultimas, reuniones: reuniones, tipos: TIPOS_REUNION, sabadoTipos: TIPOS_SABADO, personas: personasReunion_(), motivos: datos_('Motivos').map(function (m) { return m.motivo; }) };
}

function hora_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)) ? String(s) : ''; }
function nombreRegistrador_(p) {
  var quien = identidad_();
  if (quien.rol !== 'directivo') throw new Error('Solo un directivo puede registrar reuniones.');
  return quien.nombre || quien.email || String(p.directivo || '');
}

/** Valida y normaliza hora de inicio/fin y datos de organización (lugar, quién convoca, quién solicita, responsables). */
function datosReunionDeP_(p) {
  var ini = hora_(p.inicio), finTipo = FIN_TIPOS[p.finTipo] ? p.finTipo : 'FIJA', fin = finTipo === 'JORNADA' ? finJornada_() : hora_(p.fin);
  if (!ini || !fin || fin <= ini) throw new Error(finTipo === 'JORNADA' ? 'La hora de inicio debe ser antes de que termine la jornada (' + finJornada_() + ').' : 'Revise la hora de inicio y de fin.');
  var salida = hora_(p.salidaEst || ''), minAntes = [10, 15, 20, 30].indexOf(Number(p.minAntesSalida)) >= 0 ? Number(p.minAntesSalida) : 15;
  if (p.salidaEst && !salida) throw new Error('Revise la hora de salida de los estudiantes.');
  if (salida && restaMin_(salida, minAntes) < '06:00') throw new Error('Revise la hora de salida de los estudiantes: las clases terminarían antes de las 6:00.');
  var convoca = CONVOCA_TIPOS.indexOf(p.convocaTipo) >= 0 ? p.convocaTipo : '';
  var validos = personasReunion_().map(function (x) { return x.nombre; });
  var resp = (p.responsables || []).filter(function (n) { return validos.indexOf(n) >= 0; });
  return { ini: ini, fin: fin, finTipo: finTipo, lugar: String(p.lugar || '').trim().slice(0, 80), convocaTipo: convoca, convocaDetalle: String(p.convocaDetalle || '').trim().slice(0, 100),
           solicitaPor: String(p.solicitaPor || '').trim().slice(0, 80), responsables: resp.join('; '), observaciones: String(p.observaciones || '').trim().slice(0, 400), salida: salida, minAntes: minAntes, comedor: salida && p.llevarComedor ? 'SI' : 'NO', padres: (p.informarPadres || salida) ? 'SI' : 'NO' };
}
/** Crea una reunión. p = {fecha?, tipo, nombre?, inicio, fin, sinEstudiantes, convocados: 'TODOS' | [nombres]} */
function crearReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === tipoReunion_(p.tipo); })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  if (/^Otra/.test(def.tipo) && String(p.nombre || '').trim().length < 3) throw new Error('Escriba el nombre de la reunión o actividad.');
  var d = datosReunionDeP_(p);
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  ventanaReunion_(fecha, d.ini, d.fin, !!p.excepcional, def.tipo);
  var cv = convocadosDeP_(p), conv = cv.conv;
  var nombre = String(p.nombre || '').slice(0, 120) || def.tipo;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    // si se tocó «crear» varias veces seguidas (el libro tarda en responder), no se repite: se devuelve la que ya se creó hace instantes
    var hace = Utilities.formatDate(new Date(Date.now() - 5 * 60000), TZ, 'yyyy-MM-dd HH:mm');
    var ya = reunionesDatos_().filter(function (r) {
      var x = reunionDeFila_(r);
      return x.fecha === fecha && x.tipo === def.tipo && x.nombre === nombre && x.inicio === d.ini && x.fin === d.fin && String(r.creado_por) === String(por) &&
             String(r.convocados || 'TODOS') === conv && String(r.fecha_creacion) >= hace;
    })[0];
    if (ya) return { id: ya.id, repetida: true };
    var id = Utilities.getUuid();
    reunionesHoja_().appendRow([id, txtForzado_(fecha), def.tipo, nombre, txtForzado_(d.ini), txtForzado_(d.fin),
      (p.sinEstudiantes || d.salida) ? 'SI' : 'NO', conv, por, ahoraTxt_(), recordatorioDeP_(p).dias, recordatorioDeP_(p).min, recordatorioDeP_(p).ronda,
      d.lugar, d.finTipo, d.convocaTipo, d.convocaDetalle, d.solicitaPor, d.responsables, cv.grupos, cv.invitados, cv.entidad, d.observaciones, txtForzado_(d.salida), d.minAntes, d.comedor, d.padres, p.excepcional ? 'SI' : '']);
    var aus = ausentesConvocados_(id);
    return { id: id, ausentes: aus };
  } finally { lock.releaseLock(); }
}

/** Administra el sistema: dueño o editor del libro, quien tenga SI en la columna administra (hoja Directivos) o la coordinación académica (si no dice NO). */
function puedeAdministrar_(quien) {
  try {
    if (quien && quien.email && editoresLibro_().indexOf(String(quien.email).toLowerCase()) >= 0) return true;
    var d = datos_('Directivos').filter(function (x) { return x.nombre === (quien && quien.nombre); })[0];
    if (!d) return false;
    var col = String(d.administra || '').trim().toUpperCase();
    if (col === 'SI') return true;
    if (col === 'NO') return false;
    return /coordinador(a)?\s+acad[eé]mic/i.test(String(d.rol || ''));
  } catch (e) { return false; }
}
var COL_REUNIONES_ANULADAS = COL_REUNIONES.concat(['anulada_por', 'fecha_anulacion', 'motivo_anulacion']);

/** Anula una reunión (solo quien administra): sale de Reuniones y queda guardada en Reuniones_Anuladas con quién, cuándo y por qué. La asistencia registrada se conserva. p = {id, motivo} */
function anularReunion(p) {
  p = p || {};
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  if (!puedeAdministrar_(quien)) throw new Error('Solo quien administra el sistema puede anular una reunión.');
  var motivo = String(p.motivo || '').trim();
  if (motivo.length < 5) throw new Error('Escriba el motivo de la anulación (mínimo 5 letras).');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = reunionesHoja_(), v = sh.getDataRange().getValues(), cab = v[0], ci = cab.indexOf('id'), fila = -1;
    for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === String(p.id)) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la reunión.');
    var guardada = COL_REUNIONES.map(function (k) { var j = cab.indexOf(k); return j < 0 ? '' : v[fila][j]; }).concat([por, ahoraTxt_(), motivo.slice(0, 200)]);
    hojaOCrea_('Reuniones_Anuladas', COL_REUNIONES_ANULADAS).appendRow(guardada);
    sh.deleteRow(fila + 1);
    bitacora_('Anuló reunión', String(guardada[3]) + ' (' + limpiaTxt_(guardada[1]) + ') · ' + motivo.slice(0, 120));
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/**
 * Aviso del día (se muestra unos segundos sobre cualquier pantalla): reuniones de hoy (en curso, próximas y las ya terminadas sin asistencia registrada)
 * y actividades con estudiantes fuera del colegio registradas para hoy.
 */
function avisosHoy() {
  exigirDirectivo_();
  var ahora = new Date(), hoy = ymd_(ahora), hh = Utilities.formatDate(ahora, TZ, 'HH:mm');
  function aMinutos(t) { var m = String(t).match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; }
  var ahoraMin = aMinutos(hh);
  function resumida(r) { var a = asistenciaDe_(r.id), conv = convocadosDe_(r), reg = 0; conv.forEach(function (n) { if (a[n]) reg++; }); return { conv: conv.length, reg: reg }; }
  var todas = reunionesDatos_().map(reunionDeFila_).filter(function (r) { return r.fecha; });
  var reuniones = todas.filter(function (r) { return r.fecha === hoy && !r.cerrada; }).sort(function (a, b) { return a.inicio < b.inicio ? -1 : (a.inicio > b.inicio ? 1 : 0); }).map(function (r) {
    var x = resumida(r), estado = hh < r.inicio ? 'proxima' : (hh <= r.fin ? 'ahora' : 'pasada'), faltan = aMinutos(r.inicio) - ahoraMin;
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, convocadosN: x.conv, registrados: x.reg, estado: estado,
             lugar: r.lugar, observaciones: r.observaciones, salidaEst: r.salidaEst, finClases: r.finClases, llevarComedor: r.llevarComedor, informarPadres: r.informarPadres, finTipo: r.finTipo, convocadosResumen: r.convocadosResumen, minutosHasta: faltan, avisarRonda: r.avisarRonda, avisarMin: r.avisarMin,
             urgente: estado === 'ahora' || (estado === 'proxima' && r.avisarMin > 0 && faltan <= r.avisarMin) };   // parpadea y vuelve a avisar durante la jornada
  });
  var previas = todas.filter(function (r) {
    var d = Math.round((new Date(r.fecha + 'T12:00:00Z') - new Date(hoy + 'T12:00:00Z')) / 86400000);
    r.dias = d;
    var viernes = Utilities.formatDate(ahora, TZ, 'u') === '5';   // el viernes también se recuerda lo del lunes (para empezar la semana)
    return d > 0 && r.avisarDias > 0 && (d <= r.avisarDias || (viernes && d === 3));
  }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : (a.inicio < b.inicio ? -1 : 1)); }).map(function (r) {
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, fecha: r.fecha, dias: r.dias, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, lugar: r.lugar, observaciones: r.observaciones, salidaEst: r.salidaEst, finClases: r.finClases, llevarComedor: r.llevarComedor, informarPadres: r.informarPadres };
  });
  var por = {}, orden = [];
  datos_('Novedades').forEach(function (n) {
    if (n['Tipo Novedad'] !== TIPO_EXTERNA || fechaIso_(n['Fecha Novedad']) !== hoy) return;
    var k = n['Motivo Ausencia'] || 'Actividad con estudiantes';
    if (!por[k]) { por[k] = { motivo: k, docentes: [] }; orden.push(k); }
    if (por[k].docentes.indexOf(n['Docente']) < 0) por[k].docentes.push(n['Docente']);
  });
  return { hoy: hoy, hora: hh, reuniones: reuniones, previas: previas, actividades: orden.map(function (k) { return por[k]; }), ausentes: ausentesDelDia_(hoy) };
}

/** Grupos de reuniones repetidas (mismo día, tipo, nombre, horas y convocados): devuelve las SOBRANTES (se conserva la que tiene asistencia o, si no, la primera). */
function duplicadasDe_() {
  var grupos = {}, orden = [], sobrantes = [];
  var asist = {}; datosOCrea_('Asistencia_Reunion', COL_ASIST_REUNION).forEach(function (a) { asist[a.id_reunion] = (asist[a.id_reunion] || 0) + 1; });
  reunionesDatos_().forEach(function (r) {
    var x = reunionDeFila_(r), k = [x.fecha, x.tipo, x.nombre, x.inicio, x.fin, String(r.convocados || 'TODOS')].join('|');
    if (!grupos[k]) { grupos[k] = []; orden.push(k); }
    grupos[k].push({ id: r.id, asistencia: asist[r.id] || 0 });
  });
  orden.forEach(function (k) {
    var g = grupos[k]; if (g.length < 2) return;
    var mejor = g.reduce(function (a, b) { return b.asistencia > a.asistencia ? b : a; }, g[0]);
    g.forEach(function (x) { if (x.id !== mejor.id) sobrantes.push(x.id); });
  });
  return sobrantes;
}
/** Quita (anula, sin pedir motivo) las reuniones repetidas por haber tocado «crear» varias veces. Solo quien administra. */
function quitarReunionesDuplicadas() {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  if (!puedeAdministrar_(quien)) throw new Error('Solo quien administra el sistema puede quitar reuniones.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var n2 = 0;
  try { n2 = quitarReunionesDuplicadasInterno_(por); } finally { lock.releaseLock(); }
  if (n2) bitacora_('Quitó reuniones duplicadas', n2 + ' reunión(es) repetida(s)');
  return { ok: true, quitadas: n2 };
}
/** Desde el menú del libro: quitar reuniones duplicadas. */
function quitarReunionesDuplicadasLibro() {
  exigirEditor_();
  if (!duplicadasDe_().length) { SpreadsheetApp.getUi().alert('No hay reuniones repetidas.'); return; }
  var n = quitarReunionesDuplicadasInterno_(emailActual_());
  SpreadsheetApp.getUi().alert('Se quitaron ' + n + ' reuniones repetidas (quedaron en Reuniones_Anuladas).');
}
function quitarReunionesDuplicadasInterno_(por) {
  var n = 0, sob = duplicadasDe_(), sh = reunionesHoja_();
  sob.forEach(function (id) {
    var v = sh.getDataRange().getValues(), cab = v[0], ci = cab.indexOf('id'), fila = -1;
    for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === String(id)) { fila = i; break; }
    if (fila < 0) return;
    var guardada = COL_REUNIONES.map(function (k) { var j = cab.indexOf(k); return j < 0 ? '' : v[fila][j]; }).concat([por, ahoraTxt_(), 'Duplicada (registro repetido)']);
    hojaOCrea_('Reuniones_Anuladas', COL_REUNIONES_ANULADAS).appendRow(guardada); sh.deleteRow(fila + 1); n++;
  });
  return n;
}

/** Edita una reunión ya creada (tipo, nombre, fecha, horas, clases suspendidas, convocados). La asistencia ya registrada no se borra. p = {id, ...igual que crearReunion} */
function editarReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === tipoReunion_(p.tipo); })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  if (/^Otra/.test(def.tipo) && String(p.nombre || '').trim().length < 3) throw new Error('Escriba el nombre de la reunión o actividad.');
  var d = datosReunionDeP_(p), ini = d.ini, fin = d.fin;
  if (p.fecha) ventanaReunion_(fechaIso_(p.fecha), ini, fin, !!p.excepcional, def.tipo);
  if (!esFechaIso_(p.fecha)) throw new Error('Revise la fecha.');
  var cv = convocadosDeP_(p), conv = cv.conv;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = reunionesHoja_(), v = sh.getDataRange().getValues(), cab = v[0], fila = -1, c = {};
    cab.forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === String(p.id)) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la reunión.');
    var antes = reunionDeFila_((function () { var o = {}; cab.forEach(function (k, i) { o[k] = v[fila][i]; }); return o; })());
    if (antes.fecha < ymd_(new Date()) && !puedeAdministrar_(identidad_())) throw new Error('Las reuniones que ya pasaron solo las corrige quien administra.');
    var nueva = v[fila].slice();
    nueva[c.fecha] = txtForzado_(p.fecha); nueva[c.tipo] = def.tipo; nueva[c.nombre] = String(p.nombre || '').slice(0, 120) || def.tipo;
    nueva[c.inicio] = txtForzado_(ini); nueva[c.fin] = txtForzado_(fin); nueva[c.sin_estudiantes] = (p.sinEstudiantes || d.salida) ? 'SI' : 'NO'; nueva[c.convocados] = conv; var rd = recordatorioDeP_(p); nueva[c.avisar_dias] = rd.dias; nueva[c.avisar_min] = rd.min; nueva[c.avisar_ronda] = rd.ronda;
    if (c.excepcional != null) nueva[c.excepcional] = p.excepcional ? 'SI' : '';
    nueva[c.lugar] = d.lugar; nueva[c.fin_tipo] = d.finTipo; nueva[c.convoca_tipo] = d.convocaTipo; nueva[c.convoca_detalle] = d.convocaDetalle; nueva[c.solicita_por] = d.solicitaPor; nueva[c.responsables] = d.responsables; nueva[c.convocados_grupos] = cv.grupos; nueva[c.invitados] = cv.invitados; nueva[c.invitado_nombre] = cv.entidad; nueva[c.observaciones] = d.observaciones; nueva[c.salida_est] = txtForzado_(d.salida); nueva[c.min_antes_salida] = d.minAntes; nueva[c.llevar_comedor] = d.comedor; nueva[c.informar_padres] = d.padres;
    sh.getRange(fila + 1, 1, 1, nueva.length).setValues([nueva]);
    bitacora_('Editó reunión', antes.nombre + ' (' + antes.fecha + ' ' + antes.inicio + '-' + antes.fin + ') → ' + nueva[c.nombre] + ' (' + p.fecha + ' ' + ini + '-' + fin + ')' + (antes.sinEstudiantes !== !!p.sinEstudiantes ? ' · clases ' + (p.sinEstudiantes ? 'suspendidas' : 'no suspendidas') : '') + ' · por ' + por);
  } finally { lock.releaseLock(); }
  return { ok: true, id: p.id, ausentes: ausentesConvocados_(p.id) };
}

/**
 * Da por terminada (cierra) una reunión o actividad de hoy o anterior, aunque no haya llegado su hora de fin: deja de salir en el aviso del día y deja
 * libre el horario para la ronda desde ese momento. También se puede reabrir. p = {id, cerrar: true|false}
 */
function cerrarReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p), cerrar = p.cerrar !== false;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = reunionesHoja_(), v = sh.getDataRange().getValues(), cab = v[0], c = {}, fila = -1;
    cab.forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === String(p.id)) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la reunión.');
    var r = reunionDeFila_((function () { var o = {}; cab.forEach(function (k, j) { o[k] = v[fila][j]; }); return o; })()), hoy = ymd_(new Date());
    if (cerrar && r.fecha > hoy) throw new Error('Solo se puede dar por terminada una reunión de hoy o de un día anterior.');
    var ahora = Utilities.formatDate(new Date(), TZ, 'HH:mm'), cierre = r.fecha < hoy ? (r.finOriginal || r.fin) : ahora;
    sh.getRange(fila + 1, c.cerrada + 1).setValue(cerrar ? 'SI' : '');
    sh.getRange(fila + 1, c.cierre_hora + 1).setValue(cerrar ? txtForzado_(cierre) : '');
    bitacora_(cerrar ? 'Cerró reunión' : 'Reabrió reunión', r.nombre + ' (' + r.fecha + ' ' + r.inicio + '-' + (r.finOriginal || r.fin) + ')' + (cerrar ? ' a las ' + cierre : ''));
    return { ok: true, cerrada: cerrar, cierre: cerrar ? cierre : '' };
  } finally { lock.releaseLock(); }
}

/** Datos para registrar la asistencia de una reunión: convocados y lo ya registrado. */
function cargarReunion(p) {
  exigirDirectivo_();
  var r = reunionesDatos_().map(reunionDeFila_).filter(function (x) { return x.id === (p && p.id); })[0];
  if (!r) throw new Error('No se encontró la reunión.');
  var a = asistenciaDe_(r.id), roles = {}, ausentes = {};   // ausentes: ya reportados en Novedades para el día de la reunión (toda la jornada)
  try { ausentesDelDia_(r.fecha).forEach(function (x) { if (x.jornada) ausentes[x.docente] = x; }); } catch (e) { /* sin novedades */ }
  personasReunion_().forEach(function (x) { roles[x.nombre] = x.rol; });
  var yaEstan = {}; convocadosDe_(r).forEach(function (n) { yaEstan[n] = 1; });
  var admin = false; try { admin = puedeAdministrar_(identidad_()); } catch (e) { /* sin identidad */ }
  var otras = admin ? datos_('Docentes').map(function (d) { return String(d.nombre_completo || '').trim(); }).filter(function (n) { return n && !yaEstan[n]; }) : [];
  return { reunion: r, puedeAdministrar: admin, otrasPersonas: otras, motivos: datos_('Motivos').map(function (m) { return m.motivo; }),
           personas: convocadosDe_(r).map(function (n) { var au = ausentes[n]; return { nombre: n, rol: roles[n] || 'Docente', registro: a[n] || null, ausente: au ? { motivo: au.motivo, dias: au.dias, desde: au.desde, hasta: au.hasta } : null }; }) };
}

/** Guarda la asistencia (reemplaza lo anterior de cada persona). p = {id, registros:[{persona, estado, motivo?, observacion?}]} */
function guardarAsistenciaReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var r = reunionesDatos_().map(reunionDeFila_).filter(function (x) { return x.id === p.id; })[0];
  if (!r) throw new Error('No se encontró la reunión.');
  var motivos = datos_('Motivos').map(function (m) { return m.motivo; }), conv = convocadosDe_(r), convocados = {};
  conv.forEach(function (n) { convocados[n] = 1; });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Asistencia_Reunion', COL_ASIST_REUNION), v = sh.getDataRange().getValues(), cuenta = { guardados: 0 }, ncol = COL_ASIST_REUNION.length;
    var pos = {}; for (var i = 1; i < v.length; i++) if (v[i][0] === r.id) pos[v[i][2]] = i;   // solo las filas de esta reunión
    var cambios = {}, nuevas = [], lo = -1, hi = -1;
    (p.registros || []).forEach(function (x) {
      if (ESTADOS_REUNION.indexOf(x.estado) < 0 || !convocados[x.persona]) return;
      var motivo = x.estado === 'No asistió' ? (motivos.indexOf(x.motivo) >= 0 ? x.motivo : 'Sin justificación') : '';
      var fila = [r.id, txtForzado_(r.fecha), x.persona, x.estado, motivo, String(x.observacion || '').slice(0, 200), por, ahoraTxt_()], idx = pos[x.persona];
      if (idx > 0) { v[idx] = fila; lo = lo < 0 ? idx : Math.min(lo, idx); hi = Math.max(hi, idx); }
      else { nuevas.push(fila); }
      cuenta.guardados++;
    });
    /* escrituras por lotes (antes una por persona): un bloque con las filas ya existentes y otro con las nuevas */
    if (lo > 0) sh.getRange(lo + 1, 1, hi - lo + 1, ncol).setValues(v.slice(lo, hi + 1).map(function (f) { return rellena_(f, ncol); }));
    if (nuevas.length) sh.getRange(v.length + 1, 1, nuevas.length, ncol).setValues(nuevas);
    return cuenta;
  } finally { lock.releaseLock(); }
}

/**
 * Para quien administra: agrega a una reunión una persona que no aparece en su lista (p. ej. un docente sin horario o convocado por error de grupo).
 * Si la reunión convoca a TODOS, pasa a una lista explícita con todos más esa persona. p = {id, persona}
 */
function agregarPersonaReunion(p) {
  p = p || {};
  var quien = identidad_();
  if (!puedeAdministrar_(quien)) throw new Error('Solo quien administra puede agregar personas a una reunión.');
  var persona = String(p.persona || '').trim().slice(0, 100);
  if (persona.length < 3) throw new Error('Escriba o elija el nombre de la persona.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = reunionesHoja_(), v = sh.getDataRange().getValues(), cab = v[0], c = {}, fila = -1;
    cab.forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (String(v[i][c.id]) === String(p.id)) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró la reunión.');
    var actual = String(v[fila][c.convocados] || 'TODOS'), lista;
    if (actual === 'TODOS') lista = personasReunion_().map(function (x) { return x.nombre; });
    else lista = actual === 'NINGUNO' ? [] : actual.split(';').map(function (x) { return x.trim(); }).filter(String);
    if (lista.indexOf(persona) >= 0) return { ok: true, yaEstaba: true };
    lista.push(persona);
    sh.getRange(fila + 1, c.convocados + 1).setValue(lista.join('; '));
    bitacora_('Agregó persona a una reunión', persona + ' → ' + v[fila][c.nombre] + ' (' + fechaIso_(v[fila][c.fecha]) + ')');
    return { ok: true, yaEstaba: false };
  } finally { lock.releaseLock(); }
}

/**
 * Reuniones de la fecha que se cruzan con las sesiones indicadas (horas de Franjas), para la ronda de aula.
 * Devuelve [{id, nombre, tipo, inicio, fin, sinEstudiantes, convocados: 'TODOS'|[...], asistencia: {persona: estado}}].
 */
function reunionesEnSesiones_(fecha, sesiones, franjas) {
  var hs = franjas.filter(function (f) { return sesiones.indexOf(Number(f.hora)) >= 0; });
  if (!hs.length) return [];
  var ini = hhmm_(hs[0].inicio), fin = hhmm_(hs[hs.length - 1].fin);
  hs.forEach(function (f) { if (hhmm_(f.inicio) < ini) ini = hhmm_(f.inicio); if (hhmm_(f.fin) > fin) fin = hhmm_(f.fin); });
  return reunionesDe_(fecha).filter(function (r) { return (r.sinEstudiantes ? r.inicioClases : r.inicio) < fin && r.fin > ini; }).map(function (r) {
    var a = asistenciaDe_(r.id), est = {}; Object.keys(a).forEach(function (n) { est[n] = a[n].estado; });
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, salidaEst: r.salidaEst, finClases: r.finClases, convocados: r.convocados, asistencia: est };
  });
}
/** ¿Esa persona está convocada a la reunión? */
function convocadoA_(reunion, nombre) { return reunion.convocados === 'TODOS' || reunion.convocados.indexOf(nombre) >= 0; }

/**
 * Docentes con novedad de ausencia en un día (no asiste, permiso por horas, llega tarde o sale temprano), con el motivo, el rango de días de esa novedad
 * (las novedades de varios días comparten «ID registro»), quién queda a cargo y si se dejó actividad. Para el aviso del día.
 */
function ausentesDelDia_(hoy) {
  var tipos = ['No asistió', 'Ausente temporal', 'Salida temprana informada', 'Llegada tarde informada'];
  var v = hoja_('Novedades').getDataRange().getValues(), cab = v[0], c = {}; cab.forEach(function (k, i) { c[k] = i; });
  function g(f, k) { return c[k] == null ? '' : f[c[k]]; }
  var rango = {};   // id|docente -> {desde, hasta}
  for (var i = 1; i < v.length; i++) {
    var id = String(g(v[i], 'ID registro') || ''); if (!id) continue;
    var f = fechaIso_(g(v[i], 'Fecha Novedad')), k = id + '|' + g(v[i], 'Docente'), o = rango[k] = rango[k] || { desde: f, hasta: f, dias: {} };
    if (f < o.desde) o.desde = f; if (f > o.hasta) o.hasta = f; o.dias[f] = 1;
  }
  var por = {}, orden = [];
  for (var j = 1; j < v.length; j++) {
    var fila = v[j], doc = g(fila, 'Docente'), tipo = String(g(fila, 'Tipo Novedad'));
    if (!doc || tipos.indexOf(tipo) < 0 || fechaIso_(g(fila, 'Fecha Novedad')) !== hoy) continue;
    var jc = String(g(fila, 'Sesiones')) === 'JC' || (tipo === 'No asistió' && String(g(fila, 'Horario')) === 'Jornada completa');
    var ant = por[doc];
    if (ant && (ant.jornada || !jc)) continue;
    var ri = rango[String(g(fila, 'ID registro') || '') + '|' + doc];
    if (!ant) orden.push(doc);
    por[doc] = { docente: doc, corto: nombreCortoDocente_(doc), motivo: String(g(fila, 'Motivo Ausencia') || ''), tipo: tipo, jornada: jc || tipo === 'No asistió',
      desde: ri ? ri.desde : hoy, hasta: ri ? ri.hasta : hoy, dias: ri ? Object.keys(ri.dias).length : 1,
      atiende: String(g(fila, 'Grupo atendido por') || ''), actividad: String(g(fila, 'Actividad de Aprendizaje') || '') };
  }
  return orden.map(function (d) { return por[d]; });
}

/** Convocados a una reunión que ya tienen una ausencia de toda la jornada reportada en Novedades ese día (para avisar al crear o editar). */
function ausentesConvocados_(id) {
  try {
    var r = reunionesDatos_().map(reunionDeFila_).filter(function (x) { return x.id === id; })[0];
    if (!r) return [];
    var conv = convocadosDe_(r);
    return ausentesDelDia_(r.fecha).filter(function (a) { return a.jornada && conv.indexOf(a.docente) >= 0; })
      .map(function (a) { return { docente: a.corto || a.docente, motivo: a.motivo, dias: a.dias }; });
  } catch (e) { return []; }
}

/**
 * Las reuniones se programan de lunes a viernes entre las 6:30 y las 18:00 (la jornada laboral). Con la marca «excepcional» se permiten sábados, domingos y horas
 * fuera de esa franja (bazar, cena de grados, celebración fuera del colegio, jornada ampliada para compensatorios): queda marcada y se anota en la bitácora.
 * Los límites se pueden cambiar en la hoja Parametros (reunion_desde, reunion_hasta).
 */
function ventanaReunion_(fecha, ini, fin, excepcional, tipo) {
  if (excepcional) return;
  var desde = String(parametro_('reunion_desde', '06:30')), hasta = String(parametro_('reunion_hasta', '18:00')), dw = resDia_(String(fecha));
  if ((dw < 1 || dw > 5) && !(dw === 6 && TIPOS_SABADO.indexOf(tipoReunion_(tipo)) >= 0)) throw new Error('Las reuniones se programan de lunes a viernes (los sábados solo boletines, jornada pedagógica, escuela de padres, ceremonias de grado y clausura). Si es excepcional, marque «Excepcional».');
  if (ini < desde || fin > hasta) throw new Error('El horario de las reuniones es de ' + desde + ' a ' + hasta + '. Si es excepcional (fuera de ese horario), marque «Excepcional».');
}

// ===================== Incumplimientos.gs =====================
/**
 * Incumplimientos de los deberes docentes que se reportan con rigor:
 *  - "Incumplimiento: no atiende al grupo": el docente está en el colegio pero no atiende a los estudiantes.
 *  - "Incumplimiento: despidió a los estudiantes sin autorización": envió a los niños a la casa sin autorización de un directivo.
 * Se guardan en la hoja Incumplimientos, que es un REGISTRO DE SOLO AGREGAR: la ronda no la borra ni la reemplaza (aunque después se
 * cambie la marca de esa sesión), cada fila lleva quién la registró y cuándo, la reincidencia (n.º de reportes del docente) y un
 * seguimiento (estado + notas que solo se agregan). Nada de esto es una sanción: es el soporte para el debido proceso.
 */
var COL_INCUMPL = ['id', 'fecha', 'docente', 'tipo', 'sesiones', 'grupo', 'area', 'minutos', 'donde', 'descripcion', 'explicacion_docente',
                   'registrado_por', 'fecha_registro', 'estado', 'seguimiento', 'reincidencia'];
var TIPOS_INCUMPL = { NO_ATIENDE: 'Incumplimiento: no atiende al grupo', DESPIDIO: 'Incumplimiento: despidió a los estudiantes sin autorización' };
var DONDE_INCUMPL = ['En la sala de profesores', 'En el patio o pasillos', 'En otra dependencia del colegio', 'En coordinación o secretaría', 'No se sabe dónde estaba'];
var ESTADOS_SEGUIMIENTO = ['Reportado', 'En seguimiento', 'Citado a descargos', 'Con llamado de atención', 'Cerrado'];
var MIN_DESCRIPCION_INCUMPL = 15;

function hojaIncumplimientos_() { return hojaOCrea_('Incumplimientos', COL_INCUMPL); }

/** Agrega un reporte (si ya existe el mismo docente-fecha-tipo-sesiones no lo duplica). Devuelve {id, reincidencia, nuevo}. */
function registrarIncumplimiento_(d) {
  var sh = hojaIncumplimientos_(), v = sh.getDataRange().getValues(), cab = v[0], col = {}, previos = 0;
  cab.forEach(function (k, i) { col[k] = i; });
  for (var i = 1; i < v.length; i++) {
    if (v[i][col.docente] !== d.docente) continue;
    previos++;
    if (fechaIso_(limpiaTxt_(v[i][col.fecha])) === d.fecha && v[i][col.tipo] === d.tipo && String(v[i][col.sesiones]) === String(d.sesiones))
      return { id: v[i][col.id], reincidencia: Number(v[i][col.reincidencia]) || previos, nuevo: false };
  }
  var id = Utilities.getUuid(), rei = previos + 1;
  sh.appendRow([id, txtForzado_(d.fecha), d.docente, d.tipo, d.sesiones, textoCod_(d.grupo || ''), d.area || '', d.minutos || '', d.donde || '',
    String(d.descripcion || '').slice(0, 1000), String(d.explicacion || '').slice(0, 500), d.por || '', ahoraTxt_(), 'Reportado', '', rei]);
  return { id: id, reincidencia: rei, nuevo: true };
}

/** Lista los reportes de un periodo. p = {desde?, hasta?} (por defecto, todo el año). */
function listarIncumplimientos(p) {
  exigirDirectivo_();
  p = p || {};
  var desde = p.desde ? fechaIso_(p.desde) : '0000-00-00', hasta = p.hasta ? fechaIso_(p.hasta) : '9999-99-99';
  var todos = datosOCrea_('Incumplimientos', COL_INCUMPL).map(function (r) {
    return { id: r.id, fecha: fechaIso_(limpiaTxt_(r.fecha)), docente: r.docente, tipo: r.tipo, sesiones: r.sesiones, grupo: limpiaTxt_(r.grupo), area: r.area, minutos: r.minutos,
             donde: r.donde, descripcion: r.descripcion, explicacion: r.explicacion_docente, registradoPor: r.registrado_por, fechaRegistro: String(r.fecha_registro),
             estado: r.estado, seguimiento: r.seguimiento, reincidencia: Number(r.reincidencia) || 1 };
  });
  var lista = todos.filter(function (r) { return r.fecha >= desde && r.fecha <= hasta; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : 0); });
  var por = {}; todos.forEach(function (r) { por[r.docente] = (por[r.docente] || 0) + 1; });
  return { lista: lista, totalPorDocente: por, estados: ESTADOS_SEGUIMIENTO };
}

/** Cambia el estado del seguimiento y agrega una nota (las notas anteriores se conservan). p = {id, estado, nota?} */
function actualizarSeguimiento(p) {
  var quien = exigirDirectivo_();
  p = p || {};
  if (ESTADOS_SEGUIMIENTO.indexOf(p.estado) < 0) throw new Error('Estado no válido.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaIncumplimientos_(), v = sh.getDataRange().getValues(), col = {};
    v[0].forEach(function (k, i) { col[k] = i; });
    for (var i = 1; i < v.length; i++) if (v[i][col.id] === p.id) {
      var nota = String(p.nota || '').trim().slice(0, 500);
      var linea = ahoraTxt_() + ' · ' + (quien.nombre || quien.email) + ' · ' + p.estado + (nota ? ': ' + nota : '');
      sh.getRange(i + 1, col.estado + 1).setValue(p.estado);
      sh.getRange(i + 1, col.seguimiento + 1).setValue((v[i][col.seguimiento] ? v[i][col.seguimiento] + '\n' : '') + linea);
      return { ok: true };
    }
    throw new Error('No se encontró el reporte.');
  } finally { lock.releaseLock(); }
}

// ===================== Horarios.gs =====================
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
  if (aplicar) invalidarCache_();
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

// ===================== Novedades.gs =====================
/**
 * Registro de novedades SIN necesidad de hacer la ronda (reemplaza el formulario de Google): permisos, incapacidades, talleres, llegadas tarde
 * o salidas tempranas avisadas, calamidades, salidas pedagógicas con estudiantes (paseos, intercolegiados, charlas, recorridos), etc.
 * Se puede registrar para hoy, para días anteriores o para días futuros (un solo día o varios). Escribe en la hoja Novedades con el mismo
 * esquema del formulario: la ronda las muestra al otro directivo ("Reportado hoy") y el panel y los informes las cuentan sin duplicar.
 * Cada registro lleva un "ID registro" para poder anularlo (la anulación queda anotada en la hoja Novedades_Anuladas).
 *
 * Salida pedagógica / actividad con estudiantes fuera del colegio: es una actividad institucional; no suma "tiempo sin atender" y en la ronda
 * ese docente aparece como "Fuera con estudiantes" (no se marca ausente).
 *
 * Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
 */
var TIPO_EXTERNA = 'Actividad externa con estudiantes';
var COL_ANULADAS = ['id', 'docente', 'fecha', 'tipo', 'filas', 'anulado_por', 'fecha_anulacion'];
/** id de la pantalla -> tipo que se guarda en la hoja Novedades y qué horas pide. */
var TIPOS_NOVEDAD = [
  { id: 'AUSENCIA', texto: 'No asistirá (o no asistió) el día completo', tipo: 'No asistió', pide: 'dias' },
  { id: 'TARDE', texto: 'Llegará tarde (o llegó tarde)', tipo: 'Llegada tarde informada', pide: 'llegada' },
  { id: 'SALIDA', texto: 'Saldrá temprano (o salió temprano)', tipo: 'Salida temprana informada', pide: 'salida' },
  { id: 'HORAS', texto: 'Permiso por horas', tipo: 'Ausente temporal', pide: 'rango' },
  { id: 'EXTERNA', texto: 'Salida pedagógica o actividad con estudiantes fuera del colegio', tipo: TIPO_EXTERNA, pide: 'rango_o_dia' }
];
/** Motivos de las salidas con estudiantes (se agregan solos a la hoja Motivos si faltan; ver asegurarMotivos_). */
var MOTIVOS_EXTERNA = ['Visita a empresa, institución o feria con estudiantes', 'Salida cultural o artística con estudiantes', 'Otra salida con estudiantes (escribir en el detalle)', 'Salida pedagógica o recorrido con estudiantes', 'Paseo o salida recreativa con estudiantes', 'Intercolegiados o evento deportivo con estudiantes',
  'Charla o actividad externa con estudiantes'];

function aMin_(hhmm) { var m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function esFechaIso_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(new Date(s + 'T12:00:00Z').getTime()); }

/** La hoja Novedades de libros anteriores no trae "ID registro": se agrega la columna al final. Devuelve el encabezado. */
function encabezadoNovedades_() {
  var sh = hoja_('Novedades'), cab = sh.getDataRange().getValues()[0];
  if (cab.indexOf('ID registro') < 0) { sh.getRange(1, cab.length + 1).setValue('ID registro'); cab.push('ID registro'); }
  return cab;
}
function filaNovedad_(cab, o) { return cab.map(function (c) { return o[c] == null ? '' : o[c]; }); }

/** Datos para la pantalla de novedades. */
function datosNovedades() {
  exigirDirectivo_();
  asegurarMotivos_(); asegurarListas_();
  var hoy = ymd_(new Date());
  var motivos = datos_('Motivos').map(function (m) { return { motivo: m.motivo, categoria: m.categoria, justificada: m.justificada }; });
  var l = function (n) { return datos_('Listas').filter(function (x) { return x.lista === n; }).map(function (x) { return x.valor; }); };
  return {
    sesionDe: (function () { try { var i = identidad_(); return i.rol === 'directivo' ? (i.nombre || '') : ''; } catch (e) { return ''; } })(),   // quien abrió la sesión: a su nombre queda lo que se registre
    hoy: hoy,
    docentes: datos_('Docentes').filter(function (d) { return String(d.tiene_horario) === 'SI'; }).map(function (d) { return { nombre: d.nombre_completo, nivel: d.nivel }; })
      .sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; }),
    tipos: TIPOS_NOVEDAD.map(function (t) { return { id: t.id, texto: t.texto, pide: t.pide }; }),
    motivos: motivos, motivosExterna: MOTIVOS_EXTERNA,
    medios: l('medio'), fuentes: l('fuente'),
    registros: registrosRecientes_(hoy),
    ultimas: ultimasNovedades_()
  };
}

/**
 * Las últimas novedades registradas, vengan de la ronda o del formulario de novedades (lo más reciente primero). Se juntan las sesiones de un mismo
 * docente, día, tipo y motivo en una sola línea con el total de minutos.
 */
function ultimasNovedades_(max) {
  max = max || 25;
  /* solo se leen las filas del final de la hoja (las más recientes), no toda: así «ver anteriores» no hace lenta la aplicación aunque la hoja crezca */
  var sh = hoja_('Novedades'), truncado = false, v;
  if (typeof sh.getLastRow === 'function' && typeof sh.getLastColumn === 'function') {
    var ult = sh.getLastRow(), cols = sh.getLastColumn(), K = Math.min(ult - 1, max * 10 + 40);
    v = ult > 1 ? sh.getRange(ult - K + 1, 1, K, cols).getValues() : [];
    v.unshift(sh.getRange(1, 1, 1, cols).getValues()[0]); truncado = K < ult - 1;
  } else v = sh.getDataRange().getValues();
  var cab = v[0], c = {}, por = {}, orden = [];
  cab.forEach(function (k, i) { c[k] = i; });
  function g(r, k) { return c[k] == null ? '' : r[c[k]]; }
  for (var i = v.length - 1; i >= 1 && orden.length < max; i--) {
    var r = v[i]; if (!g(r, 'Docente')) continue;
    var f = fechaIso_(g(r, 'Fecha Novedad')), k = [f, g(r, 'Docente'), g(r, 'Tipo Novedad'), g(r, 'Motivo Ausencia'), g(r, 'Directivo Docente')].join('|');
    if (!por[k]) {
      var ts = g(r, 'Marca temporal');
      por[k] = { fecha: f, docente: g(r, 'Docente'), tipo: g(r, 'Tipo Novedad'), motivo: g(r, 'Motivo Ausencia'), por: g(r, 'Directivo Docente'), minutos: 0, sesiones: 0,
        origen: String(g(r, 'Medio Información')) === MEDIO_RONDA ? 'Ronda' : 'Formulario de novedades', registrado: ts instanceof Date ? Utilities.formatDate(ts, TZ, 'yyyy-MM-dd HH:mm') : String(ts || ''), atiende: String(g(r, 'Grupo atendido por') || '') };
      orden.push(k);
    }
    por[k].minutos += Number(g(r, 'Minutos Desatendidos')) || 0; por[k].sesiones++;
  }
  var out = orden.map(function (k) { return por[k]; }); out.truncado = truncado;
  return out;
}
/** Página de novedades anteriores para la lista «Últimas novedades» (desplazamiento infinito). p = {offset, limite}. */
function historialNovedades(p) {
  exigirDirectivo_(); p = p || {};
  var off = Math.max(0, Number(p.offset) || 0), lim = Math.min(40, Math.max(5, Number(p.limite) || 25));
  var arr = ultimasNovedades_(off + lim + 1);
  return { items: arr.slice(off, off + lim), hayMas: arr.length > off + lim };
}

/** Registros hechos desde esta pantalla, de los últimos 7 días y los futuros (agrupados por ID). */
function registrosRecientes_(hoy) {
  var admin = false; try { admin = puedeAdministrar_(identidad_()); } catch (e) { admin = false; }
  var v = hoja_('Novedades').getDataRange().getValues(), cab = v[0], c = {}, desde = resSumaDias_(hoy, -7), por = {}, orden = [];
  cab.forEach(function (k, i) { c[k] = i; });
  if (c['ID registro'] == null) return [];
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][c['ID registro']] || ''); if (!id) continue;
    var f = fechaIso_(v[i][c['Fecha Novedad']]); if (f < desde) continue;
    var k = id + '|' + v[i][c['Docente']];
    if (!por[k]) { por[k] = { id: id, docente: v[i][c['Docente']], tipo: v[i][c['Tipo Novedad']], motivo: v[i][c['Motivo Ausencia']], fechas: {}, descripcion: String(v[i][c['Descripción']] || ''), por: v[i][c['Directivo Docente']],
      atiende: String(v[i][c['Grupo atendido por']] || ''), actividad: String(v[i][c['Actividad de Aprendizaje']] || '') }; orden.push(k); }
    por[k].fechas[f] = 1;
  }
  return orden.map(function (k) {
    var r = por[k], fs = Object.keys(r.fechas).sort();
    return { id: r.id, docente: r.docente, tipo: r.tipo, motivo: r.motivo, desde: fs[0], hasta: fs[fs.length - 1], dias: fs.length, descripcion: r.descripcion.slice(0, 120), por: r.por,
             atiende: r.atiende, actividad: r.actividad, editable: fs[fs.length - 1] >= hoy || admin };
  }).sort(function (a, b) { return a.desde < b.desde ? 1 : (a.desde > b.desde ? -1 : 0); });
}

function diasHabilesRango_(desde, hasta) {
  var out = [], f = desde, g = 0;
  while (f <= hasta && g++ < 60) { var d = resDia_(f); if (d >= 1 && d <= 5) out.push(f); f = resSumaDias_(f, 1); }
  return out;
}

/**
 * Registra una novedad para uno o varios docentes y uno o varios días.
 * p = {docentes:[...], tipo:'AUSENCIA'|'TARDE'|'SALIDA'|'HORAS'|'EXTERNA', desde:'aaaa-mm-dd', hasta?, horaIni?, horaFin?, todoElDia?, motivo, medio?, fuente?, descripcion?, actividad?}
 */
function registrarNovedad(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var def = TIPOS_NOVEDAD.filter(function (t) { return t.id === p.tipo; })[0];
  if (!def) throw new Error('Elija qué pasó (tipo de novedad).');
  var validos = {}; datos_('Docentes').forEach(function (d) { if (String(d.tiene_horario) === 'SI') validos[d.nombre_completo] = 1; });
  var docentes = (p.docentes || []).filter(function (n, i, a) { return validos[n] && a.indexOf(n) === i; });
  if (!docentes.length) throw new Error('Elija al menos un docente.');
  var desde = String(p.desde || ''), hasta = String(p.hasta || p.desde || '');
  if (!esFechaIso_(desde) || !esFechaIso_(hasta) || hasta < desde) throw new Error('Revise las fechas.');
  if (hasta > resSumaDias_(desde, 45)) throw new Error('El rango máximo es de 45 días; haga varios registros.');
  asegurarMotivos_(); asegurarListas_();
  var motivos = {}; datos_('Motivos').forEach(function (m) { motivos[m.motivo] = m; });
  var motivo = String(p.motivo || '');
  if (!motivos[motivo]) throw new Error('Elija el motivo.');
  var m = motivos[motivo];
  // horas que cubre la novedad (en minutos del día)
  var ini = 0, fin = 24 * 60, texto = '';
  if (def.pide === 'llegada') { fin = aMin_(p.horaFin); if (fin == null) throw new Error('Escriba la hora a la que llega.'); texto = 'Llega a las ' + p.horaFin + '. '; }
  else if (def.pide === 'salida') { ini = aMin_(p.horaIni); if (ini == null) throw new Error('Escriba la hora a la que sale.'); texto = 'Sale a las ' + p.horaIni + '. '; }
  else if (def.pide === 'rango' || (def.pide === 'rango_o_dia' && !p.todoElDia)) {
    ini = aMin_(p.horaIni); fin = aMin_(p.horaFin);
    if (ini == null || fin == null || fin <= ini) throw new Error('Revise la hora de inicio y la de fin.');
    texto = 'De ' + p.horaIni + ' a ' + p.horaFin + '. ';
  } else if (def.pide === 'rango_o_dia') texto = 'Todo el día. ';
  var l = datos_('Listas'), medios = l.filter(function (x) { return x.lista === 'medio'; }).map(function (x) { return x.valor; }), fuentes = l.filter(function (x) { return x.lista === 'fuente'; }).map(function (x) { return x.valor; });
  var medio = medios.indexOf(p.medio) >= 0 ? p.medio : 'WhatsApp directo', fuente = fuentes.indexOf(p.fuente) >= 0 ? p.fuente : 'Docente ausente';
  var descripcion = (texto + String(p.descripcion || '')).trim().slice(0, 300);

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var nov = hoja_('Novedades'), cab = encabezadoNovedades_(), v = nov.getDataRange().getValues(), c = {};
    cab.forEach(function (k, i) { c[k] = i; });
    var hz = datos_('Horario'), id = Utilities.getUuid(), ahora = new Date(), res = { id: id, filas: 0, dias: 0, sinClases: [], yaAusente: [] };
    var fechas = diasHabilesRango_(desde, hasta);
    if (!fechas.length) throw new Error('El rango no tiene días hábiles (lunes a viernes).');
    function quita(fecha, docente, fn) {
      for (var j = v.length - 1; j >= 1; j--) {
        if (fechaIso_(v[j][c['Fecha Novedad']]) === fecha && v[j][c['Docente']] === docente && fn(String(v[j][c['Tipo Novedad']]), String(v[j][c['Sesiones']]))) { nov.deleteRow(j + 1); v.splice(j, 1); }
      }
    }
    function agrega(o) { var fila = filaNovedad_(cab, o); nov.appendRow(fila); v.push(fila); res.filas++; }
    fechas.forEach(function (fecha) {
      var dia = DIAS[Number(Utilities.formatDate(new Date(fecha + 'T12:00:00'), TZ, 'u'))], algun = false;
      docentes.forEach(function (doc) {
        var mias = hz.filter(function (h) { return h.docente === doc && h.dia === dia; }).sort(function (a, b) { return Number(a.hora) - Number(b.hora); });
        if (!mias.length) { res.sinClases.push(doc + ' (' + fecha + ')'); return; }
        var base = { 'Marca temporal': ahora, 'Fecha Novedad': fecha, 'Docente': doc, 'Tipo Novedad': def.tipo, 'Actividad de Aprendizaje': ['Sí', 'No'].indexOf(p.actividad) >= 0 ? p.actividad : 'N/A', 'Grupo atendido por': (ATIENDE_GRUPO.indexOf(p.atiende) >= 0 || SIN_ESTUDIANTES.indexOf(p.atiende) >= 0) ? p.atiende : '', 'Motivo Ausencia': motivo,
          'Descripción': descripcion, 'Fuente Novedad': fuente, 'Medio Información': medio, 'Directivo Docente': por, 'Justificada': m.justificada === 'SI' ? 'Sí' : 'No', 'Categoría motivo': m.categoria || '', 'ID registro': id };
        var jcPrevio = v.slice(1).some(function (x) { return fechaIso_(x[c['Fecha Novedad']]) === fecha && x[c['Docente']] === doc && String(x[c['Sesiones']]) === 'JC' && /no asisti/i.test(String(x[c['Tipo Novedad']])); });
        if (def.id === 'AUSENCIA') {   // una sola novedad por día con el total de minutos (reemplaza lo anterior de ese día)
          quita(fecha, doc, function (t) { return /no asisti/i.test(t); });
          var total = 0, gs = {}, as = {};
          mias.forEach(function (h) { var g = h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo; total += minutosSesion_(g); gs[g] = 1; as[h.area || '(énfasis)'] = 1; });
          var gk = Object.keys(gs), ak = Object.keys(as), pj = gk.length === 1 ? partesGrupo_(String(gk[0]).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
          agrega(Object.assign({}, base, { 'Grado': pj.grado, 'Grupo': pj.grupo, 'Área/Asignatura': ak.length === 1 ? ak[0] : 'Todas', 'Horario': 'Jornada completa', 'Minutos Desatendidos': total, 'Sesiones': 'JC' }));
          algun = true; return;
        }
        if (jcPrevio) { res.yaAusente.push(doc + ' (' + fecha + ')'); return; }
        mias.forEach(function (h) {
          var hi = aMin_(hhmm_(h.inicio)), hf = aMin_(hhmm_(h.fin)), g = h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo;
          var sol = Math.min(fin, hf) - Math.max(ini, hi);
          if (sol <= 0) return;
          var pg = partesGrupo_(String(g).split('+')[0]), pre = /^00/.test(String(h.grupo)), s = Number(h.hora);
          quita(fecha, doc, function (t, ses) { return ses === 'S' + s && t === def.tipo; });
          agrega(Object.assign({}, base, { 'Grado': pg.grado, 'Grupo': pg.grupo, 'Área/Asignatura': h.area || '(énfasis)',
            'Horario': 'H' + s + ' ' + hhmm_(h.inicio) + ' - ' + hhmm_(h.fin) + (pre ? '' : ' Bloque ' + Math.ceil(s / 2)),
            'Minutos Desatendidos': def.id === 'EXTERNA' ? '' : Math.min(sol, hf - hi), 'Sesiones': 'S' + s }));
          algun = true;
        });
      });
      if (algun) res.dias++;
    });
    if (!res.filas) throw new Error('No se guardó nada: ' + (res.sinClases.length ? 'los docentes no tienen clases en esos horarios o días. ' : '') + (res.yaAusente.length ? 'ya estaban reportados como ausentes todo el día. ' : '') + (!res.sinClases.length && !res.yaAusente.length ? 'ninguna de sus clases se cruza con esas horas.' : ''));
    return res;
  } finally { lock.releaseLock(); }
}

/** Anula un registro hecho desde esta pantalla (todas sus filas). Queda anotado quién y cuándo en Novedades_Anuladas. p = {id, docente?} */
function quitarNovedad(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email, id = String((p && p.id) || '');
  if (!id) throw new Error('Falta el registro.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var nov = hoja_('Novedades'), v = nov.getDataRange().getValues(), c = {}, quitadas = 0, resumen = {};
    v[0].forEach(function (k, i) { c[k] = i; });
    if (c['ID registro'] == null) throw new Error('No se encontró el registro.');
    for (var j = v.length - 1; j >= 1; j--) {
      if (String(v[j][c['ID registro']]) !== id) continue;
      if (p.docente && v[j][c['Docente']] !== p.docente) continue;
      var k = v[j][c['Docente']] + '|' + v[j][c['Tipo Novedad']];
      resumen[k] = resumen[k] || { docente: v[j][c['Docente']], tipo: v[j][c['Tipo Novedad']], fechas: [] };
      resumen[k].fechas.push(fechaIso_(v[j][c['Fecha Novedad']]));
      nov.deleteRow(j + 1); v.splice(j, 1); quitadas++;
    }
    if (!quitadas) throw new Error('No se encontró el registro (puede que ya se haya anulado).');
    var an = hojaOCrea_('Novedades_Anuladas', COL_ANULADAS);
    Object.keys(resumen).forEach(function (k) {
      var r = resumen[k], fs = r.fechas.sort();
      an.appendRow([id, r.docente, fs[0] + (fs.length > 1 ? ' a ' + fs[fs.length - 1] : ''), r.tipo, r.fechas.length, por, ahoraTxt_()]);
    });
    return { quitadas: quitadas };
  } finally { lock.releaseLock(); }
}

/** ¿Ese docente está fuera con estudiantes en esa sesión? (lee Novedades; para la ronda) Devuelve {motivo, texto} o null. */
function externaDe_(fecha, docente, sesion, novedades) {
  var hit = null;
  (novedades || datos_('Novedades')).forEach(function (n) {
    if (hit || n['Tipo Novedad'] !== TIPO_EXTERNA || n['Docente'] !== docente || fechaIso_(n['Fecha Novedad']) !== fecha) return;
    var s = String(n['Sesiones']);
    if (s === 'JC' || s === 'S' + sesion) hit = { motivo: n['Motivo Ausencia'], texto: String(n['Descripción'] || '').slice(0, 160) };
  });
  return hit;
}

/**
 * Edita los detalles de una novedad ya registrada (todos sus días, o solo los que aún no han pasado si quien edita no es administrador):
 * motivo, quién queda a cargo, actividad de aprendizaje y detalle. p = {id, docente, motivo?, atiende?, actividad?, descripcion?, observacion}. Queda en Bitacora_Cambios.
 */
function editarNovedad(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email, id = String((p && p.id) || ''), docente = String((p && p.docente) || '');
  if (!id || !docente) throw new Error('Falta el registro que se quiere editar.');
  var admin = puedeAdministrar_(quien), hoy = ymd_(new Date());
  var motivos = datos_('Motivos'), m = null;
  if (p.motivo) { m = motivos.filter(function (x) { return x.motivo === p.motivo; })[0]; if (!m) throw new Error('Ese motivo no existe.'); }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var nov = hoja_('Novedades'), v = nov.getDataRange().getValues(), c = {}, cambiadas = 0, bloqueadas = 0;
    v[0].forEach(function (k, i) { c[k] = i; });
    if (c['ID registro'] == null) throw new Error('No se encontró el registro.');
    function pon(fila, col, valor) { if (c[col] != null) nov.getRange(fila + 1, c[col] + 1).setValue(valor); }
    for (var j = 1; j < v.length; j++) {
      if (String(v[j][c['ID registro']]) !== id || v[j][c['Docente']] !== docente) continue;
      if (!admin && fechaIso_(v[j][c['Fecha Novedad']]) < hoy) { bloqueadas++; continue; }   // lo que ya pasó solo lo corrige quien administra
      if (m) { pon(j, 'Motivo Ausencia', m.motivo); pon(j, 'Justificada', m.justificada === 'SI' ? 'Sí' : 'No'); pon(j, 'Categoría motivo', m.categoria || ''); }
      if (p.atiende != null) pon(j, 'Grupo atendido por', (ATIENDE_GRUPO.indexOf(p.atiende) >= 0 || SIN_ESTUDIANTES.indexOf(p.atiende) >= 0) ? p.atiende : '');
      if (p.actividad != null) pon(j, 'Actividad de Aprendizaje', ['Sí', 'No'].indexOf(p.actividad) >= 0 ? p.actividad : 'N/A');
      if (p.descripcion != null) pon(j, 'Descripción', String(p.descripcion).slice(0, 200));
      cambiadas++;
    }
    var cambioDias = '';
    if (p.desde && cambiadas) {   // ausencias de toda la jornada: se pueden mover o ampliar los días (solo días hábiles con clases del docente)
      var desde = String(p.desde), hasta = String(p.hasta || p.desde);
      if (!esFechaIso_(desde) || !esFechaIso_(hasta) || hasta < desde) throw new Error('Revise las fechas.');
      var nuevas = diasHabilesRango_(desde, hasta);
      if (!nuevas.length) throw new Error('El rango no tiene días hábiles (lunes a viernes).');
      var filas = [], plantilla = null;
      for (var q = 1; q < v.length; q++) if (String(v[q][c['ID registro']]) === id && v[q][c['Docente']] === docente && String(v[q][c['Sesiones']]) === 'JC') { filas.push({ j: q, f: fechaIso_(v[q][c['Fecha Novedad']]) }); plantilla = plantilla || v[q]; }
      if (!plantilla) throw new Error('Solo se pueden cambiar los días de una ausencia de toda la jornada.');
      var hz = datos_('Horario'), tiene = {}; filas.forEach(function (x) { tiene[x.f] = 1; });
      var agregadas = 0, quitadas = 0;
      filas.slice().sort(function (a, b) { return b.j - a.j; }).forEach(function (x) {
        if (nuevas.indexOf(x.f) >= 0) return;
        if (!admin && x.f < hoy) return;
        nov.deleteRow(x.j + 1); quitadas++;
      });
      nuevas.forEach(function (f) {
        if (tiene[f]) return;
        if (!admin && f < hoy) return;
        var dia = DIAS[resDia_(f)], total = 0;
        hz.forEach(function (h) { if (h.docente === docente && h.dia === dia) total += minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
        if (!total) return;   // ese día no tiene clases
        var fila = plantilla.slice(); fila[c['Fecha Novedad']] = f; fila[c['Minutos Desatendidos']] = total; fila[c['Marca temporal']] = new Date();
        nov.appendRow(fila); agregadas++;
      });
      cambioDias = ' · días: +' + agregadas + ' −' + quitadas + ' (' + desde + ' a ' + hasta + ')';
    }
    if (!cambiadas) throw new Error(bloqueadas ? 'Esa novedad ya pasó: solo quien administra puede corregirla.' : 'No se encontró el registro (puede que se haya anulado).');
    bitacora_('Editó novedad', docente + ' (' + id.slice(0, 8) + '): ' + [m ? 'motivo → ' + m.motivo : '', p.atiende != null ? 'a cargo → ' + (p.atiende || 'sin dato') : '', p.actividad != null ? 'actividad → ' + p.actividad : '', p.descripcion != null ? 'detalle' : ''].filter(String).join(', ') + ' · ' + cambiadas + ' filas' + cambioDias + (p.observacion ? ' · ' + String(p.observacion).slice(0, 150) : ''));
    return { editadas: cambiadas, bloqueadas: bloqueadas };
  } finally { lock.releaseLock(); }
}

// ===================== Estudiantes.gs =====================
/**
 * Estudiantes por grupo (hoja «Estudiantes», importada del listado RCEE: solo grupo, curso, n.º de lista, apellidos y nombres) y marcas de
 * seguimiento que el directivo puede poner: no asiste (posible deserción), se ausenta o se fuga con frecuencia, remitido a orientación escolar,
 * retirado formalmente, matrícula cancelada, en proyecto o programa. Las marcas quedan en la hoja Marcas_Estudiantes (se levantan, no se borran:
 * queda quién y cuándo). Solo las ven los directivos con sesión; son datos de menores y de seguimiento: manéjelos con reserva.
 *
 * Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
 */
var COL_GRUPOS_PROY = ['tipo', 'nombre', 'creado_por', 'fecha'];
var COL_MARCAS_EST = ['id', 'clave', 'grupo', 'curso', 'apellidos', 'nombres', 'tipo', 'nota', 'registrado_por', 'fecha_registro', 'estado', 'levantada_por', 'fecha_levantada'];
var TIPOS_MARCA_EST = [   // cat: grupo en la pantalla; emo/color: distintivo visual; nombre: pide el nombre del proyecto o programa (queda en la nota)
  { id: 'NO_ASISTE', texto: 'No asiste (posible deserción)', cat: 'Alertas y seguimiento', emo: '🚫', color: '#c62828' },
  { id: 'AUSENTE', texto: 'Se ausenta con frecuencia', cat: 'Alertas y seguimiento', emo: '📉', color: '#e65100' },
  { id: 'FUGA', texto: 'Se fuga con frecuencia (se evade de clase)', cat: 'Alertas y seguimiento', emo: '🏃', color: '#b8860b' },
  { id: 'CONVIVENCIA', texto: 'Dificultad de convivencia o conducta violenta', cat: 'Alertas y seguimiento', emo: '⚠️', color: '#ad1457' },
  { id: 'SPA', texto: 'Caso de consumo de SPA', cat: 'Alertas y seguimiento', emo: '🚭', color: '#6d4c41' },
  { id: 'SALUD_MENTAL', texto: 'Salud mental o condición psiquiátrica (para orientación)', cat: 'Alertas y seguimiento', emo: '🧠', color: '#5e35b1' },
  { id: 'ORIENTACION', texto: 'Remitido a orientación escolar', cat: 'Alertas y seguimiento', emo: '🧭', color: '#6a1b9a' },
  { id: 'MATRICULA_COND', texto: 'Matrícula condicional', cat: 'Alertas y seguimiento', emo: '📝', color: '#d84315' },
  { id: 'PROYECTO', texto: 'Proyecto interno del colegio', cat: 'Proyectos y programas', emo: '📘', color: '#1565c0', nombre: true },
  { id: 'REDES_APOYO', texto: 'Beneficiario de red de apoyo u ONG', cat: 'Proyectos y programas', emo: '🤲', color: '#00897b', nombre: true },
  { id: 'GRUPO_ARTISTICO', texto: 'Grupo artístico o cultural (danza, música, banda de paz…)', cat: 'Grupos, selecciones y clubes', emo: '🎭', color: '#8e24aa', nombre: true },
  { id: 'SELECCION', texto: 'Selección o equipo deportivo (atletismo, fútbol sala, natación…)', cat: 'Grupos, selecciones y clubes', emo: '🏆', color: '#ef6c00', nombre: true },
  { id: 'CLUB', texto: 'Club académico o científico (robótica, matemáticas…)', cat: 'Grupos, selecciones y clubes', emo: '🔬', color: '#0277bd', nombre: true },
  { id: 'SENA_ARTICULACION', texto: 'Articulación con el SENA (media técnica)', cat: 'Proyectos y programas', emo: '🛠️', color: '#2e7d32', nombre: true },
  { id: 'SENA_CURSO', texto: 'Aprendiz SENA (curso o programa)', cat: 'Proyectos y programas', emo: '🎓', color: '#558b2f', nombre: true },
  { id: 'NUEVO', texto: 'Estudiante nuevo (llegó en el año)', cat: 'Matrícula', emo: '🆕', color: '#2e7d32' },
  { id: 'PROMOVIDO', texto: 'Promovido al siguiente grado', cat: 'Matrícula', emo: '⬆️', color: '#00838f' },
  { id: 'NO_LISTADO', texto: 'Agregado: no aparecía en el listado', cat: 'Matrícula', emo: '➕', color: '#00796b' },
  { id: 'OTRA_INSTITUCION', texto: 'Matriculado en otra institución', cat: 'Matrícula', emo: '🏫', color: '#6d4c41', nombre: true },
  { id: 'RETIRADO', texto: 'Retirado formalmente', cat: 'Matrícula', emo: '📤', color: '#546e7a' },
  { id: 'CANCELADA', texto: 'Matrícula cancelada', cat: 'Matrícula', emo: '⛔', color: '#37474f' },
  { id: 'SALUD', texto: 'Condición de salud o tratamiento médico', cat: 'Condición o población', emo: '🩺', color: '#00695c' },
  { id: 'LACTANTE', texto: 'Estudiante lactante', cat: 'Condición o población', emo: '🍼', color: '#c2185b' },
  { id: 'GESTANTE', texto: 'Estudiante gestante', cat: 'Condición o población', emo: '🤰', color: '#8e24aa' },
  { id: 'EXTRANJERO', texto: 'Población extranjera (venezolana, ecuatoriana u otra)', cat: 'Condición o población', emo: '🌎', color: '#0277bd' },
  { id: 'DISCAPACIDAD', texto: 'Discapacidad o necesidades educativas especiales', cat: 'Condición o población', emo: '♿', color: '#3949ab' },
  { id: 'DESPLAZADO', texto: 'Población desplazada', cat: 'Condición o población', emo: '🏚️', color: '#795548' },
  { id: 'MADRE_SUSTITUTA', texto: 'Con madre sustituta (hogar sustituto)', cat: 'Condición o población', emo: '🏠', color: '#5d4037' },
  { id: 'DEPORTISTA', texto: 'Deportista destacado', cat: 'Fortalezas y reconocimientos', emo: '🏅', color: '#ef6c00' },
  { id: 'SOBRESALIENTE', texto: 'Sobresaliente académicamente', cat: 'Fortalezas y reconocimientos', emo: '🌟', color: '#f9a825' },
  { id: 'COLABORADOR', texto: 'Colaborador del colegio (apoyo y sentido de pertenencia)', cat: 'Fortalezas y reconocimientos', emo: '🤝', color: '#2e7d32' }
];

function quitaTildes_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function codGrupoEst_(g) { g = String(g == null ? '' : g).replace(/^'/, '').trim().toUpperCase(); return /^\d+$/.test(g) && g.length < 4 ? ('0000' + g).slice(-4) : g; }   // Sheets puede quitar el cero de «0101»
function claveEst_(g, a, n) { return codGrupoEst_(g) + '|' + quitaTildes_(a).trim().toUpperCase().replace(/\s+/g, ' ') + '|' + quitaTildes_(n).trim().toUpperCase().replace(/\s+/g, ' '); }

/** Nombres de grupos, selecciones, clubes y proyectos ya creados (hoja Grupos_Proyectos + los usados en marcas vigentes), sin repetir. */
function catalogoGrupos_() {
  var vistos = {}, out = [];
  function agrega(tipoTexto, nombre) {
    nombre = String(nombre || '').trim(); if (!nombre) return;
    var k = tipoTexto + '|' + quitaTildes_(nombre).toUpperCase(); if (vistos[k]) return; vistos[k] = 1; out.push({ tipo: tipoTexto, nombre: nombre });
  }
  datosOCrea_('Grupos_Proyectos', COL_GRUPOS_PROY).forEach(function (r) { agrega(r.tipo, r.nombre); });
  var conNombre = {}; TIPOS_MARCA_EST.forEach(function (t) { if (t.nombre) conNombre[t.texto] = 1; });
  datosOCrea_('Marcas_Estudiantes', COL_MARCAS_EST).forEach(function (m) { if (m.estado === 'Vigente' && conNombre[m.tipo]) agrega(m.tipo, m.nota); });
  return out.sort(function (a, b) { return a.tipo < b.tipo ? -1 : (a.tipo > b.tipo ? 1 : (a.nombre < b.nombre ? -1 : 1)); });
}
/** Si el nombre ya existe (ignorando mayúsculas y tildes) devuelve su escritura original. */
function canonGrupo_(tipoTexto, nombre) {
  var n = quitaTildes_(nombre).toUpperCase(), hit = catalogoGrupos_().filter(function (c) { return c.tipo === tipoTexto && quitaTildes_(c.nombre).toUpperCase() === n; })[0];
  return hit ? hit.nombre : String(nombre).trim().replace(/\s+/g, ' ');
}
/** Crea (sin asignar a nadie) el nombre de un grupo, selección, club o proyecto para tenerlo en la lista. p = {tipo, nombre} */
function agregarGrupoProyecto(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var tipo = TIPOS_MARCA_EST.filter(function (t) { return t.id === p.tipo && t.nombre; })[0];
  if (!tipo) throw new Error('Elija el tipo de grupo o proyecto.');
  var nombre = String(p.nombre || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  if (nombre.length < 3) throw new Error('Escriba el nombre.');
  if (catalogoGrupos_().some(function (c) { return c.tipo === tipo.texto && quitaTildes_(c.nombre).toUpperCase() === quitaTildes_(nombre).toUpperCase(); })) throw new Error('Ese nombre ya existe.');
  hojaOCrea_('Grupos_Proyectos', COL_GRUPOS_PROY).appendRow([tipo.texto, nombre, por, ahoraTxt_()]);
  return { ok: true };
}

/** Nivel de un grupo por su código: 00 preescolar (transición), 01-05 primaria, 06-09 secundaria, CS caminar en secundaria, 10-11 media, C3/C5 ciclos de adultos. */
function nivelGrupoEst_(cod) {
  cod = String(cod || '');
  if (/^CS/.test(cod)) return 'Caminar en Secundaria';
  if (/^C\d/.test(cod)) return 'Adultos (ciclos)';
  var n = Number(cod.slice(0, 2));
  return n === 0 ? 'Preescolar (transición)' : n <= 5 ? 'Primaria (1° a 5°)' : n <= 9 ? 'Secundaria (6° a 9°)' : 'Media (10° y 11°)';
}
var NIVELES_EST = ['Preescolar (transición)', 'Primaria (1° a 5°)', 'Secundaria (6° a 9°)', 'Caminar en Secundaria', 'Media (10° y 11°)', 'Adultos (ciclos)'];

function listadoEstudiantes_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Estudiantes');
  if (!sh) return null;
  return datos_('Estudiantes').filter(function (r) { return String(r.apellidos || '').trim() || String(r.nombres || '').trim(); }).map(function (r) {
    return { g: codGrupoEst_(r.grupo), curso: String(r.curso || ''), no: Number(r.no) || 0, a: String(r.apellidos || '').trim(), n: String(r.nombres || '').trim() };
  });
}

/** Datos de la pestaña Estudiantes: grupos con totales, estudiantes (con sus marcas vigentes) y los tipos de marca. */
function datosEstudiantes() {
  exigirDirectivo_();
  var lista = listadoEstudiantes_();
  if (!lista) return { sinDatos: true, tipos: TIPOS_MARCA_EST };
  var vig = {};
  datosOCrea_('Marcas_Estudiantes', COL_MARCAS_EST).forEach(function (m) {
    if (String(m.estado) !== 'Vigente') return;
    (vig[m.clave] = vig[m.clave] || []).push({ id: m.id, tipo: m.tipo, nota: String(m.nota || ''), por: m.registrado_por, fecha: String(m.fecha_registro || '').slice(0, 10) });
  });
  var grupos = {}, orden = [];
  lista.sort(function (x, y) { return claveGrupo_(x.g) - claveGrupo_(y.g) || x.no - y.no; });   // orden de lista: preescolar a 11° (CS tras sextos y novenos)
  var est = lista.map(function (e) {
    if (!grupos[e.g]) { grupos[e.g] = { codigo: e.g, curso: e.curso, total: 0, nivel: nivelGrupoEst_(e.g) }; orden.push(e.g); }
    grupos[e.g].total++;
    var m = vig[claveEst_(e.g, e.a, e.n)];
    return m ? { g: e.g, no: e.no, a: e.a, n: e.n, m: m } : { g: e.g, no: e.no, a: e.a, n: e.n };
  });
  orden.sort(function (x, y) { return claveGrupo_(x) - claveGrupo_(y); });
  return { grupos: orden.map(function (c) { return grupos[c]; }), estudiantes: est, tipos: TIPOS_MARCA_EST, catalogo: catalogoGrupos_(), niveles: NIVELES_EST };
}

/** Pone una marca a uno o varios estudiantes. p = {items:[{g, a, n}], tipo, nota?} */
function marcarEstudiantes(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var tipo = TIPOS_MARCA_EST.filter(function (t) { return t.id === p.tipo; })[0];
  if (!tipo) throw new Error('Elija el tipo de marca.');
  if (tipo.nombre && String(p.nota || '').trim().length < 3) throw new Error('Escriba el nombre (del proyecto, programa o institución).');
  var items = p.items || [];
  if (!items.length) throw new Error('Elija al menos un estudiante.');
  if (items.length > 200) throw new Error('Máximo 200 estudiantes a la vez.');
  var lista = listadoEstudiantes_() || [], existe = {};
  lista.forEach(function (e) { existe[claveEst_(e.g, e.a, e.n)] = e; });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), v = sh.getDataRange().getValues(), c = {}, ya = {}, nombrePorTexto = {};
    TIPOS_MARCA_EST.forEach(function (t) { if (t.nombre) nombrePorTexto[t.texto] = 1; });
    v[0].forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (v[i][c.estado] === 'Vigente') ya[v[i][c.clave] + '|' + v[i][c.tipo] + '|' + (nombrePorTexto[v[i][c.tipo]] ? v[i][c.nota] : '')] = 1;
    var res = { marcados: 0, yaTenian: 0 }, nota = String(p.nota || '').trim().slice(0, 300);
    if (tipo.nombre) {   // el nombre del grupo o proyecto se escribe igual siempre y se agrega a la lista de nombres
      nota = canonGrupo_(tipo.texto, nota);
      if (!catalogoGrupos_().some(function (c) { return c.tipo === tipo.texto && c.nombre === nota; })) hojaOCrea_('Grupos_Proyectos', COL_GRUPOS_PROY).appendRow([tipo.texto, nota, por, ahoraTxt_()]);
    }
    items.forEach(function (it) {
      var k = claveEst_(it.g, it.a, it.n), e = existe[k];
      if (!e) return;
      if (ya[k + '|' + tipo.texto + '|' + (tipo.nombre ? nota : '')]) { res.yaTenian++; return; }
      sh.appendRow([Utilities.getUuid(), k, e.g, e.curso, e.a, e.n, tipo.texto, nota, por, ahoraTxt_(), 'Vigente', '', '']);
      ya[k + '|' + tipo.texto + '|' + (tipo.nombre ? nota : '')] = 1; res.marcados++;
    });
    if (!res.marcados && !res.yaTenian) throw new Error('No se encontró a los estudiantes elegidos.');
    return res;
  } finally { lock.releaseLock(); }
}

/** Levanta una marca (queda anotado quién y cuándo; no se borra). p = {id, nota?} */
function levantarMarcaEstudiante(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email, id = String((p && p.id) || '');
  var sh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), v = sh.getDataRange().getValues(), c = {};
  v[0].forEach(function (k, i) { c[k] = i; });
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][c.id]) !== id) continue;
    if (v[i][c.estado] !== 'Vigente') throw new Error('Esa marca ya estaba levantada.');
    sh.getRange(i + 1, c.estado + 1).setValue('Levantada');
    sh.getRange(i + 1, c.levantada_por + 1).setValue(por);
    sh.getRange(i + 1, c.fecha_levantada + 1).setValue(ahoraTxt_());
    return { ok: true };
  }
  throw new Error('No se encontró la marca.');
}

function textoMarca_(id) { return TIPOS_MARCA_EST.filter(function (t) { return t.id === id; })[0].texto; }
function ponMarcaEst_(sh, e, tipoId, nota, por) {
  sh.appendRow([Utilities.getUuid(), claveEst_(e.g, e.a, e.n), e.g, e.curso, e.a, e.n, textoMarca_(tipoId), String(nota || '').slice(0, 300), por, ahoraTxt_(), 'Vigente', '', '']);
}

/** Agrega a un estudiante que no aparece en el listado (llegó nuevo, o se omitió): al final del grupo, con la marca «nuevo» o «no aparecía en el listado». p = {g, a, n, nota?, motivo?: 'NUEVO'|'NO_LISTADO'} */
function agregarEstudiante(p) {
  var quien = exigirDirectivo_();
  return agregarEstudiante_(p, quien.nombre || quien.email);
}
/** Agrega al listado (también lo usan los directores de grupo desde las comisiones, con sus propios permisos). */
function agregarEstudiante_(p, por) {
  p = p || {};
  var g = codGrupoEst_(p.g), a = String(p.a || '').trim().replace(/\s+/g, ' ').toUpperCase(), n = String(p.n || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!a || !n) throw new Error('Escriba apellidos y nombres.');
  var lista = listadoEstudiantes_();
  if (!lista) throw new Error('Primero cargue el listado de estudiantes (hoja Estudiantes).');
  var delGrupo = lista.filter(function (e) { return e.g === g; });
  if (!delGrupo.length) throw new Error('Elija un grupo de la lista.');
  if (lista.some(function (e) { return claveEst_(e.g, e.a, e.n) === claveEst_(g, a, n); })) throw new Error('Ese estudiante ya está en el grupo.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var no = delGrupo.reduce(function (m, e) { return Math.max(m, e.no); }, 0) + 1, curso = delGrupo[0].curso;
    hoja_('Estudiantes').appendRow([txtForzado_(g), curso, no, a, n]);
    ponMarcaEst_(hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), { g: g, curso: curso, a: a, n: n }, p.motivo === 'NO_LISTADO' ? 'NO_LISTADO' : 'NUEVO', (p.nota ? p.nota + ' · ' : '') + (p.motivo === 'NO_LISTADO' ? 'Agregado el ' : 'Ingresó el ') + ymd_(new Date()), por);
    return { ok: true, no: no };
  } finally { lock.releaseLock(); }
}

/** Pasa a un estudiante a otro grupo (p. ej. promovido al siguiente grado). Conserva sus marcas vigentes y deja la marca «promovido» con el detalle. p = {g, a, n, destino, nota?} */
function moverEstudiante(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var lista = listadoEstudiantes_();
  if (!lista) throw new Error('No hay listado de estudiantes.');
  var k = claveEst_(p.g, p.a, p.n), destino = codGrupoEst_(p.destino);
  var orig = lista.filter(function (e) { return claveEst_(e.g, e.a, e.n) === k; })[0];
  if (!orig) throw new Error('No se encontró al estudiante.');
  var delDestino = lista.filter(function (e) { return e.g === destino; });
  if (!delDestino.length) throw new Error('Elija el grupo de destino.');
  if (destino === orig.g) throw new Error('El grupo de destino es el mismo.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hoja_('Estudiantes'), v = sh.getDataRange().getValues(), c = {}, fila = -1;
    v[0].forEach(function (x, i) { c[x] = i; });
    for (var i = 1; i < v.length; i++) if (claveEst_(v[i][c.grupo], v[i][c.apellidos], v[i][c.nombres]) === k) { fila = i; break; }
    if (fila < 0) throw new Error('No se encontró al estudiante.');
    var no = delDestino.reduce(function (m, e) { return Math.max(m, e.no); }, 0) + 1, curso = delDestino[0].curso;
    sh.getRange(fila + 1, c.grupo + 1).setValue(txtForzado_(destino));
    sh.getRange(fila + 1, c.curso + 1).setValue(curso);
    sh.getRange(fila + 1, c.no + 1).setValue(no);
    var mh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), mv = mh.getDataRange().getValues(), mc = {}, nk = claveEst_(destino, orig.a, orig.n);
    mv[0].forEach(function (x, i) { mc[x] = i; });
    for (var j = 1; j < mv.length; j++) if (mv[j][mc.clave] === k && mv[j][mc.estado] === 'Vigente') {   // las marcas vigentes lo siguen al nuevo grupo
      mh.getRange(j + 1, mc.clave + 1).setValue(nk); mh.getRange(j + 1, mc.grupo + 1).setValue(txtForzado_(destino)); mh.getRange(j + 1, mc.curso + 1).setValue(curso);
    }
    ponMarcaEst_(mh, { g: destino, curso: curso, a: orig.a, n: orig.n }, 'PROMOVIDO', 'De ' + orig.curso + ' a ' + curso + (p.nota ? ' · ' + p.nota : '') + ' (' + ymd_(new Date()) + ')', por);
    return { ok: true, curso: curso, no: no };
  } finally { lock.releaseLock(); }
}

/** Levanta varias marcas a la vez (queda anotado quién y cuándo). p = {ids:[...]} */
function levantarMarcasEstudiante(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email, ids = {};
  ((p && p.ids) || []).forEach(function (i) { ids[String(i)] = 1; });
  if (!Object.keys(ids).length) throw new Error('Elija al menos una marca.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), v = sh.getDataRange().getValues(), c = {}, n = 0, ahora = ahoraTxt_();
    v[0].forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) {
      if (!ids[String(v[i][c.id])] || v[i][c.estado] !== 'Vigente') continue;
      sh.getRange(i + 1, c.estado + 1).setValue('Levantada'); sh.getRange(i + 1, c.levantada_por + 1).setValue(por); sh.getRange(i + 1, c.fecha_levantada + 1).setValue(ahora); n++;
    }
    if (!n) throw new Error('Esas marcas ya estaban levantadas.');
    return { levantadas: n };
  } finally { lock.releaseLock(); }
}

// ===================== Leeme.gs =====================
/**
 * Hoja LEEME del libro: título grande, versión vigente, qué contiene cada hoja e historial de cambios.
 * Se regenera sola al abrir el libro si la versión escrita en LEEME no es la de este código, o desde el menú
 * «Actualizar hoja LEEME». REGLA: cada vez que se cambie la versión (sello en el pie de las pantallas), actualizar
 * VERSION_SISTEMA e HISTORIAL_VERSIONES aquí (la prueba leeme.test.js lo verifica).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var VERSION_SISTEMA = '2026.11.25-k';
var FECHA_VERSION = '2026-11-25';

/** De la más nueva a la más antigua. */
var HISTORIAL_VERSIONES = [
  { version: '2026.11.25-k', fecha: '2026-11-25', cambios: [
    'Comisiones: los docentes que alternan por semana ya aparecen como complemento en cada grupo. Sociales e Inglés: Quintero (inglés) con Ortiz (sociales) en 7.º, 8.º y Caminar 2; Pulgarín (sociales) con Betancourth (inglés) en 9.º a 11.º. Ética y Religión: Castillo (religión) con Casanova (ética) en Caminar 1-2, 7.º, 8.º y Caminar 2; Estacio (religión) con Montaño (ética) en 9.º a 11.º. Ciencias Naturales: Lemos y Villota en 9.º a 11.º y Caminar 2. Lozano y García Gobea atienden solas de 6.º a Caminar 1-1.'
  ] },
  { version: '2026.11.25-j', fecha: '2026-11-25', cambios: [
    'Comisiones: el SIEE aprueba de 3,0 a 5,0; por criterio del rector en la plataforma, de 2,91 a 3,0 se redondea a 3,0, así que en la práctica reprueba el área quien queda por debajo de 2,91 (la pantalla de Áreas lo explica). Los docentes de los énfasis (6.º y 7.º en pareja; 8.º a 11.º en equipo) ya entran al equipo del acta y a las áreas que dictan (por ejemplo, Ciencias Naturales con Miriam Lemos y Héctor Villota). En excelencia y rendimiento académico el promedio admite hasta 3 decimales. El acta abre más rápido: el listado del grado y el acta se piden a la vez.'
  ] },
  { version: '2026.11.25-i', fecha: '2026-11-25', cambios: [
    'Comisiones: en la matrícula, inicial, nuevos, retirados y no asisten se ven como texto simple (sin cuadros ni giradores) y la matrícula final se destaca con recuadro y letra grande. Reprobación rediseñada: cada estudiante en una línea con el número de áreas reprobadas, su inasistencia y el veredicto (1 o 2 áreas: se promueve con áreas pendientes; más de 2: no se promueve, reprueba el grado, con recuadro rojo); cada área en su propia línea con sus causas (sin notas) y ✕ para quitarla, lo que se actualiza solo en Áreas. En Reprobación, Reconocimientos, Convivencia, Compromisos y PIAR ya no aparecen quienes no asisten o se retiraron (al marcarlos se les vacían áreas, causas y reconocimientos). Promoción: nombres en una sola línea; en 11.º, quien pierde un área no participa en la ceremonia de graduación y quien reprueba más de 2 no se gradúa. Se corrige que el tipo de algunos reconocimientos no apareciera (nombres antiguos en mayúscula). Colores más suaves en los semáforos de porcentajes, los DBA y los botones de agregar.',
    'Nuevo: «PDF de reconocimientos» (coordinación y directivos, todos los grupos; cada docente, los grupos que atiende; también en el informe del menú). Nuevo: «Nueva acta · archivar · recuperar» (bajo el selector de período): archivar el acta y empezar una nueva, borrarla y empezar en blanco, o recuperar un acta archivada o borrada; nada se pierde.'
  ] },
  { version: '2026.11.25-h', fecha: '2026-11-25', cambios: [
    'Comisiones: «Total actual» y «Listado actual» pasan a llamarse «Matrícula final». El resumen de los listados muestra por separado los retirados y los que no asisten (ya no «deshabilitados») y la tabla de cursos trae una columna «No asisten». En la matrícula, inicial, nuevos, retirados y no asisten son de solo lectura (salen de los listados); hombres, mujeres, venezolanos y ecuatorianos parten de lo marcado en el listado y se pueden ajustar; si la matrícula dice más venezolanos o ecuatorianos de los marcados queda un pendiente que lleva al listado.'
  ] },
  { version: '2026.11.25-g', fecha: '2026-11-25', cambios: [
    'Nuevo en el menú de directivos: «Informe de reconocimientos (Excel)»: todos los estudiantes con reconocimiento o mérito del período, con tipo y número de documento, sexo, lugar de expedición, nacionalidad, promedio, puesto y qué datos faltan; agrupados por tipo (excelencia, rendimiento académico, convivencia y los demás), luego por curso (de preescolar a 11.º) y en orden alfabético por apellidos. Se descarga para Excel (.csv) o se crea como hoja de Google en «App Asistencia / Informes».',
    'Revisión general: manuales actualizados (sistema y comisiones) y comprobación de todas las funciones.'
  ] },
  { version: '2026.11.25-f', fecha: '2026-11-25', cambios: [
    'Comisiones, listados: el tipo de documento se sugiere como «TI · Tarjeta de identidad» cuando está vacío (casilla amarilla «sugerido») y el docente lo confirma con «Confirmar sexo y documento del curso» o lo cambia (RC, TI, CC, cédula de extranjería, pasaporte, PEP, PPT o permiso de la Secretaría de Educación), igual que el sexo y la nacionalidad (Colombiana por defecto). En Reprobación se avisa que cada estudiante agregado con sus áreas se cuenta solo en los reprobados de esas áreas.'
  ] },
  { version: '2026.11.25-e', fecha: '2026-11-25', cambios: [
    'Comisiones: el botón «Retiró…» pasa a llamarse «Retirado…». En la promoción, dentro de cada curso los estudiantes van en orden alfabético por apellido: primero quienes se promueven, luego (franja amarilla) quienes pasan con áreas pendientes y al final (franja rosada) quienes no se promueven; quienes no asisten o están retirados no aparecen.'
  ] },
  { version: '2026.11.25-d', fecha: '2026-11-25', cambios: [
    'Comisiones, listados: cada director de grupo debe actualizar o CONFIRMAR el sexo de los estudiantes de su curso («Confirmar sexo del curso»); sin eso no puede confirmar su revisión de listados ni cerrar el acta. Para los estudiantes con reconocimiento, el tipo y número de documento y el sexo son obligatorios; para los demás no (en Datos faltantes aparece el resumen por curso). Los datos de los docentes (correo personal, celular y cédula) siguen siendo obligatorios para guardar y cerrar. Cada pocos minutos, y al cambiar de paso, un globo recuerda a cada persona lo que le falta, con el botón «Ver pendientes».',
    'Menú de directivos: «Estudiantes y docentes: traslados y cambios masivos» (trasladar varios estudiantes, cambiar un dato a varios estudiantes o docentes e importar datos desde otro libro de Hojas de cálculo con vista previa). Coordinación y el desarrollador aplican en la hoja; los demás solo solicitan traslados. Todo queda en Bitacora_Cambios.',
    'Nuevo: «Manuales en PDF» en el menú (manual del sistema y manual de comisiones, para abrir o descargar). Copia de revisión: al entrar coordinación o el desarrollador se hace una copia del libro en «App Asistencia / Respaldos / Revisiones» (como mucho cada 6 horas, conserva las últimas 6). Compatibilidad con Safari: se protegió la lectura del almacenamiento local.'
  ] },
  { version: '2026.11.25-b', fecha: '2026-11-25', cambios: [
    'Comisiones, modo de trabajo: por defecto una sola persona edita a la vez en cada acta. Coordinación o el desarrollador pueden activar el TRABAJO EN EQUIPO (botón bajo el selector de período): cada docente edita solo lo suyo; el director de grupo, los datos y confirmaciones de su curso; el docente de área, sus áreas; y quien dirige un curso pero no dicta en el grado, solo su curso. Lo demás lo ve. Los datos generales y la asistencia siguen con quien tiene el turno. El servidor verifica el alcance de cada guardado.',
    'Seguimiento de las comisiones (menú de directivos): arriba las 4 con cambios más recientes y las que ya llevan un avance importante (40 % o más); las demás en una tabla compacta por fecha o por avance.'
  ] },
  { version: '2026.11.25-a', fecha: '2026-11-25', cambios: [
    'La aplicación pasa a llamarse «Control de Procesos ICET» y el menú de inicio muestra la versión en grande. DESDE AHORA LA VERSIÓN SE CAMBIA SOLO EN Leeme.gs: las pantallas la reciben del código (ya no hay que tocar los .html para subir de versión; solo cambian los .html cuando cambia su contenido).',
    'Comisiones, traslados: en los listados, «🔀 Trasladar estudiante…» busca a un estudiante de cualquier curso o grado y lo pasa al curso elegido (cambia grupo y curso en la hoja Estudiantes y queda en Bitacora_Cambios). Coordinación o el desarrollador lo aplican de inmediato; los demás envían una solicitud con justificación (mín. 10 caracteres) que queda en la hoja Traslados_Estudiantes y se avisa por correo a coordinación; «📋 Traslados» muestra el estado y coordinación aprueba o rechaza.',
    'Botones con color propio: «Guardar borrador» (verde), «Descargar copia» (morado), «Trasladar» (naranja) y «No asiste…» (ámbar).'
  ] },
  { version: '2026.11.24-k', fecha: '2026-11-24', cambios: [
    'Comisiones: corrige estudiantes repetidos en los listados. Lo guardado de cada estudiante se unía al número de fila de la hoja Estudiantes; si se insertaban o cambiaban filas, el nombre guardado se copiaba a otra persona. Ahora se une por nombre (y se descarta lo guardado que ya no corresponde). Los botones «No asiste…» y «+ Agregar estudiante» pasan a una barra propia bajo el encabezado del curso (sin flotar ni parpadear al cambiar el tamaño de la ventana) y el aviso de más columnas es una sombra en el borde, sin código que parpadee.'
  ] },
  { version: '2026.11.24-j', fecha: '2026-11-24', cambios: [
    'Comisiones, listados: se quitó la columna de botones de cada estudiante (quedaba fuera de la pantalla). Ahora «No asiste…» y «+ Agregar estudiante» están junto al encabezado de cada curso («No asiste…» permite marcar o revertir a varios a la vez) y para modificar los datos de un estudiante se pulsa su nombre. Las tablas que se salen del ancho muestran una sombra en el borde y el aviso «Hay más columnas a la derecha». El selector de sexo es más angosto.'
  ] },
  { version: '2026.11.24-i', fecha: '2026-11-24', cambios: [
    'URGENTE (comisiones): el acta tardaba mucho en cargar (se quedaba en «Cargando el acta…»). Al abrir el grado el servidor releía las mismas hojas decenas de veces (identidades, docentes, claves, directivos). Ahora cada hoja se lee una sola vez por solicitud: de 97 a 28 lecturas en el acta de 9.º con los datos reales. Incluye la corrección de la versión -h.'
  ] },
  { version: '2026.11.24-h', fecha: '2026-11-24', cambios: [
    'URGENTE (comisiones): corrige una lentitud introducida en las versiones -d a -g: al abrir un acta el servidor leía la hoja de parámetros una vez por cada fila del horario, y el acta podía tardar minutos o no cargar (el avance guardado no se perdía). Ahora la integración de Caminar se calcula una sola vez por solicitud.'
  ] },
  { version: '2026.11.24-g', fecha: '2026-11-24', cambios: [
    'Comisiones: el primer grado que abre un acta con Caminar en Secundaria en un período «lo toma»: el otro grado ya no lo recibe en ese período y la coordinación no puede moverlo mientras no haya acuerdo (el acta de 9.º que ya empezó con CS 2 la conserva). La ventana «Cambiar integración» avisa qué ya está tomado.'
  ] },
  { version: '2026.11.24-f', fecha: '2026-11-24', cambios: [
    'Comisiones: los docentes que alternan cada semana con quien figura en el Horario ahora aparecen en el equipo del acta. Primer caso: María del Carmen Quintero (Sociales/Inglés, alterna con Adiela Ortiz) en 8.º (grupos 0801 y 0802). Otros casos se agregan en el parámetro comisiones_alternan.'
  ] },
  { version: '2026.11.24-e', fecha: '2026-11-24', cambios: [
    'Comisiones: por defecto, en todos los períodos, Caminar en Secundaria 1 se integra con 6.º y Caminar en Secundaria 2 con 8.º. Coordinación o el desarrollador pueden cambiarlo por período (CS 1 con 6.º o 7.º; CS 2 con 8.º o 9.º) con «Cambiar integración».'
  ] },
  { version: '2026.11.24-d', fecha: '2026-11-24', cambios: [
    'Comisiones: Caminar en Secundaria se une por período: en los períodos 1 y 2, CS 1 va con 6.º y CS 2 con 8.º; en el período 3 y final, CS 1 va con 7.º y CS 2 con 9.º. En los listados, el botón «No asiste» inhibe al estudiante (queda opaco, no sale de la lista, no se promueve ni se reprueba y se descuenta de la matrícula); «Retirados» queda solo para quien se fue a otra institución, cambió de domicilio o canceló la matrícula. Los listados tienen columna Sexo editable. En promoción se ven todos los del listado inicial y los reprobados traen sus causas. La matrícula no se bloquea hasta confirmar la promoción del curso. En reconocimientos y reprobación se pueden agregar varios estudiantes a la vez; en Áreas, el botón «Seleccionar» elige los reprobados de cada área y curso. Excelencia y rendimiento académico inician con promedio 4,6 resaltado hasta confirmarlo. Con el acta cerrada solo coordinación académica o el desarrollador pueden seguir modificándola.'
  ] },
  { version: '2026.11.24-b', fecha: '2026-11-24', cambios: [
    'IMPORTANTE (comisiones): Hojas de cálculo guardaba el grado «05» como el número 5 y por eso, al volver a abrir el grado, se creaba un acta nueva y vacía cada vez (los datos quedaban repartidos en varias actas). Ahora el código de grado se guarda como texto y se lee siempre de dos cifras; si hay varias actas del mismo grado y periodo se abre la que más trabajo tiene. Menú nuevo «Comisiones: unificar actas duplicadas» (oculta las vacías, no borra nada) y «Comisiones: ver qué hay guardado (y en qué hoja)». Las actas abiertas antes bajo CS 1 o CS 2 pasan a 7.º y 9.º. Estudiantes: «Retirar» pasa a «Deshabilitar» (siguen en el listado, cuentan en la matrícula como retirados o no asistentes y no entran en la promoción).'] },
  { version: '2026.11.24-a', fecha: '2026-11-24', cambios: [
    'Comisiones: Caminar en Secundaria 1 se trabaja con el acta de 7.º y Caminar en Secundaria 2 con la de 9.º (ya no aparecen como grados aparte). «Juramento» pasa a llamarse «acuerdo y compromiso de transparencia». En la matrícula, «desertados» pasa a «no asistentes»: quien no asistió queda inhabilitado pero sigue en el listado y no entra en la promoción; «retirados» son quienes se van a otro domicilio o institución.'] },
  { version: '2026.11.23-u', fecha: '2026-11-23', cambios: [
    'Comisiones: los pendientes se actualizan al instante con el avance del equipo y la confirmación del cierre; al guardar y cerrar el acta se lleva al imprimible. El teléfono del acudiente ya no es obligatorio (pendientes de datos solo para estudiantes reconocidos y sin teléfono, como recordatorio). El correo institucional (@icet.edu.co) no se toma como correo personal: cada docente registra uno personal. Matrícula: el total actual empieza en mujeres y al subir los hombres bajan las mujeres.'] },
  { version: '2026.11.23-t', fecha: '2026-11-23', cambios: [
    'Comisiones: los reconocimientos distintos a excelencia y rendimiento académico (convivencia, colaboración y buen porte, otros) ya no exigen promedio. Al empezar, junto al lugar hay una casilla corta opcional para el detalle (n.º de aula o salón, área…); se ve en «Redactando ahora» y en el seguimiento de los directivos.'] },
  { version: '2026.11.23-s', fecha: '2026-11-23', cambios: [
    'Comisiones: «Guardar borrador» guarda una copia de todo el avance y, al volver o recargar, aparece «Recuperar borrador» (se mezcla con lo que haya en el libro). Datos faltantes de docentes y acompañantes: solo se piden los marcados como participantes en la asistencia.'] },
  { version: '2026.11.23-r', fecha: '2026-11-23', cambios: [
    'Comisiones, matrícula: hombres + mujeres siempre suman el total actual (si sube una casilla baja la otra); por defecto todos figuran como hombres, o lo que traigan las hojas si ya tienen sexo. Datos de directivos, orientadora y tutora (cédula, celular, correo) se traen de la hoja Identidad_Docentes. Sin conexión: si ya abrió el acta antes, se abre con la última copia guardada en este equipo y lo que escriba se envía al volver la conexión. «Guardar borrador» guarda en el libro y en el equipo y recuerda dónde estaba.'] },
  { version: '2026.11.23-q', fecha: '2026-11-23', cambios: [
    'Comisiones: botón «Completar o modificar» en los pendientes y en reconocimientos (documento, tipo, lugar de expedición, sexo, nacionalidad…). Historial de una semana (hojas Comision_Historial y Comision_CambiosHojas): versiones anteriores de cada parte del acta y cada cambio hecho en las hojas con su valor anterior; coordinación, directivos y quienes tengan control total pueden restaurar (botón «Historial y recuperación»), y coordinación deshace cambios en las hojas. Copias diarias completas del libro: ahora 8 días por defecto. Corregido: el servidor enviaba a la pantalla los estudiantes de todos los grados (ahora solo los del grado abierto).'] },
  { version: '2026.11.23-p', fecha: '2026-11-23', cambios: [
    'Comisiones, datos faltantes: los directivos, la orientadora y la tutora aparecen de nuevo en la tabla de docentes para actualizar cédula, correo y celular (sin ser obligatorio); la cédula también se escribe en Identidad_Docentes si ese campo estaba vacío.'] },
  { version: '2026.11.23-o', fecha: '2026-11-23', cambios: [
    'Comisiones: los directivos, la orientadora y la tutora que acompañan ya no figuran como participantes por defecto ni tienen que declarar, confirmar revisión ni firmar; declaran y confirman todos los docentes del grado (de grupo y de área), y cada casilla se desactiva al marcarse (solo coordinación la habilita de nuevo). Nacionalidad por defecto Colombiana (Venezolana/Ecuatoriana/Otra en lista desplegable, no obligatoria). En «Datos faltantes» y en «Listados» se pueden completar o modificar documento, tipo, lugar de expedición, sexo y nacionalidad, y quedan también en la hoja Estudiantes. El imprimible ya no se bloquea por datos faltantes y los datos de estudiantes pendientes son advertencia, no impiden cerrar.'] },
  { version: '2026.11.23-n', fecha: '2026-11-23', cambios: [
    'Comisiones: respaldo local en el navegador (si se pierde la conexión o se recarga, se recuperan los cambios que no habían llegado al libro y se vuelve al último paso); la declaración bajo juramento se marca docente por docente (grupo y área); la nacionalidad colombiana se deduce del tipo de documento (RC, TI, NUIP, CC) y el teléfono del acudiente se lee de la columna tel_acudiente de la hoja Estudiantes.'] },
  { version: '2026.11.23-m', fecha: '2026-11-23', cambios: [
    'Comisiones, listados: aviso de diagnóstico sobre las columnas documento y tipo_doc de la hoja Estudiantes (si las encontró y a cuántos estudiantes les leyó el número); los números guardados como número o como texto se leen igual.'] },
  { version: '2026.11.23-l', fecha: '2026-11-23', cambios: [
    'Comisiones, listados: tipo y número de documento por estudiante; botones Modificar y Retirar por estudiante y + Agregar en el encabezado de cada curso; todos los docentes del grado aparecen en la revisión de listados y se marcan uno a uno. Cierre: resumen de pendientes, luego Finalizar y guardar, y al final las firmas; quien firma ya no redacta más. Errores pasajeros de Google («INTERNAL») ya no muestran el aviso rojo hasta fallar tres veces seguidas. Documento, tipo, celular y datos modificados se escriben también en la hoja Estudiantes.'] },
  { version: '2026.11.23-k', fecha: '2026-11-23', cambios: [
    'Permisos de las comisiones: coordinación puede dar «control total» a personas concretas (editan siempre, sin esperar el turno ni depender de los permisos de su nivel).'] },
  { version: '2026.11.23-j', fecha: '2026-11-23', cambios: [
    'Comisiones: corregido el bloqueo de controles (la pantalla se redibujaba unas 15 veces por segundo y los clics se perdían; afectaba sobre todo a los grados con muchos estudiantes). Lo que se completa en el acta se escribe también en las hojas: celular y correo personal de los docentes en Identidad_Docentes (columnas celular y correo_personal) y teléfono del acudiente y gestión en Estudiantes (columnas tel_acudiente y gestion_acta).'] },
  { version: '2026.11.23-i', fecha: '2026-11-23', cambios: [
    'Comisiones: turno de edición (todos pueden editar pero una sola persona a la vez; se suelta, se pasa o se toma tras 15 min sin actividad; coordinación y directivos siempre). Menú «Permisos de las comisiones»: coordinación elige por nivel quién puede ver y quién editar. Fecha y hora actuales por defecto. Celular y correo institucional de los docentes desde la hoja Identidad_Docentes (columnas celular y correo_institucional).'] },
  { version: '2026.11.23-h', fecha: '2026-11-23', cambios: [
    'Comisiones: la barra superior muestra la versión de la pantalla y la del servidor para comprobar que ambas quedaron actualizadas.'] },
  { version: '2026.11.23-g', fecha: '2026-11-23', cambios: [
    'Comisiones: las columnas de documento, tipo de documento y sexo de la hoja Estudiantes se leen sin importar mayúsculas, tildes, espacios ni guiones del encabezado (Documento, Tipo_Doc, tipo doc…).'] },
  { version: '2026.11.23-f', fecha: '2026-11-23', cambios: [
    'Comisiones: la pantalla compara su versión con la del servidor y avisa si el código de Apps Script quedó desactualizado (por eso podían verse controles que no guardan); los errores al guardar se muestran en pantalla.'] },
  { version: '2026.11.23-e', fecha: '2026-11-23', cambios: [
    'Comisiones: acceso total para docentes, orientación, tutora PTAFI y directivos (una sola persona puede hacer todo el ejercicio); se confirman uno a uno los documentos previos; fecha y hora con calendario y reloj; botones «Volver al menú» y «Cerrar sesión»; documento de identidad y tipo tomados de la hoja Estudiantes (columnas documento, tipo_doc y sexo opcionales); modo ejemplo para el desarrollador (no guarda nada).'] },
  { version: '2026.11.23-d', fecha: '2026-11-23', cambios: [
    'Comisiones: la fecha y la hora del acta se eligen con calendario y reloj (las edita el responsable o coordinación).'] },
  { version: '2026.11.23-c', fecha: '2026-11-23', cambios: [
    'Corrección: al abrir el acta de comisiones salía «Cannot read properties of null» porque las fechas de las hojas llegaban como objeto Date y Apps Script devolvía vacío; ahora se convierten a texto.'] },
  { version: '2026.11.23-b', fecha: '2026-11-23', cambios: [
    'Comisiones de evaluación y promoción: pantalla real (?p=comisiones) con botón en el menú de docentes y directivos. Cada docente entra a su grado y periodo; el acta se guarda por secciones en el libro (Comision_Actas, Comision_Secciones, Comision_Log) y varias personas trabajan a la vez con refresco automático. Roles: responsable del registro (primera persona), director/a de grupo, docente de área, editor del acta (etiqueta) y coordinación.',
    'Al abrir, cada persona dice dónde está y desde qué hora. Los directivos tienen «Seguimiento de las comisiones»: avance, quién redacta y dónde, quién acompaña (directivos, orientación, tutora PTAFI) y avisos cada vez que alguien avanza y cada media hora.',
    'Menú de coordinación «Docentes: agregar o editar datos» (nuevos docentes, cédula y correo con validación). Correo del docente con máscara y corrección de errores comunes (gmial.com, hotmial.com…).'] },
  { version: '2026.11.23-a', fecha: '2026-11-23', cambios: [
    'Ingreso de docentes: «Soy docente» → grado que atiende → nombre (solo los docentes de ese grado, más orientación y tutoría) → correo de contacto (cualquier proveedor) y clave. La primera vez la clave es la cédula (hoja Identidad_Docentes) y se elige una propia de 6 a 12 números. Coordinación restablece desde el menú «Docentes: restablecer la clave de un docente». El docente no ve rondas ni nada de directivos.',
    'Menú nuevo «Comisiones: prueba de funcionamiento»: guarda, lee, provoca un conflicto y borra un acta de prueba del año 2099 para comprobar que todo guarda sin errores.'] },
  { version: '2026.11.22-i', fecha: '2026-11-22', cambios: [
    'Ingreso: si la clave es correcta pero el navegador no puede guardar la sesión, o el servidor no abre la sesión, ahora la pantalla lo dice con el motivo (antes volvía al ingreso sin explicar nada).'] },
  { version: '2026.11.22-h', fecha: '2026-11-22', cambios: [
    'Comisiones (servidor): un estudiante no puede repetirse en la misma lista (reprobación, convivencia, compromisos, PIAR, reconocimientos); el servidor lo rechaza con un aviso. El acta impresa lleva solo la firma al finalizar, con la cédula y el celular o correo de cada integrante.'] },
  { version: '2026.11.22-g', fecha: '2026-11-22', cambios: [
    'Ingreso: los directivos se muestran con nombre completo y apellidos primero, como los docentes (Cortés Cabezas Francisco Javier, Barreiro Caicedo Carmen Verónica, Angulo Merchancano Harold Wilson, Hernández Cortés Jorge Enrique). La clave interna no cambia; opcionalmente se puede escribir el nombre en una columna «nombre_completo» de la hoja Directivos.',
    'Comisiones (servidor): la primera persona docente que abre el acta queda como responsable del registro y del cierre (se puede cambiar).'] },
  { version: '2026.11.22-f', fecha: '2026-11-22', cambios: [
    'Comisiones (servidor): el Horario del libro usa códigos de área (MAT, CAS, CNA, CSI, ETR, ART, ERD, TEI); ahora se traducen a las áreas del acta, de modo que cada docente de secundaria y media puede registrar las áreas que dicta (antes quedaban bloqueadas). Las áreas y los cursos se toman por el nombre del docente en el Horario y en Dirección de grupo, no por ser «Docente 1» o «Docente 2», así que los intercambios de horario (Arte y Educación Física) ya quedan reflejados.'] },
  { version: '2026.11.22-e', fecha: '2026-11-22', cambios: [
    'Comisiones (servidor): el director o directora de grupo puede AGREGAR a un estudiante que falta en la lista (con los datos esenciales, sin inventarlos: lo que no se tiene queda pendiente) y RETIRAR a quien ya no vino o nunca vino (retirado, desertado o nunca asistió). Queda registrado quién y por qué, se ajusta la matrícula del curso (nuevos, retirados o desertados) y la promoción vuelve a pedir confirmación. Con la matrícula confirmada solo coordinación académica puede reabrir para hacer estos cambios.',
    'Agregar estudiantes ahora también puede hacerlo el director de grupo desde las comisiones (con sus propios permisos); el módulo de estudiantes de los directivos sigue igual.'] },
  { version: '2026.11.22-d', fecha: '2026-11-22', cambios: [
    'Comisiones (servidor): validación de TODOS los componentes y informe de pendientes. Cada componente (reprobación o deserción e inasistencia, reconocimientos, convivencia, compromisos, PIAR, áreas o propósitos) debe tener registros o la declaración «no hubo casos»; cada área o propósito, su recomendación; matrícula, reconocimientos y promoción confirmados; datos de docentes y estudiantes completos; firmas. Si falta algo no se puede cerrar y el informe dice qué falta, de quién y dónde pedirlo (rectoría, archivo o coordinador). Preescolar con reglas propias (sin promoción ni reprobación; propósitos, experiencias y deserción e inasistencia).',
    'El PDF siempre queda: al cerrar el acta se guarda una copia legible en la carpeta del acta en Drive aunque falle lo demás, y hay una función para guardar el PDF del acta desde el servidor como respaldo (el principal sale de la impresión del navegador).'] },
  { version: '2026.11.22-c', fecha: '2026-11-22', cambios: [
    'La carpeta única de la aplicación es ahora la que ya existe en el Drive del propietario, «APP ASISTENCIA DOCENTE» (se conserva su mismo enlace; el sistema la busca por nombre o por el id fijado en Parametros: carpeta_app_id). Ya no se crea una carpeta nueva llamada «App Asistencia». Dentro: Respaldos, Libros, soportes de ausencias y audios, y las comisiones en COMISIONES año / Comisiones Evaluación P1 ICET año / Grado X (Anexos y Borradores), junto a las actas anteriores que ya están allí.'] },
  { version: '2026.11.22-b', fecha: '2026-11-22', cambios: [
    'Todo en una sola carpeta de Drive, «App Asistencia»: respaldos (Respaldos), soportes de ausencias y audios (la carpeta de soportes ahora nace dentro de ella), y en las comisiones: Comisiones / año / Grado / Acta N periodo / Anexos (PIAR, formato de DUA, compromisos) y / Borradores (copia legible del acta). Cada noche, junto con la copia de los libros, se guarda una copia de todas las actas del año.',
    'Nuevo menú «Reunir todo en la carpeta «App Asistencia» (una vez)»: MUEVE (no copia) a esa carpeta lo que haya quedado suelto en Drive: la carpeta de soportes y audios y los libros del sistema. No se pierde ningún enlace ni permiso.'] },
  { version: '2026.11.22-a', fecha: '2026-11-22', cambios: [
    'Comisiones de evaluación y promoción, SERVIDOR (fase 1; la pantalla llega en la fase 2): hojas Comision_Actas, Comision_Secciones y Comision_Log (se crean solas). Un acta por grado y periodo, con número consecutivo del año (si el tercer periodo no se presenta, el acta final es la número 3). Cada docente guarda solo su sección (su curso o su área, con codirectores) y, si dos personas tocan lo mismo, se avisa del conflicto sin pisar nada.',
    'Matrícula y reconocimientos se confirman por curso y quedan oficiales: el docente no los modifica; solo coordinación académica los reabre, con justificación escrita que queda en Comision_Log. La matrícula debe cuadrar; en el acta final, promovidos + no promovidos = matrícula actual. El cierre lo propone el responsable y lo confirman todos los integrantes (también desde el equipo de otro compañero); la hora de cierre la pone el sistema. Evidencias opcionales (PIAR, formato de DUA, compromisos) en Drive: App Asistencia / Soportes / Comisiones.'] },
  { version: '2026.11.12-a', fecha: '2026-11-12', cambios: [
    'Reuniones y actividades: nuevo botón «🔒 Dar por terminada» (en la tarjeta, en la asistencia y en el resumen al guardar) para cerrarlas aunque no haya llegado su hora de fin: dejan de salir en el aviso del día y liberan el horario de la ronda desde la hora de cierre. «🔓 Reabrir» las vuelve a activar. Solo se cierran las de hoy o anteriores; queda en la bitácora. Nuevas columnas en la hoja Reuniones: cerrada, cierre_hora.',
    'Aviso del día: ahora aparece compacto (una línea, arriba) para no tapar el bloque ni los botones de la ronda; al tocarlo se abre el detalle completo con barra de desplazamiento y ya no se cierra solo (se cierra con la ✕). Antes el aviso grande tapaba el recuadro del bloque y no dejaba cambiarlo.'] },
  { version: '2026.11.10-a', fecha: '2026-11-10', cambios: [
    'El escudo del colegio, en el encabezado de cualquier pantalla (ronda, novedades, reuniones, horarios y panel), lleva al menú principal. El panel además muestra siempre el botón «« Menú» (antes solo aparecía si cargaba el enlace).',
    'Novedades: la lista «Últimas novedades registradas» ahora tiene barra de desplazamiento y carga las anteriores por páginas (25 cada vez, al llegar al final o con «⬇ Ver anteriores») hasta la primera registrada.',
    'Reuniones: «Próximas reuniones» y «Últimas reuniones» también tienen barra de desplazamiento y cargan más por páginas (15 cada vez). Para no hacer lenta la aplicación solo se leen las filas necesarias, y la asistencia de reuniones se lee una sola vez para toda la lista.'] },
  { version: '2026.11.09-i', fecha: '2026-11-09', cambios: [
    'Manual: nueva cartilla de uso en PDF (docs/Manual_ICET_Asistencia_Docente.pdf, 15 páginas: ruta rápida por rol, la ronda en 7 pasos con dibujos de la pantalla, qué marcar en cada caso, novedades, reuniones, panel, problemas frecuentes y capítulo para quien administra). El manual dentro de la aplicación (Ayuda) suma el capítulo 17 «Para quien administra».'] },
  { version: '2026.11.09-h', fecha: '2026-11-09', cambios: [
    'Reuniones, actividades y novedades: lo que se registre queda a nombre de quien abrió la sesión (se muestra «Registra: …» y ya no se elige ni se recuerda otro nombre en esas pantallas).',
    'Seguridad de las sesiones: al cambiar la clave desde la aplicación se cierran las demás sesiones abiertas de esa persona (otros teléfonos o computadores) y queda abierta solo la actual. Nuevo menú «Ver sesiones abiertas (quién está usando el sistema)» con cuántas sesiones tiene cada directivo, desde cuándo y su último uso (se actualiza cada 10 minutos).'] },
  { version: '2026.11.09-g', fecha: '2026-11-09', cambios: [
    'Turnos de la ronda: nueva hoja Turnos_Ronda (se crea sola y se puede editar) con quién debe hacer cada bloque cada día: lunes y miércoles el Rector (Jorge Hernández) abre y cierra, suele reemplazarlo Harold Angulo; martes y jueves Harold; bloque 2 todos los días Verónica Barreiro; bloque 3 Francisco Cortés (el viernes el Rector, o Harold); viernes bloques 1 y 4 Francisco.',
    'La ronda muestra un aviso discreto bajo «Ronda a cargo de» («Este bloque le corresponde a …», o «Reemplaza a …»); no bloquea nada. En el panel, Rondas guardadas muestra «(le correspondía a …)» cuando la ronda la hizo alguien distinto del titular y de su reemplazo habitual.'] },
  { version: '2026.11.09-f', fecha: '2026-11-09', cambios: [
    'Ronda, responsable: por defecto es SIEMPRE quien abrió la sesión (aparece primero en la lista, con «(usted)»); ya no queda recordado el nombre de otra persona ni se toma el primero de la lista. Si no se puede identificar a quien abrió la sesión, la lista pide elegir. Se puede cambiar eligiendo otro en esa pantalla.',
    'Ronda, navegación: el recuadro del bloque (o de la sesión, según el modo) ahora es una lista desplegable para ir directo a otro bloque o sesión, además de las flechas ◀ ▶.'] },
  { version: '2026.11.09-e', fecha: '2026-11-09', cambios: [
    'Orientación: Johana (jornada 7:30 a 14:30; sesiones de la ronda hasta las 13:30) y Ángela (8:30 a 13:30) figuran solo dentro de su jornada, sin leyendas adicionales. Se quitó el texto «horario adicional voluntario» de la versión 2026.11.09-d.'] },
  { version: '2026.11.09-c', fecha: '2026-11-09', cambios: [
    'Ronda, preescolar: en el último periodo (10:30 a 11:30) la tarjeta avisa que las docentes siguen en el colegio hasta las 12:00 organizando y despachando a los niños; con «Ahora» o con el bloque 3 elegido se pueden marcar hasta las 12:00. El tiempo sin atender sigue contando solo el horario de clases (hasta 11:30).'] },
  { version: '2026.11.09-b', fecha: '2026-11-09', cambios: [
    'Ronda, preescolar: entran a las 7:30 con los niños y sus periodos son de 60 min (07:30, 08:30, 09:30, 10:30). Ahora se muestran en el bloque donde EMPIEZA cada periodo: 07:30 en el bloque 1 (6:30–8:00), 08:30 y 09:30 en el bloque 2 y 10:30 en el bloque 3. Quedó sin efecto el cambio de «llegada temprana» de la versión 2026.11.09-a (las orientadoras vuelven a aparecer según su horario: Johana desde el bloque 1, Ángela desde el bloque 2).',
    'Ronda, descanso: con «Ahora», durante el descanso entre bloques (y hasta que empiece el siguiente) sigue apareciendo el bloque que terminó, con la etiqueta «☕ DESCANSO (aún puede marcar)» junto a la franja.'] },
  { version: '2026.11.09-a', fecha: '2026-11-09', cambios: [
    'Ronda, llegada temprana: en el bloque 1 aparecen también las docentes de preescolar (llegan 7:30) y las dos orientadoras (Johana y Ángela, desde las 7:00), aunque su primera clase sea después. Se marcan con su primera sesión del día y esa marca se ve igual cuando se abra su bloque.',
    'Ronda, botón «Ahora»: en los descansos y hasta 20 minutos después de la última sesión de un bloque sigue mostrando la sesión que acaba de terminar (a las 11:42 aún se muestra el bloque 3 hasta las 12:00), en vez de «Descanso».'] },
  { version: '2026.11.06-b', fecha: '2026-11-06', cambios: [
    'Ronda y reuniones, cada cosa por su lado: cuando una reunión o actividad sin clases coincide con el horario, la ronda ofrece dos botones, «▶ Hacer la ronda de las clases» y «📋 Registrar asistencia de la reunión/actividad» (según su naturaleza). La ronda ya no queda bloqueada.',
    'Aviso del día («Hoy en el colegio»): ahora tiene barra de desplazamiento, muestra todas las reuniones y todos los docentes ausentes (sin límite) y deja de contar el tiempo mientras se desplaza.',
    'Asistencia de reuniones y actividades: «○ N sin registrar · ver quiénes» abre la lista de los que faltan (con botón para marcarlos como asistió); al guardar aparece enseguida un resumen con barra de desplazamiento («Guardando…» y luego ✔) con «Cerrar y salir al menú»; el guardado escribe por lotes (más rápido). Se puede volver a abrir y corregir la asistencia.',
    'Para quien administra: botón «➕ Persona que no aparece» en la asistencia, para agregar a la reunión a un docente que no sale en la lista (sin perder lo marcado). En Parametros, reunion_personas_extra (nombres separados por «;») agrega personas que deben aparecer siempre en las reuniones de TODOS.'] },
  { version: '2026.11.06-a', fecha: '2026-11-06', cambios: [
    'Ronda independiente de las reuniones: cuando una actividad «sin clases» (jornada, actividad institucional general, etc.) suspende la ronda, aparece el botón «▶ Hacer la ronda de todos modos» (para actividades que son solo de algunos grupos o docentes). Queda activado para esa fecha en ese navegador y la ronda muestra el enlace «volver a respetar la reunión». También se puede editar la reunión (Reuniones → Editar) y quitar «Sin clases».'] },
  { version: '2026.11.03-a', fecha: '2026-11-03', cambios: [
    'VELOCIDAD DEL GUARDADO (causa encontrada): por cada marca de la ronda, el sistema formateaba la fecha de TODAS las filas históricas de Registro_Ronda y Novedades (decenas de miles de operaciones lentas que crecen cada día, por eso tardaba minutos). Ahora la fecha se calcula una sola vez por día distinto y solo se revisan las filas de la fecha que se guarda. En una prueba con 12 000 filas históricas, las operaciones de fecha bajaron de 72 000 a 121.',
    'Ronda: al tocar «Guardar» el resumen aparece enseguida con «⏳ Guardando la ronda…» (los botones de salir e informe se activan al confirmarse ✔). Si falla, se cierra el resumen y las marcas siguen en pantalla y en el borrador del teléfono.'] },
  { version: '2026.10.29-a', fecha: '2026-10-29', cambios: [
    'Novedades: al guardar, el formulario queda en blanco, la pantalla vuelve al comienzo y aparece un aviso verde «✔ Guardado» arriba; se puede registrar otra novedad sin salir del módulo (se sale con «« Menú»).',
    'Reuniones: al crear una reunión nueva, el formulario queda en blanco, arriba, con el aviso «✔ Reunión creada»; el botón pasa a «Salir a la lista» para volver cuando se decida.',
    'Guardado de la ronda: se quitó un trabajo repetido (por cada docente ausente se revisaba toda la hoja de Novedades) y, si un guardado tarda más de 5 segundos, queda en Bitacora_Cambios («Guardado de ronda lento») con lo que tardó cada parte y el tamaño de las hojas, para encontrar el cuello de botella.'] },
  { version: '2026.10.26-f', fecha: '2026-10-26', cambios: [
    'Ronda: el resumen que aparece al guardar ya no muestra «45 min» para todos. Una ausencia de toda la jornada muestra el total del día; «solo este bloque», los minutos de las sesiones del bloque; y «con reemplazo» no muestra minutos (no cuentan como tiempo sin atender).'] },
  { version: '2026.10.26-e', fecha: '2026-10-26', cambios: [
    'Ronda, «Toda la jornada»: el tiempo sin atender ya no cae en los 45 minutos de una sesión. Se respeta el mayor entre el horario del docente, el total que calcula la pantalla (que incluye las clases de su pareja de alternancia) y lo que ya estuviera anotado en una novedad de jornada completa de ese día. Volver a guardar no lo baja.'] },
  { version: '2026.10.26-d', fecha: '2026-10-26', cambios: [
    'CORRECCIÓN: en la ronda el recuadro de la sesión o bloque mostraba solo «…» (desde la versión 2026.10.25-f un comentario se comía la línea que escribe «Sesión N» o «Bloque N»). Ya se ve el número otra vez y se agregó una prueba que detecta ese tipo de error.',
    'Ronda, «¿Quién cubre el grupo?» (Con reemplazo): nueva opción «Nadie / ninguna persona (el grupo queda solo)»; al elegirla el titular queda como «No asistió» y el tiempo sin atender es el asignado.'] },
  { version: '2026.10.26-c', fecha: '2026-10-26', cambios: [
    'CORRECCIÓN URGENTE: en las versiones 2026.10.26-a y -b la ronda mostraba «d.getTime is not a function». Una función nueva de las copias de seguridad tenía el mismo nombre que otra de la alternancia semanal y la pisaba. Se renombró y se agregó una prueba que impide nombres repetidos entre archivos.'] },
  { version: '2026.10.26-b', fecha: '2026-10-26', cambios: [
    'Novedades: nueva opción en «Quién informó»: «Conocimiento de la comunidad (público)», para hechos que se supieron por la comunidad educativa sin que el docente o el rector los informaran. Se agrega sola a la lista del libro.'] },
  { version: '2026.10.26-a', fecha: '2026-10-26', cambios: [
    'Copias de seguridad automáticas de los libros en Drive: carpeta «App Asistencia / Respaldos» con Diario (se reemplaza la copia del día y se conservan los últimos 3 días), Semanal (una por semana) y Mensual (una por mes). Copia el libro principal, el libro de respaldo de rondas y los libros que se agreguen en Parametros (respaldo_libros_extra). Menú «Respaldos: programar copia diaria (Drive)» (una sola vez, corre cada noche) y «Respaldos: copiar libros a Drive ahora». En Parametros se puede cambiar respaldo_dias, respaldo_semanas y respaldo_meses (0 = guardar todas).'] },
  { version: '2026.10.25-f', fecha: '2026-10-25', cambios: [
    'Rondas de otras fechas: solo quien administra las abre y las puede registrar o corregir (en «📅 Fecha…»); los demás directivos las revisan en los informes (Ver panel → Rondas guardadas).',
    'Reuniones en sábado: entrega de boletines, jornada pedagógica (compensatorios), escuela de padres, reunión con padres, ceremonias de grado o proclamación (nuevo tipo; transición, 5°, 9°, Caminar en Secundaria 2 y bachilleres) y clausura se programan sin la marca «Excepcional», también por la tarde hasta las 18:00. Cualquier otra reunión en sábado, el domingo o después de las 18:00 sigue necesitando «⭐ Excepcional».',
    'Edición: quien administra puede corregir reuniones y novedades de cualquier fecha; los demás, solo las de hoy en adelante. Una ausencia de toda la jornada se puede mover o ampliar de días desde «✏️ Editar» (solo días con clases del docente).'] },
  { version: '2026.10.25-e', fecha: '2026-10-25', cambios: [
    'CORRECCIÓN: en las versiones 2026.10.25-b, -c y -d la pantalla de Reuniones tenía un error de código (un comentario se comió parte de una línea) que la dejaba sin funcionar. Quedó corregido y se agregó una prueba que revisa que todo el JavaScript de las pantallas compile.',
    'Ronda: los directivos que no administran pueden registrar la ronda del día hasta 3 horas después de terminar la jornada escolar (16:30 con jornada hasta la 1:30 p. m.); después solo quien administra, que puede hacerlo en cualquier momento (hoy o de fechas anteriores, con motivo; si no había marcas el motivo viene sugerido: «Registro posterior»). En Parametros se puede cambiar el margen (ronda_horas_margen) y habilitar el día anterior para los demás directivos (ronda_dias_atras = 1).',
    'Reuniones: horario normal de lunes a viernes de 6:30 a 18:00 (se cambia en Parametros: reunion_desde, reunion_hasta). Para sábados, domingos u horas fuera de ese horario (bazar, cena de grados, celebraciones fuera del colegio, jornadas ampliadas) hay una casilla «⭐ Excepcional»; la reunión queda marcada como excepcional.'] },
  { version: '2026.10.25-d', fecha: '2026-10-25', cambios: [
    'Ronda anterior: quien administra puede corregirla. En «📅 Fecha…» aparece «✏️ Editar esta ronda»; al guardar se pide el motivo de la corrección, que queda en cada marca cambiada (observaciones) y en Bitacora_Cambios. El servidor ya no deja guardar rondas de otra fecha a quien no administra. La barra de fecha se repliega al elegir el día (con «Cambiar fecha» y «Volver a hoy» en el aviso azul).',
    'Novedades programadas: cada registro tiene «✏️ Editar» para completar o corregir el motivo, quién queda a cargo, si se dejó actividad y el detalle (todos sus días; lo que ya pasó solo lo corrige quien administra); queda en la bitácora.',
    'Reuniones: solo se programan de lunes a viernes (la hora puede ser dentro o fuera de la jornada, del mismo día).'] },
  { version: '2026.10.25-c', fecha: '2026-10-25', cambios: [
    'Ronda: el selector de día ahora trae «📅 Fecha…»: se elige un día hábil de hoy hacia atrás y se ve la ronda guardada ese día (solo lectura, con aviso azul); «Ahora» vuelve a hoy. No permite fines de semana ni fechas futuras.',
    'Ronda: las novedades por horas (permiso, llegada tarde, salida temprana) ahora también se marcan solas, pero solo en las sesiones que muestra la pantalla y con los minutos anotados; en otra sesión no aparecen.',
    'Reuniones: al crear o editar una reunión se avisa qué convocados ya tienen una ausencia de toda la jornada ese día; en la asistencia salen marcados «No asistió» con su motivo.'] },
  { version: '2026.10.25-b', fecha: '2026-10-25', cambios: [
    'Coherencia entre novedades, ronda y reuniones: el docente con una ausencia de toda la jornada ya anotada en Novedades aparece MARCADO SOLO en la ronda (No asistió, Otro docente a cargo o SED) con su motivo, quién queda a cargo y la actividad dejada; basta guardar la ronda, y se cambia tocando otro botón. En la asistencia de una reunión, quien ya tiene ausencia reportada ese día sale marcado «No asistió» con su motivo.',
    'Manual: nueva sección «¿Dónde registro cada cosa? (sin repetir)» que dice qué va en novedades, ronda y reuniones.'] },
  { version: '2026.10.25-a', fecha: '2026-10-25', cambios: [
    'Motivos: nuevo motivo «Invitación sindical (encuentro, asamblea, delegados)» (se agrega solo a la hoja Motivos; en la ronda cuenta como toda la jornada).',
    'Novedades anticipadas: ahora piden quién queda a cargo del grupo y si se dejó actividad de aprendizaje; quedan en Novedades (Grupo atendido por, Actividad de Aprendizaje). En la ronda, esos datos se ven en «Reportado hoy» y se precargan al marcar a ese docente (no hay que escribirlos de nuevo).',
    'Aviso del día: nueva sección «Docentes ausentes hoy» con el nombre, el motivo, el tipo de ausencia, los días que va a estar ausente, quién queda a cargo y si dejó actividad.',
    'Ronda, «Sin estudiantes»: dos motivos más (los despachó temprano con autorización, los despachó sin autorización); el motivo se elige en una lista debajo del interruptor.'] },
  { version: '2026.10.23-j', fecha: '2026-10-23', cambios: [
    'Ronda (celular): los contadores principales quedan siempre a la vista en una fila fija de 5 (sin guardar o guardados, faltan, presentes, no asistió, otro a cargo); debajo, una fila deslizable con sin estudiantes, evento SED, permiso por horas, llegada tarde o salida antes, en reunión o actividad externa e incumplimientos.'] },
  { version: '2026.10.23-i', fecha: '2026-10-23', cambios: [
    'Ronda: contadores reorganizados. En celular van en una fila deslizable (indicador de guardado, faltan por reportar, presentes, sin estudiantes, no asistieron, otro docente a cargo, evento SED, permiso por horas, llegada tarde o salida antes, en reunión o actividad externa e incumplimientos) con el texto completo; en computador, una fila de 10 casillas. Nuevo contador de docentes presentes «sin estudiantes». El recuadro de la hora tiene más espacio interior.'] },
  { version: '2026.10.23-h', fecha: '2026-10-23', cambios: [
    'Ronda: «Sin estudiantes» ahora ofrece más motivos: los despachó, están en taller o actividad fuera del aula, no asistieron (padres avisados), están en otra dependencia (laboratorio, biblioteca, sala), el docente no los está atendiendo, el docente no quiso atenderlos y otro motivo. El informe de rondas muestra el motivo junto al nombre del docente presente. (Para un incumplimiento formal use el botón «Reportar incumplimiento».)'] },
  { version: '2026.10.23-g', fecha: '2026-10-23', cambios: [
    'Ronda: los botones que se suman a «Presente» (llegada tarde, permiso por horas, salió antes, incumplimiento) forman una barra unida, sin líneas punteadas.',
    'Ronda: el interruptor «Con estudiantes / Sin estudiantes» queda siempre visible en la línea del área de cada docente (no aparece para orientación ni tutoría). Al tocar «Sin estudiantes» el docente queda presente y se elige el motivo en una lista debajo. El nombre del docente baja a 13,5 px en celular.'] },
  { version: '2026.10.23-f', fecha: '2026-10-23', cambios: [
    'Vuelve el encabezado de celular reordenado (título a todo el ancho y con letra más grande, escudo proporcional, hora y fecha junto a los botones Menú, Ver panel y Reuniones) y la alternancia automática de las parejas que dictan por semana.',
    'Ronda: quien inició sesión queda siempre como responsable por defecto (se puede cambiar), aunque su nombre no esté en la hoja Directivos.'] },
  { version: '2026.10.23-e', fecha: '2026-10-23', cambios: [
    'Parejas que alternan (clases y énfasis de 6° y 7°): si la semana pasada ya se definió quién dictó, esta semana se alterna sola y la tarjeta lo dice («alternancia automática»); sigue la cadena hasta 8 semanas después de la última definición, y quien tiene permiso puede cambiarla con «Cambiar». Lo que se defina a mano en una semana tiene prioridad.',
    'Ronda (celular): el título ocupa todo el ancho con el escudo proporcional, el sello de la versión queda a continuación de «ICET», la hora y la fecha bajan junto a los botones Menú, Ver panel y Reuniones, y las filas del encabezado son más bajas.'] },
  { version: '2026.10.23-d', fecha: '2026-10-23', cambios: [
    'Ronda: llegada tarde, permiso por horas, salió antes e incumplimiento ahora SE SUMAN a «Presente» (el docente está en el colegio): al marcar una de ellas «Presente» también queda marcado; tocarla de nuevo deja al docente solo «Presente». Los botones principales (Presente, No asistió, Otro docente a cargo, Evento SED) siguen siendo excluyentes. Aparecen en una segunda fila con borde punteado.',
    'Ronda (celular): los botones y los contadores muestran el nombre completo con letra más pequeña (los contadores en cero de novedades poco comunes se ocultan para ahorrar espacio).'] },
  { version: '2026.10.23-c', fecha: '2026-10-23', cambios: [
    'Ronda: el encabezado dice «Institución Ciudadela Educativa Tumac · ICET» con el sello de la versión justo a continuación, en la misma línea.',
    'Ronda: casilla «Sin estudiantes» en los docentes presentes (con motivo: los despachó, están en taller o actividad fuera del aula, no asistieron los estudiantes u otro). Por defecto todos están con estudiantes; no aparece para orientación ni tutoría PTA, que no tienen estudiantes asignados. Queda en Registro_Ronda (columna atendido_por) y el informe de rondas marca «(sin estudiantes)». En las demás novedades, la lista «quién atendió al grupo» también trae «Sin estudiantes».',
    'Ronda: al guardar se muestra el resumen y, al cerrarlo (botón «Cerrar y salir al menú»), se vuelve al menú principal.'] },
  { version: '2026.10.23-b', fecha: '2026-10-23', cambios: [
    'Ronda: encabezado ordenado (escudo y título, reloj grande en vivo con segundos y fecha, «Menú», «Ver panel» y «Reuniones» en tres botones del mismo ancho, ◀ Bloque ▶ con día, modo y «Ahora» alineados, y el horario, el total y el directivo debajo).',
    'Ronda: los 8 botones de estado quedan repartidos (4×2 en celular con texto corto y más bajos para que quepan más docentes; en computador 8 en una fila con el nombre largo: Otro docente a cargo, Evento SED, Permiso por horas, Llegada tarde, Salió antes (sin informar), Reportar incumplimiento).'] },
  { version: '2026.10.23-a', fecha: '2026-10-23', cambios: [
    'Velocidad: guardar una ronda de ~40 docentes ahora hace 2 escrituras en la hoja (antes ~50, una por fila) y consulta las reuniones una vez por sesión; el respaldo se escribe de una vez y después de soltar el bloqueo. Si otro guardado está en curso, avisa «Espere unos segundos» en vez de fallar (el bloqueo espera hasta 45 s).',
    'Velocidad: el horario, las franjas, los motivos, los grupos, las parejas, las listas y los docentes se guardan 10 minutos en la memoria del sistema (se borran solos al editar esas hojas) en vez de leerse de la hoja en cada pantalla. Los registros (rondas, novedades) siempre se leen frescos.',
    'Menú principal: la dirección y los datos del usuario se piden a la vez, así la primera pantalla sale antes.'] },
  { version: '2026.10.21-e', fecha: '2026-10-21', cambios: [
    'Respaldo: cada vez que se guarda una ronda, las marcas se anotan también en un libro de respaldo aparte («ICET · Respaldo de rondas (no borrar)», se crea solo en Drive). Menú «Respaldar rondas ahora» copia completas Registro_Ronda, Novedades e Incumplimientos.',
    'Menú «Recuperar rondas desde una copia del libro»: con el enlace de una copia anterior (hecha desde el historial de versiones) o del libro de respaldo, agrega solo las filas que faltan (rondas, novedades, incumplimientos) sin cambiar ni borrar lo que ya está.'] },
  { version: '2026.10.21-d', fecha: '2026-10-21', cambios: [
    'Ronda: las marcas ya guardadas del bloque se ven siempre. Si una marca quedó a nombre de un docente que ya no tiene esa sesión (cambios de horario), aparece en la tarjeta de quien hoy la tiene (por fecha, sesión, grupo y área) y al guardar se reemplaza en vez de duplicarse; no hace falta tocar la hoja.',
    'Ronda: botones más cortos y con colores propios (Presente, No asistió, Otro a cargo, SED, Permiso, Tarde, Salió, Incumple). «SED» no pide motivo, horas ni actividad: registra la jornada completa con el tiempo que el docente tiene con estudiantes.',
    'Ronda: el botón «❗ Faltan: N · ver» abre una ventana con los nombres de quienes aún no tienen marca; tocar un nombre lleva a su tarjeta.'] },
  { version: '2026.10.21-c', fecha: '2026-10-21', cambios: [
    'Ronda: nuevo botón «Evento SED» (capacitación, taller, charla o citación de la Secretaría de Educación, SED o SEM): queda como ausencia de toda la jornada con el motivo «Evento SED / SEM», sin justificar, y el tiempo sin atender es el que el docente tiene con estudiantes ese día (240 min en preescolar).',
    'Menú del libro «Revisar y recuperar marcas de la ronda»: cuenta las marcas de Registro_Ronda por fecha, detecta las que la ronda no muestra porque quedaron a nombre de quien ya no tiene esa sesión (por cambios de horario) y, al confirmar, las devuelve a la vista; no borra nada.'] },
  { version: '2026.10.21-b', fecha: '2026-10-21', cambios: [
    'Preescolar (transición): una ausencia de jornada completa mostraba 300 minutos porque el libro conservaba el horario viejo de 5 periodos de 60 min. Ahora el libro corrige solo el horario de preescolar al abrirse (4 periodos de 60 min, de 7:30 a 11:30 = 240 min al día) y baja a 240 las ausencias de jornada completa ya guardadas de quien solo tiene grupos de preescolar (también desde el menú «Actualizar horario de preescolar»).'] },
  { version: '2026.10.21-a', fecha: '2026-10-21', cambios: [
    'Parejas que alternan (ética/religión, sociales/inglés, ciencias naturales): la alternancia semanal ahora también cambia a la persona en los equipos de énfasis (antes solo las clases), de modo que en la ronda y en Horarios aparece la tarjeta con «Cambiar» y lo definido vale de lunes a viernes para clases y énfasis a la vez.',
    'Corrección de quién dicta: ahora pasa las marcas de la ronda y las novedades por sesión de cada docente de la pareja al otro (en los dos sentidos) y también sirve para restablecer la asignación original, algo que antes fallaba al volver atrás.'] },
  { version: '2026.10.20-k', fecha: '2026-10-20', cambios: [
    'Educación Física: el rector intercambió sin avisar el horario de Docente 1 (Arizala Castro Roberto Carlos) y Docente 2 (Armero Dájome Jesús, reemplazo de Terán). Se intercambia el horario completo de los dos (Educación Física y Ciencias Naturales). Se corrigió el horario en los datos y el menú «Corregir Docente 1 y 2 de Educación Física (una vez)» muestra primero lo que cambiaría y, al confirmar, pasa de uno al otro el horario, las marcas de la ronda, las novedades por sesión, los incumplimientos, las parejas de énfasis y Matriz_Grupos; no toca ausencias de jornada completa ni novedades de formulario o WhatsApp (las cuenta para revisarlas). Queda en Bitacora_Cambios.'] },
  { version: '2026.10.20-j', fecha: '2026-10-20', cambios: [
    'Aviso del día: cada reunión muestra la hora destacada con color según la prioridad (HOY naranja, MAÑANA amarillo, próximas azul, en curso rojo y parpadeante, sin asistencia rojo), el nombre en negrita y más grande, un icono de prioridad (🔥, ⏰, 📅, ⚠️) y el fondo del mismo color que en la lista de reuniones.',
    'Ronda: el nombre del directivo que hace la ronda pasa de la barra inferior al encabezado (se ve en amarillo; en rojo si falta elegirlo), lo que libera espacio para los contadores; el escudo del colegio se ve más grande en el celular; el encabezado muestra el nombre completo de la institución (Institución Ciudadela Educativa Tumac · ICET).'] },
  { version: '2026.10.20-i', fecha: '2026-10-20', cambios: [
    'Aviso del día: ahora se queda el doble de tiempo (10 segundos y 4 más por cada aviso; los recordatorios urgentes, 14 y 4 por aviso).',
    'Reuniones: «Salida anticipada de estudiantes»: hora en que se despachan, minutos antes en que terminan las clases (10, 15, 20 o 30, para el aseo y el comedor) y si se lleva a los estudiantes al comedor antes de despacharlos. Las clases se suspenden desde que terminan (la ronda de aula no se hace en ese horario) y el aviso del día lo recuerda a los directivos.',
    'Reuniones: casilla «Informar a docentes, estudiantes y padres de familia» y botón «📣 Comunicados» con textos listos para docentes (que informan a estudiantes y padres) y para padres de familia, para copiar o enviar por WhatsApp. El aviso del día lo recuerda el día de la reunión y la víspera; el viernes también recuerda lo del lunes para empezar la semana.',
    'La hoja Reuniones recibe las columnas salida_est, min_antes_salida, llevar_comedor e informar_padres.'] },
  { version: '2026.10.20-h', fecha: '2026-10-20', cambios: [
    'Reuniones: nuevo campo «Asunto u observaciones (opcional)» para aclarar de qué trata la reunión; se ve en la tarjeta y, solo si se escribió, en el aviso del día y en los recordatorios. La hoja Reuniones recibe la columna observaciones.',
    'Reuniones: los tipos «Jornada pedagógica» y «Reunión de desarrollo institucional» se unificaron en «Jornada pedagógica o de desarrollo institucional» (las reuniones ya guardadas se muestran con el nombre nuevo). Tipos nuevos: taller pedagógico, charla o conferencia, reunión de área o de grado, reunión con padres de familia o acudientes, escuela de padres, acto cívico o cultural y simulacro de evacuación.'] },
  { version: '2026.10.20-g', fecha: '2026-10-20', cambios: [
    'Reuniones: el lugar se elige de una lista por grupos: espacios del colegio (sala de profesores, polideportivo (canchas), patio principal, sala múltiple (auditorio), biblioteca, comedor escolar, emisora escolar), salas de tecnología e informática 1 a 4 y aulas digitales (sala 5), laboratorio de química y otros laboratorios o entornos por área (se escribe cuál y su número), salones (se escribe el número o grupo), oficinas (rectoría, coordinaciones y orientación escolar, tomadas de las hojas Directivos y Docentes) y otros (virtual, fuera del colegio, otro lugar).'] },
  { version: '2026.10.20-f', fecha: '2026-10-20', cambios: [
    'Reuniones: «¿A quiénes se convoca?» ahora tiene opciones globales: todo el personal, directivos docentes, docentes orientadoras, tutora PTAFI, docentes de preescolar, de básica primaria, de bachillerato, docentes de un área (una o varias) y personalizado (docente por docente, con buscador). Además organismos e invitados: consejo directivo, académico, estudiantil, de padres, comité de convivencia, comité de comedor escolar, padres de familia o acudientes, egresados y entidad o invitado externo (con su nombre). Los organismos e invitados se anuncian pero no llevan lista de asistencia por persona; el personal sí. La hoja Reuniones recibe las columnas convocados_grupos, invitados e invitado_nombre.'] },
  { version: '2026.10.20-e', fecha: '2026-10-20', cambios: [
    'Reuniones y actividades: nuevos datos al crear o editar: hora en que comienza y cómo termina (hora fija, hora tentativa o hasta finalizar la jornada), lugar, quién convoca (rectoría, coordinaciones, líder de área, docente, orientador(a), PTAFI, Secretaría de Educación…) con el área o entidad, quién solicita y responsables a cargo, además de los convocados. Las columnas nuevas de la hoja Reuniones se agregan solas.',
    'Crear una reunión ya no se repite si se toca el botón varias veces mientras el libro responde (queda una sola) y, al terminar, vuelve a la lista de reuniones (antes abría la lista de docentes para la asistencia). Quien administra ve «Quitar las repetidas» para limpiar las que ya estén duplicadas (también en el menú del libro: Quitar reuniones repetidas); la que tiene asistencia se conserva y las demás quedan en Reuniones_Anuladas.'] },
  { version: '2026.10.20-d', fecha: '2026-10-20', cambios: [
    'Aviso del día: ventana emergente de unos segundos sobre cualquier pantalla (menú, ronda, novedades, reuniones, horarios y panel) con las reuniones de hoy (hora, tipo, si se suspenden las clases), las que ya terminaron sin asistencia registrada y las salidas con estudiantes. Vuelve a aparecer al terminar de guardar la ronda.',
    'Recordatorios por reunión: al crearla o editarla se elige avisar con 1, 2, 3 o 7 días de anticipación, el mismo día (15 min, 30 min, 1 o 2 horas antes, con parpadeo y vibración en el celular) y si sale al comenzar y al terminar la ronda. Durante la jornada la app lo revisa cada 3 minutos y avisa una sola vez. La hoja Reuniones recibe las columnas avisar_dias, avisar_min y avisar_ronda (se agregan solas).'] },
  { version: '2026.10.20-c', fecha: '2026-10-20', cambios: [
    'Menú principal: el botón «Horarios y consultas» ahora se llama «Horarios y listados» (también en el título de la pantalla y en el manual de Ayuda).'] },
  { version: '2026.10.20-b', fecha: '2026-10-20', cambios: [
    'Reuniones: las listas (del día, próximas y últimas) van después del formulario y del botón de crear, también dentro del formulario de crear o editar. Marcas de prioridad: HOY (alta, naranja), MAÑANA (media, amarillo), próximas (azul); las pasadas se atenúan: verdes «Aplicada» si ya tienen asistencia, grises si no.',
    'Reuniones: botón «🗑 Anular» solo para quien administra (dueño del libro, columna administra = SI en Directivos o coordinación académica); exige motivo y deja la reunión en la hoja Reuniones_Anuladas con quién, cuándo y por qué.',
    'Registrar novedades: las últimas novedades llevan la misma marca de prioridad (HOY, próxima, pasada) y etiquetas de incumplimiento y de grupo cubierto.'] },
  { version: '2026.10.20-a', fecha: '2026-10-20', cambios: [
    'Registrar novedades: nueva lista «Últimas novedades registradas» (lo más reciente primero), con las de la ronda y las del formulario, indicando de dónde vienen, quién las registró y los minutos.',
    'Reuniones: listas de «Próximas reuniones» y «Últimas reuniones», y botón «✏ Editar» para cambiar tipo, nombre, fecha, horas, clases suspendidas y convocados (la asistencia ya registrada no se borra; queda en la bitácora).'] },
  { version: '2026.10.19-e', fecha: '2026-10-19', cambios: [
    'Ronda: indicador de guardado. Verde «✔ Ronda guardada y completa» (con la hora) cuando todo está guardado; naranja «Pendiente de guardar: N reportes nuevos y M cambios» cuando hay algo sin guardar. El botón pasa a «Guardar · N» (pulsa) o «✔ Guardada», y cada 2 minutos aparece un recordatorio mientras haya algo pendiente.'] },
  { version: '2026.10.19-d', fecha: '2026-10-19', cambios: [
    'Nueva opción «Ayuda y manual de uso» en el menú principal (y en la pantalla de ingreso): guía paso a paso para los directivos y docentes, con impresión en PDF.',
    'Rectoría: el tiempo de ausencia del docente (incapacidad, licencia, permiso) se cuenta completo según su asignación aunque el grupo haya sido cubierto por un reemplazo. Panel e informe muestran «Ausencia total de docentes» y, aparte, «Horas de clase sin atender».',
    'Quién dicta en las parejas que alternan: definirlo por primera vez en la semana puede hacerlo cualquier directivo; cambiarlo solo el administrador, la coordinación académica, la rectoría o quien tenga SI en la columna cambia_asignacion (hoja Directivos).'] },
  { version: '2026.10.19-c', fecha: '2026-10-19', cambios: [
    'Ronda: nuevo estado «Con reemplazo (otra persona a cargo)»: el titular no está pero otra persona atiende el grupo (reemplazo acordado con rectoría, persona de apoyo contratada, practicante, otro docente con espacio libre). La ausencia cuenta, el grupo no queda sin atender; contador propio en la barra y lista aparte en el informe de rondas.',
    'Incapacidad, licencia, duelo, comisión de servicios y otros motivos de toda la jornada: se marca «toda la jornada» sola y el tiempo es el asignado en su horario de ese día (no se calcula a mano). Motivos nuevos: licencia de maternidad o paternidad, por luto, no remunerada, comisión de servicios, descanso compensatorio.',
    'Salida temprana: se puede escribir la hora a la que salió y el sistema calcula el tiempo sin atender con el horario del docente.',
    '«¿Quién atendió al grupo?»: nuevas opciones «No aplica (no tiene grupo asignado)» (orientación, PTAFI), persona de apoyo contratada y otro docente con espacio libre.',
    'Quién dicta en las parejas: la confirmación y la corrección ya no usan cuadros del navegador (podían bloquearse en el celular); si falla se pueden reintentar los botones.',
    'Pantalla: título, número de versión y contadores («Faltan por reportar», presentes) más grandes, sobre todo en computador; botones de estado en 3 columnas en el celular; texto sin ampliación automática en iPhone.'] },
  { version: '2026.10.19-b', fecha: '2026-10-19', cambios: [
    'Ronda: al marcar «No asistió» se muestra el total de minutos sin atender y cuántas sesiones son (antes decía «Automático»).',
    'Nuevo «Reemplazo (acordado con rectoría)» en «¿Quién atendió al grupo?». Si el grupo lo atendió un reemplazo, practicante, auxiliar u otro docente, la ausencia del docente (incapacidad, licencia) sigue contando, pero esos minutos no cuentan como «sin atender»; el panel y el informe muestran aparte los minutos cubiertos.'] },
  { version: '2026.10.19-a', fecha: '2026-10-19', cambios: [
    'Ronda en celular más compacta: barra inferior más baja, botones y tarjetas más pequeños para ver al menos dos docentes por pantalla.',
    'Hoja LEEME con título grande, versión vigente e historial de cambios (se actualiza sola al abrir el libro).'] },
  { version: '2026.10.16-d', fecha: '2026-10-16', cambios: [
    'Ronda: barra fija de conexión («Sin conexión · N marcas pendientes» / «N marcas sin guardar») y advertencia al cerrar con marcas sin guardar.'] },
  { version: '2026.10.16-c', fecha: '2026-10-16', cambios: [
    'Informe de rondas: filtro por directivo; restricción opcional con la columna ve_todo (NO = solo ve sus rondas) en la hoja Directivos.',
    'Al imprimir o guardar en PDF las rondas salen desplegadas.'] },
  { version: '2026.10.16-b', fecha: '2026-10-16', cambios: [
    'Al guardar la ronda se muestra el resumen (presentes, no asistieron, permisos, tarde, reunión, incumplimientos) con envío al correo.',
    'Panel: sección «Rondas de verificación» por bloque; las rondas van también en los informes por correo (día, semana, mes).',
    'Ronda: aparece preseleccionado el directivo que inició sesión; se puede elegir a otro (sesión prestada) y queda constancia en Bitacora_Cambios.'] },
  { version: '2026.10.16-a', fecha: '2026-10-16', cambios: [
    'Ronda: aviso amarillo con las marcas sin guardar de otros bloques del día (si la página se recarga en otro bloque).'] },
  { version: '2026.10.13-j', fecha: '2026-10-13', cambios: [
    'Ronda: botón rojo «Limpiar» (quita las marcas aún no guardadas, con «Deshacer»).',
    'Estudiantes: «Quitar marca» por estudiante o por selección (la marca queda como «Levantada» con quién y cuándo).'] },
  { version: '2026.10.13-i', fecha: '2026-10-13', cambios: [
    'Ronda: borrador local de las marcas (se recupera si se cae la señal o se recarga) y chip «N sin guardar».'] },
  { version: '2026.10.13-a a -h', fecha: '2026-10-13', cambios: [
    'Ronda: tiempos de 5 a 360 minutos (cortos para llegada tarde), «hasta el final de la jornada» con el tiempo calculado, confirmar quién dicta en parejas, cita médica y grupo despachado temprano.',
    'Ronda: «Faltan por reportar» destacado en la barra de estado.',
    'Reuniones: aseo general, examen general periódico y otra reunión con nombre; más motivos de salida con estudiantes; 90 minutos por defecto.',
    'Estudiantes: filas sombreadas por marca (retirado, deserción, ausencias, fuga) con leyenda.',
    'Corrección de quién dicta en parejas, con bitácora de cambios; correo del directivo opcional (cualquier proveedor).'] },
  { version: '2026.10.06 y anteriores', fecha: '2026-10-06', cambios: [
    'Ingreso con PIN (hash, sesiones con token, claves temporales con cambio obligatorio, restablecer clave).',
    'Ronda por bloque, parejas que alternan y quién dicta cada semana, preescolar en 4 periodos, ausencia de jornada completa una sola vez.',
    'Incumplimientos con rigor, reuniones y actividades institucionales, salidas pedagógicas, informes por correo (día, semana, mes).',
    'Pestaña Estudiantes: listado por grupo y nivel, marcas de seguimiento, grupos, selecciones y proyectos, nuevos y promovidos.',
    'Consulta de horarios, panel por rol (rector, coordinación, docente), soportes de ausencias, importación desde WhatsApp.'] }
];

var LEEME_USO = [
  'Presente / No asistió / Otro a cargo (antes Con reemplazo) / SED (evento, capacitación o taller de la Secretaría de Educación, toda la jornada) / Permiso por horas / Llegada tarde / Salida temprana / Incumplimiento: estados de cada docente en la ronda.',
  'Con reemplazo: el titular no está (incapacidad, licencia, permiso…) pero otra persona atiende el grupo en su horario. Queda «No asistió» con quién atendió; no suma minutos sin atender.',
  'No asistió sin reemplazo: el tiempo sin atender es el asignado en su horario (sesiones del bloque o toda la jornada). Incapacidad y licencia marcan «toda la jornada» solas.',
  'Salida temprana: puede escribirse la hora de salida; el tiempo se calcula con el horario del docente de ese día.',
  'Quién atendió el grupo → «No aplica (no tiene grupo asignado)» para orientación y PTAFI: no hay estudiantes sin atender.',
  'Parejas que alternan (ética/religión, etc.): se confirma quién dicta una vez por semana; «Cambiar» (solo coordinación académica, rectoría o administrador) corrige y puede pasar a la persona correcta lo ya registrado.',
  'Panel e informes: «Ausencia total de docentes» (incluye lo cubierto por reemplazo) y «Horas de clase sin atender» (solo lo que quedó sin quien atendiera).',
  'Menú principal > «Ayuda y manual de uso»: manual para los usuarios.',
  'Aviso del día: ventana de unos segundos con las reuniones y actividades de hoy sobre cualquier pantalla y al terminar de guardar la ronda; cada reunión puede tener recordatorios (días antes, minutos antes con parpadeo, al comenzar la ronda).',
  'Ronda: las marcas sin guardar se conservan en el teléfono (borrador). La barra de abajo dice «✔ Ronda guardada» (verde) o «Pendiente de guardar: N reportes nuevos y M cambios» (naranja); si no hay señal avisa «Sin conexión».'
];

var LEEME_HOJAS = [
  'Docentes          Lista oficial de docentes con su nivel.',
  'Horario           Una fila por docente / día / sesión de 45 minutos.',
  'Direccion_Grupo   Dinamizadores o directores de cada grupo.',
  'Matriz_Grupos     Para cada día y sesión, quién atiende a cada grupo.',
  'Motivos / Listas  Catálogos de motivos (salud, permisos, licencias, comisión de servicios, calamidad…) con su categoría y si son justificados.',
  'Novedades         Novedades de asistencia (una fila por docente, día y sesión); Novedades_Anuladas guarda las anuladas.',
  'Registro_Ronda    Cada marca de la ronda (presente, no asistió, tarde…) con el directivo que la hizo.',
  'Comision_Actas / Comision_Secciones / Comision_Log   Comisiones de evaluación y promoción: una fila por acta del grado, las secciones que guarda cada docente (con su versión) y el registro de confirmaciones, reaperturas y cierres. No se editan a mano.',
  'Reuniones / Asistencia_Reunion / Reuniones_Anuladas   Reuniones y actividades sin estudiantes y su asistencia (se pueden editar; los cambios quedan en Bitacora_Cambios). Solo quien administra las anula y quedan en Reuniones_Anuladas. Datos de cada reunión: lugar, quién convoca, quién solicita, responsables, cómo termina (fija, tentativa o hasta finalizar la jornada) y recordatorios.',
  'Incumplimientos   Reportes con rigor (solo se agrega; seguimiento por estados).',
  'Estudiantes / Marcas_Estudiantes / Grupos_Proyectos   Listado por grupo y marcas de seguimiento (los levantados quedan en la hoja).',
  'Semana_Alternancia / Alternancias   Quién dicta cada semana en las parejas que alternan.',
  'Turnos_Ronda       Quién debe hacer la ronda en cada bloque de cada día (titular y quien suele reemplazarlo). Se puede editar; solo avisa, no bloquea.',
  'Usuarios / Soportes / Parametros   Cuentas de docentes, soportes de ausencias y parámetros.',
  'Claves_Docentes / Identidad_Docentes   Ingreso de docentes con clave: Claves_Docentes guarda solo el hash de cada clave (no se edita); Identidad_Docentes (docente, cedula) la llena coordinación y es la clave inicial de cada docente. Datos reservados: no compartir la hoja.',
  'Notas_Ronda / Bandeja_WhatsApp   Observaciones de la ronda y novedades propuestas desde WhatsApp.',
  'Directivos        Quiénes registran: claves (hash), correo, ve_todo (NO = solo ve sus rondas), cambia_asignacion (SI/NO: puede cambiar quién dicta en las parejas), administra (SI/NO: puede anular reuniones). No escriba PIN a mano.',
  'Copias en Drive    Carpeta «App Asistencia / Respaldos» (Diario 3 días, Semanal, Mensual) con el libro principal y el de respaldo; se programa desde el menú «Respaldos: programar copia diaria (Drive)».',
  'Respaldo           Libro aparte en Drive «ICET · Respaldo de rondas (no borrar)» (su id está en Parametros: respaldo_id) con cada ronda guardada.',
  'Bitacora_Cambios  Quién cambió qué y cuándo (correcciones, sesiones prestadas, intercambio de Docente 1 y 2).',
  'Datos personales de docentes y estudiantes: acceso solo para directivos (Ley 1581 de 2012).'
];

/** Filas de la hoja: [texto, tipo] con tipo titulo | version | autor | seccion | version_h | texto. */
function leemeFilas_() {
  var f = [];
  f.push(['CONTROL DE ASISTENCIA DOCENTE · I.E. ICET', 'titulo']);
  f.push(['Versión ' + VERSION_SISTEMA + ' · actualizada el ' + FECHA_VERSION, 'version']);
  f.push(['Autor: Francisco Javier Cortés Cabezas · Coordinador académico · Especialista en Informática y Telemática · Magíster en Educación · Doctorando en Desarrollo de la Educación · I.E. ICET, San Andrés de Tumaco (Nariño, Colombia) · © 2026', 'autor']);
  f.push(['', 'texto']);
  f.push(['CÓMO SE REGISTRA LA ASISTENCIA EN LA RONDA', 'seccion']);
  LEEME_USO.forEach(function (t) { f.push([t, 'texto']); });
  f.push(['', 'texto']);
  f.push(['QUÉ CONTIENE ESTE LIBRO', 'seccion']);
  LEEME_HOJAS.forEach(function (t) { f.push([t, 'texto']); });
  f.push(['', 'texto']);
  f.push(['CÓMO PUBLICAR UN CAMBIO SIN CAMBIAR LA DIRECCIÓN: pegar los archivos nuevos, guardar, Implementar > Administrar implementaciones > lápiz > Nueva versión. No usar «Nueva implementación» (crea otra dirección).', 'texto']);
  f.push(['', 'texto']);
  f.push(['HISTORIAL DE VERSIONES (la más nueva primero)', 'seccion']);
  HISTORIAL_VERSIONES.forEach(function (h) {
    f.push(['Versión ' + h.version + ' · ' + h.fecha, 'version_h']);
    h.cambios.forEach(function (c) { f.push(['   • ' + c, 'texto']); });
  });
  return f;
}

/** Escribe la hoja LEEME (la crea al principio si no existe). Se puede ejecutar cuantas veces se quiera. */
function actualizarLeeme() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('LEEME');
  if (!sh) { sh = ss.insertSheet('LEEME', 0); }
  var filas = leemeFilas_();
  sh.clear();
  sh.setColumnWidth(1, 980);
  sh.getRange(1, 1, filas.length, 1).setValues(filas.map(function (x) { return [x[0]]; })).setWrap(true).setVerticalAlignment('middle');
  filas.forEach(function (x, i) {
    var r = sh.getRange(i + 1, 1);
    if (x[1] === 'titulo') { r.setFontSize(28).setFontWeight('bold').setFontColor('#ffffff').setBackground('#0f2a5c'); sh.setRowHeight(i + 1, 64); }
    else if (x[1] === 'version') { r.setFontSize(16).setFontWeight('bold').setFontColor('#0f2a5c').setBackground('#fff3c4'); sh.setRowHeight(i + 1, 34); }
    else if (x[1] === 'autor') { r.setFontSize(10).setFontColor('#456'); }
    else if (x[1] === 'seccion') { r.setFontSize(14).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1b4a8f'); sh.setRowHeight(i + 1, 28); }
    else if (x[1] === 'version_h') { r.setFontSize(12).setFontWeight('bold').setFontColor('#0f2a5c').setBackground('#e8eef8'); }
    else { r.setFontSize(11); }
  });
  sh.setFrozenRows(2);
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);
  return { ok: true, filas: filas.length, version: VERSION_SISTEMA };
}

/** Al abrir el libro: si LEEME no muestra la versión vigente, se regenera (sin molestar si falla). */
function leemeAlDia_() {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName('LEEME');
    var a2 = sh ? String(sh.getRange(2, 1).getValue()) : '';
    if (a2.indexOf('Versión ' + VERSION_SISTEMA + ' ') !== 0) actualizarLeeme();
  } catch (e) { Logger.log('LEEME no se pudo actualizar: ' + e); }
}

// ===================== Respaldo.gs =====================
/**
 * Respaldo de las rondas y recuperación desde una copia anterior del libro.
 * - Cada vez que se guarda una ronda, las marcas guardadas se anotan también en un libro de respaldo aparte (se crea solo en Drive,
 *   «ICET · Respaldo de rondas (no borrar)»; su id queda en Parametros). Si algo falla, el guardado de la ronda NO se afecta.
 * - «Respaldar todo ahora» copia completas Registro_Ronda, Novedades e Incumplimientos al libro de respaldo.
 * - «Recuperar rondas desde una copia» agrega a las hojas actuales las filas que falten en una copia anterior del libro (o del respaldo),
 *   sin cambiar ni borrar nada de lo que ya existe (lo de hoy y lo que se haya modificado se respeta).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var NOMBRE_RESPALDO = 'ICET · Respaldo de rondas (no borrar)';
var HOJAS_RECUPERABLES = [
  { hoja: 'Registro_Ronda', alternas: ['Registro_Ronda_log'], clave: function (f, c) { return [fechaClave_(f[c.fecha]), Number(f[c.sesion]), codClave_(f[c.grupo]), String(f[c.area] || '')].join('|'); } },
  { hoja: 'Novedades', alternas: [], clave: function (f, c) { return [fechaClave_(f[c['Fecha Novedad']]), f[c['Docente']], f[c['Tipo Novedad']], f[c['Sesiones']], f[c['Área/Asignatura']]].join('|'); } },
  { hoja: 'Incumplimientos', alternas: [], clave: function (f, c) { return String(f[c.id]); } }
];
function fechaClave_(x) { return x instanceof Date ? ymd_(x) : String(x == null ? '' : x).slice(0, 10); }
function codClave_(g) { g = String(g == null ? '' : g).replace(/^'/, ''); while (/^\d+$/.test(g) && g.length < 4) g = '0' + g; return g; }

/** Libro de respaldo: el de Parametros (respaldo_id) o uno nuevo. */
function libroRespaldo_() {
  var id = parametro_('respaldo_id', '');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* se crea otro */ } }
  var libro = SpreadsheetApp.create(NOMBRE_RESPALDO);
  guardarParametro_('respaldo_id', libro.getId());
  return libro;
}

var COL_RESPALDO_REGISTRO = ['marca_temporal', 'fecha', 'dia', 'sesion', 'franja', 'docente', 'grupo', 'area', 'estado', 'motivo', 'justificada', 'minutos', 'observaciones', 'directivo', 'atendido_por', 'guardado_en'];
/** Anota en el respaldo, en una sola escritura, las filas de Registro_Ronda recién guardadas. Nunca lanza error. */
function respaldarRonda_(filas) {
  try {
    if (!filas || !filas.length) return;
    var libro = libroRespaldo_(), sh = libro.getSheetByName('Registro_Ronda_log'), n = COL_RESPALDO_REGISTRO.length;
    if (!sh) { sh = libro.insertSheet('Registro_Ronda_log'); sh.appendRow(COL_RESPALDO_REGISTRO); }
    var ahora = ahoraTxt_(), datos = filas.map(function (f) { return rellena_(f, n - 1).concat([ahora]); });
    sh.getRange(sh.getLastRow() + 1, 1, datos.length, n).setValues(datos);
  } catch (e) { Logger.log('Respaldo de ronda no disponible: ' + e); }
}

/** Menú: copia completa de las hojas de registro al libro de respaldo. */
function respaldarTodoAhora() {
  exigirEditor_();
  var libro = libroRespaldo_(), ui = SpreadsheetApp.getUi(), resumen = [];
  HOJAS_RECUPERABLES.forEach(function (d) {
    var o = hoja_(d.hoja); if (!o) return;
    var v = o.getDataRange().getValues(), sh = libro.getSheetByName(d.hoja) || libro.insertSheet(d.hoja);
    sh.clear(); if (v.length) sh.getRange(1, 1, v.length, v[0].length).setValues(v);
    resumen.push(d.hoja + ': ' + Math.max(0, v.length - 1) + ' filas');
  });
  bitacora_('Respaldo completo', resumen.join(' · '));
  ui.alert('Respaldo hecho', resumen.join('\n') + '\n\nLibro de respaldo: ' + libro.getUrl(), ui.ButtonSet.OK);
}

/** Filas de «origen» (matriz con encabezado) que no existen en «destino» según la clave de la hoja; la última versión de cada clave gana. */
function filasFaltantes_(def, origen, destino) {
  var co = {}, cd = {}; origen[0].forEach(function (k, i) { co[k] = i; }); destino[0].forEach(function (k, i) { cd[k] = i; });
  var hay = {}; for (var i = 1; i < destino.length; i++) hay[def.clave(destino[i], cd)] = 1;
  var ultimas = {}, orden = [];
  for (var j = 1; j < origen.length; j++) {
    if (origen[j][0] === '' || origen[j][0] == null) continue;
    var k = def.clave(origen[j], co); if (hay[k]) continue;
    if (!(k in ultimas)) orden.push(k);
    ultimas[k] = origen[j];
  }
  return orden.map(function (k) { return destino[0].map(function (h) { return co[h] == null ? '' : ultimas[k][co[h]]; }); });
}

function recuperarRondasDesdeCopia() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Recuperar rondas desde una copia', 'Pegue el enlace (o el id) de la copia del libro hecha desde el historial de versiones, o del libro de respaldo.\nSolo se agregan las filas que faltan: no se cambia ni se borra nada de lo actual.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var m = String(r.getResponseText()).match(/[-\w]{25,}/);
  if (!m) { ui.alert('No reconocí el enlace o el id. Copie la dirección completa del libro.'); return; }
  var origen;
  try { origen = SpreadsheetApp.openById(m[0]); } catch (e) { ui.alert('No pude abrir esa copia. Revise que su cuenta tenga acceso.'); return; }
  var plan = [];
  HOJAS_RECUPERABLES.forEach(function (d) {
    var so = [d.hoja].concat(d.alternas).map(function (n) { return origen.getSheetByName(n); }).filter(function (s) { return s; });
    var dest = hoja_(d.hoja); if (!dest || !so.length) return;
    var vd = dest.getDataRange().getValues(), falt = [];
    so.forEach(function (s) { var vo = s.getDataRange().getValues(); if (vo.length > 1) falt = falt.concat(filasFaltantes_(d, vo, vd)); });
    var vistos = {}, unicas = [], cd = {}; vd[0].forEach(function (k, i) { cd[k] = i; });
    falt.forEach(function (f) { var k = d.clave(f, cd); if (!vistos[k]) { vistos[k] = 1; unicas.push(f); } });
    plan.push({ def: d, filas: unicas, dest: dest, cd: cd });
  });
  var total = plan.reduce(function (a, p) { return a + p.filas.length; }, 0);
  var txt = plan.map(function (p) { return p.def.hoja + ': ' + p.filas.length + ' filas que faltan'; }).join('\n');
  var fr = plan.filter(function (p) { return p.def.hoja === 'Registro_Ronda'; })[0], fechas = {};
  if (fr) fr.filas.forEach(function (f) { var d = fechaClave_(f[fr.cd.fecha]); fechas[d] = (fechas[d] || 0) + 1; });
  if (!total) { ui.alert('Nada que recuperar', 'La copia no tiene filas que falten en el libro actual.\n\n' + txt, ui.ButtonSet.OK); return; }
  if (ui.alert('Recuperar rondas', txt + (Object.keys(fechas).length ? '\n\nMarcas de la ronda por fecha:\n' + Object.keys(fechas).sort().map(function (d) { return d + ': ' + fechas[d]; }).join('\n') : '') + '\n\n¿Agregarlas ahora? (no cambia ni borra lo que ya está)', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  plan.forEach(function (p) { p.filas.forEach(function (f) { p.dest.appendRow(f); }); });
  bitacora_('Recuperó rondas desde una copia', txt.replace(/\n/g, ' · '));
  ui.alert('Listo: se agregaron ' + total + ' filas.');
}

/* ---------------- Copias programadas de los libros en Drive (carpeta «App Asistencia») ----------------
 * Cada noche se copian el libro principal, el libro de respaldo de rondas y los libros extra de Parametros (respaldo_libros_extra, ids separados por coma)
 * a «App Asistencia / Respaldos»: Diario (se reemplaza la copia del día y se conservan los últimos respaldo_dias, 3 por defecto), Semanal (una por semana,
 * la primera que se haga cada semana) y Mensual (una por mes). respaldo_semanas y respaldo_meses limitan cuántas se guardan (0 = todas).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco). */
var CARPETA_APP = 'APP ASISTENCIA DOCENTE';   // la carpeta que ya existe en el Drive del propietario (se conserva su enlace); se puede fijar por id en Parametros: carpeta_app_id
function carpetaHija_(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}
/** Carpeta única de la aplicación en el Drive del propietario. TODO lo que el sistema guarda en Drive (respaldos, borradores, soportes, audios, anexos de las comisiones) va dentro de ella. */
function carpetaApp_() {
  var id = parametro_('carpeta_app_id', '');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* si no se puede abrir, se busca por nombre */ } }
  try { var it = DriveApp.getFoldersByName(CARPETA_APP); if (it.hasNext()) return it.next(); } catch (e) { /* sin búsqueda global */ }
  return carpetaHija_(DriveApp.getRootFolder(), CARPETA_APP);
}
function carpetaRespaldos_() {
  return carpetaHija_(carpetaApp_(), 'Respaldos');
}
/**
 * Reúne en «App Asistencia» lo que haya quedado suelto en Drive: la carpeta de soportes de ausencias (y los audios, que van dentro de ella)
 * y los libros (principal y de respaldo de rondas). Los archivos se MUEVEN (no se copian): sus enlaces y permisos siguen igual. Devuelve un resumen.
 */
function reunirEnCarpetaApp_() {
  var app = carpetaApp_(), res = [];
  var sid = parametro_('carpeta_soportes_id', '');
  if (sid) { try { DriveApp.getFolderById(sid).moveTo(app); res.push('✔ carpeta de soportes y audios'); } catch (e) { res.push('✖ carpeta de soportes: ' + e); } }
  else res.push('· no hay carpeta de soportes todavía (se creará dentro de «' + CARPETA_APP + '»)');
  var libros = carpetaHija_(app, 'Libros');
  librosParaRespaldar_().forEach(function (l) {
    try { DriveApp.getFileById(l.id).moveTo(libros); res.push('✔ ' + l.nombre); } catch (e) { res.push('✖ ' + l.nombre + ': ' + e); }
  });
  try { bitacora_('Reunir todo en App Asistencia', res.join(' · ')); } catch (e) { Logger.log(res.join(' · ')); }
  return res.join('\n');
}
function reunirEnCarpetaApp() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Reunir todo en «' + CARPETA_APP + '»', 'Se moverán a la carpeta «' + CARPETA_APP + '» de su Drive la carpeta de soportes y audios y los libros del sistema (principal y de respaldo). No se pierde ningún enlace ni permiso. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  ui.alert('Listo', reunirEnCarpetaApp_(), ui.ButtonSet.OK);
}
function librosParaRespaldar_() {
  var libro = SpreadsheetApp.getActive(), lista = [{ id: libro.getId(), nombre: libro.getName() }];
  var rid = parametro_('respaldo_id', '');
  if (rid) lista.push({ id: rid, nombre: NOMBRE_RESPALDO });
  String(parametro_('respaldo_libros_extra', '')).split(',').forEach(function (x) { x = x.trim(); if (x) lista.push({ id: x, nombre: 'Libro extra ' + x.slice(0, 6) }); });
  return lista;
}
/** Lunes de la semana de la fecha (texto aaaa-mm-dd). */
function lunesDeFecha_(d) { var x = new Date(d.getTime()); var dow = (Number(Utilities.formatDate(x, TZ, 'u')) || 1); x.setDate(x.getDate() - (dow - 1)); return ymd_(x); }
function sufijoFecha_(nombre) { var m = String(nombre).match(/(\d{4}-\d{2}(?:-\d{2})?)$/); return m ? m[1] : ''; }
function copiaUnica_(libro, carpeta, nombre) {
  var it = carpeta.getFilesByName(nombre); while (it.hasNext()) it.next().setTrashed(true);
  DriveApp.getFileById(libro.id).makeCopy(nombre, carpeta);
}
function conservarUltimas_(carpeta, cuantas) {
  if (!cuantas || cuantas < 1) return 0;
  var fs = [], it = carpeta.getFiles(); while (it.hasNext()) { var f = it.next(); fs.push({ f: f, s: sufijoFecha_(f.getName()) }); }
  var fechas = {}; fs.forEach(function (x) { if (x.s) fechas[x.s] = 1; });
  var validas = Object.keys(fechas).sort().reverse().slice(0, cuantas), borradas = 0;
  fs.forEach(function (x) { if (x.s && validas.indexOf(x.s) < 0) { x.f.setTrashed(true); borradas++; } });
  return borradas;
}
/** Hace las copias de hoy (diaria, y semanal/mensual si aún no existen) y poda las viejas. Devuelve un resumen de texto. */
function respaldoProgramado(hoy) {
  var d = hoy || new Date(), raiz = carpetaRespaldos_(), hoyTxt = ymd_(d), res = [];
  var diario = carpetaHija_(raiz, 'Diario'), semanal = carpetaHija_(raiz, 'Semanal'), mensual = carpetaHija_(raiz, 'Mensual');
  var lunes = lunesDeFecha_(d), mes = hoyTxt.slice(0, 7);
  librosParaRespaldar_().forEach(function (l) {
    try {
      copiaUnica_(l, diario, l.nombre + ' · ' + hoyTxt);
      var nS = l.nombre + ' · semana ' + lunes;
      if (!semanal.getFilesByName(nS).hasNext()) copiaUnica_(l, semanal, nS);
      var nM = l.nombre + ' · ' + mes;
      if (!mensual.getFilesByName(nM).hasNext()) copiaUnica_(l, mensual, nM);
      res.push('✔ ' + l.nombre);
    } catch (e) { res.push('✖ ' + l.nombre + ': ' + e); }
  });
  var dias = Number(parametro_('respaldo_dias', 8)) || 8, borr = conservarUltimas_(diario, dias);
  conservarUltimas_(semanal, Number(parametro_('respaldo_semanas', 0)) || 0);
  conservarUltimas_(mensual, Number(parametro_('respaldo_meses', 0)) || 0);
  var cx = ''; try { cx = comisionRespaldarActas_(); } catch (e) { cx = ''; }
  try { var pg = comisionPurgaHistorial_(); if (pg) cx += (cx ? ' · ' : '') + 'historial de comisiones: ' + pg + ' registros viejos borrados'; } catch (e) { /* nada */ }
  var txt = res.join(' · ') + ' · copias diarias viejas borradas: ' + borr + (cx ? ' · ' + cx : '');
  try { bitacora_('Respaldo programado de libros', txt); } catch (e) { Logger.log(txt); }
  return txt;
}
function respaldoLibrosAhora() {
  exigirEditor_();
  var txt = respaldoProgramado(), ui = SpreadsheetApp.getUi();
  ui.alert('Copias hechas', txt.replace(/ · /g, '\n') + '\n\nCarpeta de Drive: ' + CARPETA_APP + ' / Respaldos', ui.ButtonSet.OK);
}
function instalarRespaldoDiario() {
  exigirEditor_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'respaldoProgramado') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('respaldoProgramado').timeBased().everyDays(1).atHour(23).nearMinute(30).create();
  var ui = SpreadsheetApp.getUi();
  ui.alert('Copia diaria programada', 'Cada noche (≈ 11:30 p. m.) se copian los libros a Drive: «' + CARPETA_APP + ' / Respaldos» (Diario: últimos 3 días · Semanal · Mensual).\nPara probar ahora use «Respaldos: copiar libros ahora».', ui.ButtonSet.OK);
}

// ===================== Sesion.gs =====================
/**
 * Ingreso con clave (sin pantallas de Google).
 *
 * La aplicación web se publica "Ejecutar como: yo" y "Cualquier persona": nadie tiene que iniciar sesión en Google ni aceptar permisos
 * ("Google no ha verificado esta aplicación" ya no aparece). En su lugar, cada directivo entra con su nombre y una clave de 6 dígitos
 * que genera el propietario desde el menú del libro. Con una clave correcta el servidor entrega un token aleatorio (se guarda solo su
 * hash en la hoja Sesiones, 14 días) y desde ese momento TODA llamada de las pantallas pasa por llamarSeguro(), que valida el token,
 * toma la identidad del directivo y aplica la matriz de permisos (Api.gs). Las funciones públicas llevan además su propia
 * comprobación de identidad, de modo que nadie puede invocarlas directamente desde la consola del navegador.
 *
 * Claves: se guarda SHA-256(sal + clave), nunca la clave. 5 intentos fallidos bloquean al directivo 15 minutos.
 */
var COL_SESIONES = ['token_hash', 'nombre', 'correo', 'creada', 'expira', 'ultimo_uso'];
var COL_CLAVE = ['pin_hash', 'pin_sal', 'intentos', 'bloqueado_hasta', 'correo', 'informe_dia', 'informe_semana', 'informe_mes', 'clave_temporal', 've_todo', 'cambia_asignacion', 'administra'];
var SESION_DIAS = 14, PIN_INTENTOS = 5, BLOQUEO_MIN = 15;

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}
function ahoraMs_() { return new Date().getTime(); }

/** La hoja Directivos de libros anteriores no tiene las columnas de clave: se agregan al final. */
function hojaDirectivos_() {
  var sh = hoja_('Directivos'), cab = sh.getDataRange().getValues()[0];
  COL_CLAVE.forEach(function (c) { if (cab.indexOf(c) < 0) { sh.getRange(1, cab.length + 1).setValue(c); cab.push(c); } });
  return sh;
}
function filaDirectivo_(nombre) {
  var sh = hojaDirectivos_(), v = sh.getDataRange().getValues(), cab = v[0], col = {};
  cab.forEach(function (k, i) { col[k] = i; });
  for (var i = 1; i < v.length; i++) if (String(v[i][col.nombre]).trim() === String(nombre).trim()) return { sh: sh, fila: i + 1, v: v[i], col: col };
  return null;
}

/** Nombres que se muestran en la pantalla de ingreso (públicos). */
function listarDirectivosPublicos() {
  hojaDirectivos_();
  return datos_('Directivos').map(function (d) { return { nombre: d.nombre, etiqueta: nombreDirectivoCompleto_(d.nombre, d), rol: d.rol, tieneClave: !!String(d.pin_hash || '').trim() }; });
}
/** Nombre completo con apellidos primero (como los docentes). La clave interna de cada directivo no cambia: solo lo que se muestra.
 *  Se toma de la columna opcional «nombre_completo» de la hoja Directivos; si no existe, de esta lista. */
var DIRECTIVOS_COMPLETO = { 'Francisco Cortés': 'Cortés Cabezas Francisco Javier', 'Verónica Barreiro': 'Barreiro Caicedo Carmen Verónica', 'Harold Angulo': 'Angulo Merchancano Harold Wilson', 'Jorge Hernández': 'Hernández Cortés Jorge Enrique' };
function nombreDirectivoCompleto_(nombre, fila) {
  var n = String(nombre || '').trim();
  if (fila && String(fila.nombre_completo || '').trim()) return String(fila.nombre_completo).trim();
  return DIRECTIVOS_COMPLETO[n] || n;
}

function pinValido_(pin) { return /^\d{6}$/.test(String(pin)); }

/** Comprueba la clave de un directivo con control de intentos. Devuelve la fila si es correcta; si no, lanza un error. */
function verificarClave_(nombre, pin) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = filaDirectivo_(nombre);
    if (!d) throw new Error('Nombre o clave incorrectos.');
    var c = d.col, bloq = Number(d.v[c.bloqueado_hasta]) || 0;
    if (bloq > ahoraMs_()) throw new Error('Demasiados intentos. Espere unos minutos e intente de nuevo.');
    if (!String(d.v[c.pin_hash] || '').trim()) throw new Error('Aún no tiene clave. Pídala a quien administra el libro.');
    var ok = pinValido_(pin) && igualConstante_(hash_(d.v[c.pin_sal] + pin), d.v[c.pin_hash]);
    if (!ok) {
      var n = (Number(d.v[c.intentos]) || 0) + 1;
      d.sh.getRange(d.fila, c.intentos + 1).setValue(n >= PIN_INTENTOS ? 0 : n);
      if (n >= PIN_INTENTOS) d.sh.getRange(d.fila, c.bloqueado_hasta + 1).setValue(ahoraMs_() + BLOQUEO_MIN * 60000);
      throw new Error(n >= PIN_INTENTOS ? 'Demasiados intentos. Espere ' + BLOQUEO_MIN + ' minutos.' : 'Nombre o clave incorrectos.');
    }
    d.sh.getRange(d.fila, c.intentos + 1).setValue(0);
    return d;
  } finally { lock.releaseLock(); }
}

/** Inicia sesión. p = {nombre, pin}. Devuelve {token, nombre, rol}. */
function ingresar(p) {
  p = p || {};
  var d = verificarClave_(p.nombre, p.pin);
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var ahora = ahoraMs_(), sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (Number(v[i][4]) < ahora) sh.deleteRow(i + 1);   // limpia sesiones vencidas
  sh.appendRow([hash_(token), d.v[d.col.nombre], String(d.v[d.col.correo_temporal]).toLowerCase(), ahora, ahora + SESION_DIAS * 86400000, ahora]);
  return { token: token, nombre: d.v[d.col.nombre], rol: d.v[d.col.rol], debeCambiar: String(d.v[d.col.clave_temporal] || '') === 'SI' };
}

function cerrarSesion(token) {
  var h = hash_(token || ''), sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (v[i][0] === h) sh.deleteRow(i + 1);
  return { ok: true };
}

function validarToken_(token) {
  if (!token || String(token).length < 40) return null;
  var h = hash_(token), v = hojaOCrea_('Sesiones', COL_SESIONES).getDataRange().getValues(), ahora = ahoraMs_();
  for (var i = 1; i < v.length; i++) if (igualConstante_(v[i][0], h)) {
    if (Number(v[i][4]) <= ahora) return null;
    if (ahora - Number(v[i][5] || 0) > 600000) { try { hojaOCrea_('Sesiones', COL_SESIONES).getRange(i + 1, 6).setValue(ahora); } catch (e) { /* solo informativo */ } }   // último uso (se actualiza cada 10 min como máximo)
    return { nombre: v[i][1], correo: String(v[i][2]).toLowerCase() };
  }
  return null;
}

/** ÚNICA puerta de entrada de las pantallas: valida el token y ejecuta la función permitida con la identidad del directivo. */
var TOKEN_ACTUAL_ = '';   // token de la llamada en curso (para que cambiarClave deje abierta solo la sesión que la cambia)
function llamarSeguro(token, fn, args) {
  var ses = validarToken_(token);
  if (!ses) throw new Error('SESION_VENCIDA');
  TOKEN_ACTUAL_ = token;
  var out = apiDespachar_(ses.correo, fn, args);
  if (!out.ok) throw new Error(out.error);
  return sanearSalida_(out.data);
}

/** Apps Script devuelve null a la pantalla si la respuesta trae objetos Date (las hojas convierten «2026-11-23 08:41» en fecha). Se pasan a texto. */
function sanearSalida_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm');
  if (Array.isArray(v)) return v.map(sanearSalida_);
  if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = sanearSalida_(v[k]); }); return o; }
  return v;
}

/** El directivo cambia su propia clave. p = {actual, nueva} (se ejecuta con su sesión). */
function cambiarClave(p) {
  p = p || {};
  var id = exigirDirectivo_();
  if (!pinValido_(p.nueva)) throw new Error('La clave nueva debe tener 6 números.');
  if (String(p.nueva) === String(p.actual)) throw new Error('La clave nueva debe ser distinta.');
  var d = verificarClave_(id.nombre, p.actual);
  guardarClave_(d, p.nueva);
  /* al cambiar la clave se cierran las demás sesiones abiertas de esa persona (otros teléfonos o computadores): quien tenía la clave anterior sale */
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues(), actual = TOKEN_ACTUAL_ ? hash_(TOKEN_ACTUAL_) : '', cerradas = 0;
  for (var i = v.length - 1; i >= 1; i--) if (v[i][1] === d.v[d.col.nombre] && v[i][0] !== actual) { sh.deleteRow(i + 1); cerradas++; }
  return { ok: true, sesionesCerradas: cerradas };
}
function guardarClave_(d, pin, temporal) {
  var sal = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  d.sh.getRange(d.fila, d.col.pin_sal + 1).setValue(sal);
  d.sh.getRange(d.fila, d.col.pin_hash + 1).setValue(hash_(sal + pin));
  d.sh.getRange(d.fila, d.col.intentos + 1).setValue(0);
  d.sh.getRange(d.fila, d.col.bloqueado_hasta + 1).setValue('');
  d.sh.getRange(d.fila, d.col.clave_temporal + 1).setValue(temporal ? 'SI' : '');
}
function pinAleatorio_() {
  var u = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  return ('00000' + (parseInt(u, 16) % 1000000)).slice(-6);
}

/** Genera una clave nueva para cada directivo (o solo para los que no tienen). Devuelve las claves UNA vez; en la hoja queda solo el hash. */
function generarClavesDirectivos_(soloFaltantes) {
  hojaDirectivos_();
  var out = [];
  datos_('Directivos').forEach(function (x) {
    var d = filaDirectivo_(x.nombre);
    if (soloFaltantes && String(d.v[d.col.pin_hash] || '').trim()) return;
    var pin = pinAleatorio_(); guardarClave_(d, pin, true); out.push({ nombre: x.nombre, pin: pin });
  });
  return out;
}
function generarClavesDirectivos() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi();
  var faltan = datos_('Directivos').filter(function (x) { return !String(x.pin_hash || '').trim(); }).length;
  if (!faltan) { ui.alert('Claves de ingreso', 'Todos los directivos ya tienen clave. Si alguien la olvidó, use "Restablecer la clave de un directivo".', ui.ButtonSet.OK); registrarCorreoPropietario_(); return; }
  var r = ui.alert('Claves de ingreso', 'Se creará una clave TEMPORAL de 6 números para cada directivo que aún no tiene (' + faltan + ') y se mostrará UNA sola vez. Al ingresar por primera vez cada uno elegirá su propia clave. No se tocan las claves ya creadas. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  var cl = generarClavesDirectivos_(true);
  var correoP = registrarCorreoPropietario_();
  ui.alert((correoP ? 'Se registró el correo del propietario (' + correoP + ') para el informe del coordinador académico.\n\n' : '') + 'Anote y entregue a cada persona su clave temporal (no se podrá volver a ver):\n\n' + cl.map(function (x) { return x.nombre + ': ' + x.pin; }).join('\n') +
           '\n\nAl entrar, la aplicación le pedirá elegir su propia clave. Si alguien la olvida: menú "Restablecer la clave de un directivo".');
}

/**
 * Alternativa SIN menú (para ejecutar desde el editor de Apps Script: elegir esta función y pulsar Ejecutar): crea una clave temporal al azar
 * para TODOS los directivos, reemplazando las anteriores, y las escribe en el "Registro de ejecución" del editor (solo lo ve quien administra).
 * Cada directivo debe elegir su clave propia al primer ingreso.
 */
function claveTemporalParaTodosEnRegistro() {
  exigirEditor_();
  var cl = generarClavesDirectivos_(false), correoP = registrarCorreoPropietario_();
  Logger.log('CLAVES TEMPORALES (entréguelas y no las comparta por otro medio):\n' + cl.map(function (x) { return x.nombre + ': ' + x.pin; }).join('\n'));
  return cl;
}

/** Diagnóstico de claves para el administrador (ejecutar desde el editor; solo escribe en el Registro de ejecución, nunca muestra claves). */
function diagnosticoClaves() {
  exigirEditor_();
  hojaDirectivos_();
  var l = [];
  datos_('Directivos').forEach(function (x) {
    var h = String(x.pin_hash || ''), sal = String(x.pin_sal || '');
    l.push(x.nombre + ' · huella ' + (/^[0-9a-f]{64}$/.test(h) ? 'OK' : 'MAL (' + typeof x.pin_hash + ', ' + h.length + ' car.)') + ' · sal ' + (/^[0-9a-f]{64}$/.test(sal) ? 'OK' : 'MAL (' + sal.length + ' car.)') +
      ' · intentos ' + (x.intentos === '' ? 0 : x.intentos) + ' · bloqueado hasta ' + (Number(x.bloqueado_hasta) > ahoraMs_() ? 'SÍ' : 'no') + ' · clave temporal ' + (x.clave_temporal || 'no') + ' · correo_temporal ' + (String(x.correo_temporal || '').trim() ? 'tiene' : 'VACÍO'));
  });
  Logger.log('DIAGNÓSTICO DE CLAVES\n' + l.join('\n'));
}

/** Restablece la clave de UN directivo (solo el propietario del libro): genera una temporal, desbloquea y cierra sus sesiones abiertas. Devuelve la clave una vez. */
function restablecerClave_(nombre, pinElegido) {
  exigirEditor_();
  hojaDirectivos_();
  var d = filaDirectivo_(nombre);
  if (!d) throw new Error('No se encontró a ' + nombre + '.');
  if (pinElegido && !pinValido_(pinElegido)) throw new Error('La clave debe tener 6 números.');
  var pin = pinElegido ? String(pinElegido) : pinAleatorio_(); guardarClave_(d, pin, true);
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (v[i][1] === d.v[d.col.nombre]) sh.deleteRow(i + 1);
  return { nombre: d.v[d.col.nombre], pin: pin };
}
function restablecerClaveDirectivo() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi(), nombres = datos_('Directivos').map(function (x) { return x.nombre; });
  var r = ui.prompt('Restablecer la clave de un directivo', 'Escriba el NÚMERO de la persona:\n\n' + nombres.map(function (n, i) { return (i + 1) + '. ' + n; }).join('\n'), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var n = Number(String(r.getResponseText()).trim());
  if (!(n >= 1 && n <= nombres.length)) { ui.alert('Número no válido.'); return; }
  var r2 = ui.prompt('Clave temporal de ' + nombres[n - 1], 'Escriba la clave temporal de 6 números que quiere asignarle, o deje vacío para que se genere una al azar.', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var elegido = String(r2.getResponseText()).trim();
  var out;
  try { out = restablecerClave_(nombres[n - 1], elegido); } catch (e) { ui.alert(e.message); return; }
  ui.alert('Clave temporal de ' + out.nombre + ': ' + out.pin + '\n\nEntréguesela; al ingresar deberá elegir una clave propia. Se cerraron sus sesiones abiertas.');
}

function correoValido_(c) { c = String(c || '').trim().toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) && !/@example\.com$/.test(c); }

/** El directivo registra su correo (la primera vez que ingresa) y elige qué informes quiere recibir. p = {correo, dia, semana, mes} */
function guardarCorreo(p) {
  p = p || {};
  var id = exigirDirectivo_(), correo = String(p.correo || '').trim().toLowerCase();
  if (!correoValido_(correo)) throw new Error('Escriba un correo válido.');
  var d = filaDirectivo_(id.nombre);
  if (!d) throw new Error('No se encontró su registro.');
  var c = d.col, si = function (v) { return v === false || v === 'NO' ? 'NO' : 'SI'; };
  d.sh.getRange(d.fila, c.correo + 1).setValue(correo);
  d.sh.getRange(d.fila, c.informe_dia + 1).setValue(si(p.dia));
  d.sh.getRange(d.fila, c.informe_semana + 1).setValue(si(p.semana));
  d.sh.getRange(d.fila, c.informe_mes + 1).setValue(si(p.mes));
  return { ok: true };
}
/** Datos del correo del directivo que ingresó (para la pantalla de inicio). */
function estadoCorreo_(id) {
  hojaDirectivos_();
  var d = filaDirectivo_(id.nombre);
  if (!d) return { necesitaCorreo: false };
  var v = d.v, c = d.col, correo = String(v[c.correo] || '').trim();
  return { debeCambiar: String(v[c.clave_temporal] || '') === 'SI', necesitaCorreo: !correo, correo: correo, informes: { dia: String(v[c.informe_dia]) !== 'NO', semana: String(v[c.informe_semana]) !== 'NO', mes: String(v[c.informe_mes]) !== 'NO' } };
}
/** El propietario del libro es el coordinador académico: su correo se registra solo (a los demás se les pide al ingresar). */
function registrarCorreoPropietario_() {
  var dueno = '';
  try { dueno = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { /* sin dato */ }
  if (!dueno) return '';
  hojaDirectivos_();
  var fila = datos_('Directivos').filter(function (x) { return /acad[eé]mico/i.test(String(x.rol)) && !String(x.correo || '').trim(); })[0];
  if (!fila) return '';
  var d = filaDirectivo_(fila.nombre);
  d.sh.getRange(d.fila, d.col.correo + 1).setValue(dueno);
  return dueno;
}

/** Menú: quién tiene sesiones abiertas (por directivo: cuántas, desde cuándo y último uso). Sirve para detectar si alguien usa la sesión de otra persona. */
function verSesionesAbiertas() {
  exigirEditor_();
  var v = hojaOCrea_('Sesiones', COL_SESIONES).getDataRange().getValues(), ahora = ahoraMs_(), por = {};
  for (var i = 1; i < v.length; i++) {
    if (Number(v[i][4]) <= ahora) continue;
    var o = por[v[i][1]] = por[v[i][1]] || { n: 0, desde: Infinity, uso: 0 };
    o.n++; o.desde = Math.min(o.desde, Number(v[i][3])); o.uso = Math.max(o.uso, Number(v[i][5]) || 0);
  }
  var f = function (ms) { return ms && isFinite(ms) ? Utilities.formatDate(new Date(ms), TZ, 'dd/MM HH:mm') : '—'; };
  var txt = Object.keys(por).map(function (n) { return n + ': ' + por[n].n + ' sesión(es) abierta(s) · la más antigua desde ' + f(por[n].desde) + ' · último uso ' + f(por[n].uso); }).join('\n') || 'No hay sesiones abiertas.';
  var ui = SpreadsheetApp.getUi();
  ui.alert('Sesiones abiertas', txt + '\n\nSi alguien tiene más sesiones de las que usa (por ejemplo otra persona con su usuario), restablezca su clave: «Restablecer la clave de un directivo» cierra todas sus sesiones.', ui.ButtonSet.OK);
}

/* ======================================================================================================================
 * Docentes con clave (sin cuenta de Google). Autor del sistema: Francisco Javier Cortés Cabezas.
 *  - Pantalla de ingreso: la persona elige el GRADO que atiende y de ese grado se muestran sus docentes (más orientación y tutoría, que
 *    trabajan con todos); elige su nombre, escribe un correo de contacto (cualquiera, no tiene que ser de Google) y su clave.
 *  - Primera vez: la clave es su número de cédula (hoja reservada Identidad_Docentes: docente, cedula). Al entrar elige una clave propia (6 a 12 números).
 *  - Si la olvida: coordinación la restablece desde el menú del libro (vuelve a su cédula o a la temporal que se escriba).
 *  - 5 intentos fallidos bloquean 15 minutos. Todo se guarda con sal y hash (hoja Claves_Docentes); la cédula nunca viaja a las pantallas.
 *  - Internamente cada docente tiene un correo interno (docNN@docente.icet.local) con una fila en Usuarios: el resto del sistema (permisos de
 *    rol docente, soportes, comisiones) funciona igual y NO ve nada de rondas ni de directivos.
 * ====================================================================================================================== */
var COL_CLAVES_DOC = ['docente', 'pin_hash', 'pin_sal', 'intentos', 'bloqueado_hasta', 'clave_temporal', 'correo_interno', 'creada', 'correo_contacto'];
var COL_IDENTIDAD_DOC = ['docente', 'cedula'];
var DOMINIO_DOC = '@docente.icet.local';
function sinTildesDoc_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function claveDocValida_(pin) { return /^\d{6,12}$/.test(String(pin)); }
function docentesParaClave_() { return datos_('Docentes').filter(function (d) { return d.nivel !== 'REEMPLAZADO' && d.nombre_completo; }); }
function docenteExacto_(nombre) { var n = sinTildesDoc_(nombre); return docentesParaClave_().filter(function (d) { return sinTildesDoc_(d.nombre_completo) === n; })[0] || null; }
function hojaClavesDoc_() { return hojaOCrea_('Claves_Docentes', COL_CLAVES_DOC); }
function filaClaveDoc_(nombre) {
  var sh = hojaClavesDoc_(), v = sh.getDataRange().getValues(), cab = v[0], col = {};
  COL_CLAVES_DOC.forEach(function (k) { if (cab.indexOf(k) < 0) { sh.getRange(1, cab.length + 1).setValue(k); cab.push(k); v[0] = cab; } });
  cab.forEach(function (k, i) { col[k] = i; });
  for (var i = 1; i < v.length; i++) if (sinTildesDoc_(v[i][col.docente]) === sinTildesDoc_(nombre)) return { sh: sh, fila: i + 1, v: v[i], col: col };
  return null;
}
function correoInternoDoc_(d) { return 'doc' + String(d.n || sinTildesDoc_(d.nombre_completo).replace(/[^A-Z0-9]/g, '').slice(0, 12)).toLowerCase() + DOMINIO_DOC; }
function esCorreoInternoDoc_(e) { return String(e || '').toLowerCase().slice(-DOMINIO_DOC.length) === DOMINIO_DOC; }
function cedulaDoc_(nombre) {
  var f = datosOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC).filter(function (x) { return sinTildesDoc_(x.docente) === sinTildesDoc_(nombre); })[0];
  return f ? String(f.cedula == null ? '' : f.cedula).replace(/\D/g, '') : '';
}
function asegurarUsuarioDoc_(d, correo) {
  var sh = hojaOCrea_('Usuarios', COL_USUARIOS), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).toLowerCase() === correo) { if (v[i][2] !== 'ACTIVO') sh.getRange(i + 1, 3).setValue('ACTIVO'); return; }
  sh.appendRow([correo, d.nombre_completo, 'ACTIVO', ahoraTxt_(), '', '', '', 'clave', '']);
}
/** Grados para la pantalla de ingreso: [{codigo, etiqueta}] en orden. */
function listarGradosPublicos() {
  var visto = {}, out = [];
  datos_('Grupos').forEach(function (g) {
    var c = partesGrupo_(g.grupo).grado; if (c === 'N/A' || c === 'ORI' || c === 'PTA' || visto[c]) return; visto[c] = 1;
    out.push({ codigo: c, etiqueta: /^CS/.test(c) ? 'Caminar en Secundaria ' + c.slice(2) : c === '00' ? 'Preescolar (0°)' : Number(c) + '°' + (Number(c) <= 5 ? ' (primaria)' : '') });
  });
  return out.sort(function (a, b) { var x = /^CS/.test(a.codigo) ? 100 + Number(a.codigo.slice(2)) : Number(a.codigo), y = /^CS/.test(b.codigo) ? 100 + Number(b.codigo.slice(2)) : Number(b.codigo); return x - y; });
}
/** Nombres de los docentes de un grado (dirección de grupo y horario) más orientación y tutoría. */
function docentesDelGrado_(grado) {
  var nom = {};
  datos_('Direccion_Grupo').forEach(function (d) { if (partesGrupo_(d.grupo).grado === grado) [d.docente_1, d.docente_2].forEach(function (n) { if (n) nom[sinTildesDoc_(n)] = 1; }); });
  datos_('Horario').forEach(function (h) { if (h.docente && partesGrupo_(h.grupo).grado === grado) nom[sinTildesDoc_(h.docente)] = 1; });
  return docentesParaClave_().filter(function (d) { return nom[sinTildesDoc_(d.nombre_completo)] || /ORIENTACI|TUTORA|PTAFI/i.test(String(d.nivel)); });
}
/** Docentes del grado elegido para la pantalla de ingreso (solo nombres y si ya tienen clave propia). */
function listarDocentesPublicos(grado) {
  hojaClavesDoc_();
  var con = {}; datos_('Claves_Docentes').forEach(function (c) { if (String(c.pin_hash || '').trim() && String(c.clave_temporal || '') !== 'SI') con[sinTildesDoc_(c.docente)] = 1; });
  var lista = grado ? docentesDelGrado_(String(grado)) : docentesParaClave_();
  return lista.map(function (d) { return { nombre: d.nombre_completo, tieneClave: !!con[sinTildesDoc_(d.nombre_completo)] }; })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
}
function verificarClaveDoc_(nombre, pin) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var doc = docenteExacto_(nombre); if (!doc) throw new Error('Nombre o clave incorrectos.');
    var d = filaClaveDoc_(doc.nombre_completo);
    if (!d) { hojaClavesDoc_().appendRow([doc.nombre_completo, '', '', 0, '', '', correoInternoDoc_(doc), ahoraTxt_(), '']); d = filaClaveDoc_(doc.nombre_completo); }
    var c = d.col, bloq = Number(d.v[c.bloqueado_hasta]) || 0;
    if (bloq > ahoraMs_()) throw new Error('Demasiados intentos. Espere unos minutos e intente de nuevo.');
    var ok = false, primera = false;
    if (String(d.v[c.pin_hash] || '').trim()) ok = /^\d{4,12}$/.test(String(pin)) && igualConstante_(hash_(d.v[c.pin_sal] + pin), d.v[c.pin_hash]);
    else {   // primera vez: la clave es la cédula registrada por coordinación
      var ced = cedulaDoc_(doc.nombre_completo);
      if (!ced) throw new Error('Coordinación aún no registró su cédula. Avise a coordinación.');
      ok = igualConstante_(String(pin).replace(/\D/g, ''), ced); primera = ok;
    }
    if (!ok) {
      var n = (Number(d.v[c.intentos]) || 0) + 1;
      d.sh.getRange(d.fila, c.intentos + 1).setValue(n >= PIN_INTENTOS ? 0 : n);
      if (n >= PIN_INTENTOS) d.sh.getRange(d.fila, c.bloqueado_hasta + 1).setValue(ahoraMs_() + BLOQUEO_MIN * 60000);
      throw new Error(n >= PIN_INTENTOS ? 'Demasiados intentos. Espere ' + BLOQUEO_MIN + ' minutos.' : 'Nombre o clave incorrectos.');
    }
    d.sh.getRange(d.fila, c.intentos + 1).setValue(0);
    if (primera) guardarClaveDoc_(d, String(pin).replace(/\D/g, ''), true);   // queda como temporal: debe elegir la suya
    return { d: d, doc: doc, temp: primera || String(d.v[c.clave_temporal] || '') === 'SI' };
  } finally { lock.releaseLock(); }
}
function guardarClaveDoc_(d, pin, temporal) {
  var sal = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  d.sh.getRange(d.fila, d.col.pin_sal + 1).setValue(sal);
  d.sh.getRange(d.fila, d.col.pin_hash + 1).setValue(hash_(sal + pin));
  d.sh.getRange(d.fila, d.col.intentos + 1).setValue(0);
  d.sh.getRange(d.fila, d.col.bloqueado_hasta + 1).setValue('');
  d.sh.getRange(d.fila, d.col.clave_temporal + 1).setValue(temporal ? 'SI' : '');
}
function abrirSesionDoc_(nombre, correo, debeCambiar) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var ahora = ahoraMs_(), sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (Number(v[i][4]) < ahora) sh.deleteRow(i + 1);
  sh.appendRow([hash_(token), nombre, correo, ahora, ahora + SESION_DIAS * 86400000, ahora]);
  return { token: token, nombre: nombre, rol: 'docente', debeCambiar: !!debeCambiar };
}
var DOMINIOS_ERRATA_ = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmil.com': 'gmail.com', 'gmail.cm': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hormail.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahoo.es.com': 'yahoo.es', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com' };
/** Revisa un correo lo mejor posible sin poder verificarlo: forma válida, sin errores comunes de escritura. Devuelve {ok, correo, msg}. */
function correoRevisar_(e) {
  var c = String(e == null ? '' : e).trim().toLowerCase().replace(/\s+/g, '');
  if (!c) return { ok: false, correo: '', msg: 'Escriba su correo electrónico.' };
  if (c.length > 254 || !/^[a-z0-9._%+\-]{1,64}@([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(c) || /\.\./.test(c) || /^\.|\.@|@\.|@-/.test(c)) return { ok: false, correo: c, msg: 'El correo no es válido. Debe verse así: nombre@gmail.com' };
  var dom = c.split('@')[1];
  if (DOMINIOS_ERRATA_[dom]) return { ok: false, correo: c, msg: '¿Quiso escribir ' + c.split('@')[0] + '@' + DOMINIOS_ERRATA_[dom] + '?' };
  return { ok: true, correo: c, msg: '' };
}
function correoValidoDoc_(e) { return correoRevisar_(e).ok; }
/** Ingreso de un docente. p = {nombre, pin, correo (la primera vez, cualquier proveedor)}. */
function ingresarDocente(p) {
  p = p || {};
  var r = verificarClaveDoc_(p.nombre, p.pin), d = r.d, doc = r.doc, correo = correoInternoDoc_(doc);
  var rc = correoRevisar_(p.correo), sinCorreo = !String(d.v[d.col.correo_contacto] || '').trim();
  if (rc.ok) d.sh.getRange(d.fila, d.col.correo_contacto + 1).setValue(rc.correo);
  else if (r.temp && sinCorreo) throw new Error(rc.msg);   // la primera vez el correo es obligatorio y debe verse válido
  asegurarUsuarioDoc_(doc, correo);
  return abrirSesionDoc_(doc.nombre_completo, correo, r.temp);
}
/** El docente cambia su propia clave. p = {actual, nueva}. Sirve también para reemplazar la clave inicial (la cédula). */
function cambiarClaveDocente(p) {
  p = p || {};
  var id = identidad_();
  if (id.rol !== 'docente' || !esCorreoInternoDoc_(id.email)) throw new Error('Solo un docente que entró con clave puede cambiarla aquí.');
  if (!claveDocValida_(p.nueva)) throw new Error('La clave nueva debe tener de 6 a 12 números.');
  if (String(p.nueva) === String(p.actual)) throw new Error('La clave nueva debe ser distinta.');
  var r = verificarClaveDoc_(id.docente, p.actual);
  guardarClaveDoc_(r.d, String(p.nueva), false);
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues(), actual = TOKEN_ACTUAL_ ? hash_(TOKEN_ACTUAL_) : '', cerradas = 0;
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][2]).toLowerCase() === id.email && v[i][0] !== actual) { sh.deleteRow(i + 1); cerradas++; }
  return { ok: true, sesionesCerradas: cerradas };
}
/** ¿Esta persona (docente con clave) debe elegir una clave nueva? Lo usa contextoPanel. */
function docenteDebeCambiarClave_(id) {
  if (!id || id.rol !== 'docente' || !esCorreoInternoDoc_(id.email)) return false;
  var d = filaClaveDoc_(id.docente);
  return !!(d && String(d.v[d.col.clave_temporal] || '') === 'SI');
}
/** Coordinación: restablece la clave de un docente (vuelve a su cédula, o a la temporal que se escriba) y cierra sus sesiones. */
function restablecerClaveDocente_(nombre, pinElegido) {
  exigirEditor_();
  var doc = docenteExacto_(nombre); if (!doc) throw new Error('No se encontró a ' + nombre + '.');
  var pin = String(pinElegido || '').trim() || cedulaDoc_(doc.nombre_completo);
  if (!pin) throw new Error('Esa persona no tiene cédula registrada en la hoja Identidad_Docentes: escriba una clave temporal de 6 a 12 números.');
  if (!claveDocValida_(pin)) throw new Error('La clave temporal debe tener de 6 a 12 números.');
  var correo = correoInternoDoc_(doc), d = filaClaveDoc_(doc.nombre_completo);
  if (!d) { hojaClavesDoc_().appendRow([doc.nombre_completo, '', '', 0, '', '', correo, ahoraTxt_(), '']); d = filaClaveDoc_(doc.nombre_completo); }
  guardarClaveDoc_(d, pin, true); asegurarUsuarioDoc_(doc, correo);
  var sh = hojaOCrea_('Sesiones', COL_SESIONES), v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][2]).toLowerCase() === correo) sh.deleteRow(i + 1);
  return { nombre: doc.nombre_completo, pin: pin, esCedula: !pinElegido };
}
function restablecerClaveDocente() {
  exigirEditor_();
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('Restablecer la clave de un docente', 'Escriba el apellido o parte del nombre del docente:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var q = sinTildesDoc_(r.getResponseText()); if (!q) return;
  var hall = docentesParaClave_().filter(function (d) { return sinTildesDoc_(d.nombre_completo).indexOf(q) >= 0; });
  if (!hall.length) { ui.alert('No encontré a nadie con «' + r.getResponseText() + '».'); return; }
  var elegido = hall[0];
  if (hall.length > 1) {
    var r1 = ui.prompt('Varios docentes', 'Escriba el NÚMERO:\n\n' + hall.slice(0, 15).map(function (d, i) { return (i + 1) + '. ' + d.nombre_completo; }).join('\n'), ui.ButtonSet.OK_CANCEL);
    if (r1.getSelectedButton() !== ui.Button.OK) return;
    var n = Number(String(r1.getResponseText()).trim()); if (!(n >= 1 && n <= Math.min(15, hall.length))) { ui.alert('Número no válido.'); return; }
    elegido = hall[n - 1];
  }
  var r2 = ui.prompt('Clave de ' + elegido.nombre_completo, 'Deje vacío para que la clave vuelva a ser su número de cédula, o escriba una clave temporal de 6 a 12 números.', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var out; try { out = restablecerClaveDocente_(elegido.nombre_completo, String(r2.getResponseText()).trim()); } catch (e) { ui.alert(e.message); return; }
  ui.alert(out.nombre + ': ' + (out.esCedula ? 'su clave volvió a ser su número de cédula.' : 'clave temporal ' + out.pin + '.') + '\n\nAl ingresar deberá elegir una clave propia. Se cerraron sus sesiones abiertas.');
}
function verDocentesActivos() {
  exigirEditor_();
  var act = {}; datos_('Claves_Docentes').forEach(function (c) { if (String(c.pin_hash || '').trim() && String(c.clave_temporal || '') !== 'SI') act[sinTildesDoc_(c.docente)] = 1; });
  var todos = docentesParaClave_(), faltan = todos.filter(function (d) { return !act[sinTildesDoc_(d.nombre_completo)]; }),
      sinCed = todos.filter(function (d) { return !cedulaDoc_(d.nombre_completo); });
  SpreadsheetApp.getUi().alert('Docentes con clave propia: ' + (todos.length - faltan.length) + ' de ' + todos.length + '\n\nFaltan por entrar y elegir su clave:\n' + (faltan.map(function (d) { return '· ' + d.nombre_completo; }).join('\n') || 'ninguno') +
    (sinCed.length ? '\n\nSin cédula en la hoja Identidad_Docentes (no podrán entrar la primera vez):\n' + sinCed.map(function (d) { return '· ' + d.nombre_completo; }).join('\n') : ''));
}


/* ------------------------------ coordinación: agregar o editar docentes y sus datos ------------------------------ */
var NIVELES_DOC = ['SECUNDARIA', 'PRIMARIA', 'PREESCOLAR', 'ORIENTACIÓN', 'TUTORA PTAFI', 'REEMPLAZADO'];
function exigirAdminDocentes_() {
  var id = identidad_();
  if (id.rol !== 'directivo' || !puedeAdministrar_(id)) throw new Error('Solo coordinación académica o quien administra puede ver y editar los datos de los docentes.');
  return id;
}
function listarDocentesAdmin() {
  exigirAdminDocentes_();
  return datos_('Docentes').map(function (d) {
    return { n: d.n, nombre_completo: d.nombre_completo, apellidos: d.apellidos, nombres: d.nombres, nivel: d.nivel, direccion_grupo: d.direccion_grupo || '', areas: d.areas || '', nota: d.nota || '',
      cedula: cedulaDoc_(d.nombre_completo) ? 'sí' : '', correo: (typeof comisionCorreoDe_ === 'function' ? comisionCorreoDe_(d.nombre_completo) : '') };
  }).sort(function (a, b) { return String(a.nombre_completo).localeCompare(String(b.nombre_completo), 'es'); });
}
function celdaPorNombre_(sh, fila, cab, nombre, valor) { var i = cab.indexOf(nombre); if (i >= 0) sh.getRange(fila, i + 1).setValue(valor); }
/** p = {actual (nombre completo si edita; vacío si es nuevo), apellidos, nombres, nivel, direccion_grupo, areas, cedula, correo, nota}. */
function guardarDocenteAdmin(p) {
  var id = exigirAdminDocentes_(); p = p || {};
  var sh = hoja_('Docentes'), v = sh.getDataRange().getValues(), cab = v[0], ap = String(p.apellidos || '').trim().replace(/\s+/g, ' '), nm = String(p.nombres || '').trim().replace(/\s+/g, ' ');
  if (!ap || !nm) throw new Error('Escriba los apellidos y los nombres.');
  var nivel = String(p.nivel || 'SECUNDARIA').toUpperCase(); if (NIVELES_DOC.indexOf(nivel) < 0) throw new Error('Elija el nivel.');
  var ced = String(p.cedula || '').replace(/\D/g, ''); if (ced && !/^\d{5,12}$/.test(ced)) throw new Error('La cédula debe tener entre 5 y 12 números.');
  var mail = String(p.correo || '').trim(), rc = mail ? correoRevisar_(mail) : { ok: true, correo: '' }; if (!rc.ok) throw new Error(rc.msg);
  var completo = (ap + ' ' + nm).trim(), colN = cab.indexOf('nombre_completo'), colNum = cab.indexOf('n'), fila = 0, maxN = 0, actual = String(p.actual || '').trim();
  for (var i = 1; i < v.length; i++) {
    maxN = Math.max(maxN, Number(v[i][colNum]) || 0);
    if (actual && sinTildesDoc_(v[i][colN]) === sinTildesDoc_(actual)) fila = i + 1;
    else if (sinTildesDoc_(v[i][colN]) === sinTildesDoc_(completo) && (!actual || sinTildesDoc_(actual) !== sinTildesDoc_(completo))) throw new Error('Ya existe un docente con ese nombre.');
  }
  if (actual && !fila) throw new Error('No se encontró al docente que se quiere editar.');
  if (!fila) {
    var n = maxN + 1, nueva = cab.map(function (c) { return ''; });
    var set = { codigo: 'D' + ('00' + n).slice(-3), n: n, apellidos: ap, nombres: nm, nombre_completo: completo, nivel: nivel, direccion_grupo: String(p.direccion_grupo || ''), areas: String(p.areas || ''), tiene_horario: 'NO', nota: String(p.nota || '') };
    Object.keys(set).forEach(function (k) { var j = cab.indexOf(k); if (j >= 0) nueva[j] = set[k]; });
    sh.appendRow(nueva);
  } else {
    var nuevo = { apellidos: ap, nombres: nm, nombre_completo: completo, nivel: nivel, direccion_grupo: String(p.direccion_grupo || ''), areas: String(p.areas || ''), nota: String(p.nota || '') };
    Object.keys(nuevo).forEach(function (k) { celdaPorNombre_(sh, fila, cab, k, nuevo[k]); });
  }
  if (ced) {
    var hi = hojaOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC), vi = hi.getDataRange().getValues(), fi = 0, base = actual || completo;
    for (var k = 1; k < vi.length; k++) if (sinTildesDoc_(vi[k][0]) === sinTildesDoc_(base)) fi = k + 1;
    if (fi) { hi.getRange(fi, 1).setValue(completo); hi.getRange(fi, 2).setValue(ced); } else hi.appendRow([completo, ced]);
  }
  if (rc.correo) {
    var d = filaClaveDoc_(completo) || filaClaveDoc_(actual || completo);
    if (!d) { hojaClavesDoc_().appendRow([completo, '', '', 0, '', '', '', ahoraTxt_(), rc.correo]); }
    else d.sh.getRange(d.fila, d.col.correo_contacto + 1).setValue(rc.correo);
  }
  try { invalidarCache_('Docentes'); } catch (e) { /* sin caché */ }
  try { bitacora_(fila ? 'Docente editado' : 'Docente agregado', completo + ' · por ' + (id.nombre || id.email)); } catch (e) { /* solo informativo */ }
  return { ok: true, nombre: completo, nuevo: !fila, aviso: !fila ? 'Se agregó sin horario (tiene_horario = NO). Cuando cargue su horario en la hoja Horario, cambie esa columna a SI.' : '' };
}

// ===================== Comisiones.gs =====================
/**
 * Comisiones de evaluación y promoción: el acta del grado que arman entre todos los docentes.
 *
 * Una acta = un grado en un periodo del año. Se guarda en tres hojas del libro:
 *  - Comision_Actas:     una fila por acta (estado ABIERTA / CERRADA, responsable del cierre, número de acta, hora de cierre).
 *  - Comision_Secciones: una fila por sección y acta (JSON + versión). Cada docente guarda SU sección (su curso o su área) y así no se pisan.
 *  - Comision_Log:       quién hizo qué (confirmaciones, reaperturas, cierres, soportes).
 *
 * Reglas (acordadas con la coordinación académica):
 *  - Matrícula y reconocimientos se confirman por curso; lo confirmado queda OFICIAL y se bloquea para el docente. Solo coordinación académica
 *    (quien administra) lo reabre, con justificación escrita (mínimo 10 caracteres) que queda en el registro.
 *  - La matrícula debe cuadrar. En el acta final, promovidos + no promovidos = matrícula actual de cada curso.
 *  - Los requisitos previos (notas cargadas, planillas, resúmenes, cuadernos, observaciones, información faltante) se verifican antes de iniciar.
 *  - El cierre lo propone una persona y lo confirman todos los integrantes (o se excluyen los no conectados); la hora de cierre la pone el sistema.
 *  - Quien no firma se entiende que no asistió. La firma se pone al finalizar en el acta impresa, junto a la cédula y el celular o correo del integrante.
 *  - Los informes que ven los docentes se calculan por reglas; la IA (si se activa) es solo para directivos y no vive aquí.
 * TODO en Drive vive en una sola carpeta, «APP ASISTENCIA DOCENTE»: COMISIONES año / Comisiones Evaluación P1 ICET año / Grado X / Anexos (PIAR, DUA, compromisos) y / Borradores (copia legible de lo que se lleva).
 * Los respaldos de los libros van en «App Asistencia / Respaldos» (Respaldo.gs).
 * Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
 */
var COL_CACTAS = ['id', 'anio', 'periodo', 'grado', 'acta_no', 'estado', 'responsable', 'creada_por', 'fecha_creacion', 'cerrada_por', 'fecha_cierre', 'hora_cierre', 'reaperturas'];
var COL_CSEC = ['acta_id', 'seccion', 'version', 'json', 'actualizado_por', 'fecha'];
var COL_CLOG = ['fecha', 'acta_id', 'usuario', 'accion', 'detalle'];
var COL_CHIST = ['fecha', 'acta_id', 'seccion', 'version', 'por', 'json'];
var COL_CHOJA = ['id', 'fecha', 'por', 'hoja', 'fila', 'columna', 'anterior', 'nuevo', 'acta_id'];
var COM_HIST_DIAS = 8;   // se conserva una semana (más un día) de versiones anteriores y de cambios en hojas
var PERIODOS_COM = ['Primero', 'Segundo', 'Tercero', 'Final'];
var LIM_RECONOC = [1, 2, 2];                  // cupos por curso: excelencia, rendimiento académico, convivencia escolar
var MAX_JSON_SECCION = 45000;                  // una celda de Sheets admite 50.000 caracteres
var MAX_BYTES_COM = 8 * 1024 * 1024;
var MIME_COM = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
var SECCIONES_COM = /^(general|integrantes|requisitos|firmas|faltantes|listos|presencia|(matricula|estudiantes|reconocimientos|promocion|obs):[0-9A-Za-z]+|(areas|recomendaciones):.{1,80})$/;

/* ------------------------------ hojas y registro ------------------------------ */
function comisionPrepararHojas() {
  hojaOCrea_('Comision_Actas', COL_CACTAS); hojaOCrea_('Comision_Secciones', COL_CSEC); hojaOCrea_('Comision_Log', COL_CLOG);
  return 'Hojas de comisiones listas.';
}
function comisionLog_(acta, usuario, accion, detalle) {
  hojaOCrea_('Comision_Log', COL_CLOG).appendRow([ahoraTxt_(), acta, usuario, accion, String(detalle || '').slice(0, 500)]);
}
/** Hojas de cálculo convierte «05» en el número 5 al guardar: el código de grado se normaliza siempre a dos cifras (00-11) o CS1/CS2. */
function comisionGradoKey_(v, periodo) { var s = String(v == null ? '' : v).trim(); s = /^\d$/.test(s) ? '0' + s : s; return comisionUnion_(periodo)[s] || s; }
/** Actas vigentes (las marcadas DUPLICADA por la unificación no se muestran). */
function comisionActas_() { return datosOCrea_('Comision_Actas', COL_CACTAS).map(function (a) { a.grado = comisionGradoKey_(a.grado, a.periodo); return a; }).filter(function (a) { return !/^(DUPLICADA|ARCHIVADA|BORRADA)$/.test(String(a.estado)); }); }
/** Cuántas partes (secciones) tiene guardadas cada acta. */
function comisionContarSecciones_() { var c = {}; datosOCrea_('Comision_Secciones', COL_CSEC).forEach(function (s) { c[String(s.acta_id)] = (c[String(s.acta_id)] || 0) + 1; }); return c; }
function comisionActa_(id) {
  var a = comisionActas_().filter(function (x) { return String(x.id) === String(id); })[0];
  if (!a) throw new Error('No existe esa acta.');
  return a;
}
function comisionFilaActa_(id) {
  var v = hojaOCrea_('Comision_Actas', COL_CACTAS).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) return i + 1;
  return 0;
}
function comisionSecciones_(id) {
  var out = {};
  datosOCrea_('Comision_Secciones', COL_CSEC).forEach(function (s) {
    if (String(s.acta_id) !== String(id)) return;
    var d = null; try { d = JSON.parse(s.json); } catch (e) { d = null; }
    out[s.seccion] = { version: Number(s.version) || 0, datos: d, por: s.actualizado_por, fecha: String(s.fecha) };
  });
  return out;
}
/** Escribe (o crea) una sección. Uso interno: la verificación de permisos va antes. */
function comisionEscribe_(id, seccion, datos, por) {
  var sh = hojaOCrea_('Comision_Secciones', COL_CSEC), v = sh.getDataRange().getValues(), json = JSON.stringify(datos == null ? null : datos);
  if (json.length > MAX_JSON_SECCION) throw new Error('La sección «' + seccion + '» es demasiado grande (' + json.length + ' caracteres; el máximo es ' + MAX_JSON_SECCION + ').');
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id) && v[i][1] === seccion) {
      var nv = (Number(v[i][2]) || 0) + 1;
      try { comisionHistoria_(id, seccion, v[i][2], v[i][3], v[i][4]); } catch (eh) { /* el historial nunca impide guardar */ }
      sh.getRange(i + 1, 3, 1, 4).setValues([[nv, json, por, ahoraTxt_()]]);
      return nv;
    }
  }
  sh.appendRow([id, seccion, 1, json, por, ahoraTxt_()]);
  return 1;
}

/** Guarda el estado ANTERIOR de la sección para poder retroceder; no más de una vez cada 10 minutos por sección. */
function comisionHistoria_(id, seccion, version, json, porAnterior) {
  if (!json || String(json).length < 3) return;
  var clave = 'ch:' + String(id).slice(0, 8) + ':' + seccion, c = null;
  try { c = CacheService.getScriptCache(); if (c.get(clave)) return; } catch (e) { c = null; }
  hojaOCrea_('Comision_Historial', COL_CHIST).appendRow([ahoraTxt_(), id, seccion, version, porAnterior, String(json)]);
  try { if (c) c.put(clave, '1', 600); } catch (e) { /* sin caché: se guarda cada vez */ }
}
/** Un cambio de una celda en las hojas del libro, con su valor anterior (para deshacerlo). */
function comisionSetHoja_(sh, fila, col, nombreCol, valor, por, acta) {
  var ant = sh.getRange(fila, col).getValue();
  if (String(ant) === String(valor)) return;
  sh.getRange(fila, col).setValue(valor);
  hojaOCrea_('Comision_CambiosHojas', COL_CHOJA).appendRow([Utilities.getUuid(), ahoraTxt_(), por || '', sh.getName(), fila, nombreCol, String(ant), String(valor), acta || '']);
}
/** Versiones anteriores del acta y cambios hechos en las hojas (solo directivos o personas con control total). */
function comisionHistorial(p) {
  var quien = comisionQuien_(), a = comisionActa_((p || {}).acta);
  if (quien.rol !== 'directivo' && !quien.total) throw new Error('Solo coordinación, directivos o quien tenga control total ve el historial.');
  var hs = hojaOCrea_('Comision_Historial', COL_CHIST), v = hs.getDataRange().getValues(), sec = [];
  for (var i = v.length - 1; i >= 1 && sec.length < 150; i--) if (String(v[i][1]) === String(a.id)) sec.push({ fila: i + 1, fecha: String(v[i][0]), seccion: String(v[i][2]), version: v[i][3], por: String(v[i][4]), bytes: String(v[i][5]).length });
  var ch = hojaOCrea_('Comision_CambiosHojas', COL_CHOJA), w = ch.getDataRange().getValues(), hoj = [];
  for (var j = w.length - 1; j >= 1 && hoj.length < 150; j--) if (String(w[j][8]) === String(a.id)) hoj.push({ id: String(w[j][0]), fecha: String(w[j][1]), por: String(w[j][2]), hoja: String(w[j][3]), columna: String(w[j][5]), anterior: String(w[j][6]), nuevo: String(w[j][7]) });
  return { secciones: sec, hojas: hoj, dias: COM_HIST_DIAS, puedeDeshacerHojas: !!quien.coord };
}
/** Vuelve una sección del acta a una versión anterior (queda como versión nueva; la actual pasa al historial). */
function comisionRestaurar(p) {
  var quien = comisionQuien_(); p = p || {};
  if (quien.rol !== 'directivo' && !quien.total) throw new Error('Solo coordinación, directivos o quien tenga control total puede restaurar.');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
    var hs = hojaOCrea_('Comision_Historial', COL_CHIST), f = Number(p.fila), fila = f >= 2 ? hs.getRange(f, 1, 1, 6).getValues()[0] : null;
    if (!fila || String(fila[1]) !== String(a.id) || String(fila[0]) !== String(p.fecha)) throw new Error('Esa versión ya no está disponible.');
    var seccion = String(fila[2]); if (!SECCIONES_COM.test(seccion)) throw new Error('Sección no válida.');
    var datos = JSON.parse(String(fila[5])), c = null; try { c = CacheService.getScriptCache(); c.remove('ch:' + String(a.id).slice(0, 8) + ':' + seccion); } catch (e) { c = null; }
    var v = comisionEscribe_(a.id, seccion, datos, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'RESTAURAR', seccion + ' ← versión del ' + fila[0]);
    return { ok: true, version: v, seccion: seccion };
  } finally { lock.releaseLock(); }
}
/** Devuelve una celda de las hojas a su valor anterior (solo coordinación académica). */
function comisionHojaDeshacer(p) {
  var quien = comisionQuien_(); p = p || {};
  if (!quien.coord) throw new Error('Solo coordinación académica deshace cambios en las hojas.');
  var ch = hojaOCrea_('Comision_CambiosHojas', COL_CHOJA), w = ch.getDataRange().getValues(), reg = null;
  for (var j = 1; j < w.length; j++) if (String(w[j][0]) === String(p.id)) { reg = w[j]; break; }
  if (!reg) throw new Error('Ese cambio ya no está disponible.');
  var sh = SpreadsheetApp.getActive().getSheetByName(String(reg[3])); if (!sh) throw new Error('La hoja ya no existe.');
  var col = 0, h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  for (var k = 0; k < h.length; k++) if (String(h[k]) === String(reg[5])) col = k + 1;
  if (!col) throw new Error('La columna ya no existe.');
  comisionSetHoja_(sh, Number(reg[4]), col, String(reg[5]), String(reg[6]), quien.nombre, String(reg[8]));
  comisionLog_(String(reg[8]), quien.nombre, 'DESHACER_HOJA', reg[3] + ' fila ' + reg[4] + ' · ' + reg[5]);
  return { ok: true };
}
/** Cada noche (Respaldo.gs): borra del historial lo que tiene más de COM_HIST_DIAS días. */
function comisionPurgaHistorial_() {
  var corte = Utilities.formatDate(new Date(Date.now() - COM_HIST_DIAS * 86400000), TZ, 'yyyy-MM-dd HH:mm'), n = 0;
  [['Comision_Historial', COL_CHIST, 0], ['Comision_CambiosHojas', COL_CHOJA, 1]].forEach(function (x) {
    var sh = hojaOCrea_(x[0], x[1]), v = sh.getDataRange().getValues();
    for (var i = v.length - 1; i >= 1; i--) if (String(v[i][x[2]]) < corte) { sh.deleteRow(i + 1); n++; }
  });
  return n;
}

/* ------------------------------ quién es y qué le corresponde ------------------------------ */
function comisionQuien_() {
  var id = identidad_();
  if (id.rol === 'directivo') return { rol: 'directivo', nombre: nombreDirectivoCompleto_(id.nombre) || id.email, email: id.email, coord: puedeAdministrar_(id) };
  if (id.rol === 'docente') {
    if (!id.autorizado && !id.preregistro) { /* mismo criterio que el resto: el docente debe haber aceptado la autorización al registrarse */ }
    return { rol: 'docente', nombre: id.docente, email: id.email, coord: false, total: comisionControlTotal_().indexOf(comisionSinTildes_(id.docente)) >= 0 };
  }
  throw new Error('Debe iniciar sesión con una cuenta autorizada.');
}
function comisionSinTildes_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
/** Cursos (grupos) que dirige y áreas que dicta el docente en un grado. Coordinación y rectoría ven todo. */
/* Permisos por nivel (configurables por coordinación): ver y editar las actas. Valor por defecto: todos pueden ver y editar. */
var COM_NIVELES_PERM = [['PRIMARIA', 'Docentes de preescolar y primaria'], ['SECUNDARIA', 'Docentes de secundaria y media'], ['ORIENTACION', 'Docentes orientadoras'], ['PTAFI', 'Tutora PTAFI']];
function comisionNivelPerm_(nombre) {
  var d = datos_('Docentes').filter(function (x) { return comisionSinTildes_(x.nombre_completo) === comisionSinTildes_(nombre); })[0], n = comisionSinTildes_(d ? d.nivel : '');
  if (/ORIENTACI/.test(n)) return 'ORIENTACION';
  if (/PTAFI|TUTOR/.test(n)) return 'PTAFI';
  if (/PREESC|PRIMARIA|TRANSICI/.test(n)) return 'PRIMARIA';
  return 'SECUNDARIA';
}
function comisionPermisosConfig_() {
  var c = {}; try { c = JSON.parse(parametro_('comisiones_permisos', '')) || {}; } catch (e) { c = {}; }
  COM_NIVELES_PERM.forEach(function (n) { var x = c[n[0]] || {}; c[n[0]] = { ver: x.ver !== false, editar: x.editar !== false && x.ver !== false }; });
  return c;
}
function comisionControlTotal_() { var c = []; try { c = JSON.parse(parametro_('comisiones_controltotal', '[]')) || []; } catch (e) { c = []; } return c.map(comisionSinTildes_); }
function comisionPermisoNivel_(quien) { return quien.rol === 'docente' && !quien.total ? comisionPermisosConfig_()[comisionNivelPerm_(quien.nombre)] : { ver: true, editar: true }; }
function comisionPermisosLeer() {
  var quien = comisionQuien_(); if (quien.rol !== 'directivo') throw new Error('Solo directivos.');
  var tot = []; try { tot = JSON.parse(parametro_('comisiones_controltotal', '[]')) || []; } catch (e) { tot = []; }
  return { niveles: COM_NIVELES_PERM.map(function (n) { return { clave: n[0], nombre: n[1] }; }), config: comisionPermisosConfig_(), total: tot, docentes: datos_('Docentes').map(function (d) { return String(d.nombre_completo); }).filter(Boolean).sort(function (a, b) { return a.localeCompare(b, 'es'); }), puedeEditar: !!quien.coord };
}
function comisionPermisosGuardar(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica cambia estos permisos.');
  var c = {}; COM_NIVELES_PERM.forEach(function (n) { var x = ((p || {}).config || {})[n[0]] || {}; c[n[0]] = { ver: x.ver !== false, editar: x.editar !== false && x.ver !== false }; });
  guardarParametro_('comisiones_permisos', JSON.stringify(c));
  var tot = (((p || {}).total) || []).map(String).filter(function (n) { return n && n.length < 120; }).slice(0, 60);
  guardarParametro_('comisiones_controltotal', JSON.stringify(tot));
  return { ok: true, config: c, total: tot };
}
/* Turno de edición (decisión del coordinador, 2026-11-23): todos pueden editar, pero en cada acta solo UNA persona a la vez (el «responsable del registro»), que puede soltar o pasar el turno.
   Directivos (coordinación, desarrollador, rectoría) editan siempre. Firmas, declaraciones, revisión, presencia y datos faltantes son de cada quien y siempre se pueden escribir. */
var COM_INACTIVO_MIN = 15;
function comisionEditorActivo_(acta, secs) {
  var pr = ((secs && secs.presencia && secs.presencia.datos) || {}).pers || {}, x = pr[acta.responsable];
  if (!x || !x.visto || x.dia !== Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')) return false;
  var m = /^(\d\d):(\d\d)$/.exec(String(x.visto)); if (!m) return false;
  var ahora = Number(Utilities.formatDate(new Date(), TZ, 'HH')) * 60 + Number(Utilities.formatDate(new Date(), TZ, 'mm')), v = Number(m[1]) * 60 + Number(m[2]);
  return ahora >= v && ahora - v <= COM_INACTIVO_MIN;
}
/** Devuelve '' si esta persona tiene hoy el turno de edición, o el mensaje de por qué no. */
function comisionTurno_(quien, acta) {
  if (quien.rol === 'directivo' || quien.total) return '';
  if (!comisionPermisoNivel_(quien).editar) return 'La coordinación no habilitó la edición de las actas para su nivel (solo lectura).';
  var r = acta && acta.responsable; if (!r || r === quien.nombre) return '';
  return 'Ahora tiene la edición ' + r + ' (solo una persona edita a la vez). Pídale que la suelte o la pase, o use «Tomar la edición» si lleva más de ' + COM_INACTIVO_MIN + ' minutos sin actividad.';
}
function comisionSinAlcance_(al) { return !al.todo && !al.cursos.length && !al.areas.length && !al.multiareas && !al.acompana; }
/* Modo de trabajo de las actas (lo fija coordinación o el desarrollador): UNO = una sola persona edita a la vez (por defecto);
   EQUIPO = cada docente trabaja SOLO su alcance: el director de grupo, los datos de su curso; el docente de área, su área; y quien dirige un curso
   pero no dicta en el grado, solo su curso. Parámetro comisiones_modo. */
var COM_MODO = null;
function comisionModo_() { if (COM_MODO) return COM_MODO; COM_MODO = parametro_('comisiones_modo', 'UNO') === 'EQUIPO' ? 'EQUIPO' : 'UNO'; return COM_MODO; }
function comisionModoLeer() { comisionQuien_(); return { modo: comisionModo_() }; }
function comisionModoGuardar(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica o el desarrollador cambian el modo de trabajo.');
  var m = (p || {}).modo === 'EQUIPO' ? 'EQUIPO' : 'UNO'; guardarParametro_('comisiones_modo', m); COM_MODO = null;
  comisionLog_('', quien.nombre, 'MODO_TRABAJO', m); return { modo: m };
}
function comisionAlcance_(quien, grado, periodo) {
  var todo = { todo: true, cursos: [], areas: [], multiareas: true };
  if (quien.rol !== 'docente' || quien.total || comisionModo_() !== 'EQUIPO') return todo;
  var N = comisionSinTildes_(quien.nombre), grupos = {};
  datos_('Grupos').forEach(function (g) { if (comisionGradoActa_(g.grupo, periodo) === String(grado)) grupos[trasladoCodigo_(g.grupo)] = 1; });
  var cursos = [], est = [], areas = {}, multi = false;
  datos_('Direccion_Grupo').forEach(function (d) { var c = trasladoCodigo_(d.grupo); if (grupos[c] && [d.docente_1, d.docente_2].some(function (n) { return n && comisionSinTildes_(n) === N; })) cursos.push(c); });
  comisionHorarioConAlternan_().forEach(function (h) {
    var c = trasladoCodigo_(h.grupo); if (!h.docente || !grupos[c] || comisionSinTildes_(h.docente) !== N) return;
    if (est.indexOf(c) < 0) est.push(c);
    var ar = String(h.area || '').trim(); if (/MULTIPLES/i.test(comisionSinTildes_(ar))) { multi = true; return; }
    (COM_COD_AREA[comisionSinTildes_(ar)] || []).forEach(function (x) { areas[x] = 1; });
  });
  cursos.forEach(function (c) { if (est.indexOf(c) < 0) est.push(c); });
  return { todo: false, cursos: cursos, cursosEst: est, areas: Object.keys(areas), multiareas: multi, acompana: false };
}
/** ¿Puede escribir esta sección? Devuelve null si puede o el motivo si no. */
function comisionEsEditor_(quien, secciones) {
  var d = secciones && secciones.integrantes && secciones.integrantes.datos, L = (d && d.int) || [];
  return L.some(function (x) { return x && x.n === quien.nombre && (x.roles || []).indexOf('Editor del acta') >= 0; });
}
function comisionPermisoSeccion_(quien, alcance, seccion, secciones, acta) {
  if (!SECCIONES_COM.test(seccion)) return 'Sección no válida.';
  var p = seccion.split(':'), tipo = p[0], clave = p.slice(1).join(':');
  var editor = comisionEsEditor_(quien, secciones);
  if (tipo === 'firmas' || tipo === 'faltantes' || tipo === 'listos' || tipo === 'presencia') return null;
  var enEquipo = !alcance.todo && quien.rol === 'docente';   // modo EQUIPO: cada docente trabaja solo su alcance, sin esperar el turno único
  var general = tipo === 'general' || tipo === 'integrantes' || tipo === 'requisitos';
  if (enEquipo && !general) { if (!comisionPermisoNivel_(quien).editar) return 'La coordinación no habilitó la edición de las actas para su nivel (solo lectura).'; }
  else { var turno = comisionTurno_(quien, acta); if (turno) return turno; }   // cada persona pone lo suyo (firma, declaración, revisión) y los datos faltantes
  if (general) {   // asistencia, etiquetas y datos generales: el responsable del registro, quien tenga la etiqueta «Editor del acta» o coordinación
    var resp = acta && acta.responsable;
    return null;
  }
  if (alcance.todo || editor) { /* coordinación, rectoría y quien tenga la etiqueta «Editor del acta» pueden corregir cualquier curso o área */ } else if (['matricula', 'estudiantes', 'reconocimientos', 'promocion', 'obs'].indexOf(tipo) >= 0) {
    if (alcance.cursos.indexOf(clave) < 0 && !(tipo === 'estudiantes' && (alcance.cursosEst || []).indexOf(clave) >= 0)) return 'Solo el director o directora del curso puede editar esta sección' + (tipo === 'estudiantes' ? ' (o quien dicta en él).' : '.');
  } else if (alcance.areas.indexOf(clave) < 0 && !alcance.multiareas && !(clave === 'Convivencia' && alcance.cursos.length)) {
    return 'Solo el docente de esta área puede editarla.';
  }
  var conf = secciones && secciones['confirm:' + tipo + ':' + clave];
  if ((tipo === 'matricula' || tipo === 'reconocimientos') && conf && conf.datos && conf.datos.ok && !quien.coord && quien.rol !== 'directivo' && !quien.total) {
    return 'Esta sección está confirmada y es oficial: solo coordinación académica puede reabrirla.';
  }
  return null;
}

/* ------------------------------ reglas puras (probadas aparte) ------------------------------ */
function comisionTotalMatricula_(m) { return (Number(m.ini) || 0) + (Number(m.nu) || 0) - (Number(m.re) || 0) - (Number(m.de) || 0); }
/** Mensajes de lo que no cuadra en la matrícula de un curso (vacío = balanceada). */
function comisionBalanceMatricula_(m) {
  var t = comisionTotalMatricula_(m || {}), r = [];
  if (t <= 0) r.push('el total actual debe ser mayor que 0.');
  var d = t - ((Number(m.m) || 0) + (Number(m.f) || 0));
  if (d) r.push('hombres + mujeres no igualan el total actual (' + t + '): ' + (d > 0 ? 'faltan ' + d : 'sobran ' + (-d)) + '.');
  if ((Number(m.ve) || 0) + (Number(m.ec) || 0) > t) r.push('VEN + ECU supera el total actual.');
  return r;
}
/** Cupos y regla de puestos de los reconocimientos de un curso. filas = [{tipo: 0..4, puesto, prom}] */
function comisionValidaReconocimientos_(filas) {
  var r = [], porTipo = [0, 0, 0, 0, 0];
  (filas || []).forEach(function (f) {
    var t = Number(f.tipo);
    if (t >= 0 && t < 5) porTipo[t]++;
    if (t <= 2) { var n = parseFloat(String(f.prom).replace(',', '.')); if (!(n >= 1 && n <= 5)) r.push('falta el promedio (1,0 a 5,0) de un reconocido.'); }
  });
  LIM_RECONOC.forEach(function (lim, i) { if (porTipo[i] > lim) r.push('el tipo ' + (i + 1) + ' tiene ' + porTipo[i] + ' y el máximo es ' + lim + '.'); });
  var ex = (filas || []).filter(function (f) { return Number(f.tipo) === 0; }), rd = (filas || []).filter(function (f) { return Number(f.tipo) === 1; });
  if (ex.some(function (f) { return Number(f.puesto) !== 1; })) r.push('la excelencia es para el 1.er puesto académico.');
  var ok = ex.length ? [2, 3] : [1, 2];
  rd.forEach(function (f) { if (ok.indexOf(Number(f.puesto)) < 0) r.push('el rendimiento académico va a los puestos ' + ok.join(' y ') + ' (hay uno en el ' + f.puesto + ').'); });
  return r;
}
/** Promoción de un curso: promovidos + no promovidos debe ser la matrícula actual. prom = {lista, no_promovidos} */
function comisionPromocionCuadra_(mat, prom) {
  var t = comisionTotalMatricula_(mat || {}), n = Number(prom && prom.lista) || 0, np = Number(prom && prom.no_promovidos) || 0, r = [];
  if (n > t) r.push('la lista tiene ' + n + ' estudiantes y la matrícula actual es ' + t + ': no puede haber más estudiantes que matriculados.');
  else if (n < t) r.push('la lista tiene ' + n + ' estudiantes y la matrícula actual es ' + t + ': faltan ' + (t - n) + ' por registrar.');
  if (np > n) r.push('hay más no promovidos (' + np + ') que estudiantes en la lista (' + n + ').');
  return r;
}
/** El cierre está completo cuando cada integrante que firma confirmó o fue excluido. */
function comisionCierreCompleto_(integrantes, cierre) {
  if (!cierre) return false;
  var P = (integrantes || []).filter(function (x) { return x.p && x.cierre !== false; });
  return P.length > 0 && P.every(function (x) { return cierre.conf && cierre.conf[x.n] || cierre.excl && cierre.excl[x.n]; });
}
/** Siguiente número de acta: consecutivo de las actas del grado en el año (si el 3.er periodo no se presentó, la final es la número 3). */
function comisionNumeroSugerido_(anio, grado) {
  return comisionActas_().filter(function (a) { return String(a.anio) === String(anio) && String(a.grado) === String(grado); }).length + 1;
}

/* ------------------------------ API ------------------------------ */
/** Lo que necesita la pantalla al abrir: quién es, qué grados hay y las actas del año. */
function comisionContexto() { VAL_REQ = {}; try { return comisionContextoImpl_(); } finally { VAL_REQ = null; } }
function comisionContextoImpl_() {
  var quien = comisionQuien_(), perm = comisionPermisoNivel_(quien), anio = Number(parametro_('anio_lectivo', String(new Date().getFullYear()))), grados = {};
  datos_('Grupos').forEach(function (g) { var p = partesGrupo_(g.grupo); if (p.grado !== 'N/A' && p.grado !== 'ORI' && p.grado !== 'PTA') grados[comisionGradoActa_(g.grupo, 'Final')] = 1; });
  var lista = comisionActas_().filter(function (a) { return String(a.anio) === String(anio); }).map(function (a) {
    return { id: a.id, periodo: a.periodo, grado: a.grado, acta_no: a.acta_no, estado: a.estado, responsable: a.responsable, hora_cierre: a.hora_cierre };
  });
  var visibles = lista, gr = Object.keys(grados).sort();
  if (!quien.coord && quien.rol === 'docente') gr = gr.filter(function (c) { var al = comisionAlcance_(quien, c); return al.cursos.length || al.areas.length || al.multiareas || al.acompana; });
  if (!quien.coord && quien.rol === 'docente') visibles = lista.filter(function (a) { var al = comisionAlcance_(quien, String(a.grado), a.periodo); return al.cursos.length || al.areas.length || al.multiareas || al.acompana; });
  if (!perm.ver) return { version: (typeof VERSION_SISTEMA !== 'undefined' ? VERSION_SISTEMA : ''), anio: anio, quien: { nombre: quien.nombre, rol: quien.rol, coord: false, dev: false, ver: false, editar: false }, periodos: PERIODOS_COM, grados: [], actas: [], bloqueado: 'La coordinación no habilitó la consulta de las actas para su nivel.' };
  return { modo: comisionModo_(), version: (typeof VERSION_SISTEMA !== 'undefined' ? VERSION_SISTEMA : ''), anio: anio, quien: { total: !!quien.total, ver: true, editar: perm.editar, nombre: quien.nombre, rol: quien.rol, coord: quien.coord, dev: !!(quien.coord && quien.email && editoresLibro_().indexOf(String(quien.email).toLowerCase()) >= 0) }, periodos: PERIODOS_COM, grados: gr, actas: visibles };
}
/** Abre el acta del grado y periodo (la crea si no existe; fecha, hora y grado empiezan en blanco: los llena el equipo). */
function comisionAbrir(p) {
  var quien = comisionQuien_(); p = p || {};
  var anio = Number(p.anio) || Number(parametro_('anio_lectivo', String(new Date().getFullYear())));
  if (PERIODOS_COM.indexOf(p.periodo) < 0) throw new Error('Elija el periodo.');
  var grado = String(p.grado || '');
  if (!datos_('Grupos').some(function (g) { return comisionGradoActa_(g.grupo, p.periodo) === grado; })) throw new Error('Ese grado no existe.');
  var al = comisionAlcance_(quien, grado, p.periodo);
  if (!comisionPermisoNivel_(quien).ver) throw new Error('La coordinación no habilitó la consulta de las actas para su nivel.');
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var cont = comisionContarSecciones_();
    var ex = comisionActas_().filter(function (a) { return String(a.anio) === String(anio) && a.periodo === p.periodo && comisionGradoKey_(a.grado, a.periodo) === grado; })
      .sort(function (x, y) { return (cont[String(y.id)] || 0) - (cont[String(x.id)] || 0); })[0];   // si hay varias, la que más trabajo tiene
    if (!ex) {
      var id = Utilities.getUuid(), no = comisionNumeroSugerido_(anio, grado);
      hojaOCrea_('Comision_Actas', COL_CACTAS).appendRow([id, anio, p.periodo, txtForzado_(grado), no, 'ABIERTA', (quien.rol === 'docente' ? quien.nombre : ''), quien.nombre, ahoraTxt_(), '', '', '', 0]);
      comisionLog_(id, quien.nombre, 'ABRIR', p.periodo + ' · grado ' + grado + ' · acta ' + no);
      ex = comisionActa_(id);
    }
    return comisionCargar({ acta: ex.id });
  } finally { lock.releaseLock(); }
}
function comisionCargar(p) {
  var quien = comisionQuien_(); if (!comisionPermisoNivel_(quien).ver) throw new Error('La coordinación no habilitó la consulta de las actas para su nivel.');
  var  a = comisionActa_((p || {}).acta), al = comisionAlcance_(quien, String(a.grado), a.periodo);
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  try { comisionUnionRegistrar_(a.periodo, a.grado); } catch (e) { }
  return { modo: comisionModo_(), acta: a, alcance: al, quien: { nombre: quien.nombre, rol: quien.rol, coord: quien.coord }, secciones: comisionSecciones_(a.id) };
}
/** Solo lo que cambió desde la versión que ya tiene la pantalla (para refrescar cada pocos segundos sin traer todo). */
function comisionCambios(p) {
  comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta), vistas = p.versiones || {}, todas = comisionSecciones_(a.id), cambios = {};
  Object.keys(todas).forEach(function (k) { if ((vistas[k] || 0) !== todas[k].version) cambios[k] = todas[k]; });
  return { estado: a.estado, responsable: a.responsable, hora_cierre: a.hora_cierre, cambios: cambios };
}
/** Guarda UNA sección. p = {acta, seccion, datos, version}. Si otra persona la cambió antes, devuelve el conflicto sin pisar nada. */
function comisionGuardar(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta);
    if (a.estado !== 'ABIERTA' && !quien.coord) throw new Error('El acta está cerrada (solo lectura). Solo coordinación académica o el desarrollador pueden modificarla.');
    var al = comisionAlcance_(quien, String(a.grado), a.periodo), secs = comisionSecciones_(a.id);
    var no = comisionPermisoSeccion_(quien, al, String(p.seccion || ''), secs, a);
    if (no) throw new Error(no);
    var dup = comisionDuplicados_(String(p.seccion || ''), p.datos); if (dup) throw new Error(dup);
    var actual = secs[p.seccion];
    if (actual && (Number(p.version) || 0) !== actual.version) return { conflicto: true, version: actual.version, datos: actual.datos, por: actual.por };
    if (!actual && Number(p.version)) return { conflicto: true, version: 0, datos: null, por: '' };
    var v = comisionEscribe_(a.id, p.seccion, p.datos, quien.nombre);
    try { comisionAHojas_(String(p.seccion), p.datos, quien.nombre, a.id); } catch (eh) { comisionLog_(a.id, quien.nombre, 'HOJA_ERROR', String(eh && eh.message || eh).slice(0, 120)); }
    return { ok: true, version: v };
  } finally { lock.releaseLock(); }
}
/** Un estudiante no puede estar dos veces en la misma lista (reprobación, convivencia, compromisos, PIAR, reconocimientos). Devuelve el mensaje o ''. */
function comisionDuplicados_(seccion, datos) {
  if (!/^(estudiantes|reconocimientos):/.test(seccion) || !datos || typeof datos !== 'object') return '';
  var msg = '';
  Object.keys(datos).forEach(function (k) {
    var arr = datos[k]; if (!Array.isArray(arr) || msg) return;
    var vistos = {};
    arr.forEach(function (x) {
      if (msg || !x || typeof x !== 'object') return;
      var nom = x.estudiante || x.nombre, id = x.id != null ? 'i' + x.id : (nom ? 'n' + comisionSinTildes_(nom) : '');
      if (!id) return;
      if (vistos[id]) msg = 'Hay un estudiante repetido (' + (nom || x.id) + ') en «' + k + '». No se puede registrar dos veces: edite el que ya está.';
      vistos[id] = 1;
    });
  });
  return msg;
}
/** Elige al docente responsable del registro y del cierre (cualquier integrante puede proponerlo; queda en la fila del acta). */
function comisionResponsable(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
  var nuevoR = String(p.nombre || '');
  if (quien.rol !== 'directivo' && !quien.total && a.responsable && a.responsable !== quien.nombre) {
    if (!(nuevoR === quien.nombre && !comisionEditorActivo_(a, comisionSecciones_(a.id)))) throw new Error(comisionTurno_(quien, a));
  }
  var fila = comisionFilaActa_(a.id); hojaOCrea_('Comision_Actas', COL_CACTAS).getRange(fila, 7).setValue(nuevoR);
  comisionLog_(a.id, quien.nombre, 'RESPONSABLE', p.nombre);
  return { ok: true };
}
/** Confirma o reabre la matrícula, los reconocimientos o la promoción de un curso. p = {acta, tipo, curso, on, justificacion} */
function comisionConfirmar(p) {
  var quien = comisionQuien_(); p = p || {};
  if (['matricula', 'reconocimientos', 'promocion'].indexOf(p.tipo) < 0) throw new Error('Tipo de confirmación no válido.');
  var curso = String(p.curso || '');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
    var al = comisionAlcance_(quien, String(a.grado), a.periodo);
    if (al.todo || al.cursos.indexOf(curso) < 0) { var turnoE = comisionTurno_(quien, a); if (turnoE) throw new Error(turnoE); }   // en modo EQUIPO el director confirma su curso sin esperar turno
    var secs = comisionSecciones_(a.id), clave = 'confirm:' + p.tipo + ':' + curso;
    var ya = secs[clave] && secs[clave].datos || { ok: false, veces: 0 };
    if (p.on) {
      if (!al.todo && al.cursos.indexOf(curso) < 0) throw new Error('Solo el director o directora del curso confirma.');
      if (ya.ok) throw new Error('Ya está confirmado.');
      var mat = secs['matricula:' + curso] && secs['matricula:' + curso].datos;
      if (p.tipo === 'matricula') {
        if (!mat) throw new Error('Falta registrar la matrícula del curso.');
        var m = comisionBalanceMatricula_(mat); if (m.length) throw new Error('La matrícula no cuadra: ' + m.join(' '));
      } else if (p.tipo === 'reconocimientos') {
        var rc = secs['reconocimientos:' + curso] && secs['reconocimientos:' + curso].datos, m2 = comisionValidaReconocimientos_(rc && rc.filas || []);
        if (m2.length) throw new Error('No se puede confirmar los reconocimientos: ' + m2.join(' '));
      } else {
        if (a.periodo !== 'Final') throw new Error('La promoción solo se confirma en el acta final.');
        var pr = secs['promocion:' + curso] && secs['promocion:' + curso].datos;
        if (!mat) throw new Error('Falta registrar la matrícula del curso.');
        var m3 = comisionPromocionCuadra_(mat, pr); if (m3.length) throw new Error('La promoción no cuadra con la matrícula: ' + m3.join(' '));
      }
      comisionEscribe_(a.id, clave, { ok: true, por: quien.nombre, fecha: ahoraTxt_(), veces: (ya.veces || 0) + 1 }, quien.nombre);
      comisionLog_(a.id, quien.nombre, 'CONFIRMAR', p.tipo + ' · ' + curso);
    } else {
      if (!quien.coord) throw new Error('Lo confirmado es oficial: solo coordinación académica puede reabrirlo. Búsquela para que active de nuevo la confirmación.');
      var j = String(p.justificacion || '').trim();
      if (j.length < 10) throw new Error('Escriba una justificación clara (mínimo 10 caracteres).');
      if (!ya.ok) throw new Error('No está confirmado.');
      comisionEscribe_(a.id, clave, { ok: false, por: quien.nombre, fecha: ahoraTxt_(), veces: ya.veces || 0 }, quien.nombre);
      comisionLog_(a.id, quien.nombre, 'REABRIR_CONFIRMACION', p.tipo + ' · ' + curso + ' · ' + j);
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/** Códigos de área del Horario → áreas del acta (CSI = Ciencias Sociales e Inglés; ETR = Ética y Religión). */
var COM_COD_AREA = { MAT: ['Matemáticas'], CAS: ['Humanidades y Lengua Castellana'], CNA: ['Ciencias Naturales y Educación Ambiental'], CSI: ['Ciencias Sociales', 'Inglés'], ETR: ['Educación Ética y Valores Humanos', 'Educación Religiosa Escolar'], ART: ['Educación Artística (Arte y Cultura Afro)'], ERD: ['Educación Física, Recreación y Deportes'], TEI: ['Tecnología e Informática'] };
var COM_AREAS = ['Matemáticas', 'Humanidades y Lengua Castellana', 'Ciencias Naturales y Educación Ambiental', 'Ciencias Sociales', 'Inglés', 'Educación Ética y Valores Humanos', 'Educación Religiosa Escolar', 'Educación Artística (Arte y Cultura Afro)', 'Educación Física, Recreación y Deportes', 'Tecnología e Informática'];
var COM_PRE_CLAVES = ['Propósito 1. Construcción de identidad y relaciones sociales', 'Propósito 2. Comunicación activa, expresión y representación', 'Propósito 3. Exploración del medio y aprendizaje significativo', 'Experiencias y pensamiento computacional'];
/** '00' preescolar · '01'..'05' primaria · el resto, secundaria y media. */
function comisionNivel_(grado) { grado = String(grado); return grado === '00' ? 'pre' : /^0[1-5]$/.test(grado) ? 'pri' : 'sec'; }
function comisionOkMail_(e) { e = String(e || '').trim(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !/@icet\.edu\.co$/i.test(e); }
function comisionOkTel_(t) { return /^\d{7,12}$/.test(String(t || '').replace(/\D/g, '')); }
/**
 * Lista de pendientes del acta (la MISMA regla que la pantalla). Cada ítem: {paso, comp, curso, persona, msg, donde, adv}.
 * adv = advertencia (no impide cerrar). Todo lo demás impide cerrar y hay que regresar a corregirlo.
 * Cada componente debe tener registros o la declaración «sin casos»; así no llegan actas con componentes vacíos.
 */
function comisionPendientes_(a, secs) {
  var L = [], nivel = comisionNivel_(a.grado), pre = nivel === 'pre', fin = a.periodo === 'Final';
  var d = function (k) { return secs[k] && secs[k].datos; };
  var add = function (paso, comp, curso, persona, msg, donde, adv) { L.push({ paso: paso, comp: comp, curso: curso || '', persona: persona || '', msg: msg, donde: donde || '', adv: !!adv }); };
  var req = d('requisitos') || {}, ints = d('integrantes') || [], P = ints.filter(function (x) { return x.p; });
  ['notas', 'planillas', 'resumenes', 'cuadernos', 'observ', 'faltantes'].forEach(function (k) { if (!req[k]) add('s0', 'Requisitos previos', '', '', 'Falta verificar el requisito «' + k + '».', 'Cada docente'); });
  if (!a.responsable) add('s0', 'Asistencia', '', '', 'Falta elegir al docente responsable del cierre.', 'El equipo');
  if (!P.length) add('s0', 'Asistencia', '', '', 'Faltan los integrantes que asistieron.', 'El equipo');
  P.forEach(function (x) {
    if (!comisionOkMail_(x.correo)) add('s0', 'Docentes', '', x.n, 'Falta el correo PERSONAL válido (no el institucional).', 'El propio docente');
    if (!comisionOkTel_(x.tel)) add('s0', 'Docentes', '', x.n, 'Falta un celular válido.', 'El propio docente');
    if (!/^\d{5,12}$/.test(String(x.ced || '').replace(/\D/g, ''))) add('p2', 'Docentes', '', x.n, 'Falta el número de cédula.', 'Rectoría, archivo o coordinador');
    if (x.cierre !== false && !(d('firmas') || {})[x.n]) add('s8', 'Firmas', '', x.n, 'Falta su firma de cierre.', 'El propio docente');
  });
  var cursos = [];
  datos_('Grupos').forEach(function (g) { if (comisionGradoActa_(g.grupo, a.periodo) === String(a.grado)) cursos.push(String(g.grupo)); });
  var cf = function (t, c) { var x = d('confirm:' + t + ':' + c); return !!(x && x.ok); };
  var areasReg = pre ? [] : COM_AREAS;
  cursos.forEach(function (c) {
    var mat = d('matricula:' + c), est = d('estudiantes:' + c) || {}, sc = est.sc || {}, rec = d('reconocimientos:' + c) || {};
    if (!mat) add('s1', 'Matrícula', c, '', 'Falta registrar la matrícula del curso.', 'Director/a de grupo');
    else { comisionBalanceMatricula_(mat).forEach(function (m) { add('s1', 'Matrícula', c, '', m, 'Director/a de grupo'); }); if (!cf('matricula', c)) add('s1', 'Matrícula', c, '', 'Falta confirmar la matrícula del curso.', 'Director/a de grupo'); }
    // áreas / propósitos: cifras o «ningún área con reprobados»
    var hay = pre ? COM_PRE_CLAVES.length && (d('areas:propositos') || {}).por_consolidar > 0 : areasReg.some(function (ar) { var x = d('areas:' + ar); return x && x.por_curso && Number(x.por_curso[c]) > 0; });
    if (!hay && !sc.areas) add('s2', pre ? 'Propósitos' : 'Áreas', c, '', 'Registre ' + (pre ? 'los propósitos por consolidar' : 'los reprobados por área') + ' o declare que no hubo.', 'Docentes del área y director/a de grupo');
    // reprobación (o deserción e inasistencia en preescolar): estudiantes o «sin casos»
    var rep = est.rep || [];
    if (!rep.length && !sc.rep) add('s3', pre ? 'Deserción e inasistencia' : 'Reprobación', c, '', 'Agregue los estudiantes o declare que no hubo casos.', 'Director/a de grupo');
    if (!pre) areasReg.forEach(function (ar) {
      var x = d('areas:' + ar), cifra = x && x.por_curso ? Number(x.por_curso[c]) || 0 : 0, n = rep.filter(function (r) { return (r.areas || []).indexOf(ar) >= 0; }).length;
      if (cifra !== n) add('s3', 'Reprobación', c, '', ar + ': la cifra dice ' + cifra + ' y hay ' + n + ' estudiantes registrados con esa área.', 'Director/a de grupo y docente del área');
    });
    if (fin && !pre) {
      var pr = d('promocion:' + c);
      if (mat) comisionPromocionCuadra_(mat, pr).forEach(function (m) { add('sP', 'Promoción', c, '', m, 'Director/a de grupo'); });
      else add('sP', 'Promoción', c, '', 'Falta la matrícula para verificar la promoción.', 'Director/a de grupo');
      if (!cf('promocion', c)) add('sP', 'Promoción', c, '', 'Falta confirmar la promoción del curso.', 'Director/a de grupo');
    }
    // reconocimientos
    if ((rec.filas || []).length) {
      comisionValidaReconocimientos_(rec.filas).forEach(function (m) { add('s4', 'Reconocimientos', c, '', m, 'Director/a de grupo'); });
      if (!cf('reconocimientos', c)) add('s4', 'Reconocimientos', c, '', 'Falta confirmar los reconocimientos del curso.', 'Director/a de grupo');
    } else if (!rec.sc) add('s4', 'Reconocimientos', c, '', 'Agregue los reconocimientos o declare que no hubo.', 'Director/a de grupo');
    [['con', 'Convivencia', 's5'], ['com', 'Compromisos con acudientes', 's6'], ['piar', 'PIAR y dificultades', 's7']].forEach(function (t) {
      if (!(est[t[0]] || []).length && !sc[t[0]]) add(t[2], t[1], c, '', 'Agregue los casos o declare que no hubo.', 'Director/a de grupo');
    });
    (est.con || []).forEach(function (r) { if (r.rc === 'No' || r.ro === 'No' || r.rp === 'No') add('s5', 'Convivencia', c, r.nombre || '', 'Falta reportar o notificar.', 'Director/a de grupo', true); });
  });
  (pre ? COM_PRE_CLAVES : COM_AREAS).forEach(function (k) {
    var x = d('recomendaciones:' + k);
    if (!x || (!String(x.texto || '').trim() && !(x.etiquetas || []).length)) add('s7', 'Recomendaciones', '', '', k + ': falta escribir una recomendación o marcar etiquetas.', 'Docente del ' + (pre ? 'propósito' : 'área'));
  });
  var fa = d('faltantes') || {};
  (fa.docentes || []).forEach(function (x) { if ((x.falta || []).length) add('p2', 'Datos de docentes', '', x.n, 'Falta: ' + x.falta.join(', ') + '.', 'Rectoría, archivo o coordinador'); });
  (fa.estudiantes || []).forEach(function (x) { if ((x.falta || []).length) add('p2', 'Datos de estudiantes', x.g || '', x.n, 'Falta: ' + x.falta.join(', ') + '.', 'Llamar a la familia; si no, rectoría, archivo o coordinador'); });
  P.forEach(function (x) { if (!(d('listos') || {})[x.n]) add('s8', 'Mi parte lista', '', x.n, 'No ha marcado «Mi parte lista».', 'El propio docente', true); });
  var orden = ['s0', 's1', 's2', 's3', 'sP', 's4', 's5', 's6', 's7', 's8', 'p2'];
  L.forEach(function (x) { x.o = orden.indexOf(x.paso); });
  return L.sort(function (p, q) { return p.o - q.o; });
}
/** Lo que impide cerrar (mensajes). Vacía = se puede cerrar. */
function comisionPendientesCierre_(a, secs) {
  return comisionPendientes_(a, secs).filter(function (x) { return !x.adv; }).map(function (x) { return (x.curso ? x.curso + ': ' : '') + (x.persona ? x.persona + ': ' : '') + x.comp + ' · ' + x.msg; });
}
/** Informe de pendientes para la pantalla y para el PDF del responsable. */
function comisionPendientes(p) {
  comisionQuien_(); var a = comisionActa_((p || {}).acta), L = comisionPendientes_(a, comisionSecciones_(a.id));
  return { acta: a.id, por_resolver: L.filter(function (x) { return !x.adv; }).length, advertencias: L.filter(function (x) { return x.adv; }).length, lista: L };
}
/** Cierre compartido. accion: 'proponer' | 'confirmar' (p.en_nombre = integrante que confirma desde este equipo) | 'objetar' | 'excluir' | 'cancelar'. */
function comisionCierre(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta ya está cerrada.');
    var secs = comisionSecciones_(a.id), ints = secs.integrantes && secs.integrantes.datos || [], c = secs.cierre && secs.cierre.datos || null;
    var soyResp = !a.responsable || a.responsable === quien.nombre || quien.coord;
    if (p.accion === 'proponer') {
      if (!a.responsable) throw new Error('Falta elegir al docente responsable del cierre.');
      if (a.responsable !== quien.nombre && !quien.coord) throw new Error('Solo ' + (a.responsable || 'el docente responsable') + ' puede proponer el cierre.');
      var falta = comisionPendientesCierre_(a, secs); if (falta.length) throw new Error('No se puede cerrar todavía:\n' + falta.join('\n'));
      c = { por: quien.nombre, t: ahoraTxt_(), conf: {}, obj: {}, excl: {}, via: {} }; c.conf[quien.nombre] = true;
    } else {
      if (!c) throw new Error('No hay un cierre propuesto.');
      if (p.accion === 'cancelar') { if (c.por !== quien.nombre && !quien.coord) throw new Error('Solo quien propuso el cierre puede cancelarlo.'); c = null; }
      else if (p.accion === 'excluir') { if (c.por !== quien.nombre && !quien.coord) throw new Error('Solo quien propuso el cierre puede excluir a un integrante.'); c.excl[p.persona] = true; }
      else if (p.accion === 'confirmar' || p.accion === 'objetar') {
        var quienConf = p.en_nombre ? String(p.en_nombre) : quien.nombre;
        if (!ints.some(function (x) { return x.n === quienConf && x.p; })) throw new Error('Esa persona no está entre los integrantes que asistieron.');
        c.conf[quienConf] = p.accion === 'confirmar'; c.obj[quienConf] = p.accion === 'objetar';
        if (p.en_nombre && p.en_nombre !== quien.nombre) c.via[quienConf] = quien.nombre;
      } else throw new Error('Acción de cierre no válida.');
    }
    comisionEscribe_(a.id, 'cierre', c, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'CIERRE_' + String(p.accion).toUpperCase(), p.persona || p.en_nombre || '');
    if (c && comisionCierreCompleto_(ints, c)) return comisionCerrarActa_(a, c, quien);
    return { ok: true, cerrada: false };
  } finally { lock.releaseLock(); }
}
function comisionCerrarActa_(a, c, quien) {
  var hora = Utilities.formatDate(new Date(), TZ, 'HH:mm'), fila = comisionFilaActa_(a.id), sh = hojaOCrea_('Comision_Actas', COL_CACTAS);
  sh.getRange(fila, 6, 1, 1).setValue('CERRADA');
  sh.getRange(fila, 10, 1, 3).setValues([[c.por || quien.nombre, ymd_(new Date()), hora]]);
  comisionLog_(a.id, quien.nombre, 'CERRAR', 'hora ' + hora);
  var copia = false;
  try { comisionBorradorDrive_(comisionActa_(a.id)); copia = true; } catch (e) { comisionLog_(a.id, quien.nombre, 'COPIA_FALLO', String(e.message || e)); }
  return { ok: true, cerrada: true, hora_cierre: hora, copia_en_drive: copia };
}
/** Reabre un acta cerrada: solo coordinación académica, con justificación. */
function comisionReabrir(p) {
  var quien = comisionQuien_(); p = p || {};
  if (!quien.coord) throw new Error('Solo coordinación académica puede reabrir el acta.');
  var j = String(p.justificacion || '').trim(); if (j.length < 10) throw new Error('Escriba una justificación clara (mínimo 10 caracteres).');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'CERRADA') throw new Error('El acta no está cerrada.');
    var fila = comisionFilaActa_(a.id), sh = hojaOCrea_('Comision_Actas', COL_CACTAS);
    sh.getRange(fila, 6, 1, 1).setValue('ABIERTA'); sh.getRange(fila, 10, 1, 4).setValues([['', '', '', (Number(a.reaperturas) || 0) + 1]]);
    comisionEscribe_(a.id, 'cierre', null, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'REABRIR_ACTA', j);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/** Carpeta del acta dentro de la carpeta de la aplicación: COMISIONES año / Comisiones Evaluación P1 ICET año (como las que ya existen) / Grado X [/ subcarpeta]. */
function comisionCarpeta_(a, sub) {
  var pcorto = { Primero: 'P1', Segundo: 'P2', Tercero: 'P3', Final: 'Final' }[a.periodo] || String(a.periodo);
  var f = carpetaHija_(carpetaApp_(), 'COMISIONES ' + a.anio);
  f = carpetaHija_(f, 'Comisiones Evaluación ' + pcorto + ' ICET ' + a.anio);
  f = carpetaHija_(f, 'Grado ' + a.grado);
  return sub ? carpetaHija_(f, sub) : f;
}
function comisionGuardaJson_(carpeta, nombre, obj) {
  var it = carpeta.getFilesByName(nombre); while (it.hasNext()) it.next().setTrashed(true);
  return carpeta.createFile(Utilities.newBlob(JSON.stringify(obj, null, 1), 'application/json', nombre));
}
/** Copia legible (JSON) del acta y todas sus secciones, en «Borradores» del acta. Si el acta ya está cerrada, además queda la copia «cerrada». */
function comisionBorradorDrive_(a) {
  var datos = { acta: a, secciones: comisionSecciones_(a.id), copiado: ahoraTxt_() }, c = comisionCarpeta_(a, 'Borradores');
  comisionGuardaJson_(c, 'Acta ' + a.acta_no + ' ' + a.periodo + ' · borrador.json', datos);
  if (a.estado === 'CERRADA') comisionGuardaJson_(c, 'Acta ' + a.acta_no + ' ' + a.periodo + ' · cerrada.json', datos);
  return c;
}
/** Botón «Guardar borrador en Drive»: cualquier integrante del acta. */
function comisionBorrador(p) {
  var quien = comisionQuien_(), a = comisionActa_((p || {}).acta), al = comisionAlcance_(quien, String(a.grado), a.periodo);
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  comisionBorradorDrive_(a); comisionLog_(a.id, quien.nombre, 'BORRADOR_DRIVE', '');
  return { ok: true };
}
/** Cada noche (Respaldo.gs): copia legible de todas las actas del año, para que todo quede en la carpeta de la aplicación. */
function comisionRespaldarActas_() {
  var anio = Number(parametro_('anio_lectivo', String(new Date().getFullYear()))), n = 0;
  comisionActas_().forEach(function (a) { if (Number(a.anio) === anio) { comisionBorradorDrive_(a); n++; } });
  return n ? 'borradores de comisiones: ' + n : '';
}
/**
 * PDF del acta cerrada (respaldo): la pantalla envía el HTML del imprimible y aquí se convierte a PDF y se guarda en «Borradores» de la carpeta del acta.
 * El PDF principal sale siempre de la impresión del navegador; este es la copia de seguridad por si algo falla.
 */
function comisionGuardarPdf(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta), al = comisionAlcance_(quien, String(a.grado), a.periodo);
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  var html = String(p.html || ''); if (html.length < 200) throw new Error('El acta está vacía.'); if (html.length > 3000000) throw new Error('El acta es demasiado grande para convertirla.');
  var nombre = 'Acta ' + a.acta_no + ' ' + a.periodo + (a.estado === 'CERRADA' ? ' · cerrada' : ' · borrador') + '.pdf';
  var pdf = Utilities.newBlob('<html><head><meta charset="utf-8"></head><body>' + html + '</body></html>', 'text/html', nombre).getAs('application/pdf');
  pdf.setName(nombre);
  var c = comisionCarpeta_(a, 'Borradores'), it = c.getFilesByName(nombre); while (it.hasNext()) it.next().setTrashed(true);
  var f = c.createFile(pdf);
  comisionLog_(a.id, quien.nombre, 'PDF_DRIVE', nombre);
  return { ok: true, nombre: nombre, url: f.getUrl() };
}
/**
 * El director o directora del curso agrega a un estudiante que falta (con los datos esenciales, sin inventarlos) o retira a quien ya no vino o nunca vino.
 * p = {acta, curso, accion: 'AGREGAR'|'RETIRAR', a, n, motivo, falta: [datos que no se tienen], nombre (al retirar)}
 * Con la matrícula del curso confirmada no se puede (solo coordinación la reabre). Se confirma de nuevo la promoción. Todo queda en «cambios:curso» y en el registro.
 * Los números de documento no se guardan aquí: van a la hoja reservada de identidad (fase 2).
 */
var MOTIVOS_RETIRO_COM = ['Se retiró: pasó a otra institución educativa', 'Se retiró: cambio de domicilio', 'Canceló la matrícula', 'No asiste'];
function comisionEstudiante(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta está cerrada.');
    var turnoE = comisionTurno_(quien, a); if (turnoE) throw new Error(turnoE);
    var curso = String(p.curso || ''), al = comisionAlcance_(quien, String(a.grado), a.periodo), secs = comisionSecciones_(a.id);
    if (!al.todo && al.cursos.indexOf(curso) < 0) throw new Error('Solo el director o directora del curso agrega o retira estudiantes.');
    var conf = secs['confirm:matricula:' + curso] && secs['confirm:matricula:' + curso].datos;
    if (conf && conf.ok && !quien.coord) throw new Error('La matrícula del curso está confirmada y es oficial: pida a coordinación académica que la reabra.');
    var clave = 'cambios:' + curso, lista = (secs[clave] && secs[clave].datos) || [], reg;
    if (p.accion === 'AGREGAR') {
      var ap = String(p.a || '').trim(), nm = String(p.n || '').trim();
      if (!ap || !nm) throw new Error('Escriba apellidos y nombres.');
      agregarEstudiante_({ g: curso, a: ap, n: nm, motivo: /no aparec/i.test(String(p.motivo || '')) ? 'NO_LISTADO' : 'NUEVO', nota: String(p.motivo || '').slice(0, 120) }, quien.nombre);
      reg = { tipo: 'AGREGAR', nombre: ap + ' ' + nm, motivo: String(p.motivo || ''), falta: (p.falta || []).slice(0, 8), por: quien.nombre, t: ahoraTxt_() };
    } else if (p.accion === 'RETIRAR') {
      if (MOTIVOS_RETIRO_COM.indexOf(p.motivo) < 0 && !/^(Se retiró|Canceló|No asist|Desertó|Nunca asistió)/.test(String(p.motivo || ''))) throw new Error('Elija el motivo del retiro.');
      if (!String(p.nombre || '').trim()) throw new Error('Falta el nombre del estudiante.');
      reg = { tipo: 'RETIRAR', nombre: String(p.nombre).trim(), motivo: p.motivo, por: quien.nombre, t: ahoraTxt_() };
    } else throw new Error('Acción no válida.');
    lista.push(reg);
    comisionEscribe_(a.id, clave, lista, quien.nombre);
    var pr = secs['confirm:promocion:' + curso] && secs['confirm:promocion:' + curso].datos;
    if (pr && pr.ok) comisionEscribe_(a.id, 'confirm:promocion:' + curso, { ok: false, por: quien.nombre, fecha: ahoraTxt_(), veces: pr.veces || 0 }, quien.nombre);
    comisionLog_(a.id, quien.nombre, 'ESTUDIANTE_' + p.accion, curso + ' · ' + reg.nombre + ' · ' + (reg.motivo || ''));
    return { ok: true, cambios: lista.length, ajuste_matricula: p.accion === 'AGREGAR' ? 'sumar 1 a Nuevos' : (/^(No asist|Desert|Nunca)/.test(p.motivo) ? 'sumar 1 a No asistentes' : 'sumar 1 a Retirados') };
  } finally { lock.releaseLock(); }
}
/** Evidencia opcional (PIAR, formato de DUA, compromiso firmado): imagen o PDF a Drive «App Asistencia / Soportes / Comisiones / año / grado / acta». */
function comisionSubirSoporte(p) {
  var quien = comisionQuien_(); p = p || {};
  var a = comisionActa_(p.acta), al = comisionAlcance_(quien, String(a.grado), a.periodo);
  var turnoS = comisionTurno_(quien, a); if (turnoS) throw new Error(turnoS);
  if (!al.todo && !al.cursos.length) throw new Error('Solo el director o directora de grupo carga evidencias.');
  var ext = MIME_COM[p.mime]; if (!ext) throw new Error('Formato no permitido. Use foto (JPG, PNG) o PDF.');
  if (['PIAR', 'DUA', 'COMPROMISO'].indexOf(p.tipo) < 0) throw new Error('Tipo de evidencia no válido.');
  var bytes = Utilities.base64Decode(String(p.base64 || '')); if (!bytes.length) throw new Error('El archivo está vacío.');
  if (bytes.length > MAX_BYTES_COM) throw new Error('El archivo supera ' + (MAX_BYTES_COM / 1048576) + ' MB.');
  var f = comisionCarpeta_(a, 'Anexos');
  var nombre = p.tipo + '_' + String(p.curso || '').replace(/[^0-9A-Za-z]/g, '') + '_' + ahoraTxt_().replace(/[^0-9]/g, '') + '.' + ext;
  var archivo = f.createFile(Utilities.newBlob(bytes, p.mime, nombre));
  try { archivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) { /* ya es privado */ }
  comisionLog_(a.id, quien.nombre, 'SOPORTE', nombre);
  return { nombre: nombre, id: archivo.getId(), url: archivo.getUrl() };
}

/* ------------------------------ prueba de humo (la ejecuta quien administra desde el menú del libro) ------------------------------ */
/** Abre un acta de PRUEBA (año 2099), guarda, lee, provoca un conflicto, pide pendientes y borra todo lo que creó. Devuelve [{paso, ok, msg}]. */
function comisionesPruebaDeHumo_() {
  var out = [], id = '', grado = '';
  function paso(nombre, f) { try { var r = f(); out.push({ paso: nombre, ok: r !== false, msg: r === false ? 'no cumplió lo esperado' : '' }); } catch (e) { out.push({ paso: nombre, ok: false, msg: String(e && e.message || e) }); } }
  var g = datos_('Grupos').map(function (x) { return partesGrupo_(x.grupo).grado; }).filter(function (c) { return /^\d\d$/.test(c); })[0] || '';
  paso('Elegir un grado para la prueba', function () { grado = g; return !!grado; });
  if (!grado) return out;
  paso('Abrir un acta de prueba (año 2099)', function () { var r = comisionAbrir({ anio: 2099, periodo: PERIODOS_COM[0], grado: grado }); id = r.acta.id; return !!id && r.acta.estado === 'ABIERTA'; });
  if (id) {
    paso('Guardar una sección', function () { var r = comisionGuardar({ acta: id, seccion: 'general', datos: { texto: 'prueba' }, version: 0 }); return r.ok && r.version === 1; });
    paso('Leer lo guardado', function () { var r = comisionCargar({ acta: id }); return r.secciones.general && r.secciones.general.datos.texto === 'prueba'; });
    paso('Detectar un conflicto (otra persona ya cambió la sección)', function () { return comisionGuardar({ acta: id, seccion: 'general', datos: { texto: 'otra' }, version: 0 }).conflicto === true; });
    paso('Guardar con la versión correcta', function () { var r = comisionGuardar({ acta: id, seccion: 'general', datos: { texto: 'dos' }, version: 1 }); return r.ok && r.version === 2; });
    paso('Pedir los cambios desde la versión cero', function () { return !!comisionCambios({ acta: id, versiones: {} }).cambios.general; });
    paso('Rechazar un estudiante repetido en una lista', function () { try { comisionGuardar({ acta: id, seccion: 'estudiantes:' + (datos_('Grupos').filter(function (x) { return partesGrupo_(x.grupo).grado === grado; })[0] || {}).grupo, datos: { rep: [{ id: 1 }, { id: 1 }] }, version: 0 }); return false; } catch (e) { return /repetido/.test(String(e.message)); } });
    paso('Calcular los pendientes del acta', function () { var r = comisionPendientes({ acta: id }); return !!r; });
    paso('Borrar el acta de prueba', function () { comisionBorrarActaPrueba_(id); return !comisionActas_().some(function (a) { return a.id === id; }); });
  }
  return out;
}
function comisionBorrarActaPrueba_(id) {
  [['Comision_Actas', COL_CACTAS, 0], ['Comision_Secciones', COL_CSEC, 0], ['Comision_Log', COL_CLOG, 1]].forEach(function (t) {
    var sh = hojaOCrea_(t[0], t[1]), v = sh.getDataRange().getValues();
    for (var i = v.length - 1; i >= 1; i--) if (String(v[i][t[2]]) === String(id)) sh.deleteRow(i + 1);
  });
}
function comisionesPruebaDeHumo() {
  exigirEditor_();
  var r = comisionesPruebaDeHumo_(), malos = r.filter(function (x) { return !x.ok; });
  SpreadsheetApp.getUi().alert('Prueba de comisiones: ' + (malos.length ? malos.length + ' paso(s) con problema' : 'TODO BIEN'),
    r.map(function (x) { return (x.ok ? '✔ ' : '✖ ') + x.paso + (x.msg ? ' → ' + x.msg : ''); }).join('\n') + '\n\nLa prueba usa un acta del año 2099 y la borra al terminar.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Menú: resumen de lo que hay guardado en las hojas de comisiones (sin abrir el JSON): por acta, cuántas partes y cuándo se guardó por última vez. */
/** Menú: cuando por el defecto del «05→5» se crearon varias actas del mismo grado y periodo, deja vigente la que más trabajo tiene y marca las demás DUPLICADA (no borra nada). */
function comisionesUnificarDuplicadas() {
  exigirEditor_();
  var sh = hojaOCrea_('Comision_Actas', COL_CACTAS), v = sh.getDataRange().getValues(), cont = comisionContarSecciones_(), grupos = {};
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0] || v[i][5] === 'DUPLICADA') continue;
    var k = v[i][1] + '|' + v[i][2] + '|' + comisionGradoKey_(v[i][3], v[i][2]);
    (grupos[k] = grupos[k] || []).push({ fila: i + 1, id: String(v[i][0]), n: cont[String(v[i][0])] || 0, fecha: String(v[i][8]), resp: String(v[i][6]), estado: String(v[i][5]) });
  }
  var plan = [], lineas = [];
  Object.keys(grupos).forEach(function (k) {
    var L = grupos[k]; if (L.length < 2) return;
    L.sort(function (a, b) { return b.n - a.n || (a.fecha < b.fecha ? 1 : -1); });
    var d = k.split('|'), et = COM_GRADO_LABEL[d[2]] || d[2];
    lineas.push('• ' + et + ' · ' + d[1] + ': se queda la del ' + L[0].fecha + ' (' + L[0].n + ' partes' + (L[0].resp ? ', edita ' + L[0].resp : '') + ') y se ocultan ' + (L.length - 1) + ' más (' + L.slice(1).map(function (x) { return x.n; }).join(', ') + ' partes).');
    L.slice(1).forEach(function (x) { plan.push(x); });
  });
  var ui = SpreadsheetApp.getUi();
  if (!plan.length) { ui.alert('Actas duplicadas', 'No hay actas duplicadas.', ui.ButtonSet.OK); return 0; }
  var r = ui.alert('Unificar actas duplicadas', lineas.join('\n') + '\n\nNo se borra nada: las ocultas quedan en la hoja con estado DUPLICADA. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return 0;
  plan.forEach(function (x) { sh.getRange(x.fila, 6).setValue('DUPLICADA'); comisionLog_(x.id, 'menú', 'DUPLICADA', 'Acta duplicada oculta (quedó vigente otra con más trabajo)'); });
  return plan.length;
}
function comisionesVerGuardado() {
  exigirEditor_();
  var actas = comisionActas_(), secs = datosOCrea_('Comision_Secciones', COL_CSEC), lineas = [];
  actas.forEach(function (a) {
    var mias = secs.filter(function (s) { return String(s.acta_id) === String(a.id); }), ult = mias.reduce(function (m, s) { return String(s.fecha) > m.f ? { f: String(s.fecha), p: String(s.actualizado_por) } : m; }, { f: '', p: '' });
    var cod = String(a.grado), et = COM_GRADO_LABEL[cod] || ('grado ' + cod), mat = mias.filter(function (s) { return /^matricula:/.test(s.seccion); }).length, est = mias.filter(function (s) { return /^estudiantes:/.test(s.seccion); }).length, rec = mias.filter(function (s) { return /^reconocimientos:/.test(s.seccion); }).length;
    lineas.push('• Acta ' + a.acta_no + ' · ' + et + ' · ' + a.periodo + ' · ' + a.estado + (a.responsable ? ' · edita: ' + a.responsable : '') + '\n   ' + mias.length + ' partes guardadas (matrícula de ' + mat + ' cursos, listas de ' + est + ' cursos, reconocimientos de ' + rec + ' cursos) · último guardado: ' + (ult.f || '—') + (ult.p ? ' por ' + ult.p : ''));
  });
  var msg = lineas.length ? lineas.join('\n') : 'Todavía no hay actas guardadas.';
  msg += '\n\nDónde está cada cosa:\n· Comision_Actas: una fila por acta.\n· Comision_Secciones: cada parte del acta (columna json) con su versión, quién y cuándo.\n· Comision_Historial y Comision_CambiosHojas: versiones anteriores y cambios en las hojas (una semana).\n· Estudiantes e Identidad_Docentes: los datos que se completaron (documento, tipo, lugar de expedición, sexo, nacionalidad, celular, correo).\n· Drive: APP ASISTENCIA DOCENTE / COMISIONES / Borradores (copia legible).';
  SpreadsheetApp.getUi().alert('Comisiones guardadas', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  return lineas;
}

/* ------------------------------ datos del grado para la pantalla real ------------------------------ */
/* Docentes que ALTERNAN cada semana con quien figura en el Horario (el Horario trae una sola persona por franja). Se suman al equipo del acta con la misma área.
   Defecto: María del Carmen Quintero alterna Sociales/Inglés (CSI) con Adiela Ortiz en 8.º (0801 y 0802). Otros casos: parámetro comisiones_alternan = [{"docente":"...","grupos":["0801"],"area":"CSI"}]. */
var COM_ALTERNAN_DEFECTO = [
  // Sociales e Inglés (CSI): cada pareja alterna por semana y cada docente tiene su especialidad (aclarado por el coordinador, 2026-11-25).
  // 6.º hasta CS1-1: García Gobea alterna consigo misma (no necesita complemento).
  { docente: 'Quintero Ramírez María del Carmen', grupos: ['0801', '0802', 'CS201', 'CS202'], area: 'CSI' },   // inglés
  { docente: 'Ortiz Araujo Adiela Carlota', grupos: ['0701', '0702', '0703', '0704'], area: 'CSI' },             // sociales
  { docente: 'Pulgarín Ortiz César Marino', grupos: ['0901', '0902', '1001'], area: 'CSI' },                     // sociales
  { docente: 'Betancourth Ocampo Yohana Patricia', grupos: ['1002', '1101', '1102'], area: 'CSI' },              // inglés
  // Ética y Religión (ETR): Lozano atiende sola 6.º hasta CS1-1; en CS1-2 y 7.º alternan Castillo (religión) y Casanova (ética); en 8.º y CS2 también; en 9.º a 11.º, Estacio (religión) y Montaño (ética).
  { docente: 'Castillo Angulo Martha Cecilia', grupos: ['0701', '0702', '0703', '0704', 'CS102'], area: 'ETR' },
  { docente: 'Casanova Quiñones Yoli del Carmen', grupos: ['0801', '0802', 'CS201', 'CS202', 'CS102'], area: 'ETR' },
  { docente: 'Estacio Estupiñán Rosario', grupos: ['1002', '1101', '1102'], area: 'ETR' },
  { docente: 'Montaño Arizala Leidis Claudina', grupos: ['0901', '0902', '1001'], area: 'ETR' },
  // Ciencias Naturales (CNA): en 9.º a 11.º y CS2 son complemento Miriam Lemos (química) y Héctor Villota (física).
  { docente: 'Lemos Guancha Miriam', grupos: ['1001', '1002', '1101', '1102'], area: 'CNA' },
  { docente: 'Villota Rubio Héctor Hugo', grupos: ['0901', '0902', 'CS201', 'CS202'], area: 'CNA' }
];
function comisionAlternan_() {
  var c = []; try { c = JSON.parse(parametro_('comisiones_alternan', '[]')) || []; } catch (e) { c = []; }
  return COM_ALTERNAN_DEFECTO.concat(Array.isArray(c) ? c : []);
}
function comisionHorarioConAlternan_() {
  var h = [];
  datos_('Horario').forEach(function (x) {
    if (String(x.tipo) === 'ENFASIS') {   // las filas de énfasis no traen «grupo»: el curso está en grupos_enfasis; así los docentes del énfasis entran al equipo y a las áreas
      String(x.grupos_enfasis || '').split(/[;,\s]+/).forEach(function (g) { if (g) h.push({ docente: x.docente, grupo: g, area: x.area, tipo: 'ENFASIS' }); });
    } else h.push(x);
  });
  comisionAlternan_().forEach(function (a) { (a.grupos || []).forEach(function (g) { if (a.docente && g) h.push({ docente: String(a.docente), grupo: String(g), area: String(a.area || '') }); }); });
  return h;
}
/* Decisión del coordinador (2026-11-24): los grupos de «Caminar en Secundaria» se trabajan en el acta del grado al que corresponden: CS 1 con 7.º y CS 2 con 9.º. */
var COM_PERIODOS = ['Primero', 'Segundo', 'Tercero', 'Final'];
function comisionUnionDefecto_(periodo) { return { CS1: '06', CS2: '08' }; }  // decisión 2026-11-24 (esta vez): CS 1 con 6.º y CS 2 con 8.º en todos los períodos; coordinación puede cambiarlo por período
/* Coordinación puede cambiar la integración por período (parámetro comisiones_union): CS1 con 6.º o 7.º y CS2 con 8.º o 9.º. */
function comisionUnionConfig_() { if (COM_UNION_CFG) return COM_UNION_CFG; var c = {}; try { c = JSON.parse(parametro_('comisiones_union', '{}')) || {}; } catch (e) { c = {}; } COM_UNION_CFG = c; return c; }
function comisionUnionReset_() { COM_UNION_MEMO = null; COM_UNION_RES = {}; COM_UNION_CFG = null; }
/* Quién ya «tomó» a Caminar en un período: (1) lo registrado al abrir un acta (parámetro comisiones_union_uso) y (2) actas antiguas de 7.º y 9.º con datos (antes de 2026.11.24-c Caminar siempre iba con 7.º y 9.º). */
var COM_UNION_MEMO = null, COM_UNION_RES = {}, COM_UNION_CFG = null;
function comisionUnionUso_() { var c = {}; try { c = JSON.parse(parametro_('comisiones_union_uso', '{}')) || {}; } catch (e) { c = {}; } return c; }
function comisionUnionOcupacion_(periodo) {
  var per = String(periodo || 'Final'); COM_UNION_MEMO = COM_UNION_MEMO || {};
  if (COM_UNION_MEMO[per]) return COM_UNION_MEMO[per];
  var r = { CS1: null, CS2: null }, uso = comisionUnionUso_()[per] || {};
  if (uso.CS1) r.CS1 = uso.CS1; if (uso.CS2) r.CS2 = uso.CS2;
  if (!r.CS1 || !r.CS2) {
    var cnt = comisionContarSecciones_();
    datosOCrea_('Comision_Actas', COL_CACTAS).forEach(function (x) {
      if (x.estado === 'DUPLICADA' || String(x.periodo) !== per || !cnt[String(x.id)]) return;
      var g = String(x.grado == null ? '' : x.grado).trim(); g = /^\d$/.test(g) ? '0' + g : g;
      if (g === '07' && !r.CS1) r.CS1 = '07'; if (g === '09' && !r.CS2) r.CS2 = '09';
    });
  }
  COM_UNION_MEMO[per] = r; return r;
}
function comisionUnion_(periodo) {
  var kp = String(periodo || 'Final'); if (COM_UNION_RES[kp]) return COM_UNION_RES[kp];
  var d = comisionUnionDefecto_(periodo), o = comisionUnionConfig_()[String(periodo || 'Final')] || {}, oc = comisionUnionOcupacion_(periodo);
  COM_UNION_RES[kp] = { CS1: o.CS1 === '06' || o.CS1 === '07' ? o.CS1 : (oc.CS1 || d.CS1), CS2: o.CS2 === '08' || o.CS2 === '09' ? o.CS2 : (oc.CS2 || d.CS2) };
  return COM_UNION_RES[kp];
}
/** Al abrir un acta que recibe a Caminar, queda registrado quién lo tomó: el otro grado ya no puede trabajarlo en ese período. */
function comisionUnionRegistrar_(periodo, grado) {
  var u = comisionUnion_(periodo), uso = comisionUnionUso_(), per = String(periodo), x = uso[per] || {}, cambio = false;
  ['CS1', 'CS2'].forEach(function (k) { if (u[k] === grado && !x[k]) { x[k] = grado; cambio = true; } });
  if (cambio) { uso[per] = x; guardarParametro_('comisiones_union_uso', JSON.stringify(uso)); comisionUnionReset_(); }
}
function comisionUnionLeer() {
  var r = {}; COM_PERIODOS.forEach(function (p) { r[p] = comisionUnion_(p); });
  var oc = {}; COM_PERIODOS.forEach(function (p) { oc[p] = comisionUnionOcupacion_(p); });
  return { periodos: COM_PERIODOS, union: r, tomado: oc, defecto: { Primero: comisionUnionDefecto_('Primero'), Segundo: comisionUnionDefecto_('Segundo'), Tercero: comisionUnionDefecto_('Tercero'), Final: comisionUnionDefecto_('Final') } };
}
function comisionUnionGuardar(p) {
  var quien = comisionQuien_(); if (!quien.coord) throw new Error('Solo coordinación académica o el desarrollador cambian la integración de Caminar en Secundaria.');
  p = p || {}; var per = String(p.periodo || ''); if (COM_PERIODOS.indexOf(per) < 0) throw new Error('Período no válido.');
  if (['06', '07'].indexOf(String(p.CS1)) < 0 || ['08', '09'].indexOf(String(p.CS2)) < 0) throw new Error('CS 1 se integra con 6.º o 7.º; CS 2 con 8.º o 9.º.');
  var oc = comisionUnionOcupacion_(per), nom = { '06': '6.º', '07': '7.º', '08': '8.º', '09': '9.º' };
  if (oc.CS1 && oc.CS1 !== String(p.CS1)) throw new Error('El acta de ' + nom[oc.CS1] + ' ya empezó a trabajar con Caminar en Secundaria 1 en el período ' + per + '. Pónganse de acuerdo con esa comisión antes de cambiarlo.');
  if (oc.CS2 && oc.CS2 !== String(p.CS2)) throw new Error('El acta de ' + nom[oc.CS2] + ' ya empezó a trabajar con Caminar en Secundaria 2 en el período ' + per + '. Pónganse de acuerdo con esa comisión antes de cambiarlo.');
  var c = comisionUnionConfig_(); c[per] = { CS1: String(p.CS1), CS2: String(p.CS2) };
  guardarParametro_('comisiones_union', JSON.stringify(c)); comisionUnionReset_();
  return comisionUnionLeer();
}
function comisionGradoActa_(grupo, periodo) { var g = partesGrupo_(grupo).grado; return comisionUnion_(periodo)[g] || g; }
var COM_GRADO_LABEL = { '00': '0° Preescolar', '01': '1° Primaria', '02': '2° Primaria', '03': '3° Primaria', '04': '4° Primaria', '05': '5° Primaria', '06': '6° Secundaria', 'CS1': 'CS 1 (Caminar en Secundaria 1, 6°-7°)', '07': '7° Secundaria', '08': '8° Secundaria', '09': '9° Secundaria', 'CS2': 'CS 2 (Caminar en Secundaria 2, 8°-9°)', '10': '10° Media', '11': '11° Media' };
var COM_GRADO_SIG = { '00': '1°', '01': '2°', '02': '3°', '03': '4°', '04': '5°', '05': '6°', '06': '7°', 'CS1': 'Caminar en Secundaria 2', '07': '8°', '08': '9°', '09': '10°', 'CS2': '10°', '10': '11°', '11': 'egreso (graduandos)' };
/** Lee una columna opcional de una fila de la hoja sin importar mayúsculas, tildes, espacios ni guiones del encabezado (documento, Documento, tipo_doc, Tipo doc…). */
function comisionCol_(fila, nombres) {
  var ks = Object.keys(fila), norm = function (s) { return comisionSinTildes_(String(s)).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  for (var i = 0; i < nombres.length; i++) for (var j = 0; j < ks.length; j++) if (norm(ks[j]) === nombres[i]) { var v = fila[ks[j]]; if (v === null || v === undefined) return ''; if (typeof v === 'number' && isFinite(v) && Math.floor(v) === v) return v.toFixed(0); return String(v).trim(); }
  return '';
}
/** Celular y correo institucional del docente desde la hoja Identidad_Docentes (columnas opcionales «celular» y «correo_institucional»). */
/** El correo institucional (@icet.edu.co) no sirve como contacto: cada docente debe registrar uno personal. */
function comisionMailPersonal_(m) { m = String(m || '').trim(); return /@([a-z0-9-]+\.)*icet\.edu\.co$/i.test(m) ? '' : m; }
function comisionIdentidad_(nombre) {
  var f = datosOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC).filter(function (x) { return comisionSinTildes_(x.docente) === comisionSinTildes_(nombre); })[0];
  if (!f) return { cel: '', mail: '' };
  var cel = comisionCol_(f, ['celular', 'telefono', 'telefonomovil', 'movil']).replace(/\D/g, '');
  return { cel: cel, mail: comisionMailPersonal_(comisionCol_(f, ['correopersonal'])) };
}
/** Devuelve la columna (1..n) de un encabezado en la hoja; si no existe la agrega al final. */
function comisionColHoja_(sh, nombre) {
  var h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0], i, n = comisionSinTildes_(nombre).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (i = 0; i < h.length; i++) if (comisionSinTildes_(h[i]).toLowerCase().replace(/[^a-z0-9]/g, '') === n) return i + 1;
  sh.getRange(1, h.length + 1).setValue(nombre); return h.length + 1;
}
/** Lo que se completa en el acta también queda en las hojas del libro: celular y correo de los docentes (Identidad_Docentes) y teléfono del acudiente (Estudiantes). */
function comisionAHojas_(seccion, datos, por, acta) {
  if (!datos || typeof datos !== 'object') return;
  if (seccion === 'firmas') {
    var pers = datos.pers || {}, nombres = Object.keys(pers); if (!nombres.length) return;
    var sh = hojaOCrea_('Identidad_Docentes', COL_IDENTIDAD_DOC), v = sh.getDataRange().getValues(), cCel = comisionColHoja_(sh, 'celular'), cMail = comisionColHoja_(sh, 'correo_personal');
    nombres.forEach(function (n) {
      var x = pers[n] || {}, cel = String(x.tel || '').replace(/\D/g, ''), mail = String(x.correo || '').trim();
      if (!cel && !mail && !String(x.ced || '').trim()) return;
      var fila = 0; for (var i = 1; i < v.length; i++) if (comisionSinTildes_(v[i][0]) === comisionSinTildes_(n)) { fila = i + 1; break; }
      if (!fila) { sh.appendRow([n, '']); v.push([n, '']); fila = v.length; }
      if (/^3\d{9}$/.test(cel)) comisionSetHoja_(sh, fila, cCel, 'celular', cel, por, acta);
      var ced = String(x.ced || '').replace(/\D/g, ''); if (/^\d{5,12}$/.test(ced) && !String(v[fila - 1] && v[fila - 1][1] || '').trim()) comisionSetHoja_(sh, fila, 2, 'cedula', ced, por, acta);
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) && !/@icet\./i.test(mail)) comisionSetHoja_(sh, fila, cMail, 'correo_personal', mail, por, acta);
    });
  } else if (seccion === 'faltantes') {
    var d = datos.datos || {}, ids = Object.keys(d).filter(function (k) { var x = d[k]; return x && (String(x.tel || '').replace(/\D/g, '').length >= 7 || x.mod || x.gest); }); if (!ids.length) return;
    var he = hojaOCrea_('Estudiantes', ['grupo', 'curso', 'no', 'apellidos', 'nombres']), ve = he.getDataRange().getValues(), filas = [];
    for (var j = 1; j < ve.length; j++) if (ve[j][0] !== '') filas.push(j + 1);   // mismo orden que datos_('Estudiantes'): id = posición
    var col = {}; var c = function (n) { return col[n] || (col[n] = comisionColHoja_(he, n)); };
    ids.forEach(function (k) {
      var f = filas[Number(k) - 1], x = d[k]; if (!f) return;
      if (String(x.tel || '').replace(/\D/g, '').length >= 7) comisionSetHoja_(he, f, c('tel_acudiente'), 'tel_acudiente', String(x.tel).replace(/\D/g, ''), por, acta);
      if (x.gest) comisionSetHoja_(he, f, c('gestion_acta'), 'gestion_acta', String(x.gest), por, acta);
      if (x.mod) {
        if (x.ndoc) { comisionSetHoja_(he, f, c('documento'), 'documento', String(x.ndoc), por, acta); if (x.tdoc) comisionSetHoja_(he, f, c('tipo_doc'), 'tipo_doc', String(x.tdoc), por, acta); }
        if (x.lex) comisionSetHoja_(he, f, c('lugar_expedicion'), 'lugar_expedicion', String(x.lex), por, acta);
        if (x.sx) comisionSetHoja_(he, f, c('sexo'), 'sexo', String(x.sx), por, acta);
        if (x.nac) comisionSetHoja_(he, f, c('nacionalidad'), 'nacionalidad', String(x.nac), por, acta);
      }
    });
  }
}
function comisionTitulo_(s) { return String(s == null ? '' : s).toLowerCase().replace(/(^|[\s\-])([a-záéíóúñü])/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/ (De|Del|La|Las|Los|Y) /g, function (m) { return m.toLowerCase(); }).trim(); }
function comisionCorreoDe_(nombre) {
  var c = '';
  if (VAL_REQ) {   // en solicitudes de solo lectura se lee la hoja de claves una sola vez para todas las personas
    if (!VAL_REQ.__cl) { VAL_REQ.__cl = {}; try { datos_('Claves_Docentes').forEach(function (x) { VAL_REQ.__cl[sinTildesDoc_(x.docente)] = String(x.correo_contacto || '').trim(); }); } catch (e) { /* sin hoja */ } }
    c = VAL_REQ.__cl[sinTildesDoc_(nombre)] || '';
  } else { var f = null; try { f = filaClaveDoc_(nombre); } catch (e) { f = null; } c = f && String(f.v[f.col.correo_contacto] || '').trim(); }
  if (c) return c;
  var d = datos_('Docentes').filter(function (x) { return comisionSinTildes_(x.nombre_completo) === comisionSinTildes_(nombre); })[0];
  return d && d.correo ? String(d.correo).trim() : '';
}
/** Todo lo que la pantalla necesita de UN grado: cursos, directores, áreas y sus docentes, estudiantes y datos de los integrantes. */
function comisionGradoDatos(p) { VAL_REQ = {}; try { return comisionGradoDatosImpl_(p); } finally { VAL_REQ = null; } }
function comisionGradoDatosImpl_(p) {
  var quien = comisionQuien_(); p = p || {};
  var cod = String(p.grado || ''), label = COM_GRADO_LABEL[cod];
  if (!label) throw new Error('Ese grado no existe.');
  var al = comisionAlcance_(quien, cod, p.periodo);
  if (comisionSinAlcance_(al)) throw new Error('Usted no tiene cursos ni áreas en este grado.');
  var grupos = datos_('Grupos').filter(function (g) { return comisionGradoActa_(g.grupo, p.periodo) === cod; }).sort(function (a, b) { return String(a.grupo).localeCompare(String(b.grupo)); });
  var gs = grupos.map(function (g) { return String(g.nombre); }), codes = grupos.map(function (g) { return String(g.grupo); });
  var niv = cod === '00' ? 'pre' : /^0[1-4]$/.test(cod) ? 'pri' : cod === '05' ? 'rot' : 'sec';
  var dir = [], dir2 = [], dirs = {};
  grupos.forEach(function (g, i) {
    var d = datos_('Direccion_Grupo').filter(function (x) { return String(x.grupo) === String(g.grupo); })[0] || {};
    dir.push(String(d.docente_1 || '')); if (d.docente_2) dir2.push({ n: String(d.docente_2), gr: gs[i] });
    [d.docente_1, d.docente_2].forEach(function (n) { if (n) dirs[comisionSinTildes_(n)] = 1; });
  });
  var areas = {}, nomAreas = {}, ap = {};
  comisionHorarioConAlternan_().forEach(function (h) {
    if (!h.docente || comisionGradoActa_(h.grupo, p.periodo) !== cod) return;
    var a = String(h.area || '').trim(); if (/MULTIPLES/i.test(comisionSinTildes_(a))) return;
    (COM_COD_AREA[comisionSinTildes_(a)] || []).forEach(function (x) { nomAreas[x] = nomAreas[x] || {}; nomAreas[x][String(h.docente)] = 1; });
    if (!dirs[comisionSinTildes_(h.docente)]) ap[String(h.docente)] = 1;
  });
  Object.keys(nomAreas).forEach(function (a) { areas[a] = Object.keys(nomAreas[a]).sort().join(' / '); });
  var apoyo = [];
  datos_('Directivos').forEach(function (d) { var n = nombreDirectivoCompleto_(d.nombre, d); apoyo.push({ n: n, rol: String(d.rol), p: false, correo: String(d.correo || d.correo_temporal || '') }); });
  datos_('Docentes').forEach(function (d) { if (/ORIENTACI/i.test(String(d.nivel))) apoyo.push({ n: d.nombre_completo, rol: 'Docente orientadora', p: false }); else if (/PTAFI/i.test(String(d.nivel))) apoyo.push({ n: d.nombre_completo, rol: 'Tutora PTAFI', p: false }); });
  var gnames = {}; dir.forEach(function (n) { if (n) gnames[n] = 1; }); dir2.forEach(function (d) { gnames[d.n] = 1; }); Object.keys(ap).forEach(function (n) { gnames[n] = 1; }); apoyo.forEach(function (a) { gnames[a.n] = 1; });
  var personas = {};
  Object.keys(gnames).forEach(function (n) { var ap0 = apoyo.filter(function (a) { return a.n === n; })[0]; var idn = comisionIdentidad_(n); personas[n] = { ced: cedulaDoc_(n), correo: comisionMailPersonal_((ap0 && ap0.correo) || comisionCorreoDe_(n) || idn.mail), tel: idn.cel }; });
  var setg = {}; codes.forEach(function (c) { setg[c] = gs[codes.indexOf(c)]; });
  var est = [];
  datos_('Estudiantes').forEach(function (e, i) { var g = String(e.grupo); if (!setg[g]) return; var sx = comisionCol_(e, ['sexo', 'genero']); est.push({ id: i + 1, g: setg[g], a: comisionTitulo_(e.apellidos), n: comisionTitulo_(e.nombres), ndoc: comisionCol_(e, ['documento', 'nodoc', 'numerodocumento', 'numdoc', 'ndoc', 'identificacion', 'cedula']).replace(/\D/g, ''), tdoc: comisionCol_(e, ['tipodoc', 'tipodedocumento', 'tipodocumento', 'tdoc', 'tipo']).replace(/[^A-Za-z]/g, '').toUpperCase(), tel: comisionCol_(e, ['telacudiente', 'telefonoacudiente', 'celularacudiente']).replace(/\D/g, ''), lex: comisionCol_(e, ['lugarexpedicion', 'lugardeexpedicion', 'expedicion']), nac: comisionCol_(e, ['nacionalidad']), sx: /^(m|h|hombre|masculino)$/i.test(sx) ? 'M' : /^(f|mujer|femenino)$/i.test(sx) ? 'F' : '' }); });
  var e0 = datos_('Estudiantes')[0] || {}, kn = function (s) { return comisionSinTildes_(String(s)).toLowerCase().replace(/[^a-z0-9]/g, ''); }, ks0 = Object.keys(e0).map(kn);
  var diag = { colDoc: ks0.indexOf('documento') >= 0 || ks0.indexOf('nodoc') >= 0 || ks0.indexOf('numerodocumento') >= 0, colTipo: ks0.indexOf('tipodoc') >= 0 || ks0.indexOf('tipodedocumento') >= 0 || ks0.indexOf('tipodocumento') >= 0, conDoc: est.filter(function (x) { return x.ndoc; }).length, total: est.length, version: (typeof VERSION_SISTEMA !== 'undefined' ? VERSION_SISTEMA : '') };
  return { diag: diag, codigo: cod, label: label, niv: niv, sig: COM_GRADO_SIG[cod], gs: gs, codes: codes, dir: dir, dir2: dir2, ap: Object.keys(ap).sort(), areas: areas, apoyo: apoyo, personas: personas, estudiantes: est };
}
/** Cierre del acta desde la pantalla (la pantalla ya verificó los pendientes): solo el responsable o coordinación; la hora es la del servidor. */
function comisionCierreSimple(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta); if (a.estado !== 'ABIERTA') throw new Error('El acta ya está cerrada.');
    var turnoC = comisionTurno_(quien, a); if (turnoC) throw new Error(turnoC);
    return comisionCerrarActa_(a, { por: quien.nombre }, quien);
  } finally { lock.releaseLock(); }
}

/* ------------------------------ seguimiento para directivos ------------------------------ */
/** Avance de cada acta del año: qué componentes ya están, quién tocó algo por última vez y qué porcentaje lleva. Solo directivos. */
function comisionSeguimiento() {
  var id = identidad_(); if (id.rol !== 'directivo') throw new Error('Solo directivos ven el seguimiento de las comisiones.');
  var anio = Number(parametro_('anio_lectivo', String(new Date().getFullYear()))), out = [];
  var grupos = datos_('Grupos');
  comisionActas_().filter(function (a) { return String(a.anio) === String(anio); }).forEach(function (a) {
    var secs = comisionSecciones_(a.id), cod = String(a.grado), pre = cod === '00', fin = a.periodo === 'Final';
    function d(k) { return secs[k] && secs[k].datos; }
    var cursos = grupos.filter(function (g) { return comisionGradoActa_(g.grupo, a.periodo) === cod; }).map(function (g) { return String(g.grupo); });
    var c = { matricula: 0, reprobacion: 0, reconocimientos: 0, convivencia: 0, compromisos: 0, piar: 0, promocion: 0 };
    cursos.forEach(function (k) {
      var m = d('matricula:' + k); if (m && m.mat && m.mat.ok) c.matricula++;
      var e = d('estudiantes:' + k) || {}, sc = e.sc || {};
      if ((e.rep || []).length || sc.rep) c.reprobacion++; if ((e.con || []).length || sc.con) c.convivencia++; if ((e.com || []).length || sc.com) c.compromisos++; if ((e.piar || []).length || sc.piar) c.piar++;
      var r = d('reconocimientos:' + k) || {}; if (r.recOk || r.sc) c.reconocimientos++;
      var p = d('promocion:' + k); if (p && p.promOk) c.promocion++;
    });
    var nAreas = pre ? 1 : COM_AREAS.length, nRec = pre ? COM_PRE_CLAVES.length : COM_AREAS.length, areas = 0, recs = 0;
    Object.keys(secs).forEach(function (k) { if (/^areas:/.test(k)) areas++; if (/^recomendaciones:/.test(k) && secs[k].datos && String(secs[k].datos.texto || '').trim()) recs++; });
    var integ = (d('integrantes') || {}).int || [], pres = integ.filter(function (x) { return x && x.p; }).length, jur = Object.keys((d('listos') || {}).jur || {}).length, firm = Object.keys((d('firmas') || {}).firm || {}).length;
    var comp = [['Matrícula confirmada', c.matricula, cursos.length], ['Reprobación declarada', c.reprobacion, cursos.length], ['Reconocimientos confirmados', c.reconocimientos, cursos.length], ['Convivencia declarada', c.convivencia, cursos.length], ['Compromisos declarados', c.compromisos, cursos.length], ['PIAR declarado', c.piar, cursos.length]];
    if (fin && !pre) comp.push(['Promoción confirmada', c.promocion, cursos.length]);
    comp.push([pre ? 'Propósitos registrados' : 'Áreas con cifras', Math.min(areas, nAreas), nAreas], ['Recomendaciones escritas', Math.min(recs, nRec), nRec]);
    var hecho = 0, total = 0; comp.forEach(function (x) { hecho += x[1]; total += x[2]; });
    var pr = (d('presencia') || {}).pers || {}, ahoraMin = Number(Utilities.formatDate(new Date(), TZ, 'HH')) * 60 + Number(Utilities.formatDate(new Date(), TZ, 'mm')), hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    var redactando = Object.keys(pr).map(function (n) { var x = pr[n] || {}, v = String(x.visto || ''), m = /^(\d\d):(\d\d)$/.exec(v); return { n: n, rol: String(x.rol || ''), lugar: String(x.lugar || ''), detalle: String(x.detalle || '').slice(0, 40), desde: String(x.desde || ''), visto: v, dia: String(x.dia || ''), activo: !!(m && x.dia === hoy && ahoraMin - (Number(m[1]) * 60 + Number(m[2])) <= 10 && ahoraMin >= (Number(m[1]) * 60 + Number(m[2]))) }; }).filter(function (x) { return x.dia === hoy; });
    var ult = { por: '', fecha: '' }; Object.keys(secs).forEach(function (k) { if (secs[k].fecha > ult.fecha) ult = { por: secs[k].por, fecha: secs[k].fecha }; });
    out.push({ id: a.id, grado: cod, label: COM_GRADO_LABEL[cod] || cod, periodo: a.periodo, estado: a.estado, responsable: a.responsable, acta_no: a.acta_no, asistentes: pres, declaraciones: jur, firmas: firm, ultima: ult,
      redactando: redactando, porcentaje: total ? Math.round(hecho / total * 100) : 0, componentes: comp.map(function (x) { return { nombre: x[0], hecho: x[1], total: x[2] }; }) });
  });
  return out.sort(function (x, y) { return String(y.ultima.fecha).localeCompare(String(x.ultima.fecha)); });
}


/* ------------------------------ nueva acta: archivar, borrar (recuperable) y recuperar ------------------------------ */
/** Cambia el estado de un acta (ARCHIVADA, BORRADA o ABIERTA). Solo la persona con el turno de edición, coordinación o el desarrollador. p = { acta, accion: 'archivar' | 'borrar' }. */
function comisionActaRetirar(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var a = comisionActa_(p.acta), mem = quien.coord ? '' : comisionTurno_(quien, a); if (mem) throw new Error(mem);
    if (['archivar', 'borrar'].indexOf(p.accion) < 0) throw new Error('Acción no válida.');
    var est = p.accion === 'borrar' ? 'BORRADA' : 'ARCHIVADA', fila = comisionFilaActa_(a.id);
    hojaOCrea_('Comision_Actas', COL_CACTAS).getRange(fila, 6).setValue(est);
    comisionLog_(a.id, quien.nombre, est, 'Acta ' + a.periodo + ' ' + a.grado + ' → ' + est + '. Puede recuperarse.');
    return { ok: true, estado: est };
  } finally { lock.releaseLock(); }
}
/** Actas archivadas o borradas de un grado y período (para recuperarlas). p = { periodo, grado }. */
function comisionActasGuardadas(p) {
  var quien = comisionQuien_(); p = p || {}; var cnt = comisionContarSecciones_(), grado = comisionGradoKey_(p.grado, p.periodo), per = String(p.periodo || '');
  return datosOCrea_('Comision_Actas', COL_CACTAS).filter(function (a) { return /^(ARCHIVADA|BORRADA)$/.test(String(a.estado)) && String(a.periodo) === per && comisionGradoKey_(a.grado, a.periodo) === grado; })
    .map(function (a) { return { id: String(a.id), estado: String(a.estado), creada: String(a.fecha_creacion), por: String(a.creada_por), partes: cnt[String(a.id)] || 0 }; });
}
/** Recupera un acta archivada o borrada: pasa a ABIERTA y la que estuviera abierta se archiva. p = { acta }. */
function comisionActaRecuperar(p) {
  var quien = comisionQuien_(); p = p || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var v = hojaOCrea_('Comision_Actas', COL_CACTAS).getDataRange().getValues(), h = v[0].map(String), ie = h.indexOf('estado'), ii = h.indexOf('id'), ip = h.indexOf('periodo'), ig = h.indexOf('grado'), fila = 0, obj = null;
    for (var i = 1; i < v.length; i++) if (String(v[i][ii]) === String(p.acta)) { fila = i + 1; obj = v[i]; break; }
    if (!fila || !/^(ARCHIVADA|BORRADA)$/.test(String(obj[ie]))) throw new Error('Esa acta no está archivada.');
    if (!quien.coord) { var turno = comisionTurno_(quien, { responsable: '' }); if (turno) throw new Error(turno); }
    var per = String(obj[ip]), gr = comisionGradoKey_(obj[ig], per);
    for (var j = 1; j < v.length; j++) if (j !== fila - 1 && String(v[j][ie]) === 'ABIERTA' && String(v[j][ip]) === per && comisionGradoKey_(v[j][ig], per) === gr) hojaOCrea_('Comision_Actas', COL_CACTAS).getRange(j + 1, ie + 1).setValue('ARCHIVADA');
    hojaOCrea_('Comision_Actas', COL_CACTAS).getRange(fila, ie + 1).setValue('ABIERTA');
    comisionLog_(String(p.acta), quien.nombre, 'RECUPERADA', 'Acta ' + per + ' ' + gr);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ===================== Traslados.gs =====================
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

/* ------------------------------ informe de reconocimientos (Excel / Hojas de cálculo) ------------------------------ */
var REC_ORDEN = ['excelencia', 'rendimiento academico', 'convivencia escolar', 'colaboracion y buen porte del uniforme', 'otros'];
var REC_NOMBRE = { 'excelencia': 'Excelencia', 'rendimiento academico': 'Rendimiento académico', 'convivencia escolar': 'Convivencia escolar', 'colaboracion y buen porte del uniforme': 'Colaboración y buen porte del uniforme', 'otros': 'Otros' };
function recTipoClave_(t) { var k = comisionSinTildes_(String(t || '')).toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim(); return k; }
/** Todos los estudiantes con reconocimiento del período, con sus datos, ordenados por tipo, curso (preescolar a 11.º) y apellidos. p = { periodo }. */
function reconocimientosFilas_(periodo) {
  var per = String(periodo || 'Final'); if (PERIODOS_COM.indexOf(per) < 0) throw new Error('Período no válido.');
  var est = datos_('Estudiantes'), grupos = {}; datos_('Grupos').forEach(function (g) { grupos[trasladoCodigo_(g.grupo)] = String(g.nombre || g.grupo); });
  var cnt = comisionContarSecciones_(), mejor = {};
  comisionActas_().forEach(function (a) { if (String(a.periodo) !== per) return; var n = cnt[String(a.id)] || 0; if (!mejor[a.grado] || n > mejor[a.grado].n) mejor[a.grado] = { a: a, n: n }; });
  var filas = [];
  Object.keys(mejor).forEach(function (cod) {
    var secs = comisionSecciones_(mejor[cod].a.id), f = (secs.faltantes && secs.faltantes.datos) || {}, datos = f.datos || {}, ing = {};
    (f.ing || []).forEach(function (x) { ing[String(x.id)] = x; });
    Object.keys(secs).forEach(function (k) {
      if (!/^reconocimientos:/.test(k) || !secs[k].datos) return;
      (secs[k].datos.rec || []).forEach(function (r) {
        var e = ing[String(r.id)], base = est[Number(r.id) - 1], o = datos[String(r.id)] || {}, nombre, grupo, ape, nom;
        if (e) { ape = e.a; nom = e.n; grupo = e.g; } else if (base) { ape = o.mod ? o.a : base.apellidos; nom = o.mod ? o.n : base.nombres; grupo = base.grupo; } else return;
        var tdoc = (e ? e.tdoc : o.tdoc) || (base && base.tipo_doc) || '', ndoc = (e ? e.ndoc : o.ndoc) || (base && base.documento) || '', lex = (e ? e.lex : o.lex) || (base && base.lugar_expedicion) || '', nac = (e ? e.nac : o.nac) || (base && base.nacionalidad) || 'Colombiana', sx = (e ? e.sx : o.sx) || (base && base.sexo) || '';
        var falta = []; if (!tdoc) falta.push('tipo de documento'); if (!ndoc) falta.push('número de documento'); if (!sx) falta.push('sexo'); if (!lex) falta.push('lugar de expedición');
        var tk = recTipoClave_(r.tipo), gc = trasladoCodigo_(grupo);
        filas.push({ tk: tk, tipo: REC_NOMBRE[tk] || String(r.tipo || ''), gc: gc, curso: grupos[gc] || gc, ape: comisionTitulo_(ape), nom: comisionTitulo_(nom), sexo: sx, tdoc: tdoc, ndoc: String(ndoc), lex: lex, nac: nac, prom: r.prom == null ? '' : String(r.prom), puesto: r.puesto ? String(r.puesto) : '', datos: falta.length ? 'Faltan: ' + falta.join(', ') : 'Completos' });
      });
    });
  });
  filas.sort(function (x, y) {
    var i = REC_ORDEN.indexOf(x.tk), j = REC_ORDEN.indexOf(y.tk); i = i < 0 ? 99 : i; j = j < 0 ? 99 : j;
    return (i - j) || x.tk.localeCompare(y.tk) || x.gc.localeCompare(y.gc) || x.ape.localeCompare(y.ape, 'es') || x.nom.localeCompare(y.nom, 'es');
  });
  return filas;
}
var REC_COLUMNAS = ['Tipo de reconocimiento', 'Curso', 'Apellidos', 'Nombres', 'Sexo', 'Tipo de documento', 'Número de documento', 'Lugar de expedición', 'Nacionalidad', 'Promedio', 'Puesto', 'Estado de los datos'];
function reconocimientosInforme(p) {
  var q = comisionQuien_(); if (q.rol !== 'directivo') throw new Error('Solo directivos generan este informe.');
  var f = reconocimientosFilas_((p || {}).periodo);
  return { periodo: String((p || {}).periodo || 'Final'), columnas: REC_COLUMNAS, filas: f.map(function (x) { return [x.tipo, x.curso, x.ape, x.nom, x.sexo, x.tdoc, x.ndoc, x.lex, x.nac, x.prom, x.puesto, x.datos]; }), total: f.length };
}
/** Crea una hoja de cálculo nueva en «App Asistencia / Informes» con el informe y devuelve su enlace. */
function reconocimientosHoja(p) {
  var q = comisionQuien_(); if (q.rol !== 'directivo') throw new Error('Solo directivos generan este informe.');
  var r = reconocimientosInforme(p), ss = SpreadsheetApp.create('Reconocimientos ICET ' + (new Date().getFullYear()) + ' · ' + r.periodo + ' · ' + ahoraTxt_()), sh = ss.getSheets()[0];
  sh.setName('Reconocimientos'); var datos = [r.columnas].concat(r.filas);
  var rg = sh.getRange(1, 1, datos.length, r.columnas.length); if (rg.setNumberFormat) rg.setNumberFormat('@'); rg.setValues(datos);
  try { sh.getRange(1, 1, 1, r.columnas.length).setFontWeight('bold').setBackground('#dde7f7'); sh.setFrozenRows(1); } catch (e) { /* formato opcional */ }
  try { var f = DriveApp.getFileById(ss.getId()); f.moveTo(carpetaHija_(carpetaApp_(), 'Informes')); } catch (e) { /* si no se puede mover, queda en Mi unidad */ }
  bitacora_('Informe de reconocimientos', r.total + ' filas · ' + r.periodo + ' · por ' + q.nombre);
  return { url: ss.getUrl(), total: r.total };
}


/** Grupos (códigos) que atiende una persona: los que dirige o en los que dicta, en cualquier grado. */
function comisionMisGrupos_(quien) {
  var N = comisionSinTildes_(quien.nombre), r = {};
  datos_('Direccion_Grupo').forEach(function (d) { if ([d.docente_1, d.docente_2].some(function (n) { return n && comisionSinTildes_(n) === N; })) r[trasladoCodigo_(d.grupo)] = 1; });
  comisionHorarioConAlternan_().forEach(function (h) { if (h.docente && h.grupo && comisionSinTildes_(h.docente) === N) r[trasladoCodigo_(h.grupo)] = 1; });
  return r;
}
/** PDF de los reconocimientos: coordinación y directivos, todos los grupos; cada docente, los grupos que atiende. p = { periodo }. Devuelve { nombre, base64, total }. */
function reconocimientosPdf(p) {
  var q = comisionQuien_(), f = reconocimientosFilas_((p || {}).periodo), per = String((p || {}).periodo || 'Final');
  if (q.rol !== 'directivo') { var mis = comisionMisGrupos_(q); f = f.filter(function (x) { return mis[x.gc]; }); }
  if (!f.length) throw new Error('No hay reconocimientos guardados' + (q.rol === 'directivo' ? '' : ' en los grupos que usted atiende') + ' en el período ' + per + '.');
  var esc = function (x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, h = '<html><body style="font-family:Arial,sans-serif;font-size:10px"><h2 style="margin:0">I.E. ICET · Reconocimientos ' + new Date().getFullYear() + '</h2><div style="color:#555;margin-bottom:8px">Período ' + esc(per) + ' · ' + f.length + ' estudiantes · ' + esc(ahoraTxt_()) + '</div>', tipo = null;
  f.forEach(function (x) {
    if (x.tipo !== tipo) { if (tipo !== null) h += '</table>'; tipo = x.tipo; h += '<h3 style="margin:12px 0 4px;color:#0f2a5c">' + esc(tipo) + '</h3><table style="border-collapse:collapse;width:100%"><tr style="background:#e8eef9"><th align="left">Curso</th><th align="left">Apellidos y nombres</th><th>Sexo</th><th>Documento</th><th>Promedio</th><th>Puesto</th><th align="left">Datos</th></tr>'; }
    h += '<tr style="border-bottom:1px solid #ddd"><td>' + esc(x.curso) + '</td><td>' + esc(x.ape + ' ' + x.nom) + '</td><td align="center">' + esc(x.sexo) + '</td><td align="center">' + esc((x.tdoc ? x.tdoc + ' ' : '') + x.ndoc) + '</td><td align="center">' + esc(x.prom) + '</td><td align="center">' + esc(x.puesto) + '</td><td>' + esc(x.datos) + '</td></tr>';
  });
  h += '</table><p style="color:#777;margin-top:14px">Control de Procesos ICET · Autor: Francisco Javier Cortés Cabezas</p></body></html>';
  var blob = HtmlService.createHtmlOutput(h).getBlob().getAs('application/pdf');
  return { nombre: 'Reconocimientos_ICET_' + per + '.pdf', base64: Utilities.base64Encode(blob.getBytes()), total: f.length };
}

// ===================== Api.gs =====================
/**
 * API del "back": el proyecto vinculado al libro, desplegado como aplicación web que se ejecuta COMO EL PROPIETARIO
 * (así lee el libro y la carpeta de soportes sin dar acceso a los docentes) y accesible para cualquiera con el enlace.
 *
 * Solo responde a peticiones POST firmadas con un secreto compartido (propiedad del script API_SECRET) que conoce únicamente el
 * proyecto "front" (apps_script/front). El front es quien verifica el correo del usuario con Google y lo reenvía; el back confía
 * en ese correo solo si el secreto es correcto, y luego aplica la matriz de permisos de abajo.
 */
var API_PERMISOS = {   // función -> roles que pueden llamarla ('*' = cualquiera)
  contextoPanel: ['*'],
  solicitarAcceso: ['sin_registro'],
  aceptarAutorizacion: ['docente'],
  listarSolicitudes: ['directivo'],
  resolverSolicitud: ['directivo'],
  consultarSesion: ['directivo'],
  guardarRonda: ['directivo'],
  datosDashboard: ['directivo', 'docente'],
  misSoportes: ['docente'],
  subirSoporte: ['docente'],
  soportesPorRevisar: ['directivo'],
  revisarSoporte: ['directivo'],
  guardarNotaRonda: ['directivo'],
  listarPropuestas: ['directivo'],
  resolverPropuesta: ['directivo'],
  definirAlternancia: ['directivo'],
  listarReuniones: ['directivo'],
  crearReunion: ['directivo'],
  cargarReunion: ['directivo'],
  guardarAsistenciaReunion: ['directivo'],
  agregarPersonaReunion: ['directivo'],
  historialReuniones: ['directivo'],
  cerrarReunion: ['directivo'],
  historialNovedades: ['directivo'],
  cambiarClave: ['directivo'],
  cambiarClaveDocente: ['docente'],
  listarDocentesAdmin: ['directivo'],
  guardarDocenteAdmin: ['directivo'],
  listarIncumplimientos: ['directivo'],
  actualizarSeguimiento: ['directivo'],
  consultaHorarios: ['directivo'],
  guardarCorreo: ['directivo'],
  datosNovedades: ['directivo'],
  registrarNovedad: ['directivo'],
  quitarNovedad: ['directivo'],
  editarNovedad: ['directivo'],
  datosEstudiantes: ['directivo'],
  marcarEstudiantes: ['directivo'],
  levantarMarcaEstudiante: ['directivo'],
  agregarEstudiante: ['directivo'],
  moverEstudiante: ['directivo'],
  agregarGrupoProyecto: ['directivo'],
  enviarInformeAMi: ['directivo'],
  levantarMarcasEstudiante: ['directivo'],
  informeRondas: ['directivo'],
  enviarRondasAMi: ['directivo'],
  editarReunion: ['directivo'],
  anularReunion: ['directivo'],
  avisosHoy: ['directivo'],
  quitarReunionesDuplicadas: ['directivo'],
  comisionContexto: ['directivo', 'docente'],
  comisionGradoDatos: ['directivo', 'docente'],
  comisionSeguimiento: ['directivo'],
  comisionPermisosLeer: ['directivo'],
  comisionModoLeer: ['directivo', 'docente'],
  comisionModoGuardar: ['directivo'],
  trasladoBuscar: ['directivo', 'docente'],
  trasladoSolicitar: ['directivo', 'docente'],
  trasladoListar: ['directivo', 'docente'],
  trasladoResolver: ['directivo'],
  estudiantesDelGrupo: ['directivo'],
  trasladoMasivo: ['directivo'],
  estudiantesCampoMasivo: ['directivo'],
  docentesCampoMasivo: ['directivo'],
  importarLibro: ['directivo'],
  respaldoRevisionAhora: ['directivo'],
  reconocimientosInforme: ['directivo'],
  reconocimientosHoja: ['directivo'],
  reconocimientosPdf: ['directivo', 'docente'],
  comisionActaRetirar: ['directivo', 'docente'],
  comisionActasGuardadas: ['directivo', 'docente'],
  comisionActaRecuperar: ['directivo', 'docente'],
  comisionUnionLeer: ['directivo', 'docente'],
  comisionUnionGuardar: ['directivo'],
  comisionHistorial: ['directivo', 'docente'],
  comisionRestaurar: ['directivo', 'docente'],
  comisionHojaDeshacer: ['directivo'],
  comisionPermisosGuardar: ['directivo'],
  comisionCierreSimple: ['directivo', 'docente'],
  comisionAbrir: ['directivo', 'docente'],
  comisionCargar: ['directivo', 'docente'],
  comisionCambios: ['directivo', 'docente'],
  comisionGuardar: ['directivo', 'docente'],
  comisionResponsable: ['directivo', 'docente'],
  comisionConfirmar: ['directivo', 'docente'],
  comisionCierre: ['directivo', 'docente'],
  comisionReabrir: ['directivo'],
  comisionSubirSoporte: ['directivo', 'docente'],
  comisionBorrador: ['directivo', 'docente'],
  comisionPendientes: ['directivo', 'docente'],
  comisionGuardarPdf: ['directivo', 'docente'],
  comisionEstudiante: ['directivo', 'docente']
};

function apiFunciones_() {
  return {
    contextoPanel: contextoPanel, solicitarAcceso: solicitarAcceso, aceptarAutorizacion: aceptarAutorizacion,
    listarSolicitudes: listarSolicitudes, resolverSolicitud: resolverSolicitud, consultarSesion: consultarSesion, guardarRonda: guardarRonda,
    datosDashboard: datosDashboard, misSoportes: misSoportes, subirSoporte: subirSoporte,
    soportesPorRevisar: soportesPorRevisar, revisarSoporte: revisarSoporte,
    guardarNotaRonda: guardarNotaRonda, listarPropuestas: listarPropuestas, resolverPropuesta: resolverPropuesta, definirAlternancia: definirAlternancia,
    listarReuniones: listarReuniones, crearReunion: crearReunion, cargarReunion: cargarReunion, guardarAsistenciaReunion: guardarAsistenciaReunion,
    cambiarClave: cambiarClave,
    cambiarClaveDocente: cambiarClaveDocente,
    listarDocentesAdmin: listarDocentesAdmin,
    guardarDocenteAdmin: guardarDocenteAdmin,
    listarIncumplimientos: listarIncumplimientos, actualizarSeguimiento: actualizarSeguimiento,
    consultaHorarios: consultaHorarios,
    guardarCorreo: guardarCorreo,
    datosNovedades: datosNovedades, registrarNovedad: registrarNovedad, quitarNovedad: quitarNovedad, editarNovedad: editarNovedad,
    datosEstudiantes: datosEstudiantes, marcarEstudiantes: marcarEstudiantes, levantarMarcaEstudiante: levantarMarcaEstudiante,
    agregarEstudiante: agregarEstudiante, moverEstudiante: moverEstudiante,
    agregarGrupoProyecto: agregarGrupoProyecto,
    enviarInformeAMi: enviarInformeAMi,
    levantarMarcasEstudiante: levantarMarcasEstudiante,
    informeRondas: informeRondas, enviarRondasAMi: enviarRondasAMi,
    editarReunion: editarReunion, agregarPersonaReunion: agregarPersonaReunion, historialReuniones: historialReuniones, cerrarReunion: cerrarReunion, historialNovedades: historialNovedades, anularReunion: anularReunion, avisosHoy: avisosHoy, quitarReunionesDuplicadas: quitarReunionesDuplicadas,
    comisionContexto: comisionContexto, comisionGradoDatos: comisionGradoDatos, comisionSeguimiento: comisionSeguimiento, comisionPermisosLeer: comisionPermisosLeer, comisionModoLeer: comisionModoLeer, comisionModoGuardar: comisionModoGuardar, trasladoBuscar: trasladoBuscar, trasladoSolicitar: trasladoSolicitar, trasladoListar: trasladoListar, trasladoResolver: trasladoResolver, estudiantesDelGrupo: estudiantesDelGrupo, trasladoMasivo: trasladoMasivo, estudiantesCampoMasivo: estudiantesCampoMasivo, docentesCampoMasivo: docentesCampoMasivo, importarLibro: importarLibro, respaldoRevisionAhora: respaldoRevisionAhora, reconocimientosInforme: reconocimientosInforme, reconocimientosHoja: reconocimientosHoja, reconocimientosPdf: reconocimientosPdf, comisionActaRetirar: comisionActaRetirar, comisionActasGuardadas: comisionActasGuardadas, comisionActaRecuperar: comisionActaRecuperar, comisionUnionLeer: comisionUnionLeer, comisionUnionGuardar: comisionUnionGuardar, comisionHistorial: comisionHistorial, comisionRestaurar: comisionRestaurar, comisionHojaDeshacer: comisionHojaDeshacer, comisionPermisosGuardar: comisionPermisosGuardar, comisionCierreSimple: comisionCierreSimple, comisionAbrir: comisionAbrir, comisionCargar: comisionCargar, comisionCambios: comisionCambios, comisionGuardar: comisionGuardar,
    comisionResponsable: comisionResponsable, comisionConfirmar: comisionConfirmar, comisionCierre: comisionCierre, comisionReabrir: comisionReabrir, comisionSubirSoporte: comisionSubirSoporte, comisionBorrador: comisionBorrador, comisionPendientes: comisionPendientes, comisionGuardarPdf: comisionGuardarPdf, comisionEstudiante: comisionEstudiante
  };
}

/** Comparación en tiempo constante para no revelar el secreto por diferencias de tiempo. */
function igualConstante_(a, b) {
  a = String(a || ''); b = String(b || '');
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/** Ejecuta una función de la API para un correo ya verificado (por el front con secreto, o por una sesión con clave). */
function apiDespachar_(email, fn, args) {
  var permitidos = API_PERMISOS[fn], tabla = apiFunciones_();
  if (!permitidos || !tabla[fn]) return { ok: false, error: 'Función no permitida' };
  REQ_EMAIL = email || '';
  try {
    var rol = identidad_().rol;
    if (permitidos.indexOf('*') < 0 && permitidos.indexOf(rol) < 0) return { ok: false, error: 'Sin permiso para esta acción (' + rol + ').' };
    return { ok: true, data: tabla[fn].apply(null, args || []) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { REQ_EMAIL = null; }
}

/** Petición del proyecto "front" (modo B): exige el secreto compartido. Separada de doPost para poder probarla. */
function apiEjecutar_(req, secretoEsperado) {
  if (!secretoEsperado || !igualConstante_(req && req.secret, secretoEsperado)) return { ok: false, error: 'No autorizado' };
  return apiDespachar_(req.email, req.fn, req.args);
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Petición inválida' })).setMimeType(ContentService.MimeType.JSON); }
  var out = apiEjecutar_(req, PropertiesService.getScriptProperties().getProperty('API_SECRET'));
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

