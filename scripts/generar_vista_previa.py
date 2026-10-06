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


TOTDIA = {}
for _r in rd("horario_maestro.csv"):
    _k = _r["dia"] + "|" + _r["docente"]
    TOTDIA[_k] = TOTDIA.get(_k, 0) + (60 if (_r["grupo"] or "").startswith("00") else 45)

datos = {
    "horario": [{k: r[k] for k in ("docente", "dia", "hora", "tipo", "grupo", "grupos_enfasis", "area", "alternancia", "equipo_enfasis")}
                for r in rd("horario_maestro.csv")],
    "grupos": {g["grupo"]: g["nombre"] for g in rd("grupos.csv")},
    "direccion": {r["grupo"]: {"dir": " / ".join(corto(x) for x in (r["docente_1"], r["docente_2"]) if x), "modalidad": r["modalidad"]}
                  for r in rd("direccion_grupo.csv")},
    "franjas": [{"hora": int(f["hora"]), "bloque": int(f["bloque"]), "inicio": f["inicio"], "fin": f["fin"]} for f in rd("franjas.csv")],
    "altern": {r["area"] + "|" + r[k]: r["docente_b" if k == "docente_a" else "docente_a"] for r in rd("alternancias.csv") for k in ("docente_a", "docente_b")},
    "totdia": TOTDIA,
    "preesc": {r["dia"] + r["hora"]: r["inicio"] + " - " + r["fin"] for r in rd("horario_maestro.csv") if r["grupo"].startswith("00")},
    "motivos": rd("motivos.csv"),
    "listas": rd("listas.csv"),
    "directivos": [d["nombre"] for d in csv.DictReader(open(os.path.join(D, "directivos.csv"), encoding="utf-8-sig"))]
                  if os.path.exists(os.path.join(D, "directivos.csv")) else ["Francisco Cortés", "Verónica Barreiro", "Harold Angulo", "Jorge Hernández"],
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
        dir:h.tipo==='AREAS_MULTIPLES'?'':(d.dir||''),modalidad:d.modalidad||'',previo:null,primario:h.docente,pareja:(h.tipo==='CLASE'&&DATOS.altern[h.area+'|'+h.docente])?[h.docente,DATOS.altern[h.area+'|'+h.docente]].sort():null,claveAlt:(h.tipo==='CLASE'&&DATOS.altern[h.area+'|'+h.docente])?'CLASE|'+h.area+'|'+[h.docente,DATOS.altern[h.area+'|'+h.docente]].sort().join('|'):'',_par:(h.tipo==='ENFASIS'&&/^PAREJA/.test(h.alternancia))?h.hora+'|'+h.grupos_enfasis:'',alternos:(h.tipo==='CLASE'&&DATOS.altern[h.area+'|'+h.docente])?[DATOS.altern[h.area+'|'+h.docente]]:[],minutosDia:(DATOS.totdia[h.dia+'|'+h.docente]||0),
        sesiones:[{sesion:Number(h.hora),grupoCodigo:gc,area:h.area||'(énfasis)',grupo:enf?'ÉNFASIS '+String(gc).split('+').map(function(g){return DATOS.grupos[g]||g;}).join(' + '):(DATOS.grupos[gc]||gc)}]};
    });
    var pares={},sp=[];out.filas.forEach(function(f){if(!f._par){sp.push(f);return;}var k=pares[f._par];if(!k){pares[f._par]=f;sp.push(f);return;}
      var pri=f.docente<k.docente?f:k,otro=pri===f?k:f;pri.alternos=(pri.alternos||[]).concat([otro.docente]);pri.pareja=[pri.docente,otro.docente].sort();pri.claveAlt='ENFASIS|'+pri.grupoCodigo+'|'+pri.pareja.join('|');if(pri===f){pares[f._par]=f;sp[sp.indexOf(k)]=f;}});
    out.filas=sp;out.filas.forEach(function(f){delete f._par;});
    out.filas.forEach(function(f){var st=f.claveAlt?ESTADO[f.claveAlt]:null;if(!st)return;
      f.docente=/^CLASE/.test(f.claveAlt)?(st.intercambio==='SI'?f.pareja.filter(function(n){return n!==f.primario;})[0]:f.primario):st.elegido;f.alternos=[];f.definido={por:st.por};});
    if(out.modo==='bloque'){var por={},uni=[];out.filas.forEach(function(f){var k=por[f.docente];if(!k){por[f.docente]=f;uni.push(f);}else{k.sesiones=k.sesiones.concat(f.sesiones);f.alternos.forEach(function(a){if(k.alternos.indexOf(a)<0)k.alternos.push(a);});}});
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
  var PROP=[], NOTAS_N=0, ESTADO={};
  function mins(hm){var a=hm.split(':');return Number(a[0])*60+Number(a[1]);}
  function ctxNota(texto,fecha){
    var nombres={}; DATOS.horario.forEach(function(h){nombres[h.docente]=1;});
    return {texto:texto,fecha:fecha,docentes:Object.keys(nombres).map(function(n){return {nombre_completo:n,apellidos:n,nombres:''};}),
      grupos:Object.keys(DATOS.grupos).map(function(g){return {grupo:g};}),
      franjas:DATOS.franjas.map(function(f){return {hora:f.hora,inicio_min:mins(f.inicio),fin_min:mins(f.fin)};}),horario:DATOS.horario};
  }
  var api=function(){var ok=null,fail=null,self={
    withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('#vista-previa');},0);},
    consultarSesion:function(d,s,m){setTimeout(function(){ok(consultar(d,s,m));},20);},
    guardarNotaRonda:function(p){setTimeout(function(){
      if(!String(p.texto||'').trim()){ok({id:'n',propuestas:[],audioGuardado:false});return;}
      var a=analizarNota_(ctxNota(p.texto,p.fecha||bogota().fecha)), nuevas=a.propuestas.map(function(x,i){
        return {id:'p'+(++NOTAS_N),fecha:p.fecha||bogota().fecha,docente:x.docente,tipo_novedad:x.tipo_novedad,motivo:x.motivo,categoria:x.categoria,confianza:x.confianza,mensaje:x.mensaje,sesion:x.sesion||p.sesion||'',grupo:x.grupo||''};});
      PROP=PROP.concat(nuevas); ok({id:'n',propuestas:nuevas,audioGuardado:false});},20);},
    definirAlternancia:function(p){setTimeout(function(){var pt=p.clave.split('|');ESTADO[p.clave]={elegido:p.elegido,intercambio:pt[0]==='CLASE'?(p.elegido!==p.primario?'SI':'NO'):'',por:p.directivo||'(vista previa)'};ok({ok:true});},20);},
    listarPropuestas:function(){setTimeout(function(){var n={};DATOS.horario.forEach(function(h){n[h.docente]=1;});
      ok({propuestas:PROP.slice(),docentes:Object.keys(n).sort(),motivos:DATOS.motivos.map(function(m){return m.motivo;})});},20);},
    resolverPropuesta:function(p){setTimeout(function(){PROP=PROP.filter(function(x){return x.id!==p.id;});ok({estado:p.accion==='descartar'?'descartada':'registrada (vista previa: no se guarda)'});},20);},
    guardarRonda:function(p){setTimeout(function(){
      var blob=new Blob(['\\ufeff'+csv(p)],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download='ronda_'+p.fecha+'_S'+p.sesion+'.csv';document.body.appendChild(a);a.click();a.remove();
      ok({ok:true,guardados:p.registros.length});},20);}};return self;};
  window.PREVIEW=true;
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


