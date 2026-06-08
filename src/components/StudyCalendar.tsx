import React, { useState, useMemo } from 'react';
import { 
  Calendar as LucideCalendar, ChevronLeft, ChevronRight, CheckCircle2, 
  Clock, CalendarDays, BookOpen, Clock3, AlertCircle, HelpCircle, 
  ChevronDown, ChevronUp, Star, ListTodo, RefreshCcw, Info, Download, Image as ImageIcon, FileText, FileDown
} from 'lucide-react';
import { Topic, UserTopicProgress, ReviewEvent, StudyRating, StudyConfig, CustomTask } from '../types';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { WeeklyTracker } from './WeeklyTracker';
import { DayView } from './DayView';

const AnyDraggable = Draggable as any;
import { calculateTopicDates, formatDateLabel, getRealWaitTimeLabel } from '../utils/srs';

import { exportToICS, exportToImage, exportToPDF } from '../utils/exportCalendar';

export const formatToShortDDMMAA = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parts[0].slice(-2);
    const m = parts[1];
    const d = parts[2];
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

interface StudyCalendarProps {
  topics: Topic[];
  onTopicsChange: (newTopics: Topic[]) => void;
  studyConfig: StudyConfig;
  onStudyConfigChange: (newConfig: StudyConfig) => void;
  topicsProgress: Record<string, UserTopicProgress>;
  reviewEvents: ReviewEvent[];
  onCompleteReview: (topicId: string, rating: StudyRating) => void;
  onUpdateTopicTracking: (topicId: string, updates: Partial<UserTopicProgress>) => void;
  specialtyOrder?: string[];
  onSpecialtyOrderChange?: (newOrder: string[]) => void;
  planStartDate: string;
  onPlanStartDateChange: (newDate: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
}

export default function StudyCalendar({ 
  topics,
  onTopicsChange,
  studyConfig,
  onStudyConfigChange,
  topicsProgress, 
  reviewEvents, 
  onCompleteReview, 
  onUpdateTopicTracking, 
  specialtyOrder = [], 
  onSpecialtyOrderChange,
  planStartDate,
  onPlanStartDateChange,
  searchQuery,
  onSearchQueryChange
}: StudyCalendarProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'tracker'>('monthly');
  const [calendarSubView, setCalendarSubView] = useState<'month' | 'week' | 'agenda' | 'day'>('month');
  const [agendaMonth, setAgendaMonth] = useState<number | 'all'>('all');
  const [showHowToUse, setShowHowToUse] = useState(false);

  // Custom user tasks/notes for calendar days
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(() => {
    const saved = localStorage.getItem('customTasks');
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return [];
  });
  
  const handleCustomTasksChange = (newTasks: CustomTask[]) => {
    setCustomTasks(newTasks);
    localStorage.setItem('customTasks', JSON.stringify(newTasks));
  };


  // Default locking/positioning for June 2026 based on metadata
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // June is index 5
  const [selectedDay, setSelectedDay] = useState<number | null>(8); // Default to June 8th (Monday of Week 1)
  const [specialtyFilters, setSpecialtyFilters] = useState<string[]>([]);
  const [tempSpecialtyFilters, setTempSpecialtyFilters] = useState<string[]>([]);

  // Reference date state for Week View
  const [refWeekDate, setRefWeekDate] = useState<Date>(() => {
    // Start week view around June 8, 2026 (Monday of Week 1)
    return new Date(2026, 5, 8);
  });

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const computedTopicDates = useMemo(() => {
    return calculateTopicDates(topics, topicsProgress, planStartDate, studyConfig);
  }, [topics, topicsProgress, planStartDate, studyConfig]);

  // Reverse mapping for efficient O(1) day lookups
  const studyTopicsByDate = useMemo(() => {
    const map: Record<string, Topic[]> = {};
    Object.entries(computedTopicDates).forEach(([topicId, dateStr]) => {
      const dKey = dateStr as string;
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        if (specialtyFilters.length === 0 || specialtyFilters.includes(topic.specialty)) {
          if (!map[dKey]) map[dKey] = [];
          map[dKey].push(topic);
        }
      }
    });
    return map;
  }, [computedTopicDates, topics, specialtyFilters]);

  const handleMonthDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    
    // source.droppableId is targetDateStr, destination.droppableId is targetDateStr
    // draggableId is topicId
    const targetDateStr = destination.droppableId;
    const sourceDateStr = source.droppableId;

    if (sourceDateStr === targetDateStr) {
      // Reordering within the same day
      const dayTopics = studyTopicsByDate[targetDateStr] || [];
      if (source.index === destination.index) return;
      
      const newTopics = [...topics];
      const sourceTopic = dayTopics[source.index];
      const destTopic = dayTopics[destination.index];
      
      if (!sourceTopic || !destTopic) return;
      
      const sourceGlobalIdx = newTopics.findIndex(t => t.id === sourceTopic.id);
      const destGlobalIdx = newTopics.findIndex(t => t.id === destTopic.id);
      
      const [moved] = newTopics.splice(sourceGlobalIdx, 1);
      newTopics.splice(destGlobalIdx, 0, moved);
      onTopicsChange(newTopics);
      return;
    }

