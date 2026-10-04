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
