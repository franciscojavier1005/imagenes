#!/usr/bin/env python3
"""Genera apps_script/Manuales.html con los manuales en PDF incrustados (se descargan o se abren desde la aplicación).
Ejecutar después de regenerar los PDF (node scripts/generar_manual_pdf.js y node scripts/generar_manual_comisiones.js).
Autor del sistema: Francisco Javier Cortés Cabezas · I.E. ICET, Tumaco."""
import base64, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MANUALES = [('asistencia', 'Manual del sistema (asistencia docente, reuniones, novedades)', 'Manual_ICET_Asistencia_Docente.pdf'),
            ('comisiones', 'Manual de las comisiones de evaluación y promoción', 'Manual_Comisiones_ICET.pdf')]
filas, datos = [], []
for k, titulo, f in MANUALES:
    ruta = os.path.join(R, 'docs', f)
    if not os.path.exists(ruta): continue
    b = base64.b64encode(open(ruta, 'rb').read()).decode()
    mb = round(os.path.getsize(ruta) / 1048576, 1)
    filas.append(f'<div class="m"><b>{titulo}</b><span>{mb} MB · PDF</span><div><button onclick="ver(\'{k}\')">Abrir</button> <button onclick="bajar(\'{k}\',\'{f}\')">Descargar</button></div></div>')
    datos.append(f"M['{k}']='{b}';")
html = f'''<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Manuales en PDF</title>
<style>body{{font-family:Arial,sans-serif;margin:0;background:#f4f6fb;color:#1f2a44}}header{{background:#0f2a5c;color:#fff;padding:16px}}h1{{margin:0;font-size:20px}}main{{max-width:720px;margin:0 auto;padding:12px}}
.m{{background:#fff;border-radius:12px;padding:12px 14px;margin:10px 0;box-shadow:0 1px 4px rgba(0,0,0,.1)}}.m span{{display:block;color:#667;font-size:13px;margin:2px 0 8px}}button,.v{{border:0;border-radius:10px;background:#0f2a5c;color:#fff;padding:9px 14px;font-size:14px;cursor:pointer}}
.pie{{color:#667;font-size:12px;text-align:center;margin:18px 8px}}a{{color:#0f2a5c}}</style></head><body>
<header><h1>Manuales en PDF</h1><div style="font-size:13px;opacity:.9">Control de Procesos ICET · versión <?= VERSION ?></div></header>
<main>{''.join(filas) or '<p>No hay manuales cargados todavía.</p>'}<p><a href="javascript:history.back()">← Volver</a></p>
<div class="pie">Control de Procesos ICET · Autor: Francisco Javier Cortés Cabezas · I.E. ICET, San Andrés de Tumaco · © 2026</div></main>
<script>var M={{}};{''.join(datos)}
function blob(k){{var b=atob(M[k]),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new Blob([a],{{type:'application/pdf'}});}}
function bajar(k,f){{var u=URL.createObjectURL(blob(k)),a=document.createElement('a');a.href=u;a.download=f;document.body.appendChild(a);a.click();setTimeout(function(){{URL.revokeObjectURL(u);a.remove();}},4000);}}
function ver(k){{var u=URL.createObjectURL(blob(k));var w=window.open(u,'_blank');if(!w)location.href=u;}}</script></body></html>'''
open(os.path.join(R, 'apps_script', 'Manuales.html'), 'w', encoding='utf-8').write(html)
print('OK Manuales.html', round(len(html) / 1048576, 1), 'MB')
