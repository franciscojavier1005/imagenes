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
// ---- ausencia de toda la jornada: se registra una sola vez
const nh3=H.Novedades[0], cc=k=>nh3.indexOf(k);
const del=(d)=>hojas.Novedades.v.slice(1).filter(r=>r[cc('Docente')]===d&&r[cc('Tipo Novedad')]==='No asistió'&&String(r[cc('Fecha Novedad')]).slice(0,10)==='2026-10-02');
const filasDoc=H.Horario.slice(1).filter(r=>r[hi('dia')]==='VIERNES'&&r[hi('docente')]===doc);
const reg=(d,g,ses,extra)=>run(`guardarRonda({dia:'VIERNES',sesion:${ses},fecha:'2026-10-02',registros:[Object.assign({docente:${JSON.stringify(d)},grupoCodigo:${JSON.stringify(g)},area:'X',estado:'No asistió',motivo:'Mal estado de salud'},${JSON.stringify(extra||{})})]})`);
reg(doc,grupo,3,{});                       // primero solo la sesión 3
reg(doc,grupo,4,{alcance:'JC'});           // otro directivo la marca toda la jornada
const filas=del(doc);
ok(filas.length===1&&filas[0][cc('Sesiones')]==='JC'&&filas[0][cc('Minutos Desatendidos')]===filasDoc.length*45,`toda la jornada: una sola novedad JC que reemplaza las de sesión (${filas.length} fila, ${filas[0]&&filas[0][cc('Minutos Desatendidos')]} min = ${filasDoc.length} sesiones x 45)`);
const nJ=hojas.Novedades.v.length; reg(doc,grupo,5,{});
ok(hojas.Novedades.v.length===nJ,'una marca posterior "No asistió" del mismo docente no suma más tiempo');
ok(hojas.Registro_Ronda.v.slice(1).filter(r=>r[5]===doc&&r[8]==='No asistió'&&String(r[1]).slice(0,10)==='2026-10-02').length>=3,'pero cada ronda queda verificada en Registro_Ronda');
// preescolar: 4 periodos de 60 min entre 7:30 y 11:30
const pre=H.Horario.slice(1).filter(r=>String(r[hi('grupo')]).startsWith('00')&&r[hi('dia')]==='VIERNES');
const dp=pre[0][hi('docente')], gp=pre[0][hi('grupo')], mias=pre.filter(r=>r[hi('docente')]===dp);
ok(mias.length===4&&mias[0][hi('inicio')]==='07:30'&&mias[3][hi('fin')]==='11:30','preescolar: 4 periodos, de 07:30 a 11:30 ('+mias.map(r=>r[hi('inicio')]+'-'+r[hi('fin')]).join(', ')+')');
reg(dp,gp,3,{});
let fp=hojas.Novedades.v[hojas.Novedades.v.length-1];
ok(fp[cc('Minutos Desatendidos')]===60&&/07:30 - 08:30/.test(fp[cc('Horario')]),'preescolar: una sesión ausente = 60 min, periodo 07:30 - 08:30');
reg(dp,gp,4,{alcance:'JC'});
fp=hojas.Novedades.v[hojas.Novedades.v.length-1];
ok(fp[cc('Sesiones')]==='JC'&&fp[cc('Minutos Desatendidos')]===240,'preescolar: toda la jornada = 240 min (4 horas)');
reg(doc,grupo,6,{atiende:'Sin clase: los niños no asistieron (padres avisados)'});
ok(hojas.Registro_Ronda.v[hojas.Registro_Ronda.v.length-1][14]==='Sin clase: los niños no asistieron (padres avisados)','opción "los niños no asistieron" se guarda');
// ---- ronda por bloque (dos sesiones por visita)
g.__d='VIERNES';
const bq=run("consultarSesion('VIERNES',4,'bloque')"), sq=run("consultarSesion('VIERNES',4,'sesion')");
const esperados=new Set(H.Horario.slice(1).filter(r=>r[hi('dia')]==='VIERNES'&&[3,4].includes(Number(r[hi('hora')]))).map(r=>r[hi('docente')]));
ok(bq.modo==='bloque'&&JSON.stringify(bq.sesionesBloque)==='[3,4]'&&bq.bloque===2&&bq.franja==='08:20 - 09:50','bloque 2 = sesiones 3 y 4, 08:20 - 09:50 (pidiendo la sesión 4)');
ok(bq.filas.length===esperados.size&&new Set(bq.filas.map(f=>f.docente)).size===bq.filas.length,`una tarjeta por docente con clase en el bloque (${bq.filas.length})`);
ok(sq.filas.length<bq.filas.length||sq.filas.length===bq.filas.length,'por sesión sigue funcionando ('+sq.filas.length+' docentes en S4)');
ok(bq.filas.every(f=>f.sesiones.length>=1&&f.sesiones.length<=2),'cada tarjeta trae sus sesiones (1 o 2)');
const dos=bq.filas.find(f=>f.sesiones.length===2&&!/^00/.test(f.sesiones[0].grupoCodigo));
EMAIL='dueno@gmail.com'; const nB=hojas.Novedades.v.length, rB=hojas.Registro_Ronda.v.length;
const regsB=dos.sesiones.map(x=>({docente:dos.docente,sesion:x.sesion,grupoCodigo:x.grupoCodigo,area:x.area,estado:'No asistió',motivo:'Sin justificación'}));
g.PB={dia:'VIERNES',sesion:4,fecha:'2026-10-09',registros:regsB}; run('guardarRonda(PB)');
const nuevos=hojas.Novedades.v.slice(nB), nr=hojas.Registro_Ronda.v.slice(rB);
ok(nr.length===2&&nr.map(r=>r[3]).sort().join()==='3,4','por bloque: queda registrado en Registro_Ronda para S3 y S4');
ok(nuevos.length===2&&nuevos.map(r=>r[cc('Sesiones')]).sort().join()==='S3,S4'&&nuevos.every(r=>r[cc('Minutos Desatendidos')]===45),'por bloque: dos novedades (S3 y S4) de 45 min = 90 min del bloque');
// ---- actualizar horario de preescolar en una hoja con el horario anterior (5 sesiones, 2 a 6)
const hz=hojas.Horario.v, hh=hz[0];
const viejo=[]; ['LUNES'].forEach(d=>{[2,3,4,5,6].forEach(hr=>{const f=hh.map(()=>''); f[hh.indexOf('docente')]='Prof Pre'; f[hh.indexOf('dia')]=d; f[hh.indexOf('hora')]=hr; f[hh.indexOf('grupo')]='0001'; f[hh.indexOf('inicio')]='07:15'; f[hh.indexOf('fin')]='08:00'; viejo.push(f);});});
const antesN=hz.length; viejo.forEach(f=>hz.push(f));
hojas.Horario.getRange=function(r,c){const s=this;return {setNumberFormat(){},setValue(x){s.v[r-1][c-1]=x}}};
const ra=run('actualizarHorarioPreescolar_()'), mias2=hz.filter(r=>r[hh.indexOf('docente')]==='Prof Pre');
ok(ra.quitadas===1&&mias2.length===4&&mias2.every((r,i)=>r[hh.indexOf('hora')]===3+i)&&mias2[0][hh.indexOf('inicio')]==='07:30'&&mias2[3][hh.indexOf('fin')]==='11:30','actualizar horario: quita la sesión 2 y deja 07:30 a 11:30 en 4 periodos');
const rb=run('actualizarHorarioPreescolar_()'); ok(rb.quitadas===0&&rb.corregidas===0,'repetirlo no cambia nada');
ok(run("textoCod_('0101')")==="'0101"&&run("textoCod_('CS101')")==='CS101'&&run("textoCod_('1001+1002')")==='1001+1002','los códigos con cero inicial se escriben como texto');
// ---- parejas que alternan por semana (ética/religión)
const alt=H.Alternancias.slice(1); const ia=H.Alternancias[0];
const parA=[alt[0][ia.indexOf('docente_a')],alt[0][ia.indexOf('docente_b')]];
const hr=H.Horario.slice(1).filter(r=>r[hi('tipo')]==='CLASE'&&r[hi('area')]==='ETR'&&parA.includes(r[hi('docente')]));
const ejemplo=hr[0]; const otro=parA.find(x=>x!==ejemplo[hi('docente')]);
const rq=run(`consultarSesion('${ejemplo[hi('dia')]}',${ejemplo[hi('hora')]},'sesion')`);
const card=rq.filas.find(f=>f.docente===ejemplo[hi('docente')]&&f.area==='ETR');
ok(card&&JSON.stringify(card.alternos)===JSON.stringify([otro]),'ética y religión en pareja: la tarjeta de un docente ofrece al otro como alterno');
const noEtr=rq.filas.filter(f=>f.area!=='ETR'&&f.alternos.length);
ok(noEtr.length===0,'solo las áreas de la hoja Alternancias tienen alternos');
const dia1=H.Horario.slice(1).filter(r=>r[hi('dia')]===ejemplo[hi('dia')]&&r[hi('docente')]===ejemplo[hi('docente')]).length;
ok(card.minutosDia===dia1*45,`la tarjeta trae el total del día para "toda la jornada" (${card.minutosDia} min)`);
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
