import type { Task } from '../types';

export interface TaskDateGroup {
  key: string;
  label: string;
  tasks: Task[];
}

function validDateKey(value: string | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(year, month - 1, day, 12));
}

/** Groups the existing upcoming task records without changing recurrence or storage semantics. */
export function groupUpcomingTasks(tasks: Task[], today: string): TaskDateGroup[] {
  if (!validDateKey(today)) throw new TypeError('Upcoming task grouping requires a valid local calendar date.');
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!validDateKey(task.dueDate) || task.dueDate <= today) continue;
    const bucket = groups.get(task.dueDate) || [];
    bucket.push(task);
    groups.set(task.dueDate, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupedTasks]) => ({
      key,
      label: key === addDays(today, 1) ? `Tomorrow · ${dateLabel(key)}` : dateLabel(key),
      tasks: groupedTasks.sort((a, b) => (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59') || a.title.localeCompare(b.title)),
    }));
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getSubtaskProgress(subtasks: Task['subtasks'] = []): { completed: number; total: number; percent: number } {
  const total = subtasks?.length || 0;
  const completed = (subtasks || []).filter(subtask => subtask.completed).length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}
