// Comisiones de evaluación y promoción (Comisiones.gs): numeración, permisos por curso y área, conflictos de versión, confirmaciones oficiales,
// reapertura solo por coordinación, matrícula balanceada, promoción que cuadra, cierre compartido con hora automática y evidencias en Drive.
const fs=require('fs'), vm=require('vm'), path=require('path');
class Hoja{constructor(v){this.v=v}
  getDataRange(){return {getValues:()=>JSON.parse(JSON.stringify(this.v))}}
  appendRow(r){this.v.push(r)}
  getRange(r,c,nr,nc){const s=this;return {setValue(x){while(s.v.length<r)s.v.push([]);while(s.v[r-1].length<c)s.v[r-1].push('');s.v[r-1][c-1]=x},
    setValues(a){a.forEach((row,i)=>{while(s.v.length<=r-1+i)s.v.push([]);row.forEach((x,j)=>{while(s.v[r-1+i].length<=c-1+j)s.v[r-1+i].push('');s.v[r-1+i][c-1+j]=x})})}}}
  deleteRow(r){this.v.splice(r-1,1)}}
const fmt=(d,tz,p)=>{const o=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});
  const h=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  if(p==='yyyy-MM-dd')return `${o.year}-${o.month}-${o.day}`; if(p==='HH:mm')return h; if(p==='yyyy-MM-dd HH:mm')return `${o.year}-${o.month}-${o.day} ${h}`; return String(d);};
const hojas={
 Grupos:new Hoja([['grupo','tipo','grado','nombre','modalidad'],['0801','REGULAR','08','8°-1',''],['0802','REGULAR','08','8°-2',''],['0501','REGULAR','05','5°-1','']]),
 Direccion_Grupo:new Hoja([['grupo','nombre','tipo_direccion','docente_1','docente_2','modalidad','dinamizadores'],['0801','8°-1','DIRECTOR','Ana Director','Beto Codirector','',''],['0802','8°-2','DIRECTOR','Carla Director','','',''],['0501','5°-1','DIRECTOR','Elena Primaria','','','']]),
 Horario:new Hoja([['docente','dia','hora','grupo','area'],['Dora Mate','LUNES',1,'0801','Matemáticas'],['Dora Mate','LUNES',2,'0802','Matemáticas'],['Hugo Ingles','LUNES',3,'0801','Inglés'],['Elena Primaria','LUNES',1,'0501','ÁREAS MÚLTIPLES']]),
 Docentes:new Hoja([['codigo','n','nombre_completo','nivel','correo'],[1,1,'Ana Director','SECUNDARIA','']]),
 Directivos:new Hoja([['nombre','rol','correo_temporal','administra'],['Coord Académica','Coordinador académico','coord@x.com','']]),
 Parametros:new Hoja([['clave','valor'],['anio_lectivo','2026'],['carpeta_soportes_id','SOP1']]),
 Usuarios:new Hoja([['email','docente','estado','fecha_solicitud','autoriza_datos'],['ana@x.com','Ana Director','ACTIVO','','SI'],['beto@x.com','Beto Codirector','ACTIVO','','SI'],['dora@x.com','Dora Mate','ACTIVO','','SI'],['carla@x.com','Carla Director','ACTIVO','','SI'],['elena@x.com','Elena Primaria','ACTIVO','','SI'],['hugo@x.com','Hugo Ingles','ACTIVO','','SI']])
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
const run=(c)=>vm.runInContext(c,g); const yo=(e)=>{EMAIL=e};
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
yo('elena@x.com'); ok(run("comisionContexto()").actas.length===0,'una docente de primaria no ve las actas de octavo');

// ---- guardado por secciones, permisos y conflictos ----
const mat={ini:36,nu:0,re:0,de:0,m:18,f:18,ve:2,ec:0};
yo('ana@x.com');
g.A1=id1; g.M=mat;
r=run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})"); ok(r.ok&&r.version===1,'la directora de grupo guarda la matrícula de su curso (versión 1)');
yo('beto@x.com'); r=run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:0})");
ok(r.conflicto===true&&r.version===1,'si otra persona ya la cambió, devuelve el conflicto y no pisa');
r=run("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:1})"); ok(r.ok&&r.version===2,'el codirector (2 por grupo) también guarda su curso');
yo('dora@x.com');
ok(/director o directora del curso/.test(falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:2})")||''),'un docente de área no edita la matrícula del curso');
ok(run("comisionGuardar({acta:A1,seccion:'areas:Matemáticas',datos:{rep:[3,4]},version:0})").ok,'el docente de Matemáticas guarda su área');
ok(/docente de esta área/.test(falla("comisionGuardar({acta:A1,seccion:'areas:Inglés',datos:{rep:[1]},version:0})")||''),'…pero no la de Inglés');
yo('carla@x.com'); ok(/director o directora del curso/.test(falla("comisionGuardar({acta:A1,seccion:'matricula:0801',datos:M,version:2})")||''),'la directora de 8°-2 no edita 8°-1');
ok(run("comisionGuardar({acta:A1,seccion:'matricula:0802',datos:M,version:0})").ok,'…pero sí su propio curso');
yo('elena@x.com'); ok(/no tiene cursos ni áreas/.test(falla("comisionCargar({acta:A1})")||''),'quien no trabaja en el grado no abre su acta');
yo('ana@x.com'); ok(/no válida/.test(falla("comisionGuardar({acta:A1,seccion:'confirm:matricula:0801',datos:{ok:true},version:0})")||''),'las confirmaciones no se escriben directamente');
ok(/demasiado grande/.test(falla("comisionGuardar({acta:A1,seccion:'estudiantes:0801',datos:{x:'a'.repeat(46000)},version:0})")||''),'una sección no puede pasar del límite de la celda');

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

