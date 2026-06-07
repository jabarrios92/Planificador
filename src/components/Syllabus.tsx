import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle, Sparkles, BookOpen, Calendar } from 'lucide-react';
import { Topic, UserTopicProgress, SpecialtyConfig, StudyStatus } from '../types';
import { INITIAL_TOPICS, SPECIALTIES } from '../data/topics';
import * as LucideIcons from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const AnyDraggable = Draggable as any;

interface DragHandleWithProgressProps {
  id: string;
  dragHandleProps: any;
  large?: boolean;
  unlockedDragId: string | null;
  setUnlockedDragId: (id: string | null) => void;
  disabled?: boolean;
}

const DragHandleWithProgress = ({
  id,
  dragHandleProps,
  large = false,
  unlockedDragId,
  setUnlockedDragId,
  disabled = false,
}: DragHandleWithProgressProps) => {
  const isUnlocked = unlockedDragId === id;
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimerRef = React.useRef<any>(null);
  const progressIntervalRef = React.useRef<any>(null);

  const startHolding = (e: any) => {
    if (disabled || isUnlocked) return;
    setHolding(true);
    setProgress(0);
    
    const totalTime = 600; // ms to unlock drag
    const step = 30;
    let current = 0;

    holdTimerRef.current = setTimeout(() => {
      setUnlockedDragId(id);
      setHolding(false);
      setProgress(0);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch (err) {}
      }
    }, totalTime);

    progressIntervalRef.current = setInterval(() => {
      current += step;
      const pct = Math.min(100, Math.round((current / totalTime) * 100));
      setProgress(pct);
      if (current >= totalTime) {
        clearInterval(progressIntervalRef.current);
      }
    }, step);
  };

  const stopHolding = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setHolding(false);
    setProgress(0);
  };

  React.useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  if (disabled) {
    return (
      <div className="opacity-0 pointer-events-none w-0 h-0 overflow-hidden" {...dragHandleProps} />
    );
  }

  const gripClass = large
    ? `relative p-1.5 rounded-lg transition-all flex items-center justify-center select-none shrink-0 ${
        isUnlocked 
          ? 'text-indigo-400 bg-indigo-500/10 cursor-grab active:cursor-grabbing border border-indigo-500/30 ring-2 ring-indigo-500/40' 
          : 'text-slate-500 hover:text-slate-300 cursor-pointer hover:bg-slate-700/35'
      }`
    : `relative p-1 px-1.5 rounded-md transition-all flex items-center justify-center select-none shrink-0 ${
        isUnlocked 
          ? 'text-indigo-400 bg-indigo-500/15 cursor-grab active:cursor-grabbing border border-indigo-500/35 ring-1 ring-indigo-500/30' 
          : 'text-slate-600 hover:text-slate-400 cursor-pointer hover:bg-slate-750'
      }`;

  return (
    <div
      onMouseDown={startHolding}
      onMouseUp={stopHolding}
      onMouseLeave={stopHolding}
      onTouchStart={startHolding}
      onTouchEnd={stopHolding}
      onTouchCancel={stopHolding}
      {...dragHandleProps}
      className={gripClass}
      style={{ touchAction: 'none' }}
      title={isUnlocked ? "Listo para mover - arrastra ahora" : "Mantén presionado para habilitar mover"}
    >
      {holding && (
        <span className="absolute inset-x-0 bottom-0 rounded-b bg-indigo-500/15 flex items-end overflow-hidden h-1">
          <span 
            className="bg-indigo-500 h-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </span>
      )}
      
      {isUnlocked ? (
        <LucideIcons.GripVertical className={`${large ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-indigo-400 animate-pulse`} />
      ) : (
        <LucideIcons.GripVertical className={`${large ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-500/80 hover:text-slate-300 transition-colors`} />
      )}
    </div>
  );
};

interface SyllabusProps {
  topics: Topic[];
  topicsProgress: Record<string, UserTopicProgress>;
  selectedTopicId: string | null;
  onSelectTopic: (topicId: string) => void;
  specialtyOrder?: string[];
  onAddTopic?: (title: string, specialty: string) => void;
  onDeleteTopic?: (topicId: string) => void;
  onResetSpecialty?: (specialtyName: string) => void;
  onSpecialtyOrderChange?: (newOrder: string[]) => void;
  onTopicsChange?: (newTopics: Topic[]) => void;
  onSetTopicPriority?: (topicId: string, priority: 'Alta' | 'Media' | 'Baja' | null) => void;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
}

