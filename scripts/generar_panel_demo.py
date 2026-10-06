#!/usr/bin/env python3
"""Genera ICET_Panel_Vista_Previa.html: el panel (apps_script/Dashboard.html) con DATOS DE EJEMPLO (docentes ficticios).

Archivo único, sin Google ni servidor. Usa el mismo cálculo (Resumen.gs y Plazos.gs) que el panel real. Los flujos de registro, carga de
soportes y revisión funcionan en memoria (se pierden al recargar). Se cambia de rol con #rol=... (hay enlaces en el aviso superior).
"""
import os

RAIZ = os.path.join(os.path.dirname(__file__), "..")
rd = lambda *p: open(os.path.join(RAIZ, *p), encoding="utf-8").read()
ctx, calc, plz, html = rd("ejemplos", "demo_ctx.json"), rd("apps_script", "Resumen.gs"), rd("apps_script", "Plazos.gs"), rd("apps_script", "Dashboard.html")

mock = """<script>
/* ---- Vista previa: cálculo real (Resumen.gs y Plazos.gs) sobre DATOS DE EJEMPLO; flujos en memoria ---- */
window.__HOY='2026-10-02';
%s
%s
var DEMO=%s;
(function(){
  var ROL=(location.hash.match(/rol=(\\w+)/)||[])[1]||'directivo';
  window.addEventListener('hashchange',function(){location.reload();});
  var cuenta={}; DEMO.novedades.forEach(function(n){cuenta[n.docente]=(cuenta[n.docente]||0)+1;});
  var DOC=Object.keys(cuenta).sort(function(a,b){return cuenta[b]-cuenta[a]||(a<b?-1:1);})[0];
  var AUT=ROL!=='docente_sin_aut', SOP=[], REV=[], PEND=[{email:'docente.nuevo@correo.com',docente:'%s',fecha:'2026-10-02 07:40'},{email:'otra.cuenta@gmail.com',docente:'%s',fecha:'2026-10-01 18:12'}];
  var TEXTO='BORRADOR para revisión de la institución (no es asesoría jurídica). Autorizo a la Institución Educativa [NOMBRE DE LA INSTITUCIÓN], como responsable del tratamiento, a recolectar, almacenar y usar mis datos personales y los soportes que yo cargue, que pueden incluir datos sensibles de salud, con la finalidad exclusiva de controlar la asistencia y justificar mis ausencias. Los datos sensibles son facultativos. Solo los verán los directivos docentes. Conozco mis derechos (Ley 1581 de 2012) y puedo revocar esta autorización.';
  var TIPOS=['Incapacidad médica','Constancia o cita médica','Epicrisis','Acta de defunción','Citación o invitación','Constancia de estudio','Remisión o pasajes','Otro soporte'];
  var MOT=DEMO.motivos.map(function(m){return {motivo:m.motivo,requiere_soporte:m.motivo==='Permiso del rector'?'NO':'SI',plazo_dias:m.motivo==='Sin justificación'?3:5};});
  function obl(doc){return calcularObligaciones_({hoy:'2026-10-02',desde:'2026-09-21',docente:doc||'',novedades:DEMO.novedades,soportes:SOP,motivos:MOT});}
  // dos soportes ya entregados por otros docentes ficticios, para mostrar la cola de revisión
  obl('').filter(function(o){return o.estado==='Vencido'&&o.docente!==DOC;}).slice(0,2).forEach(function(o,i){
    SOP.push({clave:o.clave,id:'d'+i,estado:'Entregado',fecha_carga:'2026-10-02T0'+(7+i)+':30',docente:o.docente,tipo_documento:TIPOS[i]});
    REV.push({id:'d'+i,docente:o.docente,inicio:o.inicio,fin:o.fin,motivoDeclarado:o.motivos[0],tipo:TIPOS[i],fecha:'2026-10-02 0'+(7+i)+':30',extemporaneo:i?'SI':'NO',comentario:i?'Estuve de viaje':'',url:'#'});});
  var self_;
  var rolCtx=function(){
    var niv={};DEMO.docentes.forEach(function(d){niv[d.nivel]=1;});
    if(ROL==='sin_registro') return {rol:'sin_registro',email:'nuevo.docente@gmail.com',docentes:DEMO.docentes.map(function(d){return d.nombre_completo;}).sort(),textoAutorizacion:TEXTO};
    if(ROL==='pendiente') return {rol:'pendiente',email:'docente.nuevo@correo.com'};
    if(ROL==='bloqueado') return {rol:'bloqueado'};
    if(ROL==='docente'||ROL==='docente_sin_aut') return {rol:'docente',vistaInicial:'docente',docente:DOC,autorizado:AUT,textoAutorizacion:TEXTO};
    return {rol:'directivo',vistaInicial:'coordinacion',niveles:Object.keys(niv).sort(),docentes:DEMO.docentes.map(function(d){return {nombre:d.nombre_completo,nivel:d.nivel};})};
  };
  var api={
    urlBase:function(){return '';},
    contextoPanel:function(){return rolCtx();},
    datosDashboard:function(d,h,f){return calcularResumen_({desde:d,hasta:h,filtros:f||{},novedades:DEMO.novedades,registro:DEMO.registro,horario:DEMO.horario,docentes:DEMO.docentes,motivos:DEMO.motivos});},
    solicitarAcceso:function(p){ROL='pendiente';return {estado:'PENDIENTE'};},
    aceptarAutorizacion:function(){AUT=true;return {autorizado:true};},
    misSoportes:function(){return {docente:DOC,autorizado:AUT,obligaciones:obl(DOC),maxMB:8,tiposDocumento:TIPOS,motivos:MOT.map(function(m){return m.motivo;}),
      cargados:SOP.filter(function(s){return s.docente===DOC;}).map(function(s){return {id:s.id,clave:s.clave,estado:s.estado,tipo:s.tipo_documento,observacion:s.observacion||''};})};},
    subirSoporte:function(p){var o=obl(DOC).filter(function(x){return x.clave===p.clave;})[0];
      SOP.push({clave:p.clave,id:'u'+SOP.length,estado:'Entregado',fecha_carga:'2026-10-02T10:00',docente:DOC,tipo_documento:p.tipoDocumento});
      REV.push({id:'u'+(SOP.length-1),docente:DOC,inicio:o.inicio,fin:o.fin,motivoDeclarado:p.motivoDeclarado,tipo:p.tipoDocumento,fecha:'2026-10-02 10:00',extemporaneo:o.estado==='Vencido'?'SI':'NO',comentario:p.comentario||'',url:'#'});
      return {id:'u',estado:'Entregado',extemporaneo:o.estado==='Vencido'?'SI':'NO'};},
    listarSolicitudes:function(){return {pendientes:PEND.slice(),activos:[{email:'a@x.com',docente:DOC}]};},
    resolverSolicitud:function(p){PEND=PEND.filter(function(x){return x.email!==p.email;});return {estado:p.accion};},
    listarIncumplimientos:function(p){return {estados:['Reportado','En seguimiento','Citado a descargos','Con llamado de atención','Cerrado'],totalPorDocente:{'Docente demo SEC 03':2},
      lista:[{id:'i1',fecha:'2026-10-02',docente:'Docente demo SEC 03',tipo:'Incumplimiento: no atiende al grupo',sesiones:'S3',grupo:'0801',minutos:45,donde:'En la sala de profesores',descripcion:'Ejemplo ficticio: a las 9:10 estaba en la sala de profesores y el grupo sin clase.',explicacion:'Dijo que esperaba al coordinador.',registradoPor:'Francisco Cortés',estado:'En seguimiento',seguimiento:'2026-10-02 10:00 · Francisco Cortés · En seguimiento: se habló con el docente',reincidencia:2}]};},
    actualizarSeguimiento:function(p){return {ok:true};},
    soportesPorRevisar:function(){var o=obl('');return {porRevisar:REV.slice(),vencidos:o.filter(function(x){return x.estado==='Vencido';}).slice(0,8),pendientes:o.filter(function(x){return x.estado==='Pendiente';}),resumen:resumenObligaciones_(o)};},
    revisarSoporte:function(p){REV=REV.filter(function(x){return x.id!==p.id;});SOP.forEach(function(s){if(s.id===p.id){s.estado={ACEPTAR:'Aceptado',RECHAZAR:'Rechazado',NO_APLICA:'No aplica'}[p.accion];s.observacion=p.observacion;}});return {estado:p.accion};}
  };
  window.PREVIEW=true;
  window.google={script:{run:new Proxy({},{get:function(_,k){
    var ok=null,fail=null,self={withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;}};
    Object.keys(api).forEach(function(n){self[n]=function(){var a=arguments;setTimeout(function(){try{var r=api[n].apply(null,a);if(ok)ok(r);}catch(e){if(fail)fail(e);}},60);};});
    return k in self?self[k]:self;}})}};
})();
</script>
""" % (calc, plz, ctx, "%NOMBRE1%", "%NOMBRE2%")

