/* ===================== PANTALLA REAL: conexión con el libro (Apps Script) =====================
   Autor del sistema: Francisco Javier Cortés Cabezas. Cada persona entra con su sesión (token); el servidor decide qué puede escribir.
   El acta se guarda por SECCIONES (cursos y áreas), cada una con su versión; si dos personas tocan lo mismo, nadie pisa a nadie. */
var TOKEN_KEY='icet_token';
function tokenGuardado(){try{return localStorage.getItem(TOKEN_KEY)||''}catch(e){return ''}}
function borrarToken(){try{localStorage.removeItem(TOKEN_KEY)}catch(e){}}
function irAlMenu(){try{google.script.run.withSuccessHandler(function(u){window.top.location.href=u||window.top.location.href.split('?')[0]}).urlBase()}catch(e){}}
function srv(){var ok=function(){},fail=function(){},self={},prox;
 self.withSuccessHandler=function(f){ok=f;return prox};self.withFailureHandler=function(f){fail=f;return prox};
 prox=new Proxy(self,{get:function(t,k){if(k in t||typeof k!=='string')return t[k];
  return function(){var args=[].slice.call(arguments);
   var r=google.script.run.withSuccessHandler(ok).withFailureHandler(function(e){if(/SESION_VENCIDA/.test(String(e&&e.message||e))){borrarToken();irAlMenu();return}fail(e)});
   return r.llamarSeguro(tokenGuardado(),k,args)}}});return prox}
function API(fn){var a=[].slice.call(arguments,1);return new Promise(function(ok,no){srv().withSuccessHandler(ok).withFailureHandler(no)[fn].apply(null,a)})}
function msgE(e){return String(e&&e.message||e).replace(/^Error: /,'')}

(function(){var _e=etiqueta;etiqueta=function(){if(!S||!S.gs||!G[GK])return;_e()};var _a=adaptaPeriodo;adaptaPeriodo=function(){if(!S||!S.gs||!G[GK])return;_a()}})();
var CTXR=null,ACTA=null,CODES={},GRADOS_REAL=[],LABEL_DE={},SYNC={ver:{},last:{},busy:false,t1:null,t2:null,activo:false},CERRADO_SRV=false;
var PRES={},SECG=['firmas','listos','faltantes','presencia'],SECR=['general','integrantes','requisitos'];   // SECG: cada persona pone lo suyo; SECR: responsable del registro, editores del acta o coordinación
function kc(c){return CODES[c]||String(c).replace(/[^0-9A-Za-z]/g,'')}
function js(x){return JSON.stringify(x==null?null:x)}
function estadoSync(t,c){try{estadoGuard(t,c)}catch(e){}}
function avisoSync(html){var e=$('#avisoBorr');if(e)e.innerHTML=html?'<div class="ojo" style="margin:0;border-radius:0">'+html+'</div>':''}

/* ---------- grado -> datos de la pantalla ---------- */
var DIAGDOC=null;
function construyeGrado(d){DIAGDOC=d.diag||null;
 var l=d.label;G={};G[l]={niv:d.niv,gs:d.gs.slice(),sig:d.sig,dir:d.dir.slice(),dir2:d.dir2.slice(),ap:d.ap.slice(),areas:d.areas||{}};
 CODES={};d.gs.forEach(function(g,i){CODES[g]=d.codes[i]});REALN={};
 var falta=['Tipo y número de documento','Lugar de expedición','Sexo','Teléfono del acudiente'];
 EST=d.estudiantes.map(function(e){REALN[e.g]=(REALN[e.g]||0)+1;var fl=falta.slice();if(e.ndoc){fl=fl.filter(function(x){return x!=='Tipo y número de documento'})}
  var nacI=e.nac||(/^(PEP|PPT)$/.test(e.tdoc||'')?'Venezolana':/^(CE|PE)$/.test(e.tdoc||'')?'Otra':'Colombiana');if(e.lex){fl=fl.filter(function(x){return x!=='Lugar de expedición'})}
  if(e.tel){fl=fl.filter(function(x){return x!=='Teléfono del acudiente'})}if(e.sx){fl=fl.filter(function(x){return x!=='Sexo'})}return {id:e.id,g:e.g,a:e.a,n:e.n,doc:e.ndoc&&!fl.length?'ok':'falta',sx:e.sx||'',ndoc:e.ndoc||'',tdoc:e.tdoc||'',nac:nacI,lex:e.lex||'',falta:fl,tel:e.tel||'',gest:'',real:1,base:1,f0:fl.length}});
 nid=1000000+Math.floor(Math.random()*8000000);ROSTER_COMPLETO=true;
 APOYO=d.apoyo.map(function(a){return [a.n,a.rol,!!a.p]});
 var nm={};d.dir.forEach(function(n){if(n)nm[n]=1});d.dir2.forEach(function(x){nm[x.n]=1});d.ap.forEach(function(n){nm[n]=1});Object.keys(d.areas||{}).forEach(function(a){String(d.areas[a]).split(' / ').forEach(function(n){if(n)nm[n]=1})});
 window.DOCGRADO=nm;DOCS=Object.keys(nm).sort(function(a,b){return a.localeCompare(b,'es')}).concat(APOYO.map(function(a){return a[0]}));
 Object.keys(PERS).forEach(function(k){delete PERS[k]});
 Object.keys(d.personas).forEach(function(n){var p=d.personas[n];CEDMAP[n]={ced:p.ced||'',tel:p.tel||'',ver:'',tv:''};PERS[n]={correo:p.correo||'',tel:p.tel||'',ced:p.ced||'',libro:false,pend:false}});
}

/* ---------- el acta -> secciones ---------- */
function delCurso(arr,c){return arr.filter(function(r){var e=est(r.id);return e&&e.g===c})}
function scDe(c,comp){return (S.sc&&S.sc[comp]&&S.sc[comp][c])||false}
function shDe(c,comp){return (S.sh&&S.sh[comp]&&S.sh[comp][c])||false}
function particiona(){
 var o={},pre=S.niv==='pre';
 o.general={ac:S.ac,dif:S.dif,prev:S.prev,txt:S.txt,tiposRec:S.tiposRec,sol:S.sol,reab:S.reab,prom:S.prom||{},pend:S.pend||{},pendMan:S.pendMan||{},obs:S.obs||{},obsG:S.obsG||[],convExtra:S.convExtra||[],promObs:S.promObs||{},scAreas:(S.sc&&S.sc.areas)||{},shAreas:(S.sh&&S.sh.areas)||{},hAp:hAp||'',fecha:($('#fecha')||{}).value||''};
 var per={};S.int.forEach(function(x){per[x.n]=persDe(x.n)});
 o.presencia={pers:PRES};o.integrantes={int:S.int};o.requisitos=S.pre||{};o.firmas={firm:S.firm||{},pers:per};o.listos={listo:S.listo||{},jur:S.jur||{},revL:S.revL||{}};
 var f={datos:{},ing:[],cambios:S.cambiosEst||[]};
 EST.forEach(function(e){if(e.ing){f.ing.push({id:e.id,g:e.g,a:e.a,n:e.n,doc:e.doc,sx:e.sx,falta:e.falta,tel:e.tel,gest:e.gest,ndoc:e.ndoc,tdoc:e.tdoc,lex:e.lex,nac:e.nac,acu:e.acu,nuevo:1,ing:1,baja:e.baja||false,bajaMotivo:e.bajaMotivo||'',real:1})}
  else if(e.baja||e.tel||e.gest||e.sx||(e.falta&&e.falta.length!==(e.f0||5))||e.doc==='ok'||e.mod){f.datos[e.id]={falta:e.falta,tel:e.tel,gest:e.gest,sx:e.sx,doc:e.doc,baja:e.baja||false,bajaMotivo:e.bajaMotivo||''};if(e.mod){var q=f.datos[e.id];q.mod=1;q.ndoc=e.ndoc||'';q.tdoc=e.tdoc||'';q.lex=e.lex||'';q.nac=e.nac||'';q.acu=e.acu||'';q.a=e.a;q.n=e.n}}});
 o.faltantes=f;
 S.gs.forEach(function(c,i){var k=kc(c);
  o['matricula:'+k]={mat:S.mat[i]};
  o['estudiantes:'+k]={rep:delCurso(S.rep,c),con:delCurso(S.con,c),com:delCurso(S.com,c),piar:delCurso(S.piar,c),sc:{rep:scDe(c,'rep'),con:scDe(c,'con'),com:scDe(c,'com'),piar:scDe(c,'piar')},sh:{rep:shDe(c,'rep'),con:shDe(c,'con'),com:shDe(c,'com'),piar:shDe(c,'piar')}};
  o['reconocimientos:'+k]={rec:delCurso(S.rec,c),recOk:(S.recOk||{})[c]||'',recN:(S.recN||{})[c]||0,sc:scDe(c,'rec'),sh:shDe(c,'rec')};
  o['promocion:'+k]={promOk:!!(S.promOk&&S.promOk[c])}});
 if(pre)o['areas:propositos']={pp:S.pp};
 else AREAS.forEach(function(a){var m={};S.gs.forEach(function(c,i){m[kc(c)]=(S.rp[a]||[])[i]||0});o['areas:'+a]={rp:m}});
 (S.recKeys||[]).forEach(function(a){o['recomendaciones:'+a.slice(0,70)]={clave:a,texto:S.recs[a]||'',sel:(S.recSel&&S.recSel[a])||[]}});
 return o}
