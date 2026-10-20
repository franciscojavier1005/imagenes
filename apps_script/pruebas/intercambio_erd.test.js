// Intercambio de Docente 1 y Docente 2 de Educación Física (Horarios.gs): vista previa, aplicación única, registros, choques y límites.
const fs=require('fs'), vm=require('vm'), path=require('path');
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  getLastRow(){return this.v.length} getLastColumn(){return this.v[0].length}
  appendRow(r){this.v.push(r)}
  getRange(r,c,nr,nc){const s=this;return {setValue(x){s.v[r-1][c-1]=x},setValues(a){a.forEach((row,i)=>row.forEach((x,j)=>{s.v[r-1+i][c-1+j]=x}))},getValues(){return JSON.parse(JSON.stringify(s.v.slice(r-1,r-1+nr).map(f=>f.slice(c-1,c-1+nc))))}}}}
const A='Arizala Castro Roberto Carlos', B='Armero Dájome Jesús', O='Ordóñez Tenorio Jaime Marcial';
const hz=[['docente_n','docente','dia','hora','tipo','grupo','area','grupos_enfasis','celda_original','formula'],
 [4,A,'LUNES',3,'CLASE','CS102','ERD','','CS102-ERD','f'],[4,A,'MARTES',7,'CLASE','CS102','CNA','','CS102-CNA','f'],
 [57,B,'LUNES',1,'ENFASIS','','ERD','0702','ENFASIS-0702','f'],[57,B,'MARTES',7,'ENFASIS','','ERD','0602','ENFASIS-0602','f'],[57,B,'LUNES',3,'CLASE','0702','ERD','','0702-ERD','f'],
 [9,'Otro Docente','LUNES',3,'CLASE','0801','TEI','','0801-TEI','f']];
const rr=[['marca_temporal','fecha','dia','sesion','franja','docente','grupo','area','estado'],
 ['x','2026-10-12','LUNES',3,'',A,'CS102','ERD','Presente'],['x','2026-10-12','LUNES',3,'',B,'0702','ERD','No asistió'],['x','2026-10-13','MARTES',7,'',A,'CS102','CNA','Presente']];
const nv=[['Marca temporal','Fecha Novedad','Docente','Tipo Novedad','Área/Asignatura','Sesiones','Fuente Novedad'],
 ['x','2026-10-12',A,'Llegada tarde','ERD','S3','Coordinador(a)'],['x','2026-10-12',B,'No asistió','ERD','JC','Coordinador(a)'],['x','2026-10-13',B,'No asistió','ERD','S1','Formulario'],['x','2026-10-13',A,'No asistió','CNA','S7','Coordinador(a)']];
const inc=[['id','fecha','docente','area'],['1','2026-10-12',B,'ERD']];
const sa=[['semana','clave','elegido'],['2026-10-12','ENFASIS|0702|'+B+'|'+O,B],['2026-10-12','CLASE|ETR|X|Y','X']];
const mx=[['día','sesión','franja','6°-1','7°-2'],['LUNES',3,'x','Arizala R. (ERD)','ÉNFASIS: Armero J. (ERD) / Ordóñez J. (CNA)'],['MARTES',7,'x','Arizala R. (CNA)','']];
const dc=[['nombre_completo','apellidos','nombres'],[A,'Arizala Castro','Roberto Carlos'],[B,'Armero Dájome','Jesús']];
const par=[['clave','valor']], dir_=[['nombre','correo_temporal','rol'],['Francisco Cortés','dueno@gmail.com','Coordinador']];
let respuestas=[], alertas=[];
const hojas={Horario:new Hoja(JSON.parse(JSON.stringify(hz))),Registro_Ronda:new Hoja(rr),Novedades:new Hoja(nv),Incumplimientos:new Hoja(inc),Semana_Alternancia:new Hoja(sa),Matriz_Grupos:new Hoja(mx),Docentes:new Hoja(dc),Parametros:new Hoja(par),Directivos:new Hoja(dir_),Bitacora_Cambios:new Hoja([['fecha_hora','quien','accion','detalle']])};
const g={Utilities:{formatDate:d=>d.toISOString().slice(0,10)},Logger:{log(){}},Session:{getActiveUser:()=>({getEmail:()=>'dueno@gmail.com'})},
 SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n]||null,insertSheet:n=>(hojas[n]=new Hoja([[]]))}),
  getUi:()=>({ButtonSet:{YES_NO:1,YES_NO_CANCEL:2},Button:{YES:'Y',NO:'N',CANCEL:'C',CLOSE:'X'},alert(t,m){alertas.push([t,m]);return respuestas.length?respuestas.shift():'Y'}})},console};
