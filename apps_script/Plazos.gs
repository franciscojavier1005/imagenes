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