function esResp(){return !S.resp||S.resp===USR}
function esEditor(){return S.int.some(function(x){return x.n===USR&&(x.roles||[]).indexOf('Editor del acta')>=0})}
function puedeGeneral(){return turnoLibre()}
function puedeEscribir(sec){
 if(S&&S.cerrada)return false;
 if(SECG.indexOf(sec)>=0)return true;
 return turnoLibre();
 if(PERFIL!=='d')return true;
 if(SECR.indexOf(sec)>=0)return puedeGeneral();
 if(esEditor())return true;
 var t=sec.split(':')[0],cl=sec.slice(t.length+1),P=perm()||{cursos:[],areas:[]};
 if(SECG.indexOf(sec)>=0)return true;
 if(['matricula','estudiantes','reconocimientos','promocion','obs'].indexOf(t)>=0){return P.cursos.some(function(c){return kc(c)===cl})}
 if(t==='areas'){if(cl==='propositos')return P.cursos.length>0;return P.areas.indexOf(cl)>=0}
 if(t==='recomendaciones'){var real=(S.recKeys||[]).filter(function(a){return a.slice(0,70)===cl})[0]||cl;return S.niv==='pre'?P.cursos.length>0:P.areas.indexOf(real)>=0}
 return false}

/* ---------- secciones -> el acta ---------- */
function aplicaSecciones(sec,soloCambios){
 var ks=Object.keys(sec);
 ['faltantes'].forEach(function(k){if(sec[k])aplicaUna(k,sec[k].datos)});
 ks.forEach(function(k){if(k!=='faltantes')aplicaUna(k,sec[k].datos)});
 S.mat.forEach(function(r){});}
function aplicaUna(k,d){
 if(d==null)return;var t=k.split(':')[0],cl=k.slice(t.length+1);
 if(k==='general'){['ac','dif','prev','txt','tiposRec','sol','reab','prom','pend','pendMan','obs','obsG','convExtra','promObs'].forEach(function(x){if(d[x]!==undefined)S[x]=d[x]});S.sc=S.sc||{};S.sh=S.sh||{};if(d.scAreas)S.sc.areas=d.scAreas;if(d.shAreas)S.sh.areas=d.shAreas;if(d.hAp){hAp=d.hAp;try{$('#hAp').value=hAp;$('#hora').value=hAp}catch(e){}}if(d.fecha){try{$('#fecha').value=d.fecha}catch(e){}}return}
 if(k==='integrantes'){if(d.int)S.int=d.int;return}
 if(k==='presencia'){Object.keys(d.pers||{}).forEach(function(n){if(n!==USR||!PRES[USR])PRES[n]=d.pers[n]});return}
 if(k==='requisitos'){S.pre=d;return}if(k==='firmas'){S.firm=d.firm||{};Object.keys(d.pers||{}).forEach(function(n){PERS[n]=Object.assign(PERS[n]||{},d.pers[n])});return}
 if(k==='listos'){S.listo=d.listo||{};S.jur=d.jur||{};S.revL=d.revL||{};return}
 if(k==='faltantes'){(d.ing||[]).forEach(function(x){var e=EST.filter(function(y){return y.id===x.id})[0];if(e)Object.assign(e,x);else EST.push(x)});
  Object.keys(d.datos||{}).forEach(function(id){var e=EST.filter(function(y){return String(y.id)===String(id)})[0];if(e)Object.assign(e,d.datos[id])});S.cambiosEst=d.cambios||[];
  EST.forEach(function(e){if(!e.baja)delete e.baja});return}
 var g=S.gs.filter(function(c){return kc(c)===cl})[0],gi=S.gs.indexOf(g);
 if(t==='matricula'&&g){S.mat[gi]=d.mat;return}
 if(t==='estudiantes'&&g){['rep','con','com','piar'].forEach(function(c){S[c]=S[c].filter(function(r){var e=est(r.id);return !(e&&e.g===g)}).concat(d[c]||[]);S.sc=S.sc||{};S.sc[c]=S.sc[c]||{};S.sc[c][g]=!!(d.sc&&d.sc[c]);S.sh=S.sh||{};S.sh[c]=S.sh[c]||{};S.sh[c][g]=!!(d.sh&&d.sh[c])});return}
 if(t==='reconocimientos'&&g){S.rec=S.rec.filter(function(r){var e=est(r.id);return !(e&&e.g===g)}).concat(d.rec||[]);OG();S.recOk[g]=d.recOk||'';S.recN[g]=d.recN||0;S.sc=S.sc||{};S.sc.rec=S.sc.rec||{};S.sc.rec[g]=!!d.sc;S.sh=S.sh||{};S.sh.rec=S.sh.rec||{};S.sh.rec[g]=!!d.sh;return}
 if(t==='promocion'&&g){S.promOk=S.promOk||{};S.promOk[g]=!!d.promOk;return}
 if(t==='areas'){if(cl==='propositos'){if(d.pp)S.pp=d.pp;return}S.rp[cl]=S.rp[cl]||S.gs.map(function(){return 0});S.gs.forEach(function(c,i){if(d.rp&&d.rp[kc(c)]!==undefined)S.rp[cl][i]=d.rp[kc(c)]});return}
 if(t==='recomendaciones'){var a=d.clave||cl;S.recs[a]=d.texto||'';S.recSel=S.recSel||{};S.recSel[a]=d.sel||[];return}
}

/* ---------- avisos: quién avanzó en qué componente ---------- */
function nombreSec(k){var t=k.split(':')[0],cl=k.slice(t.length+1),c=Object.keys(CODES).filter(function(x){return CODES[x]===cl})[0]||cl;
 return ({general:'los datos generales',integrantes:'la asistencia y las etiquetas',requisitos:'los requisitos previos',firmas:'las firmas y los datos de contacto',listos:'las declaraciones y la revisión de listados',faltantes:'los datos faltantes de estudiantes',matricula:'la matrícula de '+c,estudiantes:'los casos de estudiantes de '+c,reconocimientos:'los reconocimientos de '+c,promocion:'la promoción de '+c,areas:cl==='propositos'?'los propósitos':'el área «'+cl+'»',recomendaciones:'las recomendaciones de «'+cl+'»'})[t]||k}
