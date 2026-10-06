// Calcula con el código real (Horarios.gs) las respuestas que usa la vista previa de Horarios. Uso: node exportar_horarios_demo.js salida.json
// Sistema de control de asistencia docente - I.E. ICET. Autor: Francisco Javier Cortés Cabezas.
const fs=require('fs'),vm=require('vm'),path=require('path');
const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8'));
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`;if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]);
  const h=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d);if(p==='HH:mm')return h;if(p==='yyyy-MM-dd HH:mm')return `${o.year}-${o.month}-${o.day} ${h}`;return String(d);};
const hoja=n=>H[n]?{getDataRange:()=>({getValues:()=>JSON.parse(JSON.stringify(H[n]))}),appendRow(){},getRange:()=>({setValue(){}})}:null;
const g={Utilities:{formatDate:fmt,getUuid:()=>'x'},Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getActiveUser:()=>({getEmail:()=>'dueno@gmail.com'})},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:hoja,insertSheet:n=>({appendRow(){},getRange:()=>({setValue(){},setValues(){}}),getDataRange:()=>({getValues:()=>[[]]}),setFrozenRows(){},getName:()=>n})}),getUi:()=>({})},console};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Soportes.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Estudiantes.gs','Sesion.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
const run=c=>vm.runInContext(c,g), q=o=>run('consultaHorarios('+JSON.stringify(o)+')');
const cat=q({modo:'catalogo'}), out={catalogo:cat,directores:q({modo:'directores'}),docente:{},grupo:{},ahora:{}};
cat.docentes.forEach(d=>{out.docente[d.nombre]=q({modo:'docente',docente:d.nombre});});
cat.grupos.forEach(x=>{out.grupo[x.codigo]=q({modo:'grupo',grupo:x.codigo});});
['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES'].forEach(d=>[1,2,3,4,5,6,7,8].forEach(s=>{try{out.ahora[d+'|'+s]=q({modo:'ahora',dia:d,sesion:s});}catch(e){}}));
fs.writeFileSync(process.argv[2],JSON.stringify(out));
console.log('docentes',cat.docentes.length,'grupos',cat.grupos.length,'ahora',Object.keys(out.ahora).length);
