import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, BrainCircuit, Check, X, AlertCircle, RefreshCw, ThumbsUp, Award, HelpCircle } from 'lucide-react';
import { Topic, AISummaryResponse } from '../types';

interface AICoachProps {
  topic: Topic;
  onSavedNote?: (notes: string) => void;
  currentNotes?: string;
}

export default function AICoach({ topic, onSavedNote, currentNotes = '' }: AICoachProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesText, setNotesText] = useState(currentNotes);
  const [aiData, setAiData] = useState<AISummaryResponse | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setNotesText(currentNotes);
    setAiData(null);
    setSelectedAnswers({});
    setShowExplanation({});
    setError(null);
  }, [topic, currentNotes]);

  const generateMentorMaterial = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mentor/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicId: topic.id,
          topicTitle: topic.title,
          specialty: topic.specialty,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo establecer conexión con el mentor médico.');
      }

      const data = await response.json();
      setAiData(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al conectar con la IA del Mentor de Estudio.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    if (selectedAnswers[questionIndex] !== undefined) return; // already answered
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
    setShowExplanation(prev => ({ ...prev, [questionIndex]: true }));
  };

  return (
    <div className="space-y-6" id="ai-coach-panel">
      {/* Mentor Prompt Trigger */}
      {!aiData && !loading && (
        <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-white">
              ¿Quieres repasar este tema con tu Mentor Clínico AI?
            </h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Generaré perlas clínicas de examen, neumotecnias nemotécnicas memorables y 3 casos clínicos de opción múltiple tipo residencia en base a este tema.
            </p>
          </div>
          <button
            id="btn-generate-ai"
            onClick={generateMentorMaterial}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2 mx-auto cursor-pointer"
          >
            <BrainCircuit className="w-5 h-5" />
            Iniciar Sesión con Mentor AI
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center space-y-4 bg-slate-800/50 border border-slate-700 rounded-2xl animate-pulse">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto animate-duration-[2s]" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Consultando Guías Clínicas y Perlas ENARM...</p>
            <p className="text-xs text-slate-400">Tu ayudante de estudio está estructurando casos simulados y mnemotecnias.</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Error al conectar con el Mentor AI</p>
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={generateMentorMaterial}
              className="mt-2 text-xs font-semibold underline hover:text-red-300"
            >
              Reintentar generación
            </button>
          </div>
        </div>
      )}

      {/* Content output */}
      {aiData && (
        <div className="space-y-6">
          {/* Header indicator */}
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <div className="flex items-center gap-2 text-indigo-400 font-medium text-sm">
              <Sparkles className="w-4 h-4 fill-current" />
              <span>Material de Repaso de Élite Generado</span>
            </div>
            {('isMock' in aiData) && (
              <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">
                Guía de Estudio Local Activa
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Clinical Pearls */}
            <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-slate-700 rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Award className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white">Perlas Clínicas del Tema</h4>
              </div>
              <ul className="space-y-3">
                {aiData.keyConcepts.map((concept, index) => (
                  <li key={index} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-indigo-400 font-mono font-bold">{index + 1}.</span>
                    <p>{concept}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mnemonics Memorization */}
            <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-slate-700 rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-white font-sans">Reglas Mnemotécnicas</h4>
              </div>
              <div className="space-y-3">
                {aiData.mnemonics.map((mnem, index) => (
                  <div key={index} className="p-3 bg-slate-950 rounded-xl border border-emerald-500/20 text-sm text-slate-300">
                    {mnem}
                  </div>
                ))}
                {aiData.mnemonics.length === 0 && (
                  <p className="text-xs text-slate-400">No se generaron mnemotecnias adicionales para este tema.</p>
                )}
              </div>
            </div>
          </div>

          {/* Practice Quiz */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h4 className="font-semibold text-white">Simulación del Examen (Casos Clínicos)</h4>
            </div>

            <div className="space-y-4">
              {aiData.quiz.map((q, qIndex) => {
                const answer = selectedAnswers[qIndex];
                const isAnswered = answer !== undefined;

                return (
                  <div key={qIndex} className="p-5 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-4">
                    <div className="flex items-start gap-2.5">
                      <span className="bg-indigo-500/20 text-indigo-400 font-mono font-bold text-xs px-2 py-1 rounded-md shrink-0">
                        Pregunta {qIndex + 1}
                      </span>
                      <p className="text-sm font-medium text-white">
                        {q.question}
                      </p>
                    </div>

                    {/* Options list */}
                    <div className="grid grid-cols-1 gap-2 pl-2">
                      {q.options.map((option, optIndex) => {
                        let btnStyle = "border-slate-700 hover:bg-slate-700/50";
                        let IconComponent = null;

                        if (isAnswered) {
                          if (optIndex === q.correctIndex) {
                            btnStyle = "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-medium";
                            IconComponent = <Check className="w-4 h-4 text-emerald-500" />;
                          } else if (optIndex === answer) {
                            btnStyle = "bg-rose-500/10 border-rose-500 text-rose-500 font-medium";
                            IconComponent = <X className="w-4 h-4 text-rose-500" />;
                          } else {
                            btnStyle = "opacity-50 border-slate-700";
                          }
                        }

                        return (
                          <button
                            key={optIndex}
                            disabled={isAnswered}
                            onClick={() => handleAnswerSelect(qIndex, optIndex)}
                            className={`p-3 text-left text-xs rounded-xl border transition-all duration-200 flex items-center justify-between gap-2 max-w-full cursor-pointer ${btnStyle}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="font-semibold text-slate-400 uppercase font-mono">{String.fromCharCode(65 + optIndex)}.</span>
                              <span>{option}</span>
                            </span>
                            {IconComponent}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation Feedback */}
                    {showExplanation[qIndex] && (
                      <div className="p-3.5 bg-slate-950/80 border-l-4 border-indigo-500 rounded-r-xl text-xs space-y-1">
                        <span className="font-semibold text-indigo-400 uppercase font-mono">Retroalimentación del Mentor:</span>
                        <p className="text-slate-300 leading-relaxed">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Study Notes Section */}
      <div className="p-5 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2/5">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <h5 className="font-semibold text-white text-sm">Mis Notas de Estudio Personales</h5>
          </div>
          {onSavedNote && (
            <button
              onClick={() => onSavedNote(notesText)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
            >
              Guardar Notas
            </button>
          )}
        </div>
        <textarea
          value={notesText}
          onChange={(e) => {
            setNotesText(e.target.value);
            if (onSavedNote) onSavedNote(e.target.value);
          }}
          placeholder="Escribe aquí perlas clínicas, apuntes especiales de videos médicos o dudas a consultar luego de este tema..."
          rows={4}
          className="w-full p-3 text-sm bg-slate-950 text-slate-300 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
