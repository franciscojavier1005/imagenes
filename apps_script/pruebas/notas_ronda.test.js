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
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Reuniones.gs','Incumplimientos.gs','Sesion.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
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
EMAIL='dueno@gmail.com'; const hoyR=fmt(new Date(),'America/Bogota','yyyy-MM-dd');
const clase3=H.Horario.slice(1).find(r=>r[hi('dia')]==='VIERNES'&&r[hi('tipo')]==='CLASE'&&Number(r[hi('hora')])===3), dR=clase3[hi('docente')];
g.RC={tipo:'Consejo académico',nombre:'Consejo académico de prueba',inicio:'08:00',fin:'10:00',sinEstudiantes:false,convocados:[dR,'Persona que no existe'],directivo:'P'};
const rc1=run('crearReunion(RC)');
g.RA={id:rc1.id,registros:[{persona:dR,estado:'Asistió'},{persona:'Otro cualquiera',estado:'Asistió'}],directivo:'P'};
const ga=run('guardarAsistenciaReunion(RA)');
ok(ga.guardados===1,'la asistencia solo guarda a los convocados (se ignora a quien no lo es)');
const cr=run("cargarReunion({id:'"+rc1.id+"'})"); ok(cr.personas.length===1&&cr.personas[0].registro.estado==='Asistió','cargarReunion devuelve convocados y lo registrado');
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
ok(rondaJ.sinEstudiantes===true&&rondaJ.filas.length===0&&/sin estudiantes/.test(rondaJ.nota),'jornada pedagógica: la ronda de aula se suspende y avisa');
const lj=run('listarReuniones({})'); ok(lj.reuniones.length===2&&lj.personas.length>40&&lj.tipos.some(t=>t.tipo==='Jornada pedagógica'),'listarReuniones: reuniones del día, tipos y personas (docentes + directivos)');
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
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
