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
  SpreadsheetApp.getUi().createMenu('Asistencia ICET')
    .addItem('Crear formulario de novedades (desplegables)', 'crearFormulario')
    .addItem('Actualizar horario de preescolar (una sola vez)', 'actualizarHorarioPreescolar')
    .addItem('Importar bandeja de WhatsApp (filas marcadas SI)', 'importarBandejaWhatsApp')
    .addItem('Generar claves de ingreso de los directivos', 'generarClavesDirectivos')
    .addItem('Restablecer la clave de un directivo', 'restablecerClaveDirectivo')
    .addItem('Acerca de este sistema', 'acercaDe')
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
  var PAGINAS = { menu: ['Menu', 'ICET - Control de asistencia docente'], novedad: ['Novedad', 'ICET - Registrar novedades'], ronda: ['Consulta', 'ICET - Ronda de asistencia docente'], reunion: ['Reunion', 'ICET - Reuniones y actividades'], horarios: ['Horarios', 'ICET - Horarios y consultas'], panel: ['Dashboard', 'ICET - Panel de asistencia docente'] };
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
  exigirDirectivo_();
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
    out.nota = 'Hay una reunión, actividad o jornada sin clases en este horario (' + reun.filter(function (r) { return r.sinEstudiantes; })[0].nombre + '): no se hace ronda de aula. La asistencia se registra en Reuniones.';
  } else {
    out.filas.forEach(function (f) {
      for (var i = 0; i < reun.length; i++) if (convocadoA_(reun[i], f.docente)) { f.reunion = { id: reun[i].id, nombre: reun[i].nombre, inicio: reun[i].inicio, fin: reun[i].fin, estado: reun[i].asistencia[f.docente] || '' }; break; }
    });
  }
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
  ['CALAMIDAD DOMÉSTICA', 'Sepelio o duelo de un familiar', 'SI', 'Acta de defunción u otro soporte', 'SI', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Salida pedagógica o recorrido con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Paseo o salida recreativa con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Intercolegiados o evento deportivo con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5],
  ['ACTIVIDAD INSTITUCIONAL', 'Charla o actividad externa con estudiantes', 'SI', 'No requiere soporte (actividad del colegio)', 'NO', 5]
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
    var datos = ["'" + semana, p.clave, p.elegido, inter, por, ahoraTxt_()];
    if (fila > 0) sh.getRange(fila, 1, 1, datos.length).setValues([datos]); else sh.appendRow(datos);
  } finally { lock.releaseLock(); }
  return { ok: true, semana: semana, intercambio: inter };
}

/** Google Sheets convierte '0101' en el número 101: los códigos con cero inicial se escriben como texto (apóstrofo). */
/** Estados de la ronda que NO son novedad (el docente está cumpliendo su labor). */
function sinNovedad_(estado) { return estado === 'Presente' || estado === 'En reunión' || estado === 'En actividad externa'; }

function textoCod_(v) { v = String(v == null ? '' : v); return /^0\d+$/.test(v) ? "'" + v : v; }

/** Minutos de una sesión: 45 en general; 60 en preescolar (4 horas de clase entre 7:30 y 11:30). */
function minutosSesion_(grupoCodigo) { return /^00/.test(String(grupoCodigo).split('+')[0]) ? 60 : 45; }