// ---- cierre compartido ----
yo('ana@x.com'); g.ID=id1;
run("comisionGuardar({acta:ID,seccion:'integrantes',datos:[{n:'Ana Director',p:true},{n:'Dora Mate',p:true},{n:'Hugo Ingles',p:true}],version:0})");
ok(/Falta/.test(falla("comisionCierre({acta:ID,accion:'proponer'})")||''),'no se propone el cierre si faltan requisitos, responsable o confirmaciones');
run("comisionGuardar({acta:ID,seccion:'requisitos',datos:{notas:true,planillas:true,resumenes:true,cuadernos:true,observ:true,faltantes:true},version:0})");
run("comisionResponsable({acta:ID,nombre:'Ana Director'})");
run("comisionConfirmar({acta:ID,tipo:'matricula',curso:'0801',on:true})");
yo('carla@x.com');
run("comisionGuardar({acta:ID,seccion:'reconocimientos:0802',datos:{filas:[]},version:0})");
run("comisionConfirmar({acta:ID,tipo:'matricula',curso:'0802',on:true})"); run("comisionConfirmar({acta:ID,tipo:'reconocimientos',curso:'0802',on:true})");
yo('dora@x.com'); ok(/Solo Ana Director/.test(falla("comisionCierre({acta:ID,accion:'proponer'})")||''),'solo el responsable propone el cierre');
yo('ana@x.com'); ok(run("comisionCierre({acta:ID,accion:'proponer'})").cerrada===false,'el responsable propone el cierre (queda confirmado por él)');
yo('dora@x.com'); ok(run("comisionCierre({acta:ID,accion:'confirmar'})").cerrada===false,'otro integrante confirma su parte');
ok(/no está entre los integrantes/.test(falla("comisionCierre({acta:ID,accion:'confirmar',en_nombre:'Pedro Perez'})")||''),'no se confirma en nombre de quien no asistió');
r=run("comisionCierre({acta:ID,accion:'confirmar',en_nombre:'Hugo Ingles'})");
ok(r.cerrada===true&&r.hora_cierre==='15:41','confirmar desde el equipo de otro compañero completa el cierre y el sistema pone la hora (15:41)');
ok(run("comisionCargar({acta:ID})").secciones.cierre.datos.via['Hugo Ingles']==='Dora Mate','queda registrado desde qué equipo se confirmó');
ok(run("comisionActa_(ID)").estado==='CERRADA'&&run("comisionActa_(ID)").hora_cierre==='15:41','el acta queda CERRADA con la hora de guardado');
yo('ana@x.com'); ok(/cerrada/.test(falla("comisionGuardar({acta:ID,seccion:'areas:Matemáticas',datos:{},version:0})")||''),'cerrada: solo lectura');
ok(/Solo coordinación/.test(falla("comisionReabrir({acta:ID,justificacion:'necesito corregir una cifra'})")||''),'un docente no reabre el acta cerrada');
yo('coord@x.com'); ok(run("comisionReabrir({acta:ID,justificacion:'Corrección de cifra autorizada por rectoría'})").ok&&run("comisionActa_(ID)").estado==='ABIERTA'&&Number(run("comisionActa_(ID)").reaperturas)===1,'coordinación reabre con justificación y cuenta la reapertura');

// ---- evidencias en Drive ----
yo('beto@x.com'); g.PDF='JVBERi0xLjQK';
r=run("comisionSubirSoporte({acta:ID,tipo:'PIAR',curso:'0801',mime:'application/pdf',base64:PDF})");
ok(archivos.length===1&&archivos[0].ruta==='RAIZ/APP ASISTENCIA DOCENTE/COMISIONES 2026/Comisiones Evaluación P1 ICET 2026/Grado 08/Anexos'&&/^PIAR_0801_/.test(r.nombre),'la evidencia va a «APP ASISTENCIA DOCENTE / COMISIONES año / periodo / Grado / Anexos»');
ok(/Formato no permitido/.test(falla("comisionSubirSoporte({acta:ID,tipo:'DUA',curso:'0801',mime:'text/html',base64:PDF})")||''),'solo imagen o PDF');
yo('dora@x.com'); ok(/director o directora/.test(falla("comisionSubirSoporte({acta:ID,tipo:'PIAR',curso:'0801',mime:'application/pdf',base64:PDF})")||''),'el docente de área no carga evidencias del curso');

// ---- una sola carpeta en Drive: borradores y reunión de lo suelto ----
yo('beto@x.com'); const antes=archivos.length;
ok(run("comisionBorrador({acta:ID})").ok&&archivos.length===antes+1&&archivos[antes].ruta==='RAIZ/APP ASISTENCIA DOCENTE/COMISIONES 2026/Comisiones Evaluación P1 ICET 2026/Grado 08/Borradores'&&/borrador\.json$/.test(archivos[antes].b.n),'el borrador del acta se guarda en «APP ASISTENCIA DOCENTE / COMISIONES … / Borradores»');
ok(JSON.parse(archivos[antes].b.b).secciones['matricula:0801']!==undefined,'el borrador trae todas las secciones del acta');
ok(run("comisionRespaldarActas_()")==='borradores de comisiones: 3','el respaldo nocturno copia las 3 actas del año a la misma carpeta');
yo('dora@x.com'); ok(/director o directora|cursos ni áreas|Usted no/.test(falla("comisionBorrador({acta:ID})")||'x')||run("comisionBorrador({acta:ID})").ok,'un integrante del grado puede guardar el borrador');
yo('elena@x.com'); ok(/no tiene cursos ni áreas/.test(falla("comisionBorrador({acta:ID})")||''),'quien no trabaja en el grado no');
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
