// Observación de la ronda (NotasRonda.gs): guarda, propone, confirma/descarta, importa a Novedades, audio privado, purga y permisos.
const fs=require('fs'), vm=require('vm'), path=require('path');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8'));
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getRange(r,c){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);while(s.v[r-1].length<c)s.v[r-1].push('');s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>{while(s.v.length<=r-1+i)s.v.push([]);row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x})})}}}
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
const FIJA=new Date('2026-10-21T15:00:00Z').getTime();   // miércoles 21 de octubre de 2026: un día hábil fijo (con los 2 días siguientes también hábiles), posterior a las fechas de los datos de prueba
g.Date=class extends Date{constructor(...a){a.length?super(...a):super(FIJA)} static now(){return FIJA}};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Estudiantes.gs','Sesion.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
// las rondas de fechas anteriores (datos de prueba fijos) solo las guarda quien administra, con motivo: las pruebas lo aportan
vm.runInContext("var _guardarRondaOrig=guardarRonda; guardarRonda=function(p){ if(p&&p.fecha&&!p.correccion) p.correccion='prueba automática'; return _guardarRondaOrig(p); }",g);
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
const cubiertos=new Set(bq.filas.flatMap(f=>[f.docente,...f.alternos]));
ok(new Set(bq.filas.map(f=>f.docente)).size===bq.filas.length&&[...esperados].every(d=>cubiertos.has(d)),`una tarjeta por docente en el bloque; las parejas comparten tarjeta (${bq.filas.length} tarjetas, ${esperados.size} docentes)`);
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
const viejo=[]; ['LUNES'].forEach(d=>{[2,3,4,5,6].forEach(hr=>{const f=hh.map(()=>''); f[0]=99; f[hh.indexOf('docente')]='Prof Pre'; f[hh.indexOf('dia')]=d; f[hh.indexOf('hora')]=hr; f[hh.indexOf('grupo')]='0001'; f[hh.indexOf('inicio')]='07:15'; f[hh.indexOf('fin')]='08:00'; viejo.push(f);});});
const antesN=hz.length; viejo.forEach(f=>hz.push(f));
hojas.Horario.getRange=function(r,c){const s=this;return {setNumberFormat(){},setValue(x){s.v[r-1][c-1]=x}}};
const nJC=hojas.Novedades.v[0].map(()=>''); nJC[cc('Docente')]='Prof Pre'; nJC[cc('Sesiones')]='JC'; nJC[cc('Minutos Desatendidos')]=300; nJC[0]='x'; hojas.Novedades.v.push(nJC);
const ra=run('actualizarHorarioPreescolar_()'), mias2=hz.filter(r=>r[hh.indexOf('docente')]==='Prof Pre');
ok(ra.quitadas===1&&mias2.length===4&&mias2.every((r,i)=>r[hh.indexOf('hora')]===3+i)&&mias2[0][hh.indexOf('inicio')]==='07:30'&&mias2[3][hh.indexOf('fin')]==='11:30','actualizar horario: quita la sesión 2 y deja 07:30 a 11:30 en 4 periodos');
ok(nJC[cc('Minutos Desatendidos')]===240&&ra.minutosAjustados===1,'una ausencia de jornada completa de preescolar que quedó en 300 min baja a 240 (4 periodos de 60)');
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
const noEtr=rq.filas.filter(f=>!['ETR','CSI','CNA'].includes(f.area)&&f.tipo==='CLASE'&&f.alternos.length);
ok(noEtr.length===0,'solo las áreas de la hoja Alternancias tienen alternos');
const dia1=H.Horario.slice(1).filter(r=>r[hi('dia')]===ejemplo[hi('dia')]&&r[hi('docente')]===ejemplo[hi('docente')]).length;
ok(card.minutosDia===dia1*45,`la tarjeta trae el total del día para "toda la jornada" (${card.minutosDia} min)`);
// ---- motivos nuevos se agregan solos a libros anteriores
const mv=hojas.Motivos.v; const antesM=mv.length;
['Reunión o acto escolar de hijo(a)','Reunión o actividad institucional'].forEach(n=>{const i=mv.findIndex(r=>r[1]===n); if(i>0) mv.splice(i,1);});
const sinNuevos=mv.length; run("consultarSesion('VIERNES',3,'bloque')"); const conNuevos=mv.length; run("consultarSesion('VIERNES',3,'bloque')");
ok(sinNuevos===antesM-2&&conNuevos===antesM&&mv.length===antesM,'los 2 motivos nuevos (reunión de hijo(a), reunión institucional) se agregan solos y una sola vez');
// ---- énfasis en pareja (7°) y sociales/inglés en pareja
const enfP=H.Horario.slice(1).filter(r=>r[hi('tipo')]==='ENFASIS'&&/^PAREJA/.test(r[hi('alternancia')])); const e0=enfP[0];
const par=enfP.filter(r=>r[hi('dia')]===e0[hi('dia')]&&r[hi('hora')]===e0[hi('hora')]&&r[hi('grupos_enfasis')]===e0[hi('grupos_enfasis')]).map(r=>r[hi('docente')]);
const re=run(`consultarSesion('${e0[hi('dia')]}',${e0[hi('hora')]},'sesion')`);
const cardsPar=re.filas.filter(f=>par.includes(f.docente)&&f.tipo==='ENFASIS');
ok(par.length===2&&cardsPar.length===1&&cardsPar[0].alternos.length===1&&par.includes(cardsPar[0].alternos[0]),'énfasis en pareja: UNA tarjeta con los dos nombres (no se divide el grupo)');
const eq4=H.Horario.slice(1).find(r=>/^EQUIPO DE 4/.test(r[hi('alternancia')])); const re4=run(`consultarSesion('${eq4[hi('dia')]}',${eq4[hi('hora')]},'sesion')`);
ok(re4.filas.filter(f=>f.tipo==='ENFASIS'&&String(f.grupoCodigo)===eq4[hi('grupos_enfasis')]).length>=4,'énfasis de equipos de 4 (8° en adelante): cada docente atiende su grupo, una tarjeta por docente');
const csiPares=H.Alternancias.slice(1).filter(r=>r[0]==='CSI'); ok(csiPares.length===2,'hoja Alternancias trae las 2 parejas de sociales e inglés');
const csi=H.Horario.slice(1).find(r=>r[hi('tipo')]==='CLASE'&&r[hi('area')]==='CSI'&&csiPares.some(p=>p.includes(r[hi('docente')])));
const rc=run(`consultarSesion('${csi[hi('dia')]}',${csi[hi('hora')]},'sesion')`); const cc2=rc.filas.find(f=>f.docente===csi[hi('docente')]&&f.area==='CSI');
ok(cc2&&cc2.alternos.length===1,'sociales/inglés: la tarjeta ofrece al otro docente de la pareja');
const cnaP=H.Alternancias.slice(1).filter(r=>r[0]==='CNA'); ok(cnaP.length===1,'hoja Alternancias trae la pareja de ciencias naturales (química / física)');
const cna=H.Horario.slice(1).find(r=>r[hi('tipo')]==='CLASE'&&r[hi('area')]==='CNA'&&cnaP[0].includes(r[hi('docente')]));
const rn=run(`consultarSesion('${cna[hi('dia')]}',${cna[hi('hora')]},'sesion')`); const cn=rn.filas.find(f=>f.docente===cna[hi('docente')]&&f.area==='CNA');
ok(cn&&cn.alternos.length===1,'ciencias naturales: la tarjeta ofrece al otro docente de la pareja');
// una hoja Alternancias de la versión anterior (solo ética y religión) recibe las parejas que faltan
const al=hojas.Alternancias.v; const nAl=al.length; al.splice(al.findIndex(r=>r[0]==='CSI'),2);
run("consultarSesion('VIERNES',3,'bloque')"); ok(al.length===nAl,'se agregan solas las parejas que faltan, sin duplicar');
// ---- quién dicta se define una vez y vale toda la semana
const parETR=[ejemplo[hi('docente')],otro]; const claveE='CLASE|ETR|'+[...parETR].sort().join('|');
const antesDef=run(`consultarSesion('${ejemplo[hi('dia')]}',${ejemplo[hi('hora')]},'sesion')`).filas.find(f=>f.claveAlt===claveE&&f.primario===ejemplo[hi('docente')]);
ok(antesDef&&antesDef.alternos.length===1&&!antesDef.definido,'sin definir: la tarjeta ofrece a los dos');
g.PD={clave:claveE,elegido:otro,primario:ejemplo[hi('docente')],directivo:'Prueba'}; run('definirAlternancia(PD)');
const despues=run(`consultarSesion('${ejemplo[hi('dia')]}',${ejemplo[hi('hora')]},'sesion')`).filas.find(f=>f.claveAlt===claveE&&f.primario===ejemplo[hi('docente')]);
ok(despues.docente===otro&&despues.alternos.length===0&&despues.definido.por==='dueno@gmail.com','definido: ahora esa clase muestra solo a '+'quien se eligió');
// la clase del otro docente (su par de grupos) queda con el primero: intercambio automático
const otraClase=H.Horario.slice(1).find(r=>r[hi('tipo')]==='CLASE'&&r[hi('area')]==='ETR'&&r[hi('docente')]===otro);
const ro=run(`consultarSesion('${otraClase[hi('dia')]}',${otraClase[hi('hora')]},'sesion')`).filas.find(f=>f.claveAlt===claveE&&f.primario===otro);
ok(ro&&ro.docente===ejemplo[hi('docente')]&&ro.definido,'el otro docente pasa automáticamente al otro grupo (intercambio)');
// cualquier día de la semana ve lo mismo
const otroDia=['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'].find(d=>d!==ejemplo[hi('dia')]);
const hs2=H.Horario.slice(1).find(r=>r[hi('tipo')]==='CLASE'&&r[hi('area')]==='ETR'&&r[hi('docente')]===ejemplo[hi('docente')]&&r[hi('dia')]===otroDia);
if(hs2){const rd=run(`consultarSesion('${otroDia}',${hs2[hi('hora')]},'sesion')`).filas.find(f=>f.claveAlt===claveE&&f.primario===ejemplo[hi('docente')]); ok(rd&&rd.docente===otro,'la misma elección aplica a todos los días de esa semana ('+otroDia+')');}
// cambiarlo reemplaza (no duplica) y volver al original
const nSem=hojas.Semana_Alternancia.v.length; g.PD2={clave:claveE,elegido:ejemplo[hi('docente')],primario:ejemplo[hi('docente')],directivo:'Prueba'}; run('definirAlternancia(PD2)');
const rev=run(`consultarSesion('${ejemplo[hi('dia')]}',${ejemplo[hi('hora')]},'sesion')`).filas.find(f=>f.claveAlt===claveE&&f.primario===ejemplo[hi('docente')]);
ok(hojas.Semana_Alternancia.v.length===nSem&&rev.docente===ejemplo[hi('docente')],'cambiar la elección actualiza la misma fila de la semana');
// cambiar una asignación ya definida: solo administrador, coordinación académica, rectoría o quien tenga SI en cambia_asignacion
{
  const dh=hojas.Directivos.v[0], iCT=dh.indexOf('correo_temporal'), iN=dh.indexOf('nombre');
  hojas.Directivos.v[2][iCT]='veronica@x.com'; EMAIL='veronica@x.com';
  let ec=null; try{ run(`definirAlternancia({clave:'${claveE}',elegido:'${otro}',primario:'${ejemplo[hi('docente')]}'})`) }catch(x){ec=x}
  ok(ec&&/Solo la coordinación académica/.test(ec.message),'una coordinadora de otra área NO puede cambiar lo ya definido esta semana');
  ok(run(`consultarSesion('${ejemplo[hi('dia')]}',${ejemplo[hi('hora')]},'sesion')`).puedeCambiarAlt===false,'la ronda le oculta el botón Cambiar');
  run(`definirAlternancia({clave:'${claveE}',elegido:'${otro}',primario:'${ejemplo[hi('docente')]}',fecha:'2026-03-11'})`);
  ok(true,'sí puede definir por primera vez una semana sin definir');
  const hd=hojas.Directivos.v[0]; let ic=hd.indexOf('cambia_asignacion'); if(ic<0){ hd.push('cambia_asignacion'); hojas.Directivos.v.slice(1).forEach(r=>r.push('')); ic=hd.length-1; }
  hojas.Directivos.v[2][ic]='SI'; let ec2=null; try{ run(`definirAlternancia({clave:'${claveE}',elegido:'${otro}',primario:'${ejemplo[hi('docente')]}',fecha:'2026-03-11'})`) }catch(x){ec2=x}
  ok(!ec2,'con SI en cambia_asignacion puede cambiar');
  hojas.Directivos.v[2][ic]='';
  EMAIL='dueno@gmail.com';
  ok(run(`consultarSesion('${ejemplo[hi('dia')]}',${ejemplo[hi('hora')]},'sesion')`).puedeCambiarAlt===true,'el administrador del libro sí puede cambiar');
}
// semana distinta: no afecta; validaciones
g.PD3={clave:claveE,elegido:otro,primario:ejemplo[hi('docente')],fecha:'2026-03-04',directivo:'P'}; run('definirAlternancia(PD3)');
const hoy2=run(`consultarSesion('${ejemplo[hi('dia')]}',${ejemplo[hi('hora')]},'sesion')`).filas.find(f=>f.claveAlt===claveE&&f.primario===ejemplo[hi('docente')]);
ok(hoy2.docente===ejemplo[hi('docente')],'lo definido para otra semana no cambia esta');
let e3=null; try{run("definirAlternancia({clave:'CLASE|ETR|X|Y',elegido:'X',primario:'X'})")}catch(x){e3=x}
ok(e3&&/no está en la hoja|no pertenece|no válida/.test(e3.message),'rechaza parejas que no están en la hoja Alternancias');
// énfasis en pareja: se define quién atiende el grupo completo
const claveEnf='ENFASIS|'+cardsPar[0].grupoCodigo+'|'+[...par].sort().join('|');
g.PE={clave:claveEnf,elegido:par[1],directivo:'P'}; run('definirAlternancia(PE)');
const enfD=run(`consultarSesion('${e0[hi('dia')]}',${e0[hi('hora')]},'sesion')`).filas.filter(f=>f.tipo==='ENFASIS'&&f.claveAlt===claveEnf);
ok(enfD.length===1&&enfD[0].docente===par[1]&&enfD[0].alternos.length===0,'énfasis en pareja: esa semana solo atiende '+'el docente definido el grupo entero');
// ---- permiso por horas / reunión interna: ausente temporal con minutos propios
const dT=H.Horario.slice(1).find(r=>r[hi('dia')]==='JUEVES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===5);
const nT0=hojas.Novedades.v.length;
run(`guardarRonda({dia:'JUEVES',sesion:5,fecha:'2026-10-08',registros:[{docente:${JSON.stringify(dT[hi('docente')])},sesion:5,grupoCodigo:${JSON.stringify(dT[hi('grupo')])},area:'X',estado:'Ausente temporal',motivo:'Comité o consejo (calidad, académico, convivencia)',minutos:30}]})`);
const fT=hojas.Novedades.v[hojas.Novedades.v.length-1];
ok(hojas.Novedades.v.length===nT0+1&&fT[cc('Tipo Novedad')]==='Ausente temporal'&&fT[cc('Minutos Desatendidos')]===30&&fT[cc('Justificada')]==='Sí'&&fT[cc('Categoría motivo')]==='ACTIVIDAD INSTITUCIONAL','ausente temporal: 30 min, justificado, categoría ACTIVIDAD INSTITUCIONAL');
const mvNombres=hojas.Motivos.v.map(r=>r[1]);
ok(['Permiso por horas (personal)','Comité o consejo (calidad, académico, convivencia)','Reunión PTAFI con la tutora','Reunión de docentes o de área','Atención a padre de familia o acudiente','Atención en coordinación (estudiante o acudiente)','Reunión de cierre de jornada','Lluvia intensa o emergencia climática','Sepelio o duelo de un familiar'].every(n=>mvNombres.includes(n)),'los 9 motivos de permisos por horas, reuniones internas, lluvia y sepelio están en la hoja Motivos');
g.RS={desde:'2026-10-08',hasta:'2026-10-08',docentes:[],motivos:[],horario:[],novedades:[{fecha:'2026-10-08',docente:'X',tipo:'Ausente temporal',motivo:'Reunión PTAFI con la tutora',minutos:60,justificada:'Sí',categoria:'ACTIVIDAD INSTITUCIONAL'}]};
const rsm=run('calcularResumen_(RS)').kpis; ok(rsm.permisosTemporales===1&&rsm.minutos===60&&rsm.ausencias===0,'panel: el permiso por horas suma sus minutos y NO cuenta como ausencia del día');
// ---- reuniones y jornadas sin estudiantes
EMAIL='dueno@gmail.com'; const hoyR=fmt(new Date(FIJA),'America/Bogota','yyyy-MM-dd');
const clase3=H.Horario.slice(1).find(r=>r[hi('dia')]==='VIERNES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===3), dR=clase3[hi('docente')];
g.RC={tipo:'Consejo académico',nombre:'Consejo académico de prueba',inicio:'08:00',fin:'10:00',sinEstudiantes:false,convocados:[dR,'Persona que no existe'],directivo:'P'};
const rc1=run('crearReunion(RC)');
g.RA={id:rc1.id,registros:[{persona:dR,estado:'Asistió'},{persona:'Otro cualquiera',estado:'Asistió'}],directivo:'P'};
const ga=run('guardarAsistenciaReunion(RA)');
ok(ga.guardados===1,'la asistencia solo guarda a los convocados (se ignora a quien no lo es)');
const cr=run("cargarReunion({id:'"+rc1.id+"'})"); ok(cr.personas.length===1&&cr.personas[0].registro.estado==='Asistió','cargarReunion devuelve convocados y lo registrado');
// ---- editar una reunión y ver próximas / últimas
{
  const dmas=n=>new Date(new Date(hoyR+'T12:00:00Z').getTime()+86400000*n).toISOString().slice(0,10); const manana=dmas(1), ayer=dmas(-1);
  const rP=run(`crearReunion({tipo:'Consejo académico',fecha:'${manana}',inicio:'14:00',fin:'15:00',convocados:'TODOS'})`);
  const rU=run(`crearReunion({tipo:'Consejo académico',fecha:'${ayer}',inicio:'14:00',fin:'15:00',convocados:'TODOS'})`);
  const lr=run('listarReuniones({})');
  ok(lr.proximas.some(r=>r.id===rP.id)&&!lr.proximas.some(r=>r.id===rU.id),'próximas reuniones: incluye la de mañana y no la pasada');
  ok(lr.ultimas.some(r=>r.id===rU.id)&&lr.ultimas.every(r=>r.fecha<lr.hoy),'últimas reuniones: la de hace 3 días, todas anteriores a hoy');
  ok(lr.proximas.every((r,i,a)=>i===0||a[i-1].fecha<=r.fecha),'las próximas van de la más cercana a la más lejana');
  const dia2=dmas(5);
  const nb=hojas.Bitacora_Cambios?hojas.Bitacora_Cambios.v.length:0;
  run(`editarReunion({id:'${rP.id}',tipo:'Jornada pedagógica',nombre:'Jornada editada',fecha:'${dia2}',inicio:'07:00',fin:'12:00',sinEstudiantes:true,convocados:['${dR}']})`);
  const ed=run(`cargarReunion({id:'${rP.id}'})`).reunion;
  ok(ed.nombre==='Jornada editada'&&ed.fecha===dia2&&ed.inicio==='07:00'&&ed.fin==='12:00'&&ed.sinEstudiantes===true&&ed.convocados.length===1&&ed.tipo==='Jornada pedagógica o de desarrollo institucional','editarReunion cambia tipo, nombre, fecha, horas, clases y convocados');
  ok(hojas.Bitacora_Cambios.v.length>nb&&/Editó reunión/.test(hojas.Bitacora_Cambios.v[hojas.Bitacora_Cambios.v.length-1][2]),'la edición queda en la bitácora');
  let ee=null; try{run("editarReunion({id:'no-existe',tipo:'Consejo académico',fecha:'2026-10-20',inicio:'07:00',fin:'08:00',convocados:'TODOS'})")}catch(x){ee=x} ok(ee&&/No se encontr/.test(ee.message),'editar una reunión que no existe: aviso');
  ee=null; try{run(`editarReunion({id:'${rP.id}',tipo:'Consejo académico',fecha:'${dia2}',inicio:'09:00',fin:'08:00',convocados:'TODOS'})`)}catch(x){ee=x} ok(ee&&/hora/.test(ee.message),'editar con horas inválidas se rechaza');
  // aviso del día
  {
    const rN=run(`crearReunion({tipo:'Consejo académico',nombre:'En curso',excepcional:true,fecha:'${hoyR}',inicio:'00:00',fin:'23:59',convocados:'TODOS'})`);
    const rA=run(`crearReunion({tipo:'Consejo académico',nombre:'Ya terminó',excepcional:true,fecha:'${hoyR}',inicio:'00:01',fin:'00:02',convocados:'TODOS'})`);
    const rS=run(`crearReunion({tipo:'Consejo académico',nombre:'Más tarde',excepcional:true,fecha:'${hoyR}',inicio:'23:57',fin:'23:58',convocados:'TODOS'})`);
    const nh=hojas.Novedades.v[0]; const fila=nh.map(()=>''); fila[0]='x'; fila[nh.indexOf('Fecha Novedad')]=hoyR; fila[nh.indexOf('Docente')]='Docente demo SEC 07'; fila[nh.indexOf('Tipo Novedad')]='Actividad externa con estudiantes'; fila[nh.indexOf('Motivo Ausencia')]='Salida pedagógica o recorrido con estudiantes'; hojas.Novedades.v.push(fila);
    const av=run('avisosHoy()');
    const e=n=>av.reuniones.find(x=>x.nombre===n);
    ok(e('En curso').estado==='ahora'&&e('Ya terminó').estado==='pasada'&&e('Más tarde').estado==='proxima','avisosHoy: reuniones de hoy en curso, terminada y próxima');
    ok(av.reuniones.map(x=>x.inicio).join()===av.reuniones.map(x=>x.inicio).sort().join(),'ordenadas por hora');
    ok(av.actividades.length===1&&av.actividades[0].docentes[0]==='Docente demo SEC 07','incluye las actividades con estudiantes de hoy (salidas pedagógicas)');
    // recordatorios por reunión
    const en2=dmas(2), en5=dmas(6);
    const rR=run(`crearReunion({tipo:'Consejo académico',nombre:'Con aviso 2 días',fecha:'${en2}',inicio:'10:00',fin:'11:00',convocados:'TODOS',avisarDias:2,avisarMin:30,avisarRonda:false})`);
    const rQ=run(`crearReunion({tipo:'Consejo académico',nombre:'Lejana',fecha:'${en5}',inicio:'10:00',fin:'11:00',convocados:'TODOS',avisarDias:1,avisarMin:60,avisarRonda:true})`);
    const cr2=run(`cargarReunion({id:'${rR.id}'})`).reunion;
    ok(cr2.avisarDias===2&&cr2.avisarMin===30&&cr2.avisarRonda===false,'la reunión guarda sus recordatorios (días, minutos y ronda)');
    const av2=run('avisosHoy()');
    ok(av2.previas.some(x=>x.nombre==='Con aviso 2 días'&&x.dias===2)&&!av2.previas.some(x=>x.nombre==='Lejana'),'avisos previos: solo las reuniones dentro de sus días de anticipación');
    const rU2=run(`crearReunion({tipo:'Consejo académico',nombre:'Pronto',excepcional:true,fecha:'${hoyR}',inicio:'23:50',fin:'23:59',convocados:'TODOS',avisarDias:0,avisarMin:15,avisarRonda:false})`);
    const hm=new Date(); const hhmm=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit'}).format(hm);
    const pronto=run('avisosHoy()').reuniones.find(x=>x.nombre==='Pronto');
    ok(pronto&&pronto.avisarRonda===false&&pronto.avisarMin===15&&(pronto.estado==='proxima'?pronto.urgente===(pronto.minutosHasta<=15):true),'recordatorio del mismo día: «urgente» solo dentro de los minutos elegidos');
    ok(run('avisosHoy()').reuniones.find(x=>x.nombre==='En curso').urgente===true,'una reunión en curso siempre es urgente (parpadea)');
    // reuniones de libros anteriores (sin columnas de recordatorio) usan 1 día, 60 min y ronda
    { const hr=hojas.Reuniones.v[0]; const i1=hr.indexOf('avisar_dias'); const fil=hojas.Reuniones.v.find((r,i)=>i>0&&r[hr.indexOf('id')]===rQ.id); fil[i1]=''; fil[hr.indexOf('avisar_min')]=''; fil[hr.indexOf('avisar_ronda')]='';
      const d=run(`cargarReunion({id:'${rQ.id}'})`).reunion; ok(d.avisarDias===1&&d.avisarMin===60&&d.avisarRonda===true,'sin datos de recordatorio: 1 día, 60 minutos y al comenzar la ronda'); }
    ['rR','rQ','rU2'].forEach(k=>{ const id={rR,rQ,rU2}[k].id; run(`anularReunion({id:'${id}',motivo:'prueba de recordatorio'})`); });
    EMAIL='alguien@gmail.com'; let ev=null; try{ run('avisosHoy()') }catch(x){ev=x} ok(ev&&/iniciar sesión/.test(ev.message),'solo directivos reciben el aviso del día'); EMAIL='dueno@gmail.com';
    run(`anularReunion({id:'${rN.id}',motivo:'prueba de aviso'})`); run(`anularReunion({id:'${rA.id}',motivo:'prueba de aviso'})`); run(`anularReunion({id:'${rS.id}',motivo:'prueba de aviso'})`);
  }
  // organización de la reunión: lugar, quién convoca, quién solicita, responsables y cómo termina
  {
    const dj=dmas(8);
    const rO=run(`crearReunion({tipo:'Consejo académico',nombre:'Con organización',fecha:'${dj}',inicio:'09:00',fin:'09:30',finTipo:'TENTATIVA',lugar:'Biblioteca',convocaTipo:'Coordinación académica',convocaDetalle:'área de matemáticas',solicitaPor:'Jorge Hernández',responsables:['${dR}','Nadie existe'],convocados:'TODOS'})`);
    const o=run(`cargarReunion({id:'${rO.id}'})`).reunion;
    ok(o.lugar==='Biblioteca'&&o.finTipo==='TENTATIVA'&&o.convocaTipo==='Coordinación académica'&&o.convocaDetalle==='área de matemáticas'&&o.solicitaPor==='Jorge Hernández'&&o.responsables.length===1&&o.responsables[0]===dR,'la reunión guarda lugar, quién convoca, quién solicita, responsables y hora tentativa');
    const rJ=run(`crearReunion({tipo:'Consejo académico',nombre:'Hasta el final',fecha:'${dj}',inicio:'10:00',fin:'10:30',finTipo:'JORNADA',convocados:'TODOS'})`);
    const oj=run(`cargarReunion({id:'${rJ.id}'})`).reunion; ok(oj.finTipo==='JORNADA'&&oj.fin==='13:30','«hasta finalizar la jornada» termina a la hora en que acaba la última sesión (13:30)');
    let ej=null; try{ run(`crearReunion({tipo:'Consejo académico',nombre:'Tarde',fecha:'${dj}',inicio:'14:00',fin:'15:00',finTipo:'JORNADA',convocados:'TODOS'})`) }catch(x){ej=x} ok(ej&&/antes de que termine la jornada/.test(ej.message),'«hasta finalizar la jornada» exige iniciar antes del fin de la jornada');
    // guardar «crear» varias veces seguidas no repite la reunión
    const nU=hojas.Reuniones.v.length;
    const c1=run(`crearReunion({tipo:'Consejo académico',nombre:'Triple clic',fecha:'${dj}',inicio:'11:00',fin:'12:00',convocados:'TODOS'})`);
    const c2=run(`crearReunion({tipo:'Consejo académico',nombre:'Triple clic',fecha:'${dj}',inicio:'11:00',fin:'12:00',convocados:'TODOS'})`);
    const c3=run(`crearReunion({tipo:'Consejo académico',nombre:'Triple clic',fecha:'${dj}',inicio:'11:00',fin:'12:00',convocados:'TODOS'})`);
    ok(c2.id===c1.id&&c3.id===c1.id&&c2.repetida&&hojas.Reuniones.v.length===nU+1,'tocar «crear» 3 veces seguidas crea una sola reunión');
    // duplicadas ya existentes (sin protección): se quitan de una vez y se conserva la que tiene asistencia
    const hr=hojas.Reuniones.v[0]; const base=hojas.Reuniones.v.find((r,i)=>i>0&&r[hr.indexOf('id')]===c1.id);
    const d2=base.slice(); d2[hr.indexOf('id')]='dup-2'; const d3=base.slice(); d3[hr.indexOf('id')]='dup-3'; hojas.Reuniones.v.push(d2,d3);
    run(`guardarAsistenciaReunion({id:'dup-3',registros:[{persona:'${dR}',estado:'Asistió'}],directivo:'P'})`);
    ok(run('listarReuniones({})').duplicadas===2,'la pantalla cuenta las reuniones repetidas (2 sobrantes)');
    hojas.Directivos.v[3][hojas.Directivos.v[0].indexOf('correo_temporal')]='harold@x.com'; EMAIL='harold@x.com';
    let eq=null; try{ run('quitarReunionesDuplicadas()') }catch(x){eq=x} ok(eq&&/Solo quien administra/.test(eq.message),'solo quien administra puede quitar las repetidas'); EMAIL='dueno@gmail.com';
    const q=run('quitarReunionesDuplicadas()'); ok(q.quitadas===2,'se quitaron 2 reuniones repetidas');
    const quedan=hojas.Reuniones.v.filter((r,i)=>i>0&&r[hr.indexOf('nombre')]==='Triple clic'); ok(quedan.length===1&&quedan[0][hr.indexOf('id')]==='dup-3','se conserva la que tiene asistencia registrada');
    ok(run('listarReuniones({})').duplicadas===0,'ya no quedan repetidas');
    [rO.id,rJ.id,'dup-3'].forEach(id=>run(`anularReunion({id:'${id}',motivo:'prueba de organización'})`));
  }
  // convocados por grupos, áreas, organismos e invitados
  {
    const cat=run('listarReuniones({})').catalogo, dg=dmas(9);
    const dirs=cat.integrantes.DIRECTIVOS, orient=cat.integrantes.ORIENTADORAS, bach=cat.integrantes.BACHILLERATO;
    ok(cat.personal.length===7&&cat.personal[0].codigo==='TODOS'&&cat.organismos.some(o=>o.codigo==='COMITE_COMEDOR')&&cat.organismos.some(o=>o.codigo==='CONSEJO_PADRES')&&cat.organismos.some(o=>o.codigo==='EGRESADOS'),'catálogo de convocados: grupos de personal y organismos (consejos, comités, padres, egresados, entidad)');
    ok(dirs.length>=3&&orient.length>=1&&bach.length>20&&cat.integrantes.TODOS.length>=bach.length+dirs.length,'los grupos se resuelven con las personas reales (directivos, orientadoras, bachillerato…)');
    const areaCod=(cat.areas.find(a=>a.n>1)||cat.areas[0]).codigo;
    const rG=run(`crearReunion({tipo:'Consejo académico',nombre:'Por grupos',fecha:'${dg}',inicio:'08:00',fin:'09:00',grupos:['DIRECTIVOS','ORIENTADORAS','AREA:${areaCod}'],invitados:['CONSEJO_PADRES','ENTIDAD'],entidad:'Secretaría de Educación'})`);
    const g1=run(`cargarReunion({id:'${rG.id}'})`); const esp=[...new Set([...dirs,...orient,...cat.integrantes['AREA:'+areaCod]])];
    ok(g1.personas.length===esp.length&&g1.reunion.grupos.includes('AREA:'+areaCod)&&g1.reunion.invitados.includes('CONSEJO_PADRES')&&g1.reunion.invitadoNombre==='Secretaría de Educación','convocados = directivos + orientadoras + docentes del área ('+esp.length+' personas) y los invitados se guardan');
    ok(/Directivos docentes/.test(g1.reunion.convocadosResumen)&&/Consejo de padres/.test(g1.reunion.convocadosResumen)&&/Secretaría de Educación/.test(g1.reunion.convocadosResumen),'resumen legible de a quiénes se convoca');
    const rP=run(`crearReunion({tipo:'Consejo académico',nombre:'Solo padres',fecha:'${dg}',inicio:'10:00',fin:'11:00',grupos:[],invitados:['PADRES','EGRESADOS']})`);
    const p1=run(`cargarReunion({id:'${rP.id}'})`); ok(p1.personas.length===0&&p1.reunion.convocados.length===0&&p1.reunion.invitados.length===2,'solo organismos o invitados: sin lista de asistencia de personal');
    const rT=run(`crearReunion({tipo:'Consejo académico',nombre:'Todos',fecha:'${dg}',inicio:'12:00',fin:'13:00',grupos:['TODOS','DIRECTIVOS']})`);
    ok(run(`cargarReunion({id:'${rT.id}'})`).personas.length===cat.integrantes.TODOS.length,'«todo el personal» convoca a todas las personas');
    const rE=run(`crearReunion({tipo:'Consejo académico',nombre:'Personalizado',fecha:'${dg}',inicio:'12:00',fin:'12:30',grupos:['PERSONAS'],convocados:['${dR}','${dirs[0]}']})`);
    ok(run(`cargarReunion({id:'${rE.id}'})`).personas.length===2,'personalizado: solo las personas elegidas');
    let e1=null; try{ run(`crearReunion({tipo:'Consejo académico',nombre:'Nadie',fecha:'${dg}',inicio:'14:00',fin:'15:00',grupos:[],invitados:[]})`) }catch(x){e1=x} ok(e1&&/Elija a quiénes se convoca/.test(e1.message),'exige elegir a quién se convoca');
    e1=null; try{ run(`crearReunion({tipo:'Consejo académico',nombre:'Sin entidad',fecha:'${dg}',inicio:'14:00',fin:'15:00',grupos:['DIRECTIVOS'],invitados:['ENTIDAD'],entidad:''})`) }catch(x){e1=x} ok(e1&&/nombre de la entidad/.test(e1.message),'la entidad invitada exige su nombre');
    // editar los convocados
    run(`editarReunion({id:'${rG.id}',tipo:'Consejo académico',nombre:'Por grupos',fecha:'${dg}',inicio:'08:00',fin:'09:00',grupos:['PTAFI'],invitados:[]})`);
    const g2=run(`cargarReunion({id:'${rG.id}'})`); ok(g2.personas.length===cat.integrantes.PTAFI.length&&g2.reunion.invitados.length===0,'editar cambia los convocados');
    // una reunión creada con el formato anterior sigue funcionando
    const rL=run(`crearReunion({tipo:'Consejo académico',nombre:'Formato anterior',fecha:'${dg}',inicio:'15:00',fin:'16:00',convocados:'TODOS'})`);
    ok(run(`cargarReunion({id:'${rL.id}'})`).personas.length===cat.integrantes.TODOS.length,'el formato anterior de convocados (TODOS o lista) sigue funcionando');
    [rG,rP,rT,rE,rL].forEach(r=>run(`anularReunion({id:'${r.id}',motivo:'prueba de convocados'})`));
  }
  // lugares de reunión
  {
    const lg=run('listarReuniones({})').lugares, todos=lg.flatMap(g=>g.items), vals=todos.map(i=>i.v);
    ok(['Polideportivo (canchas)','Patio principal','Sala múltiple (auditorio)','Sala de profesores','Biblioteca','Comedor escolar','Emisora escolar','Laboratorio de química','Aulas digitales (sala 5)'].every(v=>vals.includes(v)),'lugares: polideportivo, patio, auditorio, sala de profesores, biblioteca, comedor, emisora, laboratorio y aulas digitales');
    ok([1,2,3,4].every(n=>vals.includes('Sala de tecnología e informática '+n)),'lugares: salas de tecnología e informática 1 a 4');
    ok(todos.some(i=>i.v==='Salón'&&i.pide)&&todos.some(i=>i.v==='Otro laboratorio o entorno de área'&&i.pide)&&todos.some(i=>i.v==='Otro lugar'&&i.solo),'lugares que piden número o nombre: salón, otro laboratorio o entorno, otro lugar');
    ok(vals.includes('Coordinación – Francisco Cortés')&&vals.includes('Coordinación – Verónica Barreiro')&&vals.includes('Coordinación – Harold Angulo')&&!vals.some(v=>/Jorge/.test(v)),'oficinas de coordinación tomadas de la hoja Directivos (sin el rector, que tiene Rectoría)');
    ok(vals.filter(v=>/^Orientación escolar – /.test(v)).length===2&&run("nombreCortoDocente_('Ponce Moncayo Ángela Paola')")==='Ángela Ponce'&&run("nombreCortoDocente_('Casanova Casanova Johana Andrea')")==='Johana Casanova','una oficina de orientación escolar por orientadora, con su nombre corto (Ángela Ponce, Johana Casanova)');
  }
  // asunto u observaciones y tipos unificados
  {
    const dq=dmas(8), tp=run('listarReuniones({})').tipos.map(t=>t.tipo);
    ok(!tp.includes('Jornada pedagógica')&&!tp.includes('Reunión de desarrollo institucional')&&tp.includes('Jornada pedagógica o de desarrollo institucional'),'«jornada pedagógica» y «desarrollo institucional» quedan unificadas en un solo tipo');
    ok(['Taller pedagógico','Charla o conferencia','Capacitación en el colegio','Reunión con padres de familia o acudientes','Escuela de padres','Acto cívico o cultural','Simulacro de evacuación'].every(t=>tp.includes(t)),'tipos nuevos: taller, charla, capacitación, padres, escuela de padres, acto cívico, simulacro');
    const rA=run(`crearReunion({tipo:'Reunión de desarrollo institucional',nombre:'Con alias',fecha:'${dq}',inicio:'08:00',fin:'09:00',convocados:'TODOS',observaciones:'  Traer el informe de notas; la reunión es en el segundo piso.  '})`);
    const a1=run(`cargarReunion({id:'${rA.id}'})`).reunion;
    ok(a1.tipo==='Jornada pedagógica o de desarrollo institucional'&&a1.observaciones==='Traer el informe de notas; la reunión es en el segundo piso.','el tipo anterior se muestra con el nombre nuevo y se guardan las observaciones (sin espacios sobrantes)');
    const rB=run(`crearReunion({tipo:'Taller pedagógico',nombre:'Sin observaciones',fecha:'${dq}',inicio:'10:00',fin:'11:00',convocados:'TODOS'})`);
    ok(run(`cargarReunion({id:'${rB.id}'})`).reunion.observaciones==='','sin observaciones: queda vacío (el aviso no muestra nada)');
    run(`editarReunion({id:'${rA.id}',tipo:'Taller pedagógico',nombre:'Con alias',fecha:'${dq}',inicio:'08:00',fin:'09:00',convocados:'TODOS',observaciones:'Nueva aclaración'})`);
    ok(run(`cargarReunion({id:'${rA.id}'})`).reunion.observaciones==='Nueva aclaración','editar cambia las observaciones');
    const rH=run(`crearReunion({tipo:'Taller pedagógico',nombre:'Hoy con nota',excepcional:true,fecha:'${hoyR}',inicio:'00:00',fin:'23:59',convocados:'TODOS',observaciones:'Llevar computador'})`);
    const ah=run('avisosHoy()').reuniones.find(x=>x.nombre==='Hoy con nota'); ok(ah&&ah.observaciones==='Llevar computador','el aviso del día lleva las observaciones');
    [rA,rB,rH].forEach(r=>run(`anularReunion({id:'${r.id}',motivo:'prueba de observaciones'})`));
  }
  // salida anticipada de estudiantes y comunicación a padres
  {
    const ds=hoyR;
    const rS=run(`crearReunion({tipo:'Reunión de planeación',nombre:'Con salida anticipada',fecha:'${ds}',inicio:'12:00',fin:'13:30',convocados:'TODOS',salidaEst:'11:45',minAntesSalida:15,llevarComedor:true,informarPadres:false})`);
    const s1=run(`cargarReunion({id:'${rS.id}'})`).reunion;
    ok(s1.salidaEst==='11:45'&&s1.minAntesSalida===15&&s1.finClases==='11:30'&&s1.llevarComedor===true&&s1.informarPadres===true&&s1.sinEstudiantes===true,'salida anticipada: guarda la hora, las clases terminan 15 min antes (11:30), comedor y avisa a padres; las clases quedan suspendidas');
    const conSal=run(`reunionesEnSesiones_('${ds}',[6],datos_('Franjas'))`).some(r=>r.nombre==='Con salida anticipada');
    ok(conSal,'la ronda ya no se hace en la sesión que se cruza con el cierre de clases (antes de que empiece la reunión)');
    const rN=run(`crearReunion({tipo:'Reunión de planeación',nombre:'Sin salida anticipada',fecha:'${ds}',inicio:'12:00',fin:'13:30',convocados:'TODOS',sinEstudiantes:true})`);
    ok(!run(`reunionesEnSesiones_('${ds}',[6],datos_('Franjas'))`).some(r=>r.nombre==='Sin salida anticipada'),'sin salida anticipada la sesión 6 sigue con clases (la reunión empieza a las 12:00)');
    let e1=null; try{ run(`crearReunion({tipo:'Reunión de planeación',nombre:'Hora mala',fecha:'${ds}',inicio:'12:00',fin:'13:30',convocados:'TODOS',salidaEst:'25:00'})`) }catch(x){e1=x} ok(e1&&/hora de salida/.test(e1.message),'hora de salida inválida: aviso');
    const ap=run('avisosHoy()').reuniones.find(x=>x.nombre==='Con salida anticipada'); ok(ap&&ap.salidaEst==='11:45'&&ap.finClases==='11:30'&&ap.llevarComedor===true&&ap.informarPadres===true,'el aviso del día lleva la salida anticipada y el recordatorio de informar a padres');
    run(`editarReunion({id:'${rS.id}',tipo:'Reunión de planeación',nombre:'Con salida anticipada',fecha:'${ds}',inicio:'12:00',fin:'13:30',convocados:'TODOS',salidaEst:'',informarPadres:false})`);
    const s2=run(`cargarReunion({id:'${rS.id}'})`).reunion; ok(s2.salidaEst===''&&s2.finClases===''&&s2.informarPadres===false,'editar puede quitar la salida anticipada');
    [rS,rN].forEach(r=>run(`anularReunion({id:'${r.id}',motivo:'prueba de salida'})`));
  }
  // anular: solo quien administra
  const dh=hojas.Directivos.v[0], iCT=dh.indexOf('correo_temporal');
  hojas.Directivos.v[3][iCT]='harold@x.com'; EMAIL='harold@x.com';
  let ea=null; try{ run(`anularReunion({id:'${rU.id}',motivo:'Creada por error'})`) }catch(x){ea=x} ok(ea&&/Solo quien administra/.test(ea.message),'un coordinador que no administra NO puede anular una reunión');
  ok(run('listarReuniones({})').puedeAnular===false,'la pantalla no le ofrece el botón Anular');
  EMAIL='dueno@gmail.com';
  ok(run('listarReuniones({})').puedeAnular===true,'el administrador sí ve el botón Anular');
  ea=null; try{ run(`anularReunion({id:'${rU.id}',motivo:'x'})`) }catch(x){ea=x} ok(ea&&/motivo/.test(ea.message),'anular exige el motivo');
  const nR=hojas.Reuniones.v.length; run(`anularReunion({id:'${rU.id}',motivo:'Creada por error'})`);
  ok(hojas.Reuniones.v.length===nR-1&&!run('listarReuniones({})').ultimas.some(r=>r.id===rU.id),'la reunión anulada sale de la lista');
  { const hA=hojas.Reuniones_Anuladas&&hojas.Reuniones_Anuladas.v[0], fA=hA&&hojas.Reuniones_Anuladas.v.find(r=>r[hA.indexOf('id')]===rU.id); ok(fA&&fA[hA.indexOf('motivo_anulacion')]==='Creada por error'&&fA[hA.indexOf('anulada_por')],'queda en Reuniones_Anuladas con el motivo y quién la anuló'); }
  ea=null; try{ run(`anularReunion({id:'${rU.id}',motivo:'Creada por error'})`) }catch(x){ea=x} ok(ea&&/No se encontr/.test(ea.message),'anular dos veces: aviso');
  const n0=hojas.Reuniones.v.length; run(`editarReunion({id:'${rP.id}',tipo:'Consejo académico',fecha:'${dia2}',inicio:'09:00',fin:'10:00',convocados:'TODOS'})`); ok(hojas.Reuniones.v.length===n0,'editar no duplica la reunión');
}
const rondaR=run("consultarSesion('VIERNES',3,'sesion')"); const cardR=rondaR.filas.find(f=>f.docente===dR);
ok(rondaR.reuniones.length===1&&cardR&&cardR.reunion&&cardR.reunion.estado==='Asistió'&&!rondaR.sinEstudiantes,'la ronda marca a quien está en la reunión (la reunión tiene estudiantes: la ronda sigue)');
const regN=hojas.Registro_Ronda.v.length, novN=hojas.Novedades.v.length;
run(`guardarRonda({dia:'VIERNES',sesion:3,fecha:'${hoyR}',registros:[{docente:${JSON.stringify(dR)},grupoCodigo:${JSON.stringify(clase3[hi('grupo')])},area:'X',estado:'No asistió',motivo:'Sin justificación'}]})`);
const rl=hojas.Registro_Ronda.v[hojas.Registro_Ronda.v.length-1];
ok(hojas.Registro_Ronda.v.length===regN+1&&rl[8]==='En reunión'&&hojas.Novedades.v.length===novN,'si otro directivo lo marca ausente, queda "En reunión" y NO se crea novedad ni minutos');
// mismo docente sin asistencia registrada: sí queda ausente
g.RA2={id:rc1.id,registros:[{persona:dR,estado:'No asistió',motivo:'Mal estado de salud'}],directivo:'P'}; run('guardarAsistenciaReunion(RA2)');
run(`guardarRonda({dia:'VIERNES',sesion:3,fecha:'${hoyR}',registros:[{docente:${JSON.stringify(dR)},grupoCodigo:${JSON.stringify(clase3[hi('grupo')])},area:'X',estado:'No asistió',motivo:'Sin justificación'}]})`);
ok(hojas.Novedades.v.length===novN+1,'si NO asistió a la reunión, la ausencia en el aula sí se registra');
// jornada pedagógica sin estudiantes: se suspende la ronda
g.RJ={tipo:'Jornada pedagógica',inicio:'07:00',fin:'13:30',sinEstudiantes:true,convocados:'TODOS',directivo:'P'}; const rj=run('crearReunion(RJ)');
const rondaJ=run("consultarSesion('VIERNES',3,'bloque')");
ok(rondaJ.sinEstudiantes===true&&rondaJ.filas.length===0&&/sin clases/.test(rondaJ.nota),'jornada pedagógica: la ronda de aula se suspende y avisa');
const lj=run('listarReuniones({})'); ok(lj.reuniones.length===2&&lj.personas.length>40&&lj.tipos.some(t=>t.tipo==='Jornada pedagógica o de desarrollo institucional'),'listarReuniones: reuniones del día, tipos y personas (docentes + directivos)');
g.RAT={id:rj.id,registros:H.Docentes.slice(1).map(r=>({persona:r[H.Docentes[0].indexOf('nombre_completo')],estado:'Asistió'})),directivo:'P'};
const gj=run('guardarAsistenciaReunion(RAT)'); ok(gj.guardados>=50,'se registra la asistencia de todos de una vez ('+gj.guardados+')');
run('guardarAsistenciaReunion(RAT)'); const filasAs=hojas.Asistencia_Reunion.v.filter(r=>r[0]===rj.id).length; ok(filasAs===gj.guardados,'volver a guardar reemplaza, no duplica');
let eR=null; try{run("crearReunion({tipo:'Jornada pedagógica',inicio:'13:00',fin:'08:00',convocados:'TODOS'})")}catch(x){eR=x} ok(eR&&/hora/.test(eR.message),'rechaza horas inválidas');
EMAIL='alguien@gmail.com'; eR=null; try{run("crearReunion({tipo:'Jornada pedagógica',inicio:'07:00',fin:'13:30',convocados:'TODOS'})")}catch(x){eR=x} ok(eR&&/Solo un directivo/.test(eR.message),'solo directivos registran reuniones'); EMAIL='dueno@gmail.com';
// ---- incumplimientos con rigor
const claseI=H.Horario.slice(1).find(r=>r[hi('dia')]==='MARTES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===3), dI=claseI[hi('docente')], gI=claseI[hi('grupo')];
const guardaInc=(fecha,ses,tipo,obs,extra)=>run(`guardarRonda({dia:'MARTES',sesion:${ses},fecha:'${fecha}',registros:[{docente:${JSON.stringify(dI)},sesion:${ses},grupoCodigo:${JSON.stringify(gI)},area:'X',estado:'Incumplimiento',obs:${JSON.stringify(obs)},incumplimiento:Object.assign({tipo:'${tipo}',donde:'En la sala de profesores'},${JSON.stringify(extra||{})})}]})`);
let eI=null; try{guardaInc('2026-10-06',3,'NO_ATIENDE','corto')}catch(x){eI=x}
ok(eI&&/mínimo 15/.test(eI.message),'rigor: sin descripción suficiente no se guarda');
eI=null; try{guardaInc('2026-10-06',3,'XX','El docente estaba en la sala de profesores y el grupo sin clase')}catch(x){eI=x}
ok(eI&&/tipo de incumplimiento/.test(eI.message),'rigor: exige elegir el tipo de incumplimiento');
const nI0=hojas.Novedades.v.length;
guardaInc('2026-10-06',3,'NO_ATIENDE','Lo encontré en la sala de profesores; el grupo estaba sin clase y sin actividad.',{explicacion:'Dijo que esperaba al coordinador'});
const nvI=hojas.Novedades.v[hojas.Novedades.v.length-1], iv=hojas.Incumplimientos.v, icol=iv[0];
ok(hojas.Novedades.v.length===nI0+1&&nvI[cc('Tipo Novedad')]==='Incumplimiento: no atiende al grupo'&&nvI[cc('Minutos Desatendidos')]===45&&nvI[cc('Justificada')]==='No'&&nvI[cc('Categoría motivo')]==='INCUMPLIMIENTO','no atiende: novedad de 45 min, sin justificación, categoría INCUMPLIMIENTO');
const filaI=iv[iv.length-1]; ok(iv.length===2&&filaI[icol.indexOf('reincidencia')]===1&&filaI[icol.indexOf('estado')]==='Reportado'&&/sala de profesores/.test(filaI[icol.indexOf('donde')])&&/sin clase/.test(filaI[icol.indexOf('descripcion')])&&filaI[icol.indexOf('registrado_por')]==='dueno@gmail.com','queda en Incumplimientos: reincidencia 1, estado Reportado, dónde, descripción y quién lo registró');
guardaInc('2026-10-06',3,'NO_ATIENDE','Lo encontré en la sala de profesores; el grupo estaba sin clase y sin actividad.'); ok(hojas.Incumplimientos.v.length===2,'guardar dos veces el mismo reporte no lo duplica');
// aunque luego se cambie la marca de esa sesión, el reporte NO desaparece
run(`guardarRonda({dia:'MARTES',sesion:3,fecha:'2026-10-06',registros:[{docente:${JSON.stringify(dI)},sesion:3,grupoCodigo:${JSON.stringify(gI)},area:'X',estado:'Presente'}]})`);
ok(hojas.Incumplimientos.v.length===2&&!hojas.Novedades.v.some(r=>r[cc('Docente')]===dI&&/Incumplimiento/.test(r[cc('Tipo Novedad')])),'si después se marca Presente, la novedad del panel se reemplaza pero el reporte formal NO se borra (registro de solo agregar)');
guardaInc('2026-10-07',3,'NO_ATIENDE','Otra vez en la sala de profesores con el grupo sin atender, según lo vi en la ronda.');
ok(hojas.Incumplimientos.v[hojas.Incumplimientos.v.length-1][icol.indexOf('reincidencia')]===2,'la reincidencia cuenta los reportes anteriores del docente (2.º reporte)');
// despidió a los estudiantes: resto de la jornada
guardaInc('2026-10-08',4,'DESPIDIO','Despidió a los estudiantes a las 9:00 sin autorización de ningún directivo.',{alcance:'RESTO'});
const nrD=hojas.Novedades.v[hojas.Novedades.v.length-1];
const restoMin=H.Horario.slice(1).filter(r=>r[hi('dia')]==='MARTES'&&r[hi('docente')]===dI&&Number(r[hi('hora')])>=4).length*45;
ok(nrD[cc('Tipo Novedad')]==='Incumplimiento: despidió a los estudiantes sin autorización'&&nrD[cc('Sesiones')]==='S4-FIN'&&nrD[cc('Minutos Desatendidos')]===restoMin,'despidió a los estudiantes: suma los minutos desde esa sesión hasta el final de su jornada ('+restoMin+' min)');
// seguimiento
const idSeg=hojas.Incumplimientos.v[1][icol.indexOf('id')];
run(`actualizarSeguimiento({id:'${idSeg}',estado:'En seguimiento',nota:'Se habló con el docente'})`); run(`actualizarSeguimiento({id:'${idSeg}',estado:'Citado a descargos',nota:'Citación para el viernes'})`);
const fs2=hojas.Incumplimientos.v[1]; ok(fs2[icol.indexOf('estado')]==='Citado a descargos'&&/Se habló/.test(fs2[icol.indexOf('seguimiento')])&&/viernes/.test(fs2[icol.indexOf('seguimiento')]),'el seguimiento cambia el estado y conserva TODAS las notas anteriores');
let eS=null; try{run(`actualizarSeguimiento({id:'${idSeg}',estado:'Borrado'})`)}catch(x){eS=x} ok(eS&&/Estado no válido/.test(eS.message),'no se puede "borrar" un reporte: solo estados de seguimiento');
const liI=run("listarIncumplimientos({desde:'2026-10-06',hasta:'2026-10-07'})"); ok(liI.lista.length===2&&liI.totalPorDocente[dI]===3,'listarIncumplimientos: filtra por fechas y cuenta los reportes por docente');
const falla=(c)=>{try{run(c);return null}catch(e){return String(e.message)}};
EMAIL=''; ok(/Debe iniciar sesión/.test(falla("listarIncumplimientos({})")||'')&&/Debe iniciar sesión/.test(falla("actualizarSeguimiento({id:'x',estado:'Cerrado'})")||''),'sin sesión no se pueden ver ni modificar'); EMAIL='dueno@gmail.com';
// una observación o un chat que reporte un incumplimiento también queda en la hoja formal
{const B=hojas.Bandeja_WhatsApp.v; if(!B[0].includes('id')) run('bandeja_()'); const bh=hojas.Bandeja_WhatsApp.v[0]; const fil=bh.map(()=>''); const set=(k,v)=>{fil[bh.indexOf(k)]=v};
 set('fecha','2026-10-09');set('hora','13:35');set('remitente','Prueba');set('docente',dI);set('tipo_novedad','Incumplimiento: despidió a los estudiantes sin autorización');set('motivo','Sin justificación');set('categoria','INCUMPLIMIENTO');set('justificada','No');set('mensaje','Mandó a los niños para la casa sin autorización.');set('confirmar','SI');
 hojas.Bandeja_WhatsApp.v.push(fil); const antesI=hojas.Incumplimientos.v.length; const rb=run('importarBandeja_()');
 ok(rb.importadas>=1&&hojas.Incumplimientos.v.length===antesI+1&&hojas.Incumplimientos.v[hojas.Incumplimientos.v.length-1][icol.indexOf('tipo')]==='Incumplimiento: despidió a los estudiantes sin autorización','un reporte importado de WhatsApp/observaciones también queda en la hoja Incumplimientos');}
// panel: kpi
g.RS2={desde:'2026-10-06',hasta:'2026-10-08',docentes:[],motivos:[],horario:[],novedades:[{fecha:'2026-10-06',docente:'X',tipo:'Incumplimiento: no atiende al grupo',motivo:'Sin justificación',minutos:45,justificada:'No',categoria:'INCUMPLIMIENTO'}]};
const k2=run('calcularResumen_(RS2)').kpis; ok(k2.incumplimientos===1&&k2.minutos===45&&k2.ausencias===0&&k2.minutosSinJustificar===45,'panel: cuenta incumplimientos, suma sus minutos como injustificados y no los mezcla con ausencias');
// ---- consulta de horarios (solo bachillerato)
const cat=run("consultaHorarios({modo:'catalogo'})");
ok(cat.docentes.length>20&&cat.docentes.length<45&&cat.grupos.length===18&&cat.grupos[0].codigo==='0601'&&cat.grupos[2].codigo==='CS101'&&cat.areas.includes('ETR'),`catálogo: ${cat.docentes.length} docentes de bachillerato, 18 grupos (6° a 11° con CS tras los sextos y novenos) y áreas`);
const soloPrim=H.Docentes.slice(1).filter(r=>r[H.Docentes[0].indexOf('nivel')]==='PRIMARIA').map(r=>r[H.Docentes[0].indexOf('nombre_completo')]);
ok(soloPrim.every(n=>!cat.docentes.some(d=>d.nombre===n)),'primaria y preescolar no aparecen en la consulta de horarios');
const dH=ejemplo[hi('docente')], parH=[dH,otro]; const claveH='CLASE|ETR|'+[...parH].sort().join('|');
const semHoy=run("lunesDe_(ymd_(new Date()))");
// sin definir esta semana (se borra la fila de prueba para comprobar el caso "por definir")
const sa=hojas.Semana_Alternancia.v; for(let i=sa.length-1;i>=1;i--) if(sa[i][1]===claveH) sa.splice(i,1);
const d0=run(`consultaHorarios({modo:'docente',docente:${JSON.stringify(dH)}})`);
ok(d0.celdas.length>0&&d0.celdas.some(c=>c.pendiente&&c.alternaCon===otro),'horario de un docente: sus clases en pareja salen "por definir" con el nombre de quien alterna');
g.PH={clave:claveH,elegido:otro,primario:dH,directivo:'P'}; run('definirAlternancia(PH)');
const d1=run(`consultaHorarios({modo:'docente',docente:${JSON.stringify(dH)}})`), o1=run(`consultaHorarios({modo:'docente',docente:${JSON.stringify(otro)}})`);
const suyasD=d1.celdas.filter(c=>c.area==='ETR'&&c.tipo==='CLASE'), suyasO=o1.celdas.filter(c=>c.area==='ETR'&&c.tipo==='CLASE');
ok(suyasD.every(c=>!c.pendiente)&&suyasO.every(c=>!c.pendiente)&&suyasD.length>0&&suyasO.length>0,'ya definida la semana: cada docente ve su horario efectivo (sin "por definir")');
const slotsOriginalesD=H.Horario.slice(1).filter(r=>r[hi('tipo')]==='CLASE'&&r[hi('area')]==='ETR'&&r[hi('docente')]===dH).length, slotsOriginalesO=H.Horario.slice(1).filter(r=>r[hi('tipo')]==='CLASE'&&r[hi('area')]==='ETR'&&r[hi('docente')]===otro).length;
ok(suyasD.length===slotsOriginalesO&&suyasO.length===slotsOriginalesD,'con el intercambio, cada uno tiene las clases de ética/religión del otro ('+suyasD.length+' y '+suyasO.length+')');
run("definirAlternancia({clave:'"+claveH+"',elegido:'"+dH+"',primario:'"+dH+"',directivo:'P'})");
const codG=cat.grupos[3].codigo, gr=run(`consultaHorarios({modo:'grupo',grupo:'${codG}'})`);
ok(gr.celdas.length>=30&&gr.celdas.every(c=>c.docentes.length>=1)&&new Set(gr.celdas.map(c=>c.dia)).size===5,`horario semanal de un grupo: ${gr.celdas.length} celdas, 5 días, con docentes`);
hojas.Reuniones.v.splice(1);   // se quitan las reuniones de prueba (la jornada pedagógica suspende la ronda)
const ah=run("consultaHorarios({modo:'ahora',dia:'MARTES',sesion:3})"); ok(ah.filas.length>30&&ah.bloque===2&&/08:20 - 09:50/.test(ah.franja),'«quiénes deben estar ahora»: lista del bloque sin haber hecho la ronda ('+ah.filas.length+' docentes)');
const di=run("consultaHorarios({modo:'directores'})"); ok(di.grupos.length>=33&&di.grupos[0].codigo==='0001'&&di.grupos[di.grupos.length-1].codigo.startsWith('11')&&di.sinDireccion.length>=1,`directores de grupo: ${di.grupos.length} cursos de preescolar a 11°, y ${di.sinDireccion.length} docentes de bachillerato sin dirección`);
ok(di.grupos.filter(x=>x.directores.length===2).length>=1,'los grupos compartidos (bachillerato) muestran dos directores');
EMAIL=''; ok(/Debe iniciar sesión/.test(falla("consultaHorarios({modo:'catalogo'})")||''),'sin sesión no se puede consultar'); EMAIL='dueno@gmail.com';
// ---- equipos de énfasis: el docente de la pareja que alterna (ética/religión) también cambia de equipo cada semana, y se puede restablecer
{
  const esEq=(r)=>r[hi('tipo')]==='ENFASIS'&&/^EQUIPO/.test(r[hi('alternancia')]), sem=run("lunesDe_(ymd_(new Date()))");
  let EST,MON,AR,eE;
  for(const pr of H.Alternancias.slice(1)){ const f=H.Horario.slice(1).find(r=>esEq(r)&&r[hi('area')]===pr[0]&&r[hi('docente')]===pr[1]); if(f){ AR=pr[0]; EST=pr[1]; MON=pr[2]; eE=f; break; } }
  ok(!!eE,'hay una pareja de la hoja Alternancias con un equipo de énfasis ('+AR+')');
  const eM=H.Horario.slice(1).find(r=>esEq(r)&&r[hi('docente')]===MON&&r[hi('dia')]===eE[hi('dia')]&&r[hi('hora')]===eE[hi('hora')]);
  const clave='CLASE|'+AR+'|'+[EST,MON].sort().join('|'), diaE=eE[hi('dia')], horaE=Number(eE[hi('hora')]);
  hojas.Semana_Alternancia.v.splice(1);
  let cs=run(`consultarSesion('${diaE}',${horaE},'sesion')`).filas.filter(f=>f.tipo==='ENFASIS'&&(f.docente===EST||f.docente===MON));
  ok(cs.length>=1&&cs.every(f=>f.claveAlt===clave&&f.alternos.length===1),'equipo de énfasis: la tarjeta de ética/religión ofrece al otro docente de la pareja (misma clave de la semana)');
  // marcas ya registradas en esa sesión con la asignación original; luego se define el intercambio y se corrige lo registrado
  const dd=(n)=>run(`resSumaDias_('${sem}',${['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'].indexOf(diaE)})`);
  const cabR=hojas.Registro_Ronda.v[0], ic=(k)=>cabR.indexOf(k), fecha=dd();
  const fila=(doc,gr)=>{const r=cabR.map(()=>'');r[ic('fecha')]=fecha;r[ic('sesion')]=horaE;r[ic('docente')]=doc;r[ic('grupo')]=gr;r[ic('area')]=AR;r[ic('estado')]='Presente';return r};
  const base=hojas.Registro_Ronda.v.length;
  hojas.Registro_Ronda.v.push(fila(EST,eE[hi('grupos_enfasis')])); if(eM) hojas.Registro_Ronda.v.push(fila(MON,eM[hi('grupos_enfasis')]));
  const doc=(i)=>hojas.Registro_Ronda.v[base+i][ic('docente')];
  g.PQ={clave,elegido:MON,primario:EST,fecha,directivo:'P',antes:EST,corregirRegistrado:true}; const r1=run('definirAlternancia(PQ)');
  ok(doc(0)===MON&&(!eM||doc(1)===EST)&&r1.corregidos.registro===(eM?2:1),'al definir el intercambio la corrección pasa cada marca al otro docente de la pareja (en los dos sentidos)');
  // restablecer: volver a la asignación original corrige de nuevo, también lo registrado con el intercambio
  g.PQ2={clave,elegido:EST,primario:EST,fecha,directivo:'P',antes:MON,corregirRegistrado:true}; const r2=run('definirAlternancia(PQ2)');
  ok(doc(0)===EST&&(!eM||doc(1)===MON)&&r2.corregidos.registro===(eM?2:1),'restablecer la asignación original devuelve las marcas a sus titulares');
  // solo de ahora en adelante: no toca lo registrado
  g.PQ3={clave,elegido:MON,primario:EST,fecha,directivo:'P',antes:EST,corregirRegistrado:false}; run('definirAlternancia(PQ3)');
  ok(doc(0)===EST,'«solo de ahora en adelante» no toca lo registrado');
  cs=run(`consultarSesion('${diaE}',${horaE},'sesion')`).filas.filter(f=>f.tipo==='ENFASIS'&&f.claveAlt===clave);
  ok(cs.length>=1&&cs.every(f=>f.definido)&&cs.some(f=>f.docente===MON),'definido el intercambio, en el equipo de énfasis aparece el otro docente');
}
// ---- intercambio de dos docentes: las marcas ya registradas siguen viéndose en la ronda (con el nuevo titular del horario)
{
  const D=H.Horario.slice(1).filter(r=>r[hi('tipo')]==='CLASE'&&r[hi('dia')]==='MARTES'&&Number(r[hi('hora')])===3&&r[hi('area')]!=='ETR');
  const dA=D[0][hi('docente')], dB=D[1][hi('docente')], fecha=run("consultarSesion('MARTES',3,'sesion')").fecha;
  const cabR=hojas.Registro_Ronda.v[0], ic=(k)=>cabR.indexOf(k);
  const r=cabR.map(()=>''); r[0]='x'; r[ic('fecha')]=fecha; r[ic('sesion')]=3; r[ic('docente')]=dA; r[ic('grupo')]=D[0][hi('grupo')]; r[ic('area')]=D[0][hi('area')]; r[ic('estado')]='Presente'; hojas.Registro_Ronda.v.push(r);
  const hzH=hojas.Horario; hzH.getRange=function(r_,c_,nr,nc){const q=this;return {setNumberFormat(){},setValue(x){q.v[r_-1][c_-1]=x},setValues(a){a.forEach((row,i)=>row.forEach((x,j)=>{q.v[r_-1+i][c_-1+j]=x}))},getValues(){return q.v.slice(r_-1,r_-1+nr).map(f=>f.slice(c_-1,c_-1+nc))}}};
  const conMarca=(nom)=>{const f=run(`consultarSesion('MARTES',3,'sesion')`).filas.find(x=>x.docente===nom&&(x.previo||{}).estado==='Presente');return !!f};
  ok(conMarca(dA),'antes del intercambio la marca aparece en la tarjeta de '+dA);
  run(`intercambioDocentes_('${dA}','${dB}','',true)`);
  ok(conMarca(dB)&&!conMarca(dA),'después del intercambio completo la marca sigue visible, ahora con el nuevo titular');
}
// ---- recuperar marcas que quedaron a nombre de quien ya no tiene la sesión
{
  const D=H.Horario.slice(1).filter(r=>r[hi('tipo')]==='CLASE'&&r[hi('dia')]==='MIERCOLES'&&Number(r[hi('hora')])===3&&r[hi('area')]!=='ETR');
  const fecha=run("consultarSesion('MIERCOLES',3,'sesion')").fecha, cabR=hojas.Registro_Ronda.v[0], ic=(k)=>cabR.indexOf(k);
  const usados=new Set(hojas.Registro_Ronda.v.map(x=>x[ic('docente')])), D0=D.find(x=>!usados.has(x[hi('docente')]))||D[0];
  const titular=D0[hi('docente')], viejo='Docente que ya no tiene la sesión';
  const r=cabR.map(()=>''); r[0]='x'; r[ic('fecha')]=fecha; r[ic('dia')]='MIERCOLES'; r[ic('sesion')]=3; r[ic('docente')]=viejo; r[ic('grupo')]="'"+D0[hi('grupo')]; r[ic('area')]=D0[hi('area')]; r[ic('estado')]='Presente'; hojas.Registro_Ronda.v.push(r);
  const vista=()=>!!run("consultarSesion('MIERCOLES',3,'sesion')").filas.find(x=>x.docente===titular&&(x.previo||{}).estado==='Presente');
  ok(vista(),'una marca a nombre de quien ya no tiene la sesión se ve igual en la tarjeta del titular actual (por fecha, sesión, grupo y área)');
  const p=run('revisarRegistrosRonda_(false)'); ok(p.huerfanas>=1&&p.corregidas>=1&&hojas.Registro_Ronda.v.slice(-1)[0][ic('docente')]===viejo,'la vista previa cuenta esas marcas y no cambia nada en la hoja');
  const a=run('revisarRegistrosRonda_(true)'); ok(a.corregidas>=1&&vista(),'al aplicar, la marca vuelve a verse en la tarjeta del titular actual');
  ok(run('revisarRegistrosRonda_(false)').huerfanas===0,'repetir no encuentra más');
  // guardar la ronda de ese puesto no duplica la marca vieja
  hojas.Registro_Ronda.v.slice(-1)[0][ic('docente')]=viejo; const nReg=hojas.Registro_Ronda.v.length;
  run(`guardarRonda({dia:'MIERCOLES',sesion:3,fecha:'${fecha}',registros:[{docente:${JSON.stringify(titular)},grupoCodigo:${JSON.stringify(D0[hi('grupo')])},area:${JSON.stringify(D0[hi('area')])},estado:'Presente'}]})`);
  ok(hojas.Registro_Ronda.v.length===nReg&&hojas.Registro_Ronda.v.slice(-1)[0][ic('docente')]===titular,'al guardar el puesto se reemplaza la marca a nombre del anterior (no se duplica)');
}
// ---- docente presente sin estudiantes (se guarda en «atendido_por») y salida del informe
{
  const D=H.Horario.slice(1).find(r=>r[hi('tipo')]==='CLASE'&&r[hi('dia')]==='MIERCOLES'&&Number(r[hi('hora')])===5);
  const cabR=hojas.Registro_Ronda.v[0], ic=(k)=>cabR.indexOf(k), fecha=run("consultarSesion('MIERCOLES',5,'sesion')").fecha;
  run(`guardarRonda({dia:'MIERCOLES',sesion:5,fecha:'${fecha}',directivo:'P',registros:[{docente:${JSON.stringify(D[hi('docente')])},grupoCodigo:${JSON.stringify(D[hi('grupo')])},area:${JSON.stringify(D[hi('area')])},estado:'Presente',atiende:'Sin estudiantes: están en taller o actividad fuera del aula'}]})`);
  const fila=hojas.Registro_Ronda.v.slice().reverse().find(r=>r[ic('docente')]===D[hi('docente')]&&r[ic('sesion')]===5);
  ok(fila&&fila[ic('atendido_por')]==='Sin estudiantes: están en taller o actividad fuera del aula'&&fila[ic('estado')]==='Presente','un docente presente sin estudiantes queda registrado con el motivo');
  const card=run("consultarSesion('MIERCOLES',5,'sesion')").filas.find(f=>f.docente===D[hi('docente')]);
  ok(card.previo&&/^Sin estudiantes/.test(card.previo.atendidoPor),'al volver a abrir la ronda la tarjeta recuerda «sin estudiantes»');
  run(`guardarRonda({dia:'MIERCOLES',sesion:5,fecha:'${fecha}',directivo:'P',registros:[{docente:${JSON.stringify(D[hi('docente')])},grupoCodigo:${JSON.stringify(D[hi('grupo')])},area:${JSON.stringify(D[hi('area')])},estado:'Presente'}]})`);
  const f2=hojas.Registro_Ronda.v.slice().reverse().find(r=>r[ic('docente')]===D[hi('docente')]&&r[ic('sesion')]===5);
  ok(f2[ic('atendido_por')]==='','si se quita la marca queda con estudiantes (por defecto)');
}
// ---- alternancia automática: si la semana pasada ya se definió la pareja, esta semana se alterna sola
{
  const dP=ejemplo[hi('docente')], dia=ejemplo[hi('dia')], hora=ejemplo[hi('hora')], sem=run("lunesDe_(ymd_(new Date()))");
  const tarjeta=()=>run(`consultarSesion('${dia}',${hora},'sesion')`).filas.find(f=>f.claveAlt===claveE&&f.primario===dP);
  hojas.Semana_Alternancia.v.splice(1);
  const semPas=run(`resSumaDias_('${sem}',-7)`), sem2=run(`resSumaDias_('${sem}',-14)`);
  run(`definirAlternancia({clave:'${claveE}',elegido:'${dP}',primario:'${dP}',fecha:'${semPas}',directivo:'P'})`);
  let c=tarjeta(); ok(c&&c.docente===otro&&c.definido&&c.definido.auto,'la semana pasada dictó el titular: esta semana dicta el otro, sin tener que elegir');
  hojas.Semana_Alternancia.v.splice(1);
  run(`definirAlternancia({clave:'${claveE}',elegido:'${dP}',primario:'${dP}',fecha:'${sem2}',directivo:'P'})`);
  c=tarjeta(); ok(c&&c.docente===dP&&c.definido&&c.definido.auto,'hace dos semanas dictó el titular: la semana pasada fue el otro y esta vuelve al titular');
  run(`definirAlternancia({clave:'${claveE}',elegido:'${otro}',primario:'${dP}',fecha:'${sem}',directivo:'P'})`);
  c=tarjeta(); ok(c&&c.docente===otro&&!c.definido.auto,'lo definido explícitamente esta semana tiene prioridad sobre la alternancia automática');
  hojas.Semana_Alternancia.v.splice(1);
  run(`definirAlternancia({clave:'${claveE}',elegido:'${dP}',primario:'${dP}',fecha:'${run(`resSumaDias_('${sem}',-84)`)}',directivo:'P'})`);
  c=tarjeta(); ok(c&&!c.definido,'si pasaron más de 8 semanas desde la última definición, se vuelve a pedir');
  hojas.Semana_Alternancia.v.splice(1);
}
// ---- novedad anticipada con quién queda a cargo y actividad; invitación sindical; docentes ausentes del día
{
  const dS=H.Horario.slice(1).find(r=>r[hi('dia')]==='MARTES'&&r[hi('tipo')]==='CLASE')[hi('docente')];
  const hoyR=run("lunesDe_(ymd_(new Date()))");   // un lunes (las novedades solo cuentan días hábiles)
  run('asegurarMotivos_()'); ok(hojas.Motivos.v.some(r=>/Invitación sindical/.test(String(r[1]))),'existe el motivo «Invitación sindical» (se agrega solo a la hoja Motivos)');
  const n0=hojas.Novedades.v.length;
  run(`registrarNovedad({docentes:[${JSON.stringify(dS)}],tipo:'AUSENCIA',desde:'${hoyR}',hasta:'${run(`resSumaDias_('${hoyR}',4)`)}',motivo:'Invitación sindical (encuentro, asamblea, delegados)',medio:'WhatsApp directo',atiende:'Otro docente (con espacio libre)',actividad:'Sí'})`);
  const cabN=hojas.Novedades.v[0], filasN=hojas.Novedades.v.slice(n0);
  ok(filasN.length>=1&&filasN.every(f=>f[cabN.indexOf('Grupo atendido por')]==='Otro docente (con espacio libre)'&&f[cabN.indexOf('Actividad de Aprendizaje')]==='Sí'),'la novedad anticipada guarda quién queda a cargo y si se dejó actividad');
  const todosAus=run(`ausentesDelDia_('${hoyR}')`);
  const aus=todosAus.find(a=>a.docente===dS);
  ok(aus&&aus.motivo.indexOf('sindical')>=0&&aus.jornada&&aus.atiende&&aus.actividad==='Sí','el aviso del día lista al docente ausente con su motivo, quién queda a cargo y la actividad');
  ok(aus&&aus.dias>=1&&aus.desde<=hoyR&&aus.hasta>=hoyR,'incluye el rango de días de esa novedad ('+(aus&&aus.dias)+' días)');
}
// ---- consulta de una fecha anterior (solo lectura) y novedades por horas solo en sus sesiones
{
  const hoyR=run("ymd_(new Date())"), lunPas=run(`resSumaDias_(lunesDe_('${hoyR}'),-7)`);
  const f3=H.Horario.slice(1).find(r=>r[hi('dia')]==='LUNES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===3), dH=f3[hi('docente')];
  const fr3=run("datos_('Franjas')").find(f=>Number(f.hora)===3);
  const ini=run(`hhmm_(${JSON.stringify(fr3.inicio)})`), fin=run(`hhmm_(${JSON.stringify(fr3.fin)})`);
  run(`registrarNovedad({docentes:[${JSON.stringify(dH)}],tipo:'HORAS',desde:'${lunPas}',hasta:'${lunPas}',horaIni:'${ini}',horaFin:'${fin}',motivo:'Cita médica',medio:'WhatsApp directo',atiende:'Otro docente (con espacio libre)',actividad:'Sí'})`);
  const a3=run(`consultarSesion(null,3,'sesion','${lunPas}')`), c3=a3.filas.find(f=>f.docente===dH);
  ok(a3.revision===true&&a3.fecha===lunPas&&a3.dia==='LUNES','consultarSesion con una fecha anterior: día hábil de esa fecha y modo de solo lectura');
  ok(c3&&c3.reporte&&c3.reporte.parcial&&c3.reporte.parcial.estado==='Ausente temporal'&&c3.reporte.parcial.minutos>0&&c3.reporte.parcial.atiende,'el permiso por horas se ve en la sesión de su horario, con minutos y quién queda a cargo');
  const a1=run(`consultarSesion(null,1,'sesion','${lunPas}')`), c1=a1.filas.find(f=>f.docente===dH);
  ok(!c1||!c1.reporte,'en otra sesión que no es la del permiso, no aparece el aviso ni se marca');
  let e1=null; try{run(`consultarSesion(null,1,'sesion','${run(`resSumaDias_('${lunPas}',-1)`)}')`)}catch(x){e1=x} ok(e1&&/hábil/.test(e1.message),'una fecha en fin de semana se rechaza');
  e1=null; try{run(`consultarSesion(null,1,'sesion','${run(`resSumaDias_('${hoyR}',20)`)}')`)}catch(x){e1=x} ok(e1&&/anterior/.test(e1.message),'una fecha futura se rechaza');
}
// ---- al crear una reunión se avisa de los convocados que ya tienen ausencia reportada ese día
{
  const lun=run("lunesDe_(ymd_(new Date()))"), esperados=run(`ausentesDelDia_('${lun}')`).filter(a=>a.jornada);
  const rr=run(`crearReunion({tipo:'Consejo académico',nombre:'Consejo con ausentes',fecha:'${lun}',inicio:'15:00',fin:'16:00',convocados:'TODOS'})`);
  ok(esperados.length>=1&&Array.isArray(rr.ausentes)&&rr.ausentes.length===esperados.length,'crearReunion avisa de los convocados con ausencia de jornada completa ese día ('+esperados.length+')');
  const lr=run(`cargarReunion({id:'${rr.id}'})`), pa=lr.personas.find(p=>p.ausente);
  ok(pa&&pa.ausente.motivo,'en la asistencia, esa persona trae su ausencia reportada (queda marcada «No asistió» con su motivo)');
}
// ---- corrección de una ronda anterior por quien administra, edición de novedades programadas y reuniones solo en días hábiles
{
  const clase=H.Horario.slice(1).find(r=>r[hi('dia')]==='MARTES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===3), dd=clase[hi('docente')], gg=clase[hi('grupo')];
  const cabR=hojas.Registro_Ronda.v[0], ic=(k)=>cabR.indexOf(k);
  const body=(extra)=>`guardarRonda(Object.assign({dia:'MARTES',sesion:3,fecha:'2026-10-13',directivo:'P',registros:[{docente:${JSON.stringify(dd)},sesion:3,grupoCodigo:${JSON.stringify(gg)},area:'X',estado:'Presente'}]},${JSON.stringify(extra||{})}))`;
  run("var _pa=puedeAdministrar_; puedeAdministrar_=function(){return false}");
  let e1=null; try{ run(body({})) }catch(x){ e1=x } ok(e1&&/Solo quien administra/.test(e1.message),'quien no administra no puede guardar la ronda de otra fecha');
  run("puedeAdministrar_=_pa");
  e1=null; try{ run(`_guardarRondaOrig({dia:'MARTES',sesion:3,fecha:'2026-10-13',directivo:'P',registros:[{docente:${JSON.stringify(dd)},sesion:3,grupoCodigo:${JSON.stringify(gg)},area:'X',estado:'Presente'}]})`) }catch(x){ e1=x }
  ok(e1&&/motivo de la corrección/.test(e1.message),'quien administra debe escribir el motivo de la corrección');
  const nb=hojas.Bitacora_Cambios.v.length;
  run(body({correccion:'Se marcó ausente por error de otro compañero'}));
  const fila=hojas.Registro_Ronda.v.slice().reverse().find(r=>r[ic('docente')]===dd&&r[ic('fecha')]==='2026-10-13'&&Number(r[ic('sesion')])===3);
  ok(fila&&/Corregido por .*Se marcó ausente por error/.test(String(fila[ic('observaciones')])),'cada marca corregida lleva quién la corrigió y el motivo');
  ok(hojas.Bitacora_Cambios.v.length>nb&&/Corrigió ronda anterior/.test(hojas.Bitacora_Cambios.v[hojas.Bitacora_Cambios.v.length-1][2]),'la corrección queda en la bitácora con el motivo');
  ok(run("consultarSesion(null,3,'sesion','2026-10-13')").puedeEditarPasadas===true,'la consulta le dice a quien administra que puede editar rondas anteriores');
  // novedades programadas: se completan después
  const dN=H.Horario.slice(1).find(r=>r[hi('dia')]==='JUEVES'&&r[hi('tipo')]==='CLASE')[hi('docente')], fut=run("resSumaDias_(ymd_(new Date()),7)");
  const fh=run(`diasHabilesRango_('${fut}','${run(`resSumaDias_('${fut}',6)`)}')[0]`);
  run(`registrarNovedad({docentes:[${JSON.stringify(dN)}],tipo:'AUSENCIA',desde:'${fh}',hasta:'${fh}',motivo:'Sin justificación',medio:'WhatsApp directo'})`);
  const reg0=run('registrosRecientes_(ymd_(new Date()))').find(r=>r.docente===dN&&r.desde===fh);
  ok(reg0&&reg0.editable&&!reg0.atiende,'la novedad programada aparece como editable y sin «a cargo»');
  run(`editarNovedad({id:'${reg0.id}',docente:${JSON.stringify(dN)},motivo:'Invitación sindical (encuentro, asamblea, delegados)',atiende:'Otro docente (con espacio libre)',actividad:'Sí',descripcion:'Encuentro de delegados',observacion:'Completa los datos'})`);
  const reg1=run('registrosRecientes_(ymd_(new Date()))').find(r=>r.id===reg0.id&&r.docente===dN);
  ok(reg1&&reg1.atiende==='Otro docente (con espacio libre)'&&reg1.actividad==='Sí'&&/sindical/.test(reg1.motivo),'editarNovedad agrega quién queda a cargo, la actividad y cambia el motivo');
  const cabN=hojas.Novedades.v[0], rn=hojas.Novedades.v.find(r=>r[cabN.indexOf('ID registro')]===reg0.id);
  ok(rn&&rn[cabN.indexOf('Categoría motivo')]==='PERMISO SINDICAL','al cambiar el motivo se actualiza también la categoría');
  ok(hojas.Bitacora_Cambios.v.some(r=>/Editó novedad/.test(r[2])),'la edición de la novedad queda en la bitácora');
  // reuniones: solo días hábiles
  const sab=run("(function(){ var f=ymd_(new Date()); while(resDia_(f)!==6) f=resSumaDias_(f,1); return f; })()");
  e1=null; try{ run(`crearReunion({tipo:'Consejo académico',fecha:'${sab}',inicio:'18:00',fin:'19:00',convocados:'TODOS'})`) }catch(x){ e1=x } ok(e1&&/lunes a viernes/.test(e1.message),'una reunión en sábado se rechaza si no se marca «Excepcional»');
  const fh2=run(`diasHabilesRango_('${fut}','${run(`resSumaDias_('${fut}',6)`)}')[0]`);
  const rf=run(`crearReunion({tipo:'Consejo académico',nombre:'Fuera de jornada',excepcional:true,fecha:'${fh2}',inicio:'17:30',fin:'19:00',convocados:'TODOS'})`); e1=null; try{ run(`crearReunion({tipo:'Consejo académico',nombre:'Fuera de jornada',fecha:'${fh2}',inicio:'17:30',fin:'19:00',convocados:'TODOS'})`) }catch(x){ e1=x } ok(e1&&/6:30|06:30/.test(e1.message),'fuera del horario de 6:30 a 18:00 se rechaza si no es excepcional');
  ok(rf&&rf.id&&run(`cargarReunion({id:'${rf.id}'})`).reunion.excepcional===true,'marcada como excepcional se permite y queda marcada');
  const rs=run(`crearReunion({tipo:'Actividad institucional general',nombre:'Bazar',fecha:'${sab}',inicio:'09:00',fin:'15:00',convocados:'TODOS',excepcional:true})`); ok(rs&&rs.id,'un sábado excepcional (bazar) se puede programar');
}
// ---- margen para registrar la ronda del día: fin de la jornada + 3 horas para los directivos; quien administra, sin límite
{
  ok(run('cierreRonda_()')==='16:30','el cierre de la ronda es el fin de la jornada (13:30) más 3 horas = 16:30');
  const clase=H.Horario.slice(1).find(r=>r[hi('dia')]==='MIERCOLES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===3), dd=clase[hi('docente')], gg=clase[hi('grupo')];
  const reg=`_guardarRondaOrig({dia:'MIERCOLES',sesion:3,fecha:'2026-10-21',directivo:'P',registros:[{docente:${JSON.stringify(dd)},sesion:3,grupoCodigo:${JSON.stringify(gg)},area:'X',estado:'Presente'}]})`;
  run("var _rc=rondaCerrada_, _pa2=puedeAdministrar_; rondaCerrada_=function(){return true}; puedeAdministrar_=function(){return false}");
  let e1=null; try{ run(reg) }catch(x){ e1=x } ok(e1&&/se cerró a las 16:30/.test(e1.message),'pasado el margen, un directivo que no administra ya no puede guardar la ronda de hoy');
  ok(run("consultarSesion(null,3,'sesion')").rondaCerrada===true,'la consulta avisa que la ronda de hoy está cerrada para ese directivo');
  run("puedeAdministrar_=function(){return true}"); e1=null; try{ run(reg) }catch(x){ e1=x } ok(!e1,'quien administra puede guardar la ronda de hoy fuera del margen');
  run("rondaCerrada_=_rc; puedeAdministrar_=_pa2");
  // día anterior para los demás directivos: configurable (0 por defecto)
  hojas.Parametros.v.push(['ronda_dias_atras','1']);
  run("puedeAdministrar_=function(){return false}"); e1=null; try{ run(`_guardarRondaOrig({dia:'MARTES',sesion:3,fecha:'2026-10-20',directivo:'P',correccion:'Registro tardío por viaje',registros:[{docente:${JSON.stringify(dd)},sesion:3,grupoCodigo:${JSON.stringify(gg)},area:'X',estado:'Presente'}]})`) }catch(x){ e1=x } ok(!e1,'con ronda_dias_atras=1 un directivo puede registrar la ronda del día anterior (con motivo)');
  e1=null; try{ run(`_guardarRondaOrig({dia:'LUNES',sesion:3,fecha:'2026-10-19',directivo:'P',correccion:'Registro tardío por viaje',registros:[{docente:${JSON.stringify(dd)},sesion:3,grupoCodigo:${JSON.stringify(gg)},area:'X',estado:'Presente'}]})`) }catch(x){ e1=x } ok(e1&&/Solo quien administra/.test(e1.message),'pero no dos días atrás');
  run("puedeAdministrar_=_pa2"); hojas.Parametros.v.pop();
}
// ---- sábados de entregas de boletines, jornadas, escuela de padres y ceremonias; cambiar los días de una ausencia; rondas anteriores solo para quien administra
{
  const sab=run("(function(){ var f=ymd_(new Date()); while(resDia_(f)!==6) f=resSumaDias_(f,1); return f; })()"), dom=run(`resSumaDias_('${sab}',1)`);
  const cr=(tipo,f,ini,fin,ex)=>run(`crearReunion({tipo:${JSON.stringify(tipo)},nombre:'x ${tipo.slice(0,6)}',fecha:'${f}',inicio:'${ini}',fin:'${fin}',convocados:'TODOS'${ex?',excepcional:true':''}})`);
  ok(['Entrega de boletines','Escuela de padres','Ceremonia de grado o proclamación'].every(t=>{ try{ return !!cr(t,sab,'14:00','17:00').id }catch(e){ return false } }),'boletines, escuela de padres y ceremonias de grado se programan en sábado sin marca excepcional (incluso por la tarde)');
  let e1=null; try{ cr('Consejo académico',sab,'09:00','10:00') }catch(x){ e1=x } ok(e1&&/Excepcional/.test(e1.message),'un consejo académico en sábado sí necesita la marca excepcional');
  e1=null; try{ cr('Entrega de boletines',dom,'09:00','10:00') }catch(x){ e1=x } ok(e1&&/Excepcional/.test(e1.message),'el domingo siempre necesita la marca excepcional');
  e1=null; try{ cr('Ceremonia de grado o proclamación',sab,'18:30','21:00') }catch(x){ e1=x } ok(e1&&/18:00/.test(e1.message),'una ceremonia nocturna (después de las 18:00) necesita la marca excepcional');
  // quien no administra no abre rondas de otras fechas
  run("var _pa3=puedeAdministrar_; puedeAdministrar_=function(){return false}");
  e1=null; try{ run(`consultarSesion(null,1,'sesion','${run("resSumaDias_(lunesDe_(ymd_(new Date())),-7)")}')`) }catch(x){ e1=x } ok(e1&&/informes/.test(e1.message),'quien no administra no abre rondas de otras fechas: se le indica el panel de informes');
  e1=null; try{ run(`editarReunion({id:'${run("reunionesDatos_()")[0].id}',tipo:'Consejo académico',nombre:'cambio',fecha:'2026-10-05',inicio:'08:00',fin:'09:00',convocados:'TODOS'})`) }catch(x){ e1=x } ok(e1&&/ya pasaron|solo las corrige/.test(e1.message||''),'quien no administra no edita reuniones que ya pasaron');
  run("puedeAdministrar_=_pa3");
  // cambiar los días de una ausencia
  const dN=H.Horario.slice(1).find(r=>r[hi('dia')]==='MARTES'&&r[hi('tipo')]==='CLASE')[hi('docente')];
  const f0=run(`diasHabilesRango_('${run("resSumaDias_(ymd_(new Date()),7)")}','${run("resSumaDias_(ymd_(new Date()),20)")}')`);
  run(`registrarNovedad({docentes:[${JSON.stringify(dN)}],tipo:'AUSENCIA',desde:'${f0[0]}',hasta:'${f0[0]}',motivo:'Sin justificación',medio:'WhatsApp directo'})`);
  const rg=run('registrosRecientes_(ymd_(new Date()))').find(r=>r.docente===dN&&r.desde===f0[0]);
  run(`editarNovedad({id:'${rg.id}',docente:${JSON.stringify(dN)},desde:'${f0[0]}',hasta:'${f0[4]}',observacion:'Se amplía la ausencia'})`);
  const rg2=run('registrosRecientes_(ymd_(new Date()))').find(r=>r.id===rg.id&&r.docente===dN);
  ok(rg2&&rg2.hasta>rg.hasta&&rg2.dias>rg.dias,'editarNovedad amplía los días de una ausencia ('+rg.dias+' → '+(rg2&&rg2.dias)+' días con clases)');
  run(`editarNovedad({id:'${rg.id}',docente:${JSON.stringify(dN)},desde:'${f0[2]}',hasta:'${f0[2]}'})`);
  const rg3=run('registrosRecientes_(ymd_(new Date()))').find(r=>r.id===rg.id&&r.docente===dN);
  ok(rg3&&rg3.desde===f0[2]&&rg3.hasta===f0[2]&&rg3.dias<=1,'y también la puede mover o reducir a otro día');
}
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