# ---------------------------------------------------------------- vista previa de Reuniones
import re as _re
_gs = open(os.path.join(RAIZ, "apps_script", "Reuniones.gs"), encoding="utf-8").read()
_tipos = [{"tipo": m.group(1), "sinEstudiantes": m.group(2) == "true", "inicio": m.group(3), "fin": m.group(4)}
          for m in _re.finditer(r"\{ tipo: '([^']+)', sinEstudiantes: (true|false), inicio: '(\d\d:\d\d)', fin: '(\d\d:\d\d)' \}", _gs)]
_personas = [{"nombre": d["nombre_completo"], "rol": "Docente"} for d in rd("docentes.csv") if d["tiene_horario"] == "SI"] + \
            [{"nombre": n, "rol": "Directivo"} for n in datos["directivos"]]
mock2 = """<script>
/* ---- Vista previa: simula el servidor con datos de ejemplo; nada se guarda fuera de esta página ---- */
(function(){
  var TIPOS=%s, PERSONAS=%s, MOTIVOS=%s, REUN=[], ASIST={}, HOY=(function(){var p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date());return p;})();
  function reun(id){return REUN.filter(function(r){return r.id===id;})[0];}
  function conv(r){return r.convocados==='TODOS'?PERSONAS.map(function(p){return p.nombre;}):r.convocados;}
  var api=function(){var ok=null,fail=null,self={
    withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('#vista-previa');},0);},
    listarReuniones:function(p){setTimeout(function(){var f=(p&&p.fecha)||HOY;
      ok({fecha:f,tipos:TIPOS,personas:PERSONAS,motivos:MOTIVOS,reuniones:REUN.filter(function(r){return r.fecha===f;}).map(function(r){var a=ASIST[r.id]||{},c=conv(r);
        return Object.assign({},r,{convocadosN:c.length,registrados:c.filter(function(n){return a[n];}).length});})});},20);},
    crearReunion:function(p){setTimeout(function(){
      if(!p.inicio||!p.fin||p.fin<=p.inicio){fail&&fail({message:'Revise la hora de inicio y de fin.'});return;}
      var r={id:'r'+(REUN.length+1),fecha:p.fecha||HOY,tipo:p.tipo,nombre:p.nombre||p.tipo,inicio:p.inicio,fin:p.fin,sinEstudiantes:!!p.sinEstudiantes,convocados:p.convocados};REUN.push(r);ok({id:r.id});},20);},
    cargarReunion:function(p){setTimeout(function(){var r=reun(p.id),a=ASIST[r.id]||{};
      ok({reunion:r,motivos:MOTIVOS,personas:conv(r).map(function(n){var pp=PERSONAS.filter(function(x){return x.nombre===n;})[0]||{rol:'Docente'};return {nombre:n,rol:pp.rol,registro:a[n]||null};})});},20);},
    guardarAsistenciaReunion:function(p){setTimeout(function(){var a=ASIST[p.id]=ASIST[p.id]||{};p.registros.forEach(function(x){a[x.persona]={estado:x.estado,motivo:x.motivo};});ok({guardados:p.registros.length});},20);}};return self;};
  window.PREVIEW=true;
  window.google={script:{run:new Proxy({},{get:function(_,k){var s=api();return k in s?s[k]:s;}})}};
})();
</script>
""" % (json.dumps(_tipos, ensure_ascii=False), json.dumps(_personas, ensure_ascii=False), json.dumps([m["motivo"] for m in datos["motivos"]], ensure_ascii=False))
_h = open(os.path.join(RAIZ, "apps_script", "Reunion.html"), encoding="utf-8").read()
_h = _h.replace("<script>\nvar L=null;", mock2 + "<script>\nvar L=null;", 1)
_h = _h.replace("<main id=\"app\">", '<div style="background:#fff3cd;color:#664d03;padding:6px 12px;font-size:13px;border-bottom:1px solid #ffe69c"><b>VISTA PREVIA:</b> pruebe el flujo; nada se guarda fuera de esta página.</div>\n<main id="app">', 1)
open(os.path.join(RAIZ, "ICET_Vista_Previa_Reuniones.html"), "w", encoding="utf-8").write(_h)
print("OK reuniones", round(len(_h) / 1024), "KB", len(_tipos), "tipos")


