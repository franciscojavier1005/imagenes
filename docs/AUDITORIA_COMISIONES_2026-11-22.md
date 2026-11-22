# Auditoría de Comisiones de evaluación y promoción — 22 de noviembre de 2026

Sistema de control de asistencia docente · Francisco Javier Cortés Cabezas · I.E. ICET, Tumaco
Alcance: vista previa v60 y servidor (versión 2026.11.22-h).

## Qué se verificó y cómo
- Los 14 grados × 2 periodos (primero y final), cargando el ejemplo completo: sin errores de pantalla, sin pendientes bloqueantes, y el imprimible, el informe general, el informe del docente y el dashboard se arman en todos.
- Orden alfabético por curso y apellidos en reprobación, reconocimientos, convivencia, compromisos y PIAR; sin estudiantes repetidos; acudientes deshabilitado al iniciar.
- Perfil docente: no ve IA, informes directivos, integración ni habilitación.
- Pruebas de mutación (quitar confirmaciones, responsable o lista previa): el sistema las detecta y bloquea el cierre.
- Pruebas del servidor: 19 archivos de pruebas, todos en verde (comisiones: 98 comprobaciones).

## Defecto encontrado y corregido en esta auditoría
- Convivencia, compromisos y PIAR se ordenaban solo por nombre (mezclaban cursos). Ahora van por curso y luego por apellidos (v60).

## Defectos corregidos durante la sesión (ya entregados)
- El Horario del libro usa códigos de área (MAT, CAS, CSI, ETR…) y el servidor los comparaba con los nombres del acta: los docentes de secundaria no podían guardar sus áreas. Corregido (2026.11.22-f).
- Tras imprimir se perdía una marca interna y reaparecía el aviso rojo de JavaScript (v50).
- Los interruptores «Hubo casos» estaban al revés y se veían deshabilitados (v53).
- Los pendientes no se recalculaban al cambiar datos (v55).

## Riesgos y pendientes (en orden de importancia)
1. **No existe la pantalla real** (`?p=comisiones`). El servidor está listo, pero los docentes no pueden usar el módulo en el libro hasta la fase 2.
2. El servidor aún no guarda ni valida la **declaración bajo juramento** ni la **revisión de listados** (solo existen en la vista previa).
3. **Datos del libro por corregir:** dirección de grupo de Prado (CS 1-2) y Puches (7°-2); las notas «OPS» de Terán y Armero en la hoja Docentes.
4. La hoja Estudiantes solo trae nombres: documento, sexo y teléfono del acudiente saldrán como faltantes en quienes se usen en el acta.
5. **ETR** (Ética y Religión) da acceso a ambas áreas al docente que la tiene en el horario; donde alternan es lo esperado, pero conviene confirmarlo.
6. **Privacidad:** el archivo de la vista previa contiene cédulas, celulares y correos institucionales de docentes. No reenviarlo; la pantalla real los cargará del libro según el permiso.
7. **A verificar por el coordinador:** umbrales del semáforo (5/15/30 % y deserción 3/5/8 %) frente al SIEE, y las citas de decretos y leyes (se escribieron de memoria).
8. **Pruebas pendientes en equipos reales:** abrir la vista previa en el Mac M1 con Chrome; la impresión con pie de página en Safari no está garantizada (usar Chrome).
9. Control de asistencia: pantalla de ingreso de docentes con contraseña temporal restablecible por el administrador (después de la fase 2).

## Conclusión
La vista previa y el servidor están consistentes y probados. Se puede continuar con la fase 2 sin cambios de diseño; los puntos 3 y 4 son datos del libro, y 7 y 8 son verificaciones de quien administra.
