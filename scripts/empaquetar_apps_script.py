#!/usr/bin/env python3
"""Arma la carpeta apps_script/paquete/ con lo mínimo para pegar en Apps Script (modo A: directivos, un solo proyecto):
   ICET_completo.gs (todos los .gs juntos), Consulta.html, Dashboard.html y appsscript.json."""
import os, shutil, subprocess, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps_script")
OUT = os.path.join(R, "paquete")
ORDEN = ["Codigo", "Resumen", "Plazos", "Acceso", "Dashboard", "Whatsapp", "Soportes", "Patrones", "Notas", "NotasRonda", "Reuniones", "Api"]
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
with open(os.path.join(OUT, "ICET_completo.gs"), "w", encoding="utf-8") as f:
    for n in ORDEN:
        f.write(f"// ===================== {n}.gs =====================\n" + open(os.path.join(R, n + ".gs"), encoding="utf-8").read().rstrip() + "\n\n")
for n in ("Menu.html", "Consulta.html", "Dashboard.html", "Reunion.html", "appsscript.json"):
    shutil.copy(os.path.join(R, n), OUT)
print("OK", sorted(os.listdir(OUT)))