# ---------------------------------------------------------------- vista previa del menú de entrada
_m = open(os.path.join(RAIZ, "apps_script", "Menu.html"), encoding="utf-8").read()
_mock3 = """<script>
/* Vista previa del ingreso: clave de ejemplo 123456 (nada se guarda fuera de esta página). */
(function(){
  var DIR=[{nombre:'Francisco Cortés',rol:'Coordinador académico',tieneClave:true},{nombre:'Verónica Barreiro',rol:'Coordinadora de redes de apoyo',tieneClave:true},{nombre:'Harold Angulo',rol:'Coordinador de convivencia',tieneClave:true},{nombre:'Jorge Hernández',rol:'Rector',tieneClave:true}];
  var intentos=0, quien='';
  var api=function(){var ok=null,fail=null,self={withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('#vista-previa');},5);},
    listarDirectivosPublicos:function(){setTimeout(function(){ok(DIR);},5);},
    ingresar:function(p){setTimeout(function(){ if(p.pin==='123456'){quien=p.nombre;intentos=0;ok({token:'t'.repeat(64),nombre:p.nombre,rol:'Coordinador'});} else {intentos++; fail({message:intentos>=5?'Demasiados intentos. Espere 15 minutos.':'Nombre o clave incorrectos.'});}},300);},
    cerrarSesion:function(){setTimeout(function(){quien='';ok({ok:true});},5);},
    guardarCorreo:function(p){setTimeout(function(){ if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(p.correo)){fail({message:'Escriba un correo válido.'});} else {window.CORREO_OK=true;ok({ok:true});} },200);},
    cambiarClave:function(p){setTimeout(function(){ if(p.actual!=='123456'){fail({message:'Nombre o clave incorrectos.'});} else if(!/^\\d{6}$/.test(p.nueva)){fail({message:'La clave nueva debe tener 6 números.'});} else ok({ok:true});},200);},
    llamarSeguro:function(t,fn){setTimeout(function(){ if(fn==='contextoPanel') ok({rol:'directivo',nombre:quien||'Francisco Cortés',necesitaCorreo:quien!=='Francisco Cortés'&&!window.CORREO_OK}); else ok({});},5);}};return self;};
  window.google={script:{run:new Proxy({},{get:function(_,k){var s=api();return k in s?s[k]:s;}})}};
})();
</script>
"""
_m = _m.replace("<script>\nvar BASE='', NOMBRES=[];", _mock3 + "<script>\nvar BASE='', NOMBRES=[];", 1)
open(os.path.join(RAIZ, "ICET_Vista_Previa_Menu.html"), "w", encoding="utf-8").write(_m)
print("OK menu")


