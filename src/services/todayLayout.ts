export const TODAY_SECTION_ORDER = Object.freeze(['focus', 'agenda', 'habits', 'money', 'upcoming', 'goals'] as const);
export type TodaySectionId = typeof TODAY_SECTION_ORDER[number];
export type TodayLayout = { order: TodaySectionId[]; hidden: TodaySectionId[] };

export const DEFAULT_TODAY_LAYOUT: TodayLayout = {
  order: [...TODAY_SECTION_ORDER],
  // Today opens on immediate work. Supporting financial and future summaries
  // remain available through Customize without crowding a first-use screen.
  hidden: ['money', 'upcoming', 'goals'],
};

export const TODAY_SECTION_LABELS: Record<TodaySectionId, string> = {
  focus: 'Today’s focus',
  money: 'Money snapshot',
  agenda: 'Today’s agenda',
  habits: 'Habits today',
  upcoming: 'Coming up',
  goals: 'Goals',
};

export function normalizeTodayLayout(value: unknown): TodayLayout {
  if (!value || typeof value !== 'object') return { order: [...DEFAULT_TODAY_LAYOUT.order], hidden: [...DEFAULT_TODAY_LAYOUT.hidden] };
  const candidate = value as { order?: unknown; hidden?: unknown };
  const allowed = new Set<string>(TODAY_SECTION_ORDER);
  const order = Array.isArray(candidate.order)
    ? [...new Set(candidate.order.filter((id): id is TodaySectionId => typeof id === 'string' && allowed.has(id)))]
    : [];
  for (const id of TODAY_SECTION_ORDER) if (!order.includes(id)) order.push(id);
  const hidden = Array.isArray(candidate.hidden)
    ? [...new Set(candidate.hidden.filter((id): id is TodaySectionId => typeof id === 'string' && allowed.has(id)))]
    : [...DEFAULT_TODAY_LAYOUT.hidden];
  // The command-center summary is always present to avoid an empty home screen.
  return { order, hidden: hidden.filter(id => id !== 'focus') };
}

export function setTodaySectionVisible(layout: TodayLayout, id: TodaySectionId, visible: boolean): TodayLayout {
  if (id === 'focus') return layout;
  return { ...layout, hidden: visible ? layout.hidden.filter(item => item !== id) : [...new Set([...layout.hidden, id])] };
}

export function moveTodaySection(layout: TodayLayout, id: TodaySectionId, direction: -1 | 1): TodayLayout {
  const from = layout.order.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= layout.order.length) return layout;
  const order = [...layout.order];
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, order };
}
