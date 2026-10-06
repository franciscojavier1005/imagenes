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
let EMAIL='dueno@gmail.com', archivos=[], papelera=[];
const g={Utilities:{formatDate:fmt,getUuid:()=>'u'+Math.random().toString(36).slice(2,10),base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(b,m,n)=>({b,m,n})},
  Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n]||null,
    insertSheet:n=>(hojas[n]=new Hoja([]))}),getUi:()=>({alert(){}})},
  DriveApp:{Access:{PRIVATE:1},Permission:{NONE:1},
    createFolder:()=>({getId:()=>'RAIZ',createFolder:n=>({createFile:b=>{const f={b,id:'F'+archivos.length,setSharing(){},getId(){return this.id},getUrl(){return 'https://drive/'+this.id}};archivos.push(f);return f},getFoldersByName:()=>({hasNext:()=>false})}),getFoldersByName:()=>({hasNext:()=>false})}),
    getFolderById:()=>{throw new Error('no')},getFileById:id=>({setTrashed(){papelera.push(id)}})},console};
const FIJA=new Date('2026-10-08T15:00:00Z').getTime();   // jueves 8 de octubre de 2026
g.Date=class extends Date{constructor(...a){a.length?super(...a):super(FIJA)} static now(){return FIJA}};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Sesion.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));

let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const run=(c)=>vm.runInContext(c,g); const falla=(c)=>{try{run(c);return null}catch(e){return String(e.message)}};
const hi=H.Horario[0].indexOf.bind(H.Horario[0]);
const H_=H.Horario.slice(1);
const minGrupo=(r)=>/^00/.test(String(r[hi('tipo')]==='ENFASIS'?r[hi('grupos_enfasis')]:r[hi('grupo')]).split('+')[0])?60:45;
const delDia=(d,dia)=>H_.filter(r=>r[hi('docente')]===d&&r[hi('dia')]===dia);
const cuenta=Object.create(null); H_.filter(r=>r[hi('dia')]==='JUEVES').forEach(r=>cuenta[r[hi('docente')]]=(cuenta[r[hi('docente')]]||0)+1);
const nombres=Object.keys(cuenta).filter(n=>cuenta[n]>=4).sort();
const A=nombres[0], B=nombres[1], C=nombres[2];
const cab=H.Novedades[0], c=k=>cab.indexOf(k);
const nuevas=(n0)=>hojas.Novedades.v.slice(n0);

// ---- 1) ausencia de varios días (jueves 8, viernes 9 y lunes 12; el fin de semana se omite)
g.P1={docentes:[A],tipo:'AUSENCIA',desde:'2026-10-08',hasta:'2026-10-12',motivo:'Mal estado de salud',medio:'WhatsApp directo',descripcion:'Avisó por WhatsApp'};
let n0=hojas.Novedades.v.length;
const r1=run('registrarNovedad(P1)');
const diasA=['JUEVES','VIERNES','LUNES'].filter(d=>delDia(A,d).length).length;
ok(r1.dias===diasA&&r1.filas===diasA&&nuevas(n0).length===diasA,`ausencia de varios días: ${diasA} días con clases, una fila JC por día (fin de semana omitido)`);
const nv=hojas.Novedades.v;
ok(nv[0].includes('ID registro')&&nuevas(n0).every(f=>f[nv[0].indexOf('ID registro')]===r1.id),'agrega la columna "ID registro" si el libro no la tiene y marca cada fila');
const jueves=nuevas(n0).find(f=>fechaIsoT(f[c('Fecha Novedad')])==='2026-10-08');
function fechaIsoT(x){return String(x).slice(0,10);}
const totA=delDia(A,'JUEVES').reduce((a,r)=>a+minGrupo(r),0);
ok(jueves[c('Sesiones')]==='JC'&&jueves[c('Minutos Desatendidos')]===totA&&jueves[c('Tipo Novedad')]==='No asistió'&&jueves[c('Justificada')]==='Sí',`la fila del jueves es JC con el total del día (${totA} min) y justificada`);
ok(jueves[c('Directivo Docente')]==='Francisco Cortés'||String(jueves[c('Directivo Docente')]).length>0,'queda a nombre de quien registra ('+jueves[c('Directivo Docente')]+')');
// repetir no duplica
const nA=hojas.Novedades.v.length; run('registrarNovedad(P1)'); ok(hojas.Novedades.v.length===nA,'registrar lo mismo otra vez reemplaza (no duplica)');

