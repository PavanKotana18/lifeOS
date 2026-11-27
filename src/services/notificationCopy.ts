export const NOTIFICATION_TONES = ['clear', 'warm', 'playful'] as const;
export type NotificationTone = typeof NOTIFICATION_TONES[number];
export type ReminderKind = 'dueTime' | 'taskReminders' | 'upcomingDeadlines' | 'overdueAlerts' | 'habitReminder' | 'milestoneReminder' | 'taskSnooze' | 'notesReminder';

const english = {
  notesReminder: { title: 'Note reminder', clear: ['Open BusyDoo to view your reminder.'], warm: ['It is time to check a saved note in BusyDoo.'], playful: ['A little nudge to check a note in BusyDoo.'] },
  dueTime: { title: 'Task due now', clear: ['A scheduled task is due.'], warm: ['It is time for your task.', 'Your task is ready when you are.'], playful: ['A little nudge. Your task is due now.', 'Right on cue. Your task is due.'] },
  taskReminders: { title: 'Task reminder', clear: ['A scheduled task is coming up.'], warm: ['A heads-up for your upcoming task.', 'A little time to get ready for your task.'], playful: ['A little nudge for the task ahead.', 'Your upcoming task is waving hello.'] },
  upcomingDeadlines: { title: 'Upcoming deadline', clear: ['A task deadline is approaching.'], warm: ['A heads-up that a deadline is approaching.'], playful: ['A deadline is on the horizon.'] },
  overdueAlerts: { title: 'Task overdue', clear: ['A task has passed its due time. Review it when ready.'], warm: [], playful: [] },
  habitReminder: { title: 'Habit check-in', clear: ['It is time to check in on a habit.'], warm: ['Tiny steps count. Time for a check-in.', 'A moment for your routine.'], playful: ['One small check-in, coming right up.', 'Your routine is ready for a cameo.'] },
  milestoneReminder: { title: 'Goal milestone', clear: ['A goal milestone is due today.'], warm: ['Take a moment to check your milestone.', 'A chance to see how far you have come. Your milestone is due today.'], playful: ['Milestone day. Give your progress a look.'] },
  taskSnooze: { title: 'Snoozed task reminder', clear: ['Your snoozed task reminder is ready.'], warm: ['Here is your task reminder again.'], playful: ['Back from a short break. Here is your task reminder.'] },
} satisfies Record<ReminderKind, { title: string; clear: string[]; warm: string[]; playful: string[] }>;

const catalogs: Record<string, typeof english> = { en: english };

export function normalizeNotificationTone(value: unknown): NotificationTone {
  return value === 'clear' || value === 'playful' ? value : 'warm';
}

export function reminderCopy(kind: ReminderKind, tone: NotificationTone, seed: number, locale = 'en', urgent = false) {
  const catalog = catalogs[locale.toLowerCase().split('-')[0]] || english;
  const entry = catalog[kind];
  const variants = urgent || kind === 'overdueAlerts' ? entry.clear : entry[tone];
  return { title: entry.title, body: variants[(seed >>> 0) % variants.length] };
}
