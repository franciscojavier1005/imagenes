
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const path=require('path'); const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8')); const M=H._alias;
let correos=[], logs=[], EMAIL='dueno@gmail.com';
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`; if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]); return `${Number(o.day)} de ${new Intl.DateTimeFormat('es',{timeZone:tz,month:'long'}).format(d)} de ${o.year}`;};
const g={Utilities:{formatDate:fmt},Logger:{log:m=>logs.push(m)},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>({getRange:(r,c)=>({setValue:v=>{H[n][0][c-1]=v}}),getDataRange:()=>({getValues:()=>JSON.parse(JSON.stringify(H[n]))})})}),getUi:()=>({alert:()=>{}})},
  ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/macros/s/ID/exec'})},MailApp:{sendEmail:o=>correos.push(o)},Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},HtmlService:{},console};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Soportes.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Estudiantes.gs','Sesion.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
const EXP=H.Horario.slice(1).filter(r=>['JUEVES','VIERNES'].includes(r[H.Horario[0].indexOf('dia')])).length;
const r=vm.runInContext("datosDashboard('2026-10-01','2026-10-02')",g);
const ok=(c,m)=>{try{assert.ok(c);console.log('  ok  ',m)}catch(e){console.log('  FALLA',m);process.exitCode=1}};
ok(r.kpis.eventos===3,'lee 3 novedades (fechas dd/mm/aaaa y ISO)');
ok(r.kpis.minutos===270+15+45,'suma de minutos = '+r.kpis.minutos);
ok(r.kpis.ausencias===2&&r.kpis.llegadasTarde===1,'2 ausencias y 1 llegada tarde');
ok(r.porGrupo.some(x=>x.nombre==='5°-4')&&r.porGrupo.some(x=>x.nombre==='6°-2'),'grupos 5°-4 y 6°-2: '+r.porGrupo.map(x=>x.nombre).join(', '));
ok(r.porNivel.some(x=>x.nombre==='PRIMARIA'),'nivel tomado de la hoja Docentes: '+r.porNivel.map(x=>x.nombre).join(', '));
const cat=Object.fromEntries(r.porCategoria.map(x=>[x.nombre,x.minutos]));
ok(cat['CALAMIDAD DOMÉSTICA']===270&&cat['PERMISO INSTITUCIONAL']===45,'categoría desde la hoja Motivos cuando la fila no la trae');
const v1=r.ronda.find(x=>x.sesion===1); ok(v1.marcados===0&&v1.esperados>30,'ronda sesión 1 sin marcas: '+v1.marcados+' de '+v1.esperados+' esperados');
ok(r.kpis.programadas===EXP,'sesiones programadas jue+vie = '+r.kpis.programadas);
const e1=vm.runInContext("enviarInformeDiario_(true)",g);
ok(e1.enviado===false&&e1.motivo==='sin correos'&&correos.length===0,'con el correo temporal NO envía nada');
H.Directivos[4][2]='rector@institucion.edu.co';   // correo real de prueba
const e2=vm.runInContext("enviarInformeDiario_(true)",g);
ok(e2.enviado===true&&correos.length===1&&correos[0].to==='rector@institucion.edu.co','con correo real sí envía (1 correo)');
ok(/ [0-9.]+ h sin atender/.test(correos[0].subject),'asunto: '+correos[0].subject);
ok(correos[0].htmlBody.includes('?p=panel')&&!/<script/i.test(correos[0].htmlBody),'enlace al panel y sin scripts');
fs.writeFileSync(path.join(require('os').tmpdir(),'informe.html'),'<meta charset="utf-8">'+correos[0].htmlBody);

// ---------- roles y acceso ----------
const ctx=(em)=>{EMAIL=em;return vm.runInContext("contextoPanel()",g);};
let c1=ctx('dueno@gmail.com'); ok(c1.rol==='directivo'&&c1.vistaInicial==='coordinacion'&&c1.docentes.length>=50&&!c1.niveles.includes('REEMPLAZADO'),'editor del libro -> directivo, vista coordinación ('+c1.docentes.length+' docentes)');
H.Directivos[4][2]='rector@institucion.edu.co';
let c2=ctx('RECTOR@institucion.edu.co'); ok(c2.rol==='directivo'&&c2.vistaInicial==='rector','rector listado en Directivos (sin ser editor) -> vista rectoría');
const iC=H.Docentes[0].indexOf('correo'), iN=H.Docentes[0].indexOf('nombre_completo');
const fEsc=H.Docentes.findIndex(r=>r[iN]===M.A); H.Docentes[fEsc][iC]='docente.a@correo.com';
let c3=ctx('docente.a@correo.com'); ok(c3.rol==='docente'&&c3.docente===M.A,'docente con correo registrado -> solo su informe');
EMAIL='docente.a@correo.com';
const rd=vm.runInContext("datosDashboard('2026-10-01','2026-10-02',{docente:'"+M.C+"'})",g);   // intenta ver a otra
ok(rd.filtros.docente===M.A&&rd.kpis.minutos===270&&rd.porDocente.length===1,'el docente NO puede ver a otro: se fuerza su propio filtro (minutos '+rd.kpis.minutos+')');
ok(rd.lista.length===1&&rd.lista[0].docente===M.A,'su lista contiene solo sus novedades');
EMAIL='desconocido@gmail.com'; let fallo=false; try{vm.runInContext("datosDashboard('2026-10-01','2026-10-02',{})",g)}catch(e){fallo=/No tiene acceso/.test(e.message)}
ok(c=ctx('desconocido@gmail.com').rol==='sin_registro'&&fallo,'persona desconocida: rol sin_registro y el servidor rechaza la consulta del panel');
EMAIL='';  // disparador sin sesión: el informe diario sigue funcionando
const ei=vm.runInContext("enviarInformeDiario_(true)",g); ok(ei.enviado===true,'el informe diario funciona sin sesión de usuario (disparador)');
const rf=(EMAIL='dueno@gmail.com',vm.runInContext("datosDashboard('2026-10-01','2026-10-02',{nivel:'PRIMARIA'})",g)); ok(rf.kpis.eventos===2&&rf.porNivel.length===1,'filtro por nivel PRIMARIA: 2 novedades');
/* informe de rondas: quién estuvo, quién no y quién tiene novedad */
EMAIL='dueno@gmail.com';
const fil=(s,doc,est,mot,min,dir)=>['2026-10-05','2026-10-05','LUNES',s,'',doc,'6-1','Área',est,mot,'',min,'',dir,''];
H.Registro_Ronda.push(fil(1,'Ana Uno','Presente','','','Verónica'),fil(2,'Ana Uno','Presente','','','Verónica'),fil(1,'Beto Dos','No asistió','Incapacidad','','Verónica'),fil(2,'Beto Dos','No asistió','Incapacidad','','Verónica'),
  fil(1,'Carla Tres','Llegada tarde','Cita médica',20,'Verónica'),fil(2,'Carla Tres','Presente','','','Verónica'),fil(3,'Dani <b>','Presente','','','Harold'));
const ir=vm.runInContext("informeRondas({desde:'2026-10-05',hasta:'2026-10-05'})",g);
ok(ir.bloques.length===2&&ir.directivos.join()==='Harold,Verónica','rondas agrupadas por bloque y directivo: '+ir.bloques.length+' bloques');
const b1=ir.bloques.find(x=>x.bloque===1);
ok(b1.presentes.length===1&&b1.noAsistieron.length===1&&b1.noAsistieron[0].motivo==='Incapacidad'&&b1.tardes.length===1&&b1.total===3,'cada docente una sola vez por bloque, con su situación más seria');
ok(vm.runInContext("informeRondas({desde:'2026-10-05',hasta:'2026-10-05',directivo:'Harold'})",g).bloques.length===1,'filtro por directivo');
const hh=vm.runInContext("htmlRondas_('2026-10-05','2026-10-05','',true)",g);
ok(/Beto Dos/.test(hh)&&/Incapacidad/.test(hh)&&!/<b>\)/.test(hh)&&/Dani &lt;b&gt;/.test(hh)&&!/<script/i.test(hh),'el HTML lista a los ausentes con su motivo y escapa el texto');
correos.length=0; H.Directivos[4][2]='rector@institucion.edu.co';
const er=vm.runInContext("enviarRondasAMi({desde:'2026-10-05',hasta:'2026-10-05',correo:'yo@correo.com'})",g);
ok(er.ok&&correos.length===1&&correos[0].to==='yo@correo.com'&&/Beto Dos/.test(correos[0].htmlBody),'enviarRondasAMi manda el informe al correo indicado');
const ed=vm.runInContext("enviarInformeDiario_(true)",g); ok(ed.enviado,'informe diario sigue funcionando');
/* restricción opcional: ve_todo = NO deja al directivo ver solo sus propias rondas */
const ND=H.Directivos[0].indexOf('nombre'), CT=H.Directivos[0].indexOf('correo_temporal');
H.Directivos[0].push('ve_todo'); H.Directivos.slice(1).forEach(r=>r.push(''));
H.Directivos[1][CT]='verónica@x.com'; H.Directivos[1][H.Directivos[0].length-1]='NO'; const nomV=H.Directivos[1][ND];
H.Registro_Ronda.push(fil(1,'Eva Seis','Presente','','',nomV));
EMAIL='verónica@x.com';
const rv=vm.runInContext("informeRondas({desde:'2026-10-05',hasta:'2026-10-05',directivo:''})",g);
ok(rv.soloPropias&&rv.bloques.every(b=>b.directivo===nomV)&&rv.bloques.length===1,'ve_todo=NO: solo ve sus propias rondas aunque pida todas');
EMAIL='dueno@gmail.com';
ok(vm.runInContext("informeRondas({desde:'2026-10-05',hasta:'2026-10-05'})",g).bloques.length>=2,'sin la marca NO, quien administra ve todas');
/* rondas: el titular ausente con otra persona a cargo va en su propia lista */
H.Registro_Ronda.push(['2026-10-06','2026-10-06','MARTES',1,'','Fran Siete','6-1','Área','No asistió','Incapacidad Médica','',45,'','Verónica','Persona de apoyo contratada (alcaldía u otra entidad)'],
  ['2026-10-06','2026-10-06','MARTES',1,'','Gina Ocho','6-2','Área','No asistió','Sin justificación','',45,'','Verónica','']);
const rr2=vm.runInContext("informeRondas({desde:'2026-10-06',hasta:'2026-10-06'})",g).bloques[0];
ok(rr2.conReemplazo.length===1&&rr2.conReemplazo[0].docente==='Fran Siete'&&rr2.noAsistieron.length===1&&rr2.noAsistieron[0].docente==='Gina Ocho','informe de rondas: «con reemplazo» separado de «no asistieron»');
ok(/Con reemplazo/.test(vm.runInContext("htmlRondas_('2026-10-06','2026-10-06','',true)",g)),'el informe por correo incluye «Con reemplazo»');
