import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { flushSync } from 'react-dom';
import type { TodaySectionId } from '../services/todayLayout';

const interactive = 'button, a, input, label, select, textarea, summary, [role="button"], [role="dialog"]';

export function useTodayCardDrag(order: TodaySectionId[], enabled: boolean, reduced: boolean,
  onStart: () => void, onFinish: (order: TodaySectionId[]) => void, onOpen: (id: TodaySectionId, trigger: HTMLElement) => void) {
  const pending = useRef<{ id: TodaySectionId; root: HTMLDivElement; card: HTMLElement; pointer: number; x: number; y: number; initialX: number; initialY: number; initialLeft: number; initialTop: number; frame: number; active: boolean; timer: number } | null>(null);
  const currentOrder = useRef(order);
  const preventClickUntil = useRef(0);
  const [draft, setDraft] = useState<TodaySectionId[] | null>(null);

  const finish = (commit: boolean) => {
    const drag = pending.current;
    if (!drag) return;
    pending.current = null;
    clearTimeout(drag.timer);
    cancelAnimationFrame(drag.frame);
    drag.card.removeAttribute('data-today-pressed');
    if (!drag.active) return;
    preventClickUntil.current = Date.now() + 350;
    if (drag.root.hasPointerCapture(drag.pointer)) drag.root.releasePointerCapture(drag.pointer);
    const x = drag.card.style.getPropertyValue('--today-drag-x') || '0px';
    const y = drag.card.style.getPropertyValue('--today-drag-y') || '0px';
    drag.card.removeAttribute('data-today-lifted');
    drag.card.style.removeProperty('--today-drag-x');
    drag.card.style.removeProperty('--today-drag-y');
    if (!reduced && commit) drag.card.animate?.([
      { transform: `translate(${x}, ${y}) scale(1.025)` }, { transform: 'translateY(-2px) scale(1.008)', offset: .8 }, { transform: 'none' },
    ], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (commit) onFinish(currentOrder.current);
    setDraft(null);
  };

  useEffect(() => {
    if (!enabled) finish(false);
    const cancel = () => finish(false);
    const preventScroll = (event: TouchEvent) => {
      if (pending.current?.active && event.cancelable) event.preventDefault();
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', cancel);
    document.addEventListener('touchmove', preventScroll, { passive: false });
    const cancelPressOnScroll = () => { if (!pending.current?.active) finish(false); };
    window.addEventListener('scroll', cancelPressOnScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
      document.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('scroll', cancelPressOnScroll, true);
    };
  }, [enabled]);
  useEffect(() => () => {
    const drag = pending.current;
    if (drag) { clearTimeout(drag.timer); cancelAnimationFrame(drag.frame); }
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) { if (!pending.current?.active) finish(false); return; }
    if (!enabled || pending.current || event.button !== 0) return;
    const target = event.target as Element;
    const card = target.closest<HTMLElement>('[data-today-card]');
    const id = card?.dataset.todayCard as TodaySectionId | undefined;
    if (!id || !card || target.closest(interactive)) return;
    const root = event.currentTarget;
    const bounds = card.getBoundingClientRect();
    const drag = { id, card, root, pointer: event.pointerId, x: event.clientX, y: event.clientY, initialX: event.clientX, initialY: event.clientY, initialLeft: bounds.left, initialTop: bounds.top,
      frame: 0, active: false, timer: 0 };
    pending.current = drag;
    if (!reduced) card.dataset.todayPressed = 'true';
    currentOrder.current = order;
    drag.timer = window.setTimeout(() => {
      if (pending.current !== drag) return;
      try { root.setPointerCapture(drag.pointer); } catch { finish(false); return; }
      drag.active = true;
      card.removeAttribute('data-today-pressed');
      onStart();
      card.dataset.todayLifted = 'true';
      navigator.vibrate?.(12);
      const update = () => {
        const offset = drag.y < 96 ? -Math.min(14, (96 - drag.y) / 6)
          : drag.y > window.innerHeight - 120 ? Math.min(14, (drag.y - window.innerHeight + 120) / 6) : 0;
        if (offset) window.scrollBy(0, offset);
        const cards = [...root.querySelectorAll<HTMLElement>('[data-today-card]')].filter(item => item !== card && item.getClientRects().length);
        const container = root.getBoundingClientRect();
        const peer = cards.find(item => {
          const left = container.left + item.offsetLeft;
          const top = container.top + item.offsetTop;
          return drag.x >= left && drag.x <= left + item.offsetWidth && drag.y >= top && drag.y <= top + item.offsetHeight;
        });
        const targetId = peer?.dataset.todayCard as TodaySectionId | undefined;
        const original = currentOrder.current;
        if (peer && targetId) {
          const from = original.indexOf(id);
          const to = original.indexOf(targetId);
          const sameRow = card.offsetTop === peer.offsetTop;
          const pointer = sameRow ? drag.x : drag.y;
          const midpoint = sameRow ? container.left + peer.offsetLeft + peer.offsetWidth / 2
            : container.top + peer.offsetTop + peer.offsetHeight / 2;
          const passedMidpoint = from < to ? pointer > midpoint : pointer < midpoint;
          if (passedMidpoint) {
            const positions = cards.map(item => item.getBoundingClientRect());
            const next = [...original];
            next.splice(from, 1);
            next.splice(to, 0, id);
            currentOrder.current = next;
            flushSync(() => setDraft(next));
            if (!reduced) cards.forEach((item, index) => {
              item.getAnimations?.().filter(animation => animation.id === 'today-sort').forEach(animation => animation.cancel());
              const bounds = item.getBoundingClientRect();
              const x = positions[index].left - bounds.left;
              const y = positions[index].top - bounds.top;
              if (x || y) item.animate?.([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }], { id: 'today-sort', duration: 230, easing: 'ease-out' });
            });
          }
        }
        card.style.setProperty('--today-drag-x', (drag.initialLeft + drag.x - drag.initialX - container.left - card.offsetLeft) + 'px');
        card.style.setProperty('--today-drag-y', (drag.initialTop + drag.y - drag.initialY - container.top - card.offsetTop) + 'px');
        drag.frame = requestAnimationFrame(update);
      };
      drag.frame = requestAnimationFrame(update);
    }, 425);
  };

  return { order: draft ?? order, isDragging: () => pending.current?.active === true, handlers: {
    onPointerDown,
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const drag = pending.current;
      if (!drag || drag.pointer !== event.pointerId) return;
      if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 9) finish(false);
      else if (drag.active) {
        drag.x = event.clientX;
        drag.y = event.clientY;
      }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => { if (pending.current?.pointer === event.pointerId) finish(true); },
    onPointerLeave: () => { if (!pending.current?.active) finish(false); },
    onPointerCancel: () => finish(false),
    onLostPointerCapture: () => finish(false),
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (Date.now() < preventClickUntil.current) { event.preventDefault(); event.stopPropagation(); return; }
      const target = event.target as Element;
      if (target.closest(interactive) || !event.currentTarget.contains(target)) return;
      const card = target.closest<HTMLElement>('[data-today-card]');
      const id = card?.dataset.todayCard as TodaySectionId | undefined;
      if (card && id) onOpen(id, card);
    },
  } };
}
