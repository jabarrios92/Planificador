import React, { useState, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Clock, Plus, Minus, GripVertical, Trash2 } from 'lucide-react';
import { Topic, ReviewEvent, CustomTask } from '../types';

const AnyDraggable = Draggable as any;
const AnyDroppable = Droppable as any;

interface TimeBlock {
  id: string;
  dateStr: string;
  startHour: number; // 0 to 28 (where 24 is midnight, 28 is 4 AM next day)
  startMin: number; // 0 or 30
  durationMins: number;
  title: string;
  type: 'topic' | 'review' | 'custom';
  itemId: string;
}

interface DayViewProps {
  selectedDateStr: string;
  selectedDateObj: Date;
  studyTopics: Topic[];
  reviews: ReviewEvent[];
  customTasks: CustomTask[];
}

export function DayView({ selectedDateStr, selectedDateObj, studyTopics, reviews, customTasks }: DayViewProps) {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(() => {
    const saved = localStorage.getItem('dailyTimeBlocks');
    if (saved) { try { return JSON.parse(saved); } catch(e) {} }
    return [];
  });

  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [customDurationVal, setCustomDurationVal] = useState<number>(30);

  useEffect(() => {
    localStorage.setItem('dailyTimeBlocks', JSON.stringify(timeBlocks));
  }, [timeBlocks]);

  const slots = useMemo(() => {
    const arr = [];
    // Start at 0:00 (Midnight) and go up to 28:00 (4:00 AM next day for night owls)
    for (let h = 0; h <= 28; h++) {
      arr.push({ hour: h, min: 0, label: getHourLabel(h, 0) });
      if (h !== 28) arr.push({ hour: h, min: 30, label: getHourLabel(h, 30) });
    }
    return arr;
  }, []);

  function getHourLabel(h: number, m: number) {
    const realH = h >= 24 ? h - 24 : h;
    const suffix = h < 12 || h === 24 ? 'AM' : 'PM';
    const displayH = realH === 0 ? 12 : (realH > 12 ? realH - 12 : realH);
    return `${displayH}:${m === 0 ? '00' : '30'} ${suffix}`;
  }

  const nextDayObj = new Date(selectedDateObj);
  nextDayObj.setDate(nextDayObj.getDate() + 1);
  const nextDayStr = `${nextDayObj.getFullYear()}-${String(nextDayObj.getMonth() + 1).padStart(2, '0')}-${String(nextDayObj.getDate()).padStart(2, '0')}`;

  // Blocks for current day (all hours) and blocks for next day (hours 0-4, which map to 24-28 today)
  const dayBlocks = timeBlocks.filter(b => b.dateStr === selectedDateStr).map(b => ({ ...b, renderHour: b.startHour }))
    .concat(
      timeBlocks.filter(b => b.dateStr === nextDayStr && b.startHour <= 4).map(b => ({ ...b, renderHour: b.startHour + 24 }))
    );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId === 'unassigned' && destination.droppableId.startsWith('slot-')) {
      const parts = destination.droppableId.replace('slot-', '').split('-');
      const droppedHour = parseInt(parts[0]);
      const m = parseInt(parts[1]);

      let targetDateStr = selectedDateStr;
      let targetHour = droppedHour;

      if (droppedHour >= 24) {
        targetDateStr = nextDayStr;
        targetHour = droppedHour - 24;
      }

      let title = '';
      let type: 'topic' | 'review' | 'custom' = 'topic';
      
      if (draggableId.startsWith('topic-')) {
        title = studyTopics.find(t => t.id === draggableId.replace('topic-', ''))?.title || '';
        type = 'topic';
      } else if (draggableId.startsWith('review-')) {
        title = reviews.find(r => r.id === draggableId.replace('review-', ''))?.topicTitle || '';
        type = 'review';
      } else if (draggableId.startsWith('task-')) {
        title = customTasks.find(t => t.id === draggableId.replace('task-', ''))?.text || '';
        type = 'custom';
      }

      const newBlock: TimeBlock = {
        id: `block-${Date.now()}-${Math.random()}`,
        dateStr: targetDateStr,
        startHour: targetHour,
        startMin: m,
        durationMins: 30,
        title,
        type,
        itemId: draggableId
      };
      setTimeBlocks(prev => [...prev, newBlock]);
    } else if (source.droppableId.startsWith('slot-') && destination.droppableId.startsWith('slot-')) {
      const parts = destination.droppableId.replace('slot-', '').split('-');
      const droppedHour = parseInt(parts[0]);
      const m = parseInt(parts[1]);

      let targetDateStr = selectedDateStr;
      let targetHour = droppedHour;

      if (droppedHour >= 24) {
        targetDateStr = nextDayStr;
        targetHour = droppedHour - 24;
      }

      setTimeBlocks(prev => prev.map(b => 
        b.id === draggableId ? { ...b, dateStr: targetDateStr, startHour: targetHour, startMin: m } : b
      ));
    } else if (source.droppableId.startsWith('slot-') && destination.droppableId === 'unassigned') {
      setTimeBlocks(prev => prev.filter(b => b.id !== draggableId));
    }
  };

  const changeDuration = (id: string, deltaMins: number) => {
    setTimeBlocks(prev => prev.map(b => {
      if (b.id === id) {
        const newDur = Math.max(30, b.durationMins + deltaMins);
        return { ...b, durationMins: newDur };
      }
      return b;
    }));
  };

  // Real-time Vertical Drag-to-Resize Duration Engine
  const startResize = (e: React.MouseEvent | React.TouchEvent, blockId: string, currentDuration: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startDur = currentDuration;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = currentY - startY;
      
      // Multiples of 30 mins, where 60px represents 30 mins in height
      const deltaDur = Math.round(deltaY / 2);
      const rawNewDur = startDur + deltaDur;
      const gridNewDur = Math.max(30, Math.round(rawNewDur / 30) * 30);
      
      setTimeBlocks(prev => prev.map(b => b.id === blockId ? { ...b, durationMins: gridNewDur } : b));
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Double Click / Double Tap Trigger
  const handleBlockDoubleClick = (block: TimeBlock) => {
    setEditingBlock(block);
    setCustomDurationVal(block.durationMins);
  };

  // Double tap handler for mobile compatibility
  let lastTap = 0;
  const handleBlockTap = (block: TimeBlock) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      handleBlockDoubleClick(block);
    }
    lastTap = now;
  };

  const unassignedItems = [
    ...studyTopics.map(t => ({ id: `topic-${t.id}`, type: 'topic', title: t.title })),
    ...reviews.map(r => ({ id: `review-${r.id}`, type: 'review', title: r.topicTitle })),
    ...customTasks.map(t => ({ id: `task-${t.id}`, type: 'custom', title: t.text }))
  ].filter(item => !dayBlocks.some(b => b.itemId === item.id));

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Pending Activities: Sleek, compact and strictly space-efficient (h-fit max-h-[600px]) */}
        <div className="w-full lg:w-1/3 bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col h-fit max-h-[600px] shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <h4 className="font-bold text-white text-xs tracking-wider uppercase">Actividades Pendientes</h4>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20">
              {unassignedItems.length}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Arrastra y suelta cualquiera de estas actividades médicas hacia los bloques de horarios para organizar tu jornada en detalle.</p>
          
          <AnyDroppable droppableId="unassigned">
            {(provided: any, snapshot: any) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                className={`flex-grow overflow-y-auto space-y-2 pr-1 h-fit max-h-[360px] custom-scrollbar p-2 rounded-xl border border-dashed transition-all ${
                  snapshot.isDraggingOver ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800 bg-slate-950/20'
                }`}
              >
                {unassignedItems.map((item, idx) => (
                  <AnyDraggable key={item.id} draggableId={item.id} index={idx}>
                    {(dragProvided: any, dragSnapshot: any) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={`p-3 rounded-xl border text-xs font-semibold cursor-grab active:cursor-grabbing flex items-center gap-2.5 transition-all select-none ${
                          dragSnapshot.isDragging ? 'bg-indigo-600 text-white shadow-xl opacity-95 scale-[1.02]' :
                          item.type === 'topic' ? 'bg-slate-950/40 text-indigo-300 border-indigo-500/10 hover:border-indigo-500/40 hover:bg-slate-950/70' :
                          item.type === 'review' ? 'bg-slate-950/40 text-amber-300 border-amber-500/10 hover:border-amber-500/40 hover:bg-slate-950/70' :
                          'bg-slate-950/40 text-slate-300 border-slate-800 hover:border-slate-600 hover:bg-slate-950/70'
                        }`}
                      >
                        <GripVertical className="w-3.5 h-3.5 opacity-40 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    )}
                  </AnyDraggable>
                ))}
                
                {unassignedItems.length === 0 && (
                  <div className="text-center py-8 text-slate-600 text-xs italic font-medium">
                    🙌 Todas las actividades del día están programadas.
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </AnyDroppable>
        </div>

        {/* Timetable planner column */}
        <div className="w-full lg:w-2/3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[600px] overflow-hidden relative shadow-xl">
          <div className="flex-grow overflow-y-auto custom-scrollbar p-2.5 relative">
            <div className="relative">
              {slots.map((slot) => {
                const slotId = `slot-${slot.hour}-${slot.min}`;
                
                return (
                  <div key={slotId} className="flex min-h-[60px] border-b border-slate-800/30 group relative">
                    {/* Hour display */}
                    <div className="w-16 shrink-0 text-[10px] text-slate-500 font-bold pr-3 text-right pt-2 border-r border-slate-800/60 font-mono">
                      {slot.min === 0 ? slot.label : ''}
                    </div>
                    
                    {/* Drop target */}
                    <AnyDroppable droppableId={slotId}>
                      {(provided: any, snapshot: any) => (
                        <div 
                          ref={provided.innerRef} 
                          {...provided.droppableProps}
                          className={`flex-grow p-1 transition-colors relative ${snapshot.isDraggingOver ? 'bg-indigo-500/10' : 'hover:bg-slate-800/15'}`}
                        >
                          {dayBlocks.filter(b => b.renderHour === slot.hour && b.startMin === slot.min).map((block, idx) => {
                            const heightPx = (block.durationMins / 30) * 60 - 8;
                            
                            return (
                              <AnyDraggable key={block.id} draggableId={block.id} index={idx}>
                                {(dragProvided: any, dragSnapshot: any) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    onDoubleClick={() => handleBlockDoubleClick(block)}
                                    onClick={() => handleBlockTap(block)}
                                    className={`absolute left-2.5 right-2.5 p-2 rounded-xl border text-xs flex flex-col justify-between shadow-lg overflow-hidden group/block transition-all ${
                                      dragSnapshot.isDragging ? 'z-50 shadow-2xl opacity-95 scale-[1.01]' : 'z-20 hover:border-slate-500/50'
                                    } ${
                                      block.type === 'topic' ? 'bg-indigo-950/50 text-indigo-200 border-indigo-500/40 hover:bg-indigo-950/80' :
                                      block.type === 'review' ? 'bg-amber-950/50 text-amber-200 border-amber-500/40 hover:bg-amber-950/80' :
                                      'bg-slate-850 text-slate-200 border-slate-700 hover:bg-slate-800'
                                    }`}
                                    style={{ 
                                      ...dragProvided.draggableProps.style,
                                      height: Math.max(heightPx, 52) + 'px', 
                                      top: '4px' 
                                    }}
                                    title="Arrastra para mover | Doble click para duración personalizada"
                                  >
                                    <div className="font-bold truncate select-none leading-tight">{block.title}</div>
                                    
                                    <div className="flex items-center justify-between mt-auto">
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-950/50 text-slate-400 font-mono select-none font-bold">
                                        {block.durationMins} min
                                      </span>
                                      
                                      <div className="flex gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity p-1 bg-slate-950/80 rounded-lg">
                                        <button 
                                          onPointerDown={(e) => { e.stopPropagation(); changeDuration(block.id, -30); }}
                                          className="p-1 hover:bg-slate-800 rounded bg-slate-900 text-slate-300 cursor-pointer"
                                          title="-30 min"
                                        >
                                          <Minus className="w-3 h-3"/>
                                        </button>
                                        <button 
                                          onPointerDown={(e) => { e.stopPropagation(); changeDuration(block.id, 30); }}
                                          className="p-1 hover:bg-slate-800 rounded bg-slate-900 text-slate-300 cursor-pointer"
                                          title="+30 min"
                                        >
                                          <Plus className="w-3 h-3"/>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Bottom Resize Handle: Drag to adjust duration in multiples of 30 mins (Apple-style) */}
                                    <div 
                                      onMouseDown={(e) => startResize(e, block.id, block.durationMins)}
                                      onTouchStart={(e) => startResize(e, block.id, block.durationMins)}
                                      className="absolute bottom-0 left-0 right-0 h-2 bg-transparent cursor-ns-resize group-hover/block:bg-indigo-500/20 rounded-b-xl flex items-end justify-center"
                                      title="Arrastra para redimensionar duración"
                                    >
                                      <div className="w-6 h-1 rounded-full bg-indigo-400/40 mb-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity" />
                                    </div>
                                  </div>
                                )}
                              </AnyDraggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </AnyDroppable>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Polish Apple/iOS styled Custom Pop-up Modal for Exact Duration Input */}
      {editingBlock && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all"
          onClick={() => setEditingBlock(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xs shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none block">Configuración de Bloque</span>
              <h4 className="text-white font-bold text-sm truncate">{editingBlock.title}</h4>
              <p className="text-[10px] text-slate-400 leading-snug">Define la duración personalizada exacta (en minutos) para este bloque de estudio:</p>
            </div>

            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 shadow-inner">
              <input
                type="number"
                min="1"
                max="1440"
                value={customDurationVal}
                onChange={(e) => setCustomDurationVal(Math.max(1, parseInt(e.target.value) || 0))}
                className="bg-transparent flex-1 focus:outline-none text-white text-base font-extrabold text-center font-mono"
              />
              <span className="text-xs text-slate-500 font-extrabold uppercase pr-2">minutos</span>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => {
                  setTimeBlocks(prev => prev.filter(b => b.id !== editingBlock.id));
                  setEditingBlock(null);
                }}
                className="flex-1 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/10 font-bold rounded-xl text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Quitar
              </button>
              <button
                onClick={() => {
                  setTimeBlocks(prev => prev.map(b => b.id === editingBlock.id ? { ...b, durationMins: customDurationVal } : b));
                  setEditingBlock(null);
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </DragDropContext>
  );
}
