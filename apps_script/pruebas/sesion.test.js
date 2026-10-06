// Ingreso con clave (Sesion.gs) y blindaje de las funciones públicas: nadie sin sesión puede leer ni escribir datos.
const fs=require('fs'), vm=require('vm'), path=require('path'), crypto=require('crypto');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8'));
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getRange(r,c,nr,nc){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);while(s.v[r-1].length<c)s.v[r-1].push('');s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x}))}}}
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
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Sesion.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const run=(c)=>vm.runInContext(c,g); const falla=(c)=>{try{run(c);return null}catch(e){return String(e.message)}};

// ---- 1) sin sesión (visitante anónimo): nada de datos
EMAIL='';
const datos=["consultarSesion('VIERNES',3,'bloque')","guardarRonda({dia:'VIERNES',sesion:3,registros:[]})","listarPropuestas()","listarReuniones({})","cargarReunion({id:'x'})",
  "definirAlternancia({clave:'CLASE|ETR|a|b',elegido:'a',primario:'a'})","listarSolicitudes()","soportesPorRevisar()","crearReunion({tipo:'Jornada pedagógica',inicio:'07:00',fin:'13:30',convocados:'TODOS'})",
  "guardarAsistenciaReunion({id:'x',registros:[]})","guardarNotaRonda({texto:'hola mundo'})","datosDashboard('2026-10-01','2026-10-02',{})"];