function notifica(k,x){var por=(x&&x.por)||'Alguien';if(por===USR)return;var b=$('#notiBox');if(!b){b=document.createElement('div');b.id='notiBox';b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;flex-direction:column;gap:6px;max-width:320px';document.body.appendChild(b)}
 var d=document.createElement('div');d.style.cssText='background:#0f2a5c;color:#fff;border-radius:10px;padding:8px 12px;font:13px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';d.innerHTML='🔔 <b>'+esc(por)+'</b> actualizó '+esc(nombreSec(k));b.appendChild(d);while(b.children.length>5)b.firstChild.parentNode.replaceChildren.apply(b,[].slice.call(b.children,1));setTimeout(function(){if(d.parentNode)d.parentNode.replaceChildren.apply(d.parentNode,[].filter.call(d.parentNode.children,function(y){return y!==d}))},12000);
 try{if(document.hidden&&window.Notification&&Notification.permission==='granted')new Notification('Comisión',{body:por+' actualizó '+nombreSec(k)})}catch(e){}}
/* ---------- dónde está y desde cuándo (llega al seguimiento de los directivos) ---------- */
var LUGARES=['Sala de profesores','Aula de clase','Biblioteca','Sala de sistemas','Coordinación','Rectoría','Laboratorio','Otro lugar (escribirlo)'];
function hoyTxt(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function hhmmReal(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function miRolPres(){if(PERFIL!=='d')return PERFIL==='c'?'Directivo (acompaña)':'Administración';var a=APOYO.filter(function(x){return x[0]===USR&&!x.ap0})[0];if(a&&/orientadora|PTAFI/i.test(a[1]))return a[1]+' (acompaña)';return 'Docente'}
function latido(){if(!ACTA||!S||S.cerrada)return;var m=PRES[USR];if(m&&m.dia===hoyTxt())m.visto=hhmmReal()}
function pidePresencia(){var m=PRES[USR];if(m&&m.dia===hoyTxt()&&m.lugar)return;if($('#mPres'))return;
 var o=document.createElement('div');o.id='mPres';o.style.cssText='position:fixed;inset:0;background:rgba(10,20,45,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:14px';
 o.innerHTML='<div style="background:#fff;border-radius:14px;padding:16px;max-width:420px;width:100%;font:14px Arial,sans-serif"><h3 style="margin:0 0 6px">Antes de empezar</h3><p style="margin:4px 0 10px">Diga <b>dónde está</b> y <b>a qué hora empezó</b> a trabajar en el acta: así coordinación sabe quién está redactando y dónde.</p><label>Lugar del colegio<select id="pLug" style="width:100%;padding:8px">'+LUGARES.map(function(x){return '<option>'+x+'</option>'}).join('')+'</select></label><input id="pLug2" type="text" placeholder="Escriba el lugar (ej. patio, cancha…)" style="width:100%;padding:8px;margin-top:6px;display:none"><label style="display:block;margin-top:8px">Detalle del lugar <small>(opcional: n.º de aula o salón, área…)</small><input id="pDet" type="text" maxlength="40" placeholder="Ej.: aula 5-2, área de Matemáticas" style="width:100%;padding:8px"></label><label style="display:block;margin-top:8px">Hora de inicio<input id="pHora" type="time" value="'+hhmmReal()+'" style="width:100%;padding:8px"></label><div id="pMsg" style="color:#a31515;min-height:18px;margin-top:6px"></div><button class="btn p" id="pOk" style="width:100%;margin-top:6px">Empezar</button></div>';
 document.body.appendChild(o);$('#pLug').onchange=function(){$('#pLug2').style.display=/Otro/.test(this.value)?'':'none'};
 $('#pOk').onclick=function(){var l=$('#pLug').value,x=($('#pLug2').value||'').trim();if(/Otro/.test(l)){if(x.length<3){$('#pMsg').textContent='Escriba el lugar.';return}l=x}PRES[USR]={rol:miRolPres(),lugar:l,detalle:(($('#pDet')||{}).value||'').trim().slice(0,40),desde:$('#pHora').value||hhmmReal(),visto:hhmmReal(),dia:hoyTxt()};o.parentNode.replaceChildren.apply(o.parentNode,[].filter.call(o.parentNode.children,function(y){return y!==o}));pintaRoles();tick()}}
function quienRedacta(){var h=hhmmReal(),mn=function(v){var a=/^(\d\d):(\d\d)$/.exec(v||'');return a?Number(a[1])*60+Number(a[2]):-999},ahora=mn(h);
 return Object.keys(PRES).filter(function(n){var x=PRES[n];return x&&x.dia===hoyTxt()&&ahora-mn(x.visto)<=10&&ahora>=mn(x.visto)}).map(function(n){return '<span class="chip m">'+esc(n)+(PRES[n].rol&&PRES[n].rol!=='Docente'?' ('+esc(PRES[n].rol)+')':'')+' · '+esc(PRES[n].lugar)+(PRES[n].detalle?' ('+esc(PRES[n].detalle)+')':'')+' · desde '+esc(PRES[n].desde)+'</span>'}).join(' ')}
/* ---------- quién es cada persona en el acta ---------- */
function rolesActa(){var r=[],P=perm()||{cursos:[],areas:[]};if(PERFIL!=='d')r.push(PERFIL==='c'?'Coordinación (puede ver y corregir todo)':'Administración');
 if(S.resp===USR)r.push('Responsable del registro y cierre');if(esEditor())r.push('Editor del acta');if(P.cursos.length)r.push('Director/a de grupo de '+P.cursos.join(', '));
 var ar=(P.areas||[]).filter(function(a){return a!=='Convivencia'});if(ar.length)r.push(S.niv==='sec'?'Docente de '+ar.map(ac).join(', '):'Docente de todas las áreas de su grupo');return r}
function pintaRoles(){var e=$('#rolesBar');if(!e){e=document.createElement('div');e.id='rolesBar';var m=document.querySelector('main');m.parentNode.insertBefore(e,m)}
 e.innerHTML='<div class="nota" style="margin:6px 12px"><b>Usted entra como:</b> '+(rolesActa().map(function(x){return '<span class="chip v">'+esc(x)+'</span>'}).join(' ')||'<span class="chip a">solo lectura</span>')+' <small class="g">Solo quien tiene la edición modifica el acta (puede soltarla o pasarla). Cada cambio de otra persona aparece aquí solo, unos segundos después.</small><br><b>Redactando ahora:</b> '+(quienRedacta()||'<small class="g">nadie más</small>')+'</div>'}
/* ---------- atenuar lo que esta persona no puede cambiar (asistencia y etiquetas: solo el responsable) ---------- */
function atenua(){if(!S||!S.gs)return;var ok=puedeGeneral();
 $$('#tInt tr').forEach(function(tr,i){if(i===0)return;var r=S.int[i-1];if(!r)return;[].forEach.call(tr.querySelectorAll('input,select,button'),function(c){var propio=r.n===USR&&(c.type==='email'||c.type==='text'||c.inputMode==='tel');var dis=!ok&&!propio;if(dis!==c.disabled){c.disabled=dis}});tr.style.opacity=ok||r.n===USR?'':'.7'});
 ['#swAc','#obsAc','#difT','#txtDif','#txtEst','#txtCon','#prevTxt','#addI'].forEach(function(id){var c=$(id);if(c)c.disabled=!ok});
 var sr=$('#selResp');if(sr)sr.disabled=false;
 pintaRoles()}
(function(){var _e=etiqueta;etiqueta=function(){_e();try{atenua()}catch(e){}}})();
/* ---------- guardar y refrescar ---------- */
function fusiona(rem,loc,last){ // lo que esta persona cambió se pone sobre lo que ya había en el servidor
 if(loc&&typeof loc==='object'&&!Array.isArray(loc)&&rem&&typeof rem==='object'&&!Array.isArray(rem)){var o=JSON.parse(js(rem));Object.keys(loc).forEach(function(k){if(js(loc[k])!==js((last||{})[k]))o[k]=(typeof loc[k]==='object'&&loc[k]&&!Array.isArray(loc[k]))?fusiona(rem[k],loc[k],(last||{})[k]):loc[k]});return o}
 return loc}
function guardaSec(sec,datos,intento){
 var v=SYNC.ver[sec]||0;
 return API('comisionGuardar',{acta:ACTA.id,seccion:sec,datos:datos,version:v}).then(function(r){
  if(r&&r.conflicto){SYNC.ver[sec]=r.version;
   if((intento||0)<2){var m=fusiona(r.datos,datos,JSON.parse(SYNC.last[sec]||'null'));SYNC.last[sec]=js(r.datos);return guardaSec(sec,m,(intento||0)+1)}
   aplicaUna(sec,r.datos);SYNC.last[sec]=js(r.datos);avisoSync('<b>Otra persona editó «'+esc(sec.split(':').slice(-1)[0])+'» al mismo tiempo.</b> Se cargó su versión: revise y repita su cambio si hace falta.');return 'conf'}
  SYNC.ver[sec]=r.version;if(intento){aplicaUna(sec,datos);SYNC.last[sec]=js(particiona()[sec])}else SYNC.last[sec]=js(datos);return 'ok'})}
function sincResp(){
 if(S.resp===SYNC.resp)return;var nuevo=S.resp||'';
 API('comisionResponsable',{acta:ACTA.id,nombre:nuevo}).then(function(){SYNC.resp=nuevo;pintaTodo()}).catch(function(e){S.resp=SYNC.resp||'';avisoSync('<b>No se pudo cambiar al responsable:</b> '+esc(msgE(e)));pintaTodo()})}
function tick(){
 if(!SYNC.activo||SYNC.busy||!S||!ACTA)return;
 if(S.resp!==SYNC.resp)sincResp();
 var parts=particiona(),cola=[];
 Object.keys(parts).forEach(function(k){var j=js(parts[k]);if(SYNC.last[k]===undefined){SYNC.last[k]=j;return}if(j!==SYNC.last[k]&&puedeEscribir(k))cola.push(k)});
 if(!cola.length)return;
 try{guardaDrafts(cola,parts)}catch(e){}
 SYNC.busy=true;estadoSync('Guardando en el libro…','a');
 var p=Promise.resolve(),hubo=false;
 cola.forEach(function(k){p=p.then(function(){return guardaSec(k,parts[k]).then(function(r){try{borraDraft(k)}catch(e){}if(r==='conf')hubo=true})})});
 p.then(function(){SYNC.busy=false;estadoSync('Guardado en el libro '+ahora(),'v');if(hubo){pintaTodo();pintaPasos();pintaPendientes()}}).catch(function(e){SYNC.busy=false;estadoSync('No se pudo guardar: '+msgE(e),'f');avisoSync('<b>No se pudo guardar en el libro:</b> '+esc(msgE(e))+' (se reintenta solo).')})}
function sondeo(){
 if(!SYNC.activo||SYNC.busy||!ACTA)return;
 var ae=document.activeElement;if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
 API('comisionCambios',{acta:ACTA.id,versiones:SYNC.ver}).then(function(r){
  var ks=Object.keys(r.cambios||{}),loc=particiona(),a=0;
  ks.forEach(function(k){var x=r.cambios[k];if(/^confirm:|^cierre$/.test(k))return;
   if(loc[k]!==undefined&&js(loc[k])!==SYNC.last[k]&&puedeEscribir(k)){SYNC.ver[k]=x.version;return}   // tengo cambios sin guardar aquí: ya se resolverá al guardar
   aplicaUna(k,x.datos);SYNC.ver[k]=x.version;SYNC.last[k]=js(particiona()[k]);a++;notifica(k,x)});
  if(r.estado==='CERRADA'&&!S.cerrada){S.cerrada=true;hCi=r.hora_cierre||hCi;try{$('#hCi').value=hCi}catch(e){}a++}
  if((r.responsable||'')!==(SYNC.resp||'')&&S.resp===SYNC.resp){S.resp=r.responsable||'';SYNC.resp=S.resp;a++}
  if(a){var ee=document.activeElement;if(!(ee&&/^(INPUT|TEXTAREA|SELECT)$/.test(ee.tagName))){pintaTodo();pintaPasos();pintaPendientes();try{etiqueta()}catch(e){}}}
 SYNC.fallos=0;if(SYNC.avisoCon){SYNC.avisoCon=false;estadoSync('Conectado con el libro '+ahora(),'v')}
 }).catch(function(e){SYNC.fallos=(SYNC.fallos||0)+1;if(SYNC.fallos>=3){SYNC.avisoCon=true;estadoSync('Sin conexión con el libro: '+msgE(e)+' (reintentando)','f')}})}

/* ---------- abrir el acta ---------- */
function abreActa(){
 var label=$('#grado').value,per=$('#periodo').value,code=LABEL_DE[label];if(!code||!per)return;
 SYNC.activo=false;clearInterval(SYNC.t1);clearInterval(SYNC.t2);clearInterval(SYNC.t3);SYNC.ver={};SYNC.last={};avisoSync('');estadoSync('Cargando el acta…','a');
 var SNAP=false;
 API('comisionGradoDatos',{grado:code}).then(function(d){return API('comisionAbrir',{periodo:per,grado:code}).then(function(r){try{guardaSnap(code,per,d,r)}catch(e){}return [d,r]})})
 .catch(function(e){var sn=leeSnap(code,per);if(sn){SNAP=true;return [sn.d,sn.r]}throw e})
 .then(function(dr){var r=dr[1];construyeGrado(dr[0]);
  ACTA=r.acta;init(GK=Object.keys(G)[0]);$('#grado').value=GK;$('#periodo').value=per;$('#acta').value=ACTA.acta_no;
  Object.keys(r.secciones).forEach(function(k){SYNC.ver[k]=r.secciones[k].version});
  aplicaSecciones(r.secciones);S.resp=ACTA.responsable||'';SYNC.resp=S.resp;
  if(!S.resp&&PERFIL==='d'){var q=S.int.filter(function(x){return x.n===USR})[0];if(q)q.p=true;S.resp=USR}
  if(ACTA.estado==='CERRADA'){S.cerrada=true;hCi=ACTA.hora_cierre||'';try{$('#hCi').value=hCi}catch(e){}}
  var parts=particiona();SYNC.last={};Object.keys(parts).forEach(function(k){SYNC.last[k]=js(parts[k])});
  try{restauraDrafts(r.secciones)}catch(e){}
  try{ofreceBorrador()}catch(e){}
  vista(false);setPerfil(PERFIL);pintaTodo();pintaPasos();pintaPendientes();try{etiqueta()}catch(e){}
  try{vuelveAPos()}catch(e){}
  SYNC.activo=true;pidePresencia();SYNC.t3=setInterval(latido,120000);SYNC.t1=setInterval(tick,2000);SYNC.t2=setInterval(sondeo,5000);estadoSync('Acta abierta '+ahora(),'v');
  if(CERRADO_SRV)avisoSync('Esta acta está cerrada: es de solo lectura.');
  if(SNAP){avisoSync('<b>Sin conexión con el libro.</b> Está trabajando con la última copia guardada en este equipo; lo que escriba se enviará solo cuando vuelva la conexión.');estadoSync('Sin conexión · copia local','f')}
 }).catch(function(e){estadoSync('Error','f');alert('No se pudo abrir el acta: '+msgE(e))})}

/* ---------- cierre: la pantalla verifica; el servidor pone la hora ---------- */
(function(){var _c=cierraActa;cierraActa=function(){_c();if(!S||!S.cerrada||!ACTA)return;
 API('comisionCierreSimple',{acta:ACTA.id}).then(function(r){hCi=r.hora_cierre||hCi;try{$('#hCi').value=hCi}catch(e){}S.cerrada=true;pintaTodo();pintaPendientes();estadoSync('Acta cerrada '+hCi,'v');setTimeout(function(){try{irTab('p3');window.scrollTo(0,0)}catch(e){}},400)})
  .catch(function(e){alert('El acta se cerró en esta pantalla, pero no se pudo registrar el cierre en el libro ('+msgE(e)+'). Genere el PDF igual y avise a coordinación.')})}})();

/* varias personas trabajan a la vez: cada quien puede ir al paso que le toca; lo pendiente solo bloquea el CIERRE */
valida=function(){return []};
/* ---------- arranque ---------- */
pintaGrados=function(){var el=$('#grado');if(!el)return;el.innerHTML='<option value="">— Elija el grado —</option>'+GRADOS_REAL.map(function(l){return '<option'+(l===GK?' selected':'')+'>'+esc(l)+'</option>'}).join('');pintaPerm()};
gradosPermitidos=function(){return GRADOS_REAL};
function REAL_BOOT(){
 document.body.classList.add('jsok');
 if(!tokenGuardado()){irAlMenu();return}
 API('comisionContexto').then(function(c){
  CTXR=c;USR=c.quien.nombre;if(c.bloqueado)setTimeout(function(){alert(c.bloqueado)},400);if((c.version||'')!=='__CLIENTVER__'){setTimeout(function(){var d=document.createElement('div');d.className='mal';d.style.cssText='margin:8px 12px;padding:10px;border-radius:10px;background:#fdeaea;border:2px solid #c0392b;color:#7a1c12;font:14px Arial,sans-serif';d.innerHTML='<b>Versiones distintas.</b> Esta pantalla es la versión __CLIENTVER__ y el servidor responde la versión '+(c.version||'anterior')+'. Por eso algunos controles no guardan o no actualizan. En Apps Script: pegue el código completo (ICET_completo.gs) y use Implementar → Administrar implementaciones → editar → Nueva versión.';var b=document.querySelector('header.top');if(b&&b.parentNode)b.parentNode.insertBefore(d,b.nextSibling)},600)}try{$('#quienSes').textContent=USR+' · pantalla __CLIENTVER__ · servidor '+(c.version||'anterior')}catch(e){}PERFIL=c.quien.rol==='docente'?'d':'c';
  GRADOS_REAL=c.grados.map(function(code){return COM_LABEL[code]}).filter(Boolean);LABEL_DE={};c.grados.forEach(function(code){LABEL_DE[COM_LABEL[code]]=code});
  var bh=$('#btnHist');if(bh&&(c.quien.rol!=='docente'||c.quien.total))bh.style.display='';var be=$('#btnEj');if(be&&c.quien.dev)be.style.display='';var p=$('#perfil');if(p){p.value=PERFIL;if(!c.quien.dev){var pf=document.querySelector('.perf');if(pf)pf.style.display='none'}}
  $('#grado').onchange=abreActa;$('#periodo').onchange=abreActa;
  pintaGrados();try{setPerfil(PERFIL)}catch(e){}
  var pos0=leePos();if(pos0&&pos0.grado&&GRADOS_REAL.indexOf(pos0.grado)>=0&&pos0.periodo){$('#grado').value=pos0.grado;$('#periodo').value=pos0.periodo;POS_PEND=pos0;abreActa()}
  else if(GRADOS_REAL.length===1){$('#grado').value=GRADOS_REAL[0];abreActa()}
  else estadoSync('Elija el grado y el periodo','m');
  document.body.classList.add('jsok');try{irTab('p1')}catch(e){}
 }).catch(function(e){document.body.insertAdjacentHTML('afterbegin','<div style="background:#fdeaea;border:2px solid #c0392b;color:#7a1c12;padding:12px;font:14px Arial">No se pudo abrir las comisiones: '+esc(msgE(e))+' <a href="javascript:irAlMenu()">Volver al menú</a></div>')})}
var COM_LABEL={'00':'0° Preescolar','01':'1° Primaria','02':'2° Primaria','03':'3° Primaria','04':'4° Primaria','05':'5° Primaria','06':'6° Secundaria','CS1':'CS 1 (Caminar en Secundaria 1, 6°-7°)','07':'7° Secundaria','08':'8° Secundaria','09':'9° Secundaria','CS2':'CS 2 (Caminar en Secundaria 2, 8°-9°)','10':'10° Media','11':'11° Media'};
REAL_BOOT();

/* ---------- fecha y hora con control (calendario y reloj) ---------- */
function syncPick(){var f=$('#fecha'),fp=$('#fechaP'),hp=$('#horaP'),ha=$('#hApP');if(!f||!fp)return;try{pintaTurno();aplicaLectura()}catch(e){}
 if(!/^\d\d\/\d\d\/\d{4}$/.test(f.value||'')){var d=new Date();f.value=('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear()}
 if(!/^\d\d:\d\d$/.test(hAp||'')){hAp=hhmmReal();try{$('#hora').value=hAp;$('#hAp').value=hAp}catch(e){}}
 var m=/^(\d\d)\/(\d\d)\/(\d{4})$/.exec(f.value||'');var iso=m?m[3]+'-'+m[2]+'-'+m[1]:'';
 if(document.activeElement!==fp&&fp.value!==iso)fp.value=iso;
 if(hp&&document.activeElement!==hp&&hp.value!==(hAp||''))hp.value=hAp||'';
 if(ha&&document.activeElement!==ha&&ha.value!==(hAp||''))ha.value=hAp||'';
 var ok=false;try{ok=puedeEscribir('general')}catch(e){}
 [fp,hp,ha].forEach(function(x){if(x){x.disabled=!ok||!!S.cerrada}})}
function eligeFecha(v){var m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(v||'');if(m)$('#fecha').value=m[3]+'/'+m[2]+'/'+m[1]}
function eligeHora(v){if(!/^\d\d:\d\d$/.test(v||''))return;hAp=v;$('#hora').value=v;$('#hAp').value=v;var a=$('#hApP'),b=$('#horaP');if(a)a.value=v;if(b)b.value=v}
document.addEventListener('change',function(e){var t=e.target||{};if(t.id==='fechaP')eligeFecha(t.value);else if(t.id==='horaP'||t.id==='hApP')eligeHora(t.value)});
/* acceso total para todo el personal (decisión del coordinador): nada se atenúa por rol */
perm=function(){return null};

/* ---------- modo desarrollador: ejemplo completo sobre el grado abierto (NO se guarda en el libro) ---------- */
function modoEjemplo(){if(!ACTA||!S){alert('Abra primero un grado y un periodo.');return}
 if(!confirm('Modo ejemplo: se llena el acta con datos de prueba SOLO en esta pantalla. Nada se guarda en el libro. Para volver a los datos reales use «Volver a los datos reales». ¿Continuar?'))return;
 SYNC.activo=false;clearInterval(SYNC.t1);clearInterval(SYNC.t2);clearInterval(SYNC.t3);
 try{ejemploCompleto()}catch(e){alert('No se pudo cargar el ejemplo: '+e.message)}
 try{pintaTodo();pintaPasos();pintaPendientes();etiqueta()}catch(e){}
 estadoSync('MODO EJEMPLO · nada se guarda en el libro','a');avisoSync('<b>Modo ejemplo (desarrollador).</b> Los datos son de prueba y no se guardan. <button class="btn s" onclick="abreActa()">Volver a los datos reales</button>')}

/* ---------- volver al menú y cerrar sesión ---------- */
function volverMenu(){if(S&&SYNC.activo){try{if(typeof tick==='function')tick()}catch(e){}}irAlMenu()}
function salirSesion(){var pend=hayDrafts();if(!confirm(pend?'Hay cambios que todavía NO llegaron al libro (sin conexión). Si cierra la sesión se perderán. ¿Cerrar de todos modos?':'¿Cerrar la sesión? Lo que ya se guardó en el acta queda en el libro.'))return;limpiaLocal();
 SYNC.activo=false;clearInterval(SYNC.t1);clearInterval(SYNC.t2);clearInterval(SYNC.t3);
 var t=tokenGuardado();borrarToken();
 try{google.script.run.withSuccessHandler(irAlMenu).withFailureHandler(irAlMenu).cerrarSesion(t)}catch(e){irAlMenu()}}

/* ---------- turno de edición: todos pueden editar, pero una sola persona a la vez ---------- */
function sinEdicion(){return !esTotal()&&!!(CTXR&&CTXR.quien&&CTXR.quien.editar===false&&PERFIL==='d')}
function esTotal(){return !!(CTXR&&CTXR.quien&&CTXR.quien.total)}
function turnoLibre(){return esTotal()||!sinEdicion()&&(!S||!S.resp||S.resp===USR||PERFIL!=='d')}
function minDe(v){var a=/^(\d\d):(\d\d)$/.exec(v||'');return a?Number(a[1])*60+Number(a[2]):-9999}
function editorActivo(){var x=PRES[S.resp];return !!(x&&x.dia===hoyTxt()&&minDe(hhmmReal())-minDe(x.visto)>=0&&minDe(hhmmReal())-minDe(x.visto)<=15)}
function tomarTurno(){if(!S||S.cerrada||sinEdicion())return;S.resp=USR;pintaTurno();aplicaLectura();tick()}
function soltarTurno(){if(!S)return;S.resp='';pintaTurno();aplicaLectura();tick()}
function pasarTurno(n){if(!n)return;S.resp=n;pintaTurno();aplicaLectura();tick()}
var TURNO_HTML='';
function pintaTurno(){var el=$('#turno');if(!el||!S||!ACTA)return;var h;
 if(S.cerrada){h='<div class="nota" style="margin:0"><b>Acta cerrada:</b> solo lectura.</div>'}
 else if(esTotal()&&S.resp!==USR){h='<div class="ojo" style="margin:0"><b>Usted tiene control total</b> (otorgado por coordinación): edita siempre'+(S.resp?'; la edición del registro la tiene '+esc(S.resp):'')+'. <button class="btn s" onclick="tomarTurno()">Quedarme con la edición</button></div>'}
 else if(sinEdicion()){h='<div class="mal" style="margin:0"><b>Solo lectura:</b> la coordinación no habilitó la edición de las actas para su nivel. Puede consultar, declarar, firmar y completar datos faltantes.</div>'}
 else if(S.resp===USR){h='<div class="bien" style="margin:0"><b>Usted tiene la edición.</b> Solo usted modifica el acta ahora (las demás personas la ven y pueden firmar, declarar y completar datos faltantes). <button class="btn s" onclick="soltarTurno()">Soltar la edición</button> <select id="selPasar" onchange="pasarTurno(this.value)"><option value="">Pasar la edición a…</option>'+DOCS.filter(function(n){return n!==USR}).map(function(n){return '<option>'+esc(n)+'</option>'}).join('')+'</select></div>'}
 else if(!S.resp){h='<div class="ojo" style="margin:0"><b>Nadie tiene la edición.</b> <button class="btn s p" onclick="tomarTurno()">Tomar la edición</button></div>'}
 else if(PERFIL!=='d'){h='<div class="ojo" style="margin:0"><b>Usted tiene acceso total</b> (coordinación). La edición del registro la tiene '+esc(S.resp)+'; puede trabajar igualmente. <button class="btn s" onclick="tomarTurno()">Quedarme con la edición</button></div>'}
 else{var act=editorActivo();h='<div class="mal" style="margin:0"><b>Solo lectura:</b> '+esc(S.resp)+' tiene la edición ahora (una sola persona a la vez). Usted puede declarar, firmar y completar datos faltantes. '+(act?'<button class="btn s" disabled title="Disponible si '+esc(S.resp)+' la suelta o lleva 15 minutos sin actividad">Tomar la edición</button><small class="g"> disponible cuando la suelte o pasen 15 min sin actividad</small>':'<button class="btn s p" onclick="tomarTurno()">Tomar la edición</button> <small class="g">(sin actividad reciente)</small>')+'</div>'}
 if(h!==TURNO_HTML){TURNO_HTML=h;el.innerHTML=h}}
function aplicaLectura(){var on=!!(S&&ACTA&&!S.cerrada&&!turnoLibre());document.body.classList.toggle('lectura',on)}

/* ---------- listados: todos los docentes del grado revisan; retirar y modificar por estudiante ---------- */
revLista=function(){return S.int.filter(function(x){return (window.DOCGRADO&&DOCGRADO[x.n])||(x.p&&!esApoyoOb(x))})};
function setRevDe(i,v){var x=revLista()[i];if(!x||S.cerrada)return;S.revL=S.revL||{};if(v)S.revL[x.n]=ahora();else delete S.revL[x.n];pintaLis();pintaPasos();pintaPendientes()}
function retirarUno(id){var e=est(id);if(!e)return;var bl=ingBloq(e.g);if(bl){alert(bl);return}abrirIng(e.g,'r');setTimeout(function(){var q=$('#rm'+id);if(q){try{q.scrollIntoView({block:'center'})}catch(x){}q.focus()}},60)}
function modEst(id){var e=est(id);if(!e||$('#mMod'))return;var bl=ingBloq(e.g);
 var o=document.createElement('div');o.id='mMod';o.style.cssText='position:fixed;inset:0;background:rgba(10,20,45,.55);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto';
 var sel=function(idn,lista,v){return '<select id="'+idn+'" style="width:100%;padding:8px"><option value="">(sin dato)</option>'+lista.map(function(x){return '<option'+(x===v?' selected':'')+'>'+x+'</option>'}).join('')+'</select>'};
 var inp=function(idn,l,v){return '<label>'+l+'<input type="text" id="'+idn+'" value="'+esc(v||'')+'" style="width:100%;padding:8px"></label>'};
 o.innerHTML='<div style="background:#fff;border-radius:14px;padding:16px;max-width:520px;width:100%;font:14px Arial,sans-serif"><h3 style="margin:0 0 8px">Modificar estudiante · '+esc(e.g)+'</h3><div class="ojo">Corrija solo con datos verdaderos. Queda registrado quién lo hizo.</div>'+(bl?'<div class="nota">La matrícula de este curso es oficial: los nombres no se cambian aquí; sí puede completar los demás datos.</div>':'')+inp('mA','Apellidos',e.a)+inp('mN','Nombres',e.n)+'<label>Tipo de documento'+sel('mT',['RC','TI','CC','CE','PEP','PPT','NUIP','Otro'],e.tdoc)+'</label>'+inp('mD','Número de documento',e.ndoc)+inp('mL','Lugar de expedición',e.lex)+'<label>Sexo<select id="mS" style="width:100%;padding:8px"><option value="">(sin dato)</option><option value="M"'+(e.sx==='M'?' selected':'')+'>Masculino</option><option value="F"'+(e.sx==='F'?' selected':'')+'>Femenino</option></select></label><label>Nacionalidad o procedencia<select id="mNa" style="width:100%;padding:8px">'+['Colombiana','Venezolana','Ecuatoriana','Otra'].map(function(x){return '<option'+(x===(e.nac||'Colombiana')?' selected':'')+'>'+x+'</option>'}).join('')+'</select></label>'+inp('mAc','Nombre del acudiente',e.acu)+inp('mTe','Teléfono del acudiente',e.tel)+'<div id="mMsg" style="color:#a31515;min-height:18px;margin-top:6px"></div><div class="row"><button class="btn p" id="mOk">Guardar cambios</button><button class="btn" id="mNo">Cancelar</button></div></div>';
 document.body.appendChild(o);if(bl){$('#mA').readOnly=true;$('#mN').readOnly=true}
 $('#mNo').onclick=function(){o.remove()};
 $('#mOk').onclick=function(){var a=bl?e.a:$('#mA').value.trim(),n=bl?e.n:$('#mN').value.trim();if(!a||!n){$('#mMsg').textContent='Escriba apellidos y nombres.';return}
  var d=$('#mD').value.replace(/\D/g,'');if($('#mD').value.trim()&&d.length<5){$('#mMsg').textContent='El número de documento no parece válido.';return}
  var otro=EST.filter(function(y){return y.id!==e.id&&!y.baja&&d&&String(y.ndoc||'').replace(/\D/g,'')===d})[0];if(otro){$('#mMsg').textContent='Ese documento ya lo tiene '+nom(otro)+' ('+otro.g+').';return}
  e.a=a;e.n=n;e.tdoc=$('#mT').value;e.ndoc=d;e.lex=$('#mL').value.trim();e.sx=$('#mS').value;e.nac=$('#mNa').value;e.acu=$('#mAc').value.trim();e.tel=$('#mTe').value.trim();
  var f=(e.falta||[]).filter(function(x){return !((x==='Tipo y número de documento'&&e.tdoc&&e.ndoc)||(x==='Lugar de expedición'&&e.lex)||(x==='Sexo'&&e.sx)||(x==='Teléfono del acudiente'&&e.tel))});
  e.falta=f;e.doc=(!f.length)?'ok':'falta';e.mod=1;
  S.cambiosEst=S.cambiosEst||[];S.cambiosEst.push({tipo:'MODIFICAR',id:e.id,g:e.g,nombre:nom(e),por:USR||'(sin elegir)',t:ahora()});
  o.remove();pintaLis();try{pintaFaltTodo()}catch(x){}try{pintaListas()}catch(x){}pintaPasos();pintaPendientes()}}
/* quien firma (confirma su parte del cierre) declara que no redactará más: su edición se bloquea */
var _tl_firma=turnoLibre;turnoLibre=function(){if(!esTotal()&&S&&S.cierreProp&&S.cierreProp.conf&&S.cierreProp.conf[USR])return false;return _tl_firma()};

/* aviso de diagnóstico: de dónde salen el tipo y el número de documento */
var _pl_diag=pintaLis;pintaLis=function(){_pl_diag();var el=$('#lisBox'),d=DIAGDOC;if(!el||!d)return;
 var ok=d.colDoc&&d.colTipo&&d.conDoc>0,h='<div class="'+(ok?'bien':'mal')+'" style="margin:6px 0"><b>Documentos desde la hoja «Estudiantes»:</b> columna «documento» '+(d.colDoc?'✓':'✗ no encontrada')+' · columna «tipo_doc» '+(d.colTipo?'✓':'✗ no encontrada')+' · '+d.conDoc+' de '+d.total+' estudiantes con número de documento.'+(ok?'':' Revise que los encabezados estén en la fila 1 de esa hoja (documento y tipo_doc, justo después de «nombres») y que haya publicado la versión '+(d.version||'')+' del código.')+'</div>';
 el.insertAdjacentHTML('afterbegin',h)};

function setJurDe(i,v){var x=revLista()[i];if(!x||S.cerrada)return;S.jur=S.jur||{};if(v)S.jur[x.n]=ahora();else delete S.jur[x.n];pintaPre();pintaPasos();try{aplicaJuramento()}catch(e){}pintaPendientes()}

/* ---------- respaldo local: si se pierde la conexión o se recarga, no se pierde lo escrito y se vuelve al último paso ---------- */
var POS_PEND=null;
function dKey(){return 'icet_com_d:'+USR+':'+(ACTA&&ACTA.id)}
function dLee(){try{return JSON.parse(localStorage.getItem(dKey())||'{}')||{}}catch(e){return {}}}
function dEsc(o){try{if(Object.keys(o).length)localStorage.setItem(dKey(),JSON.stringify(o));else localStorage.removeItem(dKey())}catch(e){}}
function guardaDrafts(secs,parts){var d=dLee();secs.forEach(function(k){d[k]={ver:SYNC.ver[k]||0,base:SYNC.last[k]||'null',data:parts[k],t:Date.now()}});dEsc(d)}
function borraDraft(k){var d=dLee();if(d[k]){delete d[k];dEsc(d)}}
function hayDrafts(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('icet_com_d:'+USR+':')===0&&Object.keys(JSON.parse(localStorage.getItem(k)||'{}')).length)return true}}catch(e){}return false}
function limpiaLocal(){try{var L=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('icet_com_')===0)L.push(k)}L.forEach(function(k){localStorage.removeItem(k)})}catch(e){}}
function restauraDrafts(secciones){var d=dLee(),n=0;Object.keys(d).forEach(function(k){var x=d[k],srv=secciones&&secciones[k];if(!x||x.data===undefined)return;
  var datos=x.data;if(srv&&srv.version!==x.ver){try{datos=fusiona(srv.datos,x.data,JSON.parse(x.base||'null'))}catch(e){datos=x.data}}
  try{aplicaUna(k,datos);n++}catch(e){}});
 if(n)avisoSync('<b>Se recuperaron cambios que no se habían guardado</b> (se perdió la conexión o se recargó la página). Se enviarán al libro en unos segundos.')}
