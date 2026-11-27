import { useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import type { MotionPresetId } from '../services/interfaceMotion';
import { buildCardSpring } from '../services/springMotion';
import type { TodaySectionId } from '../services/todayLayout';

const cardSelector = '[data-today-card]';
const interactive = 'button, a, input, label, select, textarea, summary, [role="button"], [role="dialog"]';

type Point = { x: number; y: number };
type Slot = Point & { width: number; height: number };
type Flight = { animation: Animation; spring: ReturnType<typeof buildCardSpring> };
type Session = {
  cards: HTMLElement[];
  slots: Map<HTMLElement, Slot>;
  order: TodaySectionId[];
  grab: Point;
  rendered: Point;
  translation: Point;
  lastFrame: number | null;
  scrollSpeed: number;
  scrollRemainder: number;
  blockedPeer?: HTMLElement;
  observer?: ResizeObserver;
  dirty: boolean;
};
type Press = {
  id: TodaySectionId;
  card: HTMLElement;
  root: HTMLDivElement;
  pointer: number;
  point: Point;
  frame: number;
  timer: number;
  session?: Session;
};

function measure(root: HTMLElement, cards: HTMLElement[]) {
  const parent = root.getBoundingClientRect();
  const x = parent.left + window.scrollX;
  const y = parent.top + window.scrollY;
  return new Map(cards.map(card => [card, {
    x: x + card.offsetLeft, y: y + card.offsetTop, width: card.offsetWidth, height: card.offsetHeight,
  }]));
}

function slideOrder(cards: HTMLElement[], order: TodaySectionId[]) {
  for (const card of cards) {
    card.style.setProperty('--today-sort-order', String(order.indexOf(card.dataset.todayCard as TodaySectionId) + 2));
  }
}

function releaseOrder(cards: HTMLElement[]) {
  for (const card of cards) card.style.removeProperty('--today-sort-order');
}

function flightOffset(flight?: Flight) {
  if (!flight) return { x: 0, y: 0, vx: 0, vy: 0 };
  const { samples, duration } = flight.spring;
  const step = duration / (samples.length - 1);
  const at = Math.min(samples.length - 1, Math.max(0, Number(flight.animation.currentTime || 0) / step));
  const a = samples[Math.floor(at)];
  const b = samples[Math.min(samples.length - 1, Math.floor(at) + 1)];
  const ratio = at % 1;
  return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio, vx: (b.x - a.x) * 1000 / step, vy: (b.y - a.y) * 1000 / step };
}

function edgeSpeed(y: number, height: number) {
  const edge = Math.min(112, height / 3);
  if (y < edge) return -720 * Math.min(1, (edge - y) / edge) ** 2;
  if (y > height - edge) return 720 * Math.min(1, (y - height + edge) / edge) ** 2;
  return 0;
}

