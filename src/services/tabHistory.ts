export function pushTabHistory<T>(history: T[], current: T, next: T) {
  return current === next ? history : [...history, current];
}

export function popTabHistory<T>(history: T[], fallback: T) {
  const next = history.length ? history[history.length - 1] : fallback;
  return { next, history: history.slice(0, -1) };
}
