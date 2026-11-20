import { playPrimaryTransition } from '../services/primaryTransition';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { readRoutePose, type RoutePose } from '../services/aliveMotion';
import { resistDrag, type MotionPresetId } from '../services/interfaceMotion';
import { PRIMARY_NAVIGATION, primaryDestinationForTab, type MainTab } from '../services/navigationCatalog';

type Direction = 'left' | 'right';
type Bounds = { top: number; left: number; width: number };
const pose = (x: number): RoutePose => ({ x, opacity: 1 });
type Drag = { element: HTMLElement; width: number; origin: number; position: number; scrollOffset: (tab: MainTab) => number; preview: HTMLElement | null; previewTab: MainTab | null };
type Flight = {
  followedFinger: boolean;
  id: number;
  from: MainTab;
  to: MainTab;
  outgoing?: Bounds;
  direction: Direction;
  trackFrom: number;
  focusIncoming: boolean;
  indicatorFrom: number;
  velocity: number;
  started: number;
  scrollBefore: number;
};
interface FlightStats {
  durationMs: number;
  interrupted: boolean;
  p95FrameMs?: number;
  overruns?: number;
}

const routeElement = (tab: MainTab) => document.getElementById(`screen-${tab}`);
const order = PRIMARY_NAVIGATION.map(item => item.tab);
const tabIndex = (tab: MainTab) => order.indexOf(primaryDestinationForTab(tab) ?? 'dashboard');

