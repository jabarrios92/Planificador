import { Topic, SpecialtyConfig } from '../types';

export const SPECIALTIES: SpecialtyConfig[] = [
  { name: 'Cirugía general', icon: 'Scissors', color: 'text-amber-500 border-amber-500/20', bgGradient: 'from-amber-500/10 to-amber-600/5' },
  { name: 'Deportología', icon: 'Activity', color: 'text-emerald-500 border-emerald-500/20', bgGradient: 'from-emerald-500/10 to-emerald-600/5' },
  { name: 'Dermatología', icon: 'Sparkles', color: 'text-rose-400 border-rose-400/20', bgGradient: 'from-rose-400/10 to-rose-500/5' },
  { name: 'Ginecología y Obstetricia', icon: 'HeartHandshake', color: 'text-pink-500 border-pink-500/20', bgGradient: 'from-pink-500/10 to-pink-600/5' },
  { name: 'Medicina interna', icon: 'Stethoscope', color: 'text-sky-500 border-sky-500/20', bgGradient: 'from-sky-500/10 to-sky-600/5' },
  { name: 'Neurología', icon: 'Brain', color: 'text-indigo-400 border-indigo-400/20', bgGradient: 'from-indigo-400/10 to-indigo-500/5' },
  { name: 'Oftalmología', icon: 'Eye', color: 'text-cyan-400 border-cyan-400/20', bgGradient: 'from-cyan-400/10 to-cyan-500/5' },
  { name: 'Ortopedia', icon: 'Bone', color: 'text-blue-500 border-blue-500/20', bgGradient: 'from-blue-500/10 to-blue-600/5' },
  { name: 'Pediatría', icon: 'Baby', color: 'text-violet-500 border-violet-500/20', bgGradient: 'from-violet-500/10 to-violet-600/5' },
  { name: 'Psiquiatría', icon: 'Smile', color: 'text-purple-400 border-purple-400/20', bgGradient: 'from-purple-400/10 to-purple-500/5' },
];

