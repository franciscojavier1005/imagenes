// Acceso por correo, registro, matriz de permisos, carga de soportes y revisión, con hojas y Drive simulados (sin Google).
// Antes: python3 apps_script/pruebas/exportar_hojas.py
const fs=require('fs'), vm=require('vm'), path=require('path');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8')); const M=H._alias;
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getRange(r,c){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x}))}}}
  deleteRow(r){this.v.splice(r-1,1)}}
const hojas={}; Object.keys(H).filter(n=>n!=='_alias').forEach(n=>hojas[n]=new Hoja(H[n]));
hojas.Parametros=new Hoja([['clave','valor'],['soportes_desde','2026-01-01']]);
const pad=n=>String(n).padStart(2,'0');
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  const dia=`${o.year}-${o.month}-${o.day}`; if(p==='yyyy-MM-dd')return dia; if(p==='yyyy-MM-dd HH:mm')return `${dia} ${o.hour==='24'?'00':o.hour}:${o.minute}`;
  if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]); if(p==='HH:mm')return `${o.hour}:${o.minute}`; return String(d);};
// Drive simulado
const archivos=[]; class Carpeta{constructor(n){this.n=n;this.hijos=[];this.id='carpeta_'+n}
  getId(){return this.id} getFoldersByName(n){const x=this.hijos.filter(c=>c.n===n);let i=0;return {hasNext:()=>i<x.length,next:()=>x[i++]}}
  createFolder(n){const c=new Carpeta(n);this.hijos.push(c);return c}
  createFile(b){const f={id:'arch_'+archivos.length,nombre:b.name,mime:b.mime,bytes:b.bytes,carpeta:this.n,privado:false,getId(){return this.id},getUrl(){return 'https://drive/'+this.id},setSharing(){this.privado=true}};archivos.push(f);return f}
  addViewer(){}}
const raices=[]; const g={Utilities:{formatDate:fmt,base64Decode:b=>Array.from(Buffer.from(b,'base64')),newBlob:(bytes,mime,name)=>({bytes,mime,name}),getUuid:()=>require('crypto').randomUUID()},
  Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n],
     insertSheet:n=>{hojas[n]=new Hoja([]);return hojas[n]}}),getUi:()=>({alert(){}})},
  DriveApp:{createFolder:n=>{const c=new Carpeta(n);raices.push(c);return c},getFolderById:id=>{const c=raices.find(r=>r.id===id);if(!c)throw new Error('no existe');return c},
     Access:{PRIVATE:'p'},Permission:{NONE:'n'}},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>'secreto-de-prueba'})},ContentService:{},console};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const api=(fn,args,email,secret='secreto-de-prueba')=>vm.runInContext(`apiEjecutar_(${JSON.stringify({secret,email,fn,args:args||[]})},'secreto-de-prueba')`,g);
const DUENO='dueno@gmail.com', DOC='docente.a@correo.com';

// ---- 1) secreto y matriz
ok(api('contextoPanel',[],DOC,'otro').error==='No autorizado','secreto incorrecto: rechazado');
ok(vm.runInContext("apiEjecutar_({secret:'x',fn:'contextoPanel'},'')",g).error==='No autorizado','sin secreto configurado en el back: rechaza todo');
ok(api('funcionInventada',[],DUENO).error==='Función no permitida','función fuera de la lista: rechazada');
ok(api('contextoPanel',[],'')?.data?.rol==='anonimo','sin correo (sin sesión de Google): rol anónimo');

// ---- 2) registro de un docente nuevo
let c=api('contextoPanel',[],DOC).data;
ok(c.rol==='sin_registro'&&c.docentes.includes(M.A)&&!c.docentes.some(n=>/REEMPLAZADO/.test(n))&&c.textoAutorizacion.includes('Ley 1581'),'correo nuevo: sin_registro, lista de nombres y texto de autorización');
ok(/Sin permiso/.test(api('consultarSesion',['VIERNES',3],DOC).error),'sin registro NO puede ver la ronda');
ok(/Sin permiso/.test(api('datosDashboard',['2026-10-01','2026-10-02',{}],DOC).error),'sin registro NO puede ver el panel');
ok(/autorización/.test(api('solicitarAcceso',[{docente:M.A,autoriza:false}],DOC).error),'no se puede registrar sin aceptar la autorización');
ok(/lista/.test(api('solicitarAcceso',[{docente:'Alguien Inventado',autoriza:true}],DOC).error),'nombre que no está en la lista: rechazado');
ok(api('solicitarAcceso',[{docente:M.A,autoriza:true}],DOC).data.estado==='PENDIENTE','solicitud registrada como PENDIENTE');
ok(api('contextoPanel',[],DOC).data.rol==='pendiente','mientras tanto: rol pendiente');
ok(/Sin permiso/.test(api('misSoportes',[],DOC).error),'pendiente NO puede ver soportes');
ok(/Sin permiso/.test(api('solicitarAcceso',[{docente:M.A,autoriza:true}],DOC).error),'no se puede solicitar dos veces');

