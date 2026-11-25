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
 const T0=await N.evaluate(()=>JSON.stringify(S.mat.map(r=>[r.de||0,r.m,r.f])));
 const id0=await N.evaluate(()=>EST.filter(e=>e.g==='5°-1')[0].id);
 // No asiste
 await N.evaluate(id=>noAsiste(id,true),id0);await N.waitForTimeout(300);
 const a1=await N.evaluate(id=>({baja:est(id).baja,mot:est(id).bajaMotivo,de:S.mat[0].de,cam:S.cambiosEst.slice(-1)[0].tipo}),id0);
 ok(a1.baja&&a1.mot==='No asiste'&&a1.de===1&&a1.cam==='NO_ASISTE','No asiste: inhibe, suma no asisten y registra el cambio '+JSON.stringify(a1));
 await N.evaluate(id=>noAsiste(id,false),id0);
 const a2=await N.evaluate(id=>({baja:est(id).baja,de:S.mat[0].de}),id0);
 ok(!a2.baja&&a2.de===0,'Sí asiste revierte '+JSON.stringify(a2));
 // sexo editable
 await N.evaluate(id=>setSx(id,'M'),id0);ok(await N.evaluate(id=>est(id).sx==='M'&&est(id).mod===1,id0),'sexo editable marca modificado');
 // selección múltiple en reconocimientos
 await N.evaluate(()=>{irTab('p3');abrirPick('rec')});
 const ids=await N.evaluate(()=>{const l=EST.filter(e=>e.g==='5°-2').slice(0,3).map(e=>e.id);l.forEach(i=>PICK_SEL[i]=true);return l});
 await N.evaluate(()=>pickAgrega());await N.waitForTimeout(400);
 const rc=await N.evaluate(ids=>S.rec.filter(r=>ids.indexOf(r.id)>=0).map(r=>[r.tipo,r.prom,!!r.promDef]),ids);
 ok(rc.length===3,'agrega varios reconocimientos a la vez '+JSON.stringify(rc));
 ok(rc.filter(r=>r[2]&&r[1]==='4,6').length>=1,'promedio 4,6 por defecto resaltado en los dos primeros tipos '+JSON.stringify(rc));
 // reprobados por área
 const ar=await N.evaluate(()=>AREAS[0]);
 await N.evaluate(a=>abrePickArea(a,2),ar);
 const ids2=await N.evaluate(()=>{const l=EST.filter(e=>e.g==='5°-3').slice(0,4).map(e=>e.id);l.forEach(i=>PICK_SEL[i]=true);return l});
 await N.evaluate(()=>pickAgrega());await N.waitForTimeout(400);
 const rp=await N.evaluate(a=>({n:S.rp[a][2],rep:S.rep.filter(r=>r.items.some(i=>i.area===a)).length}),ar);
 ok(rp.n===4&&rp.rep===4,'reprobados por área sincronizados con la lista '+JSON.stringify(rp));

 await N.evaluate(()=>{irTab('p2');pintaAreas()});const nb=await N.evaluate(()=>document.querySelectorAll('.selRep').length);ok(nb>=8,'botón Seleccionar en cada área ('+nb+')');
 await N.waitForTimeout(800);
 const ub=await N.evaluate(()=>($('#unionBox')||{}).textContent||'');ok(/Caminar en Secundaria · período Primero: CS 1 se trabaja con 6\.º y CS 2 con 8\.º/.test(ub)&&!/Cambiar integración/.test(ub),'banner de integración visible y sin botón para docentes: '+ub.slice(0,90));
 const hb=await N.evaluate(()=>{PERFIL='c';S.revL={'Nom17 Nom18 Nom19':'07:00'};S.recOk={'5°-1':recSig('5°-1')};pintaLis();pintaListas();return [document.querySelectorAll('#habI_rev button').length,document.querySelectorAll('#habI_rec button').length]});
 ok(hb[0]===1&&hb[1]===1,'coordinación ve «Habilitar de nuevo» junto a la revisión y los reconocimientos '+JSON.stringify(hb));

 const br=await N.evaluate(()=>{pintaListas();return !!document.getElementById('barRepA')&&!document.querySelector('#brA')});ok(br,'la lista de reprobación es solo reflejo de Áreas (sin selector propio)');

 await N.evaluate(()=>{irTab('p1');ir(1)});await N.waitForTimeout(1500);
 const vis=await N.evaluate(()=>{const w=document.querySelector('#lisBox details.lisd');if(w)w.open=true;const t=document.querySelector('#lisBox table.lis');return t?{ths:[...t.rows[0].cells].map(x=>x.textContent),btnsEnFila:t.querySelectorAll('tr td button').length,enc:!!document.querySelector('#lisBox .lisbar button')}:null});
 ok(vis&&vis.ths.indexOf('Acciones')<0&&vis.btnsEnFila===0&&vis.enc,'sin columna de botones por fila; botones junto al encabezado del grado '+JSON.stringify(vis));
 await N.evaluate(()=>{const g=S.gs[0];abreNoAsiste(g);const c=document.querySelector('#naL input');c.checked=true;});
 const idna=await N.evaluate(()=>+document.querySelector('#naL input').getAttribute('data-id'));await N.evaluate(()=>naAplica(S.gs[0]));await N.waitForTimeout(300);
 ok(await N.evaluate(i=>est(i).baja&&est(i).bajaMotivo==='No asiste',idna),'«No asiste…» del encabezado marca varios a la vez');
 await N.evaluate(i=>noAsiste(i,false,true),idna);
 await N.setViewportSize({width:760,height:900});await N.waitForTimeout(1500);const lb=await N.$('#lisBox details.lisd');await lb.scrollIntoViewIfNeeded();await N.evaluate(()=>{document.querySelector('#lisBox details.lisd').scrollIntoView()});await N.waitForTimeout(500);await N.screenshot({path:'/tmp/cartilla/lis_ancho.png'});

 const dup=await N.evaluate(()=>{marcaK0();const e0=EST[3],a0=e0.a,n0=e0.n;aplicaUna('faltantes',{datos:{[e0.id]:{a:'Zzz Otro',n:'Persona Distinta',sx:'M',falta:[]}},ing:[],cambios:[]});const r1=e0.a===a0&&e0.n===n0;
  const e1=EST[5];aplicaUna('faltantes',{datos:{[e0.id]:{k0:e1.k0,sx:'M',falta:[]}},ing:[],cambios:[]});return [r1,e1.sx==='M',EST.filter(x=>x.g===e1.g&&x.a===e1.a&&x.n===e1.n).length]});
 ok(dup[0]&&dup[1]&&dup[2]===1,'lo guardado de otra persona (fila cambiada en la hoja) no sobrescribe el nombre ni duplica; con identidad se reubica '+JSON.stringify(dup));

 const tb=await N.evaluate(()=>{pintaLis();return [document.querySelectorAll('#lisBox .lisbar .btn.tr').length,!!document.querySelector('.btn.bor')]});ok(tb[0]>0&&tb[1],'botones de traslado y «Guardar borrador» con color propio '+JSON.stringify(tb));

 const eq=await N.evaluate(()=>{const old=[MODO,ALC];MODO='EQUIPO';ALC={todo:false,cursos:['0502'],cursosEst:['0502','0503'],areas:['Matemáticas'],multiareas:false};const r=[puedeEscribir('matricula:0502'),puedeEscribir('matricula:0501'),puedeEscribir('areas:Matemáticas'),puedeEscribir('areas:Inglés'),puedeEscribir('estudiantes:0503'),puedeEscribir('firmas')];MODO=old[0];ALC=old[1];return r});
 ok(JSON.stringify(eq)==='[true,false,true,false,true,true]','en equipo, la pantalla permite solo el alcance del docente '+JSON.stringify(eq));

 const dv=await N.evaluate(()=>{const g=S.gs[0],ids=EST.filter(e=>e.g===g&&!e.baja).slice(0,2).map(e=>e.id);const ini0=EST.filter(e=>e.g===g&&!e.ing).length;noAsiste(ids[0],true,true);setNac(ids[1],'Venezolana');matDeriva();const r=S.mat[0];
  S.rep=[{id:ids[1],inas:0,items:[{area:'Matemáticas',mot:['Bajo rendimiento']}],gen:[],otro:''}];rpDeriva();
  const tr=['Excelencia','Rendimiento académico','Convivencia escolar'].map(t=>S.tiposRec.indexOf(t));const a=S.rp['Matemáticas'][0];
  const nac=EST.filter(e=>e.g===g&&!e.baja&&!e.nac).length;const act=EST.filter(e=>e.g===g&&!e.baja).length;
  const out={ini:r.ini===ini0,de:r.de===1,tot:r.ini+r.nu-r.re-r.de===act,ve:r.ve===1,nac:nac===0,rp:a===1,tipos:JSON.stringify(tr)==='[0,1,2]'};noAsiste(ids[0],false,true);S.rep=[];return out});
 ok(Object.values(dv).every(Boolean),'matrícula, nacionalidad (colombiana por defecto) y reprobados salen de los listados '+JSON.stringify(dv));
 const mm=await N.evaluate(()=>{pintaMat();const a=[...document.querySelectorAll('#tMat input[type=number]')];console.log('DBGMAT',a.length,a.slice(0,3).map(x=>x.getAttribute('onchange')).join('|'),document.querySelectorAll('#tMat input[disabled]').length);return a.length>0&&a.filter(x=>/\.(ini|nu|re|de|m|f|ve|ec)=/.test(x.getAttribute('onchange')||'')).every(x=>x.disabled)});ok(mm,'las cifras de la matrícula son de solo lectura');
 const mo=await N.evaluate(()=>{abrirPick('rec');const m=document.getElementById('mPick');return getComputedStyle(m).alignItems});ok(mo==='flex-start','las ventanas emergentes salen arriba y no abajo ('+mo+')');

 const po=await N.evaluate(()=>{S.int.forEach(x=>{});const r=promOrdena(estGrupo(S.gs[0]));const e=estGrupo(S.gs[0])[3];S.prom=S.prom||{};S.prom[e.id]=false;const r2=promOrdena(estGrupo(S.gs[0]));return [r.every(x=>!x.__banda),r2.filter(x=>x.__banda).length,r2[r2.length-1].id===e.id||!!r2[r2.length-1].id]});
 ok(po[0]&&po[1]>=1,'en la promoción, quienes no se promueven van al final tras una franja '+JSON.stringify(po));

 const td=await N.evaluate(()=>{const g=S.gs[0],L=EST.filter(e=>e.g===g&&!e.baja);const e=L[0];e.tdoc='';e.tdocSug=0;nacPorDefecto();const a=[e.tdoc,e.tdocSug];L.forEach(x=>{if(!x.sx)x.sx='F'});S.sxOk={};confirmaSexo(g,true);return [a,e.tdocSug,e.mod,!!(S.sxOk&&S.sxOk[g]),/TI/.test(tdocCelda(e))]});
 ok(td[0][0]==='TI'&&td[0][1]===1&&td[1]===0&&td[2]===1&&td[3],'tipo de documento sugerido (TI) y confirmado con el curso '+JSON.stringify(td));
 const rp2=await N.evaluate(()=>{const g=S.gs[0],e=EST.filter(x=>x.g===g&&!x.baja)[5];S.rep=[{id:e.id,inas:0,items:[],gen:[],otro:''}];rpDeriva();const a=S.rp['Matemáticas'][0];S.rep[0].items.push({area:'Matemáticas',mot:['Bajo rendimiento']});rpDeriva();return [a,S.rp['Matemáticas'][0]]});
 ok(rp2[0]===0&&rp2[1]===1,'un reprobado agregado en la lista cuenta en el área elegida '+JSON.stringify(rp2));

 const nv=await N.evaluate(()=>{const g=S.gs[0],n0=S.mat[0].nu,t0=tot(S.mat[0]);EST.push({id:999001,g:g,a:'Nuevo',n:'Agregado',ing:1,falta:[],sx:'F'});matDeriva();const a=[S.mat[0].nu-n0,tot(S.mat[0])-t0];const x=EST[EST.length-1];x.baja=true;x.bajaMotivo='No asiste';matDeriva();const b=[S.mat[0].nu-n0,tot(S.mat[0])-t0];EST.pop();matDeriva();return [a,b]});
 ok(JSON.stringify(nv)==='[[1,1],[0,0]]','«Nuevos» cuenta los estudiantes agregados en el listado '+JSON.stringify(nv));

 const rc3=await N.evaluate(()=>{const g=S.gs[0],L=EST.filter(e=>e.g===g&&!e.baja),a=L[2],b=L[3];S.rep=[{id:a.id,inas:2,items:['Matemáticas','Inglés','Ciencias Sociales'].map(x=>({area:x,mot:['Bajo rendimiento']})),gen:[],otro:''},{id:b.id,inas:0,items:[{area:'Matemáticas',mot:['Bajo rendimiento']}],gen:[],otro:''}];
  const h1=repCard(S.rep[0],0),h2=repCard(S.rep[1],1);const ok1=/3 áreas reprobadas/.test(h1)&&/NO se promueve/.test(h1)&&/rpf/.test(h1)&&/1 área reprobada/.test(h2)&&/se promueve con área pendiente/.test(h2);
  noAsiste(b.id,true,true);matDeriva();const ok2=S.rep.length===1&&S.rep[0].id===a.id;noAsiste(b.id,false,true);S.rep=[];
  pintaMat();console.log('DBG',document.querySelectorAll('#tMat input[type=number]').length,document.querySelectorAll('#tMat .roMat').length,(document.querySelector('#tMat input[type=number]')||{getAttribute:()=>'-'}).getAttribute('onchange'));const sp=document.querySelectorAll('#tMat .roMat').length>0,mf=document.querySelectorAll('#tMat .mbig').length>0;return [ok1,ok2,sp,mf,document.querySelectorAll('#tMat input[type=number]').length,document.querySelectorAll('#tMat tr').length,(document.querySelector('#tMat input[type=number]')||{getAttribute:()=>'-'}).getAttribute('onchange')]});
 ok(rc3.slice(0,4).every(Boolean),'reprobación en una línea con veredicto, sin inhibidos; matrícula en texto y final destacada '+JSON.stringify(rc3));
 const pr=await N.evaluate(()=>{const g=S.gs[0],e=EST.filter(x=>x.g===g&&!x.baja)[1];S.rec=S.rec||[];S.rec.push({id:e.id,prom:'4,6',tipo:'EXCELENCIA',puesto:1});matDeriva();const t=S.rec[S.rec.length-1].tipo;S.rec.pop();return t});
 ok(pr==='Excelencia','los reconocimientos guardados con nombre en mayúscula se muestran con su tipo ('+pr+')');

 const ops=await N.evaluate(()=>{pintaUnion();pintaListas();return [!!document.getElementById('btnActaOps'),!!document.getElementById('recPdfBar'),typeof abreActaOps]});
 ok(ops[0]&&ops[1]&&ops[2]==='function','botones de nueva acta/archivar y PDF de reconocimientos '+JSON.stringify(ops));

 const mm2=await N.evaluate(()=>{pintaMat();const a=[...document.querySelectorAll('#tMat input[type=number]')].map(x=>x.getAttribute('onchange')||'');const ed=a.filter(x=>/(setMatMan|matSet)\(0,'(m|f|ve|ec)'/.test(x)).length;return [ed,document.querySelectorAll('#tMat .roMat').length>=8]});
 ok(mm2[0]===0&&mm2[1],'toda la matrícula (incluidos sexo y nacionalidad) es solo lectura y sale de los listados '+JSON.stringify(mm2));

 const mg=await N.evaluate(()=>{const g=S.gs[0],L=EST.filter(e=>e.g===g&&!e.baja);S.rec=[{id:L[1].id,prom:'4,9',tipo:'EXCELENCIA',puesto:1},{id:L[2].id,prom:'4,8',tipo:'Excelencia',puesto:2},{id:L[3].id,prom:'',tipo:'Convivencia escolar',puesto:0}];matDeriva();pintaMerge();const f=[...document.querySelectorAll('#recMerge table tr')].slice(1).map(r=>r.cells[0].textContent.trim());S.rec=[];return f});
 ok(mg.length===3&&mg.every(x=>x&&x!=='—'),'el listado para combinar correspondencia muestra el tipo en todas las filas '+JSON.stringify(mg));

 const et=await N.evaluate(()=>{const g=S.gs[0],L=EST.filter(e=>e.g===g&&!e.baja);S.rep=[{id:L[4].id,inas:0,items:[{area:'Matemáticas',mot:['Bajo rendimiento']}],gen:[],otro:''}];irTab&&irTab('p2');pintaAreas();const t=[...document.querySelectorAll('.rpTagsRow button')].map(b=>b.textContent);quitaRepArea(L[4].id,'Matemáticas');const d=S.rep.length;S.rep=[];return [t.length,/✕/.test(t[0]||''),d]});
 ok(et[0]>=1&&et[1]&&et[2]===0,'en Áreas aparecen etiquetas con los reprobados de cada área y se pueden quitar '+JSON.stringify(et));
 const nt=await N.evaluate(()=>{const g0=EST.filter(e=>e.g===S.gs[0]&&!e.baja)[0];const sv=S.rep;S.rep=[{id:g0.id,inas:0,items:[{area:'Matemáticas',mot:['Bajo rendimiento']}],gen:[],otro:''}];const w=window.prompt;window.prompt=()=>'Falta de acompañamiento familiar';notaArea(0,0);pintaListas();const a=!!document.querySelector('.rpn')&&S.rep[0].items[0].nota==='Falta de acompañamiento familiar';const t=document.body.innerHTML.indexOf('Anotación:')>=0;notaArea(0,0,1);pintaListas();window.prompt=w;const q=!document.querySelector('.rpn');S.rep=sv;return [a,t,q]});
 ok(nt&&nt[0]&&nt[1]&&nt[2],'anotación opcional por área: se agrega, se muestra y se quita '+JSON.stringify(nt));

 console.log('ERRORES',JSON.stringify(er));await b.close();console.log(fallos?fallos+' FALLA(S)':'Todo bien');process.exit(0)})();
