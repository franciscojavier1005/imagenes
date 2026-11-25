// Autor: Francisco Javier Cortés Cabezas · I.E. ICET. Convierte docs/Circular_Profes_Comisiones.txt en PDF.
const {chromium}=require('playwright'),fs=require('fs');
const esc=l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/«([^»]+)»/g,'«<b>$1</b>»');
(async()=>{const t=fs.readFileSync('docs/Circular_Profes_Comisiones.txt','utf8').split('\n');let h='',ul=false;
const cierra=()=>{if(ul){h+='</ul>';ul=false}};
t.forEach((l,i)=>{const e=esc(l.trim());if(!l.trim()){cierra();return}
 if(i<5){cierra();h+=(i===0?'<h1>':'<div class="au">')+e+(i===0?'</h1>':'</div>');return}
 if(/^[0-9]+\. [A-ZÁÉÍÓÚÑ ,:Y]+$/.test(l.trim())){cierra();h+='<h2>'+e+'</h2>';return}
 if(/^(ORIENTACIONES|ANTES DE COMENZAR|RECOMENDACIONES FINALES|AGRADECIMIENTO|COORDINACIÓN ACADÉMICA)/.test(l.trim())){cierra();h+='<h2>'+e+'</h2>';return}
 if(/^- /.test(l)){if(!ul){h+='<ul>';ul=true}h+='<li>'+esc(l.slice(2))+'</li>';return}
 cierra();if(/^---/.test(l))return;h+=(/^(Verificación|Estudiantes retirados|Incorporación|Particularidad|Confirmación|Reconocimientos de|Reconocimiento de|Otros reconocimientos|Importante:)/.test(l.trim())?'<h3>'+e+'</h3>':'<p>'+e+'</p>')});
cierra();
const b=await chromium.launch(),p=await b.newPage();
await p.setContent('<html><head><meta charset="utf-8"><style>body{font:12.5px/1.45 Arial;color:#222}h1{font-size:18px;color:#0b4f8a;margin:0}.au{color:#555;font-size:11.5px}h2{font-size:14px;background:#e8f1fa;color:#0b4f8a;padding:3px 8px;margin:12px 0 3px;border-left:4px solid #0b4f8a}h3{font-size:12.8px;color:#0b4f8a;margin:8px 0 2px}p{margin:3px 0}ul{margin:3px 0;padding-left:20px}li{margin:1px 0}</style></head><body>'+h+'</body></html>');
await p.pdf({path:'docs/Circular_Profes_Comisiones.pdf',format:'Letter',margin:{top:'14mm',bottom:'15mm',left:'17mm',right:'17mm'},displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#888">Control de Procesos ICET · Autor: Francisco Javier Cortés Cabezas · <span class="pageNumber"></span>/<span class="totalPages"></span></div>'});await b.close()})();
