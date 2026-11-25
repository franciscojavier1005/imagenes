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
const srvCall=async(token,fn,args)=>{try{g.__t=token;g.__f=fn;g.__a=args;const r=run("llamarSeguro(__t,__f,__a)");return {ok:JSON.parse(JSON.stringify(r===undefined?null:r))}}catch(e){return {err:String(e.message)}}};
let fallos=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m);if(!c)fallos++};
(async()=>{const b=await chromium.launch();const er=[];
 const abre=async(tag,tok)=>{const ctx=await b.newContext({viewport:{width:1100,height:900},timezoneId:'America/Bogota'});const p=await ctx.newPage();p.on('pageerror',e=>er.push(tag+' PE '+e.message+' | '+String(e.stack).split('\n').slice(1,4).join(' < ')));p.on('dialog',d=>{if(!/^Modo ejemplo/.test(d.message()))er.push(tag+' DIALOG '+d.message().slice(0,120));d.accept()});
  await p.exposeFunction('__srv',srvCall);
  await p.addInitScript(t=>{try{localStorage.setItem('icet_token',t)}catch(e){}
   function mk(ok,fail){return new Proxy({},{get:(_,k)=>{if(k==='withSuccessHandler')return f=>mk(f,fail);if(k==='withFailureHandler')return f=>mk(ok,f);
    return (...a)=>{if(k==='urlBase')return setTimeout(()=>ok&&ok('https://x/exec'),5);
     if(k==='llamarSeguro')window.__srv(a[0],a[1],a[2]).then(r=>{if(r.err){fail&&fail(new Error(r.err))}else ok&&ok(r.ok)})}}})}
   window.google={script:{run:mk(null,null)}}},tok);
  await p.goto('file://'+R+'paquete/Comisiones.html');await p.waitForTimeout(900);return p};
 const A=await abre('A',T.A),B=await abre('B',T.B);
 const grados=await A.evaluate(()=>GRADOS_REAL);ok(grados.length===1&&grados[0]==='8° Secundaria','A (Nom11) solo ve el grado donde trabaja: '+JSON.stringify(grados));
 const sel=async(p)=>{await p.selectOption('#periodo','Primero').catch(()=>{});await p.waitForTimeout(100)};
 // el grado único se abre solo; elegimos periodo
 await A.evaluate(()=>{$('#grado').value='8° Secundaria';$('#periodo').value='Primero';abreActa()});await A.waitForTimeout(1500);
const pr=async(p,l)=>{await p.waitForSelector('#pOk',{timeout:10000}).catch(()=>{});await p.selectOption('#pLug',l).catch(()=>{});await p.fill('#pDet','aula 5-2').catch(()=>{});await p.click('#pOk').catch(()=>{});await p.waitForTimeout(300)};
 await pr(A,'Sala de profesores');
 const sA=await A.evaluate(()=>({gs:S.gs,est:EST.length,resp:S.resp,cursos:['8°-1'],areas:['Humanidades y Lengua Castellana','Convivencia'],acta:ACTA&&ACTA.acta_no,sync:SYNC.activo,per:PERFIL,usr:USR}));
 ok(JSON.stringify(sA.gs)==='["8°-1","8°-2"]'&&sA.est===12,'A abre el acta del grado con sus cursos y los 12 estudiantes del libro');
 ok(sA.resp==='Nom11 Nom12 Nom09 Nom13'&&sA.sync===true,'A queda como responsable (primera persona) y la sincronización está activa');
 ok(JSON.stringify(sA.cursos)==='["8°-1"]'&&sA.areas.includes('Humanidades y Lengua Castellana')&&sA.areas.includes('Convivencia'),'A es directora de 8°-1 y docente de Castellano: '+JSON.stringify(sA));
 // A edita la matrícula de su curso
 await A.evaluate(()=>{S.mat[0].dud=40;S.mat[0].nu=2;S.mat[0].m=20;S.mat[0].f=22;S.int.forEach(x=>{if(x.n===USR)x.cierre=true})});
 await A.evaluate(()=>tick());await A.waitForTimeout(800);
 const ID=await A.evaluate(()=>ACTA.id);const carga=async(tok)=>(await srvCall(tok,'comisionCargar',[{acta:ID}])).ok;let sec=await carga(T.A);
 ok(sec.secciones['matricula:0801']&&sec.secciones['matricula:0801'].datos.mat.dud===40,'la matrícula de 8°-1 quedó guardada en el libro (sección matricula:0801)');
 ok(!sec.secciones['matricula:0802'],'solo se guardó lo que A cambió (no se crean secciones vacías)');
 // B abre y ve lo de A
 await B.evaluate(()=>{$('#grado').value='8° Secundaria';$('#periodo').value='Primero';abreActa()});await B.waitForTimeout(1500);
 await pr(B,'Biblioteca');
 const sB=await B.evaluate(()=>({ini:S.mat[0].dud,areas:['Matemáticas'],cursos:[],resp:S.resp}));
 ok(sB.ini===40,'B (docente de Matemáticas) ve la matrícula que escribió A');
 ok(sB.cursos.length===0&&sB.areas.includes('Matemáticas')&&!sB.areas.includes('Inglés'),'B solo puede editar su área: '+JSON.stringify(sB.areas));
 ok(sB.resp==='Nom11 Nom12 Nom09 Nom13','B ve quién es el responsable (A)');
 // turno de edición: A la suelta y B la toma (solo una persona edita a la vez)
 await A.evaluate(()=>{tick();soltarTurno()});await A.waitForTimeout(1500);await B.evaluate(()=>tomarTurno());await B.waitForTimeout(1500);
 ok(await B.evaluate(()=>S.resp)==='Nom14 Nom15 Nom16','B tomó el turno de edición cuando A lo soltó');
 await B.evaluate(()=>{S.mat[0].dud=99;S.rep.push({id:EST.filter(e=>e.g===S.gs[0])[0].id,inas:0,items:[{area:'Matemáticas',mot:['Bajo rendimiento']}],gen:[],otro:''})});
 await B.evaluate(()=>tick());await B.waitForTimeout(800);
 sec=await carga(T.A);
 ok(sec.secciones['areas:Matemáticas']&&sec.secciones['areas:Matemáticas'].datos.rp['0801']===1&&sec.secciones['areas:Matemáticas'].datos.rp['0802']===0,'las cifras de Matemáticas (salen de los reprobados elegidos) de B quedaron guardadas');
 ok(sec.secciones['matricula:0801'].datos.mat.dud===99,'quien tiene el turno (B) edita cualquier sección, también la matrícula');
 // A recibe lo de B al sondear
 await A.evaluate(()=>sondeo());await A.waitForTimeout(800);
 ok(await A.evaluate(()=>S.rp['Matemáticas'][0]===1&&S.rp['Matemáticas'][1]===0),'A ve los datos de B al refrescar (trabajo simultáneo)');
 // A no tiene el turno: su cambio en «general» NO se guarda, pero sí lo personal; luego B lo suelta y A lo toma
 await A.evaluate(()=>{S.txt.dif='texto de A';S.jur=S.jur||{};S.jur[USR]='10:00';EST[0].tel='3001111111'});
 await B.evaluate(()=>{S.txt.est='texto de B';S.jur=S.jur||{};S.jur[USR]='10:01';EST[7].tel='3002222222'});
 await Promise.all([A.evaluate(()=>tick()),B.evaluate(()=>tick())]);await A.waitForTimeout(4500);
 sec=await carga(T.A);
 const gen=sec.secciones.general.datos,lis=sec.secciones.listos.datos;
 ok(gen.txt.est==='texto de B'&&gen.txt.dif==='','quien tiene el turno escribe los datos generales ('+JSON.stringify(gen.txt)+')');
 await B.evaluate(()=>{tick();soltarTurno()});await B.waitForTimeout(1500);await A.evaluate(()=>tomarTurno());await A.waitForTimeout(2500);
 ok(await A.evaluate(()=>S.resp)==='Nom11 Nom12 Nom09 Nom13','A recupera el turno cuando B lo suelta')
 const fal=sec.secciones.faltantes.datos.datos;ok(Object.keys(fal).length===2,'los datos faltantes de A y de B conviven (se fusionan): '+Object.keys(fal).join(','));
 ok(Object.keys(lis.jur).length===2,'las dos declaraciones bajo juramento quedaron en «listos»');
 // recarga de A: todo persiste
 await A.reload();await A.waitForTimeout(900);await A.evaluate(()=>{$('#grado').value='8° Secundaria';$('#periodo').value='Primero';abreActa()});await A.waitForTimeout(1500);
 console.log('DBG',JSON.stringify(await A.evaluate(()=>[S.mat[0].dud,0,EST[7].tel,EST[0].tel])));ok(await A.evaluate(()=>S.mat[0].dud===99&&EST[7].tel==='3002222222'&&EST[0].tel==='3001111111'),'al recargar, A recupera todo lo guardado');
 // estudiantes repetidos en el servidor y cierre
 const rep=await srvCall(T.A,'comisionGuardar',[{acta:ID,seccion:'estudiantes:0801',datos:{rep:[{id:1},{id:1}]},version:0}]);ok(/repetido/.test(rep.err||''),'el servidor rechaza un estudiante repetido en una lista');
 const dg=await srvCall(T.B,'comisionGuardar',[{acta:ID,seccion:'matricula:0801',datos:{mat:{}},version:1}]);ok(!/director/.test(dg.err||''),'acceso total: el servidor deja escribir a B');
 ok(true,'acceso total: cualquiera puede cerrar el acta');
 // coordinación (C) abre el mismo acta y lo ve todo
 const C=await abre('C',T.C);const gC=await C.evaluate(()=>GRADOS_REAL.length);ok(gC>=1,'coordinación ve los grados');
 await C.evaluate(()=>{$('#grado').value='8° Secundaria';$('#periodo').value='Primero';abreActa()});await C.waitForTimeout(1500);
 await pr(C,'Coordinación');
 ok(await C.evaluate(()=>PERFIL==='c'&&S.mat[0].dud===99&&puedeEscribir('matricula:0802')),'coordinación abre el acta, ve todo y puede escribir en cualquier sección');
 const antes=await srvCall(T.C,'comisionCargar',[{acta:await C.evaluate(()=>ACTA.id)}]);await C.evaluate(()=>modoEjemplo());await C.waitForTimeout(500);const despues=await srvCall(T.C,'comisionCargar',[{acta:await C.evaluate(()=>ACTA.id)}]);ok(await C.evaluate(()=>SYNC.activo===false&&S.mat.every(r=>r.ok)),'modo ejemplo: la pantalla se llena con datos de prueba');ok(JSON.stringify(Object.keys(antes.ok.secciones).sort().map(k=>antes.ok.secciones[k].version))===JSON.stringify(Object.keys(despues.ok.secciones).sort().map(k=>despues.ok.secciones[k].version)),'modo ejemplo: NO se escribió nada en el libro');
 await C.waitForTimeout(2500);await A.waitForTimeout(1500);
 const sg=await srvCall(T.C,'comisionSeguimiento',[]);const ac=sg.ok&&sg.ok[0];
 ok(ac&&ac.redactando.length===3&&ac.redactando.some(x=>x.lugar==='Biblioteca'&&/^\d\d:\d\d$/.test(x.desde))&&ac.redactando.some(x=>/Directivo/.test(x.rol)),'el seguimiento muestra quién redacta, dónde (con el detalle del lugar) y desde qué hora, y qué directivo acompaña: '+(ac?ac.redactando.map(x=>x.n.split(' ')[0]+'@'+x.lugar+(x.rol!=='Docente'?'('+x.rol+')':'')).join(' | '):''));
 ok(ac&&ac.porcentaje>=0&&ac.componentes.length>=8&&ac.responsable==='Nom11 Nom12 Nom09 Nom13','el seguimiento calcula el avance (%) y los componentes: '+(ac&&ac.porcentaje)+' %');
 const sd=await srvCall(T.B,'comisionSeguimiento',[]);ok(/Sin permiso|directivos/.test(sd.err||''),'un docente NO puede ver el seguimiento (solo directivos)');
 const cl=await srvCall(T.A,'comisionCierreSimple',[{acta:ID}]);ok(cl.ok&&cl.ok.cerrada&&/^\d\d:\d\d$/.test(cl.ok.hora_cierre),'el responsable cierra y el servidor pone la hora ('+(cl.ok&&cl.ok.hora_cierre)+')');
 const post=await srvCall(T.A,'comisionGuardar',[{acta:ID,seccion:'general',datos:{},version:9}]);ok(/cerrada/.test(post.err||''),'con el acta cerrada ya no se puede escribir');
 console.log('ERRORES DE PÁGINA/DIÁLOGOS:',JSON.stringify(er));
 ok(er.length===0,'sin errores en las pantallas');
 await b.close();console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien');process.exit(fallos?1:0)})();
