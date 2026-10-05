#!/usr/bin/env python3
"""Genera ICET_Vista_Previa_Ronda.html: la pantalla de la ronda (apps_script/Consulta.html) con los datos incluidos.

Es un archivo único que funciona sin Google ni servidor: sirve para ver cómo quedaría. Reemplaza google.script.run por
una versión local; los registros no se envían, se descargan como CSV.
"""
import csv, json, os

RAIZ = os.path.join(os.path.dirname(__file__), "..")
D = os.path.join(RAIZ, "data")
rd = lambda n: list(csv.DictReader(open(os.path.join(D, n), encoding="utf-8-sig")))

docentes = {d["nombre_completo"]: d for d in rd("docentes.csv")}


def corto(n):
    d = docentes[n]
    return f'{d["apellidos"].split()[0]} {d["nombres"].split()[0][0]}.'


datos = {
    "horario": [{k: r[k] for k in ("docente", "dia", "hora", "tipo", "grupo", "grupos_enfasis", "area", "alternancia", "equipo_enfasis")}
                for r in rd("horario_maestro.csv")],
    "grupos": {g["grupo"]: g["nombre"] for g in rd("grupos.csv")},
    "direccion": {r["grupo"]: {"dir": " / ".join(corto(x) for x in (r["docente_1"], r["docente_2"]) if x), "modalidad": r["modalidad"]}
                  for r in rd("direccion_grupo.csv")},
    "franjas": [{"hora": int(f["hora"]), "bloque": int(f["bloque"]), "inicio": f["inicio"], "fin": f["fin"]} for f in rd("franjas.csv")],
    "preesc": {r["dia"] + r["hora"]: r["inicio"] + " - " + r["fin"] for r in rd("horario_maestro.csv") if r["grupo"].startswith("00")},
    "motivos": rd("motivos.csv"),
    "listas": rd("listas.csv"),
    "directivos": [d["nombre"] for d in csv.DictReader(open(os.path.join(D, "directivos.csv"), encoding="utf-8-sig"))]
                  if os.path.exists(os.path.join(D, "directivos.csv")) else ["Francisco Javier Cortés", "Verónica Barreiro", "Harold Angulo", "Jorge Hernández"],
}

