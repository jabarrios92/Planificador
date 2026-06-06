import React, { useState, useMemo } from 'react';
import { Topic, UserTopicProgress, StudyConfig, StudyRating } from '../types';
import { Search, GripVertical, Settings2, X, Calendar, RotateCcw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { calculateTopicDates, getWeekdayNameFromDate } from '../utils/srs';

const AnyDraggable = Draggable as any;

const getWeekRangeStr = (mondayStr: string) => {
  if (!mondayStr) return '';
  const parts = mondayStr.split('-');
  if (parts.length !== 3) return '';
  
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1; // months are 0-indexed in JS Date
  const d = Number(parts[2]);
  
  const mon = new Date(y, m, d);
  if (isNaN(mon.getTime())) return '';
  
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  const monDay = String(mon.getDate()).padStart(2, '0');
  const monMonth = months[mon.getMonth()];
  const sunDay = String(sun.getDate()).padStart(2, '0');
  const sunMonth = months[sun.getMonth()];
  const year = mon.getFullYear();
  
  return `${monDay} de ${monMonth} al ${sunDay} de ${sunMonth} de ${year}`;
};

const defaultProgress: UserTopicProgress = {
  topicId: '',
  status: 'Sin Empezar',
  rating: null,
  reviewInterval: 0,
  repetitionsCount: 0,
  lastReviewedAt: null,
  nextReviewDate: null,
  notes: '',
};

interface WeeklyTrackerProps {
  topics: Topic[];
  onTopicsChange: (newTopics: Topic[]) => void;
  studyConfig: StudyConfig;
  onStudyConfigChange: (newConfig: StudyConfig) => void;
  topicsProgress: Record<string, UserTopicProgress>;
  onUpdateTopicTracking: (topicId: string, updates: Partial<UserTopicProgress>) => void;
  onCompleteReview?: (topicId: string, rating: StudyRating) => void;
  specialtyOrder?: string[];
  onSpecialtyOrderChange?: (newOrder: string[]) => void;
  planStartDate?: string;
  onPlanStartDateChange?: (newDate: string) => void;
}

export function WeeklyTracker({ 
  topics, 
  onTopicsChange,
  studyConfig,
  onStudyConfigChange,
  topicsProgress, 
  onUpdateTopicTracking, 
  onCompleteReview,
  specialtyOrder = [], 
  onSpecialtyOrderChange,
  planStartDate = '2026-06-08',
  onPlanStartDateChange
}: WeeklyTrackerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  
  // Outer drag and drop handler representing BOTH specialty list rearranging OR individual topic reordering
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    // Case 1: Specialty dragging
    if (result.source.droppableId === 'specialties') {
      if (!onSpecialtyOrderChange) return;
      const items = Array.from(specialtyOrder);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      onSpecialtyOrderChange(items);
    }
    
    // Case 2: Individual topic dragging
    if (result.source.droppableId === 'topics-list') {
      if (searchQuery) return; // Disable topic dragging while search filter is active to avoid index bugs
      const items = Array.from(topics);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);
      onTopicsChange(items);
    }
  };

  const filteredTopics = useMemo(() => {
    if (!searchQuery) return topics;
    return topics.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.specialty.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [topics, searchQuery]);

  // Calculate dynamic dates for all topics chronologically in the entire plan
  const computedDates = useMemo(() => {
    return calculateTopicDates(topics, topicsProgress, planStartDate, studyConfig);
  }, [topics, topicsProgress, planStartDate, studyConfig]);

  // Derive logical weeks based on actual calendar boundaries (Monday-Sunday)
  const weekMapping = useMemo(() => {
    const mapping: Record<string, { weekIndex: number, isFirstInWeek: boolean, weekStartStr: string }> = {};
    let currentWeekIndex = 0;
    let lastWeekMonday = '';

    const getMonday = (dateStr: string) => {
      const parts = dateStr.split('-');
      if(parts.length !== 3) return '';
      const d = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
      if(isNaN(d.getTime())) return '';
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    topics.forEach((topic) => {
      const tDate = computedDates[topic.id];
      if (!tDate) return;
      
      const mon = getMonday(tDate);
      let isFirst = false;

      if (mon !== lastWeekMonday) {
        if (lastWeekMonday !== '') currentWeekIndex++;
        lastWeekMonday = mon;
        isFirst = true;
      }
      mapping[topic.id] = {
        weekIndex: currentWeekIndex,
        isFirstInWeek: isFirst,
        weekStartStr: mon
      };
    });
    return mapping;
  }, [topics, computedDates]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      <div className="p-5 border-b border-slate-800 bg-slate-800/30 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Sincronización Clínica - Tablero de Rendimiento</h3>
            <p className="text-xs text-slate-400">Registra tu asimilación de conceptos (Retención Anki), desempeño práctico (Aciertos en Simulacros) y de distribución de días de estudio.</p>
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg transition-colors border font-bold text-xs flex items-center gap-2 shrink-0 ${
              showConfig ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {showConfig ? <X className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
            {showConfig ? 'Cerrar' : 'Ordenar Especialidades'}
          </button>
        </div>
        
        {/* Double DragDropContext: we handle nesting beautifully by separating specialty block */}
        {showConfig && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
            <div>
              <p className="text-xs font-bold text-white mb-2">Habilitar Estudio en Fines de Semana</p>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`relative w-8 h-4 rounded-full transition-colors ${studyConfig.globalSaturday ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${studyConfig.globalSaturday ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">S (Sábado)</span>
                  <input type="checkbox" className="hidden" checked={studyConfig.globalSaturday} onChange={(e) => onStudyConfigChange({...studyConfig, globalSaturday: e.target.checked})} />
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`relative w-8 h-4 rounded-full transition-colors ${studyConfig.globalSunday ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${studyConfig.globalSunday ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">D (Domingo)</span>
                  <input type="checkbox" className="hidden" checked={studyConfig.globalSunday} onChange={(e) => onStudyConfigChange({...studyConfig, globalSunday: e.target.checked})} />
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-400 mb-2">Arrastra y suelta para priorizar el orden de las áreas en tu estudio semanal.</p>
              <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="specialties" direction="vertical">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {specialtyOrder.map((spec, index) => (
                      <AnyDraggable key={spec} draggableId={spec} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold select-none ${
                              snapshot.isDragging 
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-xl shadow-indigo-500/20 z-50' 
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="truncate">{index + 1}. {spec}</span>
                          </div>
                        )}
                      </AnyDraggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              </DragDropContext>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between border-t border-slate-800/60 pt-4">
          <div className="flex flex-wrap items-center gap-3 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
            <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap">📅 Fecha del Día 1:</span>
            <input 
              type="date"
              value={planStartDate}
              onChange={(e) => onPlanStartDateChange && onPlanStartDateChange(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer text-center"
            />
          </div>
          
          <div className="relative max-w-sm w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transform text-slate-500" />
            <input
              type="text"
              placeholder="Filtrar por tema o especialidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
      
      {/* Dynamic Drag-and-drop study topics grid list */}
      <div className="flex flex-col">
        {/* Row desktop header labels */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-950/40 border-b border-slate-800">
          <div className="col-span-2">Día / Fecha</div>
          <div className="col-span-2">Especialidad</div>
          <div className="col-span-2">Tema del Examen</div>
          <div className="col-span-1 text-center">Anki (%)</div>
          <div className="col-span-1 text-center font-bold">Banco (%)</div>
          <div className="col-span-2 text-center">Planear Repaso (SRS)</div>
          <div className="col-span-2 pl-3">Perla Clínica a Rescatar</div>
        </div>

        {/* Drag and drop for topics sequence rearrangement */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="topics-list" type="TOPIC">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="divide-y divide-slate-800/40"
              >
                {filteredTopics.map((topic, index) => {
                  const prog = topicsProgress[topic.id] || defaultProgress;
                  const ratingScore = prog.rating === 'Fácil' ? 4 : prog.rating === 'Bien' ? 3 : prog.rating === 'Difícil' ? 2 : prog.rating === 'Otra vez' ? 1 : 0;
                  
                  let trafficLightColor = 'bg-slate-800 text-slate-500 border-slate-700';
                  if (ratingScore === 4 || prog.status === 'Dominado') trafficLightColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  else if (ratingScore === 3 || prog.status === 'Estudiado') trafficLightColor = 'bg-sky-500/10 text-sky-450 border-sky-500/20';
                  else if (ratingScore === 2 || prog.status === 'En Repaso') trafficLightColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                  else if (ratingScore === 1) trafficLightColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                  
                  let selectValue = '';
                  if (ratingScore === 4 || prog.status === 'Dominado') selectValue = 'verde';
                  else if (ratingScore === 3) selectValue = 'azul';
                  else if (ratingScore === 2) selectValue = 'naranja';
                  else if (ratingScore === 1) selectValue = 'rojo';

                  const tDate = computedDates[topic.id] || '';
                  const dayName = getWeekdayNameFromDate(tDate);

                  // Logical week bound detection
                  const mapInfo = weekMapping[topic.id] || { weekIndex: Math.floor(index/5), isFirstInWeek: index % 5 === 0, weekStartStr: '' };
                  const isFirstDayOfWeek = mapInfo.isFirstInWeek;
                  const weekIndex = mapInfo.weekIndex;
                  const weekStr = mapInfo.weekStartStr;
                  
                  const activeWeekSat = studyConfig.weekOverrides?.[weekStr]?.saturday ?? studyConfig.globalSaturday;
                  const activeWeekSun = studyConfig.weekOverrides?.[weekStr]?.sunday ?? studyConfig.globalSunday;

                  return (
                    <AnyDraggable key={topic.id} draggableId={topic.id} index={index} isDragDisabled={!!searchQuery}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex flex-col select-none"
                        >
                          {/* Section Week Bar inside draggable flow */}
                          {isFirstDayOfWeek && (() => {
                            const weekTopics = topics.filter(t => weekMapping[t.id]?.weekIndex === weekIndex);
                            const completedInWeek = weekTopics.filter(t => {
                              const p = topicsProgress[t.id];
                              return p && (p.status === 'Dominado' || p.status === 'Estudiado' || p.isGraduated);
                            }).length;
                            const totalInWeek = weekTopics.length;
                            const progressPercentage = totalInWeek > 0 ? Math.round((completedInWeek / totalInWeek) * 100) : 0;
                            
                            return (
                              <div className={`bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border-y border-indigo-500/10 px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-y-3 shadow-inner ${
                                weekIndex > 0 ? 'mt-8 mb-3' : 'mb-3'
                              }`}>
                                <div className="flex flex-col gap-1.5 md:gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full animate-pulse" />
                                    <span className="text-xs md:text-sm font-extrabold text-white tracking-widest uppercase">
                                      Semana {weekIndex + 1}
                                    </span>
                                    {totalInWeek > 0 && (
                                      <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                                        {progressPercentage}% Completado
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 ml-4 leading-none select-none">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    Rango de Fechas: {getWeekRangeStr(weekStr)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/80 p-2 rounded-xl">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1 mr-1">Fines de Semana:</span>
                                  <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-90">
                                    <div className={`relative w-6 h-3 rounded-full transition-colors ${activeWeekSat ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                      <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform ${activeWeekSat ? 'translate-x-[14px]' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400">S (Sáb)</span>
                                    <input 
                                      type="checkbox" 
                                      className="hidden" 
                                      onChange={(e) => onStudyConfigChange({
                                        ...studyConfig, 
                                        weekOverrides: {
                                          ...studyConfig.weekOverrides, 
                                          [weekStr]: { ...studyConfig.weekOverrides?.[weekStr], saturday: e.target.checked }
                                        }
                                      })} 
                                    />
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-90">
                                    <div className={`relative w-6 h-3 rounded-full transition-colors ${activeWeekSun ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                      <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform ${activeWeekSun ? 'translate-x-[14px]' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400">D (Dom)</span>
                                    <input 
                                      type="checkbox" 
                                      className="hidden" 
                                      onChange={(e) => onStudyConfigChange({
                                        ...studyConfig, 
                                        weekOverrides: {
                                          ...studyConfig.weekOverrides, 
                                          [weekStr]: { ...studyConfig.weekOverrides?.[weekStr], sunday: e.target.checked }
                                        }
                                      })} 
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Row grid block */}
                          <div 
                            className={`grid grid-cols-1 lg:grid-cols-12 gap-4 p-5 lg:px-6 lg:py-4 items-center transition-all ${
                              snapshot.isDragging 
                                ? 'bg-slate-950 border-indigo-500/50 shadow-2xl shadow-indigo-500/5 ring-1 ring-indigo-500/20 z-50 scale-[1.015]' 
                                : 'bg-slate-900 hover:bg-slate-800/10'
                            }`}
                          >
                            {/* Col 1: Day Name & Date */}
                            <div className="col-span-1 lg:col-span-2 flex items-center gap-2 md:gap-3">
                              {/* Drag handle ONLY shown if search isn't active */}
                              {!searchQuery ? (
                                <div 
                                  {...provided.dragHandleProps} 
                                  className="p-1 text-slate-500 hover:text-indigo-400 rounded transition-colors cursor-grab active:cursor-grabbing shrink-0"
                                  title="Arrastra para reordenar cronología"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-6 h-4 shrink-0" />
                              )}
                              
                              <div className="flex-1">
                                <span className="font-extrabold text-white text-sm capitalize">{dayName || 'Estudio'}</span>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <input 
                                    type="date"
                                    value={tDate}
                                    onChange={(e) => onUpdateTopicTracking(topic.id, { customStudyDate: e.target.value || undefined })}
                                    className={`bg-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded border focus:outline-none focus:border-indigo-500 max-w-[110px] cursor-pointer ${
                                      prog.customStudyDate 
                                        ? 'text-amber-400 border-amber-500/40 bg-amber-500/5' 
                                        : 'text-indigo-300 border-slate-800 bg-slate-950'
                                    }`}
                                    title={prog.customStudyDate ? "Fecha fijada manualmente" : "Fecha automática"}
                                  />
                                  {prog.customStudyDate && (
                                    <button
                                      onClick={() => onUpdateTopicTracking(topic.id, { customStudyDate: undefined })}
                                      className="p-0.5 hover:bg-slate-800 text-amber-500 hover:text-amber-400 rounded transition-colors cursor-pointer shrink-0"
                                      title="Restablecer a fecha automática"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Specialty custom tag */}
                            <div className="col-span-1 lg:col-span-2">
                              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded w-fit inline-block truncate max-w-full">
                                {topic.specialty}
                              </span>
                            </div>

                            {/* Col 3: Exam Topic Name */}
                            <div className="col-span-1 lg:col-span-2 text-sm font-semibold text-white leading-snug">
                              {topic.title}
                            </div>

                            {/* Col 4: Anki retention score */}
                            <div className="col-span-1 lg:col-span-1 flex items-center justify-between lg:justify-center gap-3">
                              <span className="lg:hidden text-xs text-slate-500 font-medium">Anki:</span>
                              <div className="relative w-20 shrink-0">
                                <input 
                                  type="number" 
                                  min="0" max="100" 
                                  placeholder="--"
                                  value={prog.ankiRetention || ''}
                                  onChange={(e) => onUpdateTopicTracking(topic.id, { ankiRetention: parseInt(e.target.value) || undefined })}
                                  className="w-full pl-2 pr-6 py-1 bg-slate-950 border border-slate-700/80 rounded focus:border-indigo-500 focus:outline-none text-center text-xs font-semibold text-white"
                                />
                                <span className="absolute right-2 top-1.5 text-slate-500 text-[10px] font-bold pointer-events-none">%</span>
                              </div>
                            </div>

                            {/* Col 5: Bank test score */}
                            <div className="col-span-1 lg:col-span-1 flex items-center justify-between lg:justify-center gap-3">
                              <span className="lg:hidden text-xs text-slate-500 font-medium">Banco:</span>
                              <div className="relative w-20 shrink-0">
                                <input 
                                  type="number" 
                                  min="0" max="100" 
                                  placeholder="--"
                                  value={prog.bankScore || ''}
                                  onChange={(e) => onUpdateTopicTracking(topic.id, { bankScore: parseInt(e.target.value) || undefined })}
                                  className="w-full pl-2 pr-6 py-1 bg-slate-950 border border-slate-700/80 rounded focus:border-indigo-500 focus:outline-none text-center text-xs font-semibold text-white"
                                />
                                <span className="absolute right-2 top-1.5 text-slate-500 text-[10px] font-bold pointer-events-none">%</span>
                              </div>
                            </div>

                            {/* Col 6: Color Traffic / Spaced Repetition selector */}
                            <div className="col-span-1 lg:col-span-2 flex flex-col items-stretch lg:items-center justify-center gap-1.5">
                              <div className="flex items-center justify-between lg:justify-center gap-3 w-full">
                                <span className="lg:hidden text-xs text-slate-300 font-bold">Planear Repaso:</span>
                                <select
                                  value={selectValue}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (onCompleteReview) {
                                      if (val === 'verde') onCompleteReview(topic.id, 'Fácil');
                                      else if (val === 'azul') onCompleteReview(topic.id, 'Bien');
                                      else if (val === 'naranja') onCompleteReview(topic.id, 'Difícil');
                                      else if (val === 'rojo') onCompleteReview(topic.id, 'Otra vez');
                                    } else {
                                      let statusUpdates: Partial<UserTopicProgress> = {};
                                      if (val === 'verde') statusUpdates = { rating: 'Fácil', status: prog.status === 'Sin Empezar' ? 'Estudiado' : prog.status };
                                      if (val === 'azul') statusUpdates = { rating: 'Bien', status: prog.status === 'Sin Empezar' ? 'Estudiado' : prog.status };
                                      if (val === 'naranja') statusUpdates = { rating: 'Difícil', status: prog.status === 'Sin Empezar' ? 'Estudiado' : prog.status };
                                      if (val === 'rojo') statusUpdates = { rating: 'Otra vez', status: prog.status === 'Sin Empezar' ? 'Estudiado' : prog.status };
                                      onUpdateTopicTracking(topic.id, statusUpdates);
                                    }
                                  }}
                                  className={`text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none cursor-pointer font-bold select-none ${trafficLightColor} min-w-[120px] w-full`}
                                >
                                  <option value="" className="text-slate-500">Valorar...</option>
                                  <option value="verde" className="text-emerald-500 font-bold">🟢 Fácil (Intérvalo × 3.5)</option>
                                  <option value="azul" className="text-sky-500 font-bold">🔵 Bien (Intérvalo × 2.0)</option>
                                  <option value="naranja" className="text-orange-500 font-bold">🟠 Difícil (Intérvalo × 1.2)</option>
                                  <option value="rojo" className="text-red-500 font-bold">🔴 Otra vez (Mañana 1d)</option>
                                </select>
                              </div>
                              {prog.nextReviewDate && (
                                <div className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/10 text-center w-full lg:max-w-fit truncate">
                                  ⏰ Repaso: {new Date(prog.nextReviewDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                </div>
                              )}
                            </div>

                            {/* Col 7: Golden Pearl Text input */}
                            <div className="col-span-1 lg:col-span-2">
                              <input 
                                type="text" 
                                placeholder="Anota tu perla clínica aquí..."
                                value={prog.clinicalPearl || ''}
                                onChange={(e) => onUpdateTopicTracking(topic.id, { clinicalPearl: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg focus:border-indigo-500 focus:outline-none text-xs text-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </AnyDraggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {filteredTopics.length === 0 && (
          <div className="p-12 text-center text-slate-500 bg-slate-900/50">
            No se encontraron temas para los filtros actuales.
          </div>
        )}
      </div>
    </div>
  );
}
