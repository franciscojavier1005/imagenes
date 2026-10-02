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
    "motivos": rd("motivos.csv"),
    "listas": rd("listas.csv"),
    "directivos": [d["nombre"] for d in csv.DictReader(open(os.path.join(D, "directivos.csv"), encoding="utf-8-sig"))]
                  if os.path.exists(os.path.join(D, "directivos.csv")) else ["Francisco Cortés", "Coordinador 2", "Coordinador 3", "Rector"],
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
  function consultar(dia,sesion){
    var b=bogota(), auto=!dia&&!sesion; dia=dia||b.dia; var s=sesion?Number(sesion):sesionAhora(b.hm);
    var fr=DATOS.franjas.filter(function(f){return f.hora===s;})[0];
    var out={dia:dia,diaHoy:dia,sesion:s,auto:auto,hora:b.hm,fecha:b.fecha,franja:fr?fr.inicio+' - '+fr.fin:'',bloque:fr?fr.bloque:null,
      filas:[],motivos:DATOS.motivos,listas:DATOS.listas,directivos:DATOS.directivos,nota:s?'':(auto?'Descanso o fuera de jornada':'Sesión no válida')};
    if(!s) return out;
    out.filas=DATOS.horario.filter(function(h){return h.dia===dia&&Number(h.hora)===s;}).map(function(h){
      var enf=h.tipo==='ENFASIS', gc=enf?h.grupos_enfasis:h.grupo, d=DATOS.direccion[String(gc).split('+')[0]]||{};
      return {docente:h.docente,grupoCodigo:gc,
        grupo:enf?'ÉNFASIS '+String(gc).split('+').map(function(g){return DATOS.grupos[g]||g;}).join(' + '):(DATOS.grupos[gc]||gc),
        area:h.area||'(énfasis)',tipo:h.tipo,
        nota:[h.alternancia,h.equipo_enfasis?'Con: '+h.equipo_enfasis:''].filter(Boolean).join(' · '),
        dir:h.tipo==='AREAS_MULTIPLES'?'':(d.dir||''),modalidad:d.modalidad||'',previo:null};
    });
    return out;
  }
  function csv(p){
    var c=['fecha,dia,sesion,docente,grupo,area,estado,motivo,minutos,actividad,observaciones,directivo'];
    p.registros.forEach(function(r){c.push([p.fecha,p.dia,p.sesion,r.docente,r.grupoCodigo,r.area,r.estado,r.motivo,r.minutos,r.actividad,r.obs,p.directivo]
      .map(function(x){return '"'+String(x==null?'':x).replace(/"/g,'""')+'"';}).join(','));});
    return c.join('\\n');
  }
  var api=function(){var ok=null,fail=null,self={
    withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('');},0);},
    consultarSesion:function(d,s){setTimeout(function(){ok(consultar(d,s));},20);},
    guardarRonda:function(p){setTimeout(function(){
      var blob=new Blob(['\\ufeff'+csv(p)],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download='ronda_'+p.fecha+'_S'+p.sesion+'.csv';document.body.appendChild(a);a.click();a.remove();
      ok({ok:true,guardados:p.registros.length});},20);}};return self;};
  window.google={script:{run:new Proxy({},{get:function(_,k){var s=api();return k in s?s[k]:s;}})}};
})();
</script>
""" % json.dumps(datos, ensure_ascii=False, separators=(",", ":"))

html = open(os.path.join(RAIZ, "apps_script", "Consulta.html"), encoding="utf-8").read()
html = html.replace("<script>\nvar S = null;", mock + "<script>\nvar S = null;", 1)
html = html.replace("<main>", '<div style="background:#fff3cd;color:#664d03;padding:6px 12px;font-size:13px;border-bottom:1px solid #ffe69c">'
                    "<b>VISTA PREVIA:</b> así se verá la ronda. Los registros no se envían a ningún sitio: al guardar se descarga un archivo CSV."
                    "</div>\n<main>", 1)
html = html.replace("<title>ICET - Ronda de asistencia docente</title>", "<title>ICET - Vista previa de la ronda</title>")
open(os.path.join(RAIZ, "ICET_Vista_Previa_Ronda.html"), "w", encoding="utf-8").write(html)
print("OK", round(len(html) / 1024), "KB")
