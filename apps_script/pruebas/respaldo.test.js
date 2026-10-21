// Respaldo de rondas y recuperación desde una copia (Respaldo.gs): solo agrega lo que falta y respeta lo actual.
const fs=require('fs'), vm=require('vm'), path=require('path');
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)} clear(){this.v=[]}
  getRange(r,c,nr,nc){const s=this;return {setValues(a){a.forEach((row,i)=>{s.v[r-1+i]=s.v[r-1+i]||[];row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x})})}}}}
const cabR=['marca_temporal','fecha','dia','sesion','franja','docente','grupo','area','estado'];
const R=(f,s,d,g,a,e)=>['x',f,'MARTES',s,'',d,g,a,e];
const actual=[cabR,R('2026-10-21',5,'Nuevo Titular',"'0702",'ERD','No asistió')];
const copia=[cabR.concat([]),R('2026-10-19',3,'Vieja Persona','0701','CNA','Presente'),R('2026-10-21',5,'Persona Antigua','702','ERD','Presente'),R('2026-10-19',4,'Otra','0701','CNA','Presente')];
const incAct=[['id','fecha','docente'],['a','2026-10-19','X']], incCop=[['id','fecha','docente'],['a','2026-10-19','X'],['b','2026-10-20','Y']];
const hojas={Registro_Ronda:new Hoja(actual),Incumplimientos:new Hoja(incAct),Novedades:new Hoja([['Fecha Novedad','Docente']]),Parametros:new Hoja([['clave','valor']]),Bitacora_Cambios:new Hoja([['fecha_hora','quien','accion','detalle']]),Directivos:new Hoja([['nombre','correo_temporal'],['Yo','dueno@gmail.com']])};
const origen={Registro_Ronda:new Hoja(copia),Incumplimientos:new Hoja(incCop)};
const respaldo={}; let creados=0, resp=[], respuestas=[];
const libroResp={getId:()=>'RESPALDO1234567890123456789012345',getUrl:()=>'url',getSheetByName:n=>respaldo[n]||null,insertSheet:n=>(respaldo[n]=new Hoja([]))};
const g={Utilities:{formatDate:()=> '2026-10-21 08:00'},Logger:{log(){}},Session:{getActiveUser:()=>({getEmail:()=>'dueno@gmail.com'})},
 SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n]||null,insertSheet:n=>(hojas[n]=new Hoja([]))}),
   create:()=>{creados++;return libroResp}, openById:id=>id.startsWith('RESPALDO')?libroResp:{getSheetByName:n=>origen[n]||null},
   getUi:()=>({ButtonSet:{YES_NO:1,OK_CANCEL:2,OK:3},Button:{YES:'Y',NO:'N',OK:'OK',CANCEL:'C'},alert(t,m){resp.push([t,m]);return respuestas.length?respuestas.shift():'Y'},prompt(){return {getSelectedButton:()=>'OK',getResponseText:()=>'https://docs.google.com/spreadsheets/d/ABCDEFGHIJKLMNOPQRSTUVWXYZ123456/edit'}}})},console};
vm.createContext(g);
['Codigo.gs','Soportes.gs','Acceso.gs','Respaldo.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;}; const run=c=>vm.runInContext(c,g);
// respaldo al guardar
run(`respaldarRonda_([['x','2026-10-21','MARTES',5,'','Nuevo Titular',"'0702",'ERD','No asistió']])`);
ok(creados===1&&respaldo.Registro_Ronda_log.v.length===2&&respaldo.Registro_Ronda_log.v[1].slice(-1)[0]==='2026-10-21 08:00','cada guardado se anota en el libro de respaldo (se crea una sola vez)');
run(`respaldarRonda_([['x','2026-10-21','MARTES',6,'','Z','0702','ERD','Presente']])`); ok(creados===1&&respaldo.Registro_Ronda_log.v.length===3,'el libro de respaldo se reutiliza');
g.SpreadsheetApp.create=()=>{throw new Error('sin permiso')}; hojas.Parametros.v.length=1; let err=null; try{run(`respaldarRonda_([['x']])`)}catch(e){err=e}; ok(!err,'si el respaldo falla, el guardado no se afecta');
// recuperar desde copia
respuestas=['Y']; run('recuperarRondasDesdeCopia()');
const act=hojas.Registro_Ronda.v;
ok(act.length===4,'se agregan solo las 2 marcas que faltan (la de hoy ya existía y se respeta)');
ok(act[1][5]==='Nuevo Titular'&&act[1][8]==='No asistió','lo que ya estaba (lo de hoy) no cambia');
ok(act.some(f=>f[1]==='2026-10-19'&&f[3]===3)&&act.some(f=>f[1]==='2026-10-19'&&f[3]===4),'se recuperan las marcas anteriores');
ok(hojas.Incumplimientos.v.length===3&&hojas.Incumplimientos.v[2][0]==='b','también los incumplimientos que faltan');
respuestas=['Y']; const antes=JSON.stringify(hojas.Registro_Ronda.v); run('recuperarRondasDesdeCopia()'); ok(JSON.stringify(hojas.Registro_Ronda.v)===antes,'repetir no duplica');
// respaldo completo
g.SpreadsheetApp.create=()=>{creados++;return libroResp}; respuestas=[]; run('respaldarTodoAhora()'); ok(respaldo.Registro_Ronda&&respaldo.Registro_Ronda.v.length===4,'respaldo completo copia la hoja entera');
console.log(fallos?'HAY FALLAS':'Todo bien'); process.exit(fallos?1:0);
