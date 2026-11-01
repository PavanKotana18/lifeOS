from pathlib import Path
import re

p = Path("src/services/domainUtils.ts")
s = p.read_text()

helper = """export function isHabitScheduledOnDate(
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly',
  date: string
): boolean {
  if (frequency === 'daily' || frequency === 'weekly') return true;
  if (!/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const day = parsed.getUTCDay();
  return frequency === 'weekdays' ? day >= 1 && day <= 5 : day === 0 || day === 6;
}

"""

weekly = """export function calculateWeeklyHabitRate(
  logs: { habitId: string; date: string; completed: boolean }[],
  habitId: string,
  today = new Date(),
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'
) {
  const completedDates = new Set(
    logs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)
  );

  const eligibleDates: string[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = formatLocalDate(day);
    if (isHabitScheduledOnDate(frequency, key)) eligibleDates.push(key);
  }

  if (frequency === 'weekly') {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const completed = [...completedDates].some(date => {
      if (!/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(date)) return false;
      const d = new Date(`${date}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    }) ? 1 : 0;
    return { completed, scheduled: 1, rate: completed ? 100 : 0 };
  }

  const completed = eligibleDates.filter(date => completedDates.has(date)).length;
  return {
    completed,
    scheduled: eligibleDates.length,
    rate: eligibleDates.length ? Math.round(completed / eligibleDates.length * 100) : 0
  };
}
"""

streaks = """export function calculateStreaks(
  logs: { habitId: string; date: string; completed: boolean }[],
  habitId: string,
  today: string,
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'
) {
  const completedDates = new Set(
    logs.filter(log => log.habitId === habitId && log.completed)
      .map(log => log.date)
      .filter(date => /^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(date))
  );

  const ordinal = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  };
  const dateFromOrdinal = (value: number) =>
    new Date(value * 86400000).toISOString().slice(0, 10);
  const completedToday = completedDates.has(today);

  if (frequency === 'weekly') {
    const weekStart = (date: string) => {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      return ordinal(date) - ((day + 6) % 7);
    };
    const weeks = new Set([...completedDates].map(weekStart));
    if (!weeks.size) return { currentStreak: 0, longestStreak: 0, completedToday };

    const sorted = [...weeks].sort((a, b) => a - b);
    let longestStreak = 0;
    let run = 0;
    let previous: number | null = null;
    for (const week of sorted) {
      run = previous !== null && week === previous + 7 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previous = week;
    }

    const currentWeek = weekStart(today);
    let checkWeek = weeks.has(currentWeek) ? currentWeek : currentWeek - 7;
    let currentStreak = 0;
    while (weeks.has(checkWeek)) {
      currentStreak++;
      checkWeek -= 7;
    }
    return { currentStreak, longestStreak, completedToday };
  }

  const scheduled = (date: string) => isHabitScheduledOnDate(frequency, date);
  const dates = [...completedDates].filter(scheduled).sort();
  if (!dates.length) return { currentStreak: 0, longestStreak: 0, completedToday };

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of dates) {
    let previousScheduled = ordinal(date) - 1;
    while (!scheduled(dateFromOrdinal(previousScheduled))) previousScheduled--;
    run = previous !== null && ordinal(previous) === previousScheduled ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = date;
  }

  let check = ordinal(today);
  if (!completedDates.has(today) || !scheduled(today)) {
    check--;
    while (!scheduled(dateFromOrdinal(check))) check--;
  }

  let currentStreak = 0;
  while (completedDates.has(dateFromOrdinal(check)) && scheduled(dateFromOrdinal(check))) {
    currentStreak++;
    check--;
    while (!scheduled(dateFromOrdinal(check))) check--;
  }
  return { currentStreak, longestStreak, completedToday };
}
"""

if "export function isHabitScheduledOnDate(" not in s:
    anchor = "export function calculateWeeklyHabitRate("
    if anchor not in s:
        raise RuntimeError("Weekly helper insertion anchor missing")
    s = s.replace(anchor, helper + anchor, 1)

s, n1 = re.subn(
    r"export function calculateWeeklyHabitRate\([\s\S]*?\n}\n(?=export function calculateStreaks)",
    weekly + "\n",
    s,
    count=1
)
if n1 != 1:
    raise RuntimeError("Could not replace complete weekly analytics function")

s, n2 = re.subn(
    r"export function calculateStreaks\([\s\S]*?\n}\n(?=export function buildFinanceEntry)",
    streaks + "\n",
    s,
    count=1
)
if n2 != 1:
    raise RuntimeError("Could not replace complete streak analytics function")

p.write_text(s)

# Update the real application call sites.
p = Path("src/App.tsx")
app = p.read_text()

old_import = "calculateWeeklyHabitRate, formatLocalDate"
new_import = "calculateWeeklyHabitRate, isHabitScheduledOnDate, formatLocalDate"
if old_import in app:
    app = app.replace(old_import, new_import, 1)
elif "isHabitScheduledOnDate" not in app:
    raise RuntimeError("App import anchor missing")

old = "calculateStreaks(habitLogs, habitId, targetDate)"
new = "calculateStreaks(habitLogs, habitId, targetDate, habits.find(h => h.id === habitId)?.frequency || 'daily')"
if old not in app:
    raise RuntimeError("App streak call anchor missing")
app = app.replace(old, new, 1)

old = "calculateWeeklyHabitRate(habitLogs, h.id, clockNow)"
new = "calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency)"
if old not in app:
    raise RuntimeError("App weekly-rate call anchor missing")
app = app.replace(old, new, 1)

old = "const completedHabits = habits.filter(h => getHabitStreaks(h.id, todayStr).completedToday).length;"
new = """const completedHabits = habits.filter(h => {
      if (h.frequency === 'weekly') return calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency).completed > 0;
      if (!isHabitScheduledOnDate(h.frequency, todayStr)) return true;
      return getHabitStreaks(h.id, todayStr).completedToday;
    }).length;"""
if old not in app:
    raise RuntimeError("Productivity score anchor missing")
app = app.replace(old, new, 1)

old = "{weekly.completed}/7 days"
new = "{weekly.completed}/{weekly.scheduled} days"
if old not in app:
    raise RuntimeError("Weekly display anchor missing")
app = app.replace(old, new, 1)

p.write_text(app)
print("Production TypeScript and App call sites updated.")
