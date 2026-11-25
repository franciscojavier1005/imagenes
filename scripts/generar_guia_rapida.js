// Genera la guía rápida de la comisión (docs/Guia_Rapida_Comisiones_ICET.pdf, 2 páginas) con el mismo contenido del capítulo «R» del manual.
// Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco). Uso: node scripts/generar_guia_rapida.js
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const RAIZ = path.join(__dirname, '..');
const man = fs.readFileSync(path.join(RAIZ, 'scripts', 'manual', 'comisiones.html'), 'utf8');
const css = (man.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [0, ''])[1];
const guia = fs.readFileSync(path.join(RAIZ, 'scripts', 'manual', 'guia_rapida.html'), 'utf8');
const ver = (/VERSION_SISTEMA = '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'apps_script', 'Leeme.gs'), 'utf8')) || [0, ''])[1];
const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><style>' + css + 'body{margin:0}.cap{page-break-inside:auto}h1{font-size:22px;margin:0 0 4px;color:#0f2a5c}.sub{color:#556;margin-bottom:8px}.paso{margin:5px 0}.guia p,.guia .tx{font-size:12px;line-height:1.35}</style></head><body><div class="guia"><h1>Comisión de evaluación y promoción · Guía rápida</h1><div class="sub">I.E. ICET · versión ' + ver + ' · la clave: depurar los listados</div>' + guia + '</div></body></html>';
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.pdf({ path: path.join(RAIZ, 'docs', 'Guia_Rapida_Comisiones_ICET.pdf'), format: 'Letter', margin: { top: '12mm', bottom: '14mm', left: '14mm', right: '14mm' }, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;font-size:8px;color:#678;padding:0 14mm;text-align:center">Control de Procesos ICET · Autor: Francisco Javier Cortés Cabezas · I.E. ICET, Tumaco</div>' });
  await b.close(); console.log('OK docs/Guia_Rapida_Comisiones_ICET.pdf');
})();
