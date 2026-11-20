import { playPrimaryTransition } from '../services/primaryTransition';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { animateRoute, readRoutePose, type RoutePose } from '../services/aliveMotion';
import { getMotionPreset, resistDrag, type MotionPresetId } from '../services/interfaceMotion';
import { PRIMARY_NAVIGATION, primaryDestinationForTab, type MainTab } from '../services/navigationCatalog';

type Direction = 'left' | 'right';
type Bounds = { top: number; left: number; width: number };
type Flight = {
  id: number;
  from: MainTab;
  to: MainTab;
  outgoing?: Bounds;
  direction: Direction;
  fromPose: RoutePose;
  toPose: RoutePose;
  focusIncoming: boolean;
  indicatorFrom: number;
  velocity: number;
  started: number;
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
  const drag = useRef<{ element: HTMLElement; origin: number } | null>(null);
  const settle = useRef<ReturnType<typeof animateRoute> | null>(null);
  const latest = useRef<FlightStats | null>(null);
  const measure = useRef(false);
  const slowRuns = useRef(0);
  const stageBounds = useRef<Bounds | null>(null);
  const stageObserver = useRef<ResizeObserver | null>(null);
  const attachStage = useCallback((stage: HTMLDivElement | null) => {
    stageObserver.current?.disconnect();
    stageBounds.current = null;
    if (!stage) return;
    const update = () => {
      const bounds = stage.getBoundingClientRect();
      stageBounds.current = { top: bounds.top + window.scrollY, left: bounds.left, width: bounds.width };
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    const shell = stage.closest('.app-shell');
    observer.observe(stage);
    if (shell) observer.observe(shell);
    stageObserver.current = observer;
  }, []);
  const indicator = useRef<HTMLSpanElement>(null);

  const clearDrag = useCallback(() => {
    const element = drag.current?.element;
    drag.current = null;
    element?.removeAttribute('data-gesture-dragging');
    element?.style.removeProperty('--gesture-x');
    settle.current?.cancel();
    settle.current = null;
    return element;
  }, []);

  const cancel = useCallback(() => {
    const current = transition.current;
    if (current) latest.current = { durationMs: performance.now() - current.started, interrupted: true };
    transition.current = null;
    stopFlight.current?.();
    stopFlight.current = null;
    setTabTransition(null);
  }, []);

  const jumpTo = (to: MainTab, direction?: Direction, velocity = 0) => {
    const from = activeTabRef.current;
    if (from === to) return;
    const started = performance.now();
    const old = routeElement(from);
    const next = routeElement(to);
    const previous = transition.current;
    const interrupted = Boolean(previous || drag.current || settle.current);
    const fromPose = interrupted ? readRoutePose(old) : { x: 0, opacity: 1 };
    const reversePose = previous?.from === to && next && !next.hidden ? readRoutePose(next) : null;
    const geometry = stageBounds.current;
    const bounds = geometry ? { ...geometry, top: geometry.top - window.scrollY } : old?.getBoundingClientRect();
    const indicatorFrom = previous && indicator.current?.offsetWidth
      ? readRoutePose(indicator.current).x * 100 / indicator.current.offsetWidth : tabIndex(from) * 100;
    const focusIncoming = old?.contains(document.activeElement) ?? false;
    const travelDirection = direction ?? (tabIndex(to) < tabIndex(from) ? 'right' : 'left');
    const sign = travelDirection === 'right' ? -1 : 1;
    const distance = tabIndex(from) === tabIndex(to) ? 38 : Math.min(120, (bounds?.width ?? 390) * .24);
    const toPose = reversePose ?? { x: sign * distance, opacity: .98 };
    if (drag.current) toPose.x = sign * Math.max(18, distance - Math.abs(fromPose.x) * .44);

    clearDrag();
    cancel();
    activeTabRef.current = to;
    setActiveTab(to);
    if (reduced || !old || !bounds?.width) {
      if (focusIncoming) queueMicrotask(() => focusRoute(routeElement(to)));
      return;
    }
    const flight: Flight = {
      id: ++sequence.current, from, to, direction: travelDirection, fromPose, toPose, focusIncoming, indicatorFrom, velocity,
      started, outgoing: { top: bounds.top, left: bounds.left - (geometry ? 0 : fromPose.x), width: bounds.width },
    };
    transition.current = flight;
    setTabTransition(flight);
  };

  useLayoutEffect(() => {
    if (!tabTransition) return;
    const flight = tabTransition;
    const incoming = routeElement(flight.to);
    const outgoing = routeElement(flight.from);
    if (flight.focusIncoming) focusRoute(incoming);
    if (!incoming || reduced) { cancel(); return; }
    const sign = flight.direction === 'right' ? -1 : 1;
    const momentumTarget = Math.max(36, Math.min(112, Math.abs(flight.fromPose.x) + Math.abs(flight.velocity) * .019));
    const surfaces: Parameters<typeof playPrimaryTransition>[0] = [
      { element: incoming, from: flight.toPose, to: { x: 0, opacity: 1 } },
    ];
    if (outgoing) surfaces.push({ element: outgoing, from: flight.fromPose, to: { x: -sign * momentumTarget, opacity: .82 } });
    if (indicator.current && tabIndex(flight.from) !== tabIndex(flight.to)) {
      surfaces.push({ element: indicator.current, unit: '%',
        from: { x: flight.indicatorFrom, opacity: 1 }, to: { x: tabIndex(flight.to) * 100, opacity: 1 } });
    }
    const animations = playPrimaryTransition(surfaces, preset);
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
    };
    void Promise.all(animations.map(animation => animation.finished)).then(finish, finish);
    return () => {
      if (stopFlight.current === stop) stopFlight.current = null;
      stop();
    };
  }, [tabTransition, reduced, preset, cancel]);

  useLayoutEffect(() => {
    if (reduced) { clearDrag(); cancel(); }
    return () => { clearDrag(); };
  }, [reduced, clearDrag, cancel]);

  const beginDrag = () => {
    if (reduced) return;
    const element = routeElement(activeTabRef.current);
    if (!element) return;
    const origin = readRoutePose(element).x;
    cancel();
    clearDrag();
    drag.current = { element, origin };
    element.style.setProperty('--gesture-x', `${origin}px`);
    element.setAttribute('data-gesture-dragging', 'true');
  };

  const moveDrag = (distance: number) => {
    const current = drag.current;
    if (!current || reduced) return;
    const viewport = window.innerWidth;
    const threshold = viewport * .2;
    const absolute = Math.abs(distance);
    const excess = Math.sign(distance) * Math.max(0, absolute - threshold);
    const position = Math.sign(distance) * Math.min(absolute, threshold) + resistDrag(excess, viewport, preset) * .6;
    current.element.style.setProperty('--gesture-x', `${current.origin + position}px`);
  };

  const endDrag = (animate: boolean, velocity = 0) => {
    const pose = readRoutePose(drag.current?.element);
    const element = clearDrag();
    if (!element || !animate || reduced || Math.abs(pose.x) < .5) return;
    const limit = getMotionPreset(preset).velocityLimit;
    const flight = animateRoute(element, pose, { x: 0, opacity: 1 }, preset, Math.max(-limit, Math.min(limit, velocity)));
    settle.current = flight;
    const finish = () => {
      if (settle.current !== flight) return;
      settle.current = null;
      flight.cancel();
    };
    void flight.then(finish, finish);
  };

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
    activeTab, activeTabRef, tabTransition, attachStage, indicator, jumpTo, cancel, beginDrag, moveDrag, endDrag, transitionPropsFor, latest, measure,
  };
}

function focusRoute(route: HTMLElement | null) {
  const heading = route?.querySelector<HTMLElement>('[data-route-focus], h1, h2') ?? route;
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
