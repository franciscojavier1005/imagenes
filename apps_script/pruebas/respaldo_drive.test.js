// Copias programadas de los libros en Drive (Respaldo.gs): diaria con reemplazo, semanal y mensual, poda de diarias.
const fs=require('fs'), vm=require('vm'), path=require('path');
class Hoja{constructor(v){this.v=v} getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}}
class Carpeta{constructor(n){this.n=n;this.hijos={};this.arch=[]}
  getFoldersByName(n){const h=this.hijos[n];return {hasNext:()=>!!h,next:()=>h}} createFolder(n){return this.hijos[n]=new Carpeta(n)}
  getFilesByName(n){const l=this.arch.filter(f=>f.nombre===n&&!f.papelera);let i=0;return {hasNext:()=>i<l.length,next:()=>l[i++]}}
  getFiles(){const l=this.arch.filter(f=>!f.papelera);let i=0;return {hasNext:()=>i<l.length,next:()=>l[i++]}}}
const raiz=new Carpeta('raiz'); let triggers=[], bit=[];
const hojas={Parametros:new Hoja([['clave','valor'],['respaldo_id','RESP1']])};
const g={Utilities:{formatDate:(d,tz,f)=>{const p=n=>String(n).padStart(2,'0');const y=d.getFullYear(),m=p(d.getMonth()+1),dd=p(d.getDate());if(f==='u')return String(d.getDay()||7);return f==='yyyy-MM-dd'?`${y}-${m}-${dd}`:`${y}-${m}-${dd} 08:00`}},Logger:{log(){}},console,
 SpreadsheetApp:{getActive:()=>({getId:()=>'PRINC',getName:()=>'ICET · Asistencia',getSheetByName:n=>hojas[n]||null})},
 DriveApp:{getRootFolder:()=>raiz,getFileById:id=>({makeCopy:(n,c)=>{c.arch.push({nombre:n,id,papelera:false,getName(){return this.nombre},setTrashed(v){this.papelera=v}})}})},
 ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger:t=>{triggers=triggers.filter(x=>x!==t)},newTrigger:h=>({timeBased:()=>({everyDays:()=>({atHour:()=>({nearMinute:()=>({create:()=>triggers.push({getHandlerFunction:()=>h})})})})})})}};
vm.createContext(g);
['Codigo.gs','Soportes.gs','Acceso.gs','Respaldo.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
g.bitacora_=(a,d)=>bit.push(a);
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;}; const run=c=>vm.runInContext(c,g);
const app=()=>raiz.hijos['App Asistencia'].hijos.Respaldos.hijos; const act=n=>app()[n].arch.filter(f=>!f.papelera).map(f=>f.nombre);
g.hoy=d=>new Date(2026,9,d); // octubre 2026
run('respaldoProgramado(hoy(19))');   // lunes 19
ok(act('Diario').length===2&&act('Semanal').length===2&&act('Mensual').length===2,'primer día: copia diaria, semanal y mensual de los 2 libros');
run('respaldoProgramado(hoy(19))'); ok(act('Diario').length===2,'repetir el mismo día reemplaza la copia diaria');
run('respaldoProgramado(hoy(20))'); run('respaldoProgramado(hoy(21))'); run('respaldoProgramado(hoy(22))');
ok(act('Diario').every(n=>!/10-19$/.test(n))&&act('Diario').length===6,'solo quedan los últimos 3 días (se borra el 19)');
ok(act('Semanal').length===2,'en la misma semana no se repite la semanal');
run('respaldoProgramado(hoy(26))'); ok(act('Semanal').length===4&&act('Semanal').some(n=>/semana 2026-10-26$/.test(n)),'la semana siguiente agrega su copia semanal (lunes 26)');
ok(act('Mensual').length===2,'el mes sigue igual');
run('respaldoProgramado(new Date(2026,10,2))'); ok(act('Mensual').length===4,'en noviembre agrega la mensual');
g.SpreadsheetApp.getUi=()=>({ButtonSet:{OK:1},alert(){}}); g.exigirEditor_=()=>{}; run('instalarRespaldoDiario()'); run('instalarRespaldoDiario()'); ok(triggers.length===1,'el disparador diario se instala una sola vez');
console.log(fallos?'HAY FALLAS':'Todo bien'); process.exit(fallos?1:0);
