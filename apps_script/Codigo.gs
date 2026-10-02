/**
 * ICET 2026 - Control de asistencia docente
 * Se pega en: Extensiones > Apps Script, dentro del Google Sheets importado
 * desde ICET_Control_Asistencia_Docente_2026.xlsx.
 *
 * Menú "Asistencia ICET":
 *   1) Crear formulario de novedades (una sola vez)
 *   2) Publicar consulta (Implementar > Aplicación web)
 */
var TZ = 'America/Bogota';
var DIAS = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
var SESIONES = [
  '1H 06:30-07:15', '2H 07:15-08:00', '3H 08:20-09:05', '4H 09:05-09:50',
  '5H 10:10-10:55', '6H 10:55-11:40', '7H 12:00-12:45', '8H 12:45-13:30'];
function directivos_() { return datos_('Directivos').map(function (d) { return d.nombre; }); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Asistencia ICET')
    .addItem('1. Crear formulario de novedades', 'crearFormulario')
    .addItem('2. Compartir con directivos (correos reales)', 'compartirConDirectivos')
    .addItem('3. Ver URL de la consulta', 'mostrarUrlConsulta')
    .addToUi();
}

/* ---------- utilidades ---------- */
function hoja_(n) { return SpreadsheetApp.getActive().getSheetByName(n); }

function datos_(n) {
  var v = hoja_(n).getDataRange().getValues(), h = v.shift();
  return v.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o;
  });
}

function hhmm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  return String(v).trim();
}

/* ---------- formulario ---------- */
function crearFormulario() {
  var docentes = datos_('Docentes').map(function (d) { return d.nombre_completo; });
  var tipos = datos_('Config').map(function (c) { return c.tipo_novedad; }).filter(String);
  var f = FormApp.create('ICET 2026 - Registro de novedades docentes');
  f.setDescription('Uso exclusivo de directivos. Registra presencia o novedad de un docente en una o varias sesiones.');
  f.addDateItem().setTitle('Fecha').setRequired(true);
  f.addListItem().setTitle('Registrado por').setChoiceValues(directivos_()).setRequired(true);
  f.addListItem().setTitle('Docente').setChoiceValues(docentes).setRequired(true);
  f.addListItem().setTitle('Tipo de novedad').setChoiceValues(tipos).setRequired(true);
  f.addCheckboxItem().setTitle('Sesiones afectadas').setChoiceValues(SESIONES).setRequired(true);
  f.addParagraphTextItem().setTitle('Observaciones');
  f.addTextItem().setTitle('Enlace al soporte (opcional)');
  ScriptApp.newTrigger('alEnviar').forForm(f).onFormSubmit().create();
  PropertiesService.getScriptProperties().setProperty('FORM_ID', f.getId());
  SpreadsheetApp.getUi().alert('Formulario creado:\n' + f.getEditUrl() + '\n\nEnlace para responder:\n' + f.getPublishedUrl());
}

/** Cada respuesta se archiva en Novedades con el grupo/área que debía atender el docente. */
function alEnviar(e) {
  var r = e.response.getItemResponses(), g = {};
  r.forEach(function (i) { g[i.getItem().getTitle()] = i.getResponse(); });
  var fecha = g['Fecha'] ? new Date(g['Fecha'] + 'T12:00:00') : new Date();
  var dia = DIAS[Number(Utilities.formatDate(fecha, TZ, 'u'))];
  var sesiones = [].concat(g['Sesiones afectadas'] || []);
  var horario = datos_('Horario');
  var filas = sesiones.map(function (s) {
    var hora = Number(s.charAt(0));
    var m = horario.filter(function (h) {
      return h.docente === limpiar_(g['Docente']) && h.dia === dia && Number(h.hora) === hora;
    })[0];
    return [e.response.getTimestamp(), Utilities.formatDate(fecha, TZ, 'yyyy-MM-dd'), g['Registrado por'],
      g['Docente'], g['Tipo de novedad'], 'B' + Math.ceil(hora / 2), s,
      m ? (m.grupo || ('Énfasis ' + m.grupos_enfasis)) : 'SIN CLASE EN HORARIO',
      m ? m.area : '', m ? m.tipo : '', g['Observaciones'] || '', g['Enlace al soporte (opcional)'] || '', dia];
  });
  var sh = hoja_('Novedades');
  filas.forEach(function (f) { sh.appendRow(f); });
}

function limpiar_(n) { return String(n).replace(/\s+/g, ' ').trim(); }

/* ---------- consulta ---------- */
/** Devuelve quién debe estar en clase ahora (o en la fecha/hora dadas). */
function consultarAhora(fechaHora) {
  var d = fechaHora ? new Date(fechaHora) : new Date();
  var dia = DIAS[Number(Utilities.formatDate(d, TZ, 'u'))];
  var hm = Utilities.formatDate(d, TZ, 'HH:mm');
  var tramos = datos_('Franjas');
  var tramo = tramos.filter(function (t) { return hhmm_(t.inicio) <= hm && hm < hhmm_(t.fin); })[0];
  var res = { dia: dia, hora: hm, sesion: tramo ? (tramo.hora + 'H ' + hhmm_(tramo.inicio) + '-' + hhmm_(tramo.fin)) : null, filas: [] };
  if (!tramo) { res.nota = 'Descanso o fuera de jornada'; return res; }
  var hoy = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  var nov = datos_('Novedades').filter(function (n) {
    return (n.fecha instanceof Date ? Utilities.formatDate(n.fecha, TZ, 'yyyy-MM-dd') : String(n.fecha)) === hoy
      && String(n.hora_inicio).charAt(0) === String(tramo.hora);
  });
  res.filas = datos_('Horario').filter(function (h) {
    return h.dia === dia && Number(h.hora) === Number(tramo.hora);
  }).map(function (h) {
    var n = nov.filter(function (x) { return x.docente === h.docente; })[0];
    var nota = [h.alternancia, h.equipo_enfasis ? 'Con: ' + h.equipo_enfasis : ''].filter(String).join(' · ');
    return { docente: h.docente, grupo: h.grupo || ('ÉNFASIS ' + h.grupos_enfasis), area: h.area, tipo: h.tipo,
             nota: nota, novedad: n ? n.tipo_novedad : '' };
  }).sort(function (a, b) { return a.grupo < b.grupo ? -1 : 1; });
  return res;
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Consulta').setTitle('ICET - ¿Quién debe estar dónde?')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Comparte el libro con los directivos; omite los correos temporales (@example.com). */
function compartirConDirectivos() {
  var ok = [], omitidos = [];
  datos_('Directivos').forEach(function (d) {
    var c = String(d.correo_temporal).trim();
    if (!c || /@example\.com$/i.test(c)) { omitidos.push(d.nombre); return; }
    SpreadsheetApp.getActive().addEditor(c); ok.push(d.nombre);
  });
  SpreadsheetApp.getUi().alert('Compartido con: ' + (ok.join(', ') || 'nadie') + '\nPendientes (correo temporal): ' + (omitidos.join(', ') || 'ninguno'));
}

function mostrarUrlConsulta() {
  SpreadsheetApp.getUi().alert('Implementar > Nueva implementación > Aplicación web.\n' +
    'Ejecutar como: yo. Acceso: solo personas de su organización o lista de directivos.');
}
