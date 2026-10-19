const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const ok=(c,m)=>{try{assert.ok(c);console.log('  ok  ',m)}catch(e){console.log('  FALLA',m);process.exitCode=1}};
const dir=path.join(__dirname,'..');
// hoja simulada
const celdas={}, formatos={}; let alturas={}, ancho=0, nueva=false, movida=false;
const rango=(f,c,nf)=>({setValues:v=>{v.forEach((x,i)=>celdas[f+i]=x[0]);return rango(f,c,nf)},setWrap:()=>rango(f,c,nf),setVerticalAlignment:()=>rango(f,c,nf),
  setFontSize:s=>{formatos[f]=Object.assign(formatos[f]||{},{size:s});return rango(f,c,nf)},setFontWeight:()=>rango(f,c,nf),setFontColor:()=>rango(f,c,nf),setBackground:()=>rango(f,c,nf),getValue:()=>celdas[f]||''});
const hoja={clear:()=>{for(const k in celdas)delete celdas[k]},setColumnWidth:(c,w)=>{ancho=w},getRange:(f,c,nf)=>rango(f,c,nf),setRowHeight:(f,h)=>{alturas[f]=h},setFrozenRows:()=>{}};
let existe=false;
const g={SpreadsheetApp:{getActive:()=>({getSheetByName:()=>existe?hoja:null,insertSheet:()=>{nueva=true;existe=true;return hoja},setActiveSheet:()=>{},moveActiveSheet:()=>{movida=true}})},Logger:{log:()=>{}},console};
vm.createContext(g); vm.runInContext(fs.readFileSync(path.join(dir,'Leeme.gs'),'utf8'),g);
const V=vm.runInContext('VERSION_SISTEMA',g), H=vm.runInContext('HISTORIAL_VERSIONES',g);
const r=vm.runInContext('actualizarLeeme()',g);
ok(r.ok&&nueva&&movida,'crea la hoja LEEME al principio si no existe');
ok(celdas[1]==='CONTROL DE ASISTENCIA DOCENTE · I.E. ICET'&&formatos[1].size>=24&&alturas[1]>=48,'el título es grande (tamaño '+formatos[1].size+')');
ok(celdas[2].startsWith('Versión '+V+' '),'segunda fila: versión vigente '+V);
ok(Object.values(celdas).some(t=>/HISTORIAL DE VERSIONES/.test(t))&&Object.values(celdas).filter(t=>/^Versión /.test(t)).length===H.length+1,'incluye el historial ('+H.length+' versiones)');
ok(H[0].version===V,'la versión más nueva del historial es la vigente');
// al abrir: si ya está al día no reescribe; si es otra versión, sí
celdas[2]='Versión 2026.01.01-a x'; vm.runInContext('leemeAlDia_()',g); ok(celdas[2].startsWith('Versión '+V+' '),'al abrir, una versión vieja de LEEME se actualiza sola');
const antes=JSON.stringify(celdas); vm.runInContext('leemeAlDia_()',g); ok(JSON.stringify(celdas)===antes,'si ya está al día no la toca');
// el sello de versión de las pantallas coincide con la del código
const htmls=fs.readdirSync(dir).filter(f=>f.endsWith('.html'));
const malos=htmls.filter(f=>{const t=fs.readFileSync(path.join(dir,f),'utf8');const m=t.match(/versión (\d{4}\.\d{2}\.\d{2}-[a-z])/);return m&&m[1]!==V});
ok(malos.length===0,'todas las pantallas muestran la versión '+V+(malos.length?' (distintas: '+malos.join(', ')+')':''));
ok(fs.readFileSync(path.join(dir,'Codigo.gs'),'utf8').includes("'actualizarLeeme'"),'menú del libro: «Actualizar hoja LEEME»');
console.log(process.exitCode?'HAY FALLAS':'Todo bien');