export default function Syllabus({ 
  topics, 
  topicsProgress, 
  selectedTopicId, 
  onSelectTopic, 
  specialtyOrder, 
  onAddTopic,
  onDeleteTopic,
  onResetSpecialty,
  onSpecialtyOrderChange,
  onTopicsChange,
  onSetTopicPriority,
  searchQuery,
  onSearchQueryChange
}: SyllabusProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const currentSearchQuery = searchQuery !== undefined ? searchQuery : localSearchQuery;
  const setCurrentSearchQuery = (searchQuery !== undefined && onSearchQueryChange) ? onSearchQueryChange : setLocalSearchQuery;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [expandedSpecialties, setExpandedSpecialties] = useState<Record<string, boolean>>({});
  const [compactView, setCompactView] = useState(false);

  const [activeMenuSpecialty, setActiveMenuSpecialty] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
  const [unlockedDragId, setUnlockedDragId] = useState<string | null>(null);

  // Find a topic scheduled for today, or if none, find the last scheduled/studied one.
  const getSgAndTodayTopic = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Scheduled for today or past due and not completed
    const scheduledToday = topics.filter(t => {
      const prog = topicsProgress[t.id];
      return prog && prog.nextReviewDate && prog.nextReviewDate <= todayStr && prog.status !== 'Dominado';
    });
    
    if (scheduledToday.length > 0) {
      return { topic: scheduledToday[0], isScheduledToday: true };
    }
    
    // 2. If nothing scheduled for today, get the "last scheduled" overall or last studied
    let latestTopic: Topic | null = null;
    let latestTime = 0;
    
    topics.forEach(t => {
      const prog = topicsProgress[t.id];
      if (prog) {
        const nextTime = prog.nextReviewDate ? new Date(prog.nextReviewDate).getTime() : 0;
        const lastTime = prog.lastReviewedAt ? new Date(prog.lastReviewedAt).getTime() : 0;
        const maxTime = Math.max(nextTime, lastTime);
        if (maxTime > latestTime) {
          latestTime = maxTime;
          latestTopic = t;
        }
      }
    });
    
    return { 
      topic: latestTopic || topics[0] || null, 
      isScheduledToday: false 
    };
  };

  const { topic: recommendedTopic, isScheduledToday } = getSgAndTodayTopic();

  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicSpecialty, setNewTopicSpecialty] = useState('');

  const toggleSpecialty = (name: string) => {
    setExpandedSpecialties(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleDragEnd = (result: any) => {
    setUnlockedDragId(null);
    if (!result.destination) return;
    const { source, destination, draggableId, type } = result;

    if (type === 'specialty') {
      if (source.index === destination.index) return;
      const currentSpecialties = [...SPECIALTIES].map(s => s.name);
      const activeOrder = specialtyOrder && specialtyOrder.length > 0 ? [...specialtyOrder] : currentSpecialties;
      const [moved] = activeOrder.splice(source.index, 1);
      activeOrder.splice(destination.index, 0, moved);
      if (onSpecialtyOrderChange) {
        onSpecialtyOrderChange(activeOrder);
      }
      return;
    }

    if (type === 'topic') {
      const sourceSpecialty = source.droppableId.replace('droppable-topics-', '');
      const destSpecialty = destination.droppableId.replace('droppable-topics-', '');
      
      const newTopics = [...topics];
      const draggedTopicIdx = newTopics.findIndex(t => t.id === draggableId);
      if (draggedTopicIdx === -1) return;
      
      const [draggedTopic] = newTopics.splice(draggedTopicIdx, 1);
      
      // Update specialty if it changed!
      if (sourceSpecialty !== destSpecialty) {
        draggedTopic.specialty = destSpecialty;
      }
      
      // Get all topics currently in the destination specialty 
      const destSpecialtyTopics = newTopics.filter(t => t.specialty === destSpecialty);
      
      if (destSpecialtyTopics.length > 0) {
        if (destination.index >= destSpecialtyTopics.length) {
          const lastTopic = destSpecialtyTopics[destSpecialtyTopics.length - 1];
          const lastIdx = newTopics.findIndex(t => t.id === lastTopic.id);
          newTopics.splice(lastIdx + 1, 0, draggedTopic);
        } else {
          const refTopic = destSpecialtyTopics[destination.index];
          const refIdx = newTopics.findIndex(t => t.id === refTopic.id);
          newTopics.splice(refIdx, 0, draggedTopic);
        }
      } else {
        newTopics.push(draggedTopic);
      }
      
      if (onTopicsChange) {
        onTopicsChange(newTopics);
      }
    }
  };

  // Status mapping to Lucide Icons & Colors
  const getStatusIcon = (status: StudyStatus | undefined, isGraduated?: boolean) => {
    if (isGraduated) {
      return <LucideIcons.GraduationCap className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />;
    }
    switch (status) {
      case 'Dominado':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'En Repaso':
        return <ClockIcon className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'Estudiado':
        return <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />;
      default:
        return <Circle className="w-4 h-4 text-slate-700 shrink-0" />;
    }
  };

  // Study progress status strings
  const getStatusBadgeClass = (status: StudyStatus | undefined) => {
    switch (status) {
      case 'Dominado':
        return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'En Repaso':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'Estudiado':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  // Filter topics using props topics
  const filteredTopics = topics.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(currentSearchQuery.toLowerCase()) || 
                          t.specialty.toLowerCase().includes(currentSearchQuery.toLowerCase());
    const progress = topicsProgress[t.id];
    const isGraduated = progress?.isGraduated === true;
    const status = progress ? progress.status : 'Sin Empezar';
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'Graduado') {
        matchesStatus = isGraduated;
      } else {
        matchesStatus = (status === statusFilter) && !isGraduated;
      }
    }
    
    let matchesDifficulty = true;
    if (difficultyFilter !== 'all') {
      matchesDifficulty = !!progress && (
        progress.rating === difficultyFilter ||
        (progress.reviewLog && progress.reviewLog.some(log => log.rating === difficultyFilter))
      );
    }
    
    return matchesSearch && matchesStatus && matchesDifficulty;
  });

  const hasActiveFilters = currentSearchQuery !== '' || statusFilter !== 'all' || difficultyFilter !== 'all';

  // Calculate statistics of completed items per specialty
  const getSpecialtyStats = (specialtyName: string) => {
    const specialtyTopics = topics.filter(t => t.specialty === specialtyName);
    const studiedCount = specialtyTopics.filter(t => {
      const prog = topicsProgress[t.id];
      return prog && (prog.status !== 'Sin Empezar' || prog.isGraduated);
    }).length;
    return {
      studied: studiedCount,
      total: specialtyTopics.length,
      percentage: Math.round((studiedCount / specialtyTopics.length) * 100) || 0
    };
  };

  return (
    <div className="space-y-6">
      {/* Search and filter bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar temas médicos (ej: pancreatitis, sepsis, debilidad)..."
              value={currentSearchQuery}
              onChange={(e) => setCurrentSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {onAddTopic && (
            <button
              onClick={() => setIsAddingTopic(!isAddingTopic)}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs shrink-0 hover:bg-indigo-500 transition-colors"
            >
              + Añadir Tema
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los Estados</option>
              <option value="Sin Empezar">Sin Empezar (Pendientes)</option>
              <option value="Estudiado">Estudiado</option>
              <option value="En Repaso">En Repaso</option>
              <option value="Dominado">👨‍⚕️ Dominados</option>
              <option value="Graduado">🎓 Graduados (Bóveda)</option>
            </select>

            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Todas las Dificultades</option>
              <option value="Otra vez">🔴 Histórico Otra vez</option>
              <option value="Difícil">🟠 Histórico Difícil</option>
              <option value="Bien">🔵 Histórico Bien</option>
              <option value="Fácil">🟢 Histórico Fácil</option>
            </select>
          </div>

          {/* Results count pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCompactView(!compactView)}
              className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                compactView 
                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={compactView ? "Desactivar vista compacta" : "Activar vista compacta"}
            >
              <LucideIcons.List className="w-4 h-4" />
              <span className="text-[10px] font-medium hidden sm:inline">
                {compactView ? "Compacta" : "Normal"}
              </span>
            </button>
            <div className="text-[10px] text-slate-400 font-bold bg-indigo-500/10 border border-indigo-500/10 px-2.5 py-1 rounded-full">
              Filtrados: <span className="text-indigo-400 font-bold">{filteredTopics.length}</span> de <span className="text-slate-300">{topics.length}</span>
            </div>
          </div>
        </div>
      </div>

      {isAddingTopic && onAddTopic && (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
          <h4 className="text-sm font-bold text-white leading-none">Añadir Nuevo Tema</h4>
          <p className="text-xs text-slate-400">Agrega libremente los temas o subtemas que desees para estudiar en un futuro.</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <input 
              type="text" 
              placeholder="Nombre del tema (Ej: Dengue Clásico)..."
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input 
              type="text" 
              placeholder="Especialidad (Ej: Infectología)..."
              value={newTopicSpecialty}
              onChange={(e) => setNewTopicSpecialty(e.target.value)}
              list="specialty-suggestions"
              className="w-full sm:w-48 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <datalist id="specialty-suggestions">
              {Array.from(new Set(topics.map(t => t.specialty))).map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button 
              onClick={() => {
                if (newTopicTitle.trim() && newTopicSpecialty.trim()) {
                  onAddTopic(newTopicTitle.trim(), newTopicSpecialty.trim());
                  setNewTopicTitle('');
                  setNewTopicSpecialty('');
                  setIsAddingTopic(false);
                }
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Course specialties cards list */}
      <div className="space-y-4">
        {/* Dynamic welcome greeting banner with topic of the day */}
        {recommendedTopic && (
          <div 
            onClick={() => onSelectTopic(recommendedTopic.id)}
            className={`p-5 bg-gradient-to-br from-[#807BD2]/15 via-slate-550/0 to-[#807BD2]/22 dark:from-[#807BD2]/22 dark:via-transparent dark:to-[#807BD2]/30 border border-[#807BD2]/25 dark:border-[#807BD2]/20 rounded-2xl cursor-pointer hover:border-[#807BD2]/45 dark:hover:border-[#807BD2]/40 hover:shadow-lg hover:shadow-[#807BD2]/5 transition-all duration-300 space-y-2.5 shadow-md relative overflow-hidden group ${
              selectedTopicId === recommendedTopic.id ? 'ring-1 ring-[#807BD2]/50 bg-slate-50/20 dark:bg-slate-900/10' : ''
            }`}
          >
            {/* Subtle decorative background light */}
            <div className="absolute -right-12 -top-12 w-24 h-24 bg-[#807BD2]/15 dark:bg-[#807BD2]/20 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-widest text-black dark:text-[#a5a1f6] bg-[#807BD2]/12 border border-[#807BD2]/20 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 animate-pulse">
                <Sparkles className="w-3 h-3 text-black dark:text-[#a5a1f6] shrink-0" />
                {isScheduledToday ? 'Tema Agendado para Hoy' : 'Último Tema Agendado'}
              </span>
              <span className="text-[9px] uppercase font-bold tracking-wider text-black dark:text-slate-400">
                Bienvenida ✨
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-black dark:text-slate-300 font-mono tracking-widest leading-none uppercase mb-2">
                CONTINUAR CON EL ESTUDIO DE:
              </p>
              <h4 className="text-2xl font-serif font-medium text-black dark:text-white tracking-tight leading-snug group-hover:text-[#6e68d3] dark:group-hover:text-[#a6a1fb] transition-colors">
                {recommendedTopic.title}
              </h4>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[9px] text-black dark:text-[#a5a1f6] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border border-slate-300 dark:border-[#a5a1f6]/30">
                  {recommendedTopic.specialty}
                </span>
                {topicsProgress[recommendedTopic.id] && (
                  <span className="text-[9px] font-bold text-black dark:text-slate-400">
                    Repasos realizados: {topicsProgress[recommendedTopic.id].repetitionsCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="droppable-specialties" type="specialty">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-4"
              >
                {[...SPECIALTIES]
                  .sort((a, b) => {
                    if (!specialtyOrder) return 0;
                    const idxA = specialtyOrder.indexOf(a.name);
                    const idxB = specialtyOrder.indexOf(b.name);
                    return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
                  })
                  .map((spec, index) => {
                    const stats = getSpecialtyStats(spec.name);
                    // Filter topics belonging to this specialty
                    const specTopics = filteredTopics.filter(t => t.specialty === spec.name);

                    // Hide the entire specialty if there are no matching topics under the current filter
                    if (specTopics.length === 0) return null;

                    // Auto-expand if active filters are applied, otherwise defer to manual click state
                    const isExpanded = hasActiveFilters ? true : !!expandedSpecialties[spec.name];
                    const GroupIcon = (LucideIcons as any)[spec.icon] || BookOpen;

                    return (
                      <AnyDraggable 
                        key={spec.name} 
                        draggableId={spec.name} 
                        index={index}
                        isDragDisabled={hasActiveFilters || unlockedDragId !== spec.name}
                      >
                        {(providedDrag, snapshotDrag) => (
                          <div
                            ref={providedDrag.innerRef}
                            {...providedDrag.draggableProps}
                            className={`bg-transparent border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm ${
                              snapshotDrag.isDragging ? 'ring-1 ring-[#a5a1f6] bg-slate-900 border-[#a5a1f6]/30 scale-[1.012] shadow-xl z-50' : ''
                            }`}
                          >
                            {/* Header trigger */}
                            <div
                              className={`flex items-center justify-between p-4 select-none border-b border-transparent transition-colors hover:bg-slate-900/30 ${
                                isExpanded ? 'bg-slate-900/50 border-slate-800' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {/* DRAG HANDLE FOR SPECIALTY */}
                                <DragHandleWithProgress 
                                  id={spec.name} 
                                  dragHandleProps={providedDrag.dragHandleProps} 
                                  large 
                                  unlockedDragId={unlockedDragId}
                                  setUnlockedDragId={setUnlockedDragId}
                                  disabled={hasActiveFilters}
                                />
                                
                                <div 
                                  onClick={() => !hasActiveFilters && toggleSpecialty(spec.name)}
                                  className={`flex items-center gap-3 ${!hasActiveFilters ? 'cursor-pointer' : ''}`}
                                >
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-transparent border border-slate-800 shrink-0`}>
                                    <GroupIcon className="w-4 h-4 text-[#e2dbea]" />
                                  </div>
                                  <div>
                                    <h4 className="text-[14px] font-serif tracking-widest text-white uppercase">
                                      {spec.name}
                                    </h4>
                                    <span className="text-[10px] text-[#766a87] uppercase font-mono tracking-[0.1em]">
                                      Progreso: {stats.studied} de {stats.total} temas ({stats.percentage}%)
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                {/* Miniature progress pill */}
                                <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                  <div
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                                    style={{ width: `${stats.percentage}%` }}
                                  />
                                </div>
                                {onResetSpecialty && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuSpecialty(spec.name);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-705 rounded-lg transition-all cursor-pointer"
                                    title="Opciones de especialidad"
                                  >
                                    <LucideIcons.MoreVertical className="w-4 h-4" />
                                  </button>
                                )}
                                {!hasActiveFilters && (
                                  <button 
                                    onClick={() => toggleSpecialty(spec.name)}
                                    className="p-1 hover:bg-slate-700/40 rounded transition-colors"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-slate-400 animate-pulse" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-slate-400" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Collapsible Topics Grid / List */}
                            {isExpanded && (
                              <Droppable droppableId={`droppable-topics-${spec.name}`} type="topic">
                                {(providedTopics) => (
                                  <div 
                                    ref={providedTopics.innerRef}
                                    {...providedTopics.droppableProps}
                                    className="divide-y divide-slate-700/80 max-h-[400px] overflow-y-auto bg-slate-900/20"
                                  >
                                    {specTopics.map((topic, tIdx) => {
                                      const progress = topicsProgress[topic.id];
                                      const status = progress ? progress.status : 'Sin Empezar';
                                      const isSelected = selectedTopicId === topic.id;

                                      return (
                                        <AnyDraggable 
                                          key={topic.id} 
                                          draggableId={topic.id} 
                                          index={tIdx}
                                          isDragDisabled={hasActiveFilters || unlockedDragId !== topic.id}
                                        >
                                          {(providedTopic, snapshotTopic) => (
                                            <div
                                              ref={providedTopic.innerRef}
                                              {...providedTopic.draggableProps}
                                              className={`p-3 pl-4 flex items-center justify-between hover:bg-slate-700/50 transition-all ${
                                                isSelected ? 'bg-indigo-900/20 border-l-4 border-indigo-500' : ''
                                              } ${
                                                snapshotTopic.isDragging ? 'bg-slate-950/90 border border-indigo-500/30 scale-[1.015] shadow-2xl z-50' : ''
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 max-w-[75%]">
                                                {/* DRAG HANDLE FOR TOPIC */}
                                                <DragHandleWithProgress 
                                                  id={topic.id} 
                                                  dragHandleProps={providedTopic.dragHandleProps} 
                                                  unlockedDragId={unlockedDragId}
                                                  setUnlockedDragId={setUnlockedDragId}
                                                  disabled={hasActiveFilters}
                                                />
                                                
                                                <div 
                                                  onClick={() => onSelectTopic(topic.id)}
                                                  className="flex items-center gap-2.5 cursor-pointer flex-1"
                                                >
                                                  {getStatusIcon(status, progress?.isGraduated)}
                                                  <div className="space-y-0.5">
                                                    <p className={`text-xs font-semibold ${
                                                      isSelected ? 'text-white' : 'text-slate-200'
                                                    }`}>
                                                      {topic.title}
                                                    </p>
                                                    {!compactView && progress?.nextReviewDate && !progress.isGraduated && (
                                                      <span className="text-[10px] text-amber-500/90 font-medium flex items-center gap-0.5">
                                                        <Calendar className="w-3 h-3 text-amber-500" />
                                                        Próximo: {new Date(progress.nextReviewDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-2 text-right group/topicbtn">
                                                {/* Priority selection dropdown */}
                                                {!compactView && onSetTopicPriority && (
                                                  <select
                                                    value={progress?.priority || ''}
                                                    onChange={(e) => {
                                                      e.stopPropagation();
                                                      onSetTopicPriority(topic.id, e.target.value as any || null);
                                                    }}
                                                    className={`hidden sm:block px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border focus:outline-none ${
                                                      progress?.priority === 'Alta' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                      progress?.priority === 'Media' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                      progress?.priority === 'Baja' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                                      'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                                                    }`}
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <option value="">Prioridad</option>
                                                    <option value="Alta">Alta</option>
                                                    <option value="Media">Media</option>
                                                    <option value="Baja">Baja</option>
                                                  </select>
                                                )}

                                                {/* Mobile priority dot when compact/hidden dropdown */}
                                                {progress?.priority && (compactView || !onSetTopicPriority) && (
                                                  <span className={`w-2 h-2 rounded-full hidden sm:block ${
                                                    progress.priority === 'Alta' ? 'bg-rose-500' :
                                                    progress.priority === 'Media' ? 'bg-amber-500' :
                                                    'bg-sky-500'
                                                  }`} title={`Prioridad ${progress.priority}`} />
                                                )}

                                                {progress?.isGraduated ? (
                                                  <span className="text-[9px] px-2.5 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-bold flex items-center gap-1 shrink-0 animate-pulse">
                                                    🎓 Graduado
                                                  </span>
                                                ) : (
                                                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(status)} shrink-0`}>
                                                    {status}
                                                  </span>
                                                )}
                                                {onDeleteTopic && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      onDeleteTopic(topic.id);
                                                    }}
                                                    className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all cursor-pointer opacity-80 sm:opacity-0 group-hover/topicbtn:opacity-100 focus:opacity-100"
                                                    title="Eliminar tema permanentemente"
                                                  >
                                                    <LucideIcons.Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </AnyDraggable>
                                      );
                                    })}
                                    {providedTopics.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
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
      </div>

      {/* Cupertino Context Style Action Menu for Specialty options */}
      {activeMenuSpecialty && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none"
          onClick={() => setActiveMenuSpecialty(null)}
        >
          <div 
            className="w-full max-w-xs bg-slate-900 border border-slate-750 rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-800 text-center">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Opciones de Especialidad</h4>
              <p className="text-sm font-bold text-white mt-1 leading-snug">{activeMenuSpecialty}</p>
            </div>
            <div className="p-2 space-y-1 bg-slate-900">
              <div className="relative group/tooltip w-full">
                <button
                  onClick={() => {
                    setActiveMenuSpecialty(null);
                    onResetSpecialty?.(activeMenuSpecialty);
                  }}
                  className="w-full flex flex-col gap-0.5 px-4 py-2.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-2xl text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <LucideIcons.RefreshCw className="w-4 h-4 text-rose-500" />
                    Restablecer Especialidad (A Cero)
                  </div>
                  <span className="text-[10px] text-slate-400 pl-7 leading-normal normal-case mt-0.5 font-medium">
                    ⚠️ Impacto: Regresa todos los temas de esta especialidad a 'Sin Empezar' y limpia historiales SRS.
                  </span>
                </button>
              </div>
              
              <button
                onClick={() => {
                  setActiveMenuSpecialty(null);
                  toggleSpecialty(activeMenuSpecialty);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-2xl text-xs font-semibold transition-all cursor-pointer text-left"
              >
                <LucideIcons.BookOpen className="w-4 h-4 text-indigo-400" />
                {expandedSpecialties[activeMenuSpecialty] ? 'Colapsar Especialidad' : 'Expandir Especialidad'}
              </button>
              
              <button
                onClick={() => setActiveMenuSpecialty(null)}
                className="w-full flex items-center justify-center py-3 text-slate-400 hover:text-white hover:bg-slate-850 rounded-2xl text-xs font-medium transition-all cursor-pointer border-t border-slate-800/80 mt-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ClockIcon component fallback inside file to keep compatibility
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
