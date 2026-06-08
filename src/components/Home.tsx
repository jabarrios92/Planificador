import React from 'react';
import { ArrowRight, Sparkles, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { Topic, UserTopicProgress } from '../types';
import StudyStats from './StudyStats';

export default function Home({
  topics,
  topicsProgress,
  onNavigate
}: {
  topics: Topic[];
  topicsProgress: Record<string, UserTopicProgress>;
  onNavigate: (tab: 'syllabus' | 'calendar' | 'boveda' | 'profile' | 'home') => void;
}) {
  // Find a topic with status 'pending' (not yet seen)
  const nextTargetTopic = topics.find(t => !topicsProgress[t.id]) || topics[0];

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.9, rotateX: 60, rotateY: 10 },
    show: { opacity: 1, scale: 1, rotateX: 75, rotateY: 15, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div className="w-full flex-1 flex flex-col relative -mx-4 -mt-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-b-[40px] min-h-[65vh] lg:min-h-[75vh] flex flex-col border-b border-slate-800/60 shadow-2xl bg-gradient-to-b from-transparent to-slate-950/50">
        {/* Background Graphic elements like orbits */}
        <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-[0.15]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotateX: 60, rotateY: 10, rotateZ: 0 }}
            animate={{ opacity: 1, scale: 1, rotateX: 75, rotateY: 15, rotateZ: 360 }}
            transition={{
              opacity: { duration: 1.2, ease: "easeOut" },
              scale: { duration: 1.2, ease: "easeOut" },
              rotateX: { duration: 1.2, ease: "easeOut" },
              rotateY: { duration: 1.2, ease: "easeOut" },
              rotateZ: { duration: 60, ease: "linear", repeat: Infinity } 
            }}
            className="absolute inset-0 rounded-full border border-white" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, rotateX: 50, rotateY: 15, rotateZ: 360 }}
            animate={{ opacity: 1, scale: 1, rotateX: 70, rotateY: 25, rotateZ: 0 }}
            transition={{
              opacity: { duration: 1.4, ease: "easeOut", delay: 0.1 },
              scale: { duration: 1.4, ease: "easeOut", delay: 0.1 },
              rotateX: { duration: 1.4, ease: "easeOut", delay: 0.1 },
              rotateY: { duration: 1.4, ease: "easeOut", delay: 0.1 },
              rotateZ: { duration: 80, ease: "linear", repeat: Infinity } 
            }}
            className="absolute inset-8 rounded-full border border-dashed border-white" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.7, rotateX: 40, rotateY: 5, rotateZ: 0 }}
            animate={{ opacity: 1, scale: 1, rotateX: 60, rotateY: 10, rotateZ: 360 }}
            transition={{
              opacity: { duration: 1.6, ease: "easeOut", delay: 0.2 },
              scale: { duration: 1.6, ease: "easeOut", delay: 0.2 },
              rotateX: { duration: 1.6, ease: "easeOut", delay: 0.2 },
              rotateY: { duration: 1.6, ease: "easeOut", delay: 0.2 },
              rotateZ: { duration: 100, ease: "linear", repeat: Infinity } 
            }}
            className="absolute inset-16 rounded-full border border-white/50" 
          />
          
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="absolute top-1/4 left-[20%] w-3 h-3 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9)]" />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="absolute bottom-1/3 right-[30%] w-2 h-2 bg-[#9d8afe] rounded-full shadow-[0_0_12px_rgba(157,138,254,0.9)]" />
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="absolute top-[60%] left-1/4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
        </div>

        <div className="max-w-7xl mx-auto w-full px-6 pt-6 pb-12 sm:pb-16 lg:pt-10 lg:pb-20 flex-1 flex items-center justify-center relative z-10">
          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            animate="show" 
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full h-full pt-4 md:pt-6"
          >
            
            {/* Left Column (Main Copy) */}
            <motion.div variants={fadeUp} className="lg:col-span-6 flex flex-col items-center text-center justify-center lg:border-r border-[#ffffff0a] px-0 lg:pr-12">
              
              <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-serif text-[#e2dbea] uppercase tracking-wide leading-[1.1] mb-10 drop-shadow-lg">
                Prepárate para<br />
                <span className="italic font-light text-[#a5a1f6] tracking-tight transform -skew-x-6 inline-block">destacar</span>
              </h1>
              
              <motion.div variants={fadeUp} className="relative flex justify-center w-full">
                <p className="relative z-10 text-[#a79cb8] font-medium leading-relaxed max-w-sm md:max-w-md text-sm sm:text-[15px] mb-14 drop-shadow-md">
                  Imagina el día de tu examen. Te sientas frente a la pantalla y reconoces cada patrón clínico al instante. El conocimiento fluye con absoluta certeza gracias a un estudio enfocado, basado en evidencia y repetición espaciada inteligente.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-6">
                <button 
                  onClick={() => onNavigate('syllabus')}
                  className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full border border-slate-700 hover:border-white font-mono uppercase tracking-[0.2em] text-[10px] transition-all group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-white/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  <span className="relative z-10">INICIAR SESIÓN</span>
                  <ArrowRight className="w-3.5 h-3.5 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </motion.div>
            </motion.div>

            {/* Right Column (Info / Stats) */}
            <motion.div variants={fadeUp} className="lg:col-span-6 flex flex-col items-center text-center justify-center lg:pl-12 relative h-full min-h-[300px] mt-12 lg:mt-0">
              <motion.div variants={fadeUp} className="lg:absolute right-0 top-0 text-[10px] font-mono text-[#766a87] tracking-[0.2em] mb-8 lg:mb-0">
                → {new Date().toISOString().slice(0, 10).replace(/-/g, '.')}
              </motion.div>
              
              <div className="space-y-8 mt-0 lg:mt-8 flex-1 flex flex-col justify-center w-full items-center">
                <motion.div 
                  variants={fadeUp} 
                  className="group cursor-pointer flex flex-col items-center p-6 bg-slate-900/40 border border-slate-800 rounded-2xl w-full max-w-sm shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg backdrop-blur-sm" 
                  onClick={() => onNavigate('syllabus')}
                >
                  <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#766a87] mb-4 flex items-center gap-2">
                    <span className="w-4 h-[1px] bg-[#766a87]"></span> PRÓXIMO TEMA <span className="w-4 h-[1px] bg-[#766a87]"></span>
                  </h2>
                  <p className="text-xl font-serif text-[#e2dbea] max-w-[280px] leading-tight group-hover:text-white transition-colors">
                    {nextTargetTopic?.title || 'Todos los temas estudiados'}
                  </p>
                  <div className="mt-4 text-[10px] text-[#9d8afe] group-hover:text-[#e2dbea] transition-colors flex items-center gap-2 font-mono tracking-widest uppercase justify-center">
                    Ir al temario <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
                  </div>
                </motion.div>

                <motion.div 
                  variants={fadeUp} 
                  className="flex flex-col items-center p-6 bg-slate-900/40 border border-slate-800 rounded-2xl w-full max-w-sm shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg backdrop-blur-sm"
                >
                  <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#766a87] mb-3 flex items-center gap-2">
                    <span className="w-4 h-[1px] bg-[#766a87]"></span> DESEMPEÑO <span className="w-4 h-[1px] bg-[#766a87]"></span>
                  </h2>
                  <div className="flex items-baseline gap-3 justify-center">
                    <span className="text-5xl font-serif text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                      {Object.keys(topicsProgress).length}
                    </span>
                    <span className="text-xl font-serif text-[#766a87]">
                      / {topics.length}
                    </span>
                  </div>
                  <p className="text-[9px] text-[#766a87] uppercase font-mono tracking-[0.15em] mt-2 text-center">
                    Temas Estudiados en total
                  </p>
                </motion.div>
              </div>
              
              <motion.div variants={fadeUp} className="lg:absolute bottom-0 right-0 text-[9px] font-mono text-[#766a87]/60 tracking-[0.25em] mt-12 lg:mt-0">
                → [SYS.OK]
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll down indicator */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce flex"
        >
          <span className="text-[8px] font-mono tracking-widest uppercase text-[#a79cb8]">Métricas</span>
          <ChevronDown className="w-4 h-4 text-[#a79cb8]" />
        </motion.div>
      </div>

      {/* Stats Section integrated */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-7xl mx-auto w-full px-6 py-20 relative z-10"
      >
        <div className="mb-12">
          <h2 className="text-3xl font-serif text-[#e2dbea] uppercase tracking-widest mb-2 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#9d8afe]" /> Tu Rendimiento
          </h2>
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#766a87] uppercase">Análisis avanzado de progresos</div>
        </div>
        
        <StudyStats topicsProgress={topicsProgress} />
      </motion.div>
    </div>
  );
}
