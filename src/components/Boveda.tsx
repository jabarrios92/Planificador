import React, { useState, useMemo } from 'react';
import { Search, GraduationCap, ChevronDown, ChevronRight, Award, Trash2, Calendar, BookOpen, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { Topic, UserTopicProgress } from '../types';
import { SPECIALTIES } from '../data/topics';
import * as LucideIcons from 'lucide-react';

interface BovedaProps {
  topics: Topic[];
  topicsProgress: Record<string, UserTopicProgress>;
  onSelectTopic: (topicId: string, tab: 'syllabus') => void;
  onRemoveGraduation?: (topicId: string) => void;
}

export default function Boveda({ topics, topicsProgress, onSelectTopic, onRemoveGraduation }: BovedaProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSpecialties, setExpandedSpecialties] = useState<Record<string, boolean>>({});

  const toggleSpecialty = (name: string) => {
    setExpandedSpecialties(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Filter graduated topics
  const graduatedTopics = useMemo(() => {
    return topics.filter(t => {
      const prog = topicsProgress[t.id];
      const isGrad = prog?.isGraduated === true;
      
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.specialty.toLowerCase().includes(searchQuery.toLowerCase());
      
      return isGrad && matchesSearch;
    });
  }, [topics, topicsProgress, searchQuery]);

  const hasSearch = searchQuery !== '';

  const getTrendBadge = (trend?: string) => {
    switch (trend) {
      case 'Mejorando':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
            ● Mejorando
          </span>
        );
      case 'Estable':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/25 px-2 py-0.5 rounded-full">
            ● Estable
          </span>
        );
      case 'Requiere Atención':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-full">
            ● Requiere Atención
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
            ● Nuevo
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-950 border border-indigo-500/15 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] tracking-wider uppercase">
            <Award className="w-4 h-4 animate-bounce text-indigo-400" />
            La Bóveda de Conocimiento Clínico
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">Tu Academia Personal de Sabiduría Médica</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Aquí residen los temas que has <b>Graduado</b> con éxito tras superar intervalos superiores a 60 días en perfecto desempeño. Conservan sus perlas clínicas recopiladas como consulta inmediata de por vida.
          </p>
        </div>
        <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/10 rounded-2xl text-center min-w-[120px] shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Graduados</span>
          <span className="text-3xl font-extrabold text-white font-mono leading-none">
            {topics.filter(t => topicsProgress[t.id]?.isGraduated).length}
          </span>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-indigo-400/80" />
          <input
            type="text"
            placeholder="Consultar mi biblioteca clínica por nombre o especialidad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner"
          />
        </div>

        {hasSearch && (
          <div className="text-[11px] text-slate-400 font-bold shrink-0 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl">
            🔍 Encontrados: <strong className="text-indigo-400">{graduatedTopics.length}</strong>
          </div>
        )}
      </div>

      {/* Specialties listing */}
      <div className="space-y-4">
        {SPECIALTIES.map((spec) => {
          const specTopics = graduatedTopics.filter(t => t.specialty === spec.name);
          if (specTopics.length === 0) return null;

          const isExpanded = hasSearch ? true : !!expandedSpecialties[spec.name];
          const GroupIcon = (LucideIcons as any)[spec.icon] || BookOpen;

          return (
            <div key={spec.name} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
              {/* Header */}
              <div
                onClick={() => !hasSearch && toggleSpecialty(spec.name)}
                className={`flex items-center justify-between p-4 cursor-pointer select-none transition-colors ${
                  isExpanded ? 'bg-slate-850 border-b border-slate-800' : 'hover:bg-slate-850/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-600/10 border border-indigo-500/15">
                    <GroupIcon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">{spec.name}</h4>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">
                      📚 {specTopics.length} TEMA(S) GRADUADO(S) EN LA BIBLIOTECA
                    </span>
                  </div>
                </div>

                {!hasSearch && (
                  <div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500 animate-pulse" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                )}
              </div>

              {/* Grid of Graduated Topic Cards */}
              {isExpanded && (
                <div className="p-4 bg-slate-950/40 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {specTopics.map((topic) => {
                    const prog = topicsProgress[topic.id];
                    const logs = prog?.reviewLog || [];
                    
                    return (
                      <div 
                        key={topic.id}
                        className="bg-slate-900 border border-slate-800/80 hover:border-indigo-500/25 p-4 rounded-xl space-y-4 relative group flex flex-col justify-between shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                      >
                        {/* Title and Top Attributes */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15">
                              🎓 Graduado
                            </span>
                            <div className="flex items-center gap-1.5">
                              {getTrendBadge(prog?.performanceTrend)}
                              {onRemoveGraduation && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if(confirm('¿Deseas regresar este tema al syllabus activo para volver a planificar repasos?')) {
                                      onRemoveGraduation(topic.id);
                                    }
                                  }}
                                  title="Devolver al Plan de Estudios Activo"
                                  className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <h5 
                            onClick={() => onSelectTopic(topic.id, 'syllabus')}
                            className="text-xs font-bold text-white hover:text-indigo-400 cursor-pointer hover:underline transition-all line-clamp-2"
                          >
                            {topic.title}
                          </h5>
                        </div>

                        {/* Golden Pearl section */}
                        {prog?.clinicalPearl ? (
                          <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1 relative">
                            <div className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wide flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-300 shrink-0" />
                              Perla Clínica Rescatada:
                            </div>
                            <p className="text-[10px] text-slate-300 italic font-medium leading-relaxed leading-normal line-clamp-3">
                              "{prog.clinicalPearl}"
                            </p>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-600 font-medium italic p-2 border border-dashed border-slate-800 rounded-lg text-center">
                            Aún no registraste ninguna perla clínica para este tema.
                          </div>
                        )}

                        {/* Small Timeline of reviews */}
                        <div className="space-y-2 border-t border-slate-800/60 pt-3">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                            Historial de Repasos ({logs.length})
                          </span>
                          {logs.length > 0 ? (
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full custom-scrollbar">
                              {logs.slice(-4).map((log, lIdx) => (
                                <div 
                                  key={lIdx} 
                                  className="text-[9px] font-bold bg-slate-950 border border-slate-800 rounded px-2 py-1 flex items-center gap-1 shrink-0"
                                >
                                  <span className={
                                    log.rating === 'Fácil' ? 'text-emerald-400' :
                                    log.rating === 'Bien' ? 'text-sky-400' :
                                    log.rating === 'Difícil' ? 'text-orange-400' : 'text-red-400'
                                  }>
                                    {log.rating === 'Fácil' ? '🟢' : log.rating === 'Bien' ? '🔵' : log.rating === 'Difícil' ? '🟠' : '🔴'}
                                  </span>
                                  <span className="text-slate-400">{log.date}</span>
                                  <span className="text-slate-500 font-mono">({log.elapsedDays}d)</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-600 font-medium italic block">Sin registros en formato de log de repasos.</span>
                          )}
                        </div>

                        {/* Consultation Button */}
                        <button
                          onClick={() => onSelectTopic(topic.id, 'syllabus')}
                          className="w-full mt-2 py-2 bg-slate-800 hover:bg-slate-750 text-[10px] text-indigo-300 font-bold rounded-lg border border-indigo-500/10 cursor-pointer transition-all hover:border-indigo-500/30 flex items-center justify-center gap-2"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Consultar en Syllabus / Chat Mentor
                        </button>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {graduatedTopics.length === 0 && (
          <div className="py-16 text-center text-slate-600 bg-slate-900 border border-indigo-500/5 max-w-xl mx-auto rounded-3xl space-y-3">
            <GraduationCap className="w-12 h-12 text-slate-600 mx-auto opacity-60" />
            <h4 className="text-sm font-bold text-slate-400">Tu Bóveda se encuentra Desocupada</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Consigue tu primer tema <b>Graduado</b> programando evaluaciones espaciadas (SRS Intérvado &gt; 60 días) y marcándolo como "Fácil" dos veces seguidas para que aparezca aquí automáticamente.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
