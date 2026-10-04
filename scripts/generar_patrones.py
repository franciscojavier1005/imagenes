#!/usr/bin/env python3
"""Genera apps_script/Patrones.gs a partir de data/patrones_novedades.json (una sola fuente para Python y Apps Script)."""
import json, os
RAIZ = os.path.join(os.path.dirname(__file__), "..")
d = json.load(open(os.path.join(RAIZ, "data", "patrones_novedades.json"), encoding="utf-8"))
js = json.dumps({"tipos": d["tipos"], "motivos": d["motivos"]}, ensure_ascii=False, indent=1)
open(os.path.join(RAIZ, "apps_script", "Patrones.gs"), "w", encoding="utf-8").write(
    "/** GENERADO por scripts/generar_patrones.py desde data/patrones_novedades.json. No edite a mano. */\nvar PATRONES = " + js + ";\n")
print("Patrones.gs:", len(d["tipos"]), "tipos,", len(d["motivos"]), "motivos")