// ---- 3) aprobación por un directivo
const sol=api('listarSolicitudes',[],DUENO).data; ok(sol.pendientes.length===1&&sol.pendientes[0].email===DOC&&sol.pendientes[0].docente===M.A,'el directivo ve la solicitud pendiente');
ok(/Sin permiso/.test(api('resolverSolicitud',[{email:DOC,accion:'APROBAR'}],DOC).error),'un docente NO puede aprobar solicitudes');
ok(api('resolverSolicitud',[{email:DOC,accion:'APROBAR'}],DUENO).data.estado==='ACTIVO','el directivo aprueba');
c=api('contextoPanel',[],DOC).data; ok(c.rol==='docente'&&c.docente===M.A&&c.autorizado===true,'desde ahora se reconoce solo: rol docente, autorización ya aceptada');
ok(hojas.Usuarios.v[1][7]!==''&&hojas.Usuarios.v[1][8]!=='','queda registrado quién aprobó y cuándo');

// ---- 4) el docente solo ve lo suyo
const d1=api('datosDashboard',['2026-10-01','2026-10-02',{docente:'Otro Docente',nivel:'SECUNDARIA'}],DOC).data;
ok(d1.filtros.docente===M.A,'el docente pide a otro y el servidor lo fuerza a sí mismo');
ok(/Sin permiso/.test(api('consultarSesion',['VIERNES',3],DOC).error)&&/Sin permiso/.test(api('guardarRonda',[{}],DOC).error),'el docente NO puede usar la ronda');

// ---- 5) una ausencia con soporte pendiente
const hoy=fmt(new Date(),'America/Bogota','yyyy-MM-dd'); const habilAtras=(f,n)=>{let d=new Date(f+'T12:00:00Z');let c=0;while(c<n){d.setUTCDate(d.getUTCDate()-1);if(d.getUTCDay()>=1&&d.getUTCDay()<=5)c++;}return d.toISOString().slice(0,10)};
const F=habilAtras(hoy,2);
hojas.Novedades.v.push([new Date(),F,M.A,'No asistió','N/A','Sin justificación','Amaneció enferma','Coordinador(a)','WhatsApp grupal','N/A','N/A','Todas','Jornada completa',180,'Francisco Cortés','JC','No','SIN JUSTIFICACIÓN']);
let ms=api('misSoportes',[],DOC).data; const ob=ms.obligaciones.find(o=>o.inicio===F);
ok(ob&&['Pendiente','Vencido','En curso'].includes(ob.estado)&&ob.plazoDias===3,`obligación de la ausencia del ${F}: ${ob&&ob.estado}, plazo ${ob&&ob.plazoDias} días (injustificada = 3)`);
ok(ms.tiposDocumento.includes('Incapacidad médica')&&ms.motivos.includes('Incapacidad Médica'),'la pantalla recibe los tipos de documento y los motivos');
const b64=Buffer.from('%PDF-1.4 prueba').toString('base64');
const base={clave:ob.clave,tipoDocumento:'Incapacidad médica',motivoDeclarado:'Incapacidad Médica',mime:'application/pdf',base64:b64,comentario:'3 días'};
ok(/Formato/.test(api('subirSoporte',[Object.assign({},base,{mime:'application/zip'})],DOC).error),'formato no permitido (zip): rechazado');
ok(/tipo de documento/.test(api('subirSoporte',[Object.assign({},base,{tipoDocumento:'cualquiera'})],DOC).error),'tipo de documento inválido: rechazado');
ok(/no corresponde/.test(api('subirSoporte',[Object.assign({},base,{clave:'Otro|2026-01-01'})],DOC).error),'clave de otra ausencia: rechazada');
ok(/supera/.test(api('subirSoporte',[Object.assign({},base,{base64:Buffer.alloc(9*1024*1024,1).toString('base64')})],DOC).error),'archivo de 9 MB: rechazado (límite 8 MB)');
const sub=api('subirSoporte',[base],DOC); ok(sub.ok&&sub.data.estado==='Entregado','soporte cargado: Entregado');
ok(archivos.length===1&&archivos[0].carpeta===M.A&&archivos[0].privado&&/\.pdf$/.test(archivos[0].nombre)&&!/prueba/.test(archivos[0].nombre),'archivo en la subcarpeta del docente, privado, con nombre generado por el sistema');
ok(raices.length===1&&hojas.Parametros.v.some(r=>r[0]==='carpeta_soportes_id'),'carpeta raíz privada creada y su id guardado en Parametros');
ok(/ya tiene un soporte/.test(api('subirSoporte',[base],DOC).error),'no se puede cargar otro mientras el anterior está Entregado');