# ---------------------------------------------------------------- vista previa de Horarios (datos calculados con el código real)
import subprocess, tempfile
_tmp = os.path.join(tempfile.gettempdir(), "horarios_demo.json")
if os.path.exists(os.path.join(RAIZ, "apps_script", "pruebas", "hojas.json")):
    subprocess.run(["node", os.path.join(RAIZ, "apps_script", "pruebas", "exportar_horarios_demo.js"), _tmp], check=True)
    _datos_h = open(_tmp, encoding="utf-8").read()
    _mock4 = """<script>
/* Vista previa de Horarios: respuestas calculadas con el código real sobre los datos del libro. */
(function(){
  var D=%s;
  /* estudiantes FALSOS (solo para la simulación) */
  var AP=['Rojas','Soto','Pérez','Díaz','Mena','Cuero','Angulo','Ortiz','Lerma','Caicedo','Torres','Rivas'], NM=['Ana María','José Luis','Laura','Carlos','Sofía','Pedro','Camila','Andrés','Valentina','Mateo'];
  var GR={'0001':'0°-1','0501':'5°-1','0601':'6°-1','0602':'6°-2','CS101':'CS 1-1','0701':'7°-1','0702':'7°-2','0901':'9°-1','1101':'11°-1'}, ESTU=[], MID=0, TIPOSE=[{id:'NO_ASISTE',texto:'No asiste (posible deserción)'},{id:'AUSENTE',texto:'Se ausenta con frecuencia'},{id:'FUGA',texto:'Se fuga con frecuencia (se evade de clase)'},{id:'ORIENTACION',texto:'Remitido a orientación escolar'},{id:'PROYECTO',texto:'En proyecto o programa especial'},{id:'RETIRADO',texto:'Retirado formalmente'},{id:'CANCELADA',texto:'Matrícula cancelada'},{id:'NUEVO',texto:'Estudiante nuevo (llegó en el año)'},{id:'PROMOVIDO',texto:'Promovido al siguiente grado'}];
  Object.keys(GR).forEach(function(g,gi){for(var i=0;i<14;i++){ESTU.push({g:g,no:i+1,a:(AP[(i*3+gi)%%AP.length]+' '+AP[(i+gi*5+1)%%AP.length]).toUpperCase(),n:NM[(i+gi)%%NM.length].toUpperCase()});}});
  ESTU[2].m=[{id:'m0',tipo:'No asiste (posible deserción)',nota:'No viene desde el 15 de septiembre',por:'Harold Angulo',fecha:'2026-10-02'}];
  function estData(){var gs={},ord=[];ESTU.forEach(function(e){if(!gs[e.g]){gs[e.g]={codigo:e.g,curso:GR[e.g],total:0};ord.push(e.g);} gs[e.g].total++;}); return {grupos:ord.map(function(c){return gs[c];}),estudiantes:ESTU,tipos:TIPOSE};}
  var api=function(){var ok=null,fail=null,self={withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('#vista-previa');},5);},
    consultaHorarios:function(p){setTimeout(function(){
      if(p.modo==='catalogo') ok(D.catalogo); else if(p.modo==='directores') ok(D.directores);
      else if(p.modo==='lote') ok({modo:'lote',tipo:p.tipo,semana:D.docente[Object.keys(D.docente)[0]].semana,items:Object.keys(p.tipo==='grupo'?D.grupo:D.docente).map(function(k){return (p.tipo==='grupo'?D.grupo:D.docente)[k];})});
      else if(p.modo==='docente') ok(D.docente[p.docente]); else if(p.modo==='grupo') ok(D.grupo[p.grupo]);
      else { var k=(p.dia||'JUEVES')+'|'+(p.sesion||1); ok(D.ahora[k]||D.ahora['JUEVES|1']); } },20);},
    datosEstudiantes:function(){setTimeout(function(){ok(estData());},30);},
    marcarEstudiantes:function(p){setTimeout(function(){var tx=TIPOSE.filter(function(t){return t.id===p.tipo;})[0]; if(!tx){fail({message:'Elija el tipo de marca.'});return;}
      p.items.forEach(function(it){var e=ESTU.filter(function(x){return x.g===it.g&&x.a===it.a&&x.n===it.n;})[0]; if(e){e.m=e.m||[]; e.m.push({id:'m'+(++MID),tipo:tx.texto,nota:p.nota||'',por:'Francisco Cortés',fecha:new Date().toISOString().slice(0,10)});}}); ok({marcados:p.items.length,yaTenian:0});},30);},
    levantarMarcaEstudiante:function(p){setTimeout(function(){ESTU.forEach(function(e){if(e.m) e.m=e.m.filter(function(x){return x.id!==p.id;});}); ok({ok:true});},30);},
    agregarEstudiante:function(p){setTimeout(function(){if(!p.a||!p.n){fail({message:'Escriba apellidos y nombres.'});return;} var c=ESTU.filter(function(x){return x.g===p.g;}); ESTU.push({g:p.g,no:c.length+1,a:p.a.toUpperCase(),n:p.n.toUpperCase(),m:[{id:'m'+(++MID),tipo:'Estudiante nuevo (llegó en el año)',nota:p.nota||'',por:'Francisco Cortés',fecha:new Date().toISOString().slice(0,10)}]}); ok({ok:true});},30);},
    moverEstudiante:function(p){setTimeout(function(){var e=ESTU.filter(function(x){return x.g===p.g&&x.a===p.a&&x.n===p.n;})[0]; if(!e){fail({message:'No se encontró al estudiante.'});return;} var o=GR[e.g], d=GR[p.destino]; e.g=p.destino; e.no=ESTU.filter(function(x){return x.g===p.destino;}).length; e.m=(e.m||[]).concat([{id:'m'+(++MID),tipo:'Promovido al siguiente grado',nota:'De '+o+' a '+d+(p.nota?' · '+p.nota:''),por:'Francisco Cortés',fecha:new Date().toISOString().slice(0,10)}]); ok({ok:true});},30);},
    llamarSeguro:function(){setTimeout(function(){ok({});},5);}};return self;};
  window.PREVIEW=true;
  window.google={script:{run:new Proxy({},{get:function(_,k){var s=api();return k in s?s[k]:s;}})}};
})();
</script>
""" % _datos_h
    _hh = open(os.path.join(RAIZ, "apps_script", "Horarios.html"), encoding="utf-8").read()
    _i = _hh.index("<script>")
    _hh = _hh[:_i] + _mock4 + _hh[_i:]
    open(os.path.join(RAIZ, "ICET_Vista_Previa_Horarios.html"), "w", encoding="utf-8").write(_hh)
    print("OK horarios", round(len(_hh) / 1024), "KB")


