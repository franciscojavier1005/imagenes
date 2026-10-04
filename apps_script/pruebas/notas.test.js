// Analizador de observaciones (Notas.gs): (1) coincide con el importador de Python, (2) grupo, sesión y deducción por horario.
const fs=require('fs'), vm=require('vm'), path=require('path');
const g={}; vm.createContext(g);
['Patrones.gs','Notas.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g));
vm.runInContext('this.prep=ntPreparaDocentes_; this.men=ntMenciones_; this.cla=ntClasificar_; this.gru=ntGrupo_; this.ses=ntSesion_; this.ana=analizarNota_;',g);
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const V=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','ejemplos','vectores_notas.json'),'utf8'));
const prep=g.prep(V.roster); let difs=[];
V.casos.forEach(c=>{
  const k=g.cla(c.frase), m=g.men(c.frase,prep).map(x=>[x.score,x.nombre]).sort((a,b)=>b[0]-a[0]||(a[1]<b[1]?-1:1));
  if(k.tipo!==c.tipo||k.motivo!==c.motivo||k.categoria!==c.categoria||JSON.stringify(m)!==JSON.stringify(c.menciones)) difs.push({frase:c.frase,js:{k,m},py:{tipo:c.tipo,motivo:c.motivo,m:c.menciones}});
});
ok(difs.length===0,`Python y JavaScript coinciden en las ${V.casos.length} frases (tipo, motivo, categoría y docentes mencionados)`);
difs.slice(0,4).forEach(d=>console.log('     difiere:',JSON.stringify(d)));

// ---- grupo y sesión
const validos=['0601','0701','0801','1002','CS102','1101'];
const gr=(t)=>g.gru(t,validos);
ok(gr('El grupo 7-1 estaba solo')==='0701'&&gr('séptimo uno sin profesor')==='0701'&&gr('Séptimo 1')==='0701','grupo: "7-1", "séptimo uno", "Séptimo 1" -> 0701');
ok(gr('en el 10°2 no había clase')==='1002'&&gr('décimo dos')==='1002'&&gr('once uno')==='1101'&&gr('curso 8 1')==='0801','grupo: "10°2", "décimo dos", "once uno", "curso 8 1"');
ok(gr('El grupo 8 uno estaba solo')==='0801'&&gr('curso 9 dos')==='','dictado por voz: "grupo 8 uno" -> 0801');
ok(gr('Caminar en secundaria 1-2')==='CS102'&&gr('CS 1 2')==='CS102','grupo Caminar: "CS 1-2"');
ok(gr('a las 9 1 estudiantes')===''&&gr('el 9-1 no existe')==='','no confunde horas ni acepta grupos que no existen');
const F=[1,2,3,4,5,6,7,8].map((h,i)=>({hora:h,inicio_min:[390,435,500,545,610,655,720,765][i],fin_min:[435,480,545,590,655,700,765,810][i]}));
const se=(t)=>g.ses(t,F);
ok(se('en la tercera hora')===3&&se('la 5a hora')===5&&se('sesión 7')===7&&se('bloque 2')===3&&se('bloque cuatro')===7,'sesión: "tercera hora", "5a hora", "sesión 7", "bloque 2" (=3), "bloque cuatro" (=7)');
ok(se('llegó a las 8:30')===3&&se('a las 6:45')===1&&se('a las 12:10')===7&&se('a las 1:00')===8,'sesión por la hora: 8:30 -> 3, 6:45 -> 1, 12:10 -> 7, 1:00 pm -> 8');
ok(se('sin hora')==='','sin dato de sesión: vacío');

// ---- análisis completo con horario (viernes 2026-10-02)
const roster=V.roster;
const horario=[{docente:'Rojas Mendoza Clara Inés',dia:'VIERNES',hora:3,tipo:'CLASE',grupo:'0701',grupos_enfasis:''},
  {docente:'Vega Torres Luis Fernando',dia:'VIERNES',hora:5,tipo:'ENFASIS',grupo:'',grupos_enfasis:'0801'},{docente:'Mosquera Cuero Yadira',dia:'VIERNES',hora:5,tipo:'ENFASIS',grupo:'',grupos_enfasis:'0801'}];
const A=(texto,extra)=>g.ana(Object.assign({texto,fecha:'2026-10-02',docentes:roster,grupos:validos.map(x=>({grupo:x})),franjas:F,horario},extra||{}));
let r=A('La profe Clara Rojas no estaba en el aula en la tercera hora.').propuestas;
ok(r.length===1&&r[0].docente==='Rojas Mendoza Clara Inés'&&r[0].tipo_novedad==='No asistió'&&r[0].motivo==='Sin justificación'&&r[0].justificada==='No'&&r[0].sesion===3&&r[0].confianza==='media','docente nombrado sin motivo: No asistió, "Sin justificación", sesión 3, confianza media');
r=A('El grupo séptimo uno estaba sin profesor en la tercera hora').propuestas;
ok(r.length===1&&r[0].docente==='Rojas Mendoza Clara Inés'&&r[0].resuelto_por==='horario'&&r[0].grupo==='0701'&&r[0].confianza==='media','solo se nombra el grupo: deduce al docente por el horario (viernes, sesión 3, 7°-1)');
r=A('El grupo 8-1 estaba solo en la quinta hora').propuestas;
ok(r.length===2&&r.every(x=>x.confianza==='baja'&&x.resuelto_por==='horario')&&r.map(x=>x.docente).sort().join()==='Mosquera Cuero Yadira,Vega Torres Luis Fernando','énfasis con dos docentes: propone a ambos con confianza baja');
r=A('Luis Vega llegó tarde a las 8:30 por una cita médica').propuestas;
ok(r.length===1&&r[0].tipo_novedad==='Llegada tarde informada'&&r[0].motivo==='Exámenes clínicos'&&r[0].sesion===3&&r[0].justificada==='Sí','llegada tarde con motivo y hora: sesión 3, justificada');
r=A('La profe de matemáticas no vino.').propuestas; ok(r.length===1&&r[0].docente===''&&r[0].confianza==='sin docente','sin docente identificable: queda para completar');
let multi=A('Todo bien en general. Yadira Mosquera salió antes por incapacidad. Recuerden la reunión del viernes. Zoila Obando no estaba.');
ok(multi.propuestas.length===2&&multi.ignoradas===2,'varias oraciones: 2 propuestas y 2 ignoradas');
ok(A('El grupo 7-1 estaba solo en la tercera hora',{fecha:'2026-10-03'}).propuestas[0].docente==='','sábado: no hay horario, no inventa docente');
ok(A('Díaz no asistió').propuestas.length===2&&A('Díaz no asistió').propuestas.every(x=>x.confianza==='baja'),'apellido repetido: ofrece a las dos personas con confianza baja');
ok(A('',{}).propuestas.length===0&&A('...  ').propuestas.length===0,'texto vacío: sin propuestas');
process.exit(fallos?1:0);