function posKey(){return 'icet_com_pos:'+USR}
function leePos(){try{return JSON.parse(localStorage.getItem(posKey())||'null')}catch(e){return null}}
function guardaPos(){try{if(!ACTA||!S)return;localStorage.setItem(posKey(),JSON.stringify({grado:$('#grado').value,periodo:$('#periodo').value,tab:PANE,paso:paso,y:Math.round(window.scrollY||0)}))}catch(e){}}
function vuelveAPos(){var p=POS_PEND;POS_PEND=null;if(!p)return;if(p.tab&&p.tab!=='p1')irTab(p.tab);else if(typeof p.paso==='number')ir(p.paso);setTimeout(function(){try{window.scrollTo(0,p.y||0)}catch(e){}},200)}
var _irTab_c=irTab;irTab=function(){var r=_irTab_c.apply(this,arguments);try{guardaPos()}catch(e){}return r};
var _ir_c=ir;ir=function(){var r=_ir_c.apply(this,arguments);try{guardaPos()}catch(e){}return r};
window.addEventListener('beforeunload',function(){try{guardaPos();if(SYNC.activo&&S&&ACTA){var parts=particiona(),cola=[];Object.keys(parts).forEach(function(k){if(SYNC.last[k]!==undefined&&js(parts[k])!==SYNC.last[k]&&puedeEscribir(k))cola.push(k)});if(cola.length)guardaDrafts(cola,parts)}}catch(e){}});

