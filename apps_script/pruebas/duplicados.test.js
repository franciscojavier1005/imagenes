// Ningún archivo .gs puede redefinir una función o variable global de otro (en Apps Script todos comparten el mismo espacio: la última pisa a la anterior).
const fs=require('fs'), path=require('path'), dir=path.join(__dirname,'..');
const vistos={}; let fallos=0;
fs.readdirSync(dir).filter(f=>f.endsWith('.gs')).forEach(f=>{
  const t=fs.readFileSync(path.join(dir,f),'utf8'); const re=/^(?:function\s+([A-Za-z0-9_$]+)|var\s+([A-Za-z0-9_$]+))/gm; let m;
  while((m=re.exec(t))){const n=m[1]||m[2]; if(vistos[n]&&vistos[n]!==f){console.log('  FALLA «'+n+'» está en '+vistos[n]+' y en '+f);fallos++} else vistos[n]=f;}
});
console.log(fallos?'HAY FALLAS':'  ok   sin nombres globales repetidos entre archivos'); process.exit(fallos?1:0);
