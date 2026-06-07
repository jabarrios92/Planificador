import React from 'react';
import { ArrowRight, Sparkles, ChevronDown } from 'lucide-react';
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

  return (
    <div className="w-full flex-1 flex flex-col relative -mx-6 -mt-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-b-[40px] min-h-[85vh] flex flex-col border-b border-slate-800/60 shadow-2xl bg-gradient-to-b from-transparent to-slate-950/50">
        {/* Background Graphic elements like orbits */}
        <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-[0.15]">
          <div className="absolute inset-0 rounded-full border border-white" style={{ transform: 'rotateX(75deg) rotateY(15deg)' }} />
          <div className="absolute inset-8 rounded-full border border-dashed border-white" style={{ transform: 'rotateX(70deg) rotateY(25deg)' }} />
          <div className="absolute inset-16 rounded-full border border-white/50" style={{ transform: 'rotateX(60deg) rotateY(10deg)' }} />
          
          <div className="absolute top-1/4 left-[20%] w-3 h-3 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.9)]" />
          <div className="absolute bottom-1/3 right-[30%] w-2 h-2 bg-[#9d8afe] rounded-full shadow-[0_0_12px_rgba(157,138,254,0.9)]" />
          <div className="absolute top-[60%] left-1/4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
        </div>

        <div className="max-w-7xl mx-auto w-full px-6 py-20 flex-1 flex items-center justify-center relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 w-full h-full border-t border-slate-800 pt-16">
            
            {/* Left Column (Main Copy) */}
            <div className="lg:col-span-7 flex flex-col justify-center border-r border-[#ffffff0a] pr-12 lg:pr-24 lg:-ml-6">
              <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-serif text-[#e2dbea] uppercase tracking-wide leading-[1.1] mb-10 drop-shadow-lg">
                Prepárate para<br />
                <span className="italic font-light text-[#a5a1f6] tracking-tight transform -skew-x-6 inline-block">destacar</span>
              </h1>
              <p className="text-[#a79cb8] font-medium leading-relaxed max-w-md text-sm sm:text-[15px] mb-14 drop-shadow-md">
                Imagina el día de tu examen. Te sientas frente a la pantalla y reconoces cada patrón clínico al instante. El conocimiento fluye con absoluta certeza gracias a un estudio enfocado, basado en evidencia y repetición espaciada inteligente.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <button 
                  onClick={() => onNavigate('syllabus')}
                  className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full border border-slate-700 hover:border-white text-white font-mono uppercase tracking-[0.2em] text-[10px] transition-all group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-white/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                  <span className="relative z-10">INICIAR SESIÓN</span>
                  <ArrowRight className="w-3.5 h-3.5 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </div>
            </div>

            {/* Right Column (Info / Stats) */}
            <div className="lg:col-span-5 flex flex-col justify-between pl-0 lg:pl-12 relative h-full min-h-[300px]">
              <div className="absolute right-0 top-0 text-[10px] font-mono text-[#766a87] tracking-[0.2em]">
                → {new Date().toISOString().slice(0, 10).replace(/-/g, '.')}
              </div>
              
              <div className="space-y-16 mt-8 flex-1 flex flex-col justify-center">
                <div className="group cursor-pointer" onClick={() => onNavigate('syllabus')}>
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#766a87] mb-4 flex items-center gap-2">
                    <span className="w-4 h-[1px] bg-[#766a87]"></span> PRÓXIMO TEMA
                  </h3>
                  <p className="text-2xl font-serif text-[#e2dbea] max-w-[280px] leading-tight group-hover:text-white transition-colors">
                    {nextTargetTopic?.title || 'Todos los temas estudiados'}
                  </p>
                  <div className="mt-4 text-[10px] text-[#9d8afe] group-hover:text-[#e2dbea] transition-colors flex items-center gap-2 font-mono tracking-widest uppercase">
                    Ir al temario <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#766a87] mb-3 flex items-center gap-2">
                    <span className="w-4 h-[1px] bg-[#766a87]"></span> DESEMPEÑO
                  </h3>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-serif text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                      {Object.keys(topicsProgress).length}
                    </span>
                    <span className="text-xl font-serif text-[#766a87]">
                      / {topics.length}
                    </span>
                  </div>
                  <p className="text-[9px] text-[#766a87] uppercase font-mono tracking-[0.15em] mt-2">
                    Temas Estudiados en total
                  </p>
                </div>
              </div>
              
              <div className="absolute bottom-0 right-0 text-[9px] font-mono text-[#766a87]/60 tracking-[0.25em]">
                → [SYS.OK]
              </div>
            </div>
          </div>
        </div>

        {/* Scroll down indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-60">
          <span className="text-[8px] font-mono tracking-widest uppercase text-[#a79cb8]">Métricas</span>
          <ChevronDown className="w-4 h-4 text-[#a79cb8]" />
        </div>
      </div>

      {/* Stats Section integrated */}
      <div className="max-w-7xl mx-auto w-full px-6 py-20 relative z-10">
        <div className="mb-12">
          <h2 className="text-3xl font-serif text-[#e2dbea] uppercase tracking-widest mb-2 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#9d8afe]" /> Tu Rendimiento
          </h2>
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#766a87] uppercase">Análisis avanzado de progresos</div>
        </div>
        
        <StudyStats topicsProgress={topicsProgress} />
      </div>
    </div>
  );
}
