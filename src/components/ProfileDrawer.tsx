import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { buildSpringSettle, readTranslateX } from '../services/springMotion';
import { profileParent, type ProfileSection } from './ProfileSettings';
import type { MotionPresetId } from '../services/interfaceMotion';

export default function ProfileDrawer({ section, scrollPositions, onBack, closing, onExited, preset, swipeEnabled, children }: {
  section: ProfileSection;
  scrollPositions: Record<string, number>;
  onBack: () => void;
  closing: boolean;
  onExited: () => void;
  preset: MotionPresetId;
  swipeEnabled: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const previousSection = useRef(section);
  const animation = useRef<Animation | null>(null);
  const hasEntered = useRef(false);
  const exitCallback = useRef(onExited);
  exitCallback.current = onExited;
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const background = Array.from(document.querySelectorAll<HTMLElement>('[data-profile-background]'), element => ({ element, hidden: element.getAttribute('aria-hidden'), inert: element.inert }));
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    panel.current?.focus({ preventScroll: true });
    background.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = overflow;
      background.forEach(({ element, hidden, inert }) => {
        element.inert = inert;
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      });
      (opener?.isConnected ? opener : document.getElementById('profile-opener'))?.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const saveScroll = () => { scrollPositions[section] = element.scrollTop; };
    element.scrollTop = scrollPositions[section] ?? 0;
    const from = previousSection.current;
    previousSection.current = section;
    const content = element.querySelector<HTMLElement>('.profile-settings');
    const heading = element.querySelector<HTMLElement>('.profile-settings h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    element.addEventListener('scroll', saveScroll, { passive: true });
    const motion = from !== section && content && typeof content.animate === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches
      ? buildSpringSettle(profileParent(from) === section ? -16 : 16, 0, preset) : null;
    const flight = motion && content?.animate(motion.keyframes, { duration: motion.duration });
    return () => { flight?.cancel(); element.removeEventListener('scroll', saveScroll); };
  }, [section, scrollPositions, preset]);

  useLayoutEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const element = panel.current;
      if (!element || event.defaultPrevented || document.querySelector('dialog[open], [role="alertdialog"][aria-modal="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); onBack(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary, [tabindex="0"]')).filter(control => control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      const focused = document.activeElement;
      if (!element.contains(focused)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && (focused === first || focused?.getAttribute('tabindex') === '-1')) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && focused === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onBack]);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const prior = animation.current;
    const width = element.clientWidth;
    const current = prior ? readTranslateX(getComputedStyle(element).transform) : hasEntered.current ? 0 : width;
    prior?.cancel();
    animation.current = null;
    hasEntered.current = true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof element.animate !== 'function') {
      if (closing) exitCallback.current();
      return;
    }
    const end = closing ? width : 0;
    const spring = buildSpringSettle(current - end, 0, preset);
    const frames = spring.keyframes.map(frame => ({ ...frame, transform: `translate3d(${end + readTranslateX(frame.transform) * Math.max(1, Math.abs(current - end) / 640)}px,0,0)` }));
    const flight = element.animate(frames, { duration: spring.duration, fill: 'forwards' });
    animation.current = flight;
    void flight.finished.then(() => {
      if (animation.current !== flight) return;
      animation.current = null;
      if (closing) exitCallback.current();
      else flight.cancel();
    }, () => undefined);
  }, [closing, preset]);

  useLayoutEffect(() => () => animation.current?.cancel(), []);

  return <main ref={panel} id="screen-settings" tabIndex={-1} className="profile-page-screen lifeos-panel" aria-label="Profile and settings"
      onPointerDown={event => {
        const target = event.target;
        pointer.current = null;
        if (!swipeEnabled || event.pointerType !== 'touch' || !event.isPrimary || !(target instanceof Element) ||
          target.closest('button, input, select, textarea, a, summary, label, dialog, [contenteditable]')) return;
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerCancel={() => { pointer.current = null; }}
      onPointerUp={event => {
        const start = pointer.current;
        pointer.current = null;
        if (start?.id !== event.pointerId || window.getSelection()?.isCollapsed === false) return;
        const travel = event.clientX - start.x;
        if (start.x > 28 && travel >= 64 && travel > Math.abs(start.y - event.clientY) * 1.5) onBack();
      }}>
      <header className="profile-page-toolbar"><button type="button" aria-label="Back from profile" className="profile-page-back lifeos-raised" onClick={onBack}><ChevronLeft size={22} aria-hidden="true" /></button></header>
      {children}
    </main>;
}