export function useTodayCardDrag(order: TodaySectionId[], enabled: boolean, reduced: boolean,
  onStart: () => void, onFinish: (order: TodaySectionId[]) => void, onOpen: (id: TodaySectionId, trigger: HTMLElement) => void,
  preset: MotionPresetId = 'silky') {
  const pending = useRef<Press | null>(null);
  const flights = useRef(new Map<HTMLElement, Flight>());
  const committing = useRef<HTMLElement[] | null>(null);
  const preventClickUntil = useRef(0);

  useLayoutEffect(() => {
    if (committing.current) releaseOrder(committing.current);
    committing.current = null;
  }, [order]);

  const cancelFlight = (card: HTMLElement) => {
    flights.current.get(card)?.animation.cancel();
    flights.current.delete(card);
    card.removeAttribute('data-today-settling');
  };

  const animateSlot = (card: HTMLElement, x: number, y: number, vx: number, vy: number, scale = 1, origin?: Point) => {
    cancelFlight(card);
    if (reduced || !card.animate || (Math.abs(x) < .1 && Math.abs(y) < .1 && scale === 1)) return;
    const spring = buildCardSpring(x, y, vx, vy, preset, scale);
    const frames = origin ? spring.frames.map(frame => ({ ...frame, transformOrigin: origin.x + 'px ' + origin.y + 'px' })) : spring.frames;
    card.dataset.todaySettling = 'true';
    const animation = card.animate(frames, { duration: spring.duration, easing: 'linear' });
    const flight = { animation, spring };
    flights.current.set(card, flight);
    animation.onfinish = () => {
      if (flights.current.get(card) !== flight) return;
      flights.current.delete(card);
      card.removeAttribute('data-today-settling');
    };
  };

  const movePeers = (drag: Press, session: Session, previous: Map<HTMLElement, Slot>) => {
    for (const card of session.cards) {
      if (card === drag.card) continue;
      const before = previous.get(card)!;
      const after = session.slots.get(card)!;
      if (before.x === after.x && before.y === after.y) continue;
      const shift = flightOffset(flights.current.get(card));
      animateSlot(card, before.x + shift.x - after.x, before.y + shift.y - after.y, shift.vx, shift.vy);
    }
  };

  const finish = (commit: boolean, animate = true) => {
    const drag = pending.current;
    if (!drag) return;
    pending.current = null;
    clearTimeout(drag.timer);
    cancelAnimationFrame(drag.frame);
    drag.card.removeAttribute('data-today-pressed');
    const session = drag.session;
    if (!session) return;
    preventClickUntil.current = Date.now() + 350;
    session.observer?.disconnect();
    if (drag.root.hasPointerCapture(drag.pointer)) drag.root.releasePointerCapture(drag.pointer);
    const previous = session.slots;
    const changed = session.order.some((id, index) => id !== order[index]);
    if (commit && changed) committing.current = session.cards;
    else {
      releaseOrder(session.cards);
      if (changed && animate) {
        session.slots = measure(drag.root, session.cards);
        movePeers(drag, session, previous);
      }
    }

    const slot = session.slots.get(drag.card)!;
    drag.card.removeAttribute('data-today-lifted');
    for (const name of ['--today-drag-x', '--today-drag-y', '--today-grab-x', '--today-grab-y']) drag.card.style.removeProperty(name);
    if (animate) animateSlot(drag.card, session.rendered.x - slot.x, session.rendered.y - slot.y, 0, 0, 1.025, session.grab);
    else for (const card of session.cards) cancelFlight(card);
    if (commit) onFinish(session.order);
  };

  useEffect(() => {
    if (!enabled) finish(false, false);
    const cancel = () => finish(false, false);
    const preventScroll = (event: TouchEvent) => {
      if (pending.current?.session && event.cancelable) event.preventDefault();
    };
    const cancelPressOnScroll = () => { if (!pending.current?.session) finish(false); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', cancel);
    document.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('scroll', cancelPressOnScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
      document.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('scroll', cancelPressOnScroll, true);
    };
  }, [enabled]);

  useEffect(() => () => {
    finish(false, false);
    if (committing.current) releaseOrder(committing.current);
    for (const [card] of flights.current) cancelFlight(card);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) { if (!pending.current?.session) finish(false); return; }
    if (!enabled || pending.current || event.button !== 0) return;
    const target = event.target as Element;
    const card = target.closest<HTMLElement>(cardSelector);
    const id = card?.dataset.todayCard as TodaySectionId | undefined;
    if (!id || !card || target.closest(interactive)) return;

    const root = event.currentTarget;
    const drag: Press = { id, card, root, pointer: event.pointerId, point: { x: event.clientX, y: event.clientY }, frame: 0, timer: 0 };
    pending.current = drag;
    if (!reduced) card.dataset.todayPressed = 'true';

    drag.timer = window.setTimeout(() => {
      if (pending.current !== drag) return;
      try { root.setPointerCapture(drag.pointer); } catch { finish(false); return; }
      const cards = [...root.querySelectorAll<HTMLElement>(cardSelector)].filter(item => item.getClientRects().length);
      const slots = measure(root, cards);
      const slot = slots.get(card);
      if (!slot) { root.releasePointerCapture(drag.pointer); finish(false); return; }
      const shift = flightOffset(flights.current.get(card));
      cancelFlight(card);
      const grab = { x: drag.point.x + window.scrollX - slot.x - shift.x, y: drag.point.y + window.scrollY - slot.y - shift.y };
      const session: Session = { cards, slots, order, grab, rendered: { x: slot.x + shift.x, y: slot.y + shift.y },
        translation: { x: shift.x, y: shift.y }, lastFrame: null, scrollSpeed: 0, scrollRemainder: 0, dirty: false };
      drag.session = session;
      if (typeof ResizeObserver !== 'undefined') {
        session.observer = new ResizeObserver(() => { session.dirty = true; });
        for (const item of [root, ...cards]) session.observer.observe(item);
      }
      card.removeAttribute('data-today-pressed');
      card.style.setProperty('--today-grab-x', grab.x + 'px');
      card.style.setProperty('--today-grab-y', grab.y + 'px');
      card.style.setProperty('--today-drag-x', shift.x + 'px');
      card.style.setProperty('--today-drag-y', shift.y + 'px');
      onStart();
      card.dataset.todayLifted = 'true';
      navigator.vibrate?.(12);

      const update = (now: number) => {
        if (pending.current !== drag) return;
        const dt = session.lastFrame === null ? 0 : Math.min(32, now - session.lastFrame);
        session.lastFrame = now;
        // Read the geometry only when the container or a card really changes size.
        if (session.dirty) {
          const previous = session.slots;
          session.slots = measure(root, cards);
          session.dirty = false;
          movePeers(drag, session, previous);
        }
        const speed = edgeSpeed(drag.point.y, window.innerHeight);
        session.scrollSpeed += (speed - session.scrollSpeed) * (1 - Math.exp(-dt / 65));
        const scroll = session.scrollRemainder + session.scrollSpeed * dt / 1000;
        const step = Math.trunc(scroll);
        session.scrollRemainder = scroll - step;
        const beforeScroll = window.scrollY;
        if (step) window.scrollBy({ top: step, behavior: 'instant' });
        const x = drag.point.x + window.scrollX;
        const y = drag.point.y + (step ? window.scrollY : beforeScroll);

        const peer = cards.find(item => {
          if (item === card) return false;
          const bounds = session.slots.get(item)!;
          return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
        });
        if (session.blockedPeer && peer !== session.blockedPeer) session.blockedPeer = undefined;
        if (peer && peer !== session.blockedPeer) {
          const previous = session.slots;
          const peerSlot = previous.get(peer)!;
          const liftedSlot = previous.get(card)!;
          const from = session.order.indexOf(id);
          const to = session.order.indexOf(peer.dataset.todayCard as TodaySectionId);
          const horizontal = Math.abs(liftedSlot.y - peerSlot.y) < 2;
          const size = horizontal ? peerSlot.width : peerSlot.height;
          const position = horizontal ? x - peerSlot.x : y - peerSlot.y;
          const margin = Math.min(14, size * .15);
          const forward = horizontal ? liftedSlot.x < peerSlot.x : from < to;
          if (to >= 0 && (forward ? position > size / 2 + margin : position < size / 2 - margin)) {
            const next = [...session.order];
            next.splice(from, 1);
            next.splice(to, 0, id);
            session.order = next;
            session.blockedPeer = peer;
            slideOrder(cards, next);
            // One layout snapshot per confirmed reorder, before the browser paints new slots.
            session.slots = measure(root, cards);
            movePeers(drag, session, previous);
          }
        }

        const current = session.slots.get(card)!;
        const next = { x: x - grab.x, y: y - grab.y };
        // Track the finger directly. Springs run only for displaced or released cards.
        const dx = next.x - current.x;
        const dy = next.y - current.y;
        if (dx !== session.translation.x) card.style.setProperty('--today-drag-x', dx + 'px');
        if (dy !== session.translation.y) card.style.setProperty('--today-drag-y', dy + 'px');
        session.translation = { x: dx, y: dy };
        session.rendered = next;
        drag.frame = requestAnimationFrame(update);
      };
      drag.frame = requestAnimationFrame(update);
    }, 425);
  };

  return { isDragging: () => Boolean(pending.current?.session), handlers: {
    onPointerDown,
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const drag = pending.current;
      if (!drag || drag.pointer !== event.pointerId) return;
      if (drag.session) drag.point = { x: event.clientX, y: event.clientY };
      else if (Math.hypot(event.clientX - drag.point.x, event.clientY - drag.point.y) > 9) finish(false);
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => { if (pending.current?.pointer === event.pointerId) finish(true); },
    onPointerLeave: () => { if (!pending.current?.session) finish(false); },
    onPointerCancel: () => finish(false),
    onLostPointerCapture: () => finish(false),
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (Date.now() < preventClickUntil.current) { event.preventDefault(); event.stopPropagation(); return; }
      const target = event.target as Element;
      if (target.closest(interactive) || !event.currentTarget.contains(target)) return;
      const card = target.closest<HTMLElement>(cardSelector);
      const id = card?.dataset.todayCard as TodaySectionId | undefined;
      if (card && id) onOpen(id, card);
    },
  } };
}