mock = """<script>
/* ---- Vista previa: simula el servidor de Apps Script con los datos incluidos ---- */
var DATOS = %s;
(function(){
  var DIAS={Mon:'LUNES',Tue:'MARTES',Wed:'MIERCOLES',Thu:'JUEVES',Fri:'VIERNES',Sat:'SABADO',Sun:'DOMINGO'};
  function bogota(){
    var p={}; new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false,
      year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
    var h=p.hour==='24'?'00':p.hour;
    return {dia:DIAS[p.weekday],hm:h+':'+p.minute,fecha:p.year+'-'+p.month+'-'+p.day};
  }
  function sesionAhora(hm){var s=null;DATOS.franjas.forEach(function(f){if(f.inicio<=hm&&hm<f.fin)s=f.hora;});return s;}
  function consultar(dia,sesion,modo){
    var b=bogota(), auto=!dia&&!sesion; dia=dia||b.dia; var s=sesion?Number(sesion):sesionAhora(b.hm);
    var fr=DATOS.franjas.filter(function(f){return f.hora===s;})[0];
    var out={dia:dia,diaHoy:dia,sesion:s,auto:auto,hora:b.hm,fecha:b.fecha,franja:fr?fr.inicio+' - '+fr.fin:'',bloque:fr?fr.bloque:null,modo:modo==='bloque'?'bloque':'sesion',
      filas:[],motivos:DATOS.motivos,listas:DATOS.listas,directivos:DATOS.directivos,nota:s?'':(auto?'Descanso o fuera de jornada':'Sesión no válida')};
    if(!s) return out;
    var hs=[s];
    if(out.modo==='bloque'&&fr){hs=DATOS.franjas.filter(function(f){return f.bloque===fr.bloque;}).map(function(f){return f.hora;});
      var fb=DATOS.franjas.filter(function(f){return f.bloque===fr.bloque;}); out.franja=fb[0].inicio+' - '+fb[fb.length-1].fin;}
    out.filas=DATOS.horario.filter(function(h){return h.dia===dia&&hs.indexOf(Number(h.hora))>=0;}).map(function(h){
      var enf=h.tipo==='ENFASIS', gc=enf?h.grupos_enfasis:h.grupo, d=DATOS.direccion[String(gc).split('+')[0]]||{};
      return {docente:h.docente,grupoCodigo:gc,
        grupo:enf?'ÉNFASIS '+String(gc).split('+').map(function(g){return DATOS.grupos[g]||g;}).join(' + '):(DATOS.grupos[gc]||gc),
        area:h.area||'(énfasis)',tipo:h.tipo,
        nota:[/^00/.test(h.grupo)?'Preescolar '+DATOS.preesc[h.dia+h.hora]:'',h.alternancia,h.equipo_enfasis?'Con: '+h.equipo_enfasis:''].filter(Boolean).join(' · '),
        dir:h.tipo==='AREAS_MULTIPLES'?'':(d.dir||''),modalidad:d.modalidad||'',previo:null,
        sesiones:[{sesion:Number(h.hora),grupoCodigo:gc,area:h.area||'(énfasis)',grupo:enf?'ÉNFASIS '+String(gc).split('+').map(function(g){return DATOS.grupos[g]||g;}).join(' + '):(DATOS.grupos[gc]||gc)}]};
    });
    if(out.modo==='bloque'){var por={},uni=[];out.filas.forEach(function(f){var k=por[f.docente];if(!k){por[f.docente]=f;uni.push(f);}else k.sesiones=k.sesiones.concat(f.sesiones);});
      uni.forEach(function(f){var gs=f.sesiones.map(function(x){return x.grupo;}).filter(function(g,i,a){return a.indexOf(g)===i;});
        if(gs.length>1)f.nota=[f.sesiones.map(function(x){return 'S'+x.sesion+': '+x.grupo;}).join(' · '),f.nota].filter(Boolean).join(' · ');
        else if(f.sesiones.length===1&&hs.length>1)f.nota=['Solo S'+f.sesiones[0].sesion,f.nota].filter(Boolean).join(' · ');});
      out.filas=uni;}
    function ck(c){var g=String(c).split('+')[0],m=g.match(/^CS([12])0?(\\d)$/);if(m)return(m[1]==='1'?6:9)*1000+500+Number(m[2]);m=g.match(/^(\\d\\d)(\\d\\d)$/);return m?Number(m[1])*1000+Number(m[2]):99000;}
    out.filas.sort(function(a,b){return ck(a.grupoCodigo)-ck(b.grupoCodigo);});
    return out;
  }
  function csv(p){
    var c=['fecha,dia,sesion,docente,grupo,area,estado,motivo,minutos,actividad,observaciones,directivo'];
    p.registros.forEach(function(r){c.push([p.fecha,p.dia,r.sesion||p.sesion,r.docente,r.grupoCodigo,r.area,r.estado,r.motivo,r.minutos,r.actividad,r.obs,p.directivo]
      .map(function(x){return '"'+String(x==null?'':x).replace(/"/g,'""')+'"';}).join(','));});
    return c.join('\\n');
  }
  var PROP=[], NOTAS_N=0;
  function mins(hm){var a=hm.split(':');return Number(a[0])*60+Number(a[1]);}
  function ctxNota(texto,fecha){
    var nombres={}; DATOS.horario.forEach(function(h){nombres[h.docente]=1;});
    return {texto:texto,fecha:fecha,docentes:Object.keys(nombres).map(function(n){return {nombre_completo:n,apellidos:n,nombres:''};}),
      grupos:Object.keys(DATOS.grupos).map(function(g){return {grupo:g};}),
      franjas:DATOS.franjas.map(function(f){return {hora:f.hora,inicio_min:mins(f.inicio),fin_min:mins(f.fin)};}),horario:DATOS.horario};
  }
  var api=function(){var ok=null,fail=null,self={
    withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('');},0);},
    consultarSesion:function(d,s,m){setTimeout(function(){ok(consultar(d,s,m));},20);},
    guardarNotaRonda:function(p){setTimeout(function(){
      if(!String(p.texto||'').trim()){ok({id:'n',propuestas:[],audioGuardado:false});return;}
      var a=analizarNota_(ctxNota(p.texto,p.fecha||bogota().fecha)), nuevas=a.propuestas.map(function(x,i){
        return {id:'p'+(++NOTAS_N),fecha:p.fecha||bogota().fecha,docente:x.docente,tipo_novedad:x.tipo_novedad,motivo:x.motivo,categoria:x.categoria,confianza:x.confianza,mensaje:x.mensaje,sesion:x.sesion||p.sesion||'',grupo:x.grupo||''};});
      PROP=PROP.concat(nuevas); ok({id:'n',propuestas:nuevas,audioGuardado:false});},20);},
    listarPropuestas:function(){setTimeout(function(){var n={};DATOS.horario.forEach(function(h){n[h.docente]=1;});
      ok({propuestas:PROP.slice(),docentes:Object.keys(n).sort(),motivos:DATOS.motivos.map(function(m){return m.motivo;})});},20);},
    resolverPropuesta:function(p){setTimeout(function(){PROP=PROP.filter(function(x){return x.id!==p.id;});ok({estado:p.accion==='descartar'?'descartada':'registrada (vista previa: no se guarda)'});},20);},
    guardarRonda:function(p){setTimeout(function(){
      var blob=new Blob(['\\ufeff'+csv(p)],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download='ronda_'+p.fecha+'_S'+p.sesion+'.csv';document.body.appendChild(a);a.click();a.remove();
      ok({ok:true,guardados:p.registros.length});},20);}};return self;};
  window.google={script:{run:new Proxy({},{get:function(_,k){var s=api();return k in s?s[k]:s;}})}};
})();
</script>
""" % json.dumps(datos, ensure_ascii=False, separators=(",", ":"))

html = open(os.path.join(RAIZ, "apps_script", "Consulta.html"), encoding="utf-8").read()
analizador = "<script>\n" + open(os.path.join(RAIZ, "apps_script", "Patrones.gs"), encoding="utf-8").read() + "\n" + open(os.path.join(RAIZ, "apps_script", "Notas.gs"), encoding="utf-8").read() + "\n</script>\n"
html = html.replace("<script>\nvar S = null;", analizador + mock + "<script>\nvar S = null;", 1)
html = html.replace("<main>", '<div style="background:#fff3cd;color:#664d03;padding:6px 12px;font-size:13px;border-bottom:1px solid #ffe69c">'
                    "<b>VISTA PREVIA:</b> así se verá la ronda. Los registros no se envían a ningún sitio: al guardar se descarga un archivo CSV."
                    "</div>\n<main>", 1)
html = html.replace("<title>ICET - Ronda de asistencia docente</title>", "<title>ICET - Vista previa de la ronda</title>")
open(os.path.join(RAIZ, "ICET_Vista_Previa_Ronda.html"), "w", encoding="utf-8").write(html)
print("OK", round(len(html) / 1024), "KB")