// ---- 2) la ronda del jueves ve lo reportado
const sesA=Number(delDia(A,'JUEVES')[0][hi('hora')]);
g.SA=sesA;
const rj=run("consultarSesion('JUEVES',SA,'sesion')");
const fa=rj.filas.find(f=>f.docente===A);
ok(rj.fecha==='2026-10-08'&&fa&&fa.reporte&&fa.reporte.tipo==='No asistió'&&fa.reporte.jornada===true&&/WhatsApp/.test(fa.reporte.medio),'la ronda muestra "Reportado hoy: No asistió" (jornada completa, medio WhatsApp)');
// al confirmarlo en la ronda no se duplican minutos
const antes=hojas.Novedades.v.length;
g.RG={dia:'JUEVES',sesion:sesA,registros:[{docente:A,grupoCodigo:fa.grupoCodigo,area:fa.area,estado:'No asistió',motivo:'Mal estado de salud'}]};
run('guardarRonda(RG)'); ok(hojas.Novedades.v.length===antes,'confirmar en la ronda lo ya reportado no suma minutos otra vez');

// ---- 3) llegada tarde avisada: minutos = traslape con la hora de llegada
const sB=delDia(B,'JUEVES').sort((a,b)=>Number(a[hi('hora')])-Number(b[hi('hora')]));
const aMin=h=>{const m=String(h).match(/(\d+):(\d+)/);return +m[1]*60+ +m[2]};
const llegada=String(sB[1][hi('fin')]).slice(0,5), lim=aMin(llegada);
const esperaTarde=sB.map(r=>Math.max(0,Math.min(lim,aMin(r[hi('fin')]))-Math.max(0,aMin(r[hi('inicio')])))).filter(x=>x>0);
g.P3={docentes:[B],tipo:'TARDE',desde:'2026-10-08',horaFin:llegada,motivo:'Situación fortuita camino al trabajo',medio:'Llamada celular',descripcion:'Se le pinchó la moto'};
n0=hojas.Novedades.v.length; const r3=run('registrarNovedad(P3)');
const f3=nuevas(n0);
ok(f3.length===esperaTarde.length&&f3.reduce((a,f)=>a+f[c('Minutos Desatendidos')],0)===esperaTarde.reduce((a,x)=>a+x,0),`llegada tarde : ${f3.length} sesiones y ${esperaTarde.reduce((a,x)=>a+x,0)} min (traslape real con el horario)`);
ok(f3.every(f=>f[c('Tipo Novedad')]==='Llegada tarde informada'&&/^Llega a las \d\d:\d\d\. Se le pinchó/.test(f[c('Descripción')])),'tipo "Llegada tarde informada" y descripción con la hora');
// ya ausente todo el día: no se mezcla
g.P3b={docentes:[A],tipo:'TARDE',desde:'2026-10-08',horaFin:'09:00',motivo:'Sin justificación'};
ok(/ya estaban reportados|No se guardó/.test(falla('registrarNovedad(P3b)')||''),'si ya está ausente todo el día, no se agrega una llegada tarde encima');

// ---- 4) salida pedagógica con estudiantes: no suma tiempo y la ronda no lo marca ausente
g.P4={docentes:[C],tipo:'EXTERNA',desde:'2026-10-08',todoElDia:true,motivo:'Intercolegiados o evento deportivo con estudiantes',descripcion:'Fútbol sala en el coliseo'};
n0=hojas.Novedades.v.length; const r4=run('registrarNovedad(P4)'); const f4=nuevas(n0);
ok(f4.length===delDia(C,'JUEVES').length&&f4.every(f=>f[c('Tipo Novedad')]==='Actividad externa con estudiantes'&&f[c('Minutos Desatendidos')]===''),'salida pedagógica: una fila por sesión, sin minutos');
g.SC=Number(delDia(C,'JUEVES')[0][hi('hora')]);
const rc=run("consultarSesion('JUEVES',SC,'sesion')"); const fc=rc.filas.find(f=>f.docente===C);
ok(fc&&fc.externa&&/Intercolegiados/.test(fc.externa.motivo)&&!fc.reporte,'la ronda lo muestra "fuera con estudiantes" (no como novedad de ausencia)');
const antes4=hojas.Novedades.v.length, reg0=hojas.Registro_Ronda.v.length;
g.RG2={dia:'JUEVES',sesion:g.SC,registros:[{docente:C,grupoCodigo:fc.grupoCodigo,area:fc.area,estado:'No asistió',motivo:'Sin justificación'}]};
run('guardarRonda(RG2)');
ok(hojas.Novedades.v.length===antes4&&hojas.Registro_Ronda.v[hojas.Registro_Ronda.v.length-1][8]==='En actividad externa'&&hojas.Registro_Ronda.v.length===reg0+1,'si alguien lo marca ausente por error, queda "En actividad externa" y no suma novedad');
const dash=run("datosDashboard('2026-10-08','2026-10-08',{})");
ok(dash.kpis.salidasPedagogicas===1&&!dash.lista.some(x=>x.docente===C),'el panel cuenta 1 salida pedagógica y no la mezcla con las novedades de tiempo');
const minSinC=dash.kpis.minutos; ok(minSinC===totA+esperaTarde.reduce((a,x)=>a+x,0),`los minutos del panel (${minSinC}) solo incluyen la ausencia y la llegada tarde`);

