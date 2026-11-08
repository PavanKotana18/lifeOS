import { PRIMARY_NAVIGATION, primaryDestinationForTab, type MainTab, type PrimaryTab } from './navigationCatalog';

export interface SwipeGestureSample {
  deltaX: number;
  deltaY: number;
  durationMs: number;
  startedOnInteractive: boolean;
  startedAtSystemEdge: boolean;
  startedInHorizontalControl: boolean;
  enabled: boolean;
}

export type PrimaryGestureAxis = 'pending' | 'horizontal' | 'vertical';

export interface PrimaryGestureSession {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  viewportWidth: number;
  axis: PrimaryGestureAxis;
  latestOffsetX: number;
}

export type GestureTrace = {
  event: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture' | 'interrupted';
  pointerId: number;
  deltaX: number;
  deltaY: number;
  state: PrimaryGestureAxis | 'idle' | 'suppressed';
  reason?: string;
  decision?: string;
};

const traceLimit = 40;

/** Development-only in-memory trace. It intentionally accepts no target or record data. */
export function recordGestureTrace(trace: GestureTrace, enabled: boolean): void {
  if (!enabled) return;
  const host = globalThis as typeof globalThis & { __lifeosGestureTrace?: GestureTrace[] };
  const entries = host.__lifeosGestureTrace || [];
  entries.push({
    event: trace.event,
    pointerId: trace.pointerId,
    deltaX: Math.round(trace.deltaX * 10) / 10,
    deltaY: Math.round(trace.deltaY * 10) / 10,
    state: trace.state,
    ...(trace.reason ? { reason: trace.reason } : {}),
    ...(trace.decision ? { decision: trace.decision } : {}),
  });
  if (entries.length > traceLimit) entries.splice(0, entries.length - traceLimit);
  host.__lifeosGestureTrace = entries;
}

export function beginPrimaryGesture(input: {
  pointerId: number;
  x: number;
  y: number;
  at: number;
  viewportWidth: number;
}): PrimaryGestureSession {
  return {
    pointerId: input.pointerId,
    startX: input.x,
    startY: input.y,
    startedAt: input.at,
    viewportWidth: input.viewportWidth,
    axis: 'pending',
    latestOffsetX: 0,
  };
}

/** Locks to one axis after intent is clear and ignores a pointer from another touch. */
export function updatePrimaryGesture(
  session: PrimaryGestureSession,
  pointerId: number,
  x: number,
  y: number,
): { session: PrimaryGestureSession; deltaX: number; deltaY: number; accepted: boolean } {
  const deltaX = x - session.startX;
  const deltaY = y - session.startY;
  if (pointerId !== session.pointerId || session.axis === 'vertical') {
    return { session, deltaX, deltaY, accepted: false };
  }
  const axis = session.axis === 'horizontal' ? 'horizontal' : classifyPointerAxis(deltaX, deltaY);
  const next = axis === 'horizontal'
    ? {
        ...session,
        axis,
        // Near finger-speed with a viewport-relative rubber-band limit.
        latestOffsetX: Math.max(-session.viewportWidth * 0.42, Math.min(session.viewportWidth * 0.42, deltaX * 0.92)),
      }
    : { ...session, axis };
  return { session: next, deltaX, deltaY, accepted: axis === 'horizontal' };
}

export function resolvePrimaryGestureEnd(
  currentTab: MainTab,
  session: PrimaryGestureSession,
  pointerId: number,
  x: number,
  y: number,
  endedAt: number,
  enabled: boolean,
): PrimaryTab | null {
  if (pointerId !== session.pointerId || session.axis !== 'horizontal') return null;
  return resolvePrimarySwipe(currentTab, {
    deltaX: x - session.startX,
    deltaY: y - session.startY,
    durationMs: endedAt - session.startedAt,
    startedOnInteractive: false,
    startedAtSystemEdge: false,
    startedInHorizontalControl: false,
    enabled,
  });
}

export function classifyPointerAxis(deltaX: number, deltaY: number): 'pending' | 'horizontal' | 'vertical' {
  const x = Math.abs(deltaX);
  const y = Math.abs(deltaY);
  if (Math.max(x, y) < 8) return 'pending';
  if (x >= y * 1.25) return 'horizontal';
  if (y >= x * 1.15) return 'vertical';
  return 'pending';
}

/** Pure gesture gate. It never wraps and only targets the existing primary nav state. */
export function resolvePrimarySwipe(currentTab: MainTab, sample: SwipeGestureSample): PrimaryTab | null {
  if (!sample.enabled || sample.startedOnInteractive || sample.startedAtSystemEdge || sample.startedInHorizontalControl) return null;
  const x = sample.deltaX;
  const y = sample.deltaY;
  const distance = Math.abs(x);
  const vertical = Math.abs(y);
  const duration = Math.max(1, sample.durationMs);
  const fastSwipe = distance >= 36 && distance / duration >= 0.55;
  if (vertical > 64 || distance < (fastSwipe ? 36 : 68) || distance < vertical * 1.45) return null;

  const current = primaryDestinationForTab(currentTab);
  if (!current) return null;
  const index = PRIMARY_NAVIGATION.findIndex(item => item.tab === current);
  const targetIndex = index + (x < 0 ? 1 : -1);
  return PRIMARY_NAVIGATION[targetIndex]?.tab || null;
}
