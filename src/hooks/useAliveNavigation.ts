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
  velocity: number;
  started: number;
};
interface FlightStats {
  durationMs: number;
  interrupted: boolean;
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
    const old = routeElement(from);
    const next = routeElement(to);
    const previous = transition.current;
    const fromPose = readRoutePose(old);
    const reversePose = previous?.from === to && next && !next.hidden ? readRoutePose(next) : null;
    const bounds = old?.getBoundingClientRect();
    const focusIncoming = old?.contains(document.activeElement) ?? false;
    const travelDirection = direction ?? (tabIndex(to) < tabIndex(from) ? 'right' : 'left');
    const sign = travelDirection === 'right' ? -1 : 1;
    const toPose = reversePose ?? { x: sign * 52, opacity: .98 };
    if (drag.current) toPose.x = sign * Math.max(18, 52 - Math.abs(fromPose.x) * .24);

    clearDrag();
    cancel();
    activeTabRef.current = to;
    setActiveTab(to);
    if (reduced || !old || !bounds?.width) {
      if (focusIncoming) queueMicrotask(() => focusRoute(routeElement(to)));
      return;
    }
    const flight: Flight = {
      id: ++sequence.current, from, to, direction: travelDirection, fromPose, toPose, focusIncoming, velocity,
      started: performance.now(), outgoing: { top: bounds.top, left: bounds.left - fromPose.x, width: bounds.width },
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
    const enter = animateRoute(incoming, flight.toPose, { x: 0, opacity: 1 }, preset);
    const exit = outgoing && animateRoute(outgoing, flight.fromPose, { x: -sign * momentumTarget, opacity: .78 }, preset);
    const stop = () => { enter.cancel(); exit?.cancel(); };
    stopFlight.current = stop;
    const finish = () => {
      if (stopFlight.current !== stop || transition.current?.id !== flight.id) return;
      stopFlight.current = null;
      transition.current = null;
      latest.current = { durationMs: performance.now() - flight.started, interrupted: false };
      setTabTransition(current => current?.id === flight.id ? null : current);
    };
    void Promise.all(exit ? [enter, exit] : [enter]).then(finish, finish);
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
    activeTab, activeTabRef, tabTransition, jumpTo, cancel, beginDrag, moveDrag, endDrag, transitionPropsFor, latest,
  };
}

function focusRoute(route: HTMLElement | null) {
  const heading = route?.querySelector<HTMLElement>('[data-route-focus], h1, h2') ?? route;
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}
