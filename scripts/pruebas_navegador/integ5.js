// Prueba de integración: la pantalla REAL (Comisiones.html) hablando con el código REAL del servidor (ICET_completo.gs) con varios usuarios a la vez.
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const {chromium}=require('playwright');
const R='/home/user/imagenes/apps_script/';
const H=JSON.parse(fs.readFileSync(R+'pruebas/hojas.json','utf8'));
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r.map(x=>typeof x==='string'?(x[0]==="'"?x.slice(1):/^\d+$/.test(x)?Number(x):x):x))}
  getName(){return this.nombre||''}
  getLastColumn(){return Math.max(0,...this.v.map(r=>r.length))}
  getRange(r,c,nr,nc){const s=this;return {getValue(){return ((s.v[r-1]||[])[c-1])===undefined?'':(s.v[r-1]||[])[c-1]},getValues(){const o=[];for(let i=0;i<(nr||1);i++){const row=[];for(let j=0;j<(nc||1);j++){const x=(s.v[r-1+i]||[])[c-1+j];row.push(x===undefined?'':x)}o.push(row)}return o},setValue(x){while(s.v.length<r)s.v.push([]);while(s.v[r-1].length<c)s.v[r-1].push('');s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>{while(s.v.length<r+i)s.v.push([]);row.forEach((x,j)=>{while(s.v[r-1+i].length<c+j)s.v[r-1+i].push('');s.v[r-1+i][c-1+j]=x})})},getValue(){return (s.v[r-1]||[])[c-1]},getValues(){const o=[];for(let i=0;i<(nr||1);i++){o.push([]);for(let j=0;j<(nc||1);j++)o[i].push((s.v[r-1+i]||[])[c-1+j])}return o}}}
  deleteRow(r){this.v.splice(r-1,1)}}
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`;if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]);
  const h=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d);if(p==='HH:mm')return h;if(p==='yyyy-MM-dd HH:mm')return `${o.year}-${o.month}-${o.day} ${h}`;return String(d)};
const hojas={};Object.keys(H).forEach(n=>{if(n!=='_alias')hojas[n]=new Hoja(H[n])});
let EMAIL='dueno@gmail.com';
const carpeta=(ruta)=>({ruta,moveTo(){},getFilesByName:()=>({hasNext:()=>false}),getFoldersByName:()=>({hasNext:()=>false}),createFolder:n=>carpeta(ruta+'/'+n),createFile:b=>({b,setSharing(){},getId:()=>'F1',getUrl:()=>'u'})});
const g={Utilities:{formatDate:fmt,getUuid:()=>crypto.randomUUID(),base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(b,m,n)=>({b,m,n}),computeDigest:(a,s)=>Array.from(crypto.createHash('sha256').update(String(s),'utf8').digest()).map(b=>b>127?b-256:b),DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1}},
 Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},CacheService:{getScriptCache:()=>({get:()=>null,put(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
 SpreadsheetApp:{getActive:()=>({getId:()=>'L1',getName:()=>'Libro',getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>{if(hojas[n])hojas[n].nombre=n;return hojas[n]||null},insertSheet:n=>(hojas[n]=new Hoja([]))}),getUi:()=>({alert(){},ButtonSet:{YES_NO:1,OK:1},Button:{YES:'YES'}})},
 ScriptApp:{getService:()=>({getUrl:()=>'https://x/exec'}),getProjectTriggers:()=>[],newTrigger:()=>({timeBased:()=>({everyDays:()=>({atHour:()=>({nearMinute:()=>({inTimezone:()=>({create(){}})})})})})})},
 MailApp:{sendEmail(){}},DriveApp:{getFoldersByName:()=>({hasNext:()=>false}),createFolder:n=>carpeta(n),getRootFolder:()=>carpeta('raiz'),getFolderById:()=>carpeta('x'),createFile:()=>({}),getFileById:()=>({moveTo(){}})},HtmlService:{createHtmlOutput:()=>({getBlob:()=>({getAs:()=>({})})})},console};
vm.createContext(g);vm.runInContext(fs.readFileSync(R+'paquete/ICET_completo.gs','utf8'),g);
const run=c=>vm.runInContext(c,g);
// ---- datos de la prueba (nombres de docentes del libro; estudiantes inventados)
const D=(n,ap,nom,niv)=>[`D${n}`,String(n),ap,nom,`${ap} ${nom}`,niv,null,'','',null,'SI',null];
hojas.Docentes=new Hoja([['codigo','n','apellidos','nombres','nombre_completo','nivel','grupo_titular','direccion_grupo','areas','correo','tiene_horario','nota'],D(1,'Nom11 Nom12','Nom09 Nom13','SECUNDARIA'),D(2,'Nom04 Nom05','Nom06 Nom07','SECUNDARIA'),D(3,'Nom08 Nom01','Nom09 Nom10','SECUNDARIA'),D(4,'Nom00 Nom01','Nom02 del Nom03','SECUNDARIA'),D(5,'Nom14 Nom15','Nom16','SECUNDARIA'),D(6,'Ponce Moncayo','Ángela Paola','ORIENTACIÓN')]);
hojas.Grupos=new Hoja([['grupo','tipo','grado','nombre','modalidad'],['0801','REGULAR','8°','8°-1',null],['0802','REGULAR','8°','8°-2',null]]);
hojas.Direccion_Grupo=new Hoja([['grupo','nombre','tipo_direccion','docente_1','docente_2','modalidad','dinamizadores'],['0801','8°-1','DUAL','Nom11 Nom12 Nom09 Nom13','Nom04 Nom05 Nom06 Nom07',null,null],['0802','8°-2','DUAL','Nom08 Nom01 Nom09 Nom10','Nom00 Nom01 Nom02 del Nom03',null,null]]);
const hz=(d,gr,a)=>[0,d,'LUNES',1,1,1,'06:30','07:15','CLASE',gr,a];
hojas.Horario=new Hoja([['docente_n','docente','dia','hora','bloque','sesion','inicio','fin','tipo','grupo','area'],hz(0,'x','x').map((v,i)=>i===1?'Nom14 Nom15 Nom16':v).map((v,i)=>i===9?'0801':i===10?'MAT':v),hz(0,'0802','MAT').map((v,i)=>i===1?'Nom14 Nom15 Nom16':v),hz(0,'0801','CAS').map((v,i)=>i===1?'Nom11 Nom12 Nom09 Nom13':v),hz(0,'0802','CNA').map((v,i)=>i===1?'Nom08 Nom01 Nom09 Nom10':v),hz(0,'0801','TEI').map((v,i)=>i===1?'Nom04 Nom05 Nom06 Nom07':v),hz(0,'0802','ETR').map((v,i)=>i===1?'Nom00 Nom01 Nom02 del Nom03':v)]);
const est=[['grupo','curso','no','apellidos','nombres']];['0801','0802'].forEach((gr,gi)=>{for(let i=1;i<=6;i++)est.push([gr,'8°-'+(gi+1),i,`APELLIDO${gi}${i} DE PRUEBA`,`NOMBRE${i} MARIA`])});hojas.Estudiantes=new Hoja(est);
hojas.Identidad_Docentes=new Hoja([['docente','cedula'],['Nom11 Nom12 Nom09 Nom13','111111111'],['Nom14 Nom15 Nom16','222222222'],['Nom04 Nom05 Nom06 Nom07','333333333'],['Nom08 Nom01 Nom09 Nom10','444444444'],['Nom00 Nom01 Nom02 del Nom03','555555555']]);
hojas.Usuarios=new Hoja([hojas.Usuarios.v[0]]);
hojas.Directivos=new Hoja([['nombre','rol','correo_temporal','pin_hash','pin_sal','intentos','bloqueado_hasta','correo'],['Nom20 Nom21','Coordinador académico','fco@x.com','','','0','','fco@x.com']]);
const ses=(n,ced)=>{const r=run(`ingresarDocente({nombre:${JSON.stringify(n)},pin:'${ced}',correo:'a@gmail.com'})`);return r.token};
run("restablecerClave_('Nom20 Nom21','123456')");const tokC=run("ingresar({nombre:'Nom20 Nom21',pin:'123456'})").token;
const T={A:ses('Nom11 Nom12 Nom09 Nom13','111111111'),B:ses('Nom14 Nom15 Nom16','222222222'),C:tokC};
global.OFF=false;const srvCall=async(token,fn,args)=>{if(global.OFF&&(fn==='comisionGuardar'||fn==='comisionCambios'))return {err:'sin conexión (simulada)'};if(global.OFF2&&fn!=='comisionContexto')return {err:'sin conexión (simulada)'};try{g.__t=token;g.__f=fn;g.__a=args;const r=run("llamarSeguro(__t,__f,__a)");return {ok:JSON.parse(JSON.stringify(r===undefined?null:r))}}catch(e){return {err:String(e.message)}}};
let fallos=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m);if(!c)fallos++};
// ---- grado 5° (cuatro cursos, ~125 estudiantes) y la docente de grupo Nom19
hojas.Estudiantes.v[0]=['grupo','curso','no','apellidos','nombres','documento','tipo_doc'];
hojas.Docentes.v.push(D(7,'Nom17 Nom18','Nom19','PRIMARIA'));
['0501','0502','0503','0504'].forEach((gr,gi)=>{hojas.Grupos.v.push([gr,'REGULAR','5°','5°-'+(gi+1),null]);for(let i=1;i<=31;i++)hojas.Estudiantes.v.push([gr,'5°-'+(gi+1),i,`QUIÑONES${gi}${i} APELLIDO LARGO DE PRUEBA`,`NOMBRE${i} LUCIA SOFIA`,'1085'+gi+String(100000+i),'RC'])});
hojas.Direccion_Grupo.v.push(['0501','5°-1','SIMPLE','Nom17 Nom18 Nom19','',null,null]);
hojas.Horario.v.push(hz(0,'0501','MULTIPLES').map((v,i)=>i===1?'Nom17 Nom18 Nom19':v));
hojas.Identidad_Docentes.v.push(['Nom17 Nom18 Nom19','666666666']);
const TN=ses('Nom17 Nom18 Nom19','666666666');

(async()=>{const b=await chromium.launch();const er=[];
 const abre=async(tag,tok)=>{const ctx=await b.newContext({viewport:{width:1100,height:900},timezoneId:'America/Bogota'});const p=await ctx.newPage();p.on('pageerror',e=>er.push(tag+' PE '+e.message));p.on('dialog',d=>{er.push(tag+' DIALOG '+d.message().slice(0,100));d.accept()});
  await p.exposeFunction('__srv',srvCall);
  await p.addInitScript(t=>{try{localStorage.setItem('icet_token',t)}catch(e){}
   function mk(ok,fail){return new Proxy({},{get:(_,k)=>{if(k==='withSuccessHandler')return f=>mk(f,fail);if(k==='withFailureHandler')return f=>mk(ok,f);
    return (...a)=>{if(k==='urlBase')return setTimeout(()=>ok&&ok('https://x/exec'),5);
     if(k==='llamarSeguro')window.__srv(a[0],a[1],a[2]).then(r=>{if(r.err){fail&&fail(new Error(r.err))}else ok&&ok(r.ok)})}}})}
   window.google={script:{run:mk(null,null)}}},tok);
  await p.goto('file://'+R+'paquete/Comisiones.html');await p.waitForTimeout(1200);return p};
 const N=await abre('N',TN);
 console.log('grados',await N.evaluate(()=>JSON.stringify(GRADOS_REAL)));
 await N.evaluate(()=>{$('#grado').value=GRADOS_REAL[0];$('#periodo').value='Primero';abreActa()});await N.waitForTimeout(2500);
 await N.waitForSelector('#pOk',{timeout:8000}).catch(()=>console.log('SIN MODAL'));await N.selectOption('#pLug','Aula de clase').catch(()=>{});await N.click('#pOk').catch(()=>{});await N.waitForTimeout(500);
 console.log('estado',await N.evaluate(()=>JSON.stringify({usr:USR,perfil:PERFIL,resp:S.resp,gs:S.gs,est:EST.length,cerr:S.cerrada,lectura:document.body.classList.contains('lectura'),jurban:!!document.querySelector('.jurban'),dis:document.querySelectorAll('.paso input:disabled').length,en:document.querySelectorAll('.paso input:not(:disabled)').length,estadoG:document.getElementById('estadoG').textContent,aviso:(document.getElementById('avisoBorr')||{}).textContent})));
 await N.evaluate(()=>{window.__pp=0;window.__ps={};const o=window.pintaPre;window.pintaPre=function(){window.__pp++;const k=(new Error().stack||'').split('\n').slice(2,5).map(x=>x.trim().slice(-70)).join(' < ');window.__ps[k]=(window.__ps[k]||0)+1;return o.apply(this,arguments)}});
 await N.waitForTimeout(6000);console.log('MUT',await N.evaluate(()=>window.__pp),JSON.stringify(await N.evaluate(()=>window.__ps)));
 // clic real en el juramento (el interruptor)
 const sw=await N.$('#preInicio .jur label.sw');console.log('sw',!!sw);
 await sw.click().catch(e=>console.log('CLIC FALLÓ',e.message.slice(0,200)));await N.waitForTimeout(3000);
 console.log('tras clic',await N.evaluate(()=>JSON.stringify({jur:S.jur,jurban:!!document.querySelector('.jurban'),dis:document.querySelectorAll('.paso input:disabled').length,estadoG:document.getElementById('estadoG').textContent,aviso:(document.getElementById('avisoBorr')||{}).textContent})));
 // matrícula editable
 await N.evaluate(()=>irTab&&irTab('p1'));
 console.log('ini disabled?',await N.evaluate(()=>{const i=document.querySelector('#s1 input[type=number]');return i?i.disabled:'sin input'}));
 await N.evaluate(()=>{irTab('p1');ir(1)});await N.waitForTimeout(500);console.log('DOC',await N.evaluate(()=>JSON.stringify({e0:[EST[0].tdoc,EST[0].ndoc,EST[0].falta],hdr:[...document.querySelectorAll('#lisBox table.lis tr:first-child th')].map(x=>x.textContent).join('|'),fila:[...document.querySelectorAll('#lisBox table.lis tr')][1]&&[...document.querySelectorAll('#lisBox table.lis tr')][1].textContent.slice(0,120)})));
 // ---- respaldo local: sin conexión, recarga y regreso al último paso
 await N.evaluate(()=>{irTab('p1');ir(3)});await N.waitForTimeout(300);
 global.OFF=true;
 await N.evaluate(()=>{S.mat[0].dud=77;});await N.waitForTimeout(4500);
 console.log('offline estado',await N.evaluate(()=>document.getElementById('estadoG').textContent.slice(0,60)),'drafts',await N.evaluate(()=>hayDrafts()));
 await N.reload();await N.waitForTimeout(1200);
 global.OFF=false;
 await N.waitForTimeout(3500);
 const rr=await N.evaluate(()=>({ini:S.mat[0].dud,paso:paso,tab:PANE,aviso:(document.getElementById('avisoBorr')||{}).textContent.slice(0,70)}));
 console.log('tras recarga',JSON.stringify(rr));
 await N.waitForTimeout(3000);
 const sv=(await srvCall(TN,'comisionCargar',[{acta:await N.evaluate(()=>ACTA.id)}])).ok.secciones['matricula:0501'];
 console.log('en el libro',JSON.stringify(sv&&sv.datos&&sv.datos.mat&&sv.datos.mat.dud),'drafts pendientes',await N.evaluate(()=>hayDrafts()));
 // ---- ajustes del coordinador: acompañantes sin obligaciones, nacionalidad por defecto, completar datos, imprimible libre
 const t2=await N.evaluate(()=>{const fco=S.int.filter(x=>/Nom21|Cortes/.test(x.n))[0];const e=EST.filter(x=>x.g==='5°-1')[0];
   const rev=revLista().map(x=>x.n);
   modEst(e.id);document.getElementById('mL').value='TUMACO';document.getElementById('mS').value='F';document.getElementById('mNa').value='Ecuatoriana';document.getElementById('mOk').click();
   irTab('p3');
   return {fcoP:fco?fco.p:'sin',fcoEnRev:rev.some(n=>/Nom21/.test(n)),nRev:rev.length,nacDef:EST.filter(x=>x.g==='5°-2')[0].nac,tieneNacFalta:EST.some(x=>x.falta.indexOf('Nacionalidad o procedencia')>=0),lex:e.lex,sx:e.sx,nac:e.nac,falta:e.falta,pane:PANE}});
 console.log('AJUSTES',JSON.stringify(t2));
 // ---- matrícula: hombres + mujeres = total (una sube, la otra baja)
 const mt=await N.evaluate(()=>{const o={};const r=S.mat[0];r.ok=false;matSet(0,'ini',32);matSet(0,'nu',0);matSet(0,'re',0);matSet(0,'de',0);o.def=[r.ini,r.m,r.f];matSet(0,'m',12);o.m12=[r.m,r.f];matSet(0,'f',5);o.f5=[r.m,r.f];matSet(0,'ini',40);o.ini40=[r.m,r.f,tot(r)];return o});
 console.log('MATRICULA',JSON.stringify(mt));
 // ---- sin conexión al abrir: se usa la copia local
 await N.waitForTimeout(3000);global.OFF2=true;await N.reload();await N.waitForTimeout(2500);
 await N.waitForSelector('#pOk',{timeout:4000}).catch(()=>{});
 console.log('OFFLINE',JSON.stringify(await N.evaluate(()=>({gs:S&&S.gs,est:EST.length,aviso:(document.getElementById('avisoBorr')||{}).textContent.slice(0,60),estado:document.getElementById('estadoG').textContent.slice(0,40)}))));
 global.OFF2=false;
 // ---- «Guardar borrador» y «Recuperar borrador»
 {global.OFF=true;await N.evaluate(()=>{S.mat[0].dud=55;guardaBorrador(true);SYNC.activo=false;dEsc({})});await N.waitForTimeout(500);
  await N.reload();await N.waitForTimeout(1500);await N.waitForSelector('#pOk',{timeout:5000}).catch(()=>{});global.OFF=false;await N.waitForTimeout(3500);
  const a1=await N.evaluate(()=>({ini:S.mat[0].dud,aviso:(document.getElementById('avisoBorr')||{}).textContent.slice(0,60)}));console.log('BORRADOR antes',JSON.stringify(a1));
  await N.evaluate(()=>{const b=[...document.querySelectorAll('#avisoBorr button')].find(x=>/Recuperar/.test(x.textContent));if(b)b.click()});await N.waitForTimeout(800);
  console.log('BORRADOR despues',JSON.stringify(await N.evaluate(()=>({ini:S.mat[0].dud}))));}
 const rc=await N.evaluate(()=>{const e=EST.filter(x=>x.g==='5°-1')[0];const mk=t=>({id:e.id,prom:'',tipo:t,puesto:0});return S.tiposRec.map(t=>t.split(' (')[0]+':'+promBad(mk(t)))});
 console.log('RECONOC',JSON.stringify(rc));
 console.log('ERRORES',JSON.stringify(er));
 await b.close()})();
