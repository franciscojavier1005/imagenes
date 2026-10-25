#!/usr/bin/env python3
"""Arma el paquete para la carpeta «App Asistencia» (OneDrive del coordinador): la ÚLTIMA versión en una carpeta aparte y las 5 últimas versiones
estables (cada una con su ICET_completo.gs y los HTML). Se toma del historial de git (apps_script/paquete de cada versión). Las versiones con un defecto
conocido se omiten (lista en VERSIONES_CON_DEFECTO). Salida: salida_onedrive/App_Asistencia_<ultima>.zip
Autor del sistema: Francisco Javier Cortés Cabezas (I.E. ICET, Tumaco)."""
import os, re, subprocess, shutil, zipfile
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVOS = ["ICET_completo.gs", "Ayuda.html", "Consulta.html", "Dashboard.html", "Horarios.html", "Menu.html", "Novedad.html", "Reunion.html", "appsscript.json"]
VERSIONES_CON_DEFECTO = {"2026.10.25-b": "Reuniones no funcionaba (error de sintaxis en Reunion.html)", "2026.10.25-c": "Reuniones no funcionaba (error de sintaxis en Reunion.html)",
                         "2026.10.25-d": "Reuniones no funcionaba (error de sintaxis en Reunion.html)"}
CUANTAS = 5
def git(*a): return subprocess.run(["git", "-C", RAIZ] + list(a), capture_output=True, text=True, check=True).stdout
def versiones():
    out, vistos = [], set()
    for linea in git("log", "--format=%H %s").splitlines():
        h, _, s = linea.partition(" ")
        m = re.search(r"\((20\d\d\.\d\d\.\d\d-[a-z])\)\s*$", s)
        if m and m.group(1) not in vistos and not s.startswith("Revert") and not s.startswith("Reapply"):
            vistos.add(m.group(1)); out.append((m.group(1), h))
    return out
def contenido(h, nombre):
    r = subprocess.run(["git", "-C", RAIZ, "show", f"{h}:apps_script/paquete/{nombre}"], capture_output=True)
    return r.stdout if r.returncode == 0 else None
def main():
    todas = versiones()
    estables = [v for v in todas if v[0] not in VERSIONES_CON_DEFECTO][:CUANTAS]
    if not estables: raise SystemExit("No hay versiones en el historial")
    ultima = estables[0][0]
    carpeta = os.path.join(RAIZ, "salida_onedrive"); shutil.rmtree(carpeta, ignore_errors=True)
    base = os.path.join(carpeta, "App Asistencia"); os.makedirs(base)
    def escribe(destino, h):
        os.makedirs(destino, exist_ok=True); n = 0
        for a in ARCHIVOS:
            c = contenido(h, a)
            if c is not None: open(os.path.join(destino, a), "wb").write(c); n += 1
        return n
    escribe(os.path.join(base, f"ULTIMA {ultima}"), estables[0][1])
    for ver, h in estables: escribe(os.path.join(base, "VERSIONES", ver), h)
    leeme = ["APP ASISTENCIA · Control de asistencia docente · I.E. ICET (Tumaco)", "Autor: Francisco Javier Cortés Cabezas", "",
             f"ULTIMA {ultima}: es la que debe estar instalada en Apps Script (ICET_completo.gs + los HTML).", "",
             "Cómo instalar: en Apps Script reemplace ICET_completo.gs y cada HTML por los de la carpeta ULTIMA; luego Implementar → Gestionar implementaciones → Editar → Nueva versión.", "",
             f"VERSIONES: las {len(estables)} últimas versiones estables (para volver atrás si hiciera falta):"] + [f"  - {v}" for v, _ in estables]
    omit = [(v, VERSIONES_CON_DEFECTO[v]) for v, _ in todas if v in VERSIONES_CON_DEFECTO]
    if omit: leeme += ["", "Versiones omitidas por un defecto conocido (no las use):"] + [f"  - {v}: {m}" for v, m in omit]
    open(os.path.join(base, "LEEME.txt"), "w", encoding="utf-8").write("\n".join(leeme) + "\n")
    z = os.path.join(carpeta, f"App_Asistencia_{ultima}.zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for dp, _, fs in os.walk(base):
            for f in fs:
                p = os.path.join(dp, f); zf.write(p, os.path.relpath(p, carpeta))
    print("OK", z, "· última:", ultima, "· versiones:", [v for v, _ in estables])
main()