/* ---------- historial: volver a una versión anterior del acta o deshacer un cambio en las hojas ---------- */
function abrirHistorial(){if(!ACTA)return;API('comisionHistorial',{acta:ACTA.id}).then(pintaHistorial).catch(function(e){alert(msgE(e))})}
function pintaHistorial(r){var o=$('#mHist');if(o)o.remove();o=document.createElement('div');o.id='mHist';o.style.cssText='position:fixed;inset:0;background:rgba(10,20,45,.55);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto';
 var sec=(r.secciones||[]).map(function(x){return '<tr><td>'+esc(x.fecha)+'</td><td>'+esc(String(x.seccion).replace(':',' · '))+'</td><td>'+esc(x.por||'')+'</td><td><button class="btn s" onclick="restauraSec('+x.fila+',\''+esc(x.fecha)+'\')">Restaurar</button></td></tr>'}).join('')||'<tr><td colspan="4"><small class="g">Aún no hay versiones anteriores.</small></td></tr>';
 var hoj=(r.hojas||[]).map(function(x){return '<tr><td>'+esc(x.fecha)+'</td><td>'+esc(x.hoja)+' · '+esc(x.columna)+'</td><td>'+esc(x.anterior||'(vacío)')+' → <b>'+esc(x.nuevo)+'</b></td><td>'+esc(x.por||'')+'</td><td>'+(r.puedeDeshacerHojas?'<button class="btn s" onclick="deshaceHoja(\''+esc(x.id)+'\')">Deshacer</button>':'')+'</td></tr>'}).join('')||'<tr><td colspan="5"><small class="g">Sin cambios en las hojas.</small></td></tr>';
 o.innerHTML='<div style="background:#fff;border-radius:14px;padding:16px;max-width:900px;width:100%;font:14px Arial,sans-serif"><h3 style="margin:0 0 6px">Historial y recuperación</h3><div class="ojo">Se conservan <b>'+(r.dias||8)+' días</b>. Restaurar vuelve una parte del acta a como estaba en esa fecha (la versión actual pasa también al historial, así que se puede volver atrás). Las copias completas del libro se hacen cada noche.</div><h4>Versiones anteriores del acta</h4><div class="tw" style="max-height:34vh;overflow:auto"><table class="plain"><tr><th>Fecha</th><th>Parte del acta</th><th>Hecha por</th><th></th></tr>'+sec+'</table></div><h4>Cambios hechos en las hojas del libro</h4><div class="tw" style="max-height:30vh;overflow:auto"><table class="plain"><tr><th>Fecha</th><th>Dato</th><th>Cambio</th><th>Por</th><th></th></tr>'+hoj+'</table></div><div class="row" style="margin-top:8px"><button class="btn" id="hCierra">Cerrar</button></div></div>';
 document.body.appendChild(o);$('#hCierra').onclick=function(){o.remove()}}
