const fs=require('fs'), vm=require('vm'), assert=require('assert');
const src=fs.readFileSync(require('path').join(__dirname,'..','Resumen.gs'),'utf8');
const ctxVm={}; vm.createContext(ctxVm); vm.runInContext(src+';this.calcular=calcularResumen_;',ctxVm);
const ctx=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','..','ejemplos','demo_ctx.json'),'utf8'));
const exp=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','..','ejemplos','demo_esperado.json'),'utf8'));
const r=ctxVm.calcular(ctx);
const ig=(a,b,m)=>{try{assert.deepStrictEqual(a,b);console.log('  ok  ',m)}catch(e){console.log('  FALLA',m,JSON.stringify(a),'!=',JSON.stringify(b));process.exitCode=1}};
const k=r.kpis;
['programadas','minutos','eventos','ausencias','docentesConNovedad','llegadasTarde','salidasTempranas','cumplimiento','pctJustificadas'].forEach(x=>ig(k[x],exp[x],x));
ig(Object.fromEntries(r.porCategoria.map(x=>[x.nombre,x.minutos])),exp.porCategoria,'porCategoria');
ig(Object.fromEntries(r.porNivel.map(x=>[x.nombre,{justificada:x.justificada,sinJustificar:x.sinJustificar}])),exp.porNivel,'porNivel (justificadas vs sin justificar)');
ig(Object.fromEntries(r.tendencia.map(x=>[x.fecha,x.minutos])),exp.tendencia,'tendencia 10 días hábiles');
ig(Object.fromEntries(r.ronda.map(x=>[String(x.sesion),[x.esperados,x.marcados]])),exp.ronda,'ronda por sesión');
ig((r.porGrupo.find(x=>x.nombre==='Sin grupo')||{}).minutos,exp.grupoSinGrupo,'grado/grupo mal escritos -> "Sin grupo"');
ig(r.diasHabiles,10,'días hábiles del rango');
// rango de un solo día y rango vacío
const uno=ctxVm.calcular(Object.assign({},ctx,{desde:'2026-10-02'}));
ig(uno.diasHabiles,1,'rango de un día');
const vacio=ctxVm.calcular(Object.assign({},ctx,{novedades:[]}));
ig([vacio.kpis.minutos,vacio.kpis.pctJustificadas,vacio.porDocente.length],[0,null,0],'sin novedades (sin dividir entre cero)');
const fds=ctxVm.calcular(Object.assign({},ctx,{desde:'2026-10-03',hasta:'2026-10-04'}));
ig([fds.diasHabiles,fds.kpis.cumplimiento],[0,null],'fin de semana');

// ---- filtros (esperado calculado aparte en Python)
['PRIMARIA','SECUNDARIA','PREESCOLAR'].forEach(function(niv){
  var f=ctxVm.calcular(Object.assign({},ctx,{filtros:{nivel:niv}})).kpis, e=exp.filtroNivel[niv];
  ['minutos','eventos','programadas','ausencias','docentesConNovedad','llegadasTarde','salidasTempranas','cumplimiento','pctJustificadas'].forEach(function(x){ig(f[x],e[x],'filtro nivel '+niv+' · '+x);});
});
var rd=ctxVm.calcular(Object.assign({},ctx,{filtros:{docente:exp.docenteFiltro}})), ed=exp.filtroDocente;
['minutos','eventos','programadas','ausencias','llegadasTarde','salidasTempranas','cumplimiento','pctJustificadas'].forEach(function(x){ig(rd.kpis[x],ed[x],'filtro docente · '+x);});
ig(rd.lista.length,ed.lista,'lista de novedades del docente');
ig(rd.porDocente.length,1,'el informe del docente no incluye a otros docentes');

// ---- grupo atendido por reemplazo: la ausencia (incapacidad) cuenta, pero no queda «sin atender»
(function(){
  var base={desde:'2026-10-05',hasta:'2026-10-05',novedades:[],registro:[],horario:[],docentes:[{nombre_completo:'Ana Uno',nivel:'SECUNDARIA'}],motivos:[{motivo:'Incapacidad médica',categoria:'SALUD',justificada:'SI'}]};
  var nv=(at)=>({fecha:'2026-10-05',docente:'Ana Uno',tipo:'No asistió',motivo:'Incapacidad médica',justificada:'Sí',categoria:'SALUD',grado:'6',grupo:'1',area:'Matemáticas',minutos:90,directivo:'V',atiende:at});
  var sin=ctxVm.calcular(Object.assign({},base,{novedades:[nv('')]})).kpis;
  ig([sin.minutos,sin.ausencias,sin.minutosCubiertos],[90,1,0],'sin reemplazo: 90 min sin atender');
  var con=ctxVm.calcular(Object.assign({},base,{novedades:[nv('Reemplazo (acordado con rectoría)')]}));
  ig([con.kpis.minutos,con.kpis.ausencias,con.kpis.minutosCubiertos,con.kpis.eventosCubiertos],[0,1,90,1],'con reemplazo: la ausencia cuenta, 0 min sin atender y 90 min cubiertos');
  ig([con.kpis.minutosAusencia,con.kpis.horasAusencia,(con.porCategoria[0]||{}).minutos,con.porDocente[0].minutos,con.porDocente[0].sinAtender],[90,1.5,90,90,0],'rectoría: la ausencia (90 min) se cuenta completa por categoría y por docente aunque el grupo esté cubierto');
  ig(/atendido por reemplazo \(90 min cubiertos\)/.test(con.dia[0].motivo),true,'la lista del día indica que el grupo fue atendido por reemplazo');
  var inc=ctxVm.calcular(Object.assign({},base,{novedades:[Object.assign(nv('Reemplazo (docente)'),{tipo:'Incumplimiento: no atiende'})]})).kpis;
  ig(inc.minutos,90,'un incumplimiento nunca se considera cubierto');
  var nada=ctxVm.calcular(Object.assign({},base,{novedades:[nv('Nadie (grupo solo)')]})).kpis;
  ig(nada.minutos,90,'«nadie atendió» sigue contando como sin atender');
  var sg=ctxVm.calcular(Object.assign({},base,{novedades:[nv('No aplica (no tiene grupo asignado)')]}));
  ig([sg.kpis.minutos,sg.kpis.minutosCubiertos,sg.kpis.ausencias],[0,0,1],'orientadora o PTAFI sin grupo: no hay tiempo sin atender (ni cubierto), la ausencia sí cuenta');
  ig(/sin grupo asignado/.test(sg.dia[0].motivo),true,'la lista del día dice «sin grupo asignado»');
  var pr=ctxVm.calcular(Object.assign({},base,{novedades:[nv('Persona de apoyo contratada (alcaldía u otra entidad)')]})).kpis;
  ig([pr.minutos,pr.minutosCubiertos],[0,90],'persona de apoyo contratada cubre el grupo');
})();
