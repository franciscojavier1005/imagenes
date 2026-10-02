// Front (Front.gs) + back (Api.gs y demás) conectados por una "red" simulada. Antes: python3 apps_script/pruebas/exportar_hojas.py
const fs=require('fs'), vm=require('vm'), path=require('path');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8')); const M=H._alias;
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}} appendRow(r){this.v.push(r)}
  getRange(r,c){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x}))}}} deleteRow(r){this.v.splice(r-1,1)}}
const hojas={}; Object.keys(H).filter(n=>n!=='_alias').forEach(n=>hojas[n]=new Hoja(H[n]));
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  const dia=`${o.year}-${o.month}-${o.day}`; if(p==='yyyy-MM-dd')return dia; if(p==='yyyy-MM-dd HH:mm')return `${dia} ${o.hour}:${o.minute}`;
  if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]); if(p==='HH:mm')return `${o.hour}:${o.minute}`; return String(d);};
const SECRETO='secreto-compartido-de-prueba-0123456789';
let propsBack={API_SECRET:SECRETO,MODO_BACK:'SI'}, propsFront={BACK_URL:'https://back/exec',API_SECRET:SECRETO};
const back={Utilities:{formatDate:fmt,base64Decode:b=>Array.from(Buffer.from(b,'base64')),newBlob:(a,m,n)=>({bytes:a,mime:m,name:n}),getUuid:()=>require('crypto').randomUUID()},Logger:{log(){}},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n],insertSheet:n=>{hojas[n]=new Hoja([]);return hojas[n]}}),getUi:()=>({alert(){}})},
  DriveApp:{}, PropertiesService:{getScriptProperties:()=>({getProperty:k=>propsBack[k]})},
  ContentService:{createTextOutput:t=>({texto:t,setMimeType(){return this}}),MimeType:{JSON:'json',TEXT:'text'}},HtmlService:{},console};
vm.createContext(back);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),back,{filename:f}));
// red simulada: lo que el front envía por POST llega a doPost del back
let ultimaPeticion=null, EMAIL='dueno@gmail.com', responder=null;
const front={Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>propsFront[k]})},
  UrlFetchApp:{fetch:(url,opt)=>{ultimaPeticion={url,opt,cuerpo:JSON.parse(opt.payload)};
    if(responder) return {getContentText:()=>responder};
    back.__e={postData:{contents:opt.payload}}; const r=vm.runInContext('doPost(__e)',back); return {getContentText:()=>r.texto};}},
  ScriptApp:{getService:()=>({getUrl:()=>'https://front/exec'})},
  HtmlService:{createHtmlOutputFromFile:n=>({pagina:n,setTitle(){return this},addMetaTag(){return this}})},console};
vm.createContext(front); vm.runInContext(fs.readFileSync(path.join(__dirname,'..','front','Front.gs'),'utf8'),front,{filename:'Front.gs'});
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const f=(js)=>vm.runInContext(js,front); const falla=(js)=>{try{f(js);return null}catch(e){return e.message}};

ok(back.doGet({}).texto==='ICET API','el BACK no sirve ninguna pantalla: solo responde "ICET API" (MODO_BACK=SI)');
ok(f('doGet({parameter:{}})').pagina==='Dashboard'&&f("doGet({parameter:{p:'ronda'}})").pagina==='Consulta','el FRONT sirve el panel por defecto y la ronda con ?p=ronda');
let c=f('contextoPanel()'); ok(c.rol==='directivo'&&ultimaPeticion.cuerpo.email==='dueno@gmail.com'&&ultimaPeticion.cuerpo.secret===SECRETO&&ultimaPeticion.cuerpo.fn==='contextoPanel','front -> back: viaja el correo de Google y el secreto; el propietario es directivo');
ok(ultimaPeticion.opt.method==='post'&&ultimaPeticion.url==='https://back/exec','petición POST a la URL del back');
// otro usuario: el front manda SU correo
EMAIL='nuevo@gmail.com'; c=f('contextoPanel()'); ok(c.rol==='sin_registro'&&c.docentes.includes(M.A),'otra persona (correo distinto): sin_registro, con la lista de nombres');
ok(f(`solicitarAcceso({docente:${JSON.stringify(M.A)},autoriza:true})`).estado==='PENDIENTE','se registra a través del front');
EMAIL='dueno@gmail.com'; ok(f('listarSolicitudes()').pendientes.length===1,'el directivo ve la solicitud por el front');
f("resolverSolicitud({email:'nuevo@gmail.com',accion:'APROBAR'})"); EMAIL='nuevo@gmail.com';
ok(f('contextoPanel()').rol==='docente'&&f('datosDashboard("2026-10-01","2026-10-02",{docente:"otro"})').filtros.docente===M.A,'aprobado: el docente se reconoce solo y solo ve lo suyo');
ok(/Sin permiso/.test(falla("consultarSesion('VIERNES',3)")),'los errores del back llegan al front como Error con su mensaje');
// el correo no se puede falsificar desde la pantalla: lo pone el front con Session, no los argumentos
EMAIL='nuevo@gmail.com'; f('contextoPanel()'); ok(ultimaPeticion.cuerpo.email==='nuevo@gmail.com'&&!JSON.stringify(ultimaPeticion.cuerpo.args).includes('dueno@gmail.com'),'el correo lo toma el front de la sesión de Google (no de lo que envíe la pantalla)');
// ronda: el directivo queda registrado con su identidad
EMAIL='dueno@gmail.com'; const fr=hojas.Horario.v.slice(1).find(r=>r[2]==='VIERNES'&&r[8]==='CLASE');
f(`guardarRonda({directivo:'Alguien Falso',dia:'VIERNES',sesion:3,fecha:'2026-10-02',registros:[{docente:${JSON.stringify(fr[1])},grupoCodigo:'0601',area:'CAS',estado:'Presente',motivo:'',minutos:'',actividad:'N/A',obs:''}]})`);
ok(hojas.Registro_Ronda.v[hojas.Registro_Ronda.v.length-1][13]==='dueno@gmail.com','guardarRonda: el directivo registrado es el que Google identificó, no el nombre que envió la pantalla');
// secreto equivocado / respuesta rara / back caído
propsFront.API_SECRET='otro-secreto'; ok(/No autorizado/.test(falla('contextoPanel()')),'con un secreto distinto el back rechaza al front'); propsFront.API_SECRET=SECRETO;
responder='<html>error de Google</html>'; ok(/no respondió/.test(falla('contextoPanel()')),'respuesta que no es JSON: mensaje claro'); responder=null;
// el back directo, sin secreto
const dp=(cuerpo)=>{back.__e={postData:{contents:cuerpo}};return JSON.parse(vm.runInContext('doPost(__e)',back).texto)};
ok(dp('no es json').error==='Petición inválida'&&dp(JSON.stringify({fn:'contextoPanel',email:'dueno@gmail.com'})).error==='No autorizado','el back rechaza una petición sin secreto aunque diga ser el propietario');
process.exit(fallos?1:0);
