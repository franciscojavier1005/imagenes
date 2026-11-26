// Autor: Francisco Javier Cortés Cabezas · I.E. ICET. Infografía vertical de la guía rápida de comisiones (PNG nítido, 2x).
const {chromium}=require('playwright'),fs=require('fs'),ilu=require('./ilustraciones_comisiones');
const V=(fs.readFileSync('apps_script/Leeme.gs','utf8').match(/VERSION_SISTEMA = '([^']+)'/)||[])[1]||'';
const P=[
['1','Antes de empezar','#0b4f8a','Elija <b>grado y período</b>. Anote lugar y hora de inicio.<br>En la asistencia debe estar <b>al menos un directivo docente</b>; puede sumar más personas.<br>Cada docente da su <b>correo</b> al empezar y su <b>cédula</b> al finalizar.'],
['2','Listados: depurar es OBLIGATORIO','#c0392b','Director/a de grupo: revise <b>nombres, sexo, nacionalidad, tipo y número de documento</b> de cada estudiante.<br>¿No sabe el documento? Consulte <b>archivo</b> o al <b>estudiante o acudiente</b> (puede ser el número del rector o de la Secretaría de Educación).<br>Luego pulse <b>«Confirmar sexo y documento del curso»</b>.<br><span class="tag rj">Retirado</span> solo con plena seguridad (otra institución o ciudad, canceló o falleció).<br><span class="tag gr">No asiste</span> si hay dudas. Ambos desaparecen del resto del acta.'],
['3','Matrícula: solo informativa','#0b7a4b','Sale sola de los listados. <b>No se escribe nada.</b><br>Si una cifra no cuadra, corrija el <b>sexo o la nacionalidad</b> en el listado.'],
['4','Áreas: quién reprobó','#8a4b0b','En cada área pulse <b>«Seleccionar»</b> y marque <b>varios estudiantes a la vez</b>.<br>Reprueba quien queda <b>por debajo de 2,91</b>.<br>Las cifras de aprobados y reprobados son <b>solo lectura</b>: cambian únicamente al seleccionar.'],
['5','Reprobación: solo las causas','#6b1f8a','Se llena <b>sola</b> desde Áreas. Escriba las <b>causas</b> de cada área y la inasistencia.<br>Todo está sincronizado: lo que se agregue en Promoción aparece aquí con el aviso <b>«Falta la causa»</b>; escríbala.<br>Si alguien reprueba <b>todas</b> las áreas, verifique si asiste (si no, «No asiste…» en Listados).<br>Opcional: <b>«+ Anotación»</b> junto a cada área (sale en el acta impresa).'],
['6','Promoción (solo acta final)','#b8860b','Todos salen promovidos por defecto.<br><span class="tag am">Amarillo</span> 1 o 2 áreas pendientes. <span class="tag pk">Rosado</span> más de 2 áreas: no promovidos.<br>En 11.º, quien pierde un área no participa en la graduación.<br>Si agrega un área aquí, aparece también en Reprobación y Áreas.<br>No ponga candados hasta revisar los listados.'],
['7','Convivencia y compromisos','#1a7f8e','Solo si hubo casos. Si no: <b>«No hubo casos»</b>.<br>Compromisos con padres y estudiantes van aparte.'],
['8','Reconocimientos','#a0316a','Puede marcar <b>varios estudiantes a la vez</b>.<br><b>Excelencia y Rendimiento:</b> el promedio sale en <b>4,6 provisional</b>. Cámbielo SIEMPRE por el real (hasta 3 decimales). Puesto hasta 10.º.<br><b>Convivencia:</b> sin puesto, nota opcional. <b>Colaboración y otros:</b> sin nota ni puesto; en «Otros» elija o cree el reconocimiento (uniforme, puntualidad, sentido de pertenencia…).<br>Revise nombres y documentos antes de cerrar.'],
['9','Cierre','#0b4f8a','Corrija los <b>pendientes</b> y complete <b>«Datos faltantes»</b>. Pulse <b>«Mi parte lista»</b>.<br><b>Imprima el acta antes de cerrar</b> (pestaña «Imprimible») y recoja las firmas.<br>Al finalizar, cada asistente confirma con correo y código. <b>No se firma dos veces.</b>']
];
const K={'2':'listados','4':'areas','5':'reprob','6':'promo','8':'reco','9':'cierre'};
const pasos=P.map(([n,t,c,h])=>`<div class="p" style="--c:${c}"><div class="n">${n}</div><div class="b"><h2>${t}</h2><p>${h}</p>${K[n]?'<div style="transform-origin:left top;margin-top:10px;zoom:1.9">'+ilu[K[n]]()+'</div>':''}</div></div>`).join('');
const html=`<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef3f9}
#c{width:1080px;background:#eef3f9}
.hd{background:linear-gradient(135deg,#0b4f8a,#1a7f8e);color:#fff;padding:54px 56px 44px}
.hd small{font-size:26px;letter-spacing:1px;opacity:.9}.hd h1{font-size:62px;line-height:1.08;margin:10px 0 14px}.hd .t{font-size:30px;opacity:.95}
.al{margin:28px 40px 6px;background:#fff3cf;border:4px solid #e0872b;border-radius:20px;padding:22px 28px;font-size:34px;font-weight:bold;color:#7a3e00;text-align:center}
.p{display:flex;gap:22px;margin:22px 40px;background:#fff;border-radius:22px;padding:26px 28px;border-left:14px solid var(--c);box-shadow:0 4px 14px #0b2a4a1a}
.n{flex:0 0 78px;height:78px;border-radius:50%;background:var(--c);color:#fff;font-size:46px;font-weight:bold;display:flex;align-items:center;justify-content:center}
.b h2{margin:0 0 8px;font-size:38px;color:var(--c);line-height:1.15}.b p{margin:0;font-size:29px;line-height:1.42;color:#222}
.tag{display:inline-block;padding:0 12px;border-radius:8px;font-weight:bold;font-size:26px}.tag.rj{background:#fde2e0;color:#a32a20}.tag.gr{background:#e3e8ef;color:#334}.tag.am{background:#ffe680}.tag.pk{background:#ffc2d1}
.tip{margin:22px 40px;background:#e5f4ea;border:3px solid #0b7a4b;border-radius:20px;padding:22px 28px;font-size:29px;line-height:1.4;color:#0b3d27}
.ft{padding:20px 40px 36px;text-align:center;font-size:23px;color:#6b7a8c;line-height:1.5}
</style></head><body><div id="c">
<div class="hd"><small>INSTITUCIÓN CIUDADELA EDUCATIVA TUMACO · ICET</small><h1>Comisión de evaluación y promoción</h1><div class="t">Guía rápida en 9 pasos · 40 a 60 minutos si los listados están bien</div></div>
<div class="al">La clave: depurar los listados primero. Sin eso no se puede continuar.</div>
${pasos}
<div class="tip"><b>Si algo sale mal:</b> «Guardar borrador» antes de salir y luego «Recuperar borrador». «Nueva acta / archivar / borrar / recuperar» permite empezar de nuevo o volver a una acta anterior. Guardar borrador <b>no</b> es firmar. Botones flotantes ☰ ◀ ▶ ▲ ▼: menú del acta, fase anterior/siguiente, subir y bajar. Manuales: pestaña «Cómo funciona» y menú «Manuales». Dudas: Coordinación Académica.</div>
<div class="ft">Control de Procesos ICET · versión ${V}<br>Autor: Francisco Javier Cortés Cabezas · Coordinación Académica</div>
</div></body></html>`;
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1080,height:1200},deviceScaleFactor:2});
await p.setContent(html);await p.locator('#c').screenshot({path:'docs/whatsapp/Infografia_Comisiones_ICET.png'});await b.close()})();
