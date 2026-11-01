from pathlib import Path
import sys

def replace_between(path, start_marker, end_marker, replacement):
    p = Path(path)
    s = p.read_text()
    start = s.find(start_marker)
    if start < 0:
        raise RuntimeError(f"{path}: start marker missing")
    end = s.find(end_marker, start + len(start_marker))
    if end < 0:
        raise RuntimeError(f"{path}: end marker missing")
    p.write_text(s[:start] + replacement + s[end:])

helper = """function isHabitScheduledOnDate(frequency, dateStr) {
  if (frequency === 'weekly') return true;
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  if (frequency === 'weekdays') return day >= 1 && day <= 5;
  if (frequency === 'weekends') return day === 0 || day === 6;
  return true;
}

"""

weekly_js = """function calculateWeeklyHabitRate(logs, habitId, today = new Date(), frequency = 'daily') {
  const completedDates = new Set(
    logs.filter(log => log.habitId === habitId && log.completed).map(log => log.date)
  );

  const eligibleDates = [];
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = formatLocalDate(day);
    if (isHabitScheduledOnDate(frequency, key)) eligibleDates.push(key);
  }

  if (frequency === 'weekly') {
    const completed = [...completedDates].some(date => {
      const d = new Date(`${date}T00:00:00`);
      return !Number.isNaN(d.getTime()) &&
        d >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6) &&
        d <= new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    }) ? 1 : 0;
    return { completed, rate: completed ? 100 : 0 };
  }

  const completed = eligibleDates.filter(date => completedDates.has(date)).length;
  const rate = eligibleDates.length
    ? Math.round(completed / eligibleDates.length * 100)
    : 0;
  return { completed, rate };
}

"""

streak_js = """function calculateStreaks(habitLogs, targetHabitId, todayStr, frequency = 'daily') {
  const completedDates = new Set(
    habitLogs
      .filter(log => log.habitId === targetHabitId && log.completed)
      .map(log => log.date)
      .filter(date => /^\\d{4}-\\d{2}-\\d{2}$/.test(date))
  );
  const completedToday = completedDates.has(todayStr);
  const ordinal = date => dateOrdinal(date);
  const dateFromOrdinal = value => new Date(value * 86400000).toISOString().slice(0, 10);

  if (frequency === 'weekly') {
    const weekStart = date => {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      return ordinal(date) - ((day + 6) % 7);
    };
    const weeks = new Set([...completedDates].map(weekStart));
    if (!weeks.size) return { currentStreak: 0, longestStreak: 0, completedToday };

    const sorted = [...weeks].sort((a, b) => a - b);
    let longestStreak = 0, run = 0, previous = null;
    for (const week of sorted) {
      run = previous !== null && week === previous + 7 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previous = week;
    }

    const currentWeek = weekStart(todayStr);
    let checkWeek = weeks.has(currentWeek) ? currentWeek : currentWeek - 7;
    let currentStreak = 0;
    while (weeks.has(checkWeek)) {
      currentStreak++;
      checkWeek -= 7;
    }
    return { currentStreak, longestStreak, completedToday };
  }

  const scheduled = date => isHabitScheduledOnDate(frequency, date);
  const dates = [...completedDates].filter(scheduled).sort();
  if (!dates.length) return { currentStreak: 0, longestStreak: 0, completedToday };

  let longestStreak = 0, run = 0, previous = null;
  for (const date of dates) {
    let previousScheduled = ordinal(date) - 1;
    while (!scheduled(dateFromOrdinal(previousScheduled))) previousScheduled--;
    run = previous !== null && ordinal(previous) === previousScheduled ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = date;
  }

  let check = ordinal(todayStr);
  if (!completedDates.has(todayStr) || !scheduled(todayStr)) {
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

# Update the legacy JavaScript domain mirror used by node tests.
core = Path("src_core_logic.js").read_text()
if "function isHabitScheduledOnDate" not in core:
    pos = core.find("function calculateWeeklyHabitRate")
    if pos < 0: raise RuntimeError("src_core_logic.js: weekly rate function missing")
    core = core[:pos] + helper + core[pos:]

def replace_function_text(source, start, end, replacement):
    a = source.find(start)
    if a < 0: raise RuntimeError("function start missing: " + start)
    b = source.find(end, a + len(start))
    if b < 0: raise RuntimeError("function end missing after: " + start)
    return source[:a] + replacement + source[b:]

core = replace_function_text(core, "function calculateWeeklyHabitRate", "\nfunction buildTaskNotificationPlan", weekly_js)
core = replace_function_text(core, "function calculateStreaks", "\nfunction dateOrdinal", streak_js)
if "  isHabitScheduledOnDate," not in core:
    core = core.replace("  calculateStreaks,\n", "  calculateStreaks,\n  isHabitScheduledOnDate,\n", 1)
Path("src_core_logic.js").write_text(core)

# Update production TypeScript implementations.
ts_weekly = """export function isHabitScheduledOnDate(frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly', dateStr: string) {
  if (frequency === 'weekly') return true;
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  if (frequency === 'weekdays') return day >= 1 && day <= 5;
  if (frequency === 'weekends') return day === 0 || day === 6;
  return true;
}

