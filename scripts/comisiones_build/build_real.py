import re,json
# Autor del sistema: Francisco Javier Cortés Cabezas. Arma apps_script/Comisiones.html (pantalla real) desde la plantilla de la vista previa.
s=open('/tmp/cartilla/comisiones_v53.tpl.html',encoding='utf-8').read()
def sub1(pat,new,flags=re.M):
    global s
    m=list(re.finditer(pat,s,flags));assert len(m)==1,(pat,len(m))
    s=s[:m[0].start()]+new+s[m[0].end():]
sub1(r'^var G=\{.*$','var G={};')
sub1(r'^var EST=\[\],nid=1;.*$','var EST=[],nid=1;')
sub1(r'^var DOCS=\[.*$','var DOCS=[];')
sub1(r'^var APOYO=\[.*$','var APOYO=[];')
sub1(r'^var SEC=\{.*$','var SEC={};')
sub1(r'^var __tb;function auto\(\).*$','function auto(){}')
m=re.search(r"^init\('8° Secundaria'\);vista\(false\);.*$",s,re.M);assert m
real=open('/tmp/cartilla/real_layer.js',encoding='utf-8').read()
s=s[:m.start()]+"try{$$('img[data-logo]').forEach(function(i){i.src=LOGO})}catch(e){}\n"+real+s[m.end():]
s=s.replace('<button class="btn s" onclick="ejemplo()">Cargar ejemplo (solo vista previa)</button>','<button class="btn s" id="btnEj" style="display:none" onclick="modoEjemplo()">Cargar ejemplo completo (solo desarrollador · no se guarda)</button>',1)
s=s.replace('<div class="perf">','<div class="row" id="barraSes" style="padding:6px 10px;justify-content:space-between;background:#fff;border-bottom:1px solid var(--borde)"><button class="btn s" onclick="volverMenu()">← Volver al menú</button> <button class="btn s" id="btnHist" style="display:none" onclick="abrirHistorial()">🕘 Historial y recuperación</button><span><small class="g" id="quienSes"></small> <button class="btn s" onclick="salirSesion()">Cerrar sesión</button></span></div><div id="turno"></div><div class="perf">',1)
assert 'id="barraSes"' in s
OBS_V="(function(){var tm;new MutationObserver(function(){clearTimeout(tm);tm=setTimeout(etiqueta,60)}).observe(document.querySelector('main'),{childList:true,subtree:true})})();"
OBS_N="(function(){var tm,ob=new MutationObserver(function(){clearTimeout(tm);tm=setTimeout(function(){etiqueta();ob.takeRecords()},60)});ob.observe(document.querySelector('main'),{childList:true,subtree:true})})();"
assert s.count(OBS_V)==1,'observador no encontrado'
s=s.replace(OBS_V,OBS_N)
s=s.replace('<input type="text" id="fecha" readonly>','<input type="hidden" id="fecha"><input type="date" id="fechaP">',1)
s=s.replace('<label>Hora de apertura (fija)</label><input type="text" id="hora" readonly>','<label>Hora de apertura</label><input type="hidden" id="hora"><input type="time" id="horaP">',1)
s=s.replace('<input type="text" id="hAp" readonly>','<input type="time" id="hApP"><input type="hidden" id="hAp">',1)
assert 'id="fechaP"' in s and 'id="horaP"' in s
s=s.replace("function etiqueta(){etiqueta0();","function etiqueta(){etiqueta0();try{syncPick()}catch(e){}",1)
assert "['p7','Mis actas','dax']," in s and ",['p6','Integración','ax']" in s
s=s.replace("['p7','Mis actas','dax'],","").replace(",['p6','Integración','ax']","")
s=s.replace('</style><style id="pieSty">','body.lectura #p1 .paso:not(#s8) .card{pointer-events:none;opacity:.78}body.lectura #p1 .paso .jur,body.lectura #p1 .paso .jur *{pointer-events:auto;opacity:1}#turno{margin:6px 12px}.vp{display:none!important}input[type=date],input[type=time]{width:100%;padding:8px;border:2px solid var(--borde);border-radius:9px;font:inherit;font-size:inherit;color:inherit;background:#fff;box-sizing:border-box;min-height:40px}.grow>label{display:block}</style><style id="pieSty">',1)
n_ej=len(re.findall(r'<button[^>]*onclick="[^"]*ejemplo[^"]*"[^>]*>.*?</button>',s))
s=re.sub(r'<button[^>]*onclick="[^"]*ejemplo[^"]*"[^>]*>.*?</button>','',s)
s=s.replace('Sin datos todavía. Use «Cargar ejemplo» en el acta.','Aún no hay datos registrados.')
s=s.replace('Grado (ejemplo)','Grado').replace('Docente (ejemplo)','Docente')
print('botones de ejemplo quitados:',n_ej)
assert "'Docente de apoyo (UAI)']" in s
s=s.replace("'Docente de apoyo (UAI)']","'Docente de apoyo (UAI)','Editor del acta']",1)
s=re.sub(r'VISTA PREVIA v\d+','COMISIONES',s)
ref=json.load(open('/home/user/imagenes/data/referentes_etiquetas.json',encoding='utf-8'));lg=open('/tmp/cartilla/logo_png.b64').read().strip();lh=open('/tmp/cartilla/logo_hi_webp.b64').read().strip()
VER=re.search(r"VERSION_SISTEMA = '([^']+)'",open('/home/user/imagenes/apps_script/Leeme.gs',encoding='utf-8').read()).group(1)
s=s.replace('__CLIENTVER__',VER)
out=s.replace('__LOGOHI__',lh).replace('__LOGO__',lg).replace('/*REFDATA*/{}',json.dumps(ref,ensure_ascii=False,separators=(',',':')))
for dato in ('Cuéllar','Valverde','1085','Puches'):
    assert dato not in out, 'dato personal en la pantalla real: '+dato
open('/home/user/imagenes/apps_script/Comisiones.html','w',encoding='utf-8').write(out)
print('real ok',len(out))
