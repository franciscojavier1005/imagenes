// Genera el manual de la comisión de evaluación y promoción (docs/Manual_Comisiones_ICET.pdf) a partir de scripts/manual/comisiones.html.
// Dos pasadas: la primera calcula en qué página empieza cada capítulo y la segunda pone esos números en el contenido.
// Requiere Playwright (node) y pdftotext. Uso: node scripts/generar_manual_comisiones.js
// Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const RAIZ = path.join(__dirname, '..');
const VERSION = 'vista previa v45', FECHA = '22 de noviembre de 2026';
const IMG = path.join(__dirname, 'manual', 'img_comisiones');
const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'manual', 'comisiones.html'), 'utf8').replace(/\{\{VERSION\}\}/g, VERSION).replace(/\{\{FECHA\}\}/g, FECHA).replace(/\{\{IMG:(\w+)\}\}/g, (m, n) => 'data:image/png;base64,' + fs.readFileSync(path.join(IMG, n + '.png')).toString('base64'));
const salida = path.join(RAIZ, 'docs', 'Manual_Comisiones_ICET.pdf');
const pie = '<div style="width:100%;font-size:8px;color:#678;padding:0 16mm;display:flex;justify-content:space-between"><span>Manual de la comisión de evaluación y promoción · I.E. ICET · ' + VERSION + '</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>';
async function pdf(html) {
  const b = await chromium.launch(), p = await b.newPage();
  await p.setContent(html, { waitUntil: 'load' }); await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: salida, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: pie });
  await b.close();
}
(async () => {
  await pdf(fuente);
  const n = Number(execFileSync('pdfinfo', [salida]).toString().match(/Pages:\s+(\d+)/)[1]);
  const titulos = {}; (fuente.match(/<section class="cap" id="(\w+)"><h2><span class="n">[^<]*<\/span>([^<]+)<\/h2>/g) || []).forEach(s => { const m = s.match(/id="(\w+)".*<\/span>([^<]+)<\/h2>/); titulos[m[1]] = m[2].trim(); });
  const paginas = {};
  for (let i = 3; i <= n; i++) {
    const t = execFileSync('pdftotext', ['-f', String(i), '-l', String(i), '-layout', salida, '-']).toString();
    Object.keys(titulos).forEach(id => { if (!(id in paginas) && t.indexOf(titulos[id]) >= 0 && new RegExp('^\\s*\\d+\\s*' + titulos[id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm').test(t)) paginas[id] = i; });
  }
  const conPaginas = fuente.replace(/data-cap="(\w+)"><\/b>/g, (m, id) => 'data-cap="' + id + '">' + (paginas[id] || '') + '</b>');
  await pdf(conPaginas);
  console.log('OK', salida, '· páginas:', n, '· capítulos:', JSON.stringify(paginas));
})();
