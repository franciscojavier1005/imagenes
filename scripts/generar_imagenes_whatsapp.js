// Autor: Francisco Javier Cortés Cabezas · I.E. ICET. Genera tarjetas PNG (1080 px) con las instrucciones de comisiones para WhatsApp.
const {chromium}=require('playwright'),ilu=require('./ilustraciones_comisiones');
const IL={'1':['listados'],'2':['areas','reprob'],'3':['promo','reco'],'4':['cierre']};
const T=[
{n:'1',t:'Antes de empezar y listados',c:'#0b4f8a',h:`
<div class="im">Depurar los listados primero es OBLIGATORIO. Sin eso no se puede continuar.</div>
<h3>Inicio</h3><ul><li>Entre a la aplicación, escoja <b>grado y período</b>; anote lugar y hora de inicio.</li><li><b>Asistencia:</b> debe estar al menos <b>un directivo docente</b>. Puede agregar más personas.</li><li>Cada docente da su <b>correo</b> al empezar y su <b>cédula</b> al finalizar, y permanece hasta el final.</li></ul>
<h3>Listados (director/a de grupo)</h3><ul><li>Revise cada estudiante: <b>nombres y apellidos, sexo, nacionalidad, tipo y número de documento</b>.</li><li>Si no sabe el documento: consulte <b>archivo</b> o pregunte al <b>estudiante o acudiente</b>. Puede ser el número que dio el rector o la Secretaría de Educación.</li><li>Cuidado especial con quienes recibirán <b>reconocimientos</b>: nombres y documentos exactos.</li><li>Al terminar pulse <b>«Confirmar sexo y documento del curso»</b>.</li></ul>`},
{n:'2',t:'Retirados, matrícula, áreas y reprobación',c:'#0b7a4b',h:`
<h3>«Retirado» o «No asiste»</h3><ul><li><b>Retirado:</b> solo con plena seguridad (otra institución o ciudad, canceló o falleció).</li><li>Si hay dudas: <b>«No asiste»</b> (orientación del rector).</li><li>Quien queda inhabilitado <b>desaparece del resto del acta</b>.</li></ul>
<h3>Matrícula</h3><ul><li>Es <b>informativa</b>: sale sola de los listados. No se escribe nada.</li><li>Si una cifra no cuadra, corrija el <b>sexo o la nacionalidad</b> en el listado.</li></ul>
<h3>Áreas</h3><ul><li>En cada área pulse <b>«Seleccionar»</b> y marque <b>varios estudiantes a la vez</b>.</li><li>Reprueba quien queda <b>por debajo de 2,91</b>.</li><li>Aprobados y reprobados son <b>solo lectura</b>: cambian al seleccionar.</li></ul>
<h3>Reprobación</h3><ul><li>Se llena sola desde Áreas. Lo que se agregue en Promoción aparece aquí con «Falta la causa»: escríbala.</li><li>Si alguien reprueba <b>todas</b> las áreas, verifique si asiste (si no, «No asiste…» en Listados).</li><li>Solo registre las <b>causas</b> de cada área y la inasistencia.</li><li>Si quiere justificar mejor un caso: botón <b>«+ Anotación»</b> junto al área (opcional).</li></ul>`},
{n:'3',t:'Promoción, convivencia y reconocimientos',c:'#8a4b0b',h:`
<h3>Promoción (solo acta final)</h3><ul><li>Todos salen promovidos por defecto.</li><li><span class="am">Amarillo</span>: 1 o 2 áreas pendientes. <span class="ro">Rosado</span>: más de 2 áreas, no promovidos.</li><li>En 11.º, quien pierde un área no participa en la ceremonia de graduación.</li><li>Si agrega un área aquí, aparece también en Reprobación y Áreas.</li></ul>
<h3>Convivencia y compromisos</h3><ul><li>Solo si hubo casos. Si no: <b>«No hubo casos»</b>.</li><li>Compromisos con padres y estudiantes: aparte de convivencia.</li></ul>
<h3>Reconocimientos</h3><ul><li>Puede marcar <b>varios estudiantes a la vez</b>.</li><li><b>Excelencia y Rendimiento:</b> el promedio sale en <b>4,6 provisional</b>. Cámbielo SIEMPRE por el real (hasta 3 decimales). Puesto hasta 10.º.</li><li><b>Convivencia:</b> sin puesto, nota opcional.</li><li><b>Colaboración y otros:</b> sin nota ni puesto. En «Otros» elija o cree (uniforme, puntualidad, sentido de pertenencia…).</li><li>Revise nombres y documentos antes de cerrar.</li></ul>`},
{n:'4',t:'Cierre y borradores',c:'#6b1f8a',h:`
<h3>Cierre del acta</h3><ul><li>Corrija los <b>pendientes</b> y revise <b>«Datos faltantes»</b>.</li><li>Pulse <b>«Mi parte lista»</b>.</li><li><b>Imprima el acta</b> (pestaña «Imprimible») <b>antes de cerrar</b> y recoja las firmas.</li><li>Al finalizar, cada asistente confirma con correo y código. <b>No se firma dos veces.</b></li></ul>
<h3>Si no alcanza a terminar</h3><ul><li><b>«Guardar borrador»</b> antes de salir; luego <b>«Recuperar borrador»</b>.</li><li>Guardar borrador <b>no</b> es firmar ni cerrar.</li><li>Botones flotantes <b>☰ ◀ ▶ ▲ ▼</b>: menú del acta, fase anterior o siguiente, subir y bajar.</li><li><b>Nueva acta / archivar / borrar / recuperar</b>: permite empezar de nuevo o volver a una acta anterior.</li></ul>
<h3>Caminar</h3><ul><li>Caminar 1 va en el acta de 6.º y Caminar 2 en la de 8.º. Dudas: coordinación.</li></ul>
<h3>Después</h3><ul><li>Pedir la <b>retroalimentación</b> a Coordinación Académica.</li><li>Manual y guía: pestaña <b>«Cómo funciona»</b> y menú <b>«Manuales»</b>.</li></ul>`}
];
(async()=>{const b=await chromium.launch(),p=await b.newPage({viewport:{width:1080,height:1200}});
for(const x of T){const html=`<html><head><meta charset="utf-8"><style>
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#fff}.w{width:1080px;box-sizing:border-box}
.hd{background:${x.c};color:#fff;padding:34px 48px}.hd small{font-size:26px;opacity:.9;display:block}.hd h1{margin:6px 0 0;font-size:46px;line-height:1.15}
.bd{padding:26px 48px 20px;font-size:31px;line-height:1.38;color:#222}h3{font-size:34px;color:${x.c};margin:22px 0 6px;border-bottom:3px solid ${x.c}33;padding-bottom:4px}
ul{margin:6px 0 0;padding-left:34px}li{margin:7px 0}.im{background:#fff3cf;border:3px solid #e0872b;border-radius:14px;padding:16px 22px;font-weight:bold;font-size:32px}
.am{background:#ffe680;padding:0 8px;border-radius:6px}.ro{background:#ffc2d1;padding:0 8px;border-radius:6px}
.ft{padding:14px 48px 26px;font-size:22px;color:#888}</style></head><body><div class="w" id="c"><div class="hd"><small>Comisiones de Evaluación y Promoción · ${x.n} de 4</small><h1>${x.t}</h1></div><div class="bd">${x.h}${(IL[x.n]||[]).map(k=>'<div style="zoom:2.1;margin-top:8px">'+ilu[k]()+'</div>').join('')}</div><div class="ft">Coordinación Académica · Institución Ciudadela Educativa Tumaco (ICET) · Control de Procesos ICET · Autor: Francisco Javier Cortés Cabezas</div></div></body></html>`;
await p.setContent(html);await p.locator('#c').screenshot({path:`docs/whatsapp/Comisiones_${x.n}_de_4.png`})}
await b.close()})();
