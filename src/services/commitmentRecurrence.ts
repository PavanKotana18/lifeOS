import type { CommitmentFrequency } from '../types';

type CalendarDate = { year: number; month: number; day: number };

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

function parseDate(value: string): CalendarDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Recurring commitment date must be a valid local calendar date.');
  }
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error('Recurring commitment date must be a valid local calendar date.');
  }
  return { year, month, day };
}

function formatDate({ year, month, day }: CalendarDate): string {
  if (year > 9999) throw new Error('Recurring commitment exceeds the supported calendar range.');
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Advance one occurrence, without posting or catching up missed occurrences.
 * Persist the initial due date as recurrenceAnchorDate when first advancing.
 * Reusing that anchor restores January 31 after February, or February 29 in
 * the next leap year. Reset the anchor when the user changes the schedule.
 * Calendar-component arithmetic avoids local timezone and DST conversions.
 */
export function advanceCommitmentDate(
  dueDate: string,
  frequency: CommitmentFrequency,
  anchorDate = dueDate,
): string {
  const due = parseDate(dueDate);
  const anchor = parseDate(anchorDate);
  if (frequency === 'weekly') {
    let { year, month } = due;
    let day = due.day + 7;
    if (day > daysInMonth(year, month)) {
      day -= daysInMonth(year, month);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return formatDate({ year, month, day });
  }
  if (frequency === 'monthly') {
    const month = due.month === 12 ? 1 : due.month + 1;
    const year = due.month === 12 ? due.year + 1 : due.year;
    return formatDate({ year, month, day: Math.min(anchor.day, daysInMonth(year, month)) });
  }
  if (frequency === 'yearly') {
    const year = due.year + 1;
    return formatDate({ year, month: anchor.month, day: Math.min(anchor.day, daysInMonth(year, anchor.month)) });
  }
  throw new Error('Unsupported commitment frequency.');
}