function restauraSec(fila,fecha){if(!confirm('¿Volver esta parte del acta a como estaba el '+fecha+'? Los cambios posteriores de esa parte se reemplazan (quedan en el historial).'))return;
 API('comisionRestaurar',{acta:ACTA.id,fila:fila,fecha:fecha}).then(function(){var o=$('#mHist');if(o)o.remove();alert('Restaurado. Se recarga el acta.');abreActa()}).catch(function(e){alert(msgE(e))})}
function deshaceHoja(id){if(!confirm('¿Devolver ese dato de la hoja a su valor anterior?'))return;
 API('comisionHojaDeshacer',{id:id}).then(function(){abrirHistorial()}).catch(function(e){alert(msgE(e))})}

/* ---------- copia local del acta abierta (para poder seguir si no hay conexión) ---------- */
function snapKey(code,per){return 'icet_com_snap:'+USR+':'+code+':'+per}
function guardaSnap(code,per,d,r){try{localStorage.setItem(snapKey(code,per),JSON.stringify({t:Date.now(),d:d,r:r}))}catch(e){}}
function leeSnap(code,per){try{return JSON.parse(localStorage.getItem(snapKey(code,per))||'null')}catch(e){return null}}
/* el sondeo refresca la copia local con lo último del libro */
var _sond_snap=sondeo;sondeo=function(){_sond_snap();try{if(ACTA&&S&&SYNC.activo&&!SYNC.busy){var code=LABEL_DE[$('#grado').value],per=$('#periodo').value,sn=leeSnap(code,per);if(sn&&Date.now()-sn.t>60000){API('comisionCargar',{acta:ACTA.id}).then(function(r){var s2=leeSnap(code,per);if(s2){s2.r=r;s2.t=Date.now();localStorage.setItem(snapKey(code,per),JSON.stringify(s2))}}).catch(function(){})}}}catch(e){}};
/* ---------- borrador: guarda ya en el libro y en este equipo, y recuerda dónde estaba ---------- */
guardaBorrador=function(manual){try{guardaBorEsp();guardaPos();if(SYNC.activo&&S&&ACTA){var parts=particiona(),cola=[];Object.keys(parts).forEach(function(k){if(SYNC.last[k]!==undefined&&js(parts[k])!==SYNC.last[k]&&puedeEscribir(k))cola.push(k)});if(cola.length)guardaDrafts(cola,parts);try{tick()}catch(e){}}
  estadoGuard('Borrador guardado '+ahora(),'v');if(manual)$('#finMsg').innerHTML='<div class="bien">Borrador guardado a las '+ahora()+': ya está en el libro (si hay conexión) y en este equipo. Si se cierra la pantalla, se pierde la conexión o se actualiza la aplicación, al volver entrará <b>donde estaba</b>, con lo que escribió.</div>'}catch(e){estadoGuard('No se pudo guardar el borrador','f')}};
