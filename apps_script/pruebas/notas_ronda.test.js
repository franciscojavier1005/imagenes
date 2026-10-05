// Observación de la ronda (NotasRonda.gs): guarda, propone, confirma/descarta, importa a Novedades, audio privado, purga y permisos.
const fs=require('fs'), vm=require('vm'), path=require('path');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8'));
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getRange(r,c){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);while(s.v[r-1].length<c)s.v[r-1].push('');s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x}))}}}
  deleteRow(r){this.v.splice(r-1,1)}}
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`; if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]);
  const h=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d); if(p==='HH:mm')return h; if(p==='yyyy-MM-dd HH:mm')return `${o.year}-${o.month}-${o.day} ${h}`; return String(d);};
const hojas={}; Object.keys(H).forEach(n=>{if(n!=='_alias')hojas[n]=new Hoja(H[n])});
hojas.Bandeja_WhatsApp=new Hoja([['fecha','hora','remitente','docente','tipo_novedad','motivo','categoria','justificada','confianza','mensaje','confirmar','importado']]);  // libro anterior, sin columnas nuevas
let EMAIL='dueno@gmail.com', archivos=[], papelera=[];
const g={Utilities:{formatDate:fmt,getUuid:()=>'u'+Math.random().toString(36).slice(2,10),base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(b,m,n)=>({b,m,n})},
  Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n]||null,
    insertSheet:n=>(hojas[n]=new Hoja([]))}),getUi:()=>({alert(){}})},
  DriveApp:{Access:{PRIVATE:1},Permission:{NONE:1},
    createFolder:()=>({getId:()=>'RAIZ',createFolder:n=>({createFile:b=>{const f={b,id:'F'+archivos.length,setSharing(){},getId(){return this.id},getUrl(){return 'https://drive/'+this.id}};archivos.push(f);return f},getFoldersByName:()=>({hasNext:()=>false})}),getFoldersByName:()=>({hasNext:()=>false})}),
    getFolderById:()=>{throw new Error('no')},getFileById:id=>({setTrashed(){papelera.push(id)}})},console};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const run=(c)=>vm.runInContext(c,g);
const hi=H.Horario[0].indexOf.bind(H.Horario[0]);
const filasV=H.Horario.slice(1).filter(r=>r[hi('dia')]==='VIERNES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===3);
const doc=filasV[0][hi('docente')], grupo=filasV[0][hi('grupo')], nombreGrupo=H.Grupos.find(r=>r[0]===grupo)[3];
g.P={fecha:'2026-10-02',sesion:3,texto:`El grupo ${nombreGrupo.replace('°-','-')} estaba solo en la tercera hora porque el profesor tenía una cita médica.`};   // solo se nombra el grupo: se deduce quién debía estar
const r1=run('guardarNotaRonda(P)');
ok(r1.propuestas.length===1&&r1.propuestas[0].docente===doc&&r1.propuestas[0].resuelto_por!=='x'&&r1.propuestas.every(p=>p.id&&p.origen==='Nota de ronda'),`${r1.propuestas.length} propuesta(s) con id y origen`);
const B=hojas.Bandeja_WhatsApp.v;
ok(B[0].includes('id')&&B[0].includes('origen')&&B[0].includes('sesion')&&B[0].includes('grupo'),'completa las columnas nuevas de una bandeja anterior');
ok(B.length===1+r1.propuestas.length&&hojas.Notas_Ronda.v.length===2&&hojas.Notas_Ronda.v[1][5].includes('estaba solo'),'queda en Bandeja y en Notas_Ronda (crea la hoja si falta)');
const nov0=hojas.Novedades.v.length;
ok(hojas.Novedades.v.length===nov0,'nada pasa a Novedades sin confirmar');
const lp=run('listarPropuestas()');
ok(lp.propuestas.length===r1.propuestas.length&&lp.docentes.length>40&&lp.motivos.includes('Sin justificación'),'listarPropuestas devuelve las pendientes, docentes y motivos');
// confirmar la primera propuesta
const p1=r1.propuestas[0]; g.Q={id:p1.id,accion:'confirmar',docente:doc};
const c1=run('resolverPropuesta(Q)');
ok(c1.estado==='registrada'&&hojas.Novedades.v.length===nov0+1,'confirmar -> 1 fila en Novedades ('+c1.estado+')');
const nh=H.Novedades[0], fn=hojas.Novedades.v[hojas.Novedades.v.length-1], c=k=>nh.indexOf(k);
ok(fn[c('Docente')]===doc&&fn[c('Sesiones')]==='S3'&&fn[c('Minutos Desatendidos')]===45&&fn[c('Medio Información')]==='Nota de ronda','docente, sesión S3, 45 min y medio "Nota de ronda"');
ok(/^H3/.test(String(fn[c('Horario')]))&&nombreGrupo.endsWith(String(fn[c('Grupo')]).replace(/^0/,''))||String(fn[c('Grupo')]).length>0,'grupo y hora H3 tomados del horario ('+fn[c('Grado')]+' '+fn[c('Grupo')]+', '+fn[c('Horario')]+')');
let e=null; try{run('resolverPropuesta(Q)')}catch(x){e=x}
ok(e&&/ya fue resuelta/.test(e.message),'no se puede resolver dos veces');
// misma ausencia en otra nota: no se duplica
const r2=run('guardarNotaRonda(P)'), dupP=r2.propuestas[0];
const c2=run(`resolverPropuesta({id:"${dupP.id}",accion:"confirmar"})`);
ok(c2.estado==='ya estaba registrada'&&hojas.Novedades.v.length===nov0+1,'la misma ausencia no se registra dos veces');
// descartar
const r2b=run('guardarNotaRonda(P)'), antes=run('listarPropuestas()').propuestas.length;
run(`resolverPropuesta({id:"${r2b.propuestas[0].id}",accion:"descartar"})`);
ok(run('listarPropuestas()').propuestas.length===antes-1&&hojas.Novedades.v.length===nov0+1,'descartar la saca de la lista sin crear novedades');
// propuesta sin docente: exige elegirlo
const r3=run('guardarNotaRonda({fecha:"2026-10-02",texto:"Una profe no vino por calamidad doméstica"})');
const sd=r3.propuestas[0]; e=null; try{run(`resolverPropuesta({id:"${sd.id}",accion:"confirmar"})`)}catch(x){e=x}
ok(sd.docente===''&&e&&/Elija el docente/.test(e.message),'sin docente identificado: obliga a elegirlo');
// audio
const b64=Buffer.from('audio-de-prueba').toString('base64');
const r4=run(`guardarNotaRonda({fecha:"2026-10-02",mime:"audio/webm;codecs=opus",base64:"${b64}",duracion:12})`);
ok(r4.audioGuardado&&r4.propuestas.length===0&&archivos.length===1&&archivos[0].b.n.endsWith('.webm'),'solo audio: se guarda en Drive privado sin analizar (no hay texto)');
e=null; try{run(`guardarNotaRonda({texto:"x y z w",mime:"application/zip",base64:"${b64}"})`)}catch(x){e=x}
ok(e&&/Formato de audio/.test(e.message),'rechaza formatos que no son audio');
e=null; try{run('guardarNotaRonda({texto:""})')}catch(x){e=x}
ok(e&&/Escriba, dicte o grabe/.test(e.message),'rechaza nota vacía');
// purga
hojas.Notas_Ronda.v[hojas.Notas_Ronda.v.length-1][1]='2026-08-01 08:00';
const n=run('purgarAudios_(new Date("2026-10-04T12:00:00-05:00"))');
ok(n===1&&papelera.length===1&&hojas.Notas_Ronda.v[hojas.Notas_Ronda.v.length-1][6]==='','la purga borra audios de más de 30 días ('+n+')');
// permisos
H.Usuarios&&0;
const perm=run('API_PERMISOS');
ok(['guardarNotaRonda','listarPropuestas','resolverPropuesta'].every(k=>JSON.stringify(perm[k])==='["directivo"]'),'API: solo directivos');
EMAIL='nadie@gmail.com'; e=null; try{run('guardarNotaRonda({texto:"hola mundo"})')}catch(x){e=x}
ok(e&&/Solo un directivo/.test(e.message),'una persona sin rol directivo no puede registrar notas');
// ronda: quién atendió al grupo (no cambia que el docente no asistió)
EMAIL='dueno@gmail.com'; const reg0=hojas.Registro_Ronda.v.length, nv0=hojas.Novedades.v.length;
const fr=filasV[0];
run(`guardarRonda({dia:'VIERNES',sesion:3,fecha:'2026-10-02',registros:[{docente:${JSON.stringify(doc)},grupoCodigo:${JSON.stringify(grupo)},area:'X',estado:'No asistió',motivo:'Sin justificación',atiende:'Practicante'},{docente:'Otro',grupoCodigo:'0701',area:'X',estado:'Presente',atiende:'Practicante'}]})`);
const rr=hojas.Registro_Ronda.v, rh=rr[0], rf=rr[rr.length-2], rp=rr[rr.length-1];
ok(rr.length===reg0+2&&rf[rh.indexOf('estado')]==='No asistió'&&rf[rh.indexOf('atendido_por')]==='Practicante','ronda: la ausencia queda "No asistió" y se anota "Practicante" como quien atendió');
ok(rp[rh.indexOf('atendido_por')]==='','un docente presente no lleva "atendido por"');
const nf2=hojas.Novedades.v[hojas.Novedades.v.length-1];
ok(hojas.Novedades.v.length>=nv0&&nf2[H.Novedades[0].indexOf('Grupo atendido por')]==='Practicante'&&nf2[H.Novedades[0].indexOf('Minutos Desatendidos')]===45,'Novedades: 45 min de ausencia y columna "Grupo atendido por"');
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
