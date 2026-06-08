import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Calendar, BarChart3, User, Scissors, Activity, 
  Sparkles, HeartHandshake, Stethoscope, Brain, Eye, Bone, Baby, Smile, 
  ChevronRight, CheckCircle2, AlertCircle, Clock, BookMarked, Save, 
  Sparkle, LogIn, LogOut, Check, ArrowRight, RefreshCw, Send, ChevronLeft, 
  CalendarDays, ExternalLink, ThumbsUp, AlertTriangle, Bell, BellOff, Info, GraduationCap,
  X, Trash2, Download, Search
} from 'lucide-react';

import { auth, googleProvider, signInWithPopup, signInWithRedirect, signOut } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

import { 
  StudyStatus, StudyRating, Topic, UserTopicProgress, ReviewEvent, StudyConfig, ReviewHistoryLog
} from './types';

import { INITIAL_TOPICS, SPECIALTIES } from './data/topics';
import { calculateNextReview, getDaysDiffFromToday, getRealWaitTimeLabel } from './utils/srs';

import { 
  getLocalProgress, saveLocalProgress, getLocalReviews, saveLocalReviews,
  loadProgressCloud, loadReviewsCloud, saveProgressCloud, saveReviewCloud, deleteReviewCloud,
  uploadLocalToCloud
} from './lib/sync';

import { exportToPDF } from './utils/exportCalendar';

import Syllabus from './components/Syllabus';
import AICoach from './components/AICoach';
import StudyStats from './components/StudyStats';
import StudyCalendar from './components/StudyCalendar';
import Boveda from './components/Boveda';
import Home from './components/Home';