avisoBorrador=function(){};
/* ---------- matrícula: hombres + mujeres = total actual (si sube una casilla, baja la otra); por defecto todos hombres, o lo que traen las hojas ---------- */
function faltaSinTel(e){return (e.falta||[]).filter(function(x){return x!=='Teléfono del acudiente'})}
function matInvariante(){if(!S||!S.mat)return;S.mat.forEach(function(r,i){if(r.ok)return;var t=tot(r);
  if(!r.sxSet&&!r.m){var L=EST.filter(function(e){return e.g===r.g&&!e.baja});if(L.length&&L.every(function(e){return e.sx==='M'||e.sx==='F'}))r.m=Math.min(t,L.filter(function(e){return e.sx==='M'}).length)}
  r.m=Math.max(0,Math.min(+r.m||0,t));r.f=Math.max(0,t-r.m)})}
function matSet(i,k,v){var r=S.mat[i];if(!r)return;v=Math.max(0,+v||0);r.ok=false;
 if(k==='m'){r.sxSet=true;var t=tot(r);r.m=Math.min(v,t);r.f=t-r.m}
 else if(k==='f'){r.sxSet=true;var t2=tot(r);r.f=Math.min(v,t2);r.m=t2-r.f}
 else r[k]=v;
 pintaMat()}
