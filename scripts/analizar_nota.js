#!/usr/bin/env node
// Analiza una observación de ronda con las mismas reglas que usa la aplicación (apps_script/Notas.gs).
//   echo "El 8-1 estaba solo en la tercera hora" | node scripts/analizar_nota.js 2026-10-02
// Lee el texto por la entrada estándar y escribe las propuestas en JSON.
const fs = require('fs'), vm = require('vm'), path = require('path');
const raiz = path.join(__dirname, '..'), d = path.join(raiz, 'data');
const csv = (n) => {   // CSV con comillas, sin dependencias
  const t = fs.readFileSync(path.join(d, n), 'utf8').replace(/^﻿/, ''), filas = []; let f = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const x = t[i];
    if (q) { if (x === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += x; }
    else if (x === '"') q = true; else if (x === ',') { f.push(c); c = ''; } else if (x === '\n' || x === '\r') { if (x === '\r' && t[i + 1] === '\n') i++; f.push(c); c = ''; if (f.length > 1 || f[0] !== '') filas.push(f); f = []; } else c += x; }
  if (c || f.length) { f.push(c); filas.push(f); }
  const h = filas[0]; return filas.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
};
const fecha = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) { console.error('Uso: node scripts/analizar_nota.js AAAA-MM-DD < texto.txt'); process.exit(2); }
const g = {}; vm.createContext(g);
['Patrones.gs', 'Notas.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(raiz, 'apps_script', f), 'utf8'), g));
g.CTX = {
  texto: fs.readFileSync(0, 'utf8'), fecha, docentes: csv('docentes.csv'), grupos: csv('grupos.csv'),
  franjas: csv('franjas.csv').map(f => ({ hora: +f.hora, inicio_min: +f.inicio_min, fin_min: +f.fin_min })),
  horario: csv('horario_maestro.csv').map(h => ({ docente: h.docente, dia: h.dia, hora: +h.hora, tipo: h.tipo, grupo: h.grupo, grupos_enfasis: h.grupos_enfasis }))
};
console.log(JSON.stringify(vm.runInContext('analizarNota_(CTX)', g), null, 2));
