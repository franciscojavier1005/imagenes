#!/usr/bin/env python3
"""Exporta las hojas del libro a pruebas/hojas.json con novedades de ejemplo, para probar el servidor (Dashboard.gs) sin Google."""
import json, os, openpyxl
RAIZ = os.path.join(os.path.dirname(__file__), "..", "..")
wb = openpyxl.load_workbook(os.path.join(RAIZ, "ICET_Control_Asistencia_Docente_2026.xlsx"))
hoja = lambda n: [[c.value for c in r] for r in wb[n].iter_rows()]

# ---- nombres ficticios: ningún nombre real queda en los datos de prueba
docs = hoja("Docentes")
cab = docs[0]
iN, iNivel, iNom = cab.index("n"), cab.index("nivel"), cab.index("nombre_completo")
cont, etiqueta = {}, {}
for r in docs[1:]:
    cont[r[iNivel]] = cont.get(r[iNivel], 0) + 1
    etiqueta[r[iNom]] = f"Docente demo {str(r[iNivel])[:3]} {cont[r[iNivel]]:02d}"
real_a_n = {r[iNom]: r[iN] for r in docs[1:]}
# alias para las pruebas: A = primaria (Escobar), B = secundaria con clase el viernes (Cuero Rincón), C = primaria (Sinisterra)
ALIAS = {"A": etiqueta["Escobar Cortés Liliana"], "B": etiqueta["Cuero Rincón Hernando Jesús"], "C": etiqueta["Sinisterra Ana Lucía"]}
import re
_pat = re.compile("|".join(re.escape(k) for k in sorted(etiqueta, key=len, reverse=True)))
anon = lambda v: _pat.sub(lambda m: etiqueta[m.group(0)], v) if isinstance(v, str) else v   # también dentro de textos compuestos
out = {n: [[anon(c) for c in f] for f in hoja(n)] for n in ["Horario", "Docentes", "Motivos", "Directivos", "Novedades", "Registro_Ronda", "Franjas", "Grupos", "Direccion_Grupo", "Listas", "Usuarios", "Soportes", "Parametros"]}
hdr = out["Novedades"][0]
def fila(**k):
    return [k.get(h) for h in hdr]
out["Novedades"] = [hdr,
    fila(**{"Marca temporal": "a", "Fecha Novedad": "2/10/2026", "Docente": ALIAS["A"], "Tipo Novedad": "No asistió", "Motivo Ausencia": "Calamidad familiar", "Grado": "05", "Grupo": "4", "Área/Asignatura": "ÁREAS MÚLTIPLES", "Minutos Desatendidos": 270, "Directivo Docente": "Francisco Cortés"}),
    fila(**{"Marca temporal": "b", "Fecha Novedad": "2026-10-02", "Docente": ALIAS["B"], "Tipo Novedad": "Llegada tarde", "Motivo Ausencia": "Sin justificación", "Grado": "06", "Grupo": "2", "Área/Asignatura": "TEI", "Minutos Desatendidos": 15, "Directivo Docente": "Francisco Cortés", "Justificada": "No", "Categoría motivo": "SIN JUSTIFICACIÓN"}),
    fila(**{"Marca temporal": "c", "Fecha Novedad": "1/10/2026", "Docente": ALIAS["C"], "Tipo Novedad": "No asistió", "Motivo Ausencia": "Permiso del rector", "Grado": "01", "Grupo": "2", "Área/Asignatura": "ÁREAS MÚLTIPLES", "Minutos Desatendidos": 45, "Directivo Docente": "Rector"})]
out["Registro_Ronda"] = [out["Registro_Ronda"][0]]
# columnas de nombre separadas (apellidos, nombres) y direcciones de grupo también se anonimizan
d2 = out["Docentes"]
for r in d2[1:]:
    r[cab.index("apellidos")] = r[iNom]; r[cab.index("nombres")] = ""
out["Direccion_Grupo"] = [[anon(c) for c in f] for f in out["Direccion_Grupo"]]
dg = out["Direccion_Grupo"]; i1, i2, iD = dg[0].index("docente_1"), dg[0].index("docente_2"), dg[0].index("dinamizadores")
for r in dg[1:]:
    r[iD] = " / ".join(x for x in (r[i1], r[i2]) if x)   # reemplaza los nombres abreviados por los ficticios
for r in out["Docentes"][1:]:
    r[cab.index("nota")] = "(nota omitida en datos de prueba)" if r[cab.index("nota")] else r[cab.index("nota")]
out["_alias"] = ALIAS
json.dump(out, open(os.path.join(os.path.dirname(__file__), "hojas.json"), "w", encoding="utf-8"), default=str, ensure_ascii=False)
print("hojas.json listo")
