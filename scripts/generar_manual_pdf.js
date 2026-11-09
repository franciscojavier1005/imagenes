// Genera la cartilla de uso en PDF (docs/Manual_ICET_Asistencia_Docente.pdf) a partir de scripts/manual/cartilla.html.
// Dos pasadas: la primera calcula en qué página empieza cada capítulo y la segunda pone esos números en el contenido.
// Requiere Playwright (node) y pdftotext. Uso: node scripts/generar_manual_pdf.js
// Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco).
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const RAIZ = path.join(__dirname, '..');
const leeme = fs.readFileSync(path.join(RAIZ, 'apps_script', 'Leeme.gs'), 'utf8');
const version = (leeme.match(/VERSION_SISTEMA = '([^']+)'/) || [])[1] || '', fecha = (leeme.match(/FECHA_VERSION = '([^']+)'/) || [])[1] || '';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaTxt = fecha ? (d => d[2].replace(/^0/, '') + ' de ' + MESES[Number(d[1]) - 1] + ' de ' + d[0])(fecha.split('-')) : '';
const fuente = fs.readFileSync(path.join(RAIZ, 'scripts', 'manual', 'cartilla.html'), 'utf8').replace(/\{\{VERSION\}\}/g, version).replace(/\{\{FECHA\}\}/g, fechaTxt);
const salida = path.join(RAIZ, 'docs', 'Manual_ICET_Asistencia_Docente.pdf');
const pie = '<div style="width:100%;font-size:8px;color:#678;padding:0 16mm;display:flex;justify-content:space-between"><span>Cartilla de uso · Control de asistencia docente · I.E. ICET · versión ' + version + '</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>';
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
