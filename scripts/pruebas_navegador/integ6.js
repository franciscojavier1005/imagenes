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
global.OFF=false;const srvCall=async(token,fn,args)=>{if(global.OFF&&(fn==='comisionGuardar'||fn==='comisionCambios'))return {err:'sin conexión (simulada)'};try{g.__t=token;g.__f=fn;g.__a=args;const r=run("llamarSeguro(__t,__f,__a)");return {ok:JSON.parse(JSON.stringify(r===undefined?null:r))}}catch(e){return {err:String(e.message)}}};
let fallos=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m);if(!c)fallos++};
// ---- grado 5° (cuatro cursos, ~125 estudiantes) y la docente de grupo Nom19
hojas.Estudiantes.v[0]=['grupo','curso','no','apellidos','nombres','documento','tipo_doc'];
hojas.Docentes.v.push(D(7,'Nom17 Nom18','Nom19','PRIMARIA'));
['0501','0502','0503','0504'].forEach((gr,gi)=>{hojas.Grupos.v.push([gr,'REGULAR','5°','5°-'+(gi+1),null]);for(let i=1;i<=31;i++)hojas.Estudiantes.v.push([gr,'5°-'+(gi+1),i,`QUIÑONES${gi}${i} APELLIDO LARGO DE PRUEBA`,`NOMBRE${i} LUCIA SOFIA`,'1085'+gi+String(100000+i),'RC'])});
hojas.Direccion_Grupo.v.push(['0501','5°-1','SIMPLE','Nom17 Nom18 Nom19','',null,null]);
hojas.Horario.v.push(hz(0,'0501','MULTIPLES').map((v,i)=>i===1?'Nom17 Nom18 Nom19':v));
hojas.Identidad_Docentes.v.push(['Nom17 Nom18 Nom19','666666666']);
const TN=ses('Nom17 Nom18 Nom19','666666666');


// ---- preescolar, 2.º y 4.º (grados que se usan mañana)
[['0001','0°','0°-1'],['0002','0°','0°-2'],['0201','2°','2°-1'],['0202','2°','2°-2'],['0203','2°','2°-3'],['0701','7°','7°-1'],['CS101','CS1','CS 1-1'],['CS102','CS1','CS 1-2'],['0901','9°','9°-1'],['CS201','CS2','CS 2-1'],['0401','4°','4°-1'],['0402','4°','4°-2'],['0403','4°','4°-3']].forEach(([gr,gd,nm],gi)=>{hojas.Grupos.v.push([gr,'REGULAR',gd,nm,null]);for(let i=1;i<=22;i++)hojas.Estudiantes.v.push([gr,nm,i,`PEREZ${gr}${i} GOMEZ LARGO`,`NOMBRE${i} ANA MARIA`,'109'+gr+String(10000+i),i%7?'RC':'TI']);hojas.Direccion_Grupo.v.push([gr,nm,'SIMPLE',gi%2?'Nom17 Nom18 Nom19':'Nom11 Nom12 Nom09 Nom13','',null,null]);hojas.Horario.v.push(hz(0,gr,'MULTIPLES').map((v,k)=>k===1?(gi%2?'Nom17 Nom18 Nom19':'Nom11 Nom12 Nom09 Nom13'):v))});

(async()=>{const b=await chromium.launch();const er=[];
 const abre=async(tag,tok)=>{const ctx=await b.newContext({viewport:{width:1100,height:900},timezoneId:'America/Bogota'});const p=await ctx.newPage();p.on('pageerror',e=>er.push(tag+' PE '+e.message));p.on('dialog',d=>{er.push(tag+' DIALOG '+d.message().slice(0,100));d.accept()});
  await p.exposeFunction('__srv',srvCall);
  await p.addInitScript(t=>{try{localStorage.setItem('icet_token',t)}catch(e){}
   function mk(ok,fail){return new Proxy({},{get:(_,k)=>{if(k==='withSuccessHandler')return f=>mk(f,fail);if(k==='withFailureHandler')return f=>mk(ok,f);
    return (...a)=>{if(k==='urlBase')return setTimeout(()=>ok&&ok('https://x/exec'),5);
     if(k==='llamarSeguro')window.__srv(a[0],a[1],a[2]).then(r=>{if(r.err){fail&&fail(new Error(r.err))}else ok&&ok(r.ok)})}}})}
   window.google={script:{run:mk(null,null)}}},tok);
  await p.goto('file://'+R+'paquete/Comisiones.html');await p.waitForTimeout(1200);return p};
 const labels=await (async()=>{const p=await abre('L',TN);const l=await p.evaluate(()=>GRADOS_REAL.slice());await p.close();return l})();
 console.log('grados',JSON.stringify(labels));
 for(const lab of labels.filter(l=>/Transici|Preescolar|0°|2°|4°|7°|9°/.test(l))){
  const N=await abre('N',TN);
  await N.evaluate(l=>{$('#grado').value=l;$('#periodo').value='Final';abreActa()},lab);await N.waitForTimeout(2500);
  await N.waitForSelector('#pOk',{timeout:8000}).catch(()=>{});await N.selectOption('#pLug','Aula de clase').catch(()=>{});await N.click('#pOk').catch(()=>{});await N.waitForTimeout(400);
  const sw=await N.$('#preInicio .jur label.sw');if(sw)await sw.click().catch(()=>{});await N.waitForTimeout(2500);
  const r=await N.evaluate(()=>{const cnt={};EST.forEach(e=>cnt[e.g]=(cnt[e.g]||0)+1);const o={cnt:JSON.stringify(cnt),niv:S.niv,gs:S.gs.length,est:EST.length,jur:Object.keys(S.jur||{}).length};
    try{o.pend=pendientesCierre().length}catch(e){o.pendErr=String(e.message)}
    try{['p3','p2','p1'].forEach(irTab);for(let i=0;i<PASOS().length;i++){ir(i)}o.recorrido=PASOS().length}catch(e){o.navErr=String(e.message)}
    try{const e=EST[0];modEst(e.id);document.getElementById('mL').value='TUMACO';document.getElementById('mOk').click();o.mod=e.lex}catch(e){o.modErr=String(e.message)}
    try{const q=document.getElementById('estadoG').textContent;o.estado=q.slice(0,40)}catch(e){}
    return o});
  console.log(lab,JSON.stringify(r));await N.close()}
 console.log('ERRORES',JSON.stringify(er));
 await b.close()})();
