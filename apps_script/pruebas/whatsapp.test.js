// Prueba de la bandeja de WhatsApp, el aviso "Reportado hoy" y la ronda, con hojas simuladas (sin Google).
// Antes: python3 apps_script/pruebas/exportar_hojas.py
const fs=require('fs'), vm=require('vm'), path=require('path');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8'));
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getRange(r,c){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x}))}}}
  deleteRow(r){this.v.splice(r-1,1)}}
const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date());
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`; if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]); if(p==='HH:mm')return new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit'}).format(d); return String(d);};
const hojas={}; Object.keys(H).forEach(n=>hojas[n]=new Hoja(H[n]));
hojas.Bandeja_WhatsApp=new Hoja([['fecha','hora','remitente','docente','tipo_novedad','motivo','categoria','justificada','confianza','mensaje','confirmar','importado']]);
const g={Utilities:{formatDate:fmt},Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  SpreadsheetApp:{getActive:()=>({getSheetByName:n=>hojas[n]}),getUi:()=>({alert(){}})},console};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const hi=H.Horario[0].indexOf.bind(H.Horario[0]);
// un docente de bachillerato con clase el viernes
const filasV=H.Horario.slice(1).filter(r=>r[hi('dia')]==='VIERNES'&&r[hi('tipo')]==='CLASE');
const doc=filasV[0][hi('docente')], sesV=filasV.filter(r=>r[hi('docente')]===doc).length, otro=filasV.find(r=>r[hi('docente')]!==doc)[hi('docente')];
const FECHA='2026-10-02';   // viernes
const B=hojas.Bandeja_WhatsApp.v;
B.push([FECHA,'06:41','Francisco Cortés',doc,'No asistió','Mal estado de salud','SALUD','Sí','alta','La profe amaneció enferma','SI','']);
B.push([FECHA,'06:50','Francisco Cortés',doc,'No asistió','Mal estado de salud','SALUD','Sí','alta','repetido','SI','']);
B.push([FECHA,'07:00','Rector','','No asistió','Otro','OTRO','Sí','sin docente','Una profe no viene','SI','']);
B.push([FECHA,'07:05','Francisco Cortés',otro,'Llegada tarde informada','Situación fortuita camino al trabajo','FORTUITO','Sí','media','llega tarde','','']);
const nov0=hojas.Novedades.v.length;
const r=vm.runInContext('importarBandeja_()',g);
ok(r.importadas===1&&r.duplicadas===1&&r.sinDocente===1,`1 importada, 1 duplicada, 1 sin docente (${JSON.stringify(r)})`);
const fn=hojas.Novedades.v[hojas.Novedades.v.length-1], nh=H.Novedades[0], c=k=>nh.indexOf(k);
ok(hojas.Novedades.v.length===nov0+1,'una sola fila nueva en Novedades');
ok(fn[c('Docente')]===doc&&fn[c('Medio Información')]==='WhatsApp grupal'&&fn[c('Sesiones')]==='JC','docente, medio WhatsApp grupal y sesiones "JC"');
ok(fn[c('Minutos Desatendidos')]===sesV*45,`minutos = ${sesV} sesiones del viernes x 45 = ${fn[c('Minutos Desatendidos')]}`);
ok(fn[c('Justificada')]==='Sí'&&fn[c('Categoría motivo')]==='SALUD'&&fn[c('Directivo Docente')]==='Francisco Cortés','justificada y categoría tomadas del catálogo de motivos; directivo = remitente');
ok(B[1][11]==='SI'&&B[2][11]==='DUPLICADO'&&B[3][11]==='','columna importado marcada (SI / DUPLICADO / vacía si no se confirmó ni había docente)');
// aviso "Reportado hoy" en la ronda
hojas.Novedades.v.push([new Date(),hoy,doc,'No asistió','N/A','Mal estado de salud','Amaneció enferma','Coordinador(a)','WhatsApp grupal','N/A','N/A','Todas','Jornada completa',90,'Francisco Cortés','JC','Sí','SALUD']);
const sesion3=H.Horario.slice(1).find(x=>x[hi('dia')]==='VIERNES'&&x[hi('docente')]===doc)[hi('hora')];
const cons=vm.runInContext(`consultarSesion('VIERNES',${sesion3})`,g);
const fila=cons.filas.find(x=>x.docente===doc);
ok(fila&&fila.reporte&&fila.reporte.motivo==='Mal estado de salud'&&fila.reporte.jornada===true&&/enferma/.test(fila.reporte.texto),'la ronda muestra "Reportado hoy": motivo, texto del mensaje y jornada completa');
const conNovedadHoy=new Set(hojas.Novedades.v.slice(1).filter(x=>{let f=x[1] instanceof Date?fmt(x[1],'America/Bogota','yyyy-MM-dd'):String(x[1]);const m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)f=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return f===hoy&&x[3]!=='Presente';}).map(x=>x[2]));
ok(cons.filas.every(x=>!!x.reporte===conNovedadHoy.has(x.docente)),'solo tienen aviso los docentes con una novedad registrada hoy (independiente de la fecha de la prueba)');
// la ronda no duplica minutos si ya hay una ausencia de jornada completa
const n1=hojas.Novedades.v.length, r1=hojas.Registro_Ronda.v.length;
vm.runInContext(`guardarRonda({directivo:'Francisco Cortés',dia:'VIERNES',sesion:${sesion3},fecha:'${hoy}',registros:[{docente:${JSON.stringify(doc)},grupoCodigo:'0601',area:'CAS',estado:'No asistió',motivo:'Mal estado de salud',minutos:'',actividad:'N/A',obs:''}]})`,g);
ok(hojas.Registro_Ronda.v.length===r1+1&&hojas.Novedades.v.length===n1,'ronda: se registra la verificación pero NO se duplica la novedad (ya era jornada completa)');
vm.runInContext(`guardarRonda({directivo:'Francisco Cortés',dia:'VIERNES',sesion:${sesion3},fecha:'${hoy}',registros:[{docente:${JSON.stringify(otro)},grupoCodigo:'0601',area:'CAS',estado:'No asistió',motivo:'Permiso del rector',minutos:'',actividad:'N/A',obs:''}]})`,g);
ok(hojas.Novedades.v.length===n1+1,'ronda: otro docente sin reporte previo sí genera su novedad');
process.exit(fallos?1:0);
