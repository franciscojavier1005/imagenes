# Auditoría · Caminar en Secundaria (defecto CS1 con 6.º y CS2 con 8.º) (comisiones)

Fecha: 24 de noviembre de 2026 · versión 2026.11.24-b · Autor del sistema: Francisco Javier Cortés Cabezas.

Revisión hecha sobre los grupos y la dirección de grupo **reales del libro** (lectura, sin modificar nada) y los conteos de la lista de estudiantes (solo cantidades, sin nombres).

## 1. Qué se decidió y cómo quedó

- **Caminar en Secundaria 1 (CS 1-1, CS 1-2) se trabaja dentro del acta de 7.º.**
- **Caminar en Secundaria 2 (CS 2-1, CS 2-2) se trabaja dentro del acta de 9.º.**
- CS 1 y CS 2 ya no son grados aparte en el selector (`COM_UNION` y `comisionGradoActa_` en `Comisiones.gs`).

## 2. Resultado por acta (con los datos reales)

### Acta de 7° Secundaria + Caminar 1

| Curso | Código | Estudiantes en la lista | Director(es) de grupo |
|---|---|---|---|
| CS 1-1 | CS101 | 34 | García Gobea Saydi Magali / Cuero Rincón Hernando Jesús |
| CS 1-2 | CS102 | 35 | Puches Ana Milena / Vásquez Valencia Segundo Leoncio |
| 7°-1 | 0701 | 25 | Castillo Cuero Daira Eneida / Ordóñez Tenorio Jaime Marcial |
| 7°-2 | 0702 | 25 | Quintero Ramírez María del Carmen / Prado Quiñones Genís Maribel |
| 7°-3 | 0703 | 27 | Castillo Angulo Martha Cecilia / Aguirre Riascos Jorge Andrés |
| 7°-4 | 0704 | 26 | Arizala Castro Roberto Carlos / Ramírez Guerra Jimmy Eduardo |
| **Total del acta** | | **172** | |

### Acta de 9° Secundaria + Caminar 2

| Curso | Código | Estudiantes en la lista | Director(es) de grupo |
|---|---|---|---|
| 9°-1 | 0901 | 33 | Estacio Estupiñán Rosario / González Castillo Jólmer Jimy |
| 9°-2 | 0902 | 34 | Bastidas Valencia Zeneida Judith / Villota Rubio Héctor Hugo |
| CS 2-1 | CS201 | 24 | Preciado Torres Oleisa / Ortiz Araujo Adiela Carlota |
| CS 2-2 | CS202 | 29 | Samaniego Angulo Flor Mireya / Cuero Bamba Berte Levi |
| **Total del acta** | | **120** | |

## 3. Comprobaciones

| Verificación | Resultado |
|---|---|
| Todo grupo regular o Caminar pertenece a exactamente un acta | ✔ 33 grupos repartidos en 12 actas (00 a 11) |
| CS 1-1 y CS 1-2 van al acta de 7.º | ✔ |
| CS 2-1 y CS 2-2 van al acta de 9.º | ✔ |
| Ningún estudiante queda en dos actas | ✔ (cada estudiante pertenece a un solo grupo) |
| Total de estudiantes cubiertos por las actas | ✔ 998 de 1045 (los 47 restantes son los grupos de adultos C301 y C501, que no tienen acta) |
| CS 1 y CS 2 ya no aparecen como grados del selector | ✔ (prueba automática `comisiones.test.js`) |
| El acta de 7.º incluye los estudiantes de CS 1 y la de 9.º los de CS 2 | ✔ (prueba automática y simulación con la estructura real) |
| Docentes de las áreas de CS 1 y CS 2 | ✔ salen del Horario de esos grupos y se suman a los de 7.º y 9.º |

## 4. Lo que encontré en el libro y debe saber

1. **Defecto grave encontrado y corregido (grado «05» guardado como 5).** Hojas de cálculo convirtió el código de grado de las actas en número (`5`, `8`, `0`, `2`…). Al volver a abrir, el sistema no reconocía el acta existente y **creaba una nueva y vacía cada vez**: en `Comision_Actas` hay más de 20 actas de 5.º y varias de 2.º, 8.º y 0.º. Lo cargado quedó repartido entre ellas. Desde la versión 2026.11.24-b el grado se guarda como texto, se lee siempre de dos cifras y, si hay varias, se abre la que más trabajo tiene.
2. **Qué hacer con las duplicadas:** menú *Comisiones: unificar actas duplicadas*. Deja vigente, por grado y periodo, la acta con más partes guardadas y oculta las demás (estado DUPLICADA); no borra nada. Antes de aceptar, el menú muestra cuál se queda y cuántas partes tiene cada una; si la que se queda no es la suya, no acepte y avíseme.
3. **Actas abiertas antes bajo CS 2:** hay una (grado `CS2`, 23-nov 10:51, Preciado Torres Oleisa) con una sola parte guardada. Con la versión nueva su grado se lee como 9.º y la herramienta de unificación la trata junto con las demás de 9.º.
4. **Dirección de grupo pendiente de corregir en el libro** (decisión suya anterior): `CS102` figura con docente_1 *Puches Ana Milena* y `0702` con docente_2 *Prado Quiñones Genís Maribel*. Si Prado debe ir en CS 1-2 y Puches en 7.º-2, hay que intercambiarlos en la hoja `Direccion_Grupo` (el sistema no la modifica).
5. Los grupos de adultos **C301 y C501** (47 estudiantes) no pertenecen a ningún acta; si deben trabajar comisión hay que decidir dónde (por ahora quedan fuera).

## 5. Dónde se guarda lo que se aplicó

| Hoja | Qué contiene |
|---|---|
| `Comision_Actas` | una fila por acta (id, año, periodo, grado, estado, quien edita) |
| `Comision_Secciones` | cada parte del acta (columna `json`) con versión, quién y cuándo; ej. `matricula:0501`, `estudiantes:0501`, `areas:Matemáticas`, `recomendaciones:…`, `firmas`, `listos`, `presencia`, `general` |
| `Comision_Log` | bitácora de aperturas, restauraciones y cierres |
| `Comision_Historial` | versiones anteriores de cada parte (8 días) |
| `Comision_CambiosHojas` | cada celda que el acta escribió en otras hojas, con su valor anterior (8 días) |
| `Estudiantes` | documento, tipo, lugar de expedición, sexo, nacionalidad, teléfono del acudiente que se completaron |
| `Identidad_Docentes` | celular, correo personal y cédula completados |
| Drive · APP ASISTENCIA DOCENTE / COMISIONES / Borradores | copia legible (JSON) del acta |

Menú del libro: **Comisiones: ver qué hay guardado (y en qué hoja)** resume por acta cuántas partes hay y cuándo se guardó por última vez.


> **Actualización 2026.11.24-c:** la unión ahora depende del período. En los períodos 1 y 2, CS 1 se integra con 6.º y CS 2 con 8.º; en el período 3 y final, CS 1 con 7.º y CS 2 con 9.º (lo descrito arriba corresponde al período 3 y final).

> **Actualización 2026.11.24-e:** por indicación del coordinador, el defecto pasa a CS 1 con 6.º y CS 2 con 8.º en todos los períodos (configurable por período).
