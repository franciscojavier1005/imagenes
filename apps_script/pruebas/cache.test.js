// Caché de hojas estáticas (Codigo.gs): evita releer el horario en cada pantalla, conserva las horas y se borra al editar.
const fs=require('fs'), vm=require('vm'), path=require('path');
let lecturas=0, fecha=null;
const hoja={getDataRange:()=>({getValues:()=>{lecturas++;return [['docente_n','docente','inicio'],[1,'Ana',fecha],['','',''],[2,'Beto',fecha]]}})};
const almacen={}; const cache={get:k=>k in almacen?almacen[k]:null,getAll:ks=>{const o={};ks.forEach(k=>{if(k in almacen)o[k]=almacen[k]});return o},putAll:(o)=>Object.assign(almacen,o),removeAll:ks=>ks.forEach(k=>delete almacen[k])};
const g={SpreadsheetApp:{getActive:()=>({getSheetByName:n=>n==='Horario'||n==='Registro_Ronda'?hoja:null})},CacheService:{getScriptCache:()=>cache},Utilities:{formatDate:()=>''},Logger:{log(){}},console};
vm.createContext(g); fecha=vm.runInContext("new Date('1899-12-30T11:30:00Z')",g); vm.runInContext(fs.readFileSync(path.join(__dirname,'..','Codigo.gs'),'utf8'),g);
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;}; const run=c=>vm.runInContext(c,g);
const a=run("datos_('Horario')"); ok(a.length===2&&lecturas===1,'primera lectura va a la hoja');
const b=run("datos_('Horario')"); ok(lecturas===1&&b.length===2&&b[0].docente==='Ana','la segunda sale de la caché (sin releer la hoja)');
ok(typeof b[0].inicio.getTime==='function'&&b[0].inicio.getTime()===fecha.getTime(),'las horas (fechas) sobreviven a la caché');
run("datos_('Registro_Ronda')"); run("datos_('Registro_Ronda')"); ok(lecturas===3,'las hojas de registro NO se guardan en caché (siempre frescas)');
run("onEdit({range:{getSheet:()=>({getName:()=>'Horario'})}})"); run("datos_('Horario')"); ok(lecturas===4,'al editar la hoja a mano se borra la caché');
run("datos_('Horario')"); ok(lecturas===4,'y vuelve a guardarse');
run("invalidarCache_('Horario')"); run("datos_('Horario')"); ok(lecturas===5,'las herramientas del código también la borran');
console.log(fallos?'HAY FALLAS':'Todo bien'); process.exit(fallos?1:0);