export const INITIAL_TOPICS: Topic[] = [
  // Cirugía general
  { id: 'cg-abdomen-agudo-ulcera', title: 'Abdomen agudo por úlcera péptica perforada', specialty: 'Cirugía general' },
  { id: 'cg-colecistopatias', title: 'Colecistopatías', specialty: 'Cirugía general' },
  { id: 'cg-enfermedad-diverticular', title: 'Enfermedad diverticular', specialty: 'Cirugía general' },
  { id: 'cg-obstruccion-intestinal', title: 'Obstrucción intestinal', specialty: 'Cirugía general' },
  { id: 'cg-pancreatitis-aguda', title: 'Pancreatitis aguda', specialty: 'Cirugía general' },
  { id: 'cg-trauma-abdomen', title: 'Trauma de abdomen', specialty: 'Cirugía general' },
  { id: 'cg-trauma-cuello', title: 'Trauma de cuello', specialty: 'Cirugía general' },
  { id: 'cg-trauma-torax', title: 'Trauma de tórax', specialty: 'Cirugía general' },

  // Deportología
  { id: 'dp-prescripcion-ejercicio', title: 'Prescripción del ejercicio en adultos', specialty: 'Deportología' },

  // Dermatología
  { id: 'dm-urgencias-dermatologia', title: 'Urgencias en dermatología', specialty: 'Dermatología' },

  // Ginecología y Obstetricia
  { id: 'go-anticoncepcion-especial', title: 'Anticoncepción en situaciones especiales', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-diabetes-gestacional', title: 'Diabetes mellitus gestacional', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-etapas-parto', title: 'Etapas y fases del parto', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-hemorragia-postparto', title: 'Hemorragia postparto', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-hepatitis-b-gestacional', title: 'Hepatitis B gestacional', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-sepsis-materna', title: 'Sepsis materna', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-parto-pretermino', title: 'Síndrome de parto pretérmino', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-tamizacion-cervix', title: 'Tamización de lesiones premalignas de cérvix', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-trastornos-hipertensivos', title: 'Trastornos hipertensivos asociados al embarazo', specialty: 'Ginecología y Obstetricia' },
  { id: 'go-ulceras-genitales', title: 'Úlceras genitales', specialty: 'Ginecología y Obstetricia' },

  // Medicina interna
  { id: 'mi-falla-cardiaca', title: 'Actualización en falla cardíaca', specialty: 'Medicina interna' },
  { id: 'mi-bradicardia-urgencias', title: 'Bradicardia en urgencias', specialty: 'Medicina interna' },
  { id: 'mi-cirrosis-hepatica', title: 'Cirrosis hepática y complicaciones', specialty: 'Medicina interna' },
  { id: 'mi-complicaciones-diabetes', title: 'Complicaciones agudas de la diabetes mellitus', specialty: 'Medicina interna' },
  { id: 'mi-diabetes-tipo-2', title: 'Diabetes tipo 2', specialty: 'Medicina interna' },
  { id: 'mi-vih-novo', title: 'Enfoque del paciente con VIH de novo', specialty: 'Medicina interna' },
  { id: 'mi-paciente-obeso', title: 'Evaluación del paciente obeso', specialty: 'Medicina interna' },
  { id: 'mi-hipertension-arterial', title: 'Hipertensión arterial', specialty: 'Medicina interna' },
  { id: 'mi-hipotiroidismo-subclinico', title: 'Hipotiroidismo subclínico', specialty: 'Medicina interna' },
  { id: 'mi-osteoporosis', title: 'Osteoporosis', specialty: 'Medicina interna' },
  { id: 'mi-sindrome-coronario', title: 'Síndrome coronario agudo', specialty: 'Medicina interna' },
  { id: 'mi-valoracion-geriatrica', title: 'Valoración geriátrica integral', specialty: 'Medicina interna' },

  // Neurología
  { id: 'ne-debilidad', title: 'Debilidad', specialty: 'Neurología' },
  { id: 'ne-ecv', title: 'ECV', specialty: 'Neurología' },
  { id: 'ne-epilepsia', title: 'Epilepsia', specialty: 'Neurología' },
  { id: 'ne-infecciones-snc', title: 'Infecciones del SNC', specialty: 'Neurología' },

  // Oftalmología
  { id: 'of-manifestaciones-oculares', title: 'Manifestaciones oculares de enfermedades autoinmunes', specialty: 'Oftalmología' },
  { id: 'of-urgencias-oftalmopediatricas', title: 'Urgencias oftalmopediátricas', specialty: 'Oftalmología' },

  // Ortopedia
  { id: 'or-cojera-nino', title: 'Enfoque del niño con cojera', specialty: 'Ortopedia' },
  { id: 'or-politrauma', title: 'Enfoque del politrauma en adultos', specialty: 'Ortopedia' },
  { id: 'or-trauma-extremidades', title: 'Manejo inicial de trauma de extremidades', specialty: 'Ortopedia' },
  { id: 'or-trauma-raquimedular', title: 'Trauma raquimedular', specialty: 'Ortopedia' },
  { id: 'or-tumores-oseos', title: 'Tumores óseos', specialty: 'Ortopedia' },

  // Pediatría
  { id: 'pd-convulsiones-neonatales', title: 'Convulsiones neonatales', specialty: 'Pediatría' },
  { id: 'pd-dengue', title: 'Dengue', specialty: 'Pediatría' },
  { id: 'pd-nino-alergias', title: 'Enfoque del niño con alergias', specialty: 'Pediatría' },
  { id: 'pd-nino-dolor-articular', title: 'Enfoque del niño con dolor articular', specialty: 'Pediatría' },
  { id: 'pd-nino-via-aerea', title: 'Enfoque del niño con enfermedad de la vía aérea', specialty: 'Pediatría' },
  { id: 'pd-nino-sospecha-epilepsia', title: 'Enfoque del niño con sospecha de epilepsia', specialty: 'Pediatría' },
  { id: 'pd-hipotiroidismo', title: 'Hipotiroidismo en pediatría', specialty: 'Pediatría' },
  { id: 'pd-infeccion-urinaria', title: 'Infección urinaria en pediatría', specialty: 'Pediatría' },
  { id: 'pd-motivos-cirugia-pediatica', title: 'Motivos de consulta en cirugía pediátrica', specialty: 'Pediatría' },
  { id: 'pd-pai-actualizacion', title: 'PAI actualización', specialty: 'Pediatría' },
  { id: 'pd-talla-baja', title: 'Talla baja', specialty: 'Pediatría' },
  { id: 'pd-uso-antibioticos', title: 'Uso racional de antibióticos', specialty: 'Pediatría' },

  // Psiquiatría
  { id: 'ps-autismo', title: 'Autismo', specialty: 'Psiquiatría' },
  { id: 'ps-conducta-suicida', title: 'Conducta suicida', specialty: 'Psiquiatría' },
  { id: 'ps-delirium', title: 'Delirium', specialty: 'Psiquiatría' },
  { id: 'ps-paciente-agitado', title: 'Manejo del paciente agitado', specialty: 'Psiquiatría' },
  { id: 'ps-trastorno-ansiedad', title: 'Trastorno de ansiedad', specialty: 'Psiquiatría' },
  { id: 'ps-trastorno-depresivo', title: 'Trastorno depresivo', specialty: 'Psiquiatría' },
  { id: 'ps-trastornos-psicoticos', title: 'Trastornos psicóticos', specialty: 'Psiquiatría' },
];
