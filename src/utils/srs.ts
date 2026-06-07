import { StudyRating, StudyStatus, StudyConfig } from '../types';

/**
 * Calculates the next review date and repetition stats based on a modified Leitner/SM2 spaced repetition system.
 * Returns the new interval (in days), repetitions count, and status.
 */
export function calculateNextReview(
  rating: StudyRating,
  currentRepetitions: number,
  currentInterval: number
): {
  interval: number;
  repetitions: number;
  status: StudyStatus;
} {
  let interval = currentInterval;
  let repetitions = currentRepetitions + 1;
  let status: StudyStatus = 'En Repaso';

  if (rating === 'Otra vez') {
    interval = 1;
    status = 'En Repaso';
  } else if (currentInterval <= 0) {
    if (rating === 'Difícil') {
      interval = 2;
      status = 'En Repaso';
    } else if (rating === 'Bien') {
      interval = 4;
      status = 'Estudiado';
    } else {
      // 'Fácil'
      interval = 7;
      status = 'Estudiado';
    }
  } else {
    // Apply multipliers to current interval
    if (rating === 'Difícil') {
      interval = Math.min(120, Math.max(currentInterval + 1, Math.ceil(currentInterval * 1.2)));
      status = 'En Repaso';
    } else if (rating === 'Bien') {
      interval = Math.min(120, Math.max(currentInterval + 2, Math.ceil(currentInterval * 2.0)));
      status = repetitions >= 3 ? 'Dominado' : 'Estudiado';
    } else {
      // 'Fácil'
      interval = Math.min(120, Math.max(currentInterval + 3, Math.ceil(currentInterval * 3.5)));
      status = repetitions >= 3 ? 'Dominado' : 'Estudiado';
    }
  }

  return { interval, repetitions, status };
}

/**
 * Computes a user-friendly label with calculated days based on current progress.
 */
export function getRealWaitTimeLabel(
  rating: StudyRating,
  currentRepetitions: number,
  currentInterval: number,
  baseText: string
): string {
  const { interval } = calculateNextReview(rating, currentRepetitions, currentInterval);
  if (interval <= 1) {
    return 'Mañana (1d)';
  }
  return `En ${interval} días (${baseText})`;
}

/**
 * Formats a date string/timestamp to standard Spanish readable format.
 */
export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Get days difference relative to today.
 * Positive means future, negative means past due.
 */
export function getDaysDiffFromToday(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculates a sequential schedule mapping for each topic, starting from planStartDate.
 * Saturdays and Sundays are skipped as rest days by default, overridden by StudyConfig.
 * If any topic progress has a customStudyDate, that override shifts that topic and all subsequent ones automatically based on that new anchor.
 */
export function calculateTopicDates(
  topics: { id: string }[],
  topicsProgress: Record<string, { customStudyDate?: string }> = {},
  planStartDate: string,
  config: StudyConfig = { globalSaturday: false, globalSunday: false, weekOverrides: {} }
): Record<string, string> {
  const result: Record<string, string> = {};
  if (topics.length === 0) return result;

  // Split-parse to avoid timezone shifts
  const parts = planStartDate.split('-');
  let lastDate: Date;
  if (parts.length === 3) {
    lastDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    lastDate = new Date();
  }
  if (isNaN(lastDate.getTime())) {
    lastDate = new Date();
  }

  // Get Monday start of week (YYYY-MM-DD) for overrides matching
  const getWeekStartStr = (d: Date): string => {
    const next = new Date(d);
    const day = next.getDay();
    const diff = next.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    next.setDate(diff);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  };

  const isStudyDay = (date: Date): boolean => {
    const day = date.getDay();
    if (day > 0 && day < 6) return true; // Mon-Fri
    
    const weekStart = getWeekStartStr(date);
    const override = config.weekOverrides[weekStart];
    
    if (day === 6) { // Saturday
      if (override && override.saturday !== undefined) return override.saturday;
      return config.globalSaturday;
    }
    if (day === 0) { // Sunday
      if (override && override.sunday !== undefined) return override.sunday;
      return config.globalSunday;
    }
    return true;
  };

  // Helper to add 1 day and skip resting blocks
  const getNextStudyDay = (date: Date): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (!isStudyDay(next)) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  };

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const prog = topicsProgress[topic.id];

    if (prog && prog.customStudyDate) {
      const p = prog.customStudyDate.split('-');
      if (p.length === 3) {
        const overrideDate = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        if (!isNaN(overrideDate.getTime())) {
          lastDate = overrideDate;
        }
      }
    } else {
      if (i > 0) {
        lastDate = getNextStudyDay(lastDate);
      } else {
        // Topic 1 starts on planStartDate, but skip rest weekend if it begins on one
        while (!isStudyDay(lastDate)) {
          lastDate.setDate(lastDate.getDate() + 1);
        }
      }
    }

    const yyyy = lastDate.getFullYear();
    const mm = String(lastDate.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDate.getDate()).padStart(2, '0');
    result[topic.id] = `${yyyy}-${mm}-${dd}`;
  }

  return result;
}

/**
 * Gets the capitalized name of the day of the week in Spanish for a given date string 'YYYY-MM-DD'.
 * Uses local timezone construction to avoid offset-induced mismatch.
 */
export function getWeekdayNameFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  const dateObj = new Date(y, m, d);
  if (isNaN(dateObj.getTime())) return '';
  const name = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}


