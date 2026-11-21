import AppHeader from './AppHeader';
import { animateRoute, readRoutePose } from '../services/aliveMotion';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { profileParent, type ProfileSection } from './ProfileSettings';
import type { MotionPresetId } from '../services/interfaceMotion';

export default function ProfileDrawer({ section, scrollPositions, onBack, closing, onExited, preset, reduced, swipeEnabled, children }: {
  section: ProfileSection;
  scrollPositions: Record<string, number>;
  onBack: () => void;
  closing: boolean;
  onExited: () => void;
  preset: MotionPresetId;
  reduced: boolean;
  swipeEnabled: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const previousSection = useRef(section);
  const animation = useRef<ReturnType<typeof animateRoute> | null>(null);
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
    const heading = element.querySelector<HTMLElement>(section === 'home' ? '#profile-route-title' : '.profile-settings h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    element.addEventListener('scroll', saveScroll, { passive: true });
    const flight = from !== section && content && !reduced
      ? animateRoute(content, { x: profileParent(from) === section ? -42 : 42, opacity: .65 }, { x: 0, opacity: 1 }, preset)
      : null;
    return () => { flight?.cancel(); element.removeEventListener('scroll', saveScroll); };
  }, [section, scrollPositions, preset, reduced]);

  useLayoutEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const element = panel.current;
      if (!element || event.defaultPrevented || document.querySelector('dialog[open], [role="alertdialog"][aria-modal="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); onBack(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...Array.from(element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary, [tabindex="0"]')), ...document.querySelectorAll<HTMLElement>('.app-bottom-nav [data-tab]')].filter(control => control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      const focused = document.activeElement;
      if (!element.contains(focused) && !focused?.closest('.app-bottom-nav')) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
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
    const current = prior ? readRoutePose(element).x : hasEntered.current ? 0 : width;
    prior?.cancel();
    animation.current = null;
    if (reduced || typeof element.animate !== 'function') {
      hasEntered.current = true;
      if (closing) exitCallback.current();
      return;
    }
    const end = closing ? width : 0;
    const flight = animateRoute(element, { x: current, opacity: 1 }, { x: end, opacity: 1 }, preset);
    animation.current = flight;
    const finish = () => {
      if (animation.current !== flight) return;
      animation.current = null;
      if (closing) exitCallback.current();
      else { hasEntered.current = true; flight.cancel(); }
    };
    void flight.then(finish, finish);
  }, [closing, preset, reduced]);

  useLayoutEffect(() => () => {
    animation.current?.cancel();
    animation.current = null;
  }, []);

  return <main ref={panel} id="screen-settings" tabIndex={-1} className="profile-page-screen lifeos-panel" data-closing={closing} aria-label="Profile and settings"
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
      <AppHeader title="Profile" profile back={section === "home" ? onBack : undefined} />
      {children}
    </main>;
}