vm.createContext(g);
['Codigo.gs','Soportes.gs','Acceso.gs','Horarios.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const run=c=>vm.runInContext(c,g);
const col=(h,k)=>hojas[h].v[0].indexOf(k);

// vista previa: no cambia nada
let p=run(`intercambioDocentes_('${A}','${B}','ERD',false)`);   // la función admite solo-ERD; el menú usa el horario completo
ok(p.horario===4&&p.registro===2&&p.novedades===1&&p.incumplimientos===1&&p.alternancia===1&&p.matriz===2,'vista previa solo-ERD cuenta: '+JSON.stringify(p));
ok(p.jornadaRevisar===1&&p.otrasRevisar===1,'JC y las novedades de formulario solo se cuentan para revisar');
ok(p.choques.length===1,'avisa de los choques (Arizala con dos cosas a la vez): '+p.choques.join(' | '));
ok(hojas.Horario.v[1][1]===A&&hojas.Registro_Ronda.v[1][5]===A,'la vista previa no cambia nada');

// aplicar por el menú (horario completo; Sí = aplicar)
respuestas=['Y'];
run('corregirDocentes1y2EducacionFisica()');
const h=hojas.Horario.v;
ok(h[1][1]===B&&h[1][0]===57&&h[3][1]===A&&h[3][0]===4&&h[5][1]===A,'Horario: ERD pasa de uno al otro, con su número');
ok(h[2][1]===B&&h[2][0]===57&&h[6][1]==='Otro Docente','Horario: también la clase de CNA; los demás docentes no cambian');
ok(h[1][9]==='f','las columnas con fórmulas no se tocan');
const R=hojas.Registro_Ronda.v;
ok(R[1][5]===B&&R[2][5]===A&&R[3][5]===B,'Registro_Ronda: las marcas de los dos cambian de docente');
const N=hojas.Novedades.v;
ok(N[1][2]===B&&N[2][2]===B&&N[3][2]===B&&N[4][2]===B,'Novedades: las de la ronda por sesión cambian (JC y formulario quedan)');
ok(hojas.Incumplimientos.v[1][2]===A,'Incumplimientos cambia');
ok(hojas.Semana_Alternancia.v[1][1]==='ENFASIS|0702|'+A+'|'+O&&hojas.Semana_Alternancia.v[1][2]===A&&hojas.Semana_Alternancia.v[2][1]==='CLASE|ETR|X|Y','Semana_Alternancia: la pareja de énfasis pasa a Arizala y las demás no se tocan');
ok(hojas.Matriz_Grupos.v[1][3]==='Armero J. (ERD)'&&hojas.Matriz_Grupos.v[1][4]==='ÉNFASIS: Arizala R. (ERD) / Ordóñez J. (CNA)'&&hojas.Matriz_Grupos.v[2][3]==='Armero J. (CNA)','Matriz_Grupos: nombres cortos cambiados');
ok(hojas.Parametros.v.some(f=>f[0]==='intercambio_erd_docente1_2'&&/completo/.test(f[1])),'queda la marca de aplicado');
ok(hojas.Bitacora_Cambios.v.length===2&&/Intercambio/.test(hojas.Bitacora_Cambios.v[1][2]),'queda en Bitacora_Cambios');
alertas=[]; respuestas=['Y']; const antes=JSON.stringify(hojas.Horario.v);
run('corregirDocentes1y2EducacionFisica()');
ok(JSON.stringify(hojas.Horario.v)===antes&&/ya se aplic/.test(alertas[0][0]),'segunda vez: no repite');
hojas.Parametros.v.length=1; respuestas=['N']; run('corregirDocentes1y2EducacionFisica()');
ok(JSON.stringify(hojas.Horario.v)===antes&&hojas.Parametros.v.length===1,'«No» en la vista previa no aplica');
console.log(fallos?'HAY FALLAS':'Todo bien'); process.exit(fallos?1:0);
