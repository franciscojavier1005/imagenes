/**
 * ICET 2026 - Control de asistencia docente (ronda de verificación)
 *
 * Instalación: abrir el libro en Google Sheets > Extensiones > Apps Script,
 * pegar este archivo como Codigo.gs y crear el archivo HTML "Consulta" con Consulta.html.
 * Luego: Implementar > Nueva implementación > Aplicación web
 *        (ejecutar como: el usuario que accede; acceso: solo directivos).
 *
 * Panel: Dashboard.gs + Dashboard.html. Informe al rector: Dashboard.gs. Cálculo del resumen: Resumen.gs.
 * Hojas que usa: Horario, Franjas, Grupos, Direccion_Grupo, Motivos, Listas, Directivos, Registro_Ronda, Novedades.
 */
var TZ = 'America/Bogota';
var DIAS = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
var MEDIO_RONDA = 'Inspección ocular/Ronda supervisión';
var FUENTE_RONDA = 'Coordinador(a)';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Asistencia ICET')
    .addItem('Crear formulario de novedades (desplegables)', 'crearFormulario')
    .addItem('Actualizar horario de preescolar (una sola vez)', 'actualizarHorarioPreescolar')
    .addItem('Importar bandeja de WhatsApp (filas marcadas SI)', 'importarBandejaWhatsApp')
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

