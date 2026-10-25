// Revisa que el JavaScript de cada pantalla (.html) y de cada archivo .gs compile: un error de sintaxis deja la pantalla muerta y las demás pruebas no lo ven.
const fs=require('fs'), path=require('path'), vm=require('vm');
const dir=path.join(__dirname,'..');
let fallos=0; const ok=(c,m)=>{console.log((c?'  ok   ':'  FALLA ')+m); if(!c)fallos++;};
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.html'))){
  const t=fs.readFileSync(path.join(dir,f),'utf8'); let n=0, mal=null;
  for(const m of t.matchAll(/<script>([\s\S]*?)<\/script>/g)){ n++; try{ new vm.Script(m[1],{filename:f+'#'+n}); }catch(e){ mal=mal||('bloque '+n+': '+e.message); } }
  ok(!mal,f+': '+n+' bloques de script compilan'+(mal?' → '+mal:''));
}
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.gs'))){
  let mal=null; try{ new vm.Script(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f}); }catch(e){ mal=e.message; }
  ok(!mal,f+' compila'+(mal?' → '+mal:''));
}
console.log(fallos?'HAY FALLAS':'Todo bien'); process.exit(fallos?1:0);
