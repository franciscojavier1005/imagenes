// ===================== Codigo.gs =====================
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
  var panel = e && e.parameter && e.parameter.p === 'panel';
  return HtmlService.createHtmlOutputFromFile(panel ? 'Dashboard' : 'Consulta')
    .setTitle(panel ? 'ICET - Panel de asistencia docente' : 'ICET - Ronda de asistencia docente')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Docentes que deben estar en la sesión indicada. Sin argumentos usa el día y la hora actuales.
 * También devuelve las listas para los radios (motivos, medios, fuentes).
 */
function consultarSesion(dia, sesion) {
  var ahora = new Date();
  var auto = !dia && !sesion;
  dia = dia || DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))];
  var s = sesion ? Number(sesion) : sesionAhora_(ahora);
  var fr = datos_('Franjas').filter(function (f) { return Number(f.hora) === s; })[0];
  var out = {
    dia: dia, diaHoy: DIAS[Number(Utilities.formatDate(ahora, TZ, 'u'))], sesion: s, auto: auto, hora: Utilities.formatDate(ahora, TZ, 'HH:mm'), fecha: ymd_(ahora),
    franja: fr ? hhmm_(fr.inicio) + ' - ' + hhmm_(fr.fin) : '', bloque: fr ? Number(fr.bloque) : null,
    filas: [], motivos: datos_('Motivos'), listas: datos_('Listas'),
    directivos: datos_('Directivos').map(function (d) { return d.nombre; }),
    nota: s ? '' : (auto ? 'Descanso o fuera de jornada' : 'Sesión no válida')
  };
  if (!s) return out;
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
    if (f === out.fecha && Number(r.sesion) === s) yaMarcados[r.docente] = r;
  });
  out.filas = datos_('Horario').filter(function (h) {
    return h.dia === dia && Number(h.hora) === s;
  }).map(function (h) {
    var enf = h.tipo === 'ENFASIS';
    var nota = [h.alternancia, h.equipo_enfasis ? 'Con: ' + h.equipo_enfasis : ''].filter(String).join(' · ');
    var ya = yaMarcados[h.docente];
    return {
      docente: h.docente, grupoCodigo: enf ? h.grupos_enfasis : h.grupo,
      grupo: enf ? 'ÉNFASIS ' + String(h.grupos_enfasis).split('+').map(function (g) { return nombres[g] || g; }).join(' + ')
                 : (nombres[h.grupo] || h.grupo),
      area: h.area || '(énfasis)', tipo: h.tipo, nota: nota,
      dir: h.tipo === 'AREAS_MULTIPLES' ? '' : ((direccion[String(enf ? h.grupos_enfasis : h.grupo).split('+')[0]] || {}).dir || ''),
      modalidad: (direccion[String(enf ? h.grupos_enfasis : h.grupo).split('+')[0]] || {}).modalidad || '',
      reporte: reportes[h.docente] || null,
      previo: ya ? { estado: ya.estado, motivo: ya.motivo, minutos: ya.minutos, observaciones: ya.observaciones, atendidoPor: ya.atendido_por || '' } : null
    };
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
var ATIENDE_GRUPO = ['Nadie (grupo solo)', 'Reemplazo (docente)', 'Practicante', 'Otro docente o directivo'];

function guardarRonda(p) {
  if (REQ_EMAIL !== null) {               // llamada desde el front: el directivo es quien Google identificó, no lo que diga la pantalla
    var quien = identidad_();
    if (quien.rol === 'directivo') p.directivo = quien.nombre || quien.email;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ahora = new Date(), fecha = p.fecha || ymd_(ahora), sesion = Number(p.sesion);
    var fr = datos_('Franjas').filter(function (f) { return Number(f.hora) === sesion; })[0];
    var franja = hhmm_(fr.inicio) + ' - ' + hhmm_(fr.fin);
    var motivos = {};
    datos_('Motivos').forEach(function (m) { motivos[m.motivo] = m; });
    var reg = hoja_('Registro_Ronda'), nov = hoja_('Novedades');
    var regVals = reg.getDataRange().getValues();   // para reemplazar marcas repetidas
    var novVals = nov.getDataRange().getValues();
    var novCol = novVals[0].indexOf('Sesiones');
    var guardados = 0;
    (p.registros || []).forEach(function (r) {
      var m = motivos[r.motivo] || {};
      var just = r.estado === 'Presente' ? '' : (m.justificada === 'SI' ? 'Sí' : 'No');
      var atiende = r.estado === 'Presente' ? '' : (ATIENDE_GRUPO.indexOf(r.atiende) >= 0 ? r.atiende : '');   // quién cubrió el grupo; NO cuenta como asistencia del docente
      var minutos = r.estado === 'No asistió' ? 45 : (Number(r.minutos) || '');
      // 1) Registro_Ronda: una fila por docente-fecha-sesión (se reemplaza si ya existía)
      var fila = [ahora, fecha, p.dia, sesion, franja, r.docente, r.grupoCodigo, r.area, r.estado,
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
      var jornada = r.estado === 'No asistió' && novVals.slice(1).some(function (x) {
        return fechaIso_(x[1]) === fecha && x[2] === r.docente && String(x[novCol]) === 'JC' && /no asisti/i.test(String(x[3]));
      });  // ya reportado como ausencia de jornada completa: se verifica en Registro_Ronda sin duplicar minutos en Novedades
      if (r.estado !== 'Presente' && !jornada) {
        var pg = partesGrupo_(String(r.grupoCodigo).split('+')[0]);
        var nf = [ahora, fecha, r.docente, r.estado, r.actividad || 'N/A', r.motivo || '', r.obs || '',
                  r.fuente || FUENTE_RONDA, r.medio || MEDIO_RONDA, pg.grado, pg.grupo, r.area,
                  'H' + sesion + ' ' + franja + ' Bloque ' + Math.ceil(sesion / 2), minutos, p.directivo || '',
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
  if (/^CS\d$/.test(grado) && /^\d$/.test(grupo)) return 'Caminar en Secundaria ' + grado.charAt(2) + '-' + grupo;
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
      nivel: nivel[n.docente] || 'SIN NIVEL', ausencia: /no asisti/i.test(tipo), tarde: /tarde/i.test(tipo), salida: /salida/i.test(tipo)
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
    [['Docentes con novedad', k.docentesConNovedad], ['Ausencias', k.ausencias], ['Llegadas tarde', k.llegadasTarde], ['Salidas tempranas', k.salidasTempranas],
     ['Justificadas', k.pctJustificadas == null ? '—' : k.pctJustificadas + '%']].map(function (t) {
      return '<td style="background:#f3f3f0;border-radius:8px;padding:8px 10px;width:20%"><div style="font-size:11.5px;color:#52514e">' + e(t[0]) + '</div><div style="font-size:20px;font-weight:600">' + e(t[1]) + '</div></td>';
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
       '<p style="font-size:11.5px;color:#74736d;border-top:1px solid #e6e5e0;padding-top:8px">Información confidencial de uso directivo (Ley 1581 de 2012).</p></div>';
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
    return { rol: 'directivo', nombre: id.nombre, vistaInicial: id.vistaInicial,
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

function correoRector_() {
  var r = datos_('Directivos').filter(function (d) { return /rector/i.test(String(d.rol)); })[0];
  var c = r ? String(r.correo_temporal).trim() : '';
  return c && !/@example\.com$/i.test(c) ? c : '';
}

/** Envía el informe del día al rector. Se ejecuta por disparador (lunes a viernes) o desde el menú. */
function enviarInformeDiario(soloProbar) {
  var hoy = new Date(), u = Number(Utilities.formatDate(hoy, TZ, 'u'));
  if (u > 5 && !soloProbar) return { enviado: false, motivo: 'fin de semana' };
  var f = ymd_(hoy), r = resumenInterno_(f, f, {});
  var fechaTexto = NOMBRE_DIA_[u] + ' ' + Utilities.formatDate(hoy, TZ, "d 'de' MMMM 'de' yyyy");
  var cuerpo = htmlInforme_(r, fechaTexto, ScriptApp.getService().getUrl() + '?p=panel');
  var para = correoRector_();
  if (!para) { Logger.log('Informe NO enviado: el correo del rector es temporal (hoja Directivos).'); return { enviado: false, motivo: 'correo temporal', html: cuerpo }; }
  MailApp.sendEmail({ to: para, subject: 'ICET - Asistencia docente ' + f + ': ' + r.kpis.horas + ' h sin atender', htmlBody: cuerpo, name: 'Control de asistencia ICET' });
  return { enviado: true, para: para };
}

function probarInformeDiario() {
  var r = enviarInformeDiario(true);
  SpreadsheetApp.getUi().alert(r.enviado ? 'Informe enviado a ' + r.para
    : 'No se envió: ' + r.motivo + '.\nCuando la hoja Directivos tenga el correo real del rector, vuelva a probar.');
}

/** Programa el envío diario a las 2:30 p. m. (después de la jornada). */
function programarInformeDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'enviarInformeDiario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('enviarInformeDiario').timeBased().everyDays(1).atHour(14).nearMinute(30).inTimezone(TZ).create();
  SpreadsheetApp.getUi().alert('Programado: el informe se enviará al rector de lunes a viernes, hacia las 2:30 p. m.');
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
   "Evento Secretaría de Educación",
   "EVENTO EXTERNO",
   "secretaria de educacion|\\bsed\\b|comision de servicio|mesa de trabajo|reunion en la secretaria"
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
                sesion: x.sesion || '', grupo: x.grupo || '' };
      cab.forEach(function (c) { fila.push(v[c] === undefined ? '' : v[c]); });
      sh.appendRow(fila); props.push(Object.assign({ id: pid }, v));
    });
  }
  hojaOCrea_('Notas_Ronda', COL_NOTAS).appendRow([nid, ahoraTxt_(), fecha, quien, p.sesion || '', texto, audioId, audioUrl, Number(p.duracion) || '', props.length]);
  return { id: nid, propuestas: props, audioGuardado: !!audioId };
}

/** Propuestas de notas de ronda pendientes (sin confirmar ni descartar). */
function listarPropuestas() {
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
function purgarAudios() { var n = purgarAudios_(); SpreadsheetApp.getUi().alert('Audios borrados por retención: ' + n); }

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
  resolverPropuesta: ['directivo']
};

function apiFunciones_() {
  return {
    contextoPanel: contextoPanel, solicitarAcceso: solicitarAcceso, aceptarAutorizacion: aceptarAutorizacion,
    listarSolicitudes: listarSolicitudes, resolverSolicitud: resolverSolicitud, consultarSesion: consultarSesion, guardarRonda: guardarRonda,
    datosDashboard: datosDashboard, misSoportes: misSoportes, subirSoporte: subirSoporte,
    soportesPorRevisar: soportesPorRevisar, revisarSoporte: revisarSoporte,
    guardarNotaRonda: guardarNotaRonda, listarPropuestas: listarPropuestas, resolverPropuesta: resolverPropuesta
  };
}

/** Comparación en tiempo constante para no revelar el secreto por diferencias de tiempo. */
function igualConstante_(a, b) {
  a = String(a || ''); b = String(b || '');
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/** Ejecuta una función de la API para un correo ya verificado. Separada de doPost para poder probarla. */
function apiEjecutar_(req, secretoEsperado) {
  if (!secretoEsperado || !igualConstante_(req && req.secret, secretoEsperado)) return { ok: false, error: 'No autorizado' };
  var fn = req.fn, permitidos = API_PERMISOS[fn], tabla = apiFunciones_();
  if (!permitidos || !tabla[fn]) return { ok: false, error: 'Función no permitida' };
  REQ_EMAIL = req.email || '';
  try {
    var rol = identidad_().rol;
    if (permitidos.indexOf('*') < 0 && permitidos.indexOf(rol) < 0) return { ok: false, error: 'Sin permiso para esta acción (' + rol + ').' };
    return { ok: true, data: tabla[fn].apply(null, req.args || []) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { REQ_EMAIL = null; }
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Petición inválida' })).setMimeType(ContentService.MimeType.JSON); }
  var out = apiEjecutar_(req, PropertiesService.getScriptProperties().getProperty('API_SECRET'));
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

