#!/usr/bin/env python3
"""Lee un chat de WhatsApp EXPORTADO (grupo de directivos) y propone novedades de docentes para revisar.

Uso:
  WhatsApp > el grupo > ⋮ > Más > Exportar chat > "Sin archivos" (genera un .txt)
  python3 scripts/importar_whatsapp.py chat.txt                 # solo el día de hoy
  python3 scripts/importar_whatsapp.py chat.txt --fecha 2026-10-02
  python3 scripts/importar_whatsapp.py chat.txt --desde 2026-09-28 --hasta 2026-10-02

Salida: importacion/bandeja_whatsapp_<fecha>.csv. Las filas NO se cargan solas: se pegan en la hoja Bandeja_WhatsApp del libro,
se revisan y se marca "SI" en la columna confirmar para importarlas (menú Asistencia ICET). El chat y la salida quedan fuera de git.

Es una ayuda por palabras clave: acierta lo habitual, pero puede equivocarse. Cada fila lleva su nivel de confianza y el mensaje original.
"""
import argparse, csv, datetime as dt, json, os, re, sys, unicodedata

RAIZ = os.path.join(os.path.dirname(__file__), "..")


def norm(s):
    s = unicodedata.normalize("NFD", str(s).lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


# ------------------------------------------------------------------ lectura del chat
AMPM = r"(?:[ap]\.?\s?m\.?)"
ANDROID = re.compile(rf"^(\d{{1,2}}/\d{{1,2}}/\d{{2,4}}),?\s+(\d{{1,2}}:\d{{2}})(?::\d{{2}})?\s*({AMPM})?\s+-\s+([^:]+?):\s(.*)$", re.I)
IOS = re.compile(rf"^\[(\d{{1,2}}/\d{{1,2}}/\d{{2,4}}),?\s+(\d{{1,2}}:\d{{2}})(?::\d{{2}})?\s*({AMPM})?\]\s+([^:]+?):\s(.*)$", re.I)


def fecha_hora(d, h, ampm):
    dd, mm, aa = d.split("/")
    aa = int(aa) + (2000 if int(aa) < 100 else 0)
    hh, mi = map(int, h.split(":"))
    if ampm:
        a = ampm.lower().replace(".", "").replace(" ", "")
        if a.startswith("p") and hh < 12:
            hh += 12
        if a.startswith("a") and hh == 12:
            hh = 0
    return dt.date(aa, int(mm), int(dd)), f"{hh:02d}:{mi:02d}"


def leer_chat(path):
    msgs = []
    for linea in open(path, encoding="utf-8-sig", errors="replace"):
        linea = linea.rstrip("\n").replace(" ", " ").replace("‎", "").replace("‏", "")
        m = ANDROID.match(linea) or IOS.match(linea)
        if m:
            f, h = fecha_hora(m.group(1), m.group(2), m.group(3))
            msgs.append({"fecha": f, "hora": h, "remitente": m.group(4).strip(), "texto": m.group(5).strip()})
        elif msgs and linea.strip():
            msgs[-1]["texto"] += " " + linea.strip()      # continuación de un mensaje de varias líneas
    return [m for m in msgs if not re.search(r"multimedia omitido|imagen omitida|se elimin[oó] este mensaje|mensajes y llamadas", norm(m["texto"]))]


# ------------------------------------------------------------------ docentes mencionados
STOP = {"de", "del", "la", "las", "los", "el", "y", "e"}


def cargar_docentes(path):
    res = []
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        ap = [t for t in norm(r["apellidos"]).split() if t not in STOP]
        no = [t for t in norm(r["nombres"]).split() if t not in STOP]
        res.append({"nombre": r["nombre_completo"], "ap1": ap[0] if ap else "", "ap2": ap[1] if len(ap) > 1 else "",
                    "n1": no[0] if no else "", "n2": no[1] if len(no) > 1 else ""})
    cont = {}
    for d in res:
        for k in {d["ap1"], d["ap2"]} - {""}:
            cont[("ap", k)] = cont.get(("ap", k), 0) + 1
        if d["n1"]:
            cont[("n", d["n1"])] = cont.get(("n", d["n1"]), 0) + 1
    return res, cont


def menciones(texto, docentes, cont):
    toks = set(re.findall(r"[a-zñ]+", norm(texto)))
    out = []
    for d in docentes:
        ap1, ap2, n1, n2 = d["ap1"] in toks, bool(d["ap2"]) and d["ap2"] in toks, d["n1"] in toks, bool(d["n2"]) and d["n2"] in toks
        if (ap1 and (n1 or n2)) or (ap1 and ap2) or ((n1 or n2) and ap2):
            score = 3
        elif ap1 and cont.get(("ap", d["ap1"]), 0) == 1 and len(d["ap1"]) >= 5:
            score = 2
        elif n1 and cont.get(("n", d["n1"]), 0) == 1 and len(d["n1"]) >= 4:
            score = 1
        else:
            continue
        out.append((score, d["nombre"]))
    if not out:  # apellido o nombre repetido: se ofrecen todos los candidatos (hasta 4) para que el directivo elija
        amb = [(1, d["nombre"]) for d in docentes
               if any(len(k) >= 4 and k in toks for k in (d["ap1"], d["ap2"], d["n1"]) if k)]
        return amb if 0 < len(amb) <= 4 else []
    mejor = max(s for s, _ in out)
    return [(s, n) for s, n in out if s == mejor]


# ------------------------------------------------------------------ tipo y motivo
_PAT = json.load(open(os.path.join(RAIZ, "data", "patrones_novedades.json"), encoding="utf-8"))
TIPOS = [(n, p) for n, p in _PAT["tipos"]]
MOTIVOS = [(m, c, p) for m, c, p in _PAT["motivos"]]  # (motivo, categoría, patrón) — el primero que coincide gana
JUSTIF = {"SIN JUSTIFICACIÓN": "No"}


def clasificar(texto):
    t = norm(texto)
    tipo = next((nom for nom, pat in TIPOS if re.search(pat, t)), "")
    motivo, cat = next(((m, c) for m, c, pat in MOTIVOS if re.search(pat, t)), ("", ""))
    return tipo, motivo, cat


def proponer(msgs, docentes, cont, desde, hasta):
    filas, ignorados = [], 0
    for m in msgs:
        if not (desde <= m["fecha"] <= hasta):
            continue
        tipo, motivo, cat = clasificar(m["texto"])
        quienes = menciones(m["texto"], docentes, cont)
        if not (tipo or motivo):
            ignorados += 1
            continue
        if not quienes:  # hay novedad pero no se supo de quién: queda en la bandeja para completar el docente
            filas.append({"fecha": m["fecha"].isoformat(), "hora": m["hora"], "remitente": m["remitente"], "docente": "", "tipo_novedad": tipo or "No asistió",
                          "motivo": motivo or "Otro", "categoria": cat or "OTRO", "justificada": "Sí", "confianza": "sin docente", "mensaje": m["texto"][:400],
                          "confirmar": "", "importado": ""})
            continue
        for score, nombre in quienes:
            t = tipo or "No asistió"
            mo, ca = (motivo, cat) if motivo else ("Otro", "OTRO")
            puntos = score + (1 if tipo else 0) + (1 if motivo else 0)
            conf = "alta" if (score == 3 and tipo and motivo) else ("media" if puntos >= 4 else "baja")
            if len(quienes) > 1:
                conf = "baja"  # mensaje que menciona a varias personas: confirmar quién es quién
            filas.append({"fecha": m["fecha"].isoformat(), "hora": m["hora"], "remitente": m["remitente"], "docente": nombre, "tipo_novedad": t,
                          "motivo": mo, "categoria": ca, "justificada": "Sí", "confianza": conf, "mensaje": m["texto"][:400],
                          "confirmar": "", "importado": ""})
    return filas, ignorados


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("chat")
    ap.add_argument("--fecha"); ap.add_argument("--desde"); ap.add_argument("--hasta")
    ap.add_argument("--docentes", default=os.path.join(RAIZ, "data", "docentes.csv"))
    ap.add_argument("--salida", default=os.path.join(RAIZ, "importacion"))
    a = ap.parse_args(argv)
    hoy = dt.date.today()
    desde = dt.date.fromisoformat(a.desde or a.fecha) if (a.desde or a.fecha) else hoy
    hasta = dt.date.fromisoformat(a.hasta or a.fecha) if (a.hasta or a.fecha) else (desde if not a.desde else hoy)
    docentes, cont = cargar_docentes(a.docentes)
    msgs = leer_chat(a.chat)
    filas, ign = proponer(msgs, docentes, cont, desde, hasta)
    os.makedirs(a.salida, exist_ok=True)
    sal = os.path.join(a.salida, f"bandeja_whatsapp_{desde.isoformat()}" + (f"_{hasta.isoformat()}" if hasta != desde else "") + ".csv")
    cols = ["fecha", "hora", "remitente", "docente", "tipo_novedad", "motivo", "categoria", "justificada", "confianza", "mensaje", "confirmar", "importado"]
    with open(sal, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(filas)
    print(f"{len(msgs)} mensajes leídos; {len(filas)} novedades propuestas ({ign} mensajes sin docente o sin motivo, ignorados) -> {sal}")
    for r in filas:
        print(f"  [{r['confianza']:11s}] {r['fecha']} {r['docente'] or '(completar docente)'} · {r['tipo_novedad']} · {r['motivo']}")
    return filas


if __name__ == "__main__":
    main()
