#!/usr/bin/env python3
"""Vista previa de la pantalla REAL de comisiones (y del menú de ingreso) en un solo archivo HTML que funciona sin Google ni servidor.
Incluye el código real del servidor (ICET_completo.gs) corriendo dentro del navegador con una hoja de cálculo simulada y DATOS INVENTADOS.
Se abre con doble clic en Safari, Chrome o Edge (Mac o Windows). Nada se guarda fuera de la página.
Uso: python3 scripts/empaquetar_apps_script.py && python3 scripts/generar_vista_previa_comisiones.py
Autor del sistema: Francisco Javier Cortés Cabezas."""
import json, os, re
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
PAQ = os.path.join(RAIZ, 'apps_script', 'paquete')
rd = lambda p: open(p, encoding='utf-8').read()

H = json.load(open(os.path.join(RAIZ, 'apps_script', 'pruebas', 'hojas.json'), encoding='utf-8'))
CAB = {k: v[0] for k, v in H.items() if k != '_alias' and v}
CAB['Estudiantes'] = ['grupo', 'curso', 'no', 'apellidos', 'nombres', 'documento', 'tipo_doc']
CAB['Identidad_Docentes'] = ['docente', 'cedula', 'celular']
CAB['Directivos'] = ['nombre', 'rol', 'correo_temporal', 'pin_hash', 'pin_sal', 'intentos', 'bloqueado_hasta', 'correo']
CAB['Usuarios'] = ['email', 'docente', 'estado', 'fecha_solicitud', 'autoriza_datos', 'fecha_autorizacion', 'version_texto', 'aprobado_por', 'fecha_aprobacion']
servidor_js = rd(os.path.join(AQUI, 'comisiones_build', 'vista_previa_servidor.js')).replace('__CABECERAS__', json.dumps(CAB, ensure_ascii=False))
codigo_gs = rd(os.path.join(PAQ, 'ICET_completo.gs'))
esc = lambda s: s.replace('</script', '<\\/script')

PUENTE = r"""
<script>
/* ===== VISTA PREVIA: puente entre la pantalla y el servidor de demostración (iframe oculto) ===== */
(function(){
  var MODO='__MODO__', PERFIL=(location.hash||'').replace('#','')||'docente', tokens=null, n=0, pend={}, cola=[];
  try{ if(MODO==='comisiones') localStorage.setItem('icet_token','t'.repeat(64)); else localStorage.removeItem('icet_token'); }catch(e){}
  var codigo=document.getElementById('srv-codigo').textContent, mocks=document.getElementById('srv-mocks').textContent;
  var fr=document.createElement('iframe'); fr.style.cssText='display:none'; fr.setAttribute('aria-hidden','true');
  fr.srcdoc='<!doctype html><html><head><meta charset="utf-8"></head><body><scr'+'ipt>'+mocks+'</scr'+'ipt><scr'+'ipt>'+codigo+'</scr'+'ipt><scr'+'ipt>window.__listo();</scr'+'ipt></body></html>';
  var listo=false;
  window.addEventListener('message',function(e){var d=e.data||{};
    if(d.tipo==='listo'){tokens=d.tokens;listo=true;cola.splice(0).forEach(function(f){f()});}
    else if(d.tipo==='res'&&pend[d.id]){var p=pend[d.id];delete pend[d.id];p(d);}});
  function llama(fn,args){return new Promise(function(ok){var go=function(){var id=++n;pend[id]=ok;
      if(MODO==='comisiones'&&fn==='llamarSeguro'&&tokens&&tokens[PERFIL])args=[tokens[PERFIL],args[1],args[2]];
      fr.contentWindow.postMessage({tipo:'llama',id:id,fn:fn,args:args},'*');};
    if(listo)go();else cola.push(go);});}
  function mk(ok,fail){return new Proxy({},{get:function(_,k){
    if(k==='withSuccessHandler')return function(f){return mk(f,fail)}; if(k==='withFailureHandler')return function(f){return mk(ok,f)};
    return function(){var a=[].slice.call(arguments);
      llama(String(k),a).then(function(r){ if(r.err){ if(fail)fail(new Error(r.err)); } else if(ok)ok(r.ok); });};}});}
  window.google={script:{run:mk(null,null)}};
  document.addEventListener('DOMContentLoaded',function(){
    document.body.appendChild(fr);
    var b=document.createElement('div');
    b.style.cssText='position:sticky;top:0;z-index:99999;background:#fff3cd;color:#664d03;padding:6px 12px;font:13px Arial,sans-serif;border-bottom:1px solid #ffe69c';
    b.innerHTML='__BARRA__';
    document.body.insertBefore(b,document.body.firstChild);
    b.querySelectorAll('a[data-p]').forEach(function(a){a.addEventListener('click',function(ev){ev.preventDefault();location.hash=a.getAttribute('data-p');location.reload();});});
  });
})();
</script>
"""
BARRA = {
 'comisiones': '<b>VISTA PREVIA con datos inventados</b> · nada se guarda fuera de esta página (al recargar, la demostración empieza de nuevo). Ver como: '
               '<a href="#" data-p="docente">Docente de grupo (5.º)</a> · <a href="#" data-p="docente2">Docente de área</a> · <a href="#" data-p="docente3">Docente de preescolar</a> · <a href="#" data-p="coord">Coordinación</a>. '
               'Pruebe 0° Preescolar, 5.º, 7.º + Caminar 1, 9.º + Caminar 2 y 11.º.',
 'menu': '<b>VISTA PREVIA con datos inventados</b> · coordinación: <b>Coordinador de Prueba</b>, clave <b>123456</b> · docentes: grado → nombre → clave = su cédula de ejemplo (Prueba Uno Ana: 10000001, Prueba Dos Beto: 10000002…). Los botones que abren otras pantallas no navegan en la vista previa.',
}

def generar(pagina, salida, modo):
    html = rd(os.path.join(PAQ, pagina))
    _v = re.search(r"VERSION_SISTEMA = '([^']+)'", rd(os.path.join(RAIZ, 'apps_script', 'Leeme.gs'))).group(1)
    html = html.replace('<?= VERSION ?>', _v)   # en el libro real la versión la pone el servidor
    puente = PUENTE.replace('__MODO__', modo).replace('__BARRA__', BARRA[modo].replace("'", "\\'"))
    datos = ('<script type="text/plain" id="srv-mocks">' + esc(servidor_js) + '</script>\n'
             '<script type="text/plain" id="srv-codigo">' + esc(codigo_gs) + '</script>\n')
    m = re.search(r'<script', html)
    html = html[:m.start()] + datos + puente + html[m.start():]
    open(os.path.join(RAIZ, salida), 'w', encoding='utf-8').write(html)
    print('OK', salida, round(len(html) / 1024), 'KB')

generar('Comisiones.html', 'ICET_Vista_Previa_Comisiones.html', 'comisiones')
generar('Menu.html', 'ICET_Vista_Previa_Menu.html', 'menu')