numI=function(i,k,bad){return '<input type="number" min="0" class="'+(bad[k]?'bad':'')+'" value="'+S.mat[i][k]+'" '+(S.mat[i].ok?'disabled ':'')+'onchange="matSet('+i+',\''+k+'\',this.value)">'};
var _pm_inv=pintaMat;pintaMat=function(){matInvariante();_pm_inv()};

/* ---------- «Guardar borrador»: copia de TODO su avance; al volver se ofrece «Recuperar borrador» ---------- */
function borKey(){return 'icet_com_bor:'+USR+':'+(ACTA&&ACTA.id)}
function guardaBorEsp(){if(!ACTA||!S)return;var parts=particiona(),o={t:Date.now(),parts:{},base:{}};Object.keys(parts).forEach(function(k){if(puedeEscribir(k)){o.parts[k]=parts[k];o.base[k]=SYNC.last[k]||'null'}});try{localStorage.setItem(borKey(),JSON.stringify(o))}catch(e){}}
function leeBor(){try{return JSON.parse(localStorage.getItem(borKey())||'null')}catch(e){return null}}
function ofreceBorrador(){var b=leeBor();if(!b)return;var parts=particiona(),dif=Object.keys(b.parts).filter(function(k){return js(parts[k])!==js(b.parts[k])});if(!dif.length)return;
 var h=new Date(b.t),hh=('0'+h.getHours()).slice(-2)+':'+('0'+h.getMinutes()).slice(-2);
 var el=$('#avisoBorr');if(!el)return;el.innerHTML='<div class="ojo" style="margin:0;border-radius:0"><b>Hay un borrador guardado a las '+hh+'</b> con '+dif.length+' parte'+(dif.length===1?'':'s')+' distinta'+(dif.length===1?'':'s')+' de lo que hay ahora. <button class="btn s p" onclick="recuperaBor()">Recuperar borrador</button> <button class="btn s" onclick="descartaBor()">Descartar</button></div>'}
function recuperaBor(){var b=leeBor();if(!b)return;var n=0;Object.keys(b.parts).forEach(function(k){if(!puedeEscribir(k))return;var act=particiona()[k],base=null;try{base=JSON.parse(b.base[k]||'null')}catch(e){}
  var m;try{m=fusiona(act,b.parts[k],base)}catch(e){m=b.parts[k]}if(js(m)!==js(act)){aplicaUna(k,m);n++}});
 pintaTodo();pintaPasos();pintaPendientes();try{etiqueta()}catch(e){}avisoSync(n?'<b>Borrador recuperado</b> ('+n+' parte'+(n===1?'':'s')+'). Se envía al libro en unos segundos.':'El borrador ya estaba al día.')}
function descartaBor(){try{localStorage.removeItem(borKey())}catch(e){}avisoSync('')}

var _pe_pend=pintaEquipo;pintaEquipo=function(){_pe_pend();try{if($('#pendBox'))pintaPendientes()}catch(e){}};
var _pc_pend=pintaCierreProp;pintaCierreProp=function(){_pc_pend();try{if($('#pendBox'))pintaPendientes()}catch(e){}};