// ---- 5) validaciones
ok(/motivo/i.test(falla("registrarNovedad({docentes:['"+A+"'],tipo:'AUSENCIA',desde:'2026-10-08',motivo:'inventado'})")||''),'motivo inexistente: se rechaza');
ok(/Elija al menos un docente/.test(falla("registrarNovedad({docentes:['Nadie'],tipo:'AUSENCIA',desde:'2026-10-08',motivo:'Sin justificación'})")||''),'docente inexistente: se rechaza');
ok(/hora/i.test(falla("registrarNovedad({docentes:['"+B+"'],tipo:'HORAS',desde:'2026-10-08',horaIni:'10:00',horaFin:'09:00',motivo:'Sin justificación'})")||''),'rango de horas al revés: se rechaza');
ok(/fechas/i.test(falla("registrarNovedad({docentes:['"+B+"'],tipo:'AUSENCIA',desde:'2026-10-09',hasta:'2026-10-01',motivo:'Sin justificación'})")||''),'fechas al revés: se rechaza');
ok(/45 días/.test(falla("registrarNovedad({docentes:['"+B+"'],tipo:'AUSENCIA',desde:'2026-10-09',hasta:'2026-12-31',motivo:'Sin justificación'})")||''),'rango máximo de 45 días');
// permiso por horas
const s0=sB[0], ph={i:String(s0[hi('inicio')]).slice(0,5),f:String(s0[hi('fin')]).slice(0,5)};
g.P5={docentes:[B],tipo:'HORAS',desde:'2026-10-08',horaIni:ph.i,horaFin:ph.f,motivo:'Permiso del rector',medio:'Verbal'};
n0=hojas.Novedades.v.length; run('registrarNovedad(P5)'); ok(nuevas(n0).every(f=>f[c('Tipo Novedad')]==='Ausente temporal'&&/^De \d\d:\d\d a \d\d:\d\d/.test(f[c('Descripción')])),'permiso por horas: tipo "Ausente temporal" solo en las sesiones que se cruzan');

// ---- 6) datos de la pantalla, anulación y permisos
const dn=run('datosNovedades()');
ok(dn.docentes.length>40&&dn.tipos.length===5&&dn.motivosExterna.every(m=>dn.motivos.some(x=>x.motivo===m))&&dn.registros.length>=4,'la pantalla recibe docentes, 5 tipos, motivos de salidas (agregados solos) y los registros recientes');
const nAn=hojas.Novedades.v.length;
const q=run(`quitarNovedad({id:'${r4.id}',docente:'${C}'})`);
ok(q.quitadas===f4.length&&hojas.Novedades.v.length===nAn-f4.length,'anular quita todas las filas del registro');
ok(hojas.Novedades_Anuladas&&hojas.Novedades_Anuladas.v.length===2&&hojas.Novedades_Anuladas.v[1][1]===C,'la anulación queda anotada en Novedades_Anuladas (quién y cuándo)');
ok(/No se encontr/.test(falla(`quitarNovedad({id:'${r4.id}'})`)||''),'anular dos veces: aviso');
EMAIL='';
ok(['datosNovedades()',"registrarNovedad({})","quitarNovedad({id:'x'})"].every(x=>falla(x)!==null),'sin sesión nadie puede ver ni registrar novedades');
EMAIL='dueno@gmail.com';
// ---- 7) tutora PTAFI en las reuniones
const iN=H.Docentes[0].indexOf('nivel'), iNom=H.Docentes[0].indexOf('nombre_completo'), fila=hojas.Docentes.v.findIndex((r,i)=>i>0&&r[iN]==='PRIMARIA');
hojas.Docentes.v[fila][iN]='TUTORA PTAFI'; const tut=hojas.Docentes.v[fila][iNom];
ok(run('personasReunion_()').some(x=>x.nombre===tut&&x.rol==='Tutora PTAFI'),'la tutora PTAFI figura entre las personas de las reuniones (rol "Tutora PTAFI")');
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