export function calculateWeeklyHabitRate(
  logs: { habitId: string; date: string; completed: boolean }[],
  habitId: string,
  today = new Date(),
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'
) {
  const completedDates = new Set(logs.filter(log => log.habitId === habitId && log.completed).map(log => log.date));
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
      const d = new Date(`${date}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end;
    }) ? 1 : 0;
    return { completed, rate: completed ? 100 : 0 };
  }
  const completed = eligibleDates.filter(date => completedDates.has(date)).length;
  return { completed, rate: eligibleDates.length ? Math.round(completed / eligibleDates.length * 100) : 0 };
}

"""

ts_streak = """export function calculateStreaks(
  logs: { habitId: string; date: string; completed: boolean }[],
  habitId: string,
  today: string,
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly' = 'daily'
) {
  const completedDates = new Set(logs.filter(log => log.habitId === habitId && log.completed).map(log => log.date));
  const ordinal = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  };
  const dateFromOrdinal = (value: number) => new Date(value * 86_400_000).toISOString().slice(0, 10);
  const completedToday = completedDates.has(today);

  if (frequency === 'weekly') {
    const weekStart = (date: string) => {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      return ordinal(date) - ((day + 6) % 7);
    };
    const weeks = new Set([...completedDates].map(weekStart));
    if (!weeks.size) return { currentStreak: 0, longestStreak: 0, completedToday };
    const sorted = [...weeks].sort((a, b) => a - b);
    let longestStreak = 0, run = 0, previous: number | null = null;
    for (const week of sorted) {
      run = previous !== null && week === previous + 7 ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previous = week;
    }
    const currentWeek = weekStart(today);
    let checkWeek = weeks.has(currentWeek) ? currentWeek : currentWeek - 7;
    let currentStreak = 0;
    while (weeks.has(checkWeek)) { currentStreak++; checkWeek -= 7; }
    return { currentStreak, longestStreak, completedToday };
  }

  const scheduled = (date: string) => isHabitScheduledOnDate(frequency, date);
  const dates = [...completedDates].filter(scheduled).sort();
  if (!dates.length) return { currentStreak: 0, longestStreak: 0, completedToday };

  let longestStreak = 0, run = 0, previous: string | null = null;
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

domain_path = Path("src/services/domainUtils.ts")
domain = domain_path.read_text()
domain = replace_function_text(domain, "export function calculateWeeklyHabitRate", "export function buildTaskNotificationPlan", ts_weekly)
domain = replace_function_text(domain, "export function calculateStreaks", "export function buildFinanceEntry", ts_streak)
domain_path.write_text(domain)

# Update app callers to pass the habit frequency.
app_path = Path("src/App.tsx")
app = app_path.read_text()
app = app.replace(
    "buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, formatLocalDate",
    "buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, isHabitScheduledOnDate, formatLocalDate"
)
app = app.replace(
    "calculateStreaks(habitLogs, habitId, targetDate)",
    "calculateStreaks(habitLogs, habitId, targetDate, habits.find(h => h.id === habitId)?.frequency || 'daily')"
)
app = app.replace(
    "calculateWeeklyHabitRate(habitLogs, h.id, clockNow)",
    "calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency)"
)
old = "const completedHabits = habits.filter(h => getHabitStreaks(h.id, todayStr).completedToday).length;"
new = """const completedHabits = habits.filter(h => {
      if (h.frequency === 'weekly') return calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency).completed > 0;
      if (!isHabitScheduledOnDate(h.frequency, todayStr)) return true;
      return getHabitStreaks(h.id, todayStr).completedToday;
    }).length;"""
if old not in app:
    raise RuntimeError("App.tsx productivity score caller not found")
app = app.replace(old, new)
app_path.write_text(app)

print("Habit analytics production, test mirror and app callers patched.")