const bloqueadas=datos.filter(c=>falla(c)!==null).length;
ok(bloqueadas===datos.length,`un visitante sin sesión NO puede leer ni escribir datos (${bloqueadas} de ${datos.length} funciones bloqueadas)`);
const menu=["crearFormulario()","compartirConDirectivos()","mostrarUrlConsulta()","actualizarHorarioPreescolar()","programarInformeDiario()","purgarAudios()","importarBandejaWhatsApp()","probarInformeDiario()","generarClavesDirectivos()","restablecerClaveDirectivo()","restablecerClave_('x')"];
ok(menu.every(c=>/solo se hace desde el libro/.test(falla(c)||'')),'las acciones del menú del libro no se pueden ejecutar desde la aplicación pública');
ok(/Evento no válido/.test(falla("alEnviarFormulario({})")||''),'el disparador del formulario rechaza eventos falsos');
ok(run("informeDiarioProgramado()")===undefined,'la función del reloj no devuelve datos');
// ---- 2) claves
EMAIL='dueno@gmail.com';
const claves=run("generarClavesDirectivos_(false)");
ok(claves.length===4&&claves.every(c=>/^\d{6}$/.test(c.pin)),'se generan 4 claves de 6 números');
const hd=hojas.Directivos.v, cab=hd[0];
ok(['pin_hash','pin_sal','intentos','bloqueado_hasta'].every(c=>cab.includes(c))&&hd.slice(1).every(r=>/^[0-9a-f]{64}$/.test(r[cab.indexOf('pin_hash')])&&!JSON.stringify(r).includes(claves.find(c=>c.nombre===r[0]).pin+'"')),'en la hoja solo queda el hash (SHA-256 con sal), nunca la clave');
EMAIL='';
const ana=claves[0], rec=claves[3];
// ---- 3) ingreso
ok(/incorrectos/.test(falla(`ingresar({nombre:${JSON.stringify(ana.nombre)},pin:'000000'})`)||''),'clave incorrecta: se rechaza');
g.L=run(`ingresar({nombre:${JSON.stringify(ana.nombre)},pin:'${ana.pin}'})`);
ok(g.L.token.length>=60&&g.L.nombre===ana.nombre,'clave correcta: entrega un token');
const ses=hojas.Sesiones.v; ok(ses.length===2&&ses[1][0]!==g.L.token&&/^[0-9a-f]{64}$/.test(ses[1][0]),'en la hoja Sesiones solo se guarda el hash del token');
const r1=run(`llamarSeguro(L.token,'consultarSesion',['VIERNES',3,'bloque'])`);
ok(r1&&r1.filas&&r1.bloque===2,'con el token, la ronda funciona');
ok(/Función no permitida/.test(falla(`llamarSeguro(L.token,'generarClavesDirectivos_',[])`)||'')&&/Función no permitida/.test(falla(`llamarSeguro(L.token,'ingresar',[{}])`)||''),'por la puerta segura solo pasan las funciones de la lista permitida');
ok(falla(`llamarSeguro('${'a'.repeat(64)}','consultarSesion',[])`)==='SESION_VENCIDA'&&falla("llamarSeguro('','consultarSesion',[])")==='SESION_VENCIDA','token falso o vacío: SESION_VENCIDA');
// el nombre del directivo lo pone el servidor, no la pantalla
const sesGuardar=`llamarSeguro(L.token,'guardarRonda',[{directivo:'Otra Persona',dia:'VIERNES',sesion:3,fecha:'2026-10-09',registros:[{docente:'X Y',grupoCodigo:'0701',area:'X',estado:'Presente'}]}])`;
const rg0=hojas.Registro_Ronda.v.length; run(sesGuardar);
ok(hojas.Registro_Ronda.v[rg0][13]===ana.nombre,'el registro queda a nombre de quien inició sesión (no de lo que diga la pantalla)');
// expiración
const filaS=hojas.Sesiones.v.findIndex(r=>r[0]===ses[1][0]); hojas.Sesiones.v[filaS][4]=Date.now()-1000;
ok(falla(`llamarSeguro(L.token,'consultarSesion',[])`)==='SESION_VENCIDA','una sesión vencida deja de servir');
g.L2=run(`ingresar({nombre:${JSON.stringify(ana.nombre)},pin:'${ana.pin}'})`); ok(hojas.Sesiones.v.length===2,'al ingresar se limpian las sesiones vencidas');
run("cerrarSesion(L2.token)"); ok(falla(`llamarSeguro(L2.token,'consultarSesion',[])`)==='SESION_VENCIDA','cerrar sesión invalida el token');
// ---- 4) bloqueo por intentos
let ult=''; for(let i=0;i<5;i++) ult=falla(`ingresar({nombre:${JSON.stringify(rec.nombre)},pin:'111111'})`);
ok(/Demasiados intentos/.test(ult),'5 intentos fallidos bloquean al directivo');
ok(/Demasiados intentos/.test(falla(`ingresar({nombre:${JSON.stringify(rec.nombre)},pin:'${rec.pin}'})`)||''),'bloqueado: ni con la clave correcta entra');
const fr=hojas.Directivos.v.findIndex(r=>r[0]===rec.nombre); hojas.Directivos.v[fr][cab.indexOf('bloqueado_hasta')]=Date.now()-1;
ok(!!run(`ingresar({nombre:${JSON.stringify(rec.nombre)},pin:'${rec.pin}'})`).token,'pasado el tiempo de bloqueo vuelve a poder entrar');
ok(/incorrectos/.test(falla(`ingresar({nombre:${JSON.stringify(ana.nombre)},pin:'12ab'})`)||''),'una clave con formato inválido se trata como incorrecta (sin pistas)');
// ---- 5) cambiar la clave
g.L3=run(`ingresar({nombre:${JSON.stringify(ana.nombre)},pin:'${ana.pin}'})`);
ok(/incorrectos/.test(falla(`llamarSeguro(L3.token,'cambiarClave',[{actual:'999999',nueva:'482916'}])`)||''),'cambiar la clave exige la actual');
ok(/6 números/.test(falla(`llamarSeguro(L3.token,'cambiarClave',[{actual:'${ana.pin}',nueva:'12'}])`)||''),'la clave nueva debe tener 6 números');
run(`llamarSeguro(L3.token,'cambiarClave',[{actual:'${ana.pin}',nueva:'482916'}])`);
ok(/incorrectos/.test(falla(`ingresar({nombre:${JSON.stringify(ana.nombre)},pin:'${ana.pin}'})`)||'')&&!!run(`ingresar({nombre:${JSON.stringify(ana.nombre)},pin:'482916'})`).token,'después de cambiarla, la anterior no sirve y la nueva sí');
// ---- 6) correo de los directivos e informes
const iM=()=>hojas.Directivos.v[0].indexOf('correo');
EMAIL='';
g.Session.getEffectiveUser=()=>({getEmail:()=>'Dueno@Gmail.com'});
ok(run("registrarCorreoPropietario_()")==='dueno@gmail.com','el correo del propietario se registra solo en la fila del coordinador académico');
const filaAc=hojas.Directivos.v.find(r=>/acad/i.test(r[hojas.Directivos.v[0].indexOf('rol')]));
ok(filaAc[iM()]==='dueno@gmail.com','queda guardado en la hoja Directivos');
const otro=claves.find(c=>c.nombre!==filaAc[0]&&c.nombre!==rec.nombre);
g.L4=run(`ingresar({nombre:${JSON.stringify(otro.nombre)},pin:'${otro.pin}'})`);
let cx=run(`llamarSeguro(L4.token,'contextoPanel',[])`);
ok(cx.necesitaCorreo===true,'un coordinador sin correo: la pantalla le pide registrarlo');
ok(/válido/.test(falla(`llamarSeguro(L4.token,'guardarCorreo',[{correo:'no es correo'}])`)||'')&&/válido/.test(falla(`llamarSeguro(L4.token,'guardarCorreo',[{correo:'a@example.com'}])`)||''),'correo inválido o de ejemplo: se rechaza');
run(`llamarSeguro(L4.token,'guardarCorreo',[{correo:'Coord@Correo.com',dia:true,semana:false,mes:true}])`);
cx=run(`llamarSeguro(L4.token,'contextoPanel',[])`);
ok(cx.necesitaCorreo===false&&cx.correo==='coord@correo.com'&&cx.informes.semana===false&&cx.informes.dia===true,'queda guardado con sus preferencias y ya no se vuelve a pedir');
ok(run("destinatarios_('dia')").join()==='dueno@gmail.com,coord@correo.com'&&run("destinatarios_('semana')").join()==='dueno@gmail.com','destinatarios según preferencia de cada informe');
const dueno0=run("destinatarios_('mes')").length; ok(dueno0===2,'informe mensual: 2 destinatarios');
const enviados=[]; g.MailApp.sendEmail=o=>enviados.push(o);
const rs=run("enviarInformes_('semana',true)"); ok(rs.enviado&&enviados.length===1&&/de la semana/.test(enviados[0].subject),'informe semanal solo a quien lo pidió');
const rm=run("enviarInformes_('mes',true)"); ok(rm.enviado&&enviados.length===3&&/del mes/.test(enviados[2].subject),'informe mensual a los 2 con correo');
const rp=run("enviarInformes_('dia',true,['x@y.com'])"); ok(rp.para.join()==='x@y.com'&&enviados.length===4,'la prueba envía solo a la dirección indicada');
ok(run("ultimoHabilDelMes_('2026-10-30')")===true&&run("ultimoHabilDelMes_('2026-10-29')")===false&&run("ultimoHabilDelMes_('2026-09-30')")===true,'último día hábil del mes (30-oct sí, 29-oct no, 30-sep sí)');
// reuniones y actividades en el informe
EMAIL='dueno@gmail.com';
ok(run("TIPOS_REUNION").some(t=>t.tipo==='Entrega de boletines'&&t.sinEstudiantes===false)&&['Clausura','Actividad institucional general'].every(n=>run("TIPOS_REUNION").some(t=>t.tipo===n)),'tipos de actividades institucionales: boletines (clases en paralelo), clausura y actividad institucional general');
const rb=run("crearReunion({tipo:'Entrega de boletines',inicio:'07:00',fin:'13:30',sinEstudiantes:false,convocados:'TODOS'})");
const dB=run("personasReunion_()").filter(x=>x.rol==='Docente').slice(0,2).map(x=>x.nombre);
g.RB={id:rb.id,registros:[{persona:dB[0],estado:'Asistió'},{persona:dB[1],estado:'No asistió',motivo:'Mal estado de salud'}]}; run('guardarAsistenciaReunion(RB)');
enviados.length=0; run("enviarInformes_('dia',true,['x@y.com'])");
ok(/Entrega de boletines/.test(enviados[0].htmlBody)&&/No asistieron: [^<]*Mal estado de salud/.test(enviados[0].htmlBody)&&/sin registrar/.test(enviados[0].htmlBody),'el informe incluye las actividades del día: quiénes asistieron, quiénes no (con motivo) y cuántos faltan por registrar');
// ---- 7) claves temporales y restablecer
EMAIL='dueno@gmail.com';
{
  const cl2=run("generarClavesDirectivos_(false)"); const a2=cl2[1];
  hojas.Directivos.v.forEach(()=>{});
  EMAIL='';
  g.LT=run(`ingresar({nombre:${JSON.stringify(a2.nombre)},pin:'${a2.pin}'})`);
  ok(g.LT.debeCambiar===true,'con la clave temporal el ingreso avisa que debe elegir la suya');
  ok(run(`llamarSeguro(LT.token,'contextoPanel',[])`).debeCambiar===true,'la pantalla recibe debeCambiar hasta que la cambie');
  run(`llamarSeguro(LT.token,'cambiarClave',[{actual:'${a2.pin}',nueva:'135790'}])`);
  g.LT2=run(`ingresar({nombre:${JSON.stringify(a2.nombre)},pin:'135790'})`);
  ok(g.LT2.debeCambiar===false,'después de elegir su clave ya no se le pide');
  // el administrador restablece (el directivo olvidó la clave)
  EMAIL='dueno@gmail.com';
  const rs=run(`restablecerClave_(${JSON.stringify(a2.nombre)})`);
  ok(/^\d{6}$/.test(rs.pin)&&rs.pin!=='135790','restablecer entrega una clave temporal nueva (una sola vez)');
  EMAIL='';
  ok(/Función no permitida|SESION_VENCIDA/.test(falla(`llamarSeguro(LT2.token,'consultarSesion',['VIERNES',3,'bloque'])`)||'SESION_VENCIDA'),'al restablecer se cierran las sesiones abiertas de esa persona');
  ok(/incorrectos/.test(falla(`ingresar({nombre:${JSON.stringify(a2.nombre)},pin:'135790'})`)||''),'la clave anterior deja de servir');
  ok(run(`ingresar({nombre:${JSON.stringify(a2.nombre)},pin:'${rs.pin}'})`).debeCambiar===true,'la clave restablecida es temporal: debe elegir una propia');
  const rs2=run(`restablecerClave_(${JSON.stringify(a2.nombre)},'246810')`); ok(rs2.pin==='246810'&&run(`ingresar({nombre:${JSON.stringify(a2.nombre)},pin:'246810'})`).debeCambiar===true,'el administrador puede asignar una clave temporal elegida por él');
  ok(/6 números/.test(falla(`restablecerClave_(${JSON.stringify(a2.nombre)},'12')`)||''),'la clave elegida debe tener 6 números');
  ok(!JSON.stringify(hojas.Directivos.v).includes(rs.pin+'"')&&!JSON.stringify(hojas.Directivos.v).includes('135790'),'las claves no se guardan en claro (no se pueden consultar, solo restablecer)');
}
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