export default function App() {
  const [studyConfig, setStudyConfig] = useState<StudyConfig>(() => {
    const saved = localStorage.getItem('studyConfig');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { globalSaturday: false, globalSunday: false, weekOverrides: {} };
  });

  const handleStudyConfigChange = (newConfig: StudyConfig) => {
    setStudyConfig(newConfig);
    localStorage.setItem('studyConfig', JSON.stringify(newConfig));
  };
  const [currentTab, setCurrentTab] = useState<'home' | 'syllabus' | 'calendar' | 'profile' | 'boveda'>('home');

  // Tab scroll preservation logic
  const scrollPositionsRef = React.useRef<Record<string, number>>({});

  useEffect(() => {
    const handleScroll = () => {
      scrollPositionsRef.current[currentTab] = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentTab]);

  useEffect(() => {
    const savedScrollPos = scrollPositionsRef.current[currentTab] || 0;
    const timer = setTimeout(() => {
      window.scrollTo({
        top: savedScrollPos,
        behavior: 'instant' as any
      });
    }, 15);
    return () => clearTimeout(timer);
  }, [currentTab]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showPopupBlockedAlert, setShowPopupBlockedAlert] = useState(false);

  // Main Shared States
  const [topicsProgress, setTopicsProgress] = useState<Record<string, UserTopicProgress>>({});
  const [reviewEvents, setReviewEvents] = useState<ReviewEvent[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>('cg-abdomen-agudo-ulcera'); // start with first topic
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [logHoldTimer, setLogHoldTimer] = useState<any>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [isSessionMode, setIsSessionMode] = useState(false);
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false);

  const [dailySummaryModal, setDailySummaryModal] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState({
    time: "20:00",
    days: {
      lunes: true,
      martes: true,
      miercoles: true,
      jueves: true,
      viernes: true,
      sabado: false,
      domingo: false
    }
  });

  const toggleNotificationDay = (dayKey: string) => {
    setNotificationConfig(prev => ({
      ...prev,
      days: { ...prev.days, [dayKey]: !prev.days[dayKey as keyof typeof prev.days] }
    }));
  };

  // iOS Cupertino style custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete_log' | 'reset_topic' | 'reset_specialty' | 'delete_topic' | 'master_reset';
    title: string;
    message: string;
    stepsRequired: number;
    currentStep: number;
    data: any;
  }>({
    isOpen: false,
    type: 'delete_log',
    title: '',
    message: '',
    stepsRequired: 1,
    currentStep: 1,
    data: null
  });

  // Global Search Query State for real-time filtering in StudyCalendar and Syllabus
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  
  // Custom Plan Start Date
  const [planStartDate, setPlanStartDate] = useState<string>(() => {
    return localStorage.getItem('planStartDate') || '2026-06-08';
  });

  const handlePlanStartDateChange = (newDate: string) => {
    setPlanStartDate(newDate);
    localStorage.setItem('planStartDate', newDate);
    showToast(`Fecha de inicio de plan actualizada al ${newDate}.`);
  };

  // Manage Specialty order
  const [specialtyOrder, setSpecialtyOrder] = useState<string[]>(() => {
    const defaultOrder = Array.from(new Set(INITIAL_TOPICS.map(t => t.specialty)));
    const saved = localStorage.getItem('specialtyOrder');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const missing = defaultOrder.filter(s => !parsed.includes(s));
        return [...parsed, ...missing];
      } catch {
        return defaultOrder;
      }
    }
    return defaultOrder;
  });

  // Manage dynamic, custom sequential order of all topics
  const [topics, setTopics] = useState<Topic[]>(() => {
    const savedCustomTopicsStr = localStorage.getItem('customTopics');
    let customTopicsList: Topic[] = [];
    if (savedCustomTopicsStr) {
      try {
        customTopicsList = JSON.parse(savedCustomTopicsStr);
      } catch (e) {}
    }
    const allAvailableTopics = [...INITIAL_TOPICS, ...customTopicsList];

    const savedOrderStr = localStorage.getItem('customTopicOrder');
    if (savedOrderStr) {
      try {
        const order = JSON.parse(savedOrderStr) as string[];
        if (Array.isArray(order) && order.length > 0) {
          const map = new Map(allAvailableTopics.map(t => [t.id, t]));
          const reordered: Topic[] = [];
          
          order.forEach(id => {
            const t = map.get(id);
            if (t) {
              reordered.push(t);
              map.delete(id);
            }
          });
          
          map.forEach(t => {
            reordered.push(t);
          });
          
          return reordered;
        }
      } catch (e) {
        console.error("Failed to parse custom topic order", e);
      }
    }
    
    // Initial sort by the default/saved specialtyOrder
    const defaultOrder = Array.from(new Set(allAvailableTopics.map(t => t.specialty)));
    const savedSpec = localStorage.getItem('specialtyOrder');
    let currentSpecOrder = defaultOrder;
    if (savedSpec) {
      try {
        currentSpecOrder = JSON.parse(savedSpec);
      } catch {}
    }
    
    return [...allAvailableTopics].sort((a, b) => {
      const idxA = currentSpecOrder.indexOf(a.specialty);
      const idxB = currentSpecOrder.indexOf(b.specialty);
      return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
    });
  });

  const handleTopicsChange = (newTopics: Topic[]) => {
    setTopics(newTopics);
    localStorage.setItem('customTopicOrder', JSON.stringify(newTopics.map(t => t.id)));
  };

  const handleSpecialtyOrderChange = (newOrder: string[]) => {
    setSpecialtyOrder(newOrder);
    localStorage.setItem('specialtyOrder', JSON.stringify(newOrder));
    
    // When specialty group order changes, align the active topic studying order
    // as block groupings of those specialties so the dates adapt chronologically.
    setTopics(prevTopics => {
      const rearranged = [...prevTopics].sort((a, b) => {
        const idxA = newOrder.indexOf(a.specialty);
        const idxB = newOrder.indexOf(b.specialty);
        return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
      });
      localStorage.setItem('customTopicOrder', JSON.stringify(rearranged.map(t => t.id)));
      return rearranged;
    });
  };

  const handleAddTopic = (title: string, specialty: string) => {
    const newTopic: Topic = {
      id: `topic-${Date.now()}`,
      title,
      specialty
    };

    // Save metadata to customTopics array in local storage
    const savedCustomTopicsStr = localStorage.getItem('customTopics');
    let customTopicsList: Topic[] = [];
    if (savedCustomTopicsStr) {
      try {
        customTopicsList = JSON.parse(savedCustomTopicsStr);
      } catch (e) {}
    }
    customTopicsList.push(newTopic);
    localStorage.setItem('customTopics', JSON.stringify(customTopicsList));
    
    setTopics(prev => {
      const newTopics = [...prev, newTopic];
      localStorage.setItem('customTopicOrder', JSON.stringify(newTopics.map(t => t.id)));
      return newTopics;
    });

    // Make sure specialty order includes this new specialty if it is new
    setSpecialtyOrder(prev => {
      if (!prev.includes(specialty)) {
        const newOrder = [...prev, specialty];
        localStorage.setItem('specialtyOrder', JSON.stringify(newOrder));
        return newOrder;
      }
      return prev;
    });
  };

  // Load user auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);

      if (currentUser) {
        // Logged in: Sync local progress to Cloud, then fetch official Cloud Data
        try {
          await uploadLocalToCloud(currentUser.uid);
          const cloudProg = await loadProgressCloud(currentUser.uid);
          const cloudRev = await loadReviewsCloud(currentUser.uid);
          
          setTopicsProgress(cloudProg);
          setReviewEvents(cloudRev);
          showToast('Sincronizado con la nube con éxito.');
        } catch (error) {
          console.error("Cloud data fetch failed. Serving offline fallback.", error);
          showToast('Error de sincronización con la nube. Cargando datos locales.');
          loadLocalDataFallback();
        }
      } else {
        // Not logged in: load local data
        loadLocalDataFallback();
      }
    });

    // Check browser notification permission
    if ('Notification' in window) {
      setNotificationEnabled(Notification.permission === 'granted');
    }

    return () => unsubscribe();
  }, []);

  // Select automatically the topic scheduled for today, or if none, the last one scheduled/studied
  useEffect(() => {
    if (topics.length > 0 && Object.keys(topicsProgress).length > 0) {
      if (!sessionStorage.getItem('hasInitiallySelected')) {
        const todayStr = new Date().toISOString().split('T')[0];
        // 1. Scheduled for today or past due and not completed
        const scheduledToday = topics.filter(t => {
          const prog = topicsProgress[t.id];
          return prog && prog.nextReviewDate && prog.nextReviewDate <= todayStr && prog.status !== 'Dominado';
        });

        if (scheduledToday.length > 0) {
          setSelectedTopicId(scheduledToday[0].id);
        } else {
          // 2. If nothing scheduled for today, get the "last scheduled" overall or last studied
          let latestTopicId: string | null = null;
          let latestTime = 0;

          topics.forEach(t => {
            const prog = topicsProgress[t.id];
            if (prog) {
              const nextTime = prog.nextReviewDate ? new Date(prog.nextReviewDate).getTime() : 0;
              const lastTime = prog.lastReviewedAt ? new Date(prog.lastReviewedAt).getTime() : 0;
              const maxTime = Math.max(nextTime, lastTime);
              if (maxTime > latestTime) {
                latestTime = maxTime;
                latestTopicId = t.id;
              }
            }
          });

          if (latestTopicId) {
            setSelectedTopicId(latestTopicId);
          } else {
            // fallback
            if (topics.length > 0) {
              setSelectedTopicId(topics[0].id);
            }
          }
        }
        sessionStorage.setItem('hasInitiallySelected', 'true');
      }
    }
  }, [topics, topicsProgress]);

  const loadLocalDataFallback = () => {
    const lp = getLocalProgress();
    const lr = getLocalReviews();
    setTopicsProgress(lp);
    setReviewEvents(lr);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Google Sign In
  const handleLogin = async () => {
    try {
      // Intentamos abrir la ventana emergente síncronamente antes de realizar cambios de estado asíncronos.
      // Esto evita que los bloqueadores de ventanas emergentes de los navegadores modernos detengan el flujo.
      const loginPromise = signInWithPopup(auth, googleProvider);
      setLoadingAuth(true);
      setShowPopupBlockedAlert(false);
      await loginPromise;
    } catch (error: any) {
      console.error("Error de inicio de sesión con Google:", error);
      if (
        error?.code === 'auth/popup-blocked' || 
        error?.message?.includes('popup-blocked') || 
        error?.message?.includes('popup_blocked') ||
        error?.message?.includes('popup blocked')
      ) {
        setShowPopupBlockedAlert(true);
        showToast('Ventana emergente bloqueada por el navegador.');
      } else if (error?.code === 'auth/cancelled-popup-request') {
        showToast('Inicio de sesión cancelado.');
      } else {
        showToast('Error al iniciar sesión con Google.');
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLoginRedirect = async () => {
    try {
      setLoadingAuth(true);
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      console.error("Error al iniciar sesión con redirección:", error);
      showToast('Error al iniciar sesión con redirección.');
    } finally {
      setLoadingAuth(false);
    }
  };

  // Sign out
  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Sesión cerrada con éxito.');
    } catch (error) {
      console.error(error);
      showToast('Error al cerrar sesión.');
    }
  };

  // Push notifications prompt
  const toggleNotifications = () => {
    if (!('Notification' in window)) {
      showToast('Este navegador no soporta notificaciones de escritorio.');
      return;
    }

    if (Notification.permission === 'denied') {
      showToast('Permiso de notificaciones bloqueado. Actívalo en la barra de direcciones.');
      return;
    }

    Notification.requestPermission().then(permission => {
      const isGranted = permission === 'granted';
      setNotificationEnabled(isGranted);
      if (isGranted) {
        new Notification('👨‍⚕️ Planificador de Repasos Activo', {
          body: 'Te notificaré periódicamente tus tareas de repaso de exámen médica programadas según tu plan.',
        });
        showToast('Notificaciones de escritorio habilitadas.');
      } else {
        showToast('Notificaciones rechazadas o canceladas.');
      }
    });
  };

  // Helper for performance trend calculation on review history loops
  const calculatePerformanceTrend = (log: ReviewHistoryLog[]): 'Mejorando' | 'Estable' | 'Requiere Atención' | 'Nuevo' => {
    if (log.length < 2) return 'Nuevo';
    const scoreMap: Record<string, number> = { 'Fácil': 4, 'Bien': 3, 'Difícil': 2, 'Otra vez': 1 };
    const last = scoreMap[log[log.length - 1].rating as any] || 2;
    const prev = scoreMap[log[log.length - 2].rating as any] || 2;
    if (last > prev) return 'Mejorando';
    if (last < prev) return 'Requiere Atención';
    if (last === 1) return 'Requiere Atención';
    if (last === 4) return 'Mejorando';
    return 'Estable';
  };

  // Helper for Requirement 4: Freno de Emergencia (Emergency Brake) Rule of Efficiency
  const applyEmergencyBrakeAndSync = (
    progressMap: Record<string, UserTopicProgress>,
    activeReviews: ReviewEvent[],
    targetDate: string
  ): {
    newProgressMap: Record<string, UserTopicProgress>;
    newReviews: ReviewEvent[];
    desaturatedCount: number;
  } => {
    // Collect all ungraduated progress items scheduled for targetDate
    const ungraduatedOnDate = Object.values(progressMap).filter(prog => 
      prog.nextReviewDate === targetDate && 
      !prog.isGraduated &&
      prog.status !== 'Sin Empezar'
    );

    if (ungraduatedOnDate.length <= 4) {
      return { newProgressMap: progressMap, newReviews: activeReviews, desaturatedCount: 0 };
    }

    // Since we exceed 4 active ungraduated items on targetDate, we must reschedule 'Fácil' items to subsequents
    const facilesToPostpone = ungraduatedOnDate.filter(prog => prog.rating === 'Fácil');
    if (facilesToPostpone.length === 0) {
      return { newProgressMap: progressMap, newReviews: activeReviews, desaturatedCount: 0 };
    }

    const nextProgress = { ...progressMap };
    let nextReviews = [...activeReviews];
    let desaturatedCount = 0;

    facilesToPostpone.forEach(prog => {
      // Postpone by 2 days so they find lighter schedule blocks ahead
      const baseDate = new Date(targetDate + 'T12:00:00');
      baseDate.setDate(baseDate.getDate() + 2);
      const shiftedStr = baseDate.toISOString().split('T')[0];

      // Update progress item
      const updatedProg = {
        ...nextProgress[prog.topicId],
        nextReviewDate: shiftedStr
      };
      nextProgress[prog.topicId] = updatedProg;
      desaturatedCount++;

      // Shift the active ReviewEvent date as well
      nextReviews = nextReviews.map(ev => {
        if (ev.topicId === prog.topicId && !ev.completed) {
          return { ...ev, date: shiftedStr };
        }
        return ev;
      });

      // Symmetrize with the Firebase persistence layer if user is active
      if (user) {
        saveProgressCloud(user.uid, updatedProg);
        const relatedEv = nextReviews.find(ev => ev.topicId === prog.topicId && !ev.completed);
        if (relatedEv) {
          saveReviewCloud(user.uid, relatedEv);
        }
      }
    });

    return { newProgressMap: nextProgress, newReviews: nextReviews, desaturatedCount };
  };

  // Trigger SRS learning rating on a topic
  const handleRatingSubmit = (topicId: string, rating: StudyRating) => {
    const currentProgress = topicsProgress[topicId] || {
      topicId,
      status: 'Sin Empezar',
      rating: null,
      reviewInterval: 0,
      repetitionsCount: 0,
      lastReviewedAt: null,
      nextReviewDate: null,
      notes: ''
    };

    // Calculate new parameters using spaced repetition algorithm
    const { interval, repetitions, status } = calculateNextReview(
      rating,
      currentProgress.repetitionsCount,
      currentProgress.reviewInterval
    );

    const lastReviewedAt = new Date().toISOString();
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    const nextReviewDate = nextDate.toISOString().split('T')[0]; // Format YYYY-MM-DD for consistency

    // Traceability log calculation
    let elapsedDays = 0;
    if (currentProgress.lastReviewedAt) {
      const msDiff = new Date().getTime() - new Date(currentProgress.lastReviewedAt).getTime();
      elapsedDays = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));
    }

    const newLogItem: ReviewHistoryLog = {
      date: new Date().toISOString().split('T')[0],
      rating,
      elapsedDays
    };
    const finalLog = [...(currentProgress.reviewLog || []), newLogItem];
    const trend = calculatePerformanceTrend(finalLog);

    // Graduation rules evaluation
    const isConsecutiveFacil = finalLog.length >= 2 &&
      finalLog[finalLog.length - 1].rating === 'Fácil' &&
      finalLog[finalLog.length - 2].rating === 'Fácil';

    const qualifiesForGraduation = interval > 60 && isConsecutiveFacil;

    let finalNextReviewDate: string | null = nextReviewDate;
    let finalStatus = status;
    let isGraduatedNow = currentProgress.isGraduated || false;

    if (qualifiesForGraduation) {
      isGraduatedNow = true;
      finalNextReviewDate = null;
      finalStatus = 'Dominado';
    }

    const updatedProgress: UserTopicProgress = {
      ...currentProgress,
      status: finalStatus,
      rating,
      reviewInterval: interval,
      repetitionsCount: repetitions,
      lastReviewedAt,
      nextReviewDate: finalNextReviewDate,
      notes: currentProgress.notes || '',
      reviewLog: finalLog,
      performanceTrend: trend,
      isGraduated: isGraduatedNow
    };

    // Remove all previous pending/uncompleted reviews for this topic to ensure at most one active review exists
    const pendingReviewsToDelete = reviewEvents.filter(e => e.topicId === topicId && !e.completed);
    const cleanOldReviews = reviewEvents.filter(e => !(e.topicId === topicId && !e.completed));

    // Prepare reviews list
    let finalReviewsList: ReviewEvent[] = [];

    if (isGraduatedNow) {
      // Topics that have graduated stop scheduling reviews entirely
      finalReviewsList = [...cleanOldReviews];
    } else {
      const topicDetails = topics.find(t => t.id === topicId);
      const newEvent: ReviewEvent = {
        id: `rev-${topicId}-${Date.now()}`,
        topicId,
        topicTitle: topicDetails?.title || 'Tema de Repaso',
        specialty: topicDetails?.specialty || 'Especialidad',
        date: nextReviewDate,
        completed: false,
        completedAt: null
      };
      finalReviewsList = [...cleanOldReviews, newEvent];
    }

    // Prepare temporary progress mapping before desaturation check
    let mockProgMap = {
      ...topicsProgress,
      [topicId]: updatedProgress
    };

    let processedProgMap = mockProgMap;
    let processedReviews = finalReviewsList;
    let finalDesaturatedCount = 0;

    // Apply emergency brake only if we are scheduling a new active item
    if (!isGraduatedNow && finalNextReviewDate) {
      const brakeResults = applyEmergencyBrakeAndSync(mockProgMap, finalReviewsList, finalNextReviewDate);
      processedProgMap = brakeResults.newProgressMap;
      processedReviews = brakeResults.newReviews;
      finalDesaturatedCount = brakeResults.desaturatedCount;
    }

    // Save of our state memory
    setTopicsProgress(processedProgMap);
    setReviewEvents(processedReviews);

    // Persistence Layer Trigger
    const topicDetails = topics.find(t => t.id === topicId);
    if (user) {
      saveProgressCloud(user.uid, processedProgMap[topicId]);
      
      // Delete any previous pending reviews on the cloud
      pendingReviewsToDelete.forEach(e => {
        deleteReviewCloud(user.uid, e.id);
      });

      // Save new active review event on cloud (if not graduated and exists)
      if (!isGraduatedNow && finalNextReviewDate) {
        const matchingLiveEvent = processedReviews.find(e => e.topicId === topicId && !e.completed);
        if (matchingLiveEvent) {
          saveReviewCloud(user.uid, matchingLiveEvent);
        }
      }
    } else {
      saveLocalProgress(processedProgMap);
      saveLocalReviews(processedReviews);
    }

    if (isGraduatedNow) {
      showToast(`🎓 ¡Felicidades! Tema '${topicDetails?.title}' GRADUADO tras alcanzar intervalo largo y excelente desempeño. Se ha guardado en tu Bóveda de Conocimiento.`);
    } else {
      if (finalDesaturatedCount > 0) {
        showToast(`⚠️ Freno de Emergencia Aplicado: Se detectó saturación en ${finalNextReviewDate}. ${finalDesaturatedCount} repaso(s) fácil(es) pospuesto(s) para aliviar tu agenda clínica.`);
      } else {
        showToast(`Desempeño registrado como ${rating}. Siguiente repaso programado dentro de ${interval} días (${nextReviewDate}).`);
      }
    }
  };

  const handleNotesSave = (topicId: string, notes: string) => {
    const currentProgress = topicsProgress[topicId] || {
      topicId,
      status: 'Sin Empezar',
      rating: null,
      reviewInterval: 0,
      repetitionsCount: 0,
      lastReviewedAt: null,
      nextReviewDate: null,
      notes: ''
    };

    const updated: UserTopicProgress = {
      ...currentProgress,
      notes: notes
    };

    const nextProgMap = {
      ...topicsProgress,
      [topicId]: updated
    };
    setTopicsProgress(nextProgMap);

    if (user) {
      saveProgressCloud(user.uid, updated);
    } else {
      saveLocalProgress(nextProgMap);
    }
  };

  const handleUpdateTopicTracking = (topicId: string, updates: Partial<UserTopicProgress>) => {
    const currentProgress = topicsProgress[topicId] || {
      topicId,
      status: 'Sin Empezar',
      rating: null,
      reviewInterval: 0,
      repetitionsCount: 0,
      lastReviewedAt: null,
      nextReviewDate: null,
      notes: ''
    };

    const updated: UserTopicProgress = {
      ...currentProgress,
      ...updates
    };

    let nextProgMap = {
      ...topicsProgress,
      [topicId]: updated
    };

    let finalReviews = [...reviewEvents];

    // If tracker date is manually edited/dragged & rescheduled, check if it triggers Freno can alleviate schedule load
    if (updates.nextReviewDate) {
      const brakeResults = applyEmergencyBrakeAndSync(nextProgMap, reviewEvents, updates.nextReviewDate);
      if (brakeResults.desaturatedCount > 0) {
        nextProgMap = brakeResults.newProgressMap;
        finalReviews = brakeResults.newReviews;
        showToast(`⚠️ Freno de Emergencia Aplicado: Se pospusieron ${brakeResults.desaturatedCount} tema(s) para mantener tu carga equilibrada.`);
      }
    }

    setTopicsProgress(nextProgMap);
    setReviewEvents(finalReviews);

    if (user) {
      saveProgressCloud(user.uid, nextProgMap[topicId] || updated);
    } else {
      saveLocalProgress(nextProgMap);
      saveLocalReviews(finalReviews);
    }
  };

  const handleTopicStatusChangeManual = (topicId: string, manualStatus: StudyStatus) => {
    const currentProgress = topicsProgress[topicId] || {
      topicId,
      status: 'Sin Empezar',
      rating: null,
      reviewInterval: 0,
      repetitionsCount: 0,
      lastReviewedAt: null,
      nextReviewDate: null,
      notes: ''
    };

    const updated: UserTopicProgress = {
      ...currentProgress,
      status: manualStatus
    };

    const nextProgMap = {
      ...topicsProgress,
      [topicId]: updated
    };
    setTopicsProgress(nextProgMap);

    if (user) {
      saveProgressCloud(user.uid, updated);
    } else {
      saveLocalProgress(nextProgMap);
    }

    showToast(`Estado cambiado a ${manualStatus} manualmente.`);
  };

  const handleDeleteTopic = (topicId: string) => {
    // 1. Remove from topics list
    setTopics(prev => {
      const filtered = prev.filter(t => t.id !== topicId);
      localStorage.setItem('customTopicOrder', JSON.stringify(filtered.map(t => t.id)));
      return filtered;
    });

    // 2. Remove from customTopics if it is custom
    const savedCustomTopicsStr = localStorage.getItem('customTopics');
    if (savedCustomTopicsStr) {
      try {
        const customTopicsList = JSON.parse(savedCustomTopicsStr) as Topic[];
        const filtered = customTopicsList.filter(t => t.id !== topicId);
        localStorage.setItem('customTopics', JSON.stringify(filtered));
      } catch (e) {}
    }

    // 3. Delete progress state and scheduled reviews
    const nextProgMap = { ...topicsProgress };
    delete nextProgMap[topicId];
    setTopicsProgress(nextProgMap);

    const nextReviews = reviewEvents.filter(e => e.topicId !== topicId);
    setReviewEvents(nextReviews);

    if (user) {
      // Sync deletes to cloud
      saveProgressCloud(user.uid, {
        topicId,
        status: 'Sin Empezar',
        rating: null,
        reviewInterval: 0,
        repetitionsCount: 0,
        lastReviewedAt: null,
        nextReviewDate: null,
        reviewLog: [],
        notes: ''
      });
      const cloudReviewsKeys = reviewEvents.filter(e => e.topicId === topicId).map(e => e.id);
      cloudReviewsKeys.forEach(id => deleteReviewCloud(user.uid, id));
    } else {
      saveLocalProgress(nextProgMap);
      saveLocalReviews(nextReviews);
    }

    // 4. Adjust active selection
    if (selectedTopicId === topicId) {
      const remainingTopics = topics.filter(t => t.id !== topicId);
      if (remainingTopics.length > 0) {
        setSelectedTopicId(remainingTopics[0].id);
      } else {
        setSelectedTopicId(null);
      }
    }

    showToast(`Tema eliminado permanentemente.`);
  };

  const handleConfirmProgress = () => {
    // Stage transition checks
    if (confirmModal.currentStep < confirmModal.stepsRequired) {
      if (confirmModal.type === 'reset_topic') {
        setConfirmModal({
          ...confirmModal,
          currentStep: 2,
          title: '🚨 CONFIRMACIÓN CRÍTICA (Paso 2 de 2)',
          message: `Estás a punto de reajustar '${confirmModal.data.topicTitle}' a cero. Esto eliminará de forma irreversible todos los registros históricos de estudio, estadísticas y reprogramará el tema como "Sin Empezar". ¿Seguro que deseas continuar?`
        });
      } else if (confirmModal.type === 'reset_specialty') {
        if (confirmModal.currentStep === 1) {
          setConfirmModal({
            ...confirmModal,
            currentStep: 2,
            title: '⚠️ ADVERTENCIA DEL SISTEMA (Paso 2 de 3)',
            message: `Esta acción de borrado masivo restablecerá TODOS los temas que pertenecen a la especialidad médica '${confirmModal.data.specialtyName}'. Se perderá la trazabilidad completa del grupo. ¿Proceder al paso final de validación?`
          });
        } else if (confirmModal.currentStep === 2) {
          setConfirmModal({
            ...confirmModal,
            currentStep: 3,
            title: '🚨 VALIDACIÓN CLÍNICA FINAL (Paso 3 de 3)',
            message: `CONFIRMACIÓN IRREVOCABLE: ¿Confirmas el restablecimiento total del grupo '${confirmModal.data.specialtyName}'? Esta acción eliminará permanentemente todos tus logros, perlas y calendarios locales y en la nube.`
          });
        }
      } else if (confirmModal.type === 'master_reset') {
        if (confirmModal.currentStep === 1) {
          setConfirmModal({
            ...confirmModal,
            currentStep: 2,
            title: '🚨 DESTRUCCIÓN DE HISTORIAL (Paso 2 de 4)',
            message: 'Atención: se eliminará toda la trazabilidad de estudio e historial de repasos (SRS). Tus estadísticas, intervalos y tendencias se perderán por completo de forma irreversible. ¿Deseas pasar al paso 3?'
          });
        } else if (confirmModal.currentStep === 2) {
          setConfirmModal({
            ...confirmModal,
            currentStep: 3,
            title: '💣 ELIMINACIÓN DE LA NUBE (Paso 3 de 4)',
            message: 'Si has iniciado sesión, esta acción también eliminará todo tu progreso y eventos de repaso de la base de datos segura en Cloud Firestore. Toda la sincronización se reseteará a cero. ¿Proceder al paso obligatorio final?'
          });
        } else if (confirmModal.currentStep === 3) {
          setConfirmModal({
            ...confirmModal,
            currentStep: 4,
            title: '🔥 ¿ESTÁS ABSOLUTAMENTE SEGURO? (Paso 4 de 4)',
            message: 'ACCIÓN IRREVOCABLE: Al hacer clic en "Confirmar", no habrá vuelta atrás. Se restaurará la aplicación al estado de fábrica para todo tu plan de estudios. ¿Escribir inicio de cero ahora?'
          });
        }
      }
      return;
    }

    // Final Action execution
    if (confirmModal.type === 'delete_log') {
      const { topicId, logIndex } = confirmModal.data;
      const progress = topicsProgress[topicId];
      if (progress && progress.reviewLog) {
        const nextLog = [...progress.reviewLog];
        nextLog.splice(logIndex, 1);
        
        let updated: UserTopicProgress;

        if (nextLog.length === 0) {
          // Reset to initial state if no logs are left of this topic
          updated = {
            ...progress,
            status: 'Sin Empezar',
            rating: null,
            reviewInterval: 0,
            repetitionsCount: 0,
            lastReviewedAt: null,
            nextReviewDate: null,
            isGraduated: false,
            performanceTrend: 'Nuevo',
            reviewLog: []
          };
        } else {
          // Recalculate parameters from scratch by replaying the remaining logs
          let reps = 0;
          let interval = 0;
          let status: StudyStatus = 'Sin Empezar';
          let rating: StudyRating | null = null;
          let lastReviewedAt: string | null = null;
          let nextReviewDate: string | null = null;
          let isGraduatedObj = false;

          for (let i = 0; i < nextLog.length; i++) {
            const logItem = nextLog[i];
            rating = logItem.rating;

            const result = calculateNextReview(rating, reps, interval);
            reps = result.repetitions;
            interval = result.interval;
            status = result.status;

            const datePart = logItem.date;
            lastReviewedAt = `${datePart}T12:00:00.000Z`;

            const nextDate = new Date(datePart + 'T12:00:00.000Z');
            nextDate.setDate(nextDate.getDate() + interval);
            nextReviewDate = nextDate.toISOString().split('T')[0];

            // Graduation evaluation
            const isConsecutiveFacil = i >= 1 &&
              nextLog[i].rating === 'Fácil' &&
              nextLog[i - 1].rating === 'Fácil';
            const qualifiesForGraduation = interval > 60 && isConsecutiveFacil;

            if (qualifiesForGraduation) {
              isGraduatedObj = true;
              nextReviewDate = null;
              status = 'Dominado';
            } else {
              isGraduatedObj = false;
            }
          }

          const trend = calculatePerformanceTrend(nextLog);

          updated = {
            ...progress,
            status,
            rating,
            reviewInterval: interval,
            repetitionsCount: reps,
            lastReviewedAt,
            nextReviewDate,
            reviewLog: nextLog,
            performanceTrend: trend,
            isGraduated: isGraduatedObj
          };
        }

        const nextProgMap = {
          ...topicsProgress,
          [topicId]: updated
        };

        // Reschedule/clean review events for this topic
        const pendingReviewsToDelete = reviewEvents.filter(e => e.topicId === topicId && !e.completed);
        const cleanOldReviews = reviewEvents.filter(e => !(e.topicId === topicId && !e.completed));

        let finalReviewsList: ReviewEvent[] = [];

        if (updated.isGraduated || !updated.nextReviewDate) {
          finalReviewsList = [...cleanOldReviews];
        } else {
          const topicDetails = topics.find(t => t.id === topicId);
          const newEvent: ReviewEvent = {
            id: `rev-${topicId}-${Date.now()}`,
            topicId,
            topicTitle: topicDetails?.title || 'Tema de Repaso',
            specialty: topicDetails?.specialty || 'Especialidad',
            date: updated.nextReviewDate,
            completed: false,
            completedAt: null
          };
          finalReviewsList = [...cleanOldReviews, newEvent];
        }

        let processedProgMap = nextProgMap;
        let processedReviews = finalReviewsList;
        let desaturatedCount = 0;

        if (updated.nextReviewDate && !updated.isGraduated) {
          const brakeResults = applyEmergencyBrakeAndSync(nextProgMap, finalReviewsList, updated.nextReviewDate);
          processedProgMap = brakeResults.newProgressMap;
          processedReviews = brakeResults.newReviews;
          desaturatedCount = brakeResults.desaturatedCount;
        }

        setTopicsProgress(processedProgMap);
        setReviewEvents(processedReviews);

        if (user) {
          saveProgressCloud(user.uid, processedProgMap[topicId] || updated);
          
          pendingReviewsToDelete.forEach(e => {
            deleteReviewCloud(user.uid, e.id);
          });

          if (updated.nextReviewDate && !updated.isGraduated) {
            const matchingLiveEvent = processedReviews.find(e => e.topicId === topicId && !e.completed);
            if (matchingLiveEvent) {
              saveReviewCloud(user.uid, matchingLiveEvent);
            }
          }
        } else {
          saveLocalProgress(processedProgMap);
          saveLocalReviews(processedReviews);
        }

        if (desaturatedCount > 0 && updated.nextReviewDate) {
          showToast(`Registro de repaso eliminado. Freno de emergencia aplicado en ${updated.nextReviewDate}: ${desaturatedCount} tema(s) postergado(s).`);
        } else {
          showToast('Registro de repaso eliminado. SRS actualizado y reprogramado correctamente.');
        }
      }
    } else if (confirmModal.type === 'reset_topic') {
      const { topicId } = confirmModal.data;
      const nextProgMap = { ...topicsProgress };
      const emptyProgress: UserTopicProgress = {
        topicId,
        status: 'Sin Empezar',
        rating: null,
        reviewInterval: 0,
        repetitionsCount: 0,
        lastReviewedAt: null,
        nextReviewDate: null,
        notes: '',
        reviewLog: [],
        performanceTrend: 'Nuevo',
        isGraduated: false
      };
      nextProgMap[topicId] = emptyProgress;
      setTopicsProgress(nextProgMap);

      const nextReviews = reviewEvents.filter(e => e.topicId !== topicId);
      setReviewEvents(nextReviews);

      if (user) {
        saveProgressCloud(user.uid, emptyProgress);
        const cloudReviewsKeys = reviewEvents.filter(e => e.topicId === topicId).map(e => e.id);
        cloudReviewsKeys.forEach(id => deleteReviewCloud(user.uid, id));
      } else {
        saveLocalProgress(nextProgMap);
        saveLocalReviews(nextReviews);
      }
      showToast('Progreso del tema restablecido por completo.');
    } else if (confirmModal.type === 'reset_specialty') {
      const { specialtyName } = confirmModal.data;
      const specialtyTopics = topics.filter(t => t.specialty === specialtyName);
      const nextProgMap = { ...topicsProgress };
      const nextReviews = reviewEvents.filter(e => !specialtyTopics.some(st => st.id === e.topicId));

      specialtyTopics.forEach(t => {
        const resetProgress: UserTopicProgress = {
          topicId: t.id,
          status: 'Sin Empezar',
          rating: null,
          reviewInterval: 0,
          repetitionsCount: 0,
          lastReviewedAt: null,
          nextReviewDate: null,
          notes: '',
          reviewLog: [],
          performanceTrend: 'Nuevo',
          isGraduated: false
        };
        nextProgMap[t.id] = resetProgress;
        
        if (user) {
          saveProgressCloud(user.uid, resetProgress);
          const cloudReviewsKeys = reviewEvents.filter(e => e.topicId === t.id).map(e => e.id);
          cloudReviewsKeys.forEach(id => deleteReviewCloud(user.uid, id));
        }
      });

      setTopicsProgress(nextProgMap);
      setReviewEvents(nextReviews);

      if (!user) {
        saveLocalProgress(nextProgMap);
        saveLocalReviews(nextReviews);
      }
      showToast(`Especialidad '${specialtyName}' restablecida por completo.`);
    } else if (confirmModal.type === 'delete_topic') {
      const { topicId } = confirmModal.data;
      handleDeleteTopic(topicId);
    } else if (confirmModal.type === 'master_reset') {
      const nextProgMap: Record<string, UserTopicProgress> = {};
      topics.forEach(t => {
        nextProgMap[t.id] = {
          topicId: t.id,
          status: 'Sin Empezar',
          rating: null,
          reviewInterval: 0,
          repetitionsCount: 0,
          lastReviewedAt: null,
          nextReviewDate: null,
          notes: '',
          reviewLog: [],
          performanceTrend: 'Nuevo',
          isGraduated: false
        };
      });

      const nextReviews: ReviewEvent[] = [];

      setTopicsProgress(nextProgMap);
      setReviewEvents(nextReviews);

      if (user) {
        topics.forEach(t => {
          saveProgressCloud(user.uid, nextProgMap[t.id]);
        });
        reviewEvents.forEach(e => {
          deleteReviewCloud(user.uid, e.id);
        });
      } else {
        saveLocalProgress(nextProgMap);
        saveLocalReviews(nextReviews);
      }
      showToast('RESETEO MAESTRO COMPLETADO: Todo tu progreso e histórico SRS ha vuelto a cero.');
    }

    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const handleSetTopicPriority = (topicId: string, priority: 'Alta' | 'Media' | 'Baja' | null) => {
    const existing = topicsProgress[topicId] || {
      topicId,
      status: 'Sin Empezar',
      rating: null,
      reviewInterval: 0,
      repetitionsCount: 0,
      lastReviewedAt: null,
      nextReviewDate: null,
      notes: '',
      isGraduated: false
    };
    
    const updated = {
      ...existing,
      priority
    };
    
    const nextProgMap = {
      ...topicsProgress,
      [topicId]: updated
    };
    
    setTopicsProgress(nextProgMap);
    
    if (user) {
      saveProgressCloud(user.uid, updated);
    } else {
      saveLocalProgress(nextProgMap);
    }
    
    showToast(`Prioridad del tema actualizada a ${priority ? priority : 'Normal'}.`);
  };

  // Get active selected topic details
  const activeTopic = topics.find(t => t.id === selectedTopicId);
  const activeProgress = selectedTopicId ? topicsProgress[selectedTopicId] : null;

  // Count pending reviews for today or past due
  const todayStr = new Date().toISOString().split('T')[0];
  const pendingReviewsCount = topics.filter(t => {
    const prog = topicsProgress[t.id];
    if (!prog || !prog.nextReviewDate) return false;
    return prog.nextReviewDate <= todayStr && prog.status !== 'Dominado';
  }).length;

  return (
    <div className={'dark'}>
      <div className="noise-bg mix-blend-overlay"></div>
      <div className="min-h-screen bg-slate-950 font-sans text-slate-300 transition-colors duration-300 flex flex-col relative z-0">
        
        {/* Navigation Top Header Bar */}
        {!isSessionMode && (
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
          <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
            
            {/* Logo and App Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center text-white shrink-0 bg-transparent relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent"></div>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-serif text-white tracking-widest leading-none mb-1 uppercase">
                  Planificador
                </span>
                <span className="text-[9px] text-[#9d8afe] font-mono tracking-[0.2em] leading-none uppercase">Clínico • Dr. Jorge Barrios</span>
              </div>
            </div>

            {/* Global Search Bar (Real-time sync) */}
            <div className="hidden lg:flex items-center gap-2 relative w-64 max-w-xs xl:w-72">
              <Search className="w-3.5 h-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="BÚSQUEDA GLOBAL..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-1.5 bg-transparent border border-slate-800 hover:border-slate-600 transition-all rounded-full text-[10px] font-mono tracking-widest text-[#e2dbea] placeholder-slate-500/70 focus:outline-none focus:border-white focus:bg-slate-900/40"
              />
              {globalSearchQuery && (
                <button 
                  onClick={() => setGlobalSearchQuery('')}
                  className="absolute right-3 p-1 text-slate-500 hover:text-white text-[10px] cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* In-tab switch indicators */}
            <nav className="hidden md:flex items-center gap-6">
              <button
                onClick={() => setCurrentTab('home')}
                className={`text-[10px] font-mono tracking-widest uppercase transition-all cursor-pointer border-b-2 pb-1 flex items-center gap-1.5 ${
                  currentTab === 'home'
                    ? 'text-white border-white'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Inicio
              </button>
              <button
                onClick={() => setCurrentTab('syllabus')}
                className={`text-[10px] font-mono tracking-widest uppercase transition-all cursor-pointer border-b-2 pb-1 ${
                  currentTab === 'syllabus'
                    ? 'text-white border-white'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                Temas ({topics.length})
              </button>
              <button
                onClick={() => setCurrentTab('calendar')}
                className={`text-[10px] font-mono tracking-widest uppercase transition-all cursor-pointer border-b-2 pb-1 ${
                  currentTab === 'calendar'
                    ? 'text-white border-white'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                Calendario
              </button>
              <button
                onClick={() => setCurrentTab('boveda')}
                className={`text-[10px] font-mono tracking-widest uppercase transition-all cursor-pointer flex items-center gap-1.5 border-b-2 pb-1 ${
                  currentTab === 'boveda'
                    ? 'text-[#9d8afe] border-[#9d8afe] font-bold'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                La Bóveda
              </button>
              <button
                onClick={() => setCurrentTab('profile')}
                className={`text-[10px] font-mono tracking-widest uppercase transition-all cursor-pointer border-b-2 pb-1 ${
                  currentTab === 'profile'
                    ? 'text-white border-white'
                    : 'text-slate-400 border-transparent hover:text-white'
                }`}
              >
                Nube & Perfil
              </button>
            </nav>

            {/* Quick action tools */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 relative">
                {/* Custom Notifications Droppable Icon Toggle */}
                <button
                  onClick={() => setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen)}
                  title="Notificaciones"
                  className={`w-8 h-8 rounded-full border transition-all cursor-pointer flex items-center justify-center p-0 relative ${
                    isNotificationsDropdownOpen || pendingReviewsCount > 0
                      ? 'border-[#9d8afe] text-[#9d8afe] bg-[#2a1b5c]/30' 
                      : 'border-slate-800 text-[#766a87] bg-transparent hover:border-white hover:text-white'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {pendingReviewsCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {isNotificationsDropdownOpen && (
                  <div className="absolute right-0 top-10 w-80 bg-slate-900/98 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-2xl z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-xs uppercase tracking-widest text-[#e2dbea]">Notificaciones</span>
                      {pendingReviewsCount > 0 && (
                        <span className="text-[10px] font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-amber-500 font-semibold animate-pulse">
                          {pendingReviewsCount} pendientes
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {pendingReviewsCount > 0 ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                            <div className="flex items-center gap-2 text-amber-500 font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                              <span>Repasos Programados</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">
                              El algoritmo de repetición espaciada SRS tiene <strong>{pendingReviewsCount} temas</strong> listos para consolidar tu aprendizaje hoy.
                            </p>
                            <button
                              onClick={() => {
                                setCurrentTab('calendar');
                                setIsNotificationsDropdownOpen(false);
                              }}
                              className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                            >
                              Ir a Calendario
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 space-y-1.5">
                          <div className="text-xl">✨</div>
                          <p className="text-[10px] font-bold text-slate-300">¡Todo al día!</p>
                          <p className="text-[9px] text-slate-500 max-w-[200px] mx-auto leading-normal">
                            No tienes repasos agendados pendientes para hoy. El algoritmo SRS se actualizará con tus avances.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-850 pt-2.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                        <span>Notificaciones de escritorio:</span>
                        <span className={notificationEnabled ? "text-emerald-400 font-bold" : "text-slate-500"}>
                          {notificationEnabled ? 'ACTIVADAS' : 'DESACTIVADAS'}
                        </span>
                      </div>
                      
                      {!notificationEnabled && (
                        <button
                          onClick={toggleNotifications}
                          className="w-full text-center py-1 bg-slate-800 hover:bg-slate-750 hover:text-white rounded-lg text-[9px] font-bold transition-all uppercase tracking-wider"
                        >
                          Habilitar push de escritorio 🚀
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Status indicator backup */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-transparent rounded-full border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9d8afe] opacity-80 shadow-[0_0_8px_rgba(157,138,254,0.8)] animate-pulse" />
                <span className="text-[9px] font-mono font-bold text-[#e2dbea] uppercase tracking-[0.2em]">
                  ONLINE
                </span>
              </div>
            </div>
          </div>
        </header>
        )}

        {/* Mobile bottom nav utilities bar */}
        {!isSessionMode && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 py-2 border-t border-slate-800 bg-slate-900/95 backdrop-blur z-40 flex justify-around">
          <button
            onClick={() => setCurrentTab('home')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
              currentTab === 'home' ? 'text-[#9d8afe]' : 'text-slate-400'
            }`}
          >
            <Sparkles className="w-4.5 h-4.5" />
            <span>Inicio</span>
          </button>
          <button
            onClick={() => setCurrentTab('syllabus')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
              currentTab === 'syllabus' ? 'text-[#9d8afe]' : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-4.5 h-4.5" />
            <span>Temas</span>
          </button>
          <button
            onClick={() => setCurrentTab('calendar')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
              currentTab === 'calendar' ? 'text-sky-500' : 'text-slate-400'
            }`}
          >
            <Calendar className="w-4.5 h-4.5" />
            <span>Calendario</span>
          </button>
          <button
            onClick={() => setCurrentTab('boveda')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
              currentTab === 'boveda' ? 'text-[#9d8afe] font-bold' : 'text-slate-400'
            }`}
          >
            <GraduationCap className="w-4.5 h-4.5" />
            <span>Bóveda</span>
          </button>
          <button
            onClick={() => setCurrentTab('profile')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
              currentTab === 'profile' ? 'text-sky-500' : 'text-slate-400'
            }`}
          >
            <User className="w-4.5 h-4.5" />
            <span>Nube</span>
          </button>
        </div>
        )}

        {/* Body Main layout wrapper */}
        <main className={`max-w-7xl mx-auto px-4 py-6 ${isSessionMode ? 'pb-6 pt-4' : 'pb-24 md:pb-12'} space-y-6 w-full`}>
          
          {/* Toast Notification Alert layer */}
          {toastMessage && (
            <div className="p-3.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl border border-slate-800 dark:border-slate-700 shadow-xl text-xs flex items-center justify-between gap-3 animate-fade-in z-50">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="text-[10px] text-sky-400 hover:underline">
                Cerrar
              </button>
            </div>
          )}

          {/* TAB PANELS ELEMENT */}

          <div className={currentTab === 'home' ? '' : 'hidden'}>
            <Home 
              topics={topics}
              topicsProgress={topicsProgress}
              onNavigate={setCurrentTab}
            />
          </div>

          {/* Tab 1: Syllabus & AI Mentor (Splitted layouts grid) */}
          <div className={currentTab === 'syllabus' ? '' : 'hidden'}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: specialties syllabus directory tree */}
              {!isSessionMode && (
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 mt-2 px-2">
                    <div className="flex items-center gap-2">
                      <BookMarked className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Plan de Estudios
                      </h3>
                      <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded font-mono">
                        {topics.length} Temas
                      </span>
                    </div>
                    <div className="relative group/tooltip">
                      <button
                        id="btn-master-reset-progress"
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            type: 'master_reset',
                            title: '⚠️ REINICIO MAESTRO DE DATOS (Paso 1 de 4)',
                            message: 'Estás por reiniciar absolutamente todos los temas de estudio en la aplicación. Esto borrará el progreso de cada especialidad y regresará todos los temas a "Sin Empezar". ¿Deseas iniciar este proceso de confirmación?',
                            stepsRequired: 4,
                            currentStep: 1,
                            data: null
                          });
                        }}
                        className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 border border-rose-500/20 shadow-sm shadow-rose-950/20 rounded-lg hover:bg-rose-500/25 active:bg-rose-500/35 transition-all flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                        title="Reiniciar todo el avance del plan de estudios clínico (4 pasos de confirmación)"
                      >
                        <Trash2 className="w-3 h-3 animate-pulse" />
                        Reseteo Maestro
                      </button>
                      <div className="absolute right-0 bottom-full mb-2 bg-slate-950 text-slate-200 border border-slate-800 text-[10px] p-2.5 rounded-xl w-56 shadow-2xl pointer-events-none transition-all duration-250 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible z-40 font-medium normal-case flex flex-col gap-1 text-left leading-normal">
                        <span className="font-bold text-rose-400 flex items-center gap-1">⚠️ Impacto Crítico:</span>
                        <span>Resetea a cero todo el avance e histórico SRS de todos tus temas en la app y base de datos (Requiere confirmación en 4 pasos).</span>
                      </div>
                    </div>
                  </div>
                  <Syllabus 
                    topics={topics}
                    topicsProgress={topicsProgress} 
                    selectedTopicId={selectedTopicId} 
                    onSelectTopic={(topicId) => setSelectedTopicId(topicId)} 
                    specialtyOrder={specialtyOrder}
                    onAddTopic={handleAddTopic}
                    onSpecialtyOrderChange={handleSpecialtyOrderChange}
                    onTopicsChange={handleTopicsChange}
                    onSetTopicPriority={handleSetTopicPriority}
                    searchQuery={globalSearchQuery}
                    onSearchQueryChange={setGlobalSearchQuery}
                    onDeleteTopic={(topicId) => {
                      const topicToDelete = topics.find(t => t.id === topicId);
                      if (topicToDelete) {
                        setConfirmModal({
                          isOpen: true,
                          type: 'delete_topic',
                          title: 'Eliminar Tema del Catálogo',
                          message: `¿Estás seguro de que deseas eliminar permanentemente el tema clínico '${topicToDelete.title}' del catálogo? Esta acción borrará permanentemente todo su progreso y planificación.`,
                          stepsRequired: 1,
                          currentStep: 1,
                          data: { topicId }
                        });
                      }
                    }}
                    onResetSpecialty={(specialtyName) => {
                      setConfirmModal({
                        isOpen: true,
                        type: 'reset_specialty',
                        title: 'Restablecer Especialidad (Paso 1 de 3)',
                        message: `¿Estás completamente seguro de que quieres restablecer a cero todo el progreso de la especialidad '${specialtyName}'? Todos sus temas volverán a su estado "Sin Empezar".`,
                        stepsRequired: 3,
                        currentStep: 1,
                        data: { specialtyName }
                      });
                    }}
                  />
                </div>
              </div>
              )}

              {/* Right Column: Active study element detail & AI Clinical Mentor */}
              <div className={isSessionMode ? "lg:col-span-12" : "lg:col-span-7"}>
                {activeTopic ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    {/* Active Topic Header banner summary card */}
                    <div className="p-6 border-b border-slate-800 bg-slate-800/30 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full w-fit">
                          {activeTopic.specialty}
                        </span>

                        {/* Rating status configuration indicators */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-slate-800/40 p-1 px-2 rounded-lg border border-slate-800">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Estado:</label>
                            <select
                              value={activeProgress?.status || 'Sin Empezar'}
                              onChange={(e) => handleTopicStatusChangeManual(activeTopic.id, e.target.value as StudyStatus)}
                              className="bg-transparent border-none rounded-lg text-xs font-semibold px-1 py-0.5 text-slate-300 focus:outline-none cursor-pointer"
                            >
                              <option value="Sin Empezar">Sin Empezar</option>
                              <option value="Estudiado">Estudiado</option>
                              <option value="En Repaso">En Repaso</option>
                              <option value="Dominado">Dominado</option>
                            </select>
                          </div>

                          <button
                            onClick={() => setIsSessionMode(!isSessionMode)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 ${isSessionMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'} border rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-all shrink-0`}
                            title={isSessionMode ? "Salir de Modo Sesión" : "Activar Modo Sesión (Ocultar distracciones)"}
                          >
                            <Eye className={`w-3.5 h-3.5 ${isSessionMode ? 'text-white' : 'text-slate-400'}`} />
                            <span>{isSessionMode ? "Salir" : "Sesión"}</span>
                          </button>

                          <div className="relative group/tooltip">
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  type: 'reset_topic',
                                  title: 'Reajustar Tema a Cero (Paso 1 de 2)',
                                  message: `¿Estás seguro de que deseas restablecer el progreso de '${activeTopic.title}'? Conservarás el tema en la lista, pero se vaciará todo su historial, perlas y estados SRS de forma irreversible.`,
                                  stepsRequired: 2,
                                  currentStep: 1,
                                  data: { topicId: activeTopic.id, topicTitle: activeTopic.title }
                                });
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/30 rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-colors shrink-0"
                              title="Reiniciar todo el progreso de este tema"
                            >
                              <RefreshCw className="w-3 h-3 text-amber-500" />
                              <span>Reiniciar Progreso</span>
                            </button>
                            <div className="absolute right-0 bottom-full mb-2 bg-slate-950 text-slate-200 border border-slate-850 text-[10px] p-2.5 rounded-xl w-52 shadow-2xl pointer-events-none transition-all duration-250 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible z-45 font-medium normal-case flex flex-col gap-1 text-left leading-normal">
                              <span className="font-bold text-amber-400 flex items-center gap-1">⚠️ Impacto de Reajuste:</span>
                              <span>Restablece a cero y borra todo el historial y estados de repetición espaciada SRS de este tema, pero lo conserva en tu catálogo.</span>
                            </div>
                          </div>

                          <div className="relative group/tooltip">
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  type: 'delete_topic',
                                  title: 'Eliminar Tema del Catálogo',
                                  message: `¿Estás completamente seguro de que deseas eliminar permanentemente el tema '${activeTopic.title}'? Esta acción eliminará el tema clínico de todo tu plan, calendarios y estadísticas.`,
                                  stepsRequired: 1,
                                  currentStep: 1,
                                  data: { topicId: activeTopic.id }
                                });
                              }}
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 border border-rose-500/20 hover:border-rose-500/30 rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-colors shrink-0"
                              title="Eliminar tema permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>Eliminar Tema</span>
                            </button>
                            <div className="absolute right-0 bottom-full mb-2 bg-slate-950 text-slate-200 border border-slate-850 text-[10px] p-2.5 rounded-xl w-52 shadow-2xl pointer-events-none transition-all duration-250 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible z-45 font-medium normal-case flex flex-col gap-1 text-left leading-normal">
                              <span className="font-bold text-rose-400 flex items-center gap-1">⚠️ Impacto Crítico:</span>
                              <span>Elimina el tema permanentemente de tu catálogo, planes de estudio, calendarios e históricos de repetición.</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-white leading-tight mt-2 flex flex-wrap items-center gap-2">
                        {activeTopic.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {activeProgress?.isGraduated && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md">
                            <GraduationCap className="w-3.5 h-3.5" /> Graduado 🎓
                          </span>
                        )}
                        {activeProgress?.performanceTrend && (
                          <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md ${
                            activeProgress.performanceTrend === 'Mejorando' 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                              : activeProgress.performanceTrend === 'Requiere Atención'
                              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 animate-pulse'
                              : activeProgress.performanceTrend === 'Estable'
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                              : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                          }`}>
                            Tendencia: {activeProgress.performanceTrend}
                          </span>
                        )}
                      </div>

                      {/* Repetition Stats mini display panel */}
                      {activeProgress && activeProgress.lastReviewedAt && (
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-800">
                          <span className="flex items-center gap-1.5">
                            REPASOS: <strong className="text-white">{activeProgress.repetitionsCount}</strong>
                          </span>
                          <span className="flex items-center gap-1.5 border-l border-slate-700 pl-6">
                            ÚLTIMA REV: <strong className="text-white">{new Date(activeProgress.lastReviewedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</strong>
                          </span>
                          <span className="flex items-center gap-1.5 border-l border-slate-700 pl-6">
                            SRS: <strong className="text-white">{activeProgress.reviewInterval} días</strong>
                          </span>
                        </div>
                      )}

                      {/* Requirement 1: Interactive Review History Log list */}
                      {activeProgress?.reviewLog && activeProgress.reviewLog.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Historial de Repasos (Log Transversal)</p>
                          <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                            {[...activeProgress.reviewLog]
                              .map((log, idx) => ({ ...log, originalIdx: idx }))
                              .reverse()
                              .map((log) => {
                                const handleLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
                                  if (logHoldTimer) clearTimeout(logHoldTimer);
                                  const timer = setTimeout(() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      type: 'delete_log',
                                      title: 'Borrar Registro Clínico',
                                      message: `¿Estás seguro de que deseas eliminar permanentemente de tu trazabilidad este registro de estudio del día ${log.date}?`,
                                      stepsRequired: 1,
                                      currentStep: 1,
                                      data: { topicId: activeTopic.id, logIndex: log.originalIdx }
                                    });
                                  }, 600);
                                  setLogHoldTimer(timer);
                                };

                                const handleLongPressEnd = () => {
                                  if (logHoldTimer) {
                                    clearTimeout(logHoldTimer);
                                    setLogHoldTimer(null);
                                  }
                                };

                                return (
                                  <div 
                                    key={log.originalIdx} 
                                    onTouchStart={handleLongPressStart}
                                    onTouchEnd={handleLongPressEnd}
                                    onMouseDown={handleLongPressStart}
                                    onMouseUp={handleLongPressEnd}
                                    onMouseLeave={handleLongPressEnd}
                                    className="relative flex-shrink-0 min-w-28 p-2 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1 text-[10px] group transition-all select-none"
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmModal({
                                          isOpen: true,
                                          type: 'delete_log',
                                          title: 'Borrar Registro Clínico',
                                          message: `¿Estás seguro de que deseas eliminar permanentemente de tu trazabilidad este registro de estudio del día ${log.date}?`,
                                          stepsRequired: 1,
                                          currentStep: 1,
                                          data: { topicId: activeTopic.id, logIndex: log.originalIdx }
                                        });
                                      }}
                                      className="absolute top-1 right-1 hidden sm:flex opacity-0 group-hover:opacity-100 focus:opacity-100 h-4.5 w-4.5 rounded-full bg-slate-800 border border-slate-700/85 hover:bg-rose-550/20 text-slate-400 hover:text-rose-450 items-center justify-center transition-all cursor-pointer z-10"
                                      title="Eliminar este repaso"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                    <div className="flex items-center justify-between gap-1.5 pr-2">
                                      <span className="text-slate-500 font-medium">{log.date}</span>
                                      <span className={`font-bold px-1 rounded-sm text-[9px] shrink-0 ${
                                        log.rating === 'Fácil' ? 'text-emerald-400 bg-emerald-500/10' :
                                        log.rating === 'Bien' ? 'text-sky-400 bg-sky-500/10' :
                                        log.rating === 'Difícil' ? 'text-orange-400 bg-orange-500/10' :
                                        'text-rose-400 bg-rose-500/10'
                                      }`}>{log.rating}</span>
                                    </div>
                                    <div className="text-slate-400">
                                      Transcurrido: <strong className="text-slate-200">{log.elapsedDays} días</strong>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Active study content interaction tabs */}
                    <div className="p-6 space-y-6">
                      
                      {/* Sub-card: Perform dynamic session evaluation SRS */}
                      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-300">¿Cómo estuvo tu repaso hoy para calcular tu próximo intérvalo?</p>
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">SRS Leitner</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <button
                            id="btn-rate-otra-vez"
                            onClick={() => handleRatingSubmit(activeTopic.id, 'Otra vez')}
                            className="p-3 bg-rose-500/10 hover:bg-rose-500/15 active:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-extrabold transition-all transform active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center"
                          >
                            <span className="text-normal">Otra vez</span>
                            <span className="text-[9px] text-rose-600/80 dark:text-rose-300/80 font-medium font-mono">
                              {getRealWaitTimeLabel('Otra vez', activeProgress?.repetitionsCount || 0, activeProgress?.reviewInterval || 0, '1d')}
                            </span>
                          </button>
                          <button
                            id="btn-rate-dificil"
                            onClick={() => handleRatingSubmit(activeTopic.id, 'Difícil')}
                            className="p-3 bg-amber-500/10 hover:bg-amber-500/15 active:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-extrabold transition-all transform active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center"
                          >
                            <span className="text-normal">Difícil</span>
                            <span className="text-[9px] text-amber-600/80 dark:text-amber-300/80 font-medium font-mono">
                              {getRealWaitTimeLabel('Difícil', activeProgress?.repetitionsCount || 0, activeProgress?.reviewInterval || 0, '×1.2')}
                            </span>
                          </button>
                          <button
                            id="btn-rate-bien"
                            onClick={() => handleRatingSubmit(activeTopic.id, 'Bien')}
                            className="p-3 bg-sky-500/10 hover:bg-sky-500/15 active:bg-sky-500/20 border border-sky-500/20 hover:border-sky-500/40 text-sky-700 dark:text-sky-400 rounded-xl text-xs font-extrabold transition-all transform active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center"
                          >
                            <span className="text-normal">Bien</span>
                            <span className="text-[9px] text-sky-600/80 dark:text-sky-300/80 font-medium font-mono">
                              {getRealWaitTimeLabel('Bien', activeProgress?.repetitionsCount || 0, activeProgress?.reviewInterval || 0, '×2.0')}
                            </span>
                          </button>
                          <button
                            id="btn-rate-facil"
                            onClick={() => handleRatingSubmit(activeTopic.id, 'Fácil')}
                            className="p-3 bg-emerald-500/10 hover:bg-emerald-500/15 active:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-extrabold transition-all transform active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center"
                          >
                            <span className="text-normal">Fácil</span>
                            <span className="text-[9px] text-emerald-600/80 dark:text-emerald-300/80 font-medium font-mono">
                              {getRealWaitTimeLabel('Fácil', activeProgress?.repetitionsCount || 0, activeProgress?.reviewInterval || 0, '×3.5')}
                            </span>
                          </button>
                        </div>
                        
                        <div className="pt-2">
                          <button
                            onClick={() => setDailySummaryModal(true)}
                            className="w-full py-3 bg-indigo-600/10 hover:bg-indigo-600/20 active:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Finalizar Sesión Clínica del Día
                          </button>
                        </div>
                      </div>

                      {/* Render actual clinical mentor chatbot/perlas component */}
                      <AICoach 
                        topic={activeTopic}
                        currentNotes={activeProgress?.notes || ''}
                        onSavedNote={(notes) => handleNotesSave(activeTopic.id, notes)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                    <BookOpen className="w-10 h-10 mx-auto opacity-50" />
                    <p className="text-sm font-medium">Selecciona un tema clínico del plan de estudios a la izquierda para ver el material de repaso y apuntes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tab 2: Calendar planner details */}
          <div className={currentTab === 'calendar' ? '' : 'hidden'}>
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Agenda Académica de Repasos</h2>
                  <p className="text-sm text-slate-300">Controla tus sesiones de estudio y repeticiones espaciadas.</p>
                </div>
              </div>
              <StudyCalendar 
                topics={topics}
                onTopicsChange={handleTopicsChange}
                studyConfig={studyConfig}
                onStudyConfigChange={handleStudyConfigChange}
                topicsProgress={topicsProgress} 
                reviewEvents={reviewEvents} 
                onCompleteReview={(topicId, rating) => handleRatingSubmit(topicId, rating)}
                onUpdateTopicTracking={handleUpdateTopicTracking}
                specialtyOrder={specialtyOrder}
                onSpecialtyOrderChange={handleSpecialtyOrderChange}
                planStartDate={planStartDate}
                onPlanStartDateChange={handlePlanStartDateChange}
                searchQuery={globalSearchQuery}
                onSearchQueryChange={setGlobalSearchQuery}
              />
            </div>
          </div>

          {/* Tab Boveda: Library of graduated clinical topics */}
          <div className={currentTab === 'boveda' ? '' : 'hidden'}>
            <Boveda
              topics={topics}
              topicsProgress={topicsProgress}
              onSelectTopic={(topicId) => {
                setCurrentTab('syllabus');
                setSelectedTopicId(topicId);
              }}
            />
          </div>

          {/* Tab 4: Cloud Sync & Profile setup */}
          <div className={currentTab === 'profile' ? '' : 'hidden'}>
            <div className="max-w-2xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Sincronización en la Nube & Perfil</h2>
                    <p className="text-xs text-slate-500">Resguarda tus avances y accede desde cualquier dispositivo.</p>
                  </div>
                </div>
                
                <button
                  onClick={() => exportToPDF('academic-report-container', 'Reporte_Academico_Planificador.pdf')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/20 shrink-0"
                  title="Generar y descargar un reporte PDF de tu progreso y temas graduados"
                >
                  <Download className="w-4 h-4" /> Exportar Reporte PDF
                </button>
              </div>

              {/* Racha / Streak Banner */}
              <div className="p-4 bg-gradient-to-r from-orange-500/10 to-rose-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center shrink-0 relative">
                    <span className="text-2xl">🔥</span>
                    {(() => {
                      // Inline streak calculation
                      const allStudyDates = new Set<string>();
                      Object.values(topicsProgress).forEach((prog: any) => {
                        prog.reviewLog?.forEach((log: any) => allStudyDates.add(log.date.split('T')[0]));
                        if (prog.lastReviewedAt) allStudyDates.add(new Date(prog.lastReviewedAt).toISOString().split('T')[0]);
                      });
                      const sortedDates = Array.from(allStudyDates).sort((a, b) => b.localeCompare(a));
                      let streak = 0;
                      if (sortedDates.length > 0) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const yestD = new Date(); yestD.setDate(yestD.getDate() - 1);
                        const yesterdayStr = yestD.toISOString().split('T')[0];
                        
                        if (sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr)) {
                          let currentDateStr = sortedDates.includes(todayStr) ? todayStr : yesterdayStr;
                          for (const d of sortedDates) {
                            if (d > currentDateStr) continue;
                            if (d === currentDateStr) {
                              streak++;
                              const prev = new Date(currentDateStr + 'T12:00:00Z');
                              prev.setDate(prev.getDate() - 1);
                              currentDateStr = prev.toISOString().split('T')[0];
                            } else break;
                          }
                        }
                      }
                      if (streak > 5) return <span className="absolute -top-1 -right-1 text-xs animate-bounce" title="Racha en llamas">🔥</span>;
                      return null;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Racha de Estudio Activa</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Mantén la consistencia realizando al menos un repaso diario.</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                    {(() => {
                      // Inline streak calculation duplicated for number
                      const allStudyDates = new Set<string>();
                      Object.values(topicsProgress).forEach((prog: any) => {
                        prog.reviewLog?.forEach((log: any) => allStudyDates.add(log.date.split('T')[0]));
                        if (prog.lastReviewedAt) allStudyDates.add(new Date(prog.lastReviewedAt).toISOString().split('T')[0]);
                      });
                      const sortedDates = Array.from(allStudyDates).sort((a, b) => b.localeCompare(a));
                      let streak = 0;
                      if (sortedDates.length > 0) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const yestD = new Date(); yestD.setDate(yestD.getDate() - 1);
                        const yesterdayStr = yestD.toISOString().split('T')[0];
                        
                        if (sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr)) {
                          let currentDateStr = sortedDates.includes(todayStr) ? todayStr : yesterdayStr;
                          for (const d of sortedDates) {
                            if (d > currentDateStr) continue;
                            if (d === currentDateStr) {
                              streak++;
                              const prev = new Date(currentDateStr + 'T12:00:00Z');
                              prev.setDate(prev.getDate() - 1);
                              currentDateStr = prev.toISOString().split('T')[0];
                            } else break;
                          }
                        }
                      }
                      return streak;
                    })()}
                  </span>
                  <span className="text-xs text-orange-500/70 font-bold ml-1 uppercase tracking-widest">Días</span>
                </div>
              </div>

              {loadingAuth ? (
                <div className="py-12 text-center text-slate-500 animate-pulse">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-4" />
                  <p className="text-sm font-semibold">Verificando sesión de seguridad...</p>
                </div>
              ) : user ? (
                // User logged in screen
                <div className="space-y-6">
                  <div className="p-5 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Médico Activo</p>
                      <h4 className="text-base font-bold text-white">{user.displayName || 'Doctor / Candidato'}</h4>
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Cerrar Sesión
                    </button>
                  </div>

                  <div className="p-4 border-l-4 border-emerald-500 bg-emerald-500/10 rounded-r-xl space-y-2 text-sm">
                    <span className="font-bold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" /> Sincronización en la Nube Activa
                    </span>
                    <p className="text-emerald-100/70 leading-relaxed">
                      Tus {Object.keys(topicsProgress).length} estados de temas estudiados y {reviewEvents.length} eventos históricos de repaso están respaldados con tu cuenta Google de forma cifrada en Firestore Enterprise Cloud.
                    </p>
                  </div>

                  {/* Manual force synchronization button */}
                  <button
                    onClick={async () => {
                      setLoadingAuth(true);
                      try {
                        await uploadLocalToCloud(user.uid);
                        const cleanProg = await loadProgressCloud(user.uid);
                        const cleanRev = await loadReviewsCloud(user.uid);
                        setTopicsProgress(cleanProg);
                        setReviewEvents(cleanRev);
                        showToast('Sincronización manual forzada realizada con éxito.');
                      } catch (err: any) {
                        console.error(err);
                        showToast('Error al forzar sincronización manual.');
                      } finally {
                        setLoadingAuth(false);
                      }
                    }}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                  >
                    <RefreshCw className="w-5 h-5" /> Forzar Respaldo y Sincronización Manual Ahora
                  </button>
                </div>
              ) : (
                // User logged out screen
                <div className="space-y-6 text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                    <CloudIcon className="w-8 h-8 shrink-0" />
                  </div>
                  <div className="space-y-2 max-w-sm mx-auto">
                    <h3 className="text-base font-bold text-white">Copia de Seguridad Desactivada</h3>
                    <p className="text-sm text-slate-400">
                      Actualmente tus datos se guardan estrictamente en la memoria local de tu dispositivo. Podrías perderlos si borras el historial.
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-4">
                    <button
                      onClick={handleLogin}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      <LogIn className="w-5 h-5" /> Vincular con Google Sign-In
                    </button>

                    {showPopupBlockedAlert && (
                      <div className="max-w-md mx-auto p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left space-y-3 mt-4">
                        <div className="flex gap-2 text-amber-500 font-bold text-xs items-center">
                          <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                          <span>Bloqueador de Ventanas Activo</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          La ventana emergente de inicio de sesión de Google fue bloqueada. Esto es sumamente común cuando usas la app integrada dentro de la vista previa de AI Studio.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Puedes habilitar las ventanas emergentes en la barra de direcciones de tu navegador, o utilizar una de las siguientes alternativas seguras:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={handleLoginRedirect}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white rounded-lg text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Usar Redirección
                          </button>
                          <a
                            href={window.location.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Nueva Pestaña ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Advanced Notification Settings */}
              <div className="pt-6 border-t border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Configuración de Recordatorios</h3>
                    <p className="text-[11px] text-slate-400">Elige a qué hora y qué días quieres recibir recordatorios.</p>
                  </div>
                </div>

                <div className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase font-bold text-slate-500 min-w-16">Días</span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {Object.keys(notificationConfig.days).map((dayKey) => (
                        <button
                          key={dayKey}
                          onClick={() => toggleNotificationDay(dayKey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            notificationConfig.days[dayKey as keyof typeof notificationConfig.days]
                              ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_10px_rgba(79,70,229,0.1)]'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {dayKey.charAt(0).toUpperCase() + dayKey.slice(1, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase font-bold text-slate-500 min-w-16">Hora</span>
                    <input
                      type="time"
                      value={notificationConfig.time}
                      onChange={(e) => setNotificationConfig(prev => ({ ...prev, time: e.target.value }))}
                      className="bg-slate-900 border border-slate-800 text-slate-300 text-sm font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="pt-2">
                     <button
                        onClick={() => showToast('Configuración de notificaciones guardada en el dispositivo.')}
                        className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 font-bold rounded-xl text-xs transition-all cursor-pointer"
                     >
                       Guardar Preferencias
                     </button>
                  </div>
                </div>
              </div>

              {/* Offline parameters info */}
              <div className="pt-6 border-t border-slate-800 text-xs text-slate-500 leading-relaxed text-center font-medium">
                Cumplimos estrictamente las políticas de Google GCP. La integración utiliza tu clave de API Gemini de forma transparente desde el servidor Express para mayor seguridad.
              </div>
            </div>
          </div>
        </main>

        {/* Global Footer */}
        {!isSessionMode && (
          <footer className="w-full border-t border-slate-800 bg-slate-900/50 backdrop-blur-md mt-auto py-8">
            <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 bg-indigo-600/10 rounded-full flex items-center justify-center text-indigo-400">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-slate-300">Dr. Jorge Andrés Barrios Durán™</p>
                <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} Todos los derechos reservados.</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-600 pt-4 cursor-pointer">
                 <span className="hover:text-indigo-400 transition-colors">Términos y Condiciones</span>
                 <span>&bull;</span>
                 <span className="hover:text-indigo-400 transition-colors">Política de Privacidad</span>
                 <span>&bull;</span>
                 <span className="hover:text-indigo-400 transition-colors">Soporte</span>
              </div>
            </div>
          </footer>
        )}

        {/* iOS Cupertino Style Multi-step Confirm Dialog Overlay */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm select-none">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transform scale-100 transition-all">
              <div className="p-6 space-y-4">
                {/* Step indicator header */}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/10 px-2 py-0.5 rounded-md">
                    Acción de Sistema
                  </span>
                  {confirmModal.stepsRequired > 1 && (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 font-bold font-mono">
                      Paso {confirmModal.currentStep} de {confirmModal.stepsRequired}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 leading-none">
                     {confirmModal.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>

                {/* Step Progression Bar indicators */}
                {confirmModal.stepsRequired > 1 && (
                  <div className="flex gap-1.5 h-1 px-0.5 mt-2">
                    {Array.from({ length: confirmModal.stepsRequired }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          i + 1 <= confirmModal.currentStep ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex border-t border-slate-800/60 bg-slate-950/20 px-5 py-3 justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModal({ ...confirmModal, isOpen: false });
                  }}
                  className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleConfirmProgress();
                  }}
                  className="px-4 py-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all cursor-pointer shadow-md shadow-rose-950/60"
                >
                  {confirmModal.currentStep < confirmModal.stepsRequired ? 'Siguiente paso →' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Daily Summary Modal */}
        {dailySummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm select-none">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transform scale-100 transition-all">
              <div className="p-6 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">¡Día Completado!</h3>
                  <p className="text-xs text-slate-400">Resumen de tu desempeño clínico de hoy.</p>
                </div>
                
                <div className="bg-slate-950/50 p-4 border border-slate-800 rounded-2xl space-y-3">
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    let studiedToday = 0;
                    let reviewedToday = 0;
                    let hardCount = 0;
                    
                    Object.values(topicsProgress).forEach((prog: any) => {
                      const logsForDay = prog.reviewLog?.filter((l: any) => l.date.split('T')[0] === todayStr) || [];
                      if (logsForDay.length > 0) {
                        if (logsForDay.some((l: any) => l.interval === 0)) studiedToday++;
                        if (logsForDay.some((l: any) => l.interval > 0)) reviewedToday++;
                        if (logsForDay.some((l: any) => l.rating === 'Difícil' || l.rating === 'Otra vez')) hardCount++;
                      }
                    });

                    return (
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-black text-emerald-400">{studiedToday}</div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Nuevos Estudiados</div>
                        </div>
                        <div>
                          <div className="text-2xl font-black text-indigo-400">{reviewedToday}</div>
                          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Repasados</div>
                        </div>
                        <div className="col-span-2 border-t border-slate-800 pt-3">
                           <div className="text-xl font-black text-orange-400">{hardCount}</div>
                           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Encontrados Difíciles</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                <button
                  onClick={() => setDailySummaryModal(false)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Offscreen container for PDF Export */}
      <div className="absolute top-0 left-[-9999px] w-[800px] bg-slate-900 border border-slate-800 p-8 pt-10 pb-16 z-[-1]" id="academic-report-container">
        <h1 className="text-3xl font-black text-white text-center mb-6">Planificador Clínico</h1>
        <h2 className="text-xl font-bold text-indigo-400 text-center mb-10 border-b border-slate-800 pb-4">Reporte Académico de Desempeño</h2>
        
        <div className="flex gap-4">
          <div className="flex-1 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Avance Global</span>
            <span className="text-5xl font-black text-white">{Math.round((topics.filter(t => ['Dominado', 'Estudiado', 'En Repaso'].includes(topicsProgress[t.id]?.status)).length / (topics.length || 1)) * 100)}%</span>
            <div className="mt-4 flex gap-2 justify-between">
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-400">{topics.filter(t => topicsProgress[t.id]?.status === 'Dominado').length}</div>
                <div className="text-[9px] text-slate-500 uppercase">Dominados</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-500">{topics.filter(t => topicsProgress[t.id]?.status === 'En Repaso').length}</div>
                <div className="text-[9px] text-slate-500 uppercase">En Repaso</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-slate-600">{topics.filter(t => topicsProgress[t.id]?.status === 'Sin Empezar').length}</div>
                <div className="text-[9px] text-slate-500 uppercase">Pendientes</div>
              </div>
            </div>
          </div>
        </div>
        
        <h3 className="text-sm font-bold text-white mt-10 mb-4 border-b border-slate-800 pb-2">🩺 Temas Graduados</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          {topics.filter(t => topicsProgress[t.id]?.status === 'Dominado').map(t => (
            <div key={t.id} className="truncate">✅ {t.title}</div>
          ))}
          {topics.filter(t => topicsProgress[t.id]?.status === 'Dominado').length === 0 && <div className="col-span-2 text-slate-600 italic">Aún no hay temas graduados.</div>}
        </div>
      </div>

      </div>
    </div>
  );
}

// Simple cloud vector icon
function CloudIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.89-1.93-3.5-4-3.5-3.04 0-5.5 2.1-5.5 5 0 .37.03.73.1 1.08A4.5 4.5 0 0 0 6.5 19z" />
    </svg>
  );
}
