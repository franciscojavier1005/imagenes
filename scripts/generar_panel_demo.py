#!/usr/bin/env python3
"""Genera ICET_Panel_Vista_Previa.html: el panel (apps_script/Dashboard.html) con DATOS DE EJEMPLO (docentes ficticios).

Archivo único, sin Google ni servidor. Usa el mismo cálculo (apps_script/Resumen.gs) que el panel real.
"""
import json, os, re

RAIZ = os.path.join(os.path.dirname(__file__), "..")
ctx = open(os.path.join(RAIZ, "ejemplos", "demo_ctx.json"), encoding="utf-8").read()
calc = open(os.path.join(RAIZ, "apps_script", "Resumen.gs"), encoding="utf-8").read()
html = open(os.path.join(RAIZ, "apps_script", "Dashboard.html"), encoding="utf-8").read()

mock = """<script>
/* ---- Vista previa: cálculo real (Resumen.gs) sobre DATOS DE EJEMPLO ---- */
window.__HOY='2026-10-02';
%s
var DEMO=%s;
window.google={script:{run:new Proxy({},{get:function(_,k){
  var ok=null,fail=null,self={withSuccessHandler:function(f){ok=f;return self;},withFailureHandler:function(f){fail=f;return self;},
    urlBase:function(){setTimeout(function(){ok('');},0);},
    datosDashboard:function(d,h){setTimeout(function(){ok(calcularResumen_({desde:d,hasta:h,novedades:DEMO.novedades,registro:DEMO.registro,
      horario:DEMO.horario,docentes:DEMO.docentes,motivos:DEMO.motivos}));},120);}};
  return k in self?self[k]:self;}})}};
</script>
""" % (calc, ctx)

html = html.replace("<script>\nvar R=null", mock + "<script>\nvar R=null", 1)
html = html.replace('<div class="wrap">', '<div class="wrap">\n  <div style="background:#fff3cd;color:#664d03;padding:8px 12px;font-size:13px;border-radius:8px;margin-bottom:12px">'
                    "<b>VISTA PREVIA CON DATOS DE EJEMPLO:</b> los docentes y las novedades son ficticios, solo para mostrar cómo se verá el panel. "
                    "Con datos reales el panel se alimenta de las hojas del libro.</div>", 1)
html = html.replace("<title>ICET - Panel de asistencia docente</title>", "<title>ICET - Vista previa del panel (datos de ejemplo)</title>")
open(os.path.join(RAIZ, "ICET_Panel_Vista_Previa.html"), "w", encoding="utf-8").write(html)
print("OK", round(len(html) / 1024), "KB")
