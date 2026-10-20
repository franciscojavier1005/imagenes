#!/usr/bin/env python3
"""Copia apps_script/recursos/aviso_dia.html a las pantallas (entre las marcas AVISO_DIA) para tener una sola fuente.
Sistema de control de asistencia docente · Francisco Javier Cortés Cabezas · I.E. ICET."""
import os, re
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps_script")
fuente = open(os.path.join(R, "recursos", "aviso_dia.html"), encoding="utf-8").read().strip()
bloque = "<!--AVISO_DIA_INICIO-->\n" + fuente + "\n<!--AVISO_DIA_FIN-->\n"
for n in ("Menu", "Consulta", "Novedad", "Reunion", "Horarios", "Dashboard"):
    p = os.path.join(R, n + ".html"); s = open(p, encoding="utf-8").read()
    if "<!--AVISO_DIA_INICIO-->" in s:
        s = re.sub(r"<!--AVISO_DIA_INICIO-->.*?<!--AVISO_DIA_FIN-->\n?", lambda m: bloque, s, flags=re.S)
    else:
        i = s.rindex("</body>"); s = s[:i] + bloque + s[i:]
    open(p, "w", encoding="utf-8").write(s)
print("OK aviso del día sincronizado")