function guardarRonda(p) {
  var quien = exigirDirectivo_();          // el directivo es quien inició sesión, no lo que diga la pantalla
  p.directivo = quien.nombre || quien.email;
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
      var atiende = sinNovedad_(r.estado) ? '' : (ATIENDE_GRUPO.indexOf(r.atiende) >= 0 ? r.atiende : '');   // quién cubrió el grupo; NO cuenta como asistencia del docente
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
        var sj = String(novVals[j][novCol]), mj = sj.match(/^S(\d)$/);
        if (novVals[j][3] === TIPO_EXTERNA) continue;   // la salida con estudiantes se anula solo desde la pantalla de novedades
        if ((fj === fecha || fj === fechaStr) && novVals[j][2] === r.docente && (sj === 'S' + sesion || (inc && inc.resto && mj && Number(mj[1]) >= sesion))) {
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
      if (inc) {   // el incumplimiento siempre queda en la hoja Incumplimientos; en Novedades suma minutos salvo que la jornada completa ya los contenga
        var jc = novVals.slice(1).some(function (x) { return fechaIso_(x[1]) === fecha && x[2] === r.docente && String(x[novCol]) === 'JC' && /no asisti/i.test(String(x[3])); });
        var pgi = partesGrupo_(String(r.grupoCodigo).split('+')[0]);
        var ni = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', 'Sin justificación', String(r.obs || '').slice(0, 300), r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA, pgi.grado, pgi.grupo, r.area,
                  'H' + sesion + ' ' + franja + (pre ? '' : ' Bloque ' + Math.ceil(sesion / 2)), jc ? '' : minutos, p.directivo || '', 'S' + sesion + (inc.resto ? '-FIN' : ''), 'No', 'INCUMPLIMIENTO', atiende];
        nov.appendRow(ni); novVals.push(ni);
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
  return { quitadas: quitadas, corregidas: corregidas };
}
function actualizarHorarioPreescolar() {
  exigirEditor_();
  var r = actualizarHorarioPreescolar_();
  SpreadsheetApp.getUi().alert('Horario de preescolar actualizado.\nFilas de la sesión 2 quitadas: ' + r.quitadas + '\nPeriodos corregidos: ' + r.corregidas);
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
    h += '<h3 style="font-size:14px;margin:6px 0 0">Motivos (tiempo sin atender)</h3>' + barras(r.porCategoria, 6) +
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
    return { rol: 'directivo', nombre: id.nombre, vistaInicial: id.vistaInicial, debeCambiar: !!ec.debeCambiar, necesitaCorreo: ec.necesitaCorreo, correo: ec.correo || '', informes: ec.informes || null,
             docentes: docs.map(function (d) { return { nombre: d.nombre_completo, nivel: d.nivel }; }), niveles: Object.keys(niveles).sort() };
  }
  if (id.rol === 'docente') {
    return { rol: 'docente', vistaInicial: 'docente', docente: id.docente, autorizado: id.autorizado, textoAutorizacion: TEXTO_AUTORIZACION, version: TEXTO_AUTORIZACION_VERSION };
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
             minutos: n['Minutos Desatendidos'], directivo: n['Directivo Docente'] };
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
  var cuerpo = htmlInforme_(r, fechaTexto, ScriptApp.getService().getUrl() + '?p=panel') + htmlReunionesInforme_(desde, f) + htmlIncumplimientos_(desde, f);
  var para = soloA || destinatarios_(tipo);
  if (!para.length) { Logger.log('Informe NO enviado: ningún directivo tiene correo real registrado.'); return { enviado: false, motivo: 'sin correos', html: cuerpo }; }
  para.forEach(function (c) {
    MailApp.sendEmail({ to: c, subject: 'ICET - Informe ' + nombre + ' (' + f + '): ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  });
  return { enviado: true, para: para, tipo: tipo };
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
  var sh = SpreadsheetApp.getActive().getSheetByName('Parametros');
  if (!sh) return defecto;
  var v = sh.getDataRange().getValues();
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
  var f = DriveApp.createFolder('ICET Soportes 2026 (privada)');
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
var COL_REUNIONES = ['id', 'fecha', 'tipo', 'nombre', 'inicio', 'fin', 'sin_estudiantes', 'convocados', 'creado_por', 'fecha_creacion'];
var COL_ASIST_REUNION = ['id_reunion', 'fecha', 'persona', 'estado', 'motivo', 'observacion', 'registrado_por', 'fecha_registro'];
var ESTADOS_REUNION = ['Asistió', 'No asistió', 'Llegada tarde', 'Salida temprana'];
var ESTADOS_REUNION_PRESENTE = ['Asistió', 'Llegada tarde', 'Salida temprana'];
/** tipo -> valores sugeridos (la pantalla los propone y el directivo los puede cambiar). sinEstudiantes: no hay clases en ese horario. */
var TIPOS_REUNION = [
  { tipo: 'Jornada pedagógica', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión de desarrollo institucional', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión de planeación', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Capacitación en el colegio', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión pedagógica', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Asamblea de docentes', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión extraordinaria del rector', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Reunión informativa o actividad institucional', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Consejo académico', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de convivencia', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Comité de calidad', sinEstudiantes: false, inicio: '08:00', fin: '10:00' },
  { tipo: 'Reunión PTAFI con la tutora', sinEstudiantes: false, inicio: '08:00', fin: '09:00' },
  { tipo: 'Entrega de boletines', sinEstudiantes: false, inicio: '07:00', fin: '13:30' },
  { tipo: 'Clausura', sinEstudiantes: true, inicio: '08:00', fin: '12:00' },
  { tipo: 'Actividad institucional general', sinEstudiantes: true, inicio: '07:00', fin: '13:30' },
  { tipo: 'Otra reunión', sinEstudiantes: false, inicio: '08:00', fin: '09:00' }
];

function limpiaTxt_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function txtForzado_(v) { return "'" + v; }

/** Personas que se pueden convocar: docentes con horario, orientadoras y directivos (sin repetir). */
function personasReunion_() {
  var out = [], vistos = {};
  function agrega(n, rol) { n = String(n || '').trim(); if (n && !vistos[n]) { vistos[n] = 1; out.push({ nombre: n, rol: rol }); } }
  datos_('Docentes').forEach(function (d) { if (String(d.tiene_horario) === 'SI') agrega(d.nombre_completo, /PTAFI/i.test(String(d.nivel)) ? 'Tutora PTAFI' : 'Docente'); });
  datos_('Directivos').forEach(function (d) { agrega(d.nombre, 'Directivo'); });
  return out;
}

function reunionDeFila_(r) {
  var conv = String(r.convocados || 'TODOS');
  return { id: r.id, fecha: fechaIso_(limpiaTxt_(r.fecha)), tipo: r.tipo, nombre: r.nombre, inicio: limpiaTxt_(r.inicio), fin: limpiaTxt_(r.fin),
           sinEstudiantes: String(r.sin_estudiantes) === 'SI', convocados: conv === 'TODOS' ? 'TODOS' : conv.split(';').map(function (x) { return x.trim(); }).filter(String),
           creadoPor: r.creado_por };
}
function reunionesDe_(fecha) {
  return datosOCrea_('Reuniones', COL_REUNIONES).map(reunionDeFila_).filter(function (r) { return r.fecha === fecha; });
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
  var rs = datosOCrea_('Reuniones', COL_REUNIONES).map(reunionDeFila_).filter(function (r) { return r.fecha >= desde && r.fecha <= hasta; });
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
  return { fecha: fecha, reuniones: reuniones, tipos: TIPOS_REUNION, personas: personasReunion_(), motivos: datos_('Motivos').map(function (m) { return m.motivo; }) };
}

function hora_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)) ? String(s) : ''; }
function nombreRegistrador_(p) {
  var quien = identidad_();
  if (quien.rol !== 'directivo') throw new Error('Solo un directivo puede registrar reuniones.');
  return quien.nombre || quien.email || String(p.directivo || '');
}

/** Crea una reunión. p = {fecha?, tipo, nombre?, inicio, fin, sinEstudiantes, convocados: 'TODOS' | [nombres]} */
function crearReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var def = TIPOS_REUNION.filter(function (t) { return t.tipo === p.tipo; })[0];
  if (!def) throw new Error('Elija el tipo de reunión.');
  var ini = hora_(p.inicio), fin = hora_(p.fin);
  if (!ini || !fin || fin <= ini) throw new Error('Revise la hora de inicio y de fin.');
  var fecha = p.fecha ? fechaIso_(p.fecha) : ymd_(new Date());
  var conv = 'TODOS';
  if (p.convocados !== 'TODOS') {
    var validos = personasReunion_().map(function (x) { return x.nombre; });
    var lista = (p.convocados || []).filter(function (n) { return validos.indexOf(n) >= 0; });
    if (!lista.length) throw new Error('Elija al menos una persona convocada.');
    conv = lista.join('; ');
  }
  var id = Utilities.getUuid();
  hojaOCrea_('Reuniones', COL_REUNIONES).appendRow([id, txtForzado_(fecha), def.tipo, String(p.nombre || '').slice(0, 120) || def.tipo, txtForzado_(ini), txtForzado_(fin),
    p.sinEstudiantes ? 'SI' : 'NO', conv, por, ahoraTxt_()]);
  return { id: id };
}

/** Datos para registrar la asistencia de una reunión: convocados y lo ya registrado. */
function cargarReunion(p) {
  exigirDirectivo_();
  var r = datosOCrea_('Reuniones', COL_REUNIONES).map(reunionDeFila_).filter(function (x) { return x.id === (p && p.id); })[0];
  if (!r) throw new Error('No se encontró la reunión.');
  var a = asistenciaDe_(r.id), roles = {};
  personasReunion_().forEach(function (x) { roles[x.nombre] = x.rol; });
  return { reunion: r, motivos: datos_('Motivos').map(function (m) { return m.motivo; }),
           personas: convocadosDe_(r).map(function (n) { return { nombre: n, rol: roles[n] || 'Docente', registro: a[n] || null }; }) };
}

/** Guarda la asistencia (reemplaza lo anterior de cada persona). p = {id, registros:[{persona, estado, motivo?, observacion?}]} */
function guardarAsistenciaReunion(p) {
  p = p || {};
  var por = nombreRegistrador_(p);
  var r = datosOCrea_('Reuniones', COL_REUNIONES).map(reunionDeFila_).filter(function (x) { return x.id === p.id; })[0];
  if (!r) throw new Error('No se encontró la reunión.');
  var motivos = datos_('Motivos').map(function (m) { return m.motivo; }), convocados = convocadosDe_(r);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Asistencia_Reunion', COL_ASIST_REUNION), v = sh.getDataRange().getValues(), cuenta = { guardados: 0 };
    (p.registros || []).forEach(function (x) {
      if (ESTADOS_REUNION.indexOf(x.estado) < 0 || convocados.indexOf(x.persona) < 0) return;
      var motivo = x.estado === 'No asistió' ? (motivos.indexOf(x.motivo) >= 0 ? x.motivo : 'Sin justificación') : '';
      var fila = [r.id, txtForzado_(r.fecha), x.persona, x.estado, motivo, String(x.observacion || '').slice(0, 200), por, ahoraTxt_()], idx = -1;
      for (var i = 1; i < v.length; i++) if (v[i][0] === r.id && v[i][2] === x.persona) { idx = i; break; }
      if (idx > 0) { sh.getRange(idx + 1, 1, 1, fila.length).setValues([fila]); v[idx] = fila; } else { sh.appendRow(fila); v.push(fila); }
      cuenta.guardados++;
    });
    return cuenta;
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
  return reunionesDe_(fecha).filter(function (r) { return r.inicio < fin && r.fin > ini; }).map(function (r) {
    var a = asistenciaDe_(r.id), est = {}; Object.keys(a).forEach(function (n) { est[n] = a[n].estado; });
    return { id: r.id, nombre: r.nombre, tipo: r.tipo, inicio: r.inicio, fin: r.fin, sinEstudiantes: r.sinEstudiantes, convocados: r.convocados, asistencia: est };
  });
}
/** ¿Esa persona está convocada a la reunión? */
function convocadoA_(reunion, nombre) { return reunion.convocados === 'TODOS' || reunion.convocados.indexOf(nombre) >= 0; }

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
var MOTIVOS_EXTERNA = ['Salida pedagógica o recorrido con estudiantes', 'Paseo o salida recreativa con estudiantes', 'Intercolegiados o evento deportivo con estudiantes',
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
  asegurarMotivos_();
  var hoy = ymd_(new Date());
  var motivos = datos_('Motivos').map(function (m) { return { motivo: m.motivo, categoria: m.categoria, justificada: m.justificada }; });
  var l = function (n) { return datos_('Listas').filter(function (x) { return x.lista === n; }).map(function (x) { return x.valor; }); };
  return {
    hoy: hoy,
    docentes: datos_('Docentes').filter(function (d) { return String(d.tiene_horario) === 'SI'; }).map(function (d) { return { nombre: d.nombre_completo, nivel: d.nivel }; })
      .sort(function (a, b) { return a.nombre < b.nombre ? -1 : 1; }),
    tipos: TIPOS_NOVEDAD.map(function (t) { return { id: t.id, texto: t.texto, pide: t.pide }; }),
    motivos: motivos, motivosExterna: MOTIVOS_EXTERNA,
    medios: l('medio'), fuentes: l('fuente'),
    registros: registrosRecientes_(hoy)
  };
}

/** Registros hechos desde esta pantalla, de los últimos 7 días y los futuros (agrupados por ID). */
function registrosRecientes_(hoy) {
  var v = hoja_('Novedades').getDataRange().getValues(), cab = v[0], c = {}, desde = resSumaDias_(hoy, -7), por = {}, orden = [];
  cab.forEach(function (k, i) { c[k] = i; });
  if (c['ID registro'] == null) return [];
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][c['ID registro']] || ''); if (!id) continue;
    var f = fechaIso_(v[i][c['Fecha Novedad']]); if (f < desde) continue;
    var k = id + '|' + v[i][c['Docente']];
    if (!por[k]) { por[k] = { id: id, docente: v[i][c['Docente']], tipo: v[i][c['Tipo Novedad']], motivo: v[i][c['Motivo Ausencia']], fechas: {}, descripcion: String(v[i][c['Descripción']] || ''), por: v[i][c['Directivo Docente']] }; orden.push(k); }
    por[k].fechas[f] = 1;
  }
  return orden.map(function (k) {
    var r = por[k], fs = Object.keys(r.fechas).sort();
    return { id: r.id, docente: r.docente, tipo: r.tipo, motivo: r.motivo, desde: fs[0], hasta: fs[fs.length - 1], dias: fs.length, descripcion: r.descripcion.slice(0, 120), por: r.por };
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
  asegurarMotivos_();
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
        var base = { 'Marca temporal': ahora, 'Fecha Novedad': fecha, 'Docente': doc, 'Tipo Novedad': def.tipo, 'Actividad de Aprendizaje': p.actividad || 'N/A', 'Motivo Ausencia': motivo,
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

// ===================== Estudiantes.gs =====================
/**
 * Estudiantes por grupo (hoja «Estudiantes», importada del listado RCEE: solo grupo, curso, n.º de lista, apellidos y nombres) y marcas de
 * seguimiento que el directivo puede poner: no asiste (posible deserción), se ausenta o se fuga con frecuencia, remitido a orientación escolar,
 * retirado formalmente, matrícula cancelada, en proyecto o programa. Las marcas quedan en la hoja Marcas_Estudiantes (se levantan, no se borran:
 * queda quién y cuándo). Solo las ven los directivos con sesión; son datos de menores y de seguimiento: manéjelos con reserva.
 *
 * Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
 */
var COL_MARCAS_EST = ['id', 'clave', 'grupo', 'curso', 'apellidos', 'nombres', 'tipo', 'nota', 'registrado_por', 'fecha_registro', 'estado', 'levantada_por', 'fecha_levantada'];
var TIPOS_MARCA_EST = [   // cat: grupo en la pantalla; emo/color: distintivo visual
  { id: 'NO_ASISTE', texto: 'No asiste (posible deserción)', cat: 'Alertas y seguimiento', emo: '🚫', color: '#c62828' },
  { id: 'AUSENTE', texto: 'Se ausenta con frecuencia', cat: 'Alertas y seguimiento', emo: '📉', color: '#e65100' },
  { id: 'FUGA', texto: 'Se fuga con frecuencia (se evade de clase)', cat: 'Alertas y seguimiento', emo: '🏃', color: '#b8860b' },
  { id: 'CONVIVENCIA', texto: 'Dificultad de convivencia o conducta violenta', cat: 'Alertas y seguimiento', emo: '⚠️', color: '#ad1457' },
  { id: 'SPA', texto: 'Caso de consumo de SPA', cat: 'Alertas y seguimiento', emo: '🚭', color: '#6d4c41' },
  { id: 'ORIENTACION', texto: 'Remitido a orientación escolar', cat: 'Alertas y seguimiento', emo: '🧭', color: '#6a1b9a' },
  { id: 'MATRICULA_COND', texto: 'Matrícula condicional', cat: 'Alertas y seguimiento', emo: '📝', color: '#d84315' },
  { id: 'PROYECTO', texto: 'En proyecto o programa especial', cat: 'Alertas y seguimiento', emo: '📘', color: '#1565c0' },
  { id: 'NUEVO', texto: 'Estudiante nuevo (llegó en el año)', cat: 'Matrícula', emo: '🆕', color: '#2e7d32' },
  { id: 'PROMOVIDO', texto: 'Promovido al siguiente grado', cat: 'Matrícula', emo: '⬆️', color: '#00838f' },
  { id: 'RETIRADO', texto: 'Retirado formalmente', cat: 'Matrícula', emo: '📤', color: '#546e7a' },
  { id: 'CANCELADA', texto: 'Matrícula cancelada', cat: 'Matrícula', emo: '⛔', color: '#37474f' },
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
    if (!grupos[e.g]) { grupos[e.g] = { codigo: e.g, curso: e.curso, total: 0 }; orden.push(e.g); }
    grupos[e.g].total++;
    var m = vig[claveEst_(e.g, e.a, e.n)];
    return m ? { g: e.g, no: e.no, a: e.a, n: e.n, m: m } : { g: e.g, no: e.no, a: e.a, n: e.n };
  });
  orden.sort(function (x, y) { return claveGrupo_(x) - claveGrupo_(y); });
  return { grupos: orden.map(function (c) { return grupos[c]; }), estudiantes: est, tipos: TIPOS_MARCA_EST };
}

/** Pone una marca a uno o varios estudiantes. p = {items:[{g, a, n}], tipo, nota?} */
function marcarEstudiantes(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
  p = p || {};
  var tipo = TIPOS_MARCA_EST.filter(function (t) { return t.id === p.tipo; })[0];
  if (!tipo) throw new Error('Elija el tipo de marca.');
  var items = p.items || [];
  if (!items.length) throw new Error('Elija al menos un estudiante.');
  if (items.length > 200) throw new Error('Máximo 200 estudiantes a la vez.');
  var lista = listadoEstudiantes_() || [], existe = {};
  lista.forEach(function (e) { existe[claveEst_(e.g, e.a, e.n)] = e; });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), v = sh.getDataRange().getValues(), c = {}, ya = {};
    v[0].forEach(function (k, i) { c[k] = i; });
    for (var i = 1; i < v.length; i++) if (v[i][c.estado] === 'Vigente') ya[v[i][c.clave] + '|' + v[i][c.tipo]] = 1;
    var res = { marcados: 0, yaTenian: 0 }, nota = String(p.nota || '').trim().slice(0, 300);
    items.forEach(function (it) {
      var k = claveEst_(it.g, it.a, it.n), e = existe[k];
      if (!e) return;
      if (ya[k + '|' + tipo.texto]) { res.yaTenian++; return; }
      sh.appendRow([Utilities.getUuid(), k, e.g, e.curso, e.a, e.n, tipo.texto, nota, por, ahoraTxt_(), 'Vigente', '', '']);
      ya[k + '|' + tipo.texto] = 1; res.marcados++;
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

/** Estudiante que llega nuevo durante el año: se agrega a la lista del grupo (al final) con la marca «nuevo». p = {g, a, n, nota?} */
function agregarEstudiante(p) {
  var quien = exigirDirectivo_(), por = quien.nombre || quien.email;
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
    ponMarcaEst_(hojaOCrea_('Marcas_Estudiantes', COL_MARCAS_EST), { g: g, curso: curso, a: a, n: n }, 'NUEVO', (p.nota ? p.nota + ' · ' : '') + 'Ingresó el ' + ymd_(new Date()), por);
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
var COL_CLAVE = ['pin_hash', 'pin_sal', 'intentos', 'bloqueado_hasta', 'correo', 'informe_dia', 'informe_semana', 'informe_mes', 'clave_temporal'];
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
  return datos_('Directivos').map(function (d) { return { nombre: d.nombre, rol: d.rol, tieneClave: !!String(d.pin_hash || '').trim() }; });
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
  for (var i = 1; i < v.length; i++) if (igualConstante_(v[i][0], h)) return Number(v[i][4]) > ahora ? { nombre: v[i][1], correo: String(v[i][2]).toLowerCase() } : null;
  return null;
}

/** ÚNICA puerta de entrada de las pantallas: valida el token y ejecuta la función permitida con la identidad del directivo. */
function llamarSeguro(token, fn, args) {
  var ses = validarToken_(token);
  if (!ses) throw new Error('SESION_VENCIDA');
  var out = apiDespachar_(ses.correo, fn, args);
  if (!out.ok) throw new Error(out.error);
  return out.data;
}

/** El directivo cambia su propia clave. p = {actual, nueva} (se ejecuta con su sesión). */
function cambiarClave(p) {
  p = p || {};
  var id = exigirDirectivo_();
  if (!pinValido_(p.nueva)) throw new Error('La clave nueva debe tener 6 números.');
  if (String(p.nueva) === String(p.actual)) throw new Error('La clave nueva debe ser distinta.');
  var d = verificarClave_(id.nombre, p.actual);
  guardarClave_(d, p.nueva);
  return { ok: true };
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

/** El directivo registra su correo (la primera vez que ingresa) y elige qué informes quiere recibir. p = {correo, dia, semana, mes} */
function guardarCorreo(p) {
  p = p || {};
  var id = exigirDirectivo_(), correo = String(p.correo || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || /@example\.com$/.test(correo)) throw new Error('Escriba un correo válido.');
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
  cambiarClave: ['directivo'],
  listarIncumplimientos: ['directivo'],
  actualizarSeguimiento: ['directivo'],
  consultaHorarios: ['directivo'],
  guardarCorreo: ['directivo'],
  datosNovedades: ['directivo'],
  registrarNovedad: ['directivo'],
  quitarNovedad: ['directivo'],
  datosEstudiantes: ['directivo'],
  marcarEstudiantes: ['directivo'],
  levantarMarcaEstudiante: ['directivo'],
  agregarEstudiante: ['directivo'],
  moverEstudiante: ['directivo']
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
    listarIncumplimientos: listarIncumplimientos, actualizarSeguimiento: actualizarSeguimiento,
    consultaHorarios: consultaHorarios,
    guardarCorreo: guardarCorreo,
    datosNovedades: datosNovedades, registrarNovedad: registrarNovedad, quitarNovedad: quitarNovedad,
    datosEstudiantes: datosEstudiantes, marcarEstudiantes: marcarEstudiantes, levantarMarcaEstudiante: levantarMarcaEstudiante,
    agregarEstudiante: agregarEstudiante, moverEstudiante: moverEstudiante
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