export function useAliveNavigation(preset: MotionPresetId, reduced: boolean) {
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const activeTabRef = useRef<MainTab>('dashboard');
  const [tabTransition, setTabTransition] = useState<Flight | null>(null);
  const transition = useRef<Flight | null>(null);
  const sequence = useRef(0);
  const stopFlight = useRef<(() => void) | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const drag = useRef<Drag | null>(null);
  const settle = useRef<(() => void) | null>(null);
  const latest = useRef<FlightStats | null>(null);
  const measure = useRef(false);
  const slowRuns = useRef(0);
  const stageWidth = useRef(0);
  const track = useRef<HTMLDivElement | null>(null);
  const stageObserver = useRef<ResizeObserver | null>(null);
  const attachStage = useCallback((stage: HTMLDivElement | null) => {
    stageObserver.current?.disconnect();
    stageWidth.current = 0;
    track.current = stage;
    if (!stage) return;
    stageWidth.current = stage.clientWidth;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => { stageWidth.current = entry.contentRect.width; });
    observer.observe(stage);
    stageObserver.current = observer;
  }, []);
  const indicator = useRef<HTMLSpanElement>(null);

  const removePreview = (preview: HTMLElement | null) => {
    preview?.removeAttribute('data-gesture-preview');
    preview?.style.removeProperty('--gesture-top');
    preview?.style.removeProperty('--gesture-left');
    preview?.style.removeProperty('--gesture-width');
  };

  const clearDrag = useCallback(() => {
    const element = drag.current?.element;
    removePreview(drag.current?.preview ?? null);
    drag.current = null;
    element?.removeAttribute('data-gesture-dragging');
    track.current?.style.removeProperty('--gesture-x');
    track.current?.removeAttribute('data-track-dragging');
    indicator.current?.style.removeProperty('--track-indicator');
    settle.current?.();
    settle.current = null;
    return element;
  }, []);

  const cancel = useCallback(() => {
    const current = transition.current;
    if (current) latest.current = { durationMs: performance.now() - current.started, interrupted: true };
    pending.current = null;
    transition.current = null;
    stopFlight.current?.();
    stopFlight.current = null;
    setTabTransition(null);
  }, []);

  const jumpTo = (to: MainTab, direction?: Direction, velocity = 0, targetScroll = 0, onCommit?: (from: MainTab) => void) => {
    const from = activeTabRef.current;
    if (from === to) { clearDrag(); return; }
    const started = performance.now();
    const old = routeElement(from);
    const next = routeElement(to);
    const previous = transition.current;
    if (previous && previous.from !== to && tabIndex(from) !== tabIndex(to)) {
      pending.current = () => jumpTo(to, direction, velocity, targetScroll, onCommit);
      return;
    }
    const interrupted = Boolean(previous || drag.current || settle.current);
    const activeDrag = drag.current;
    const fromPose = activeDrag ? pose(activeDrag.position) : interrupted ? readRoutePose(track.current) : pose(0);
    const width = activeDrag?.width || stageWidth.current || old?.clientWidth || 0;
    const indicatorFrom = activeDrag && activeDrag.previewTab ? dragIndicator(activeDrag) : previous && indicator.current?.offsetWidth
      ? readRoutePose(indicator.current).x * 100 / indicator.current.offsetWidth : tabIndex(from) * 100;
    const focusIncoming = old?.contains(document.activeElement) ?? false;
    const travelDirection = direction ?? (tabIndex(to) < tabIndex(from) ? 'right' : 'left');
    const sign = travelDirection === 'right' ? -1 : 1;
    const followedFinger = !!next && activeDrag?.preview === next;
    const trackFrom = sign * width + (followedFinger || previous?.from === to ? fromPose.x : 0);
    const scrollBefore = window.scrollY;

    clearDrag();
    cancel();
    onCommit?.(from);
    activeTabRef.current = to;
    setActiveTab(to);
    if (reduced || !old || !next || !width || tabIndex(from) === tabIndex(to)) {
      if (focusIncoming) queueMicrotask(() => focusRoute(routeElement(to)));
      return;
    }
    const flight: Flight = {
      id: ++sequence.current, from, to, direction: travelDirection, trackFrom, focusIncoming, indicatorFrom, velocity,
      started, followedFinger, scrollBefore, outgoing: { top: targetScroll - scrollBefore, left: -sign * width, width },
    };
    transition.current = flight;
    setTabTransition(flight);
  };

  useLayoutEffect(() => {
    if (!tabTransition) return;
    const flight = tabTransition;
    const incoming = routeElement(flight.to);
    const stage = track.current;
    const outgoing = routeElement(flight.from);
    if (flight.focusIncoming) focusRoute(incoming);
    if (!incoming || !stage || reduced) { cancel(); return; }
    const surfaces: Parameters<typeof playPrimaryTransition>[0] = [
      { element: stage, from: pose(flight.trackFrom), to: pose(0) },
    ];
    if (indicator.current && tabIndex(flight.from) !== tabIndex(flight.to)) {
      surfaces.push({ element: indicator.current, unit: '%',
        from: { x: flight.indicatorFrom, opacity: 1 }, to: { x: tabIndex(flight.to) * 100, opacity: 1 } });
    }
    const animations = playPrimaryTransition(surfaces, preset, flight.followedFinger ? Math.abs(flight.velocity) : 0);
    if (!animations.length) { cancel(); return; }
    const intervals: number[] = [];
    let frameId = 0;
    let previousFrame = performance.now();
    const sample = (time: number) => {
      if (time > previousFrame) intervals.push(time - previousFrame);
      previousFrame = time;
      frameId = requestAnimationFrame(sample);
    };
    if (measure.current) frameId = requestAnimationFrame(sample);
    const stop = () => { cancelAnimationFrame(frameId); for (const animation of animations) animation.cancel(); };
    stopFlight.current = stop;
    const finish = () => {
      if (stopFlight.current !== stop || transition.current?.id !== flight.id) return;
      stopFlight.current = null;
      transition.current = null;
      cancelAnimationFrame(frameId);
      const ordered = intervals.slice().sort((a, b) => a - b);
      const median = ordered[Math.floor(ordered.length / 2)] ?? 0;
      const p95FrameMs = ordered[Math.max(0, Math.ceil(ordered.length * .95) - 1)];
      const overruns = median > 0 ? intervals.filter(interval => interval > Math.max(25, median * 1.6)).length : 0;
      if (ordered.length >= 5) {
        slowRuns.current = overruns >= 2 || median > 25 ? Math.min(5, slowRuns.current + 1) : Math.max(0, slowRuns.current - 1);
        document.documentElement.dataset.motionBudget = slowRuns.current >= 3 ? 'constrained' : 'normal';
      }
      const ended = performance.now();
      if (measure.current) {
        performance.clearMeasures('lifeos-tab-transition');
        performance.measure('lifeos-tab-transition', { start: flight.started, end: ended });
      }
      latest.current = { durationMs: ended - flight.started, interrupted: false, p95FrameMs, overruns };
      setTabTransition(current => current?.id === flight.id ? null : current);
      const next = pending.current;
      pending.current = null;
      next?.();
    };
    void Promise.all(animations.map(animation => animation.finished)).then(finish, finish);
    return () => {
      if (stopFlight.current === stop) stopFlight.current = null;
      stop();
      outgoing?.style.removeProperty('--outgoing-top');
    };
  }, [tabTransition, reduced, preset, cancel]);

  useLayoutEffect(() => {
    if (reduced) { clearDrag(); cancel(); }
    return () => { clearDrag(); };
  }, [reduced, clearDrag, cancel]);

  const beginDrag = (scrollOffset: (tab: MainTab) => number) => {
    if (reduced) return;
    const element = routeElement(activeTabRef.current);
    if (!element) return;
    const width = stageWidth.current || element.clientWidth;
    if (!width) return;
    const origin = transition.current || settle.current ? readRoutePose(track.current).x : 0;
    if (transition.current) cancel();
    clearDrag();
    drag.current = { element, origin, width, position: origin, scrollOffset, preview: null, previewTab: null };
    track.current?.style.setProperty('--gesture-x', `${origin}px`);
    track.current?.setAttribute('data-track-dragging', 'true');
    element.setAttribute('data-gesture-dragging', 'true');
  };

  const moveDrag = (distance: number) => {
    const current = drag.current;
    if (!current || reduced) return;
    const { width } = current;
    const offset = current.origin + distance;
    const nextTab = offset === 0 ? undefined : order[tabIndex(activeTabRef.current) + (offset < 0 ? 1 : -1)];
    const preview = nextTab ? routeElement(nextTab) : null;
    if (preview !== current.preview) {
      removePreview(current.preview);
      current.preview = preview;
      current.previewTab = preview ? nextTab ?? null : null;
      if (preview && nextTab) {
        const top = window.scrollY - current.scrollOffset(nextTab);
        preview.style.setProperty('--gesture-top', `${top}px`);
        preview.style.setProperty('--gesture-left', `${offset < 0 ? width : -width}px`);
        preview.style.setProperty('--gesture-width', `${width}px`);
        preview.setAttribute('data-gesture-preview', 'true');
      }
    }
    const position = preview
      ? Math.max(-width, Math.min(width, offset))
      : resistDrag(offset, width, preset) * .5;
    current.position = position;
    track.current?.style.setProperty('--gesture-x', `${current.position}px`);
    indicator.current?.style.setProperty('--track-indicator', `translate3d(${dragIndicator(current)}%,0,0)`);
  };

  function dragIndicator(current: Drag) {
    const from = tabIndex(activeTabRef.current);
    const to = current.previewTab ? tabIndex(current.previewTab) : from;
    const progress = Math.min(1, Math.abs(current.position / current.width));
    return (from + (to - from) * progress) * 100;
  }

  const endDrag = (animate: boolean, velocity = 0) => {
    const current = drag.current;
    const stage = track.current;
    if (!current || !stage || !animate || reduced || Math.abs(current.position) < .5) { clearDrag(); return; }
    const { element, preview, position } = current;
    const surfaces: Parameters<typeof playPrimaryTransition>[0] = [
      { element: stage, from: pose(position), to: pose(0) },
    ];
    if (indicator.current) surfaces.push({ element: indicator.current, unit: '%',
      from: pose(dragIndicator(current)), to: pose(tabIndex(activeTabRef.current) * 100) });
    const animations = playPrimaryTransition(surfaces, preset, Math.abs(velocity));
    drag.current = null;
    const cleanup = () => {
      removePreview(preview);
      element.removeAttribute('data-gesture-dragging');
      stage.style.removeProperty('--gesture-x');
      stage.removeAttribute('data-track-dragging');
      indicator.current?.style.removeProperty('--track-indicator');
      for (const animation of animations) animation.cancel();
    };
    settle.current = cleanup;
    const finish = () => {
      if (settle.current !== cleanup) return;
      settle.current = null;
      cleanup();
    };
    void Promise.all(animations.map(animation => animation.finished)).then(finish, finish);
  };

  const alignOutgoingScroll = () => {
    const flight = transition.current;
    const outgoing = flight && routeElement(flight.from);
    if (!flight || !outgoing) return;
    const top = `${window.scrollY - flight.scrollBefore}px`;
    outgoing.style.top = top;
    outgoing.style.setProperty('--outgoing-top', top);
  };

  const canCommitDrag = (tab: MainTab) => !drag.current?.previewTab || drag.current.previewTab === tab;
  const transitionPropsFor = (tab: MainTab) => {
    if (tabTransition?.from === tab && tabTransition.outgoing) {
      return { outgoing: tabTransition.outgoing, transitionDirection: tabTransition.direction };
    }
    if (tabTransition?.to === tab) {
      return { transitionPhase: 'running' as const, transitionDirection: tabTransition.direction };
    }
    return {};
  };

  return {
    activeTab, activeTabRef, tabTransition, attachStage, indicator, jumpTo, cancel, canCommitDrag, alignOutgoingScroll, cancelPending: () => { pending.current = null; }, beginDrag, moveDrag, endDrag, transitionPropsFor, latest, measure,
  };
}

function focusRoute(route: HTMLElement | null) {
  const heading = route?.querySelector<HTMLElement>('[data-route-focus], h1, h2') ?? document.getElementById('primary-route-title') ?? route;
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
