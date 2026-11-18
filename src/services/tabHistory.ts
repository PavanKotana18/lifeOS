export function pushTabHistory<T>(history: T[], current: T, next: T) {
  if (current === next) return history;
  if (history[history.length - 1] === next) return history.slice(0, -1);
  return [...history, current].slice(-32);
}

export function popTabHistory<T>(history: T[], fallback: T) {
  const next = history.length ? history[history.length - 1] : fallback;
  return { next, history: history.slice(0, -1) };
}
