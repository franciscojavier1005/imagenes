"""Intercambia en data/horario_maestro.csv el horario de Educación Física (ERD) entre el Docente 1 y el Docente 2.
Antes: Arizala Castro Roberto Carlos (docente_n 4) y Armero Dájome Jesús (57, reemplazo de Terán). El rector los cambió sin avisar:
ahora Armero ocupa el horario ERD que figuraba como de Arizala (Docente 1) y Arizala el que figuraba como de Armero/Terán (Docente 2).
Por defecto solo se mueven las filas de área ERD (clases y énfasis); la clase de CNA de Arizala se queda con él. Con --todo se
intercambia el horario completo de los dos (como se hizo con Arte). OJO: solo-ERD deja 8 sesiones de Arizala con ERD y CNA a la vez. Se puede ejecutar una sola vez
(si ya se hizo, no cambia nada). Autor: Francisco Javier Cortés Cabezas, I.E. ICET, Tumaco."""
import csv, sys, os
ruta = os.path.join(os.path.dirname(__file__), '..', 'data', 'horario_maestro.csv')
A = ('4', 'Arizala Castro Roberto Carlos'); B = ('57', 'Armero Dájome Jesús')
LT = '\r\n' if b'\r\n' in open(ruta, 'rb').read(2000) else '\n'   # conserva el fin de línea del archivo
with open(ruta, encoding='utf-8-sig', newline='') as f:
    lector = csv.DictReader(f); cab = lector.fieldnames; filas = list(lector)
if any(r['docente_n'] == A[0] and r['area'] == 'ERD' and r['grupo'] == '0702' for r in filas):   # el 0702 es de Armero antes del cambio
    print('Ya estaba intercambiado: no se cambia nada.'); sys.exit(0)
mov = 0
for r in filas:
    if r['area'] != 'ERD' and '--todo' not in sys.argv: continue
    if r['docente_n'] == A[0]: r['docente_n'], r['docente'] = B; mov += 1
    elif r['docente_n'] == B[0]: r['docente_n'], r['docente'] = A; mov += 1
with open(ruta, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cab, lineterminator=LT); w.writeheader(); w.writerows(filas)
print('Filas ERD intercambiadas:', mov)
