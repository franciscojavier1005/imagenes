// Plazos de soportes: compara Plazos.gs con el resultado esperado calculado aparte en Python (scripts/datos_soportes_demo.py).
const fs=require('fs'), vm=require('vm'), path=require('path');
const g={}; vm.createContext(g);
['Resumen.gs','Plazos.gs'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),g));
vm.runInContext('this.calc=calcularObligaciones_; this.res=resumenObligaciones_;',g);
const ctx=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','ejemplos','soportes_ctx.json'),'utf8'));
const exp=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','ejemplos','soportes_esperado.json'),'utf8'));
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
const out=g.calc(ctx), por=Object.fromEntries(out.map(o=>[o.clave,o]));
ok(Object.keys(por).length===Object.keys(exp).length,`mismas obligaciones: ${Object.keys(por).length} de ${Object.keys(exp).length} esperadas`);
Object.keys(exp).forEach(k=>{
  const o=por[k], e=exp[k]; if(!o){ok(false,'falta '+k);return;}
  const dif=['inicio','fin','dias','reintegro','limite','plazoDias','estado','diasRestantes','minutos'].filter(c=>o[c]!==e[c]);
  ok(dif.length===0,`${k}: ${o.estado}, límite ${o.limite} (${o.diasRestantes>=0?'+':''}${o.diasRestantes})`+(dif.length?' DIFIERE en '+dif.map(c=>c+' '+o[c]+'≠'+e[c]).join(', '):''));
});
ok(!('Docente E|2026-10-05' in por),'permiso del rector (no requiere soporte) no genera obligación');
ok(!Object.keys(por).some(k=>k.startsWith('Docente F')),'una llegada tarde no genera obligación');
ok(!Object.keys(por).some(k=>k.startsWith('Docente G')),'ausencia anterior a la fecha de inicio no cuenta');
const unico=g.calc(Object.assign({},ctx,{docente:'Docente B'})); ok(unico.length===1&&unico[0].docente==='Docente B','filtro por docente: solo sus obligaciones');
const cuenta=e=>Object.values(exp).filter(x=>x.estado===e).length;
const r=g.res(out); ok(r.vencidos===cuenta('Vencido')&&r.pendientes===cuenta('Pendiente')&&r.porRevisar===cuenta('Entregado')&&r.rechazados===cuenta('Rechazado')&&r.aceptados===cuenta('Aceptado'),'resumen por estado coincide con lo esperado: '+JSON.stringify(r));
process.exit(fallos?1:0);
