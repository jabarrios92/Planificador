import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { Topic, UserTopicProgress } from '../types';
import { INITIAL_TOPICS, SPECIALTIES } from '../data/topics';
import { BookOpen, CheckCircle2, RefreshCw, BarChart3, TrendingUp, Award, CalendarDays } from 'lucide-react';

interface StudyStatsProps {
  topicsProgress: Record<string, UserTopicProgress>;
}

export default function StudyStats({ topicsProgress }: StudyStatsProps) {
  const totalTopicsCount = INITIAL_TOPICS.length;

  const statusCount = {
    mastered: 0, // Dominado
    inReview: 0, // En Repaso
    studied: 0,  // Estudiado
    untouched: 0 // Sin Empezar
  };

  INITIAL_TOPICS.forEach(topic => {
    const prog = topicsProgress[topic.id];
    if (!prog || prog.status === 'Sin Empezar') {
      statusCount.untouched++;
    } else if (prog.status === 'Dominado') {
      statusCount.mastered++;
    } else if (prog.status === 'En Repaso') {
      statusCount.inReview++;
    } else if (prog.status === 'Estudiado') {
      statusCount.studied++;
    }
  });

  const totalReviewed = statusCount.mastered + statusCount.inReview + statusCount.studied;
  const globalCompletionRate = totalTopicsCount > 0 ? Math.round((totalReviewed / totalTopicsCount) * 100) : 0;

  // Pie chart data
  const pieData = [
    { name: 'Dominados 🏆', value: statusCount.mastered, color: '#10b981' }, // emerald
    { name: 'En Repaso 🔁', value: statusCount.inReview, color: '#f59e0b' },    // amber
    { name: 'Estudiados 📚', value: statusCount.studied, color: '#6366f1' },    // indigo
    { name: 'Sin Empezar ⏳', value: statusCount.untouched, color: '#1e293b' }  // slate-800
  ].filter(item => item.value > 0);

  // Specialty statistics compilation
  const specialtyData = SPECIALTIES.map(spec => {
    const specTopics = INITIAL_TOPICS.filter(t => t.specialty === spec.name);
    const completed = specTopics.filter(t => {
      const prog = topicsProgress[t.id];
      return prog && prog.status !== 'Sin Empezar';
    }).length;
    const pending = specTopics.length - completed;

    return {
      name: spec.name.substring(0, 15) + (spec.name.length > 15 ? '...' : ''),
      fullName: spec.name,
      Completados: completed,
      Pendientes: pending,
      total: specTopics.length
    };
  });

  // Calculate upcoming reviews per day (Review forecasts)
  const reviewForecast: Record<string, number> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Streak calculation
  const getStudyStreak = () => {
    const allStudyDates = new Set<string>();
    Object.values(topicsProgress).forEach(prog => {
      prog.reviewLog?.forEach(log => {
        allStudyDates.add(log.date.split('T')[0]);
      });
      if (prog.lastReviewedAt) {
        allStudyDates.add(new Date(prog.lastReviewedAt).toISOString().split('T')[0]);
      }
    });

    const sortedDates = Array.from(allStudyDates).sort((a, b) => b.localeCompare(a));
    if (sortedDates.length === 0) return 0;

    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const yestD = new Date();
    yestD.setDate(yestD.getDate() - 1);
    const yesterdayStr = yestD.toISOString().split('T')[0];

    if (!sortedDates.includes(todayStr) && !sortedDates.includes(yesterdayStr)) {
       return 0;
    }

    let currentDateStr = sortedDates.includes(todayStr) ? todayStr : yesterdayStr;
    
    for (const d of sortedDates) {
      if (d > currentDateStr) continue;
      if (d === currentDateStr) {
        streak++;
        const prev = new Date(currentDateStr + 'T12:00:00Z');
        prev.setDate(prev.getDate() - 1);
        currentDateStr = prev.toISOString().split('T')[0];
      } else {
        break;
      }
    }
    return streak;
  };

  const streakDays = getStudyStreak();

  // Pre-populate next 7 days in object
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date();
    nextDay.setDate(today.getDate() + i);
    const dayStr = nextDay.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    reviewForecast[dayStr] = 0;
  }

  Object.values(topicsProgress).forEach(prog => {
    if (prog.nextReviewDate) {
      const reviewDate = new Date(prog.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      const diffTime = reviewDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < 7) {
        const targetDay = new Date();
        targetDay.setDate(today.getDate() + diffDays);
        const dayStr = targetDay.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
        if (reviewForecast[dayStr] !== undefined) {
          reviewForecast[dayStr]++;
        }
      }
    }
  });

  const forecastData = Object.keys(reviewForecast).map(day => ({
    dia: day,
    Repasos: reviewForecast[day]
  }));

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gradient-to-r from-orange-500/10 to-rose-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center shrink-0 relative">
            <span className="text-2xl">🔥</span>
            {streakDays > 5 && (
              <span className="absolute -top-1 -right-1 text-xs animate-bounce" title="Racha en llamas">🔥</span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Racha de Estudio</h3>
            <p className="text-[11px] text-slate-400 font-medium">Has estudiado o repasado consistentemente por los últimos {streakDays} días.</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">{streakDays}</span>
          <span className="text-xs text-orange-500/70 font-bold ml-1 uppercase tracking-widest">Días</span>
        </div>
      </div>

      {/* Visual top widgets cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total stats */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wide">Total Temas</span>
            <span className="text-xl font-bold text-white">{totalTopicsCount}</span>
          </div>
        </div>

        {/* Mastered */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wide">Dominados</span>
            <span className="text-xl font-bold text-white">{statusCount.mastered}</span>
          </div>
        </div>

        {/* In Review */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wide">En Repaso</span>
            <span className="text-xl font-bold text-white">{statusCount.inReview}</span>
          </div>
        </div>

        {/* Global rate */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wide">% Completado</span>
            <span className="text-xl font-bold text-white">{globalCompletionRate}%</span>
          </div>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global Mastery Breakdown Pie */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h4 className="font-semibold text-white text-sm">Distribución de Aprendizaje</h4>
          </div>

          <div className="h-64 flex flex-col items-center justify-center relative">
            {pieData.length === 0 ? (
              <p className="text-slate-400 text-xs">Aún no has registrado avances. ¡Inicia el estudio para ver tus métricas!</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} temas`, 'Cantidad']} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Volume Forecast Schedule (SRS Outlook) */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
            <h4 className="font-semibold text-white text-sm">Previsión de Repasos (Próximos 7 Días)</h4>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData}>
                <XAxis dataKey="dia" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value} temas`, 'Sugeridos']} />
                <Bar dataKey="Repasos" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Specialty breakdown detailed graphics */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h4 className="font-semibold text-white text-sm">Avance Clínico por Especialidad</h4>
        </div>

        <div className="h-80 select-none">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={specialtyData} layout="vertical">
              <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} tickLine={false} width={100} />
              <Tooltip formatter={(value, name) => [`${value} temas`, name]} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="Completados" stackId="a" fill="#10b981" radius={[0, 2, 2, 0]} />
              <Bar dataKey="Pendientes" stackId="a" fill="#1e293b" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