// ---- 6) revisión por el directivo
const rev=api('soportesPorRevisar',[],DUENO).data; ok(rev.porRevisar.length===1&&rev.porRevisar[0].docente===M.A&&rev.porRevisar[0].url.startsWith('https://drive/'),'el directivo ve el soporte por revisar con su enlace');
ok(/Sin permiso/.test(api('soportesPorRevisar',[],DOC).error)&&/Sin permiso/.test(api('revisarSoporte',[{id:rev.porRevisar[0].id,accion:'ACEPTAR'}],DOC).error),'el docente NO ve la cola de revisión ni revisa');
ok(/Explique/.test(api('revisarSoporte',[{id:rev.porRevisar[0].id,accion:'RECHAZAR',observacion:' '}],DUENO).error),'rechazar exige una observación');
ok(api('revisarSoporte',[{id:rev.porRevisar[0].id,accion:'RECHAZAR',observacion:'Foto ilegible, súbala de nuevo'}],DUENO).data.estado==='Rechazado','soporte rechazado con observación');
ms=api('misSoportes',[],DOC).data; ok(ms.obligaciones.find(o=>o.clave===ob.clave).estado==='Rechazado'&&/ilegible/.test(ms.cargados[0].observacion),'el docente ve "Rechazado" y la observación para corregir');
const sub2=api('subirSoporte',[base],DOC); ok(sub2.ok,'puede volver a cargarlo tras el rechazo');
const rev2=api('soportesPorRevisar',[],DUENO).data.porRevisar[0];
const ac=api('revisarSoporte',[{id:rev2.id,accion:'ACEPTAR',observacion:''}],DUENO).data; ok(ac.estado==='Aceptado'&&ac.novedadesCorregidas===1,'aceptado: 1 novedad corregida');
const nv=hojas.Novedades.v.find(r=>r[2]===M.A&&r[1]===F); ok(nv[5]==='Incapacidad Médica'&&nv[16]==='Sí'&&nv[17]==='SALUD','la novedad pasó de "Sin justificación" a justificada, con el motivo declarado y su categoría');
ok(api('misSoportes',[],DOC).data.obligaciones.find(o=>o.clave===ob.clave).estado==='Aceptado','el docente ve "Aceptado"');
const pan=api('datosDashboard',[F,hoy,{}],DUENO).data; ok(pan.soportes&&pan.soportes.resumen.aceptados>=1,'el panel de coordinación incluye el resumen de soportes');

// ---- 7) autorización pendiente y preregistro por correo
const PRE='pre@correo.com', iC=H.Docentes[0].indexOf('correo'), iN=H.Docentes[0].indexOf('nombre_completo');
const fila=hojas.Docentes.v.findIndex(r=>r[iN]===M.B); hojas.Docentes.v[fila][iC]=PRE;
c=api('contextoPanel',[],PRE).data; ok(c.rol==='docente'&&c.docente===M.B&&c.autorizado===false,'preregistro por correo en la hoja Docentes: rol docente, aún sin autorización');
ok(/autorización/.test(api('subirSoporte',[base],PRE).error),'sin autorización aceptada NO puede cargar soportes');
ok(api('aceptarAutorizacion',[],PRE).data.autorizado===true&&api('contextoPanel',[],PRE).data.autorizado===true,'acepta la autorización y queda registrada');
// ---- 8) rechazados y bloqueados
api('contextoPanel',[],'x@y.com'); api('solicitarAcceso',[{docente:M.C,autoriza:true}],'x@y.com'); api('resolverSolicitud',[{email:'x@y.com',accion:'RECHAZAR'}],DUENO);
ok(api('contextoPanel',[],'x@y.com').data.rol==='bloqueado'&&/Sin permiso/.test(api('datosDashboard',['2026-10-01','2026-10-02',{}],'x@y.com').error),'solicitud rechazada: sin acceso');
ok(api('contextoPanel',[],DUENO).data.rol==='directivo'&&api('consultarSesion',['VIERNES',3],DUENO).ok,'el propietario (editor del libro) es directivo y usa la ronda');
process.exit(fallos?1:0);