function datos_(n) {
  var v = hoja_(n).getDataRange().getValues(), h = v.shift();
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
  var PAGINAS = { menu: ['Menu', 'ICET - Control de asistencia docente'], ronda: ['Consulta', 'ICET - Ronda de asistencia docente'], reunion: ['Reunion', 'ICET - Reuniones y jornadas'], panel: ['Dashboard', 'ICET - Panel de asistencia docente'] };
  var pg = PAGINAS[pag] || PAGINAS.menu;
  return HtmlService.createHtmlOutputFromFile(pg[0])
    .setTitle(pg[1])
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Docentes que deben estar en la sesión indicada. Sin argumentos usa el día y la hora actuales.
 * También devuelve las listas para los radios (motivos, medios, fuentes).
 */
function consultarSesion(dia, sesion, modo) {
  asegurarMotivos_();
  var ahora = new Date();
  var auto = !dia && !sesion;
  dia = dia || DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))];
  var s = sesion ? Number(sesion) : sesionAhora_(ahora);
  var fr = datos_('Franjas').filter(function (f) { return Number(f.hora) === s; })[0];
  var out = {
    dia: dia, diaHoy: DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))], sesion: s, auto: auto, hora: Utilities.formatDate(ahora, TZ, 'HH:mm'), fecha: ymd_(ahora),
    franja: fr ? hhmm_(fr.inicio) + ' - ' + hhmm_(fr.fin) : '', bloque: fr ? Number(fr.bloque) : null, modo: modo === 'bloque' ? 'bloque' : 'sesion',
    sesionesBloque: [],
    filas: [], motivos: datos_('Motivos'), listas: datos_('Listas'),
    directivos: datos_('Directivos').map(function (d) { return d.nombre; }),
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
  var reportes = {};   // novedades de hoy ya registradas (formulario, WhatsApp o ronda anterior)
  datos_('Novedades').forEach(function (n) {
    if (fechaIso_(n['Fecha Novedad']) === out.fecha && n['Tipo Novedad'] && n['Tipo Novedad'] !== 'Presente') {
      var d = n['Docente'], medio = String(n['Medio Información'] || '');
      reportes[d] = { tipo: n['Tipo Novedad'], motivo: n['Motivo Ausencia'], texto: String(n['Descripción'] || '').slice(0, 160), medio: medio,
                      jornada: String(n['Sesiones']) === 'JC' };
    }
  });
  var yaMarcados = {};
  datos_('Registro_Ronda').forEach(function (r) {
    var f = r.fecha instanceof Date ? ymd_(r.fecha) : String(r.fecha);
    if (f === out.fecha && hs.indexOf(Number(r.sesion)) >= 0 && !yaMarcados[r.docente]) yaMarcados[r.docente] = r;
  });
  var altern = alternancias_(), totDia = {};
  var horarioDia = datos_('Horario').filter(function (h) { return h.dia === dia; });
  horarioDia.forEach(function (h) { totDia[h.docente] = (totDia[h.docente] || 0) + minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
  var fuente = horarioDia.filter(function (h) { return hs.indexOf(Number(h.hora)) >= 0; })
    .sort(function (a, b) { return Number(a.hora) - Number(b.hora); });
  out.filas = fuente.map(function (h) {
    var enf = h.tipo === 'ENFASIS';
    var nota = [/^00/.test(String(h.grupo)) ? 'Preescolar ' + hhmm_(h.inicio) + ' - ' + hhmm_(h.fin) : '', h.alternancia, h.equipo_enfasis ? 'Con: ' + h.equipo_enfasis : ''].filter(String).join(' · ');
    var ya = yaMarcados[h.docente];
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
      alternos: h.tipo === 'CLASE' && altern[h.area + '|' + h.docente] ? [altern[h.area + '|' + h.docente]] : [],   // pareja que alterna por semana: se elige quién dicta
      primario: h.docente,
      pareja: h.tipo === 'CLASE' && altern[h.area + '|' + h.docente] ? [h.docente, altern[h.area + '|' + h.docente]].sort() : null,
      claveAlt: h.tipo === 'CLASE' && altern[h.area + '|' + h.docente] ? 'CLASE|' + h.area + '|' + [h.docente, altern[h.area + '|' + h.docente]].sort().join('|') : '',
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
    f.docente = nuevo; f.alternos = []; f.definido = { por: st.por };
    f.reporte = reportes[nuevo] || null; f.minutosDia = totDia[nuevo] || 0;
    var ya2 = yaMarcados[nuevo];
    f.previo = ya2 ? { estado: ya2.estado, motivo: ya2.motivo, minutos: ya2.minutos, observaciones: ya2.observaciones, atendidoPor: ya2.atendido_por || '' } : null;
  });
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
    out.nota = 'Hay una reunión o jornada sin estudiantes en este horario (' + reun.filter(function (r) { return r.sinEstudiantes; })[0].nombre + '): no se hace ronda de aula. La asistencia se registra en Reuniones.';
  } else {
    out.filas.forEach(function (f) {
      for (var i = 0; i < reun.length; i++) if (convocadoA_(reun[i], f.docente)) { f.reunion = { id: reun[i].id, nombre: reun[i].nombre, inicio: reun[i].inicio, fin: reun[i].fin, estado: reun[i].asistencia[f.docente] || '' }; break; }
    });
  }
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
var ATIENDE_GRUPO = ['Nadie (grupo solo)', 'Sin clase: los niños no asistieron (padres avisados)', 'Reemplazo (docente)', 'Practicante', 'Auxiliar o persona de apoyo del docente', 'Otro docente o directivo'];

/** Motivos agregados después de la primera versión del libro: se añaden solos a la hoja Motivos si faltan. */
var MOTIVOS_NUEVOS = [
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
  ['CALAMIDAD DOMÉSTICA', 'Sepelio o duelo de un familiar', 'SI', 'Acta de defunción u otro soporte', 'SI', 5]
];
function asegurarMotivos_() {
  var sh = hoja_('Motivos'), existentes = datos_('Motivos').map(function (m) { return m.motivo; });
  MOTIVOS_NUEVOS.forEach(function (f) { if (existentes.indexOf(f[1]) < 0) sh.appendRow(f); });
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
  ALTERNANCIAS_DEFECTO.forEach(function (f) { if (!areas[f[0]]) sh.appendRow(f); });   // un área sin ninguna pareja recibe las de la versión inicial (no toca lo que ya editó)
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
function estadosSemana_(semana) {
  var m = {};
  datosOCrea_('Semana_Alternancia', COL_SEMANA_ALT).forEach(function (r) {
    if (fechaIso_(String(r.semana).replace(/^'/, '')) === semana) m[r.clave] = { intercambio: r.intercambio, elegido: r.elegido, por: r.definido_por };
  });
  return m;
}

/**
 * Un directivo define quién dicta esta semana. p = {clave, elegido, primario?, fecha?}
 * clave 'CLASE|area|docenteA|docenteB' (parejas de la hoja Alternancias: se guarda si la pareja intercambia sus grupos; primario = a quién
 * le corresponde la clase en el horario) o 'ENFASIS|grupos|docenteA|docenteB' (énfasis en pareja: se guarda quién atiende el grupo completo).
 */
function definirAlternancia(p) {
  p = p || {};
  var quien = REQ_EMAIL !== null ? identidad_() : null;
  if (quien && quien.rol !== 'directivo') throw new Error('Solo un directivo puede definir quién dicta.');
  var por = quien ? (quien.nombre || quien.email) : String(p.directivo || '');
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
    var datos = ["'" + semana, p.clave, p.elegido, inter, por, ahoraTxt_()];
    if (fila > 0) sh.getRange(fila, 1, 1, datos.length).setValues([datos]); else sh.appendRow(datos);
  } finally { lock.releaseLock(); }
  return { ok: true, semana: semana, intercambio: inter };
}

/** Google Sheets convierte '0101' en el número 101: los códigos con cero inicial se escriben como texto (apóstrofo). */
function textoCod_(v) { v = String(v == null ? '' : v); return /^0\d+$/.test(v) ? "'" + v : v; }

/** Minutos de una sesión: 45 en general; 60 en preescolar (4 horas de clase entre 7:30 y 11:30). */
function minutosSesion_(grupoCodigo) { return /^00/.test(String(grupoCodigo).split('+')[0]) ? 60 : 45; }

function guardarRonda(p) {
  if (REQ_EMAIL !== null) {               // llamada desde el front: el directivo es quien Google identificó, no lo que diga la pantalla
    var quien = identidad_();
    if (quien.rol === 'directivo') p.directivo = quien.nombre || quien.email;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
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
    var guardados = 0;
    (p.registros || []).forEach(function (r) {
      var sesion = Number(r.sesion || p.sesion);   // en la ronda por bloque cada marca trae su sesión (el bloque se guarda como sus dos sesiones)
      var fr = franjas.filter(function (f) { return Number(f.hora) === sesion; })[0];
      if (!fr) throw new Error('Sesión no válida: ' + sesion);
      var franjaBase = hhmm_(fr.inicio) + ' - ' + hhmm_(fr.fin);
      // quien asistió a una reunión que se cruza con esta sesión no se marca ausente: queda "En reunión" y no suma tiempo
      if (r.estado === 'No asistió' || r.estado === 'Ausente temporal') {
        var rr = reunionesEnSesiones_(fecha, [sesion], franjas).filter(function (x) { return convocadoA_(x, r.docente) && ESTADOS_REUNION_PRESENTE.indexOf(x.asistencia[r.docente]) >= 0; })[0];
        if (rr) r = Object.assign({}, r, { estado: 'En reunión', motivo: rr.nombre, minutos: '' });
      }
      var m = motivos[r.motivo] || {};
      var just = (r.estado === 'Presente' || r.estado === 'En reunión') ? '' : (m.justificada === 'SI' ? 'Sí' : 'No');
      var atiende = (r.estado === 'Presente' || r.estado === 'En reunión') ? '' : (ATIENDE_GRUPO.indexOf(r.atiende) >= 0 ? r.atiende : '');   // quién cubrió el grupo; NO cuenta como asistencia del docente
      var pre = /^00/.test(String(r.grupoCodigo));
      var hrow = pre ? hz.filter(function (h) { return h.docente === r.docente && h.dia === p.dia && Number(h.hora) === sesion; })[0] : null;
      var franja = hrow ? hhmm_(hrow.inicio) + ' - ' + hhmm_(hrow.fin) : franjaBase;   // preescolar tiene sus propios periodos
      var minutos = r.estado === 'No asistió' ? minutosSesion_(r.grupoCodigo) : (Number(r.minutos) || '');
      // 1) Registro_Ronda: una fila por docente-fecha-sesión (se reemplaza si ya existía)
      var fila = [ahora, fecha, p.dia, sesion, franja, r.docente, textoCod_(r.grupoCodigo), r.area, r.estado,
                  r.motivo || '', just, minutos, r.obs || '', p.directivo || '', atiende];
      var idx = -1;
      for (var i = 1; i < regVals.length; i++) {
        var f = regVals[i][1] instanceof Date ? ymd_(regVals[i][1]) : String(regVals[i][1]);
        if (f === fecha && Number(regVals[i][3]) === sesion && regVals[i][5] === r.docente) { idx = i; break; }
      }
      if (idx > 0) { reg.getRange(idx + 1, 1, 1, fila.length).setValues([fila]); regVals[idx] = fila; }
      else { reg.appendRow(fila); regVals.push(fila); }
      // 2) Novedades (esquema del formulario de ausentismo): quitar la anterior y agregar si hay novedad
      for (var j = novVals.length - 1; j >= 1; j--) {
        var fj = novVals[j][1] instanceof Date ? ymd_(novVals[j][1]) : String(novVals[j][1]);
        var fechaStr = fecha.split('-').reverse().map(Number).join('/');
        if ((fj === fecha || fj === fechaStr) && novVals[j][2] === r.docente && String(novVals[j][novCol]) === 'S' + sesion) {
          nov.deleteRow(j + 1); novVals.splice(j, 1);
        }
      }
      var completa = r.estado === 'No asistió' && r.alcance === 'JC';
      if (completa) {   // ausente toda la jornada: UNA sola novedad con el total de minutos; reemplaza las de sesiones y cualquier jornada ya registrada
        var mias = hz.filter(function (h) { return h.docente === r.docente && h.dia === p.dia; });
        var total = 0; mias.forEach(function (h) { total += minutosSesion_(h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo); });
        for (var q = novVals.length - 1; q >= 1; q--) {
          if (fechaIso_(novVals[q][1]) === fecha && novVals[q][2] === r.docente && /no asisti/i.test(String(novVals[q][3])) &&
              (String(novVals[q][novCol]) === 'JC' || /^S\d$/.test(String(novVals[q][novCol])))) { nov.deleteRow(q + 1); novVals.splice(q, 1); }
        }
        var gs = {}, as = {};
        mias.forEach(function (h) { gs[h.tipo === 'ENFASIS' ? h.grupos_enfasis : h.grupo] = 1; as[h.area || '(énfasis)'] = 1; });
        var gk = Object.keys(gs), ak = Object.keys(as);
        var pj = gk.length === 1 ? partesGrupo_(String(gk[0]).split('+')[0]) : { grado: 'N/A', grupo: 'N/A' };
        var nj = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', r.motivo || '', r.obs || '', r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA,
                  pj.grado, pj.grupo, ak.length === 1 ? ak[0] : (mias.length ? 'Todas' : r.area), 'Jornada completa', total || minutos, p.directivo || '',
                  'JC', just, m.categoria || '', atiende];
        nov.appendRow(nj); novVals.push(nj);
        guardados++;
        return;
      }
      var jornada = (r.estado === 'No asistió' || r.estado === 'Ausente temporal') && novVals.slice(1).some(function (x) {
        return fechaIso_(x[1]) === fecha && x[2] === r.docente && String(x[novCol]) === 'JC' && /no asisti/i.test(String(x[3]));
      });  // ya reportado como ausencia de jornada completa: se verifica en Registro_Ronda sin duplicar minutos en Novedades
      if (r.estado !== 'Presente' && r.estado !== 'En reunión' && !jornada) {
        var pg = partesGrupo_(String(r.grupoCodigo).split('+')[0]);
        var nf = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', r.motivo || '', r.obs || '',
                  r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA, pg.grado, pg.grupo, r.area,
                  'H' + sesion + ' ' + franja + (pre ? '' : ' Bloque ' + Math.ceil(sesion / 2)), minutos, p.directivo || '',
                  'S' + sesion, just, m.categoria || '', atiende];
        nov.appendRow(nf); novVals.push(nf);
      }
      guardados++;
    });
    return { ok: true, guardados: guardados };
  } finally { lock.releaseLock(); }
}

/* ------------------------------ formulario de Google (radios) ------------------------------ */
function crearFormulario() {
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
  return { quitadas: quitadas, corregidas: corregidas };
}
function actualizarHorarioPreescolar() {
  var r = actualizarHorarioPreescolar_();
  SpreadsheetApp.getUi().alert('Horario de preescolar actualizado.\nFilas de la sesión 2 quitadas: ' + r.quitadas + '\nPeriodos corregidos: ' + r.corregidas);
}