import json
demo = json.loads(ctx)
nombres = [d["nombre_completo"] for d in demo["docentes"] if d["nivel"] == "PRIMARIA"][:2]
mock = mock.replace("%NOMBRE1%", nombres[0]).replace("%NOMBRE2%", nombres[1])

html = html.replace("<script>\nvar R=null", mock + "<script>\nvar R=null", 1)
aviso = ('<div style="background:#fff3cd;color:#664d03;padding:8px 12px;font-size:13px;border-radius:8px;margin-bottom:12px">'
         "<b>VISTA PREVIA CON DATOS DE EJEMPLO:</b> docentes y novedades ficticios; nada se guarda. Ver como: "
         '<a href="#rol=directivo">directivo</a> · <a href="#rol=docente">docente</a> · <a href="#rol=docente_sin_aut">docente sin autorización</a> · '
         '<a href="#rol=sin_registro">sin registro</a> · <a href="#rol=pendiente">pendiente</a> · <a href="#rol=bloqueado">bloqueado</a>. '
         "En el rol directivo cambie entre Rectoría, Coordinación e Informe del docente.</div>")
html = html.replace('<div class="wrap">', '<div class="wrap">\n  ' + aviso, 1)
html = html.replace("<title>ICET - Panel de asistencia docente</title>", "<title>ICET - Vista previa del panel (datos de ejemplo)</title>")
open(os.path.join(RAIZ, "ICET_Panel_Vista_Previa.html"), "w", encoding="utf-8").write(html)
print("OK", round(len(html) / 1024), "KB")
