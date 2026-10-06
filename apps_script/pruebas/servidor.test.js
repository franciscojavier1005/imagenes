
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const path=require('path'); const H=JSON.parse(fs.readFileSync(path.join(__dirname,'hojas.json'),'utf8')); const M=H._alias;
let correos=[], logs=[], EMAIL='dueno@gmail.com';
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`; if(p==='u')return String({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[o.weekday]); return `${Number(o.day)} de ${new Intl.DateTimeFormat('es',{timeZone:tz,month:'long'}).format(d)} de ${o.year}`;};
const g={Utilities:{formatDate:fmt},Logger:{log:m=>logs.push(m)},
  SpreadsheetApp:{getActive:()=>({getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>({getDataRange:()=>({getValues:()=>JSON.parse(JSON.stringify(H[n]))})})}),getUi:()=>({alert:()=>{}})},
  ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/macros/s/ID/exec'})},MailApp:{sendEmail:o=>correos.push(o)},Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},HtmlService:{},console};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Soportes.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
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
ok(e1.enviado===false&&e1.motivo==='correo temporal'&&correos.length===0,'con el correo temporal NO envía nada');
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
