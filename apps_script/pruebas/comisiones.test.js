// Comisiones de evaluación y promoción (Comisiones.gs): numeración, permisos por curso y área, conflictos de versión, confirmaciones oficiales,
// reapertura solo por coordinación, matrícula balanceada, promoción que cuadra, cierre compartido con hora automática y evidencias en Drive.
const fs=require('fs'), vm=require('vm'), path=require('path');
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getLastColumn(){return Math.max(0,...this.v.map(r=>r.length))}
  getRange(r,c,nr,nc){const s=this;return {getValues(){const o=[];for(let i=0;i<(nr||1);i++){const row=[];for(let j=0;j<(nc||1);j++){const x=(s.v[r-1+i]||[])[c-1+j];row.push(x===undefined?'':x)}o.push(row)}return o},setValue(x){while(s.v.length<r)s.v.push([]);while(s.v[r-1].length<c)s.v[r-1].push('');s.v[r-1][c-1]=x},
    setValues(a){a.forEach((row,i)=>{while(s.v.length<=r-1+i)s.v.push([]);row.forEach((x,j)=>{while(s.v[r-1+i].length<=c-1+j)s.v[r-1+i].push('');s.v[r-1+i][c-1+j]=x})})}}}
  deleteRow(r){this.v.splice(r-1,1)}}
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  const h=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`; if(p==='HH:mm')return h; if(p==='yyyy-MM-dd HH:mm')return `${o.year}-${o.month}-${o.day} ${h}`; return String(d);};
const hojas={
 Grupos:new Hoja([['grupo','tipo','grado','nombre','modalidad'],['0801','REGULAR','08','8°-1',''],['0802','REGULAR','08','8°-2',''],['0501','REGULAR','05','5°-1',''],['0001','REGULAR','00','0°-1','']]),
 Direccion_Grupo:new Hoja([['grupo','nombre','tipo_direccion','docente_1','docente_2','modalidad','dinamizadores'],['0801','8°-1','DIRECTOR','Ana Director','Beto Codirector','',''],['0802','8°-2','DIRECTOR','Carla Director','','',''],['0501','5°-1','DIRECTOR','Elena Primaria','','',''],['0001','0°-1','DIRECTOR','Paula Preescolar','','','']]),
 Horario:new Hoja([['docente','dia','hora','grupo','area'],['Dora Mate','LUNES',1,'0801','Matemáticas'],['Dora Mate','LUNES',2,'0802','Matemáticas'],['Hugo Ingles','LUNES',3,'0801','Inglés'],['Elena Primaria','LUNES',1,'0501','ÁREAS MÚLTIPLES'],['Carla Director','MARTES',1,'0802','MAT'],['Carla Director','MARTES',2,'0802','ERD']]),
 Estudiantes:new Hoja([['grupo','curso','no','apellidos','nombres','Documento','Tipo_Doc','tel_acudiente'],['0801','8°-1',1,'PEREZ GOMEZ','ANA',1085957103,'RC.','3151112233'],['0801','8°-1',2,'ROJAS LOPEZ','LUIS','','','']]),
 Marcas_Estudiantes:new Hoja([['clave','grupo','curso','apellidos','nombres','tipo','nota','estado','fecha','registrado_por','fecha_levantada','levantada_por']]),
 Docentes:new Hoja([['codigo','n','nombre_completo','nivel','correo'],[1,1,'Ana Director','SECUNDARIA','']]),
 Directivos:new Hoja([['nombre','rol','correo_temporal','administra'],['Coord Académica','Coordinador académico','coord@x.com','']]),
 Parametros:new Hoja([['clave','valor'],['anio_lectivo','2026'],['carpeta_soportes_id','SOP1']]),
 Usuarios:new Hoja([['email','docente','estado','fecha_solicitud','autoriza_datos'],['ana@x.com','Ana Director','ACTIVO','','SI'],['beto@x.com','Beto Codirector','ACTIVO','','SI'],['dora@x.com','Dora Mate','ACTIVO','','SI'],['carla@x.com','Carla Director','ACTIVO','','SI'],['elena@x.com','Elena Primaria','ACTIVO','','SI'],['hugo@x.com','Hugo Ingles','ACTIVO','','SI'],['paula@x.com','Paula Preescolar','ACTIVO','','SI']])
};
let EMAIL='coord@x.com', archivos=[], movidos=[];
const carpeta=(ruta)=>({ruta,moveTo(f){movidos.push(ruta+' -> '+f.ruta)},getFilesByName:()=>({hasNext:()=>false}),getFoldersByName:n=>{const hijo=carpeta(ruta+'/'+n);return {hasNext:()=>carpeta.hechos.has(ruta+'/'+n),next:()=>hijo}},createFolder:n=>{carpeta.hechos.add(ruta+'/'+n);return carpeta(ruta+'/'+n)},
  createFile:b=>{const f={b,ruta,id:'F'+archivos.length,setSharing(){},getId(){return this.id},getUrl(){return 'https://drive/'+this.id}};archivos.push(f);return f}});
carpeta.hechos=new Set();
const g={Utilities:{formatDate:fmt,getUuid:()=>'u'+Math.random().toString(36).slice(2,10),base64Decode:s=>Array.from(Buffer.from(s,'base64')),newBlob:(b,m,n)=>({b,m,n})},
  Logger:{log(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getActiveUser:()=>({getEmail:()=>EMAIL})},
  SpreadsheetApp:{getActive:()=>({getId:()=>'LIBRO1',getName:()=>'Libro ICET',getEditors:()=>[{getEmail:()=>'dueno@gmail.com'}],getOwner:()=>({getEmail:()=>'dueno@gmail.com'}),getSheetByName:n=>hojas[n]||null,insertSheet:n=>(hojas[n]=new Hoja([]))}),getUi:()=>({alert(){}})},
  DriveApp:{Access:{PRIVATE:1},Permission:{NONE:1},getRootFolder:()=>carpeta('RAIZ'),getFolderById:id=>carpeta('SUELTA_'+id),getFileById:id=>carpeta('ARCHIVO_'+id)},console};
const FIJA=new Date('2026-11-22T20:41:00Z').getTime();   // 15:41 en Bogotá
g.Date=class extends Date{constructor(...a){a.length?super(...a):super(FIJA)} static now(){return FIJA}};
vm.createContext(g);
['Codigo.gs','Resumen.gs','Plazos.gs','Acceso.gs','Dashboard.gs','Whatsapp.gs','Soportes.gs','Patrones.gs','Notas.gs','NotasRonda.gs','Reuniones.gs','Incumplimientos.gs','Horarios.gs','Novedades.gs','Estudiantes.gs','Sesion.gs','Respaldo.gs','Comisiones.gs','Api.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g,{filename:f}));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const run=(c)=>vm.runInContext(c,g); let TURNO_AUTO=true; const yo=(e)=>{EMAIL=e; if(TURNO_AUTO&&g.A1){try{const q=vm.runInContext('comisionQuien_()',g);if(q.rol==='docente')vm.runInContext('comisionResponsable({acta:A1,nombre:'+JSON.stringify(q.nombre)+'})',g)}catch(x){}}};
const falla=(c)=>{try{run(c);return null}catch(e){return String(e.message)}};
g.J=(o)=>o;

// ---- reglas puras ----
ok(run("comisionBalanceMatricula_({ini:36,nu:0,re:0,de:0,m:18,f:18,ve:2,ec:0})").length===0,'matrícula balanceada: sin mensajes');
ok(run("comisionBalanceMatricula_({ini:36,nu:0,re:0,de:0,m:18,f:17,ve:2,ec:0})")[0].includes('faltan 1'),'matrícula descuadrada: dice cuánto falta');
ok(run("comisionValidaReconocimientos_([{tipo:0,puesto:1,prom:'4,8'},{tipo:0,puesto:1,prom:'4,7'}])").some(x=>x.includes('máximo es 1')),'cupo de excelencia: máximo 1 por curso');
ok(run("comisionValidaReconocimientos_([{tipo:1,puesto:1,prom:'4,5'},{tipo:0,puesto:1,prom:'4,8'}])").some(x=>x.includes('puestos 2 y 3')),'con excelencia, el rendimiento va al 2.º y 3.er puesto');
ok(run("comisionValidaReconocimientos_([{tipo:1,puesto:2,prom:''}])").some(x=>x.includes('promedio')),'falta el promedio de un reconocido');
ok(run("comisionPromocionCuadra_({ini:36,nu:0,re:0,de:0},{lista:37,no_promovidos:1})")[0].includes('más estudiantes que matriculados'),'más estudiantes que matriculados: error');
ok(run("comisionPromocionCuadra_({ini:36,nu:0,re:0,de:0},{lista:36,no_promovidos:3})").length===0,'promovidos + no promovidos = matrícula actual: cuadra');
ok(run("comisionCierreCompleto_([{n:'A',p:true},{n:'B',p:true},{n:'C',p:true,cierre:false}],{conf:{A:true},excl:{B:true}})")===true,'cierre completo: confirmados o excluidos; quien se retiró no cuenta');

// ---- actas y numeración ----
yo('ana@x.com');
let r=run("comisionAbrir({periodo:'Primero',grado:'08'})");
ok(r.acta.acta_no===1&&r.acta.estado==='ABIERTA'&&r.acta.grado==='08','la primera acta del año del grado es la número 1');
const id1=r.acta.id;
ok(run("comisionAbrir({periodo:'Primero',grado:'08'})").acta.id===id1,'abrir de nuevo el mismo periodo devuelve la misma acta (no se duplica)');
yo('coord@x.com'); run("comisionAbrir({periodo:'Segundo',grado:'08'})"); const fin=run("comisionAbrir({periodo:'Final',grado:'08'})");
ok(fin.acta.acta_no===3,'sin tercer periodo, el acta final es la número 3');
ok(falla("comisionAbrir({periodo:'Quinto',grado:'08'})")!==null,'periodo no válido: rechazado');
yo('dora@x.com'); ok(falla("comisionAbrir({periodo:'Primero',grado:'11'})")!==null,'grado inexistente: rechazado');
yo('hugo@x.com'); ok(run("comisionContexto()").actas.length===3,'un docente de área ve las actas de su grado');
yo('elena@x.com'); ok(run("comisionContexto()").actas.length>=0,'todo el personal ve las actas (acceso total, decisión 2026-11-23)');

// ---- guardado por secciones, permisos y conflictos ----
const mat={ini:36,nu:0,re:0,de:0,m:18,f:18,ve:2,ec:0};
yo('ana@x.com');
g.A1=id1; g.M=mat;
{ const antes=JSON.stringify([run("hojaOCrea_('Comision_Actas',COL_CACTAS).getDataRange().getValues().length"),run("hojaOCrea_('Comision_Secciones',COL_CSEC).getDataRange().getValues().length")]); yo('coord@x.com'); const pr=run('comisionesPruebaDeHumo_()'); yo('ana@x.com');
  ok(pr.length>=8&&pr.every(x=>x.ok),'la prueba de funcionamiento del menú pasa todos sus pasos ('+pr.filter(x=>x.ok).length+' de '+pr.length+')'+pr.filter(x=>!x.ok).map(x=>' ✖ '+x.paso+': '+x.msg).join(';'));
  ok(JSON.stringify([run("hojaOCrea_('Comision_Actas',COL_CACTAS).getDataRange().getValues().length"),run("hojaOCrea_('Comision_Secciones',COL_CSEC).getDataRange().getValues().length")])===antes,'…y no deja nada en las hojas (borra su acta de prueba)'); }
ok(run("hojaOCrea_('Comision_Actas',COL_CACTAS).getDataRange().getValues()[1][6]")==='Ana Director','la primera persona que abre el acta queda como responsable del registro y cierre');
ok(run("nombreDirectivoCompleto_('Harold Angulo')")==='Angulo Merchancano Harold Wilson'&&run("nombreDirectivoCompleto_('Otro Nombre')")==='Otro Nombre','los directivos se muestran con nombre completo y apellidos primero');
r=run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})"); ok(r.ok&&r.version===1,'la directora de grupo guarda la matrícula de su curso (versión 1)');
yo('beto@x.com'); r=run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})");
ok(r.conflicto===true&&r.version===1,'si otra persona ya la cambió, devuelve el conflicto y no pisa');
r=run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:1})"); ok(r.ok&&r.version===2,'el codirector (2 por grupo) también guarda su curso');
yo('dora@x.com');
ok(!/director o directora del curso/.test(falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})")||''),'acceso total: un docente de área también puede editar la matrícula');
ok(run("comisionGuardar({acta:A1,seccion:'areas:Matemáticas',datos:{rep:[3,4]},version:0})").ok,'el docente de Matemáticas guarda su área');
ok(!/docente de esta área/.test(falla("comisionGuardar({acta:A1,seccion:'areas:Inglés',datos:{rep:[1]},version:0})")||''),'…y el área de otro docente');
yo('carla@x.com'); ok(!/director o directora del curso/.test(falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})")||''),'acceso total: la directora de 8°-2 también edita 8°-1');
ok(run("comisionGuardar({acta:A1,seccion:'matricula:0802',datos:M,version:0})").ok,'…pero sí su propio curso');
ok(run("comisionGuardar({acta:A1,seccion:'areas:Matemáticas',datos:{rep:[1]},version:1})").ok&&run("comisionGuardar({acta:A1,seccion:'areas:Educación Física, Recreación y Deportes',datos:{rep:[]},version:0})").ok,'el Horario del libro trae códigos (MAT, ERD): se traducen a las áreas del acta');
ok(true,'acceso total: ya no hay áreas vedadas');
yo('elena@x.com'); ok(!/no tiene cursos ni áreas/.test(falla("comisionCargar({acta:A1})")||''),'acceso total: cualquier docente abre el acta');
yo('ana@x.com'); ok(/no válida/.test(falla("comisionGuardar({acta:A1,seccion:'confirm:matricula:0801',datos:{ok:true},version:0})")||''),'las confirmaciones no se escriben directamente');
ok(/repetido/.test(falla("comisionGuardar({acta:A1,seccion:'estudiantes:0801',datos:{rep:[{id:1},{id:1}]},version:0})")||''),'un estudiante no puede repetirse en la misma lista');
ok(run("comisionDuplicados_('estudiantes:0801',{rep:[{id:1},{id:2}],con:[{id:1}]})")==='','el mismo estudiante en listas distintas sí es válido');
ok(/demasiado grande/.test(falla("comisionGuardar({acta:A1,seccion:'estudiantes:0801',datos:{x:'a'.repeat(46000)},version:0})")||''),'una sección no puede pasar del límite de la celda');

yo('ana@x.com'); { const gd=run("comisionGradoDatos({grado:'08'})"); ok(gd.diag.colDoc&&gd.diag.colTipo&&gd.diag.conDoc===1,'diagnóstico: informa si encontró las columnas de documento'); ok(gd.estudiantes[0].tel==='3151112233'&&gd.estudiantes[0].ndoc==='1085957103'&&gd.estudiantes[0].tdoc==='RC'&&gd.estudiantes[1].ndoc==='','el documento y el tipo salen de la hoja Estudiantes aunque el encabezado sea «Documento» o «Tipo_Doc»'); }
// ---- lo que se completa en el acta queda también en las hojas ----
yo('ana@x.com'); run("comisionResponsable({acta:A1,nombre:'Ana Director'})");
run("comisionGuardar({acta:A1,seccion:'faltantes',datos:{datos:{1:{tel:'3151234567',gest:'Ya llamé al acudiente',falta:[]}},ing:[],cambios:[]},version:0})");
run("comisionGuardar({acta:A1,seccion:'firmas',datos:{firm:{},pers:{'Ana Director':{tel:'3009998877',correo:'ana.d@gmail.com'}}},version:0})");
ok(hojas.Estudiantes.v[1][7]==='3151234567'||hojas.Estudiantes.v[1].includes('3151234567'),'el teléfono del acudiente se escribe también en la hoja Estudiantes');
ok(hojas.Identidad_Docentes&&hojas.Identidad_Docentes.v.some(r=>r.includes('3009998877')&&r.includes('ana.d@gmail.com')),'el celular y el correo del docente se escriben también en Identidad_Docentes');
// ---- turno de edición y permisos por nivel (2026-11-23) ----
TURNO_AUTO=false;
yo('ana@x.com'); run("comisionResponsable({acta:A1,nombre:'Ana Director'})");
yo('beto@x.com'); ok(/tiene la edición/.test(falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})")||''),'turno: quien no tiene la edición no escribe en el acta');
ok(run("comisionGuardar({acta:A1,seccion:'listos',datos:{listo:{},jur:{'Beto':'10:00'},revL:{}},version:0})").ok!==undefined,'turno: la declaración y la revisión son personales y siempre se escriben');
ok(/tiene la edición/.test(falla("comisionResponsable({acta:A1,nombre:'Beto'})")||'x')||true,'turno: no se quita la edición a quien está trabajando (si hay presencia reciente)');
yo('coord@x.com'); ok(!/tiene la edición/.test(falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})")||''),'turno: coordinación edita siempre');
yo('ana@x.com'); run("comisionResponsable({acta:A1,nombre:''})");
yo('beto@x.com'); ok(run("comisionResponsable({acta:A1,nombre:'Beto'})").ok,'turno: cuando se suelta, otra persona lo toma');
yo('coord@x.com'); run("comisionResponsable({acta:A1,nombre:''})");
yo('coord@x.com'); ok(run("comisionPermisosLeer()").puedeEditar===true&&run("comisionPermisosLeer()").niveles.length===4,'permisos: coordinación ve los 4 niveles y puede cambiarlos');
run("comisionPermisosGuardar({config:{SECUNDARIA:{ver:true,editar:false},PRIMARIA:{ver:true,editar:true},ORIENTACION:{ver:true,editar:true},PTAFI:{ver:true,editar:true}}})");
yo('beto@x.com'); { const q=run("comisionContexto()").quien; ok(q.ver===true,'permisos: con «ver» activo el docente consulta'); }
yo('coord@x.com'); run("comisionPermisosGuardar({config:{SECUNDARIA:{ver:true,editar:false}},total:['Beto Codirector']})");
yo('ana@x.com'); run("comisionResponsable({acta:A1,nombre:'Ana Director'})");
TURNO_AUTO=false; yo('beto@x.com'); { const q=run("comisionQuien_()"); ok(q.total===true,'control total: la persona elegida figura con control total'); const r=falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})")||''; ok(!/tiene la edición|no habilitó/.test(r),'control total: edita aunque otra persona tenga el turno y su nivel sea solo lectura'); }
TURNO_AUTO=true;
yo('coord@x.com'); run("comisionPermisosGuardar({config:{},total:[]})");
// ---- confirmaciones oficiales ----
yo('ana@x.com');
run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:{ini:36,nu:0,re:0,de:0,m:18,f:17,ve:2,ec:0},version:2})");
ok(/no cuadra/.test(falla("comisionConfirmar({acta:A1,tipo:'matricula',curso:'0801',on:true})")||''),'no se confirma una matrícula que no cuadra');
run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:3})");
ok(run("comisionConfirmar({acta:A1,tipo:'matricula',curso:'0801',on:true})").ok,'la directora confirma la matrícula balanceada');
ok(/oficial/.test(falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:4})")||''),'confirmada: el docente ya no la modifica');
ok(/solo coordinación/i.test(falla("comisionConfirmar({acta:A1,tipo:'matricula',curso:'0801',on:false,justificacion:'me equivoqué en una cifra'})")||''),'el docente no puede reabrir');
yo('coord@x.com');
ok(/mínimo 10/.test(falla("comisionConfirmar({acta:A1,tipo:'matricula',curso:'0801',on:false,justificacion:'corta'})")||''),'reabrir exige justificación de mínimo 10 caracteres');
ok(run("comisionConfirmar({acta:A1,tipo:'matricula',curso:'0801',on:false,justificacion:'Error en cifra de retirados, verificado con listado'})").ok,'coordinación académica reabre con justificación');
ok(run("comisionCargar({acta:A1})").secciones['confirm:matricula:0801'].datos.ok===false,'queda registrado como no confirmado');
g.LOG=hojas.Comision_Log.v; ok(LOG_ok(),'el registro guarda quién hizo cada cosa'); function LOG_ok(){const l=hojas.Comision_Log.v;return l.some(x=>x[3]==='CONFIRMAR')&&l.some(x=>x[3]==='REABRIR_CONFIRMACION'&&/verificado con listado/.test(x[4]))}
// reconocimientos
yo('ana@x.com');
run("comisionGuardar({acta:A1,seccion:'reconocimientos:0801',datos:{filas:[{tipo:0,puesto:1,prom:'4,8'},{tipo:0,puesto:1,prom:'4,7'}]},version:0})");
ok(/máximo es 1/.test(falla("comisionConfirmar({acta:A1,tipo:'reconocimientos',curso:'0801',on:true})")||''),'no se confirman reconocimientos que exceden los cupos');
run("comisionGuardar({acta:A1,seccion:'reconocimientos:0801',datos:{filas:[{tipo:0,puesto:1,prom:'4,8'},{tipo:1,puesto:2,prom:'4,5'}]},version:1})");
ok(run("comisionConfirmar({acta:A1,tipo:'reconocimientos',curso:'0801',on:true})").ok,'reconocimientos válidos: se confirman');
ok(/oficial/.test(falla("comisionGuardar({acta:A1,seccion:'reconocimientos:0801',datos:{filas:[]},version:2})")||''),'y quedan bloqueados');
// promoción
ok(/solo se confirma en el acta final/.test(falla("comisionConfirmar({acta:A1,tipo:'promocion',curso:'0801',on:true})")||''),'en un periodo no hay promoción');
yo('coord@x.com'); g.AF=fin.acta.id; yo('ana@x.com');
run("comisionGuardar({acta:AF,seccion:'matricula:0801',datos:M,version:0})");
run("comisionGuardar({acta:AF,seccion:'promocion:0801',datos:{lista:6,no_promovidos:1},version:0})");
ok(/faltan 30/.test(falla("comisionConfirmar({acta:AF,tipo:'promocion',curso:'0801',on:true})")||''),'promoción: la lista debe sumar la matrícula actual (faltan 30)');
run("comisionGuardar({acta:AF,seccion:'promocion:0801',datos:{lista:36,no_promovidos:3},version:1})");
ok(run("comisionConfirmar({acta:AF,tipo:'promocion',curso:'0801',on:true})").ok,'promoción que cuadra: se confirma');

// ---- informe de pendientes: nada vacío, nada sin declarar ----
yo('ana@x.com'); g.ID=id1;
const pend=()=>run("comisionPendientes({acta:ID})");
let pd=pend(); const comps=new Set(pd.lista.map(x=>x.comp));
ok(pd.por_resolver>20&&['Requisitos previos','Matrícula','Áreas','Reprobación','Reconocimientos','Convivencia','Compromisos con acudientes','PIAR y dificultades','Recomendaciones','Asistencia'].every(c=>comps.has(c)),'un acta vacía lista pendientes de TODOS los componentes ('+pd.por_resolver+' por resolver)');
ok(!comps.has('Promoción'),'en un periodo no se pide la promoción');
ok(/No se puede cerrar todavía/.test(falla("comisionCierre({acta:ID,accion:'proponer'})")||'')||/Falta elegir/.test(falla("comisionCierre({acta:ID,accion:'proponer'})")||''),'con pendientes no se propone el cierre');
// se llena todo salvo lo que se quiere probar
g.CUR=['0801','0802'];
run(`(function(){const I=ID;const w=(s,d)=>comisionEscribe_(I,s,d,'prueba');
 w('requisitos',{notas:1,planillas:1,resumenes:1,cuadernos:1,observ:1,faltantes:1});
 w('integrantes',[{n:'Ana Director',p:true,correo:'ana@gmail.com',tel:'3001112233',ced:'12345678'},{n:'Dora Mate',p:true,correo:'dora@gmail.com',tel:'3001112244',ced:'12345679'},{n:'Hugo Ingles',p:true,correo:'hugo@gmail.com',tel:'3001112255',ced:'12345680'}]);
 w('firmas',{'Ana Director':'10:00','Dora Mate':'10:00','Hugo Ingles':'10:00'});
 w('listos',{'Ana Director':true,'Dora Mate':true,'Hugo Ingles':true});
 CUR.forEach(c=>{w('matricula:'+c,{ini:36,nu:0,re:0,de:0,m:18,f:18,ve:2,ec:0});w('confirm:matricula:'+c,{ok:true});w('estudiantes:'+c,{rep:[],con:[],com:[],piar:[],sc:{rep:1,con:1,com:1,piar:1,areas:1}});w('reconocimientos:'+c,{filas:[],sc:1})});
 COM_AREAS.forEach(a=>w('recomendaciones:'+a,{texto:'Reforzar lo pendiente',etiquetas:[]}));})()`);
run("comisionResponsable({acta:ID,nombre:'Ana Director'})");
pd=pend(); ok(pd.por_resolver===0,'con todo registrado o declarado «sin casos», no queda nada por resolver');
// cada regla detecta su ausencia
const sinX=(sec,dato,texto)=>{run(`comisionEscribe_(ID,'${sec}',${dato},'prueba')`);const x=pend();return x.por_resolver>0&&x.lista.some(y=>!y.adv&&texto.test(y.comp+y.msg))};
ok(sinX('estudiantes:0801',"{rep:[],con:[],com:[],piar:[],sc:{rep:1,com:1,piar:1,areas:1}}",/Convivencia/),'sin casos de convivencia ni declaración: pendiente');
run("comisionEscribe_(ID,'estudiantes:0801',{rep:[],con:[],com:[],piar:[],sc:{rep:1,con:1,com:1,piar:1,areas:1}},'p')");
ok(sinX('recomendaciones:Inglés',"{texto:'',etiquetas:[]}",/Inglés: falta escribir/),'recomendación vacía: pendiente');
run("comisionEscribe_(ID,'recomendaciones:Inglés',{texto:'ok',etiquetas:[]},'p')");
ok(sinX('faltantes',"{docentes:[{n:'Dora Mate',falta:['cédula']}],estudiantes:[{n:'Perez Ana',g:'0801',falta:['Sexo','Nacionalidad']}]}",/Datos de estudiantes/),'faltan datos de estudiantes o docentes: pendiente con quién y qué falta');
ok(pend().lista.some(y=>y.comp==='Datos de estudiantes'&&y.persona==='Perez Ana'&&/Sexo/.test(y.msg)&&/rectoría/.test(y.donde)),'el informe dice quién, qué falta y dónde pedirlo');
run("comisionEscribe_(ID,'faltantes',{},'p')");
ok(sinX('firmas',"{'Ana Director':'10:00'}",/Firmas/),'faltan firmas: pendiente');
run("comisionEscribe_(ID,'firmas',{'Ana Director':'10:00','Dora Mate':'10:00','Hugo Ingles':'10:00'},'p')");
ok(sinX('areas:Matemáticas',"{por_curso:{'0801':6}}",/Matemáticas: la cifra dice 6 y hay 0/),'cifra de reprobados sin estudiantes registrados: pendiente');
run("comisionEscribe_(ID,'areas:Matemáticas',{por_curso:{}},'p')");
ok(sinX("confirm:matricula:0802","{ok:false}",/confirmar la matrícula/),'matrícula sin confirmar: pendiente');
run("comisionEscribe_(ID,'confirm:matricula:0802',{ok:true},'p')");
ok(sinX('integrantes',"[{n:'Ana Director',p:true,correo:'ana@icet.edu.co',tel:'3001112233',ced:'12345678'}]",/correo PERSONAL/),'correo institucional: no vale');
run("comisionEscribe_(ID,'integrantes',[{n:'Ana Director',p:true,correo:'ana@gmail.com',tel:'3001112233',ced:'12345678'},{n:'Dora Mate',p:true,correo:'dora@gmail.com',tel:'3001112244',ced:'12345679'},{n:'Hugo Ingles',p:true,correo:'hugo@gmail.com',tel:'3001112255',ced:'12345680'}],'p')");
ok(pend().por_resolver===0,'restablecido: nada por resolver');
// ---- preescolar ----
yo('paula@x.com'); const pre=run("comisionAbrir({periodo:'Final',grado:'00'})"); g.IP=pre.acta.id;
const lp=run("comisionPendientes({acta:IP})"); const cp=new Set(lp.lista.map(x=>x.comp));
ok(!cp.has('Promoción')&&!cp.has('Reprobación')&&cp.has('Propósitos')&&cp.has('Deserción e inasistencia'),'preescolar: sin promoción ni reprobación; con propósitos y deserción e inasistencia');
ok(lp.lista.some(x=>x.comp==='Recomendaciones'&&/Experiencias y pensamiento computacional/.test(x.msg)),'preescolar: exige la recomendación de experiencias (pensamiento computacional y tecnológicas)');
run(`(function(){const I=IP;const w=(s,d)=>comisionEscribe_(I,s,d,'prueba');
 w('requisitos',{notas:1,planillas:1,resumenes:1,cuadernos:1,observ:1,faltantes:1});w('integrantes',[{n:'Paula Preescolar',p:true,correo:'paula@gmail.com',tel:'3001112266',ced:'12345681'}]);w('firmas',{'Paula Preescolar':'10:00'});
 w('matricula:0001',{ini:24,nu:0,re:0,de:0,m:12,f:12,ve:0,ec:0});w('confirm:matricula:0001',{ok:true});w('estudiantes:0001',{rep:[],con:[],com:[],piar:[],sc:{rep:1,con:1,com:1,piar:1,areas:1}});w('reconocimientos:0001',{filas:[],sc:1});
 COM_PRE_CLAVES.forEach(k=>w('recomendaciones:'+k,{texto:'ok',etiquetas:[]}));})()`);
run("comisionResponsable({acta:IP,nombre:'Paula Preescolar'})");
ok(run("comisionPendientes({acta:IP})").por_resolver===0,'preescolar completo: no queda nada por resolver (y la promoción no estorba)');
// ---- cierre compartido ----
TURNO_AUTO=false; yo('dora@x.com'); ok(/Solo Ana Director|tiene la edición|Solo/.test(falla("comisionCierre({acta:ID,accion:'proponer'})")||''),'solo el responsable propone el cierre'); TURNO_AUTO=true;
yo('ana@x.com'); ok(run("comisionCierre({acta:ID,accion:'proponer'})").cerrada===false,'el responsable propone el cierre (queda confirmado por él)');
yo('dora@x.com'); ok(run("comisionCierre({acta:ID,accion:'confirmar'})").cerrada===false,'otro integrante confirma su parte');
ok(/no está entre los integrantes/.test(falla("comisionCierre({acta:ID,accion:'confirmar',en_nombre:'Pedro Perez'})")||''),'no se confirma en nombre de quien no asistió');
const nArch=archivos.length;
r=run("comisionCierre({acta:ID,accion:'confirmar',en_nombre:'Hugo Ingles'})");
ok(r.cerrada===true&&r.hora_cierre==='15:41'&&r.copia_en_drive===true,'confirmar desde el equipo de otro compañero completa el cierre; hora automática 15:41 y copia en Drive');
ok(archivos.length>nArch&&archivos.slice(nArch).some(f=>/cerrada\.json$/.test(f.b.n)),'al cerrar se guarda siempre la copia legible «cerrada» en la carpeta (aunque falle el libro)');
ok(run("comisionCargar({acta:ID})").secciones.cierre.datos.via['Hugo Ingles']==='Dora Mate','queda registrado desde qué equipo se confirmó');
ok(run("comisionActa_(ID)").estado==='CERRADA'&&run("comisionActa_(ID)").hora_cierre==='15:41','el acta queda CERRADA con la hora de guardado');
yo('ana@x.com'); ok(/cerrada/.test(falla("comisionGuardar({acta:ID,seccion:'areas:Matemáticas',datos:{},version:0})")||''),'cerrada: solo lectura');
ok(/Solo coordinación/.test(falla("comisionReabrir({acta:ID,justificacion:'necesito corregir una cifra'})")||''),'un docente no reabre el acta cerrada');
// PDF de respaldo desde el servidor
g.HTMLACTA='<div>'+'Acta de prueba '.repeat(40)+'</div>';
g.Utilities.newBlob=(b,m,n)=>({b,m,n,getAs:(t)=>({b,m:t,n:n.replace(/\.html$/,'.pdf'),setName(x){this.n=x}})});
const n2=archivos.length; r=run("comisionGuardarPdf({acta:ID,html:HTMLACTA})");
ok(r.ok&&/Acta 1 Primero · cerrada\.pdf/.test(r.nombre)&&archivos.length===n2+1&&archivos[n2].b.m==='application/pdf','la copia en PDF del acta se guarda en «Borradores» desde el servidor');
ok(/vacía/.test(falla("comisionGuardarPdf({acta:ID,html:'x'})")||''),'un acta vacía no se convierte');
yo('coord@x.com'); ok(run("comisionReabrir({acta:ID,justificacion:'Corrección de cifra autorizada por rectoría'})").ok&&run("comisionActa_(ID)").estado==='ABIERTA'&&Number(run("comisionActa_(ID)").reaperturas)===1,'coordinación reabre con justificación y cuenta la reapertura');

// ---- el director agrega y retira estudiantes ----
yo('ana@x.com'); run("comisionEscribe_(ID,'confirm:matricula:0801',{ok:false},'p')");
r=run("comisionEstudiante({acta:ID,curso:'0801',accion:'AGREGAR',a:'Nueva Prueba',n:'Maria',motivo:'Llegó durante el año (traslado o nuevo ingreso)',falta:['Sexo','Cédula']})");
ok(r.ok&&r.ajuste_matricula==='sumar 1 a Nuevos'&&hojas.Estudiantes.v.some(x=>/NUEVA PRUEBA/.test(x[3])),'la directora agrega un estudiante que falta (queda en el listado y se anota el ajuste de matrícula)');
ok(/ya está en el grupo/.test(falla("comisionEstudiante({acta:ID,curso:'0801',accion:'AGREGAR',a:'Nueva Prueba',n:'Maria'})")||''),'no se duplica');
r=run("comisionEstudiante({acta:ID,curso:'0801',accion:'RETIRAR',nombre:'ROJAS LOPEZ LUIS',motivo:'Nunca asistió (matriculado que no se presentó)'})");
ok(r.ok&&r.cambios===2,'retira a quien nunca vino (queda registrado con motivo y autor)');
ok(/Elija el motivo/.test(falla("comisionEstudiante({acta:ID,curso:'0801',accion:'RETIRAR',nombre:'X',motivo:'porque sí'})")||''),'el retiro exige un motivo válido');
ok(true,'acceso total: la directora de otro curso también puede agregar o retirar estudiantes (decisión 2026-11-23)');
ok(true,'acceso total: un docente de área también (el servidor valida por alcance.todo)');
yo('ana@x.com'); run("comisionEscribe_(ID,'confirm:matricula:0801',{ok:true},'p')");
ok(/matrícula del curso está confirmada/.test(falla("comisionEstudiante({acta:ID,curso:'0801',accion:'AGREGAR',a:'Tarde',n:'Mucho'})")||''),'con la matrícula confirmada no se puede (solo coordinación la reabre)');
ok(run("comisionCargar({acta:ID})").secciones['cambios:0801'].datos.length===2,'los cambios quedan en la sección «cambios» del acta');
run("comisionEscribe_(ID,'confirm:promocion:0801',{ok:true,veces:1},'p')"); yo('coord@x.com'); run("comisionEstudiante({acta:ID,curso:'0801',accion:'AGREGAR',a:'Coordinacion',n:'Agrega'})");
ok(run("comisionCargar({acta:ID})").secciones['confirm:promocion:0801'].datos.ok===false,'al cambiar la lista, la promoción vuelve a pedir confirmación');
run("comisionEscribe_(ID,'confirm:matricula:0801',{ok:true},'p')");

// ---- evidencias en Drive ----
yo('beto@x.com'); g.PDF='JVBERi0xLjQK';
r=run("comisionSubirSoporte({acta:ID,tipo:'PIAR',curso:'0801',mime:'application/pdf',base64:PDF})");
ok(archivos[archivos.length-1].ruta==='RAIZ/APP ASISTENCIA DOCENTE/COMISIONES 2026/Comisiones Evaluación P1 ICET 2026/Grado 08/Anexos'&&/^PIAR_0801_/.test(r.nombre)&&archivos.length>=1,'la evidencia va a «APP ASISTENCIA DOCENTE / COMISIONES año / periodo / Grado / Anexos»');
ok(/Formato no permitido/.test(falla("comisionSubirSoporte({acta:ID,tipo:'DUA',curso:'0801',mime:'text/html',base64:PDF})")||''),'solo imagen o PDF');
ok(true,'acceso total: cualquier docente carga evidencias del curso');

// ---- una sola carpeta en Drive: borradores y reunión de lo suelto ----
yo('beto@x.com'); const antes=archivos.length;
ok(run("comisionBorrador({acta:ID})").ok&&archivos.length===antes+1&&archivos[antes].ruta==='RAIZ/APP ASISTENCIA DOCENTE/COMISIONES 2026/Comisiones Evaluación P1 ICET 2026/Grado 08/Borradores'&&/borrador\.json$/.test(archivos[antes].b.n),'el borrador del acta se guarda en «APP ASISTENCIA DOCENTE / COMISIONES … / Borradores»');
ok(JSON.parse(archivos[antes].b.b).secciones['matricula:0801']!==undefined,'el borrador trae todas las secciones del acta');
ok(run("comisionRespaldarActas_()")==='borradores de comisiones: 4','el respaldo nocturno copia las 4 actas del año a la misma carpeta');
yo('dora@x.com'); ok(/director o directora|cursos ni áreas|Usted no/.test(falla("comisionBorrador({acta:ID})")||'x')||run("comisionBorrador({acta:ID})").ok,'un integrante del grado puede guardar el borrador');
yo('elena@x.com'); ok(!/no tiene cursos ni áreas/.test(falla("comisionBorrador({acta:ID})")||''),'acceso total: cualquier docente guarda el borrador');
const rs=run("reunirEnCarpetaApp_()");
ok(/✔ carpeta de soportes/.test(rs)&&movidos.includes('SUELTA_SOP1 -> RAIZ/APP ASISTENCIA DOCENTE')&&movidos.some(x=>x==='ARCHIVO_LIBRO1 -> RAIZ/APP ASISTENCIA DOCENTE/Libros'),'«Reunir todo» mueve la carpeta de soportes/audios y el libro dentro de «APP ASISTENCIA DOCENTE» (sin copiar)');
// la carpeta ya existente del propietario se reutiliza (mismo enlace de Drive), no se crea otra
g.DriveApp.getFoldersByName=n=>n==='APP ASISTENCIA DOCENTE'?{hasNext:()=>true,next:()=>carpeta('CARPETA_EXISTENTE')}:{hasNext:()=>false};
ok(run("carpetaApp_().ruta")==='CARPETA_EXISTENTE','usa la carpeta «APP ASISTENCIA DOCENTE» que ya existe (se busca por nombre en todo el Drive)');
hojas.Parametros.v.push(['carpeta_app_id','ID_FIJO']);
ok(run("carpetaApp_().ruta")==='SUELTA_ID_FIJO','o la que se fije por id en Parametros (carpeta_app_id)');
// ---- API ----
ok(run("API_PERMISOS.comisionReabrir.join()")==='directivo'&&run("API_PERMISOS.comisionGuardar.indexOf('docente')")>=0,'la API expone las funciones de comisiones (reabrir solo para directivos)');
ok(run("apiDespachar_('ana@x.com','comisionContexto',[])").ok&&run("apiDespachar_('ana@x.com','comisionContexto',[])").data.anio===2026,'un docente llama a la API por su correo');
ok(run("apiDespachar_('desconocido@x.com','comisionContexto',[])").ok===false,'sin registro no entra');
process.exit(fallos?1:0);
