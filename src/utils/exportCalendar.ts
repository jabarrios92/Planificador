import * as ics from 'ics';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { Topic, ReviewEvent, CustomTask } from '../types';

export const exportToICS = (
  studyTopicsByDate: Record<string, Topic[]>,
  reviewEvents: ReviewEvent[],
  customTasks: CustomTask[]
) => {
  const events: ics.EventAttributes[] = [];

  // Helper to parse "YYYY-MM-DD" into [YYYY, MM, DD, HH, mm]
  const parseDate = (dateStr: string, isTask: boolean = false): ics.DateArray => {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Study and review topics in morning, custom tasks in afternoon to spread them out? Or all as all-day?
    // Let's create all-day events if they don't have specific times, or we can just give them a time.
    // ics all-day events just use year, month, day
    return [year, month, day];
  };

  // Add Study Topics
  Object.entries(studyTopicsByDate).forEach(([dateStr, topics]) => {
    topics.forEach((topic) => {
      events.push({
        start: parseDate(dateStr),
        duration: { days: 1 },
        title: `📘 Estudiar: ${topic.title}`,
        description: `Especialidad: ${topic.specialty}`,
        calName: 'Planificador Clínico'
      });
    });
  });

  // Add Reviews
  reviewEvents.forEach((review) => {
    events.push({
      start: parseDate(review.date),
      duration: { days: 1 },
      title: `⏰ Repaso: ${review.topicTitle}`,
      description: `Estado: ${review.completed ? 'Completado' : 'Pendiente'}`,
      calName: 'Planificador Clínico'
    });
  });

  // Add Custom Tasks
  customTasks.forEach((task) => {
    events.push({
      start: parseDate(task.date, true),
      duration: { days: 1 },
      title: `📝 Tarea: ${task.text}`,
      description: `Estado: ${task.completed ? 'Completada' : 'Pendiente'}`,
      calName: 'Planificador Clínico'
    });
  });

  const { error, value } = ics.createEvents(events);

  if (error) {
    console.error(error);
    return;
  }

  if (value) {
    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plan-estudio.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const exportToImage = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  try {
    const dataUrl = await htmlToImage.toPng(element, { 
       quality: 1, 
       pixelRatio: 2, 
       backgroundColor: '#0f172a' // slate-900 equivalent for pretty aesthetics
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error exporting image:', error);
  }
};

export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  try {
    const dataUrl = await htmlToImage.toPng(element, { 
       quality: 1, 
       pixelRatio: 2,
       style: {
         backgroundColor: '#0f172a'
       }
    });
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [element.offsetWidth, element.offsetHeight]
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, element.offsetWidth, element.offsetHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
  }
};