# ---------------------------------------------------------------- vista previa de Registrar novedades
_nv = open(os.path.join(RAIZ, "apps_script", "Novedad.html"), encoding="utf-8").read()
_docs = [{"nombre": d["nombre_completo"], "nivel": d["nivel"]} for d in rd("docentes.csv") if d["tiene_horario"] == "SI"]
_mots = [{"motivo": m["motivo"], "categoria": m["categoria"], "justificada": m["justificada"]} for m in datos["motivos"]]
_mock5 = """<script>
/* Vista previa de Registrar novedades: nada se guarda fuera de esta página. */
(function(){
  var DOCS=%s, MOTIVOS=%s, REG=[];
  var EXT=['Salida pedagógica o recorrido con estudiantes','Paseo o salida recreativa con estudiantes','Intercolegiados o evento deportivo con estudiantes','Charla o actividad externa con estudiantes'];
  var TIPOS=[{id:'AUSENCIA',texto:'No asistirá (o no asistió) el día completo',pide:'dias'},{id:'TARDE',texto:'Llegará tarde (o llegó tarde)',pide:'llegada'},{id:'SALIDA',texto:'Saldrá temprano (o salió temprano)',pide:'salida'},{id:'HORAS',texto:'Permiso por horas',pide:'rango'},{id:'EXTERNA',texto:'Salida pedagógica o actividad con estudiantes fuera del colegio',pide:'rango_o_dia'}];
  var hoy=new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'});
  var api=function(){var ok=null,fail=null,self={withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('#vista-previa');},5);},
    datosNovedades:function(){setTimeout(function(){ok({hoy:hoy,docentes:DOCS,tipos:TIPOS,motivos:MOTIVOS,motivosExterna:EXT,medios:['WhatsApp directo','Llamada celular','Verbal','Formato Permiso Docente'],fuentes:['Docente ausente','Rector','Coordinador(a)'],registros:REG});},20);},
    registrarNovedad:function(p){setTimeout(function(){ if(!p.docentes.length){fail({message:'Elija al menos un docente.'});return;}
      p.docentes.forEach(function(d){REG.unshift({id:'r'+REG.length,docente:d,tipo:p.tipo,motivo:p.motivo,desde:p.desde,hasta:p.hasta,dias:1,descripcion:p.descripcion||'',por:'Francisco Cortés'});});
      ok({id:'x',filas:p.docentes.length,dias:1,sinClases:[],yaAusente:[]});},200);},
    quitarNovedad:function(p){setTimeout(function(){REG=REG.filter(function(r){return r.id!==p.id;});ok({quitadas:1});},100);},
    llamarSeguro:function(){setTimeout(function(){ok({});},5);}};return self;};
  window.PREVIEW=true;
  window.google={script:{run:new Proxy({},{get:function(_,k){var s=api();return k in s?s[k]:s;}})}};
})();
</script>
""" % (json.dumps(_docs, ensure_ascii=False), json.dumps(_mots, ensure_ascii=False))
_i = _nv.index("<script>")
_nv = _nv[:_i] + _mock5 + _nv[_i:]
open(os.path.join(RAIZ, "ICET_Vista_Previa_Novedades.html"), "w", encoding="utf-8").write(_nv)
print("OK novedades", round(len(_nv) / 1024), "KB")