    // Moving to a new day. Update custom study date to pin it.
    onUpdateTopicTracking(draggableId, { customStudyDate: targetDateStr });
    
    // Attempting to move it in array to keep sequential flow logical
    const destDayTopics = studyTopicsByDate[targetDateStr] || [];
    const newTopics = [...topics];
    const sourceGlobalIdx = newTopics.findIndex(t => t.id === draggableId);
    if (sourceGlobalIdx === -1) return;
    
    const [moved] = newTopics.splice(sourceGlobalIdx, 1);
    
    if (destDayTopics.length > 0) {
      let refTopic: Topic | undefined;
      // If dropping at end, put after last topic of that day
      if (destination.index >= destDayTopics.length) {
        refTopic = destDayTopics[destDayTopics.length - 1];
        const refGlobalIdx = newTopics.findIndex(t => t.id === refTopic?.id);
        newTopics.splice(refGlobalIdx + 1, 0, moved);
      } else {
        refTopic = destDayTopics[destination.index];
        const refGlobalIdx = newTopics.findIndex(t => t.id === refTopic?.id);
        newTopics.splice(refGlobalIdx, 0, moved);
      }
    } else {
      // It's empty day, we just append it or logic could get complex so let's just append or keep it.
      // Easiest is to keep its relative index or find chronological spot. Since it's pinned by customStudyDate it strictly anchors.
      // We'll just splice it back where it was to avoid shifting all array unless they explicitly insert between two dates.
      newTopics.splice(sourceGlobalIdx, 0, moved);
    }
    
