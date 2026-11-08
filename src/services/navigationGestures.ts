import { PRIMARY_NAVIGATION, primaryDestinationForTab, type MainTab, type PrimaryTab } from './navigationCatalog';

export interface SwipeGestureSample {
  deltaX: number;
  deltaY: number;
  durationMs: number;
  startedAtSystemEdge: boolean;
  startedInHorizontalControl: boolean;
  startedInHardExcludedControl: boolean;
  enabled: boolean;
}

/**
 * Ordinary interactive surfaces remain swipe candidates. Only controls whose
 * own gesture must win over tab navigation are excluded before axis detection.
 */
export type PrimaryGestureTargetKind =
  | 'content'
  | 'ordinary-interactive'
  | 'text-entry'
  | 'native-picker'
  | 'slider'
  | 'chart'
  | 'horizontal-control'
  | 'dialog';

export type PrimaryGestureStartBlockReason =
  | 'preference-disabled'
  | 'mouse-pointer'
  | 'settings-screen'
  | 'modal-open'
  | 'multiple-pointers'
  | 'system-edge'
  | 'text-entry'
  | 'native-picker'
  | 'slider'
  | 'chart'
  | 'horizontal-control'
  | 'dialog';

export interface PrimaryGestureStartContext {
  enabled: boolean;
  pointerType: string;
  settingsScreen?: boolean;
  modalOpen?: boolean;
  multiplePointers?: boolean;
  systemEdge?: boolean;
  targetKind: PrimaryGestureTargetKind;
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

/**
 * Return a block reason before pointer capture. Buttons and other ordinary
 * controls deliberately return null so their tap can be distinguished from a
 * later horizontal drag instead of losing swipe support at pointerdown.
 */
export function primaryGestureStartBlockReason(
  context: PrimaryGestureStartContext,
): PrimaryGestureStartBlockReason | null {
  if (!context.enabled) return 'preference-disabled';
  if (context.pointerType === 'mouse') return 'mouse-pointer';
  if (context.settingsScreen) return 'settings-screen';
  if (context.modalOpen) return 'modal-open';
  if (context.multiplePointers) return 'multiple-pointers';
  if (context.systemEdge) return 'system-edge';
  switch (context.targetKind) {
    case 'text-entry': return 'text-entry';
    case 'native-picker': return 'native-picker';
    case 'slider': return 'slider';
    case 'chart': return 'chart';
    case 'horizontal-control': return 'horizontal-control';
    case 'dialog': return 'dialog';
    case 'content':
    case 'ordinary-interactive':
      return null;
  }
}

export function isHardGestureExcludedTarget(targetKind: PrimaryGestureTargetKind): boolean {
  return targetKind !== 'content' && targetKind !== 'ordinary-interactive';
}

export function shouldStartPrimaryGesture(context: PrimaryGestureStartContext): boolean {
  return primaryGestureStartBlockReason(context) === null;
}

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
): { session: PrimaryGestureSession; deltaX: number; deltaY: number; accepted: boolean; intent: PrimaryGestureAxis } {
  const deltaX = x - session.startX;
  const deltaY = y - session.startY;
  if (pointerId !== session.pointerId || session.axis === 'vertical') {
    return { session, deltaX, deltaY, accepted: false, intent: session.axis };
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
  return { session: next, deltaX, deltaY, accepted: axis === 'horizontal', intent: axis };
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
    startedAtSystemEdge: false,
    startedInHorizontalControl: false,
    startedInHardExcludedControl: false,
    enabled,
  });
}

/** Suppress a pointer-generated control click only after horizontal ownership. */
export function shouldSuppressPrimaryGestureClick(session: PrimaryGestureSession): boolean {
  return session.axis === 'horizontal';
}

/** Reduced motion skips settle decoration; it never disables the gesture itself. */
export function shouldAnimatePrimaryGestureSettlement(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
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
  if (!sample.enabled || sample.startedAtSystemEdge || sample.startedInHorizontalControl || sample.startedInHardExcludedControl) return null;
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
