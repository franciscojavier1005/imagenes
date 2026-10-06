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
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Estudiantes.gs','Sesion.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));

let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const run=(c)=>vm.runInContext(c,g); const falla=(c)=>{try{run(c);return null}catch(e){return String(e.message)}};
// listado FALSO (como lo deja la importación del xlsx: el grupo puede llegar sin el cero inicial)
hojas.Estudiantes=new Hoja([['grupo','curso','no','apellidos','nombres'],
  ['0601','6°-1',1,'PEREZ GOMEZ','ANA MARIA'],['0601','6°-1',2,'ÁLVAREZ RÍOS','JOSÉ LUIS'],['0601','6°-1',3,'ZUÑIGA','CARLOS'],
  [701,'7°-1',1,'ROJAS LOPEZ','LAURA'],[701,'7°-1',2,'SOTO','PEDRO PABLO'],['CS101','CS 1-1',1,'DIAZ','MARTA']]);
let d=run('datosEstudiantes()');
ok(d.estudiantes.length===6&&d.grupos.map(x=>x.codigo).join()==='0601,CS101,0701'&&d.grupos[2].total===2,'grupos con totales; «701» se normaliza a 0701 y CS 1 queda tras los sextos');
ok(d.tipos.length===31&&['REDES_APOYO','SENA_ARTICULACION','SENA_CURSO','SALUD_MENTAL','SALUD','GRUPO_ARTISTICO','SELECCION','CLUB','PROYECTO','NO_LISTADO','OTRA_INSTITUCION','NUEVO','PROMOVIDO','CONVIVENCIA','MATRICULA_COND','SPA','LACTANTE','GESTANTE','EXTRANJERO','DISCAPACIDAD','DESPLAZADO','MADRE_SUSTITUTA','DEPORTISTA','SOBRESALIENTE','COLABORADOR'].every(i=>d.tipos.some(t=>t.id===i))&&d.tipos.every(t=>t.cat&&t.emo&&/^#[0-9a-f]{6}$/i.test(t.color)),'31 tipos de marca en 6 categorías, cada uno con emoji y color');
run("marcarEstudiantes({items:[{g:'CS101',a:'DIAZ',n:'MARTA'}],tipo:'EXTRANJERO',nota:'Venezolana'})");
run("marcarEstudiantes({items:[{g:'CS101',a:'DIAZ',n:'MARTA'}],tipo:'DEPORTISTA',nota:'Voleibol'})");
ok(run('datosEstudiantes()').estudiantes.find(e=>e.a==='DIAZ').m.length===2,'se pueden combinar condiciones y fortalezas en el mismo estudiante');
// proyectos: exigen el nombre
ok(/Escriba el nombre/.test(falla("marcarEstudiantes({items:[{g:'0601',a:'ZUÑIGA',n:'CARLOS'}],tipo:'SENA_ARTICULACION'})")||''),'articulación SENA, redes de apoyo y proyectos piden el nombre del proyecto o programa');
run("marcarEstudiantes({items:[{g:'0601',a:'ZUÑIGA',n:'CARLOS'}],tipo:'SENA_ARTICULACION',nota:'Técnico en sistemas'})");
ok(run('datosEstudiantes()').estudiantes.find(e=>e.a==='ZUÑIGA').m[0].nota==='Técnico en sistemas','el nombre queda en la marca (y se puede buscar por él)');
// grupos, selecciones y clubes: catálogo de nombres
run("agregarGrupoProyecto({tipo:'CLUB',nombre:'Club de robótica'})");
ok(/ya existe/.test(falla("agregarGrupoProyecto({tipo:'CLUB',nombre:'club de ROBÓTICA'})")||'')&&/Escriba el nombre/.test(falla("agregarGrupoProyecto({tipo:'CLUB',nombre:''})")||'')&&/Elija el tipo/.test(falla("agregarGrupoProyecto({tipo:'NO_ASISTE',nombre:'Algo largo'})")||''),'crear nombres de grupos: no repite (ignora mayúsculas y tildes), exige nombre y un tipo que lo admita');
run("marcarEstudiantes({items:[{g:'0601',a:'ZUÑIGA',n:'CARLOS'}],tipo:'CLUB',nota:'club de robotica'})");
run("marcarEstudiantes({items:[{g:'0601',a:'ZUÑIGA',n:'CARLOS'}],tipo:'SELECCION',nota:'Fútbol sala'})");
run("marcarEstudiantes({items:[{g:'0601',a:'ZUÑIGA',n:'CARLOS'}],tipo:'SELECCION',nota:'Natación'})");
let dd=run('datosEstudiantes()'); const zu=dd.estudiantes.find(e=>e.a==='ZUÑIGA');
ok(zu.m.filter(x=>/Club/.test(x.tipo))[0].nota==='Club de robótica'&&zu.m.filter(x=>/Selección/.test(x.tipo)).length===2,'el nombre se escribe siempre igual y un estudiante puede estar en varios equipos o clubes');
ok(dd.catalogo.some(c=>c.nombre==='Fútbol sala')&&dd.catalogo.some(c=>c.nombre==='Natación')&&dd.catalogo.filter(c=>c.nombre==='Club de robótica').length===1,'los nombres usados entran solos al catálogo (sin repetirse)');
// marcar varios a la vez
g.M1={items:[{g:'0601',a:'PEREZ GOMEZ',n:'ANA MARIA'},{g:'0601',a:'ALVAREZ RIOS',n:'JOSE LUIS'}],tipo:'NO_ASISTE',nota:'No viene desde el 15 de septiembre'};
let r=run('marcarEstudiantes(M1)');
ok(r.marcados===2&&r.yaTenian===0,'marca a dos estudiantes a la vez (la búsqueda ignora tildes)');
r=run('marcarEstudiantes(M1)'); ok(r.marcados===0&&r.yaTenian===2,'repetir la misma marca no duplica');
run("marcarEstudiantes({items:[{g:'0601',a:'PEREZ GOMEZ',n:'ANA MARIA'}],tipo:'ORIENTACION',nota:'Remitir por conducta'})");
d=run('datosEstudiantes()'); const ana=d.estudiantes.find(e=>e.a==='PEREZ GOMEZ');
ok(ana.m.length===2&&ana.m.some(x=>/deserción/.test(x.tipo))&&ana.m.some(x=>/orientación/.test(x.tipo))&&ana.m[0].por&&ana.m[0].nota,'un estudiante puede tener varias marcas, con nota y quién la puso');
ok(/Elija el tipo/.test(falla("marcarEstudiantes({items:[{g:'0601',a:'ZUÑIGA',n:'CARLOS'}],tipo:'X'})")||'')&&/al menos un estudiante/.test(falla("marcarEstudiantes({items:[],tipo:'FUGA'})")||'')&&/No se encontr/.test(falla("marcarEstudiantes({items:[{g:'0601',a:'NADIE',n:'NINGUNO'}],tipo:'FUGA'})")||''),'validaciones: tipo, vacío y estudiante inexistente');
// levantar
const mid=ana.m.find(x=>/orientación/.test(x.tipo)).id; run(`levantarMarcaEstudiante({id:'${mid}'})`);
d=run('datosEstudiantes()'); ok(d.estudiantes.find(e=>e.a==='PEREZ GOMEZ').m.length===1&&hojas.Marcas_Estudiantes.v.some(f=>f[10]==='Levantada'&&f[11]),'levantar quita la marca de la vista pero queda en la hoja (quién y cuándo)');
ok(/ya estaba levantada/.test(falla(`levantarMarcaEstudiante({id:'${mid}'})`)||''),'levantar dos veces: aviso');
// nuevo
run("agregarEstudiante({g:'0601',a:'nuevo apellido',n:'nuevo nombre',nota:'Viene de Cali'})");
d=run('datosEstudiantes()'); const nu=d.estudiantes.find(e=>e.a==='NUEVO APELLIDO');
ok(nu&&nu.no===4&&nu.g==='0601'&&nu.m[0].tipo==='Estudiante nuevo (llegó en el año)'&&/Viene de Cali/.test(nu.m[0].nota),'agregar estudiante nuevo: queda al final del grupo con la marca «nuevo»');
ok(/ya está en el grupo/.test(falla("agregarEstudiante({g:'0601',a:'ZUÑIGA',n:'CARLOS'})")||'')&&/Elija un grupo/.test(falla("agregarEstudiante({g:'9999',a:'A',n:'B'})")||''),'no repite estudiantes ni acepta grupos inexistentes');
run("agregarEstudiante({g:'0601',a:'omitido',n:'uno',motivo:'NO_LISTADO'})");
ok(run('datosEstudiantes()').estudiantes.find(e=>e.a==='OMITIDO').m[0].tipo==='Agregado: no aparecía en el listado','agregar a quien no aparecía en el listado queda con su propia marca');
ok(/Escriba el nombre/.test(falla("marcarEstudiantes({items:[{g:'0601',a:'ZUÑIGA',n:'CARLOS'}],tipo:'OTRA_INSTITUCION'})")||''),'matriculado en otra institución pide cuál');
// promovido
run("moverEstudiante({g:'0601',a:'PEREZ GOMEZ',n:'ANA MARIA',destino:'0701',nota:'Promovida en el primer periodo'})");
d=run('datosEstudiantes()'); const pr=d.estudiantes.find(e=>e.a==='PEREZ GOMEZ');
ok(pr.g==='0701'&&pr.no===3&&d.grupos.find(x=>x.codigo==='0701').total===3,'promovido: pasa al grupo de destino, con el siguiente número de lista');
ok(pr.m.some(x=>/deserción/.test(x.tipo))&&pr.m.some(x=>/Promovido/.test(x.tipo)&&/De 6°-1 a 7°-1/.test(x.nota)),'conserva sus marcas vigentes y queda «promovido» con el detalle (de qué grupo a cuál)');
ok(/mismo/.test(falla("moverEstudiante({g:'0701',a:'PEREZ GOMEZ',n:'ANA MARIA',destino:'0701'})")||''),'no se puede mover al mismo grupo');
EMAIL='';
ok(['datosEstudiantes()',"marcarEstudiantes({})","levantarMarcaEstudiante({id:'x'})","agregarEstudiante({})","moverEstudiante({})"].every(x=>falla(x)!==null),'sin sesión nadie ve ni marca estudiantes');
EMAIL='dueno@gmail.com'; delete hojas.Estudiantes; ok(run('datosEstudiantes()').sinDatos===true,'sin la hoja Estudiantes avisa que falta cargar el listado');
console.log(fallos?'\n'+fallos+' FALLA(S)':'\nTodo bien'); process.exitCode=fallos?1:0;
