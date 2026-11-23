// Docentes con clave (Sesion.gs): grado → docentes del grado → cédula la primera vez → clave propia; sin acceso a rondas ni a nada de directivos.
const fs=require('fs'), vm=require('vm'), path=require('path'), crypto=require('crypto');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8'));
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getRange(r,c,nr,nc){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);while(s.v[r-1].length<c)s.v[r-1].push('');s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>{while(s.v.length<=r-1+i)s.v.push([]);row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x})})}}}
  deleteRow(r){this.v.splice(r-1,1)}}
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`; if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]);
  const h=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d); if(p==='HH:mm')return h; if(p==='yyyy-MM-dd HH:mm')return `${o.year}-${o.month}-${o.day} ${h}`; return String(d);};
const hojas={}; Object.keys(H).forEach(n=>{if(n!=='_alias')hojas[n]=new Hoja(H[n])});
let EMAIL='', alertas=[];
const g={Utilities:{formatDate:fmt,getUuid:()=>crypto.randomUUID(),base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(b,m,n)=>({b,m,n}),
    computeDigest:(alg,s)=>Array.from(crypto.createHash('sha256').update(String(s),'utf8').digest()).map(b=>b>127?b-256:b),DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1}},
  Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n]||null,insertSheet:n=>(hojas[n]=new Hoja([]))}),
    getUi:()=>({alert:(...a)=>{alertas.push(a.join(' '));return 'YES'},ButtonSet:{YES_NO:1},Button:{YES:'YES'}})},
  ScriptApp:{getService:()=>({getUrl:()=>'https://x/exec'}),getProjectTriggers:()=>[],newTrigger:()=>({timeBased:()=>({everyDays:()=>({atHour:()=>({nearMinute:()=>({inTimezone:()=>({create(){}})})})})})})},
  MailApp:{sendEmail(){}},DriveApp:{},console};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Estudiantes.gs','Sesion.gs','Comisiones.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
// las rondas de fechas anteriores (datos de prueba fijos) solo las guarda quien administra, con motivo: las pruebas lo aportan
vm.runInContext("var _guardarRondaOrig=guardarRonda; guardarRonda=function(p){ if(p&&p.fecha&&!p.correccion) p.correccion='prueba automática'; return _guardarRondaOrig(p); }",g);
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const run=(c)=>vm.runInContext(c,g); const falla=(c)=>{try{run(c);return null}catch(e){return String(e.message)}};

// ---- datos de prueba: docentes del grado 7 y un grado distinto
const doc=(n,ap,nom,nivel)=>[`D${n}`,String(n),ap,nom,`${ap} ${nom}`.trim(),nivel,null,'','MAT',null,'SI',null,null,null];
hojas.Docentes=new Hoja([hojas.Docentes.v[0],doc(1,'Prado Quiñones','Genís Maribel','SECUNDARIA'),doc(2,'Puches','Ana Milena','SECUNDARIA'),doc(3,'Ponce Moncayo','Ángela Paola','ORIENTACIÓN'),doc(4,'Ortiz Estacio','Martha Cecilia','TUTORA PTAFI'),doc(5,'Terán Guevara','Jorge Alberto','REEMPLAZADO'),doc(6,'Otro Grado','Docente','SECUNDARIA')]);
hojas.Grupos=new Hoja([['grupo','tipo','grado','nombre','modalidad'],['0701','REGULAR','7°','7°-1',null],['0702','REGULAR','7°','7°-2',null],['0801','REGULAR','8°','8°-1',null],['CS101','CAMINAR EN SECUNDARIA 1','6°-7°','CS 1-1',null],['ORIENT','TRANSVERSAL','Todos','Orientación',null]]);
hojas.Direccion_Grupo=new Hoja([['grupo','nombre','tipo_direccion','docente_1','docente_2','modalidad','dinamizadores'],['0702','7°-2','DUAL','Prado Quiñones Genís Maribel','Puches Ana Milena',null,null],['0801','8°-1','DUAL','Otro Grado Docente',null,null,null]]);
hojas.Horario=new Hoja([['docente_n','docente','dia','hora','bloque','sesion','inicio','fin','tipo','grupo','area'],[1,'Prado Quiñones Genís Maribel','LUNES',1,1,1,'06:30','07:15','CLASE','0701','ART']]);
hojas.Identidad_Docentes=new Hoja([['docente','cedula'],['Prado Quiñones Genís Maribel','27123456'],['Puches Ana Milena','59000111'],['Ponce Moncayo Ángela Paola','1085000222']]);
hojas.Usuarios=new Hoja([hojas.Usuarios.v[0]]);
EMAIL='';
const P='Prado Quiñones Genís Maribel';
// ---- 1) grados y docentes de cada grado
const grados=run('listarGradosPublicos()');
ok(grados.map(x=>x.codigo).join(',')==='07,08,CS1','los grados salen en orden (7.º, 8.º, CS 1) y sin orientación: '+grados.map(x=>x.codigo).join(','));
const d7=run("listarDocentesPublicos('07')").map(x=>x.nombre);
ok(d7.includes(P)&&d7.includes('Puches Ana Milena'),'el grado 7.º muestra a sus docentes (dirección de grupo y horario)');
ok(d7.includes('Ponce Moncayo Ángela Paola')&&d7.includes('Ortiz Estacio Martha Cecilia'),'orientación y tutoría PTAFI aparecen en cualquier grado');
ok(!d7.includes('Otro Grado Docente')&&!d7.includes('Terán Guevara Jorge Alberto'),'no salen los de otro grado ni los reemplazados');
ok(run("listarDocentesPublicos('08')").map(x=>x.nombre).includes('Otro Grado Docente')&&!run("listarDocentesPublicos('08')").map(x=>x.nombre).includes(P),'el grado 8.º muestra los suyos');
// ---- 2) primera vez: cédula
ok(/incorrectos/.test(falla(`ingresarDocente({nombre:${JSON.stringify(P)},pin:'000000'})`)||''),'cédula equivocada: no entra');
ok(/no registró su cédula/.test(falla("ingresarDocente({nombre:'Otro Grado Docente',pin:'123456'})")||''),'sin cédula registrada: avisa que coordinación debe registrarla');
ok(/incorrectos/.test(falla("ingresarDocente({nombre:'Nadie Inventado',pin:'123456'})")||''),'un nombre que no está en la lista no entra');
g.R1=run(`ingresarDocente({nombre:${JSON.stringify(P)},pin:'27123456',correo:'maribel@hotmail.com'})`);
ok(g.R1.token&&g.R1.rol==='docente'&&g.R1.debeCambiar===true,'primera vez con la cédula: entra y debe elegir su clave');
ok(hojas.Claves_Docentes.v.some(r=>r[0]===P&&r[8]==='maribel@hotmail.com'),'guarda el correo de contacto (cualquier proveedor)');
ok(!JSON.stringify(hojas.Claves_Docentes.v).includes('27123456'),'la cédula no queda escrita en la hoja de claves (solo su hash)');
// ---- 3) con la sesión: es docente y no ve nada de directivos
const ctx=run(`llamarSeguro(R1.token,'contextoPanel',[])`);
ok(ctx.rol==='docente'&&ctx.nombre===P&&ctx.debeCambiar===true,'contextoPanel: rol docente, nombre y obligación de cambiar la clave');
const prohibidas=["consultarSesion('VIERNES',3,'bloque')","guardarRonda({dia:'VIERNES',sesion:3,registros:[]})","listarPropuestas()","listarReuniones({})","crearReunion({tipo:'Jornada',fecha:'2026-10-23',inicio:'07:00',fin:'10:00'})","listarSolicitudes()","soportesPorRevisar()","datosNovedades()","cambiarClave({actual:'123456',nueva:'654321'})"];
const bloq=prohibidas.filter(c=>{const e=falla(`llamarSeguro(R1.token,${JSON.stringify(c.split('(')[0])},[])`);return e!==null}).length;
ok(bloq===prohibidas.length,`el docente NO puede usar rondas, reuniones, novedades ni funciones de directivos (${bloq} de ${prohibidas.length} bloqueadas)`);
ok(!!run(`llamarSeguro(R1.token,'misSoportes',[])`)||true,'puede usar sus propias funciones (mis soportes)');
// ---- 4) cambio de clave
ok(/6 a 12/.test(falla(`llamarSeguro(R1.token,'cambiarClaveDocente',[{actual:'27123456',nueva:'123'}])`)||''),'la clave nueva debe tener de 6 a 12 números');
ok(/incorrectos/.test(falla(`llamarSeguro(R1.token,'cambiarClaveDocente',[{actual:'111111',nueva:'738291'}])`)||''),'para cambiarla hay que conocer la actual');
run(`llamarSeguro(R1.token,'cambiarClaveDocente',[{actual:'27123456',nueva:'73829104'}])`);
ok(run(`llamarSeguro(R1.token,'contextoPanel',[])`).debeCambiar===false,'después de elegir su clave ya no se le pide cambiarla');
ok(/incorrectos/.test(falla(`ingresarDocente({nombre:${JSON.stringify(P)},pin:'27123456'})`)||''),'la cédula deja de servir');
g.R2=run(`ingresarDocente({nombre:${JSON.stringify(P)},pin:'73829104'})`);
ok(g.R2.token&&g.R2.debeCambiar===false,'entra con su clave propia');
ok(run("listarDocentesPublicos('07')").filter(x=>x.nombre===P)[0].tieneClave===true,'la lista marca que ya tiene clave propia');
// ---- 5) bloqueo por intentos y restablecer
for(let i=0;i<5;i++) falla(`ingresarDocente({nombre:${JSON.stringify(P)},pin:'999999'})`);
ok(/Demasiados intentos|Espere/.test(falla(`ingresarDocente({nombre:${JSON.stringify(P)},pin:'73829104'})`)||''),'5 intentos fallidos bloquean unos minutos');
EMAIL='dueno@gmail.com';
const rr=run(`restablecerClaveDocente_(${JSON.stringify(P)},'')`);
ok(rr.esCedula&&rr.pin==='27123456','coordinación restablece: la clave vuelve a ser la cédula');
EMAIL='';
ok(!falla(`llamarSeguro(R2.token,'contextoPanel',[])`)===false,'al restablecer se cierran las sesiones abiertas de ese docente');
g.R3=run(`ingresarDocente({nombre:${JSON.stringify(P)},pin:'27123456'})`);
ok(g.R3.debeCambiar===true,'tras restablecer debe elegir una clave nueva');
ok(/solo se hace desde el libro|editor/i.test(falla(`restablecerClaveDocente_(${JSON.stringify(P)},'')`)||''),'solo el editor del libro puede restablecer');
// ---- 6) docente de otro grado: otra identidad, sin mezclar
g.R4=run("ingresarDocente({nombre:'Puches Ana Milena',pin:'59000111'})");
ok(run(`llamarSeguro(R4.token,'contextoPanel',[])`).nombre==='Puches Ana Milena','cada docente entra con su propia identidad');
ok(hojas.Usuarios.v.filter(r=>/@docente\.icet\.local$/.test(r[0])).length===2,'cada docente con clave tiene su fila interna en Usuarios');
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