    onTopicsChange(newTopics);
  };

  // Calendar Helpers for Month Grid
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1; // standard Monday-start formatting adjust
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    setSelectedDay(null);
  };

  // Week navigation helpers
  const handlePrevWeek = () => {
    const d = new Date(refWeekDate);
    d.setDate(d.getDate() - 7);
    setRefWeekDate(d);
  };

  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleExportICS = () => {
    exportToICS(studyTopicsByDate, reviewEvents, customTasks);
    setIsExportMenuOpen(false);
  };

  const handleExportImage = () => {
    exportToImage('exportable-calendar', 'calendario-estudio.png');
    setIsExportMenuOpen(false);
  };

  const handleExportPDF = () => {
    exportToPDF('exportable-calendar', 'calendario-estudio.pdf');
    setIsExportMenuOpen(false);
  };
  
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const handleDayPointerDown = (dayNum: number) => {
    if (calendarSubView === 'month') return;
    longPressTimerRef.current = setTimeout(() => {
      setSelectedDay(dayNum);
      setIsTasksModalOpen(true);
    }, 500);
  };
  const handleDayPointerUpOrLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  const handleDayDoubleClick = (dayNum: number) => {
    setSelectedDay(dayNum);
    setIsTasksModalOpen(true);
  };

  const handleNextWeek = () => {
    const d = new Date(refWeekDate);
    d.setDate(d.getDate() + 7);
    setRefWeekDate(d);
  };

  // Generate 7 days of the active week in Week View
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(refWeekDate);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1) + i); // force start with Monday
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      return {
        date: d,
        dateStr,
        dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        dayNum: d.getDate(),
        monthLabel: d.toLocaleDateString('es-ES', { month: 'short' })
      };
    });
  }, [refWeekDate]);

  // Month days counts
  const daysCount = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let i = 1; i <= daysCount; i++) {
    calendarCells.push(i);
  }

  // Get active selected date string
  const selectedDateStr = selectedDay
    ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : weekDays[0].dateStr; // Fallback to first day of current week if null

  const filteredReviewEvents = useMemo(() => {
    if (specialtyFilters.length === 0) return reviewEvents;
    return reviewEvents.filter(r => specialtyFilters.includes(r.specialty));
  }, [reviewEvents, specialtyFilters]);

  // Active items on selected date
  const selectedDayStudyTopics = studyTopicsByDate[selectedDateStr] || [];
  const selectedDayReviews = filteredReviewEvents.filter(e => e.date === selectedDateStr);

  // Generate Agenda items list (chronological) based on monthly selection or rolling next 30 days
  const agendaList = useMemo(() => {
    const items: { dateStr: string; dateObj: Date; study: Topic[]; reviews: ReviewEvent[] }[] = [];
    
    if (agendaMonth === 'all') {
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() - 2); // 2 days ago

      for (let i = 0; i < 28; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const study = studyTopicsByDate[dateStr] || [];
        const reviews = filteredReviewEvents.filter(e => e.date === dateStr);
        const dayTasks = customTasks.filter(t => t.date === dateStr);

        if (study.length > 0 || reviews.length > 0 || dayTasks.length > 0) {
          items.push({
            dateStr,
            dateObj: d,
            study,
            reviews
          });
        }
      }
    } else {
      // Find days in current selected month (agendaMonth index 0-11)
      const lastDay = new Date(currentYear, agendaMonth + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        const d = new Date(currentYear, agendaMonth, day);
        const yyyy = d.getFullYear();
        const mm = String(agendaMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const study = studyTopicsByDate[dateStr] || [];
        const reviews = filteredReviewEvents.filter(e => e.date === dateStr);
        const dayTasks = customTasks.filter(t => t.date === dateStr);

        if (study.length > 0 || reviews.length > 0 || dayTasks.length > 0) {
          items.push({
            dateStr,
            dateObj: d,
            study,
            reviews
          });
        }
      }
    }
    return items;
  }, [studyTopicsByDate, filteredReviewEvents, customTasks, agendaMonth, currentYear]);

  // Get color coding based on Specialty
  const getSpecialtyBadgeColor = (specialty: string) => {
    const colors: Record<string, string> = {
      'Cirugía general': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
      'Deportología': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
      'Dermatología': 'bg-rose-500/15 text-rose-400 border-rose-500/20',
      'Ginecología y Obstetricia': 'bg-pink-500/15 text-pink-400 border-pink-500/20',
      'Medicina interna': 'bg-sky-500/15 text-sky-400 border-sky-500/20',
      'Neurología': 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
      'Oftalmología': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
      'Ortopedia': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
      'Pediatría': 'bg-violet-500/15 text-violet-400 border-violet-500/20',
      'Psiquiatría': 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    };
    return colors[specialty] || 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className="space-y-5">
      {/* Compact Calendar Options Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 shadow-sm">
        
        {/* Sub-view selection buttons */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 gap-1 shrink-0">
          <button
            onClick={() => setCalendarSubView('month')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              calendarSubView === 'month' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setCalendarSubView('week')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              calendarSubView === 'week' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setCalendarSubView('day')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              calendarSubView === 'day' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => setCalendarSubView('agenda')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              calendarSubView === 'agenda' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Agenda
          </button>
        </div>

        {/* Action controls (Filtros & Exportar) */}
        <div className="flex items-center gap-2">
          {/* Specialty Filter button & dropdown */}
          <div className="relative" id="specialty-filter-container">
            <button 
              onClick={() => {
                const el = document.getElementById('specialty-filter-dropdown');
                if (el) {
                  if (el.classList.contains('hidden')) {
                    setTempSpecialtyFilters([...specialtyFilters]);
                  }
                  el.classList.toggle('hidden');
                }
              }}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all border shrink-0 cursor-pointer flex items-center gap-1.5 bg-slate-950 border-slate-800 hover:bg-slate-850 ${specialtyFilters.length > 0 ? 'text-indigo-400 border-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-white'}`}
            >
              Filtro Especialidad {specialtyFilters.length > 0 && `(${specialtyFilters.length})`}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div id="specialty-filter-dropdown" className="hidden absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl z-50 p-3 overflow-hidden flex flex-col gap-2">
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                <button 
                  onClick={() => setTempSpecialtyFilters([])}
                  className={`w-full px-2 py-1.5 text-[10px] text-left uppercase font-bold rounded-lg transition-all border cursor-pointer ${tempSpecialtyFilters.length === 0 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-white'}`}
                >
                  Todas
                </button>
                {Array.from(new Set(topics.map(t => t.specialty))).sort().map(spec => {
                  const isSelected = tempSpecialtyFilters.includes(spec);
                  return (
                    <button
                      key={spec}
                      onClick={() => {
                        setTempSpecialtyFilters(prev => 
                          prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
                        );
                      }}
                      className={`w-full px-2 py-1.5 text-[10px] text-left uppercase font-bold rounded-lg transition-all border flex gap-2 items-center cursor-pointer ${isSelected ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 font-bold' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-white'}`}
                    >
                      <div className={`w-3 h-3 rounded flex items-center justify-center border shrink-0 ${isSelected ? 'bg-indigo-50 border-indigo-500' : 'border-slate-600'}`}>
                        {isSelected && <CheckCircle2 className="w-2 h-2 text-white" />}
                      </div>
                      <span className="truncate">{spec}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-slate-800 mt-1 flex justify-end">
                <button
                  onClick={() => {
                    setSpecialtyFilters(tempSpecialtyFilters);
                    document.getElementById('specialty-filter-dropdown')?.classList.add('hidden');
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg transition-all"
                >
                  Aplicar Filtro
                </button>
              </div>
            </div>
          </div>

          {/* Export Menu button & dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer bg-slate-950 border border-slate-800 text-slate-400 hover:text-white flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                <button onClick={handleExportICS} className="w-full px-4 py-2.5 text-xs text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors">
                  <CalendarDays className="w-4 h-4 text-indigo-400" /> Sincronizar Calendario (.ics)
                </button>
                <button onClick={handleExportImage} className="w-full px-4 py-2.5 text-xs text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors border-t border-slate-800/60">
                  <ImageIcon className="w-4 h-4 text-emerald-400" /> Exportar Imagen (.png)
                </button>
                <button onClick={handleExportPDF} className="w-full px-4 py-2.5 text-xs text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors border-t border-slate-800/60">
                  <FileText className="w-4 h-4 text-rose-400" /> Exportar a PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
          
          {/* Main Calendar View Area - Left 8 columns */}
          <div id="exportable-calendar" className="lg:col-span-8 p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
            
            {/* Calendar Sub-view Rendering */}
            {calendarSubView === 'month' && (
              <div className="space-y-4">
                {/* Month Header controls */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <LucideCalendar className="w-5 h-5 text-indigo-400 animate-pulse" />
                    <h4 className="font-bold text-white text-sm">
                      {monthNames[currentMonth]} {currentYear}
                    </h4>
                  </div>
                  
                  {/* Global Start Date quick picker synchronized */}
                  <div className="relative flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Inicio Plan:</span>
                    <span id="display-plan-start-date" className="text-[11px] font-bold text-indigo-455 dark:text-indigo-400 min-w-[70px] text-center select-none">
                      {formatToShortDDMMAA(planStartDate)}
                    </span>
                    <input 
                      type="date"
                      value={planStartDate}
                      onChange={(e) => onPlanStartDateChange(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar monthly Grid */}
                <DragDropContext onDragEnd={handleMonthDragEnd}>
                  <div className="grid grid-cols-7 gap-y-2 text-center">
                    {/* Days of week titles */}
                    {daysOfWeek.map(day => (
                      <span key={day} className="text-[10px] font-bold text-slate-500 py-1 uppercase">
                        {day}
                      </span>
                    ))}

                    {/* Grid cells */}
                    {calendarCells.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="p-3" />;
                      }

                      const formattedMonth = String(currentMonth + 1).padStart(2, '0');
                      const formattedDay = String(day).padStart(2, '0');
                      const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;

                      const studyTopics = studyTopicsByDate[dateStr] || [];
                      const reviews = filteredReviewEvents.filter(e => e.date === dateStr);
                      const isToday = currentYear === 2026 && currentMonth === 5 && day === 8;
                      const isSelected = selectedDay === day;

                      const hasPendingReviews = reviews.some(e => !e.completed);

                      return (
                        <Droppable key={`drop-${dateStr}`} droppableId={dateStr}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              onClick={() => {
                                if (isSelected) setIsTasksModalOpen(true);
                                setSelectedDay(day);
                              }}
                              onDoubleClick={() => handleDayDoubleClick(day)}
                              onPointerDown={() => handleDayPointerDown(day)}
                              onPointerUp={handleDayPointerUpOrLeave}
                              onPointerLeave={handleDayPointerUpOrLeave}
                              className={`p-1.5 min-h-[64px] relative rounded-xl flex flex-col items-center cursor-pointer transition-all hover:bg-slate-800/80 ${
                                snapshot.isDraggingOver ? 'bg-indigo-500/20 ring-2 ring-indigo-500' :
                                isSelected
                                  ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500/40'
                                  : isToday
                                  ? 'border-2 border-indigo-500 bg-indigo-500/10 text-white font-extrabold shadow-md shadow-indigo-500/15'
                                  : 'text-slate-300 bg-slate-950/20 shadow-inner'
                              }`}
                            >
                              <span className="text-[11px] font-bold self-start pl-1 mb-1">{day}</span>

                              {/* Calendar Day tasks display (compact chips/indicators) */}
                              <div className="w-full space-y-1 overflow-hidden flex-1">
                                {studyTopics.map((topic, index) => (
                                  <AnyDraggable key={topic.id} draggableId={topic.id} index={index}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={`px-1 py-0.5 text-[8px] font-bold rounded truncate border text-center ${
                                          dragSnapshot.isDragging ? 'bg-indigo-500 text-white shadow-xl z-50 scale-105' :
                                          isSelected ? 'bg-white text-indigo-900 border-white/40' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                                        }`}
                                      >
                                        📘 {topic.title}
                                      </div>
                                    )}
                                  </AnyDraggable>
                                ))}
                                {provided.placeholder}
                                
                                {reviews.length > 0 && (
                                  <div className={`px-1 py-0.5 text-[8px] font-bold rounded truncate border text-center ${
                                    isSelected ? 'bg-white text-emerald-950 border-white/40' : hasPendingReviews ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  }`}>
                                    ⏰ Repasos ({reviews.length})
                                  </div>
                                )}
                                
                                {customTasks.filter(t => t.date === dateStr).map(t => (
                                  <div key={t.id} className={`px-1 py-0.5 text-[8px] font-bold rounded truncate border text-center flex items-center justify-center gap-1 ${
                                    isSelected ? 'bg-white/90 text-indigo-900 border-white/40' : 'bg-slate-800 text-slate-300 border-slate-700/50'
                                  }`}>
                                    {t.completed ? <span className="opacity-70">✅</span> : <span>📝</span>}
                                    <span className={t.completed ? 'line-through opacity-70' : ''}>{t.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                </DragDropContext>
              </div>
            )}

            {/* Week View (Vista Semanal - Google Calendar style columns) */}
            {calendarSubView === 'week' && (
              <div className="space-y-4">
                {/* Week View header controls */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <LucideCalendar className="w-5 h-5 text-indigo-400" />
                    <h4 className="font-bold text-white text-sm">
                      Semana del {weekDays[0].dayNum} al {weekDays[6].dayNum} de {monthNames[weekDays[0].date.getMonth()]} {weekDays[0].date.getFullYear()}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePrevWeek}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg text-slate-300 transition-colors cursor-pointer"
                      title="Anterior Semana"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextWeek}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg text-slate-300 transition-colors cursor-pointer"
                      title="Siguiente Semana"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 7 columns responsive layout */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
                  {weekDays.map((dayItem) => {
                    const isSelected = selectedDateStr === dayItem.dateStr;
                    const study = studyTopicsByDate[dayItem.dateStr] || [];
                    const reviews = filteredReviewEvents.filter(e => e.date === dayItem.dateStr);
                    const isWeekend = dayItem.date.getDay() === 0 || dayItem.date.getDay() === 6;

                    return (
                      <div
                        key={dayItem.dateStr}
                        onClick={() => {
                          if (isSelected) setIsTasksModalOpen(true);
                          setSelectedDay(dayItem.dayNum);
                        }}
                        onDoubleClick={() => handleDayDoubleClick(dayItem.dayNum)}
                        onPointerDown={() => handleDayPointerDown(dayItem.dayNum)}
                        onPointerUp={handleDayPointerUpOrLeave}
                        onPointerLeave={handleDayPointerUpOrLeave}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between min-h-[178px] transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/95 text-white border-indigo-400 shadow-lg shadow-indigo-600/20'
                            : isWeekend
                            ? 'bg-slate-950/40 text-slate-500 border-slate-900'
                            : 'bg-slate-800/40 hover:bg-slate-800 text-slate-300 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Day indicator */}
                        <div className="border-b border-slate-700/40 pb-1.5">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">
                            {dayItem.dayName}
                          </p>
                          <p className="text-sm font-black mt-0.5">
                            {dayItem.dayNum} <span className="text-[10px] opacity-75 font-semibold">{dayItem.monthLabel}</span>
                          </p>
                        </div>

                        {/* List items for this day */}
                        <div className="space-y-1.5 my-2 flex-grow overflow-y-auto max-h-[120px] justify-start flex flex-col">
                          {(() => {
                            const dayTasks = customTasks.filter(t => t.date === dayItem.dateStr);
                            if (study.length === 0 && reviews.length === 0 && dayTasks.length === 0) {
                              return <div className="h-full flex items-center justify-center"><p className="text-[9px] text-slate-500/70 text-center font-medium italic">Libre</p></div>;
                            }
                            return (
                              <>
                                {study.map(t => (
                                  <div key={t.id} className={`px-1.5 py-1 text-[9px] font-bold rounded border truncate shrink-0 ${
                                    isSelected ? 'bg-white text-indigo-900 border-white/20' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                                  }`}>
                                    📘 {t.title}
                                  </div>
                                ))}
                                {reviews.length > 0 && (
                                  <div className={`px-1.5 py-1 text-[9px] font-bold rounded border truncate shrink-0 ${
                                    isSelected ? 'bg-white text-emerald-950 border-white/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                  }`}>
                                    ⏰ Repasos ({reviews.length})
                                  </div>
                                )}
                                {dayTasks.map(t => (
                                  <div key={t.id} className={`px-1.5 py-1 text-[9px] font-bold rounded border truncate shrink-0 flex items-center gap-1 ${
                                    isSelected ? 'bg-white/90 text-indigo-900 border-white/20' : 'bg-slate-800/80 text-slate-300 border-slate-700/50'
                                  }`}>
                                    {t.completed ? <span className="text-[8px] opacity-70">✅</span> : <span className="text-[8px]">📝</span>}
                                    <span className={t.completed ? 'line-through opacity-70' : ''}>{t.text}</span>
                                  </div>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day View (Timetable & DragDrop) */}
            {calendarSubView === 'day' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <LucideCalendar className="w-5 h-5 text-indigo-400" />
                    <h4 className="font-bold text-white text-sm">Planificador de Día</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] py-1 px-3 rounded-xl bg-slate-800 text-slate-300 font-bold font-mono">
                      {(() => {
                        if (!selectedDateStr) return '';
                        const parts = selectedDateStr.split('-');
                        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                      })()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const parts = selectedDateStr.split('-');
                          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                          d.setDate(d.getDate() - 1);
                          setCurrentYear(d.getFullYear());
                          setCurrentMonth(d.getMonth());
                          setSelectedDay(d.getDate());
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const parts = selectedDateStr.split('-');
                          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                          d.setDate(d.getDate() + 1);
                          setCurrentYear(d.getFullYear());
                          setCurrentMonth(d.getMonth());
                          setSelectedDay(d.getDate());
                        }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <DayView 
                  selectedDateStr={selectedDateStr}
                  selectedDateObj={new Date(parseInt(selectedDateStr.split('-')[0]), parseInt(selectedDateStr.split('-')[1]) - 1, parseInt(selectedDateStr.split('-')[2]))}
                  studyTopics={selectedDayStudyTopics}
                  reviews={selectedDayReviews}
                  customTasks={customTasks.filter(t => t.date === selectedDateStr)}
                />
              </div>
            )}
            
            {/* Agenda View (Sequential chronological timelines) */}
            {calendarSubView === 'agenda' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <LucideCalendar className="w-5 h-5 text-indigo-400" />
                    <h4 className="font-bold text-white text-sm">Agenda Minimalista</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Visualizar:</span>
                    <select
                      value={agendaMonth}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAgendaMonth(val === 'all' ? 'all' : Number(val));
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-inner pr-6 relative appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', backgroundSize: '10px' }}
                    >
                      <option value="all">Siguientes 30 días</option>
                      {monthNames.map((name, i) => (
                        <option key={i} value={i}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                  {agendaList.map((item, index) => {
                    const isSelected = item.dateStr === selectedDateStr;
                    return (
                    <div 
                      key={item.dateStr}
                      onClick={() => {
                        const dStr = item.dateStr.split('-');
                        if (dStr.length === 3 && Number(dStr[1]) - 1 === currentMonth) {
                          setSelectedDay(Number(dStr[2]));
                        } else {
                          // Allow forcing month shift first
                          const proposedMonth = Number(dStr[1]) - 1;
                          setCurrentMonth(proposedMonth);
                          setCurrentYear(Number(dStr[0]));
                          setSelectedDay(Number(dStr[2]));
                        }
                      }}
                      className={`relative flex gap-4 p-4 transition-all cursor-pointer group hover:bg-slate-800/30 rounded-xl ${isSelected ? 'bg-slate-800/50' : ''} ${index !== agendaList.length - 1 ? 'border-b border-slate-800/40' : ''}`}
                    >
                      {/* Left: Date */}
                      <div className="w-12 shrink-0 flex flex-col items-center justify-start pt-0.5">
                        <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>{item.dateObj.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                        <span className={`text-2xl font-light tracking-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>{item.dateObj.getDate()}</span>
                      </div>
                      
                      {/* Right: Content */}
                      <div className="flex-grow flex flex-col justify-start space-y-3 border-l border-slate-800/60 pl-4">
                        {item.study.map(t => (
                           <div key={t.id} className="flex flex-col">
                             <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span><span className="text-sm font-medium text-slate-200 leading-tight">{t.title}</span></div>
                             <span className="text-[10px] text-slate-500 ml-3 font-semibold mt-0.5 uppercase tracking-wider">{t.specialty}</span>
                           </div>
                        ))}
                        
                        {item.reviews.length > 0 && (
                           <div className="flex items-start gap-1.5">
                             <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5"></span>
                             <div className="flex flex-col">
                               <span className="text-xs font-semibold text-slate-300 pointer-events-none">Repasos ({item.reviews.length})</span>
                               <span className="text-[10px] text-slate-500 leading-tight mt-0.5">{item.reviews.map(r => r.topicTitle).join(' • ')}</span>
                             </div>
                           </div>
                        )}
                        
                        {(() => {
                           const dayTasks = customTasks.filter(t => t.date === item.dateStr);
                           if (dayTasks.length === 0) return null;
                           return dayTasks.map(t => (
                             <div key={t.id} className="flex items-start gap-1.5">
                               <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${t.completed ? 'bg-emerald-500/50' : 'bg-slate-400'}`}></span>
                               <span className={`text-xs ${t.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{t.text}</span>
                             </div>
                           ))
                        })()}
                      </div>
                    </div>
                  )})}

                  {agendaList.length === 0 && (
                    <div className="text-center py-16 text-slate-500">
                      <Clock3 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                      <p className="text-xs">Sin actividades encontradas para esta ventana de tiempo.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic Status Legend and Quick stats */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 border-t border-slate-800 pt-3.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Tema Programado (Tracker)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Repasos Pendientes (SRS)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Repasos Completados (SRS)
              </span>
              <span className="flex items-center gap-1 text-slate-500 font-mono text-[9px] pl-2 border-l border-slate-800">
                LÍMITES: Sábado y Domingo libres de estudio
              </span>
            </div>
          </div>

          {/* Agenda & Tasks Details Right Sidebar panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl h-full flex flex-col justify-between">
              
              <div className="space-y-5">
                {/* Header details with selected date */}
                <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                  <CalendarDays className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-white text-xs">Agenda & Actividades</h5>
                    <p className="text-[10px] text-slate-400 font-semibold font-mono">
                      {selectedDay ? `${selectedDay} de ${monthNames[currentMonth]}, ${currentYear}` : 'Fija un día'}
                    </p>
                  </div>
                </div>

                {/* Study & Review list */}
                <div className="space-y-4 overflow-y-auto max-h-[350px] pr-1">
                  
                  {/* Part 1: Primary study topics for this day */}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tema de Estudio (Tracker)</p>
                    {selectedDayStudyTopics.length === 0 ? (
                      <div className="p-3 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl text-center">
                        <p className="text-[10px] text-slate-500 italic">Día de descanso en el plan de estudio.</p>
                      </div>
                    ) : (
                      selectedDayStudyTopics.map(topic => {
                        const progress = topicsProgress[topic.id] || { status: 'Sin Empezar' };
                        return (
                          <div key={topic.id} className="p-3.5 bg-indigo-500/5 border border-indigo-500/15 rounded-xl space-y-2">
                            <div className="flex justify-between items-center">
                              <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded font-mono ${getSpecialtyBadgeColor(topic.specialty)}`}>
                                {topic.specialty}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold">📘 TEMA DEL PLAN</span>
                            </div>
                            <h6 className="text-xs font-bold text-white leading-tight">{topic.title}</h6>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/60 mt-1">
                              <span>Estado: <strong className="text-indigo-400">{progress.status}</strong></span>
                              <span className="text-[9px] text-indigo-300 font-semibold">Editar en tracker</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Part 2: Repasos SRS scheduled */}
                  <div className="border-t border-slate-800/50 pt-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Repasos Espaciados (SRS)</p>
                    {selectedDayReviews.length === 0 ? (
                      <div className="p-3 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl text-center">
                        <p className="text-[10px] text-slate-500 italic">No hay repasos agendados para este día.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedDayReviews.map(event => (
                          <div 
                            key={event.id}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                              event.completed
                                ? 'bg-emerald-500/5 border-emerald-500/10 text-slate-400'
                                : 'bg-slate-800/80 border-slate-700/80'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-extrabold uppercase tracking-wide font-mono text-slate-400">
                                  {event.specialty}
                                </span>
                                {event.completed ? (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    Completado
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 font-medium select-none">
                                    <Clock className="w-3 h-3 text-amber-400" /> Pendiente
                                  </span>
                                )}
                              </div>
                              <h6 className="text-xs font-bold text-white leading-tight">
                                {event.topicTitle}
                              </h6>
                            </div>

                            {/* Perform rate input directly if not done */}
                            {!event.completed && (() => {
                              const eventProg = topicsProgress[event.topicId] || { repetitionsCount: 0, reviewInterval: 0 };
                              const reps = eventProg.repetitionsCount || 0;
                              const iv = eventProg.reviewInterval || 0;
                              
                              return (
                                <div className="pt-2 border-t border-slate-750 space-y-1.5">
                                  <p className="text-[9px] text-slate-400 font-bold">Registrar desempeño de repaso:</p>
                                  <div className="grid grid-cols-4 gap-1 text-[8px]">
                                    <button
                                      onClick={() => onCompleteReview(event.topicId, 'Otra vez')}
                                      className="py-1 px-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold rounded-lg cursor-pointer transition-all active:scale-95 text-center leading-tight shrink-0 flex flex-col items-center justify-center gap-0.5"
                                      title={`Otra vez: ${getRealWaitTimeLabel('Otra vez', reps, iv, '1d')}`}
                                    >
                                      <span>Otra vez</span>
                                      <span className="text-[7px] text-red-300 opacity-80 font-mono scale-[0.95]">{getRealWaitTimeLabel('Otra vez', reps, iv, '1d')}</span>
                                    </button>
                                    <button
                                      onClick={() => onCompleteReview(event.topicId, 'Difícil')}
                                      className="py-1 px-0.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 font-bold rounded-lg cursor-pointer transition-all active:scale-95 text-center leading-tight shrink-0 flex flex-col items-center justify-center gap-0.5"
                                      title={`Difícil: ${getRealWaitTimeLabel('Difícil', reps, iv, '×1.2')}`}
                                    >
                                      <span>Difícil</span>
                                      <span className="text-[7px] text-orange-300 opacity-80 font-mono scale-[0.95]">{getRealWaitTimeLabel('Difícil', reps, iv, '×1.2')}</span>
                                    </button>
                                    <button
                                      onClick={() => onCompleteReview(event.topicId, 'Bien')}
                                      className="py-1 px-0.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-bold rounded-lg cursor-pointer transition-all active:scale-95 text-center leading-tight shrink-0 flex flex-col items-center justify-center gap-0.5"
                                      title={`Bien: ${getRealWaitTimeLabel('Bien', reps, iv, '×2.0')}`}
                                    >
                                      <span>Bien</span>
                                      <span className="text-[7px] text-sky-300 opacity-80 font-mono scale-[0.95]">{getRealWaitTimeLabel('Bien', reps, iv, '×2.0')}</span>
                                    </button>
                                    <button
                                      onClick={() => onCompleteReview(event.topicId, 'Fácil')}
                                      className="py-1 px-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold rounded-lg cursor-pointer transition-all active:scale-95 text-center leading-tight shrink-0 flex flex-col items-center justify-center gap-0.5"
                                      title={`Fácil: ${getRealWaitTimeLabel('Fácil', reps, iv, '×3.5')}`}
                                    >
                                      <span>Fácil</span>
                                      <span className="text-[7px] text-emerald-300 opacity-80 font-mono scale-[0.95]">{getRealWaitTimeLabel('Fácil', reps, iv, '×3.5')}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Part 3: Tareas & Notas Personales */}
                  <div className="border-t border-slate-800/50 pt-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tareas y Notas del Día</p>
                    <div className="space-y-2">
                      {customTasks.filter(t => t.date === selectedDateStr).map(task => (
                        <div key={task.id} className="flex items-start gap-2 bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 group">
                          <button
                            onClick={() => {
                              const updated = customTasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t);
                              handleCustomTasksChange(updated);
                            }}
                            className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                              task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-indigo-400 bg-slate-900'
                            }`}
                          >
                            {task.completed && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                          </button>
                          <span className={`text-[10px] flex-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                            {task.text}
                          </span>
                          <button
                            onClick={() => {
                              handleCustomTasksChange(customTasks.filter(t => t.id !== task.id));
                            }}
                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          id="newTaskInput"
                          placeholder="Añadir nueva tarea o nota + Enter" 
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-indigo-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
                              const newTask: CustomTask = {
                                id: `task-${Date.now()}`,
                                date: selectedDateStr as string,
                                text: e.currentTarget.value.trim(),
                                completed: false
                              };
                              handleCustomTasksChange([...customTasks, newTask]);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Informative Tip Card */}
              <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <Clock3 className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Cronobiología Médica</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Realizar las sesiones de estudio y repasos el mismo día indicados por el planificador maximiza la **consolidación de memoria a largo plazo**. ¡Evita acumular tareas para mantener la curva óptima de retención!
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* Floating Modal for Tasks/Notes when long-press / double-click triggered */}
      {isTasksModalOpen && selectedDateStr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsTasksModalOpen(false)}>
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Notas / Tareas del Día</h3>
              </div>
              <button 
                onClick={() => setIsTasksModalOpen(false)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg p-1.5 transition-colors"
                title="Cerrar"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-xs text-slate-300 font-medium">Gestionar para el {selectedDateStr}:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(() => {
                  const dayStudyTopics = studyTopicsByDate[selectedDateStr] || [];
                  const dayReviews = filteredReviewEvents.filter(e => e.date === selectedDateStr);
                  return (
                    <>
                      {dayStudyTopics.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">📚 Temas a Estudiar</p>
                          {dayStudyTopics.map(t => (
                            <div key={t.id} className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 p-2.5 rounded-xl font-medium">
                              {t.title}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {dayReviews.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">⏰ Repasos</p>
                          {dayReviews.map(r => (
                            <div key={r.id} className={`text-xs p-2.5 rounded-xl border font-medium flex items-center justify-between ${r.completed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
                              <span>{r.topicTitle}</span>
                              <span className="text-[10px] opacity-70">{r.completed ? 'Completado' : 'Pendiente'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                {(customTasks.filter(t => t.date === selectedDateStr).length > 0 || (studyTopicsByDate[selectedDateStr]?.length === 0 && filteredReviewEvents.filter(e => e.date === selectedDateStr).length === 0)) && (
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-2 mb-1">📋 Notas y Tareas</p>
                )}
                {customTasks.filter(t => t.date === selectedDateStr).map(task => (
                  <div key={task.id} className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 group">
                    <button
                      onClick={() => {
                        const updated = customTasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t);
                        handleCustomTasksChange(updated);
                      }}
                      className={`mt-0.5 shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-indigo-400 bg-slate-900'
                      }`}
                    >
                      {task.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                    <span className={`text-xs flex-1 leading-snug ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => {
                        handleCustomTasksChange(customTasks.filter(t => t.id !== task.id));
                      }}
                      className="text-slate-600 hover:text-red-400 p-1 opacity-60 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {customTasks.filter(t => t.date === selectedDateStr).length === 0 && (
                  <p className="text-xs text-slate-500 italic py-4 text-center border border-dashed border-slate-700 rounded-xl">No hay notas pendientes para este día.</p>
                )}
              </div>
              
              <div className="pt-2 border-t border-slate-800/60">
                <input 
                  type="text" 
                  placeholder="Escribe aquí y presiona Enter + ↵" 
                  className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
                      const newTask: CustomTask = {
                        id: `task-${Date.now()}`,
                        date: selectedDateStr,
                        text: e.currentTarget.value.trim(),
                        completed: false
                      };
                      handleCustomTasksChange([...customTasks, newTask]);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide Card (Collapsible) - Explains "Cómo se usa el calendario?" */}
      <div className="p-5 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl space-y-4 mt-6">
        <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setShowHowToUse(!showHowToUse)}>
          <div className="flex items-center gap-2.5 text-indigo-400">
            <HelpCircle className="w-5 h-5" />
            <h4 className="font-bold text-sm text-white">¿Cómo se usa el calendario y el flujo de fechas?</h4>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            {showHowToUse ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showHowToUse && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 text-xs border-t border-indigo-500/15 leading-relaxed text-slate-300">
            <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
              <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block mb-1">1. Fecha Día 1</span>
              <p>Ponle fecha de inicio a tu plan (ej. 8 de Junio). El sistema calculará automáticamente las fechas de estudio para todos los temas subsecuentes de la lista secuencialmente.</p>
            </div>
            <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
              <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block mb-1">2. Fin de Semana Libres</span>
              <p>El planificador esquiva sábados y domingos automáticamente durante la asignación secuencial para garantizarte tiempo de descanso e hidratación académica.</p>
            </div>
            <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
              <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block mb-1">3. Posponer Temas</span>
              <p>¿No pudiste estudiar hoy? Abre el <strong>Tracker Detallado</strong> y cámbiale la fecha a ese tema. Los temas siguientes se reajustarán automáticamente empujando el calendario.</p>
            </div>
            <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block mb-1">4. Estudio vs SRS</span>
              <p>El calendario muestra: 📘 <strong>Tema del Día</strong> (Tracker) y ⏰ <strong>Repasos del Día</strong> (SRS calculados según tu desempeño). Sigue el calendario para dominar el examen.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
