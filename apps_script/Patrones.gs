/** GENERADO por scripts/generar_patrones.py desde data/patrones_novedades.json. No edite a mano. */
var PATRONES = {
 "tipos": [
  [
   "Llegada tarde informada",
   "llega(ra|rá)? tarde|llegar(a|á) tarde|llego tarde|se va a demorar|retraso|llegara mas tarde|llego (con )?retraso|llegando tarde|tarde a (su )?clase"
  ],
  [
   "Salida temprana informada",
   "(salir|sale|salio|se retira|retirara|se va|se fue)\\s+(mas\\s+)?(temprano|antes)|salida temprana|permiso para salir|se fue (antes|temprano)|se retiro|salio antes|dejo (el grupo|a los estudiantes)|abandono (el|la) (aula|salon|clase)"
  ],
  [
   "Incumplimiento: no atiende al grupo",
   "vista gorda|esta en el colegio pero no (atiende|dicta|dio clase|esta con)|no (atiende|dicta|esta atendiendo) (al|el|a los|a las) (grupo|curso|estudiantes|ninos|alumnos)|estando en el colegio no|no quiso dar clase|no dio clase estando"
  ],
  [
   "Incumplimiento: despidió a los estudiantes sin autorización",
   "(mando|envio|despacho|devolvio|despidio)\\s+(a\\s+)?(los\\s+)?(estudiantes|ninos|alumnos|muchachos|chicos)\\s+(para\\s+)?(a\\s+)?(la\\s+)?casa|(despidio|despacho) (a )?(los )?(estudiantes|ninos|alumnos)|sin autorizacion.{0,40}(estudiantes|ninos|alumnos).{0,25}casa"
  ],
  [
   "Ausente temporal",
   "permiso (por|de) (una|dos|tres|cuatro|media|\\d+)\\s*(hora|horas|minutos)|permiso por (horas|un rato)|(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?(reunion de (docentes|profesores|area)|comite|consejo|coordinacion|ptafi)|atendiendo (a )?(un|una|el|la|los|las)\\s+(padre|madre|acudiente|estudiante|alumno)|por (una|dos|tres|cuatro|\\d+)\\s*horas?\\b|por (media hora|un rato)|(una|dos|tres|\\d+) horas? para"
  ],
  [
   "No asistió",
   "no (asisti|vien[e]|vendr|va a (venir|asistir)|puede (venir|asistir)|pudo (venir|asistir)|se present|estara|podra|puede ir|fue)|falt(a|o|ara)|ausent|incapacitad|amaneci|no hay clase|no estaba|no estaban|estaba solo|estaban solos|no vino|no vinieron|no la vi|no lo vi|no se encontraba|no esta en (el|su) (aula|salon)|no ha llegado|no llego|no aparecio|no se presento|grupo solo|grupo sin (profesor|profesora|docente)|sin (profesor|profesora|docente)|estudiantes solos|solos en (el|la) (aula|salon|clase)|salon solo"
  ]
 ],
 "motivos": [
  [
   "Incapacidad Médica",
   "SALUD",
   "incapacid|licencia (medica|de maternidad|de paternidad)"
  ],
  [
   "Sepelio o duelo de un familiar",
   "CALAMIDAD DOMÉSTICA",
   "sepelio|velorio|entierro|exequias|funeral|duelo|(asistio|fue|va|van) a (un |el )?(sepelio|velorio|entierro)"
  ],
  [
   "Calamidad familiar",
   "CALAMIDAD DOMÉSTICA",
   "calamidad|falleci|murio|fallecimiento|velorio|sepelio|luto|defuncion|se murio"
  ],
  [
   "Traslado hijo(a) a colegio/médico",
   "CALAMIDAD DOMÉSTICA",
   "llev(ar|o|a|ara)\\s+a\\s+(su|la|el)\\s+(hij|ni)|trasladar a su hij|traslado a su hij"
  ],
  [
   "Salud de hijo(a) o familiar",
   "CALAMIDAD DOMÉSTICA",
   "(hij[oa]s?|esposo|esposa|mama|papa|madre|padre|familiar|nieto|nieta|abuel[oa]).{0,45}(enferm|hospital|urgencia|cirug|medico|clinica|fiebre|accidente|cita)"
  ],
  [
   "Reunión o acto escolar de hijo(a)",
   "CALAMIDAD DOMÉSTICA",
   "reunion de padres|entrega de boletin|entrega de notas de su hij|citacion del colegio|acto (escolar|civico|de grado|de graduacion).{0,30}(hij|su)|graduacion de su hij|hij[oa]s?.{0,30}(reunion|acto escolar|izada)"
  ],
  [
   "Tema académico de hijo(a)",
   "CALAMIDAD DOMÉSTICA",
   "reunion de padres|entrega de boletin|citacion del colegio|hij[oa]s?.{0,30}(colegio|escuela|reunion|matricula|examen|graduacion)"
  ],
  [
   "Exámenes clínicos",
   "SALUD",
   "examen(es)? (medic|clinic)|examenes de laboratorio|laboratorio|resonancia|ecograf|cita medica|cita con (el |la )?(medico|especialista|odontolog)|odontolog|control medico|toma de muestra|rayos x"
  ],
  [
   "Mal estado de salud",
   "SALUD",
   "enferm|malestar|gripa|gripe|fiebre|dolor|vomit|diarrea|mareo|mal de salud|mal estado de salud|problemas? de salud|quebranto|amaneci mal|se siente mal|migra[nñ]a|covid|dengue|alergia|infeccion|se sintio mal"
  ],
  [
   "Permiso del rector",
   "PERMISO INSTITUCIONAL",
   "permiso.{0,30}(rector|rectoria)|(rector|rectoria).{0,30}(autoriz|permiso|aprob)|autorizo el rector"
  ],
  [
   "Permiso por horas (personal)",
   "PERMISO INSTITUCIONAL",
   "permiso (por|de) (una|dos|tres|cuatro|media|\\d+)\\s*(hora|horas|minutos)|permiso por (horas|un rato)"
  ],
  [
   "Evento Secretaría de Educación",
   "EVENTO EXTERNO",
   "secretaria de educacion|\\bsed\\b|comision de servicio|mesa de trabajo|reunion en la secretaria"
  ],
  [
   "Comité o consejo (calidad, académico, convivencia)",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?(comite|consejo)\\b"
  ],
  [
   "Reunión PTAFI con la tutora",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?.{0,25}(ptafi|tutora)"
  ],
  [
   "Reunión de docentes o de área",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?reunion de (docentes|profesores|area)"
  ],
  [
   "Atención a padre de familia o acudiente",
   "ACTIVIDAD INSTITUCIONAL",
   "atendiendo (a )?(un|una|el|la|los|las)\\s+(padre|madre|acudiente)|atencion a (padres|acudiente)"
  ],
  [
   "Reunión de cierre de jornada",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?(reunion|jornada) de cierre|reunion de cierre"
  ],
  [
   "Atención en coordinación (estudiante o acudiente)",
   "ACTIVIDAD INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en|con)\\s+(la\\s+|el\\s+|una\\s+|un\\s+)?coordinacion|atendiendo (a )?(un|una)\\s+(estudiante|alumno)"
  ],
  [
   "Reunión o actividad institucional",
   "PERMISO INSTITUCIONAL",
   "(esta|estan|estuvo|salio|fue|fueron|va|van|asiste|asisten)\\s+(a|en)\\s+(la\\s+|una\\s+)?(reunion|consejo|comite|comision)\\b.{0,25}(institucional|de area|de docentes|academic|directiv|evaluacion|promocion)|actividad institucional|acto civico institucional"
  ],
  [
   "Capacitación/Taller",
   "EVENTO EXTERNO",
   "capacitacion|taller|formacion|seminario|diplomado|\\bforo\\b|jornada pedagogica|encuentro"
  ],
  [
   "Tema académico del docente",
   "ACADÉMICO DEL DOCENTE",
   "universidad|doctorado|maestria|posgrado|sustentacion|clase presencial|tutoria de tesis|encuentro tutorial"
  ],
  [
   "Remisión otra ciudad",
   "TRASLADO",
   "remision|remitid|remiti|\\bcali\\b|\\bpasto\\b|bogota|medellin|viaje|otra ciudad|se traslado a|desplaz"
  ],
  [
   "Lluvia intensa o emergencia climática",
   "FORTUITO",
   "lluvia (intensa|fuerte)|aguacero|inundacion|temporal de lluvia|emergencia climatica|tormenta|derrumbe"
  ],
  [
   "Situación fortuita camino al trabajo",
   "FORTUITO",
   "camino al (trabajo|colegio)|se vario|se varo|llanta|pinch|accidente de transito|trancon|trafico|lancha|marea|derrumbe|lluvia|inundacion|aguacero"
  ]
 ]
};
