from pathlib import Path
import re

def replace_function(source, signature, replacement):
    start = source.find(signature)
    if start < 0:
        raise RuntimeError(f"Missing function signature: {signature}")

    brace = source.find("{", start)
    if brace < 0:
        raise RuntimeError(f"Missing function body: {signature}")

    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = brace

    while i < len(source):
        c = source[i]
        n = source[i + 1] if i + 1 < len(source) else ""

        if line_comment:
            if c == "\n":
                line_comment = False
        elif block_comment:
            if c == "*" and n == "/":
                block_comment = False
                i += 1
        elif quote:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == quote:
                quote = None
        elif c == "/" and n == "/":
            line_comment = True
            i += 1
        elif c == "/" and n == "*":
            block_comment = True
            i += 1
        elif c in ("'", '"', "`"):
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return source[:start] + replacement + source[i + 1:]
        i += 1

    raise RuntimeError(f"Unclosed function body: {signature}")

path = Path("src/services/domainUtils.ts")
src = path.read_text()

schedule_helper = """export function isHabitScheduledOnDate(
  frequency: 'daily' | 'weekdays' | 'weekends' | 'weekly',
  date: string
): boolean {
  if (frequency === 'weekly' || frequency === 'daily') return true;
  if (!/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const day = parsed.getUTCDay();
  return frequency === 'weekdays' ? day >= 1 && day <= 5 : day === 0 || day === 6;
}

"""

if "export function isHabitScheduledOnDate(" not in src:
    anchor = "export function calculateWeeklyHabitRate("
    if anchor not in src:
        raise RuntimeError("Cannot locate weekly analytics insertion point")
    src = src.replace(anchor, schedule_helper + anchor, 1)

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
    logs
      .filter(log => log.habitId === habitId && log.completed)
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

src = replace_function(src, "export function calculateWeeklyHabitRate(", weekly)
src = replace_function(src, "export function calculateStreaks(", streaks)
path.write_text(src)

app_path = Path("src/App.tsx")
app = app_path.read_text()

old_import = "buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, formatLocalDate"
new_import = "buildFinanceEntry, calculateStreaks, calculateWeeklyHabitRate, isHabitScheduledOnDate, formatLocalDate"
if old_import not in app:
    if "isHabitScheduledOnDate" not in app:
        raise RuntimeError("App domainUtils import anchor not found")
else:
    app = app.replace(old_import, new_import, 1)

old_streak = "calculateStreaks(habitLogs, habitId, targetDate)"
new_streak = "calculateStreaks(habitLogs, habitId, targetDate, habits.find(h => h.id === habitId)?.frequency || 'daily')"
if old_streak not in app:
    raise RuntimeError("App habit streak caller not found")
app = app.replace(old_streak, new_streak, 1)

old_rate = "calculateWeeklyHabitRate(habitLogs, h.id, clockNow)"
new_rate = "calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency)"
if old_rate not in app:
    raise RuntimeError("App weekly rate caller not found")
app = app.replace(old_rate, new_rate, 1)

old_score = "const completedHabits = habits.filter(h => getHabitStreaks(h.id, todayStr).completedToday).length;"
new_score = """const completedHabits = habits.filter(h => {
      if (h.frequency === 'weekly') return calculateWeeklyHabitRate(habitLogs, h.id, clockNow, h.frequency).completed > 0;
      if (!isHabitScheduledOnDate(h.frequency, todayStr)) return true;
      return getHabitStreaks(h.id, todayStr).completedToday;
    }).length;"""
if old_score not in app:
    raise RuntimeError("App productivity score anchor not found")
app = app.replace(old_score, new_score, 1)

old_display = "{weekly.completed}/7 days"
new_display = "{weekly.completed}/{weekly.scheduled} days"
if old_display not in app:
    raise RuntimeError("App weekly completion display anchor not found")
app = app.replace(old_display, new_display, 1)

app_path.write_text(app)
print("Production TypeScript analytics and app wiring patched.")
