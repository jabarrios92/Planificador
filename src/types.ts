export type StudyStatus = 'Sin Empezar' | 'Estudiado' | 'En Repaso' | 'Dominado';
export type StudyRating = 'Otra vez' | 'Difícil' | 'Bien' | 'Fácil';

export interface Topic {
  id: string; // generated uniquely or readable id
  title: string;
  specialty: string;
}

export interface ReviewHistoryLog {
  date: string;
  rating: StudyRating;
  elapsedDays: number;
}

export interface UserTopicProgress {
  topicId: string;
  status: StudyStatus;
  rating: StudyRating | null;
  reviewInterval: number; // in days
  repetitionsCount: number;
  lastReviewedAt: string | null; // ISO Date
  nextReviewDate: string | null; // ISO Date / YYYY-MM-DD
  notes: string;
  ankiRetention?: number;
  bankScore?: number;
  clinicalPearl?: string;
  customStudyDate?: string; // Manual date override YYYY-MM-DD
  reviewLog?: ReviewHistoryLog[];
  performanceTrend?: 'Mejorando' | 'Estable' | 'Requiere Atención' | 'Nuevo';
  isGraduated?: boolean;
  priority?: 'Alta' | 'Media' | 'Baja' | null;
}

export interface ReviewEvent {
  id: string;
  topicId: string;
  topicTitle: string;
  specialty: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface SpecialtyConfig {
  name: string;
  icon: string; // name of lucide icon
  color: string; // tailwind class name
  bgGradient: string; // tailwind dynamic bg gradient class name
}

export interface StudyConfig {
  globalSaturday: boolean;
  globalSunday: boolean;
  weekOverrides: Record<string, { saturday?: boolean, sunday?: boolean }>;
}

export interface CustomTask {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  completed: boolean;
}

export interface AISummaryResponse {
  keyConcepts: string[];
  mnemonics: string[];
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}
