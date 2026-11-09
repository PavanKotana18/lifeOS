import { useCallback, useRef } from 'react';

/** Reserve the actual navigation height after font scaling, reflow and safe-area changes. */
export function useBottomNavigationInset() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((navigation: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!navigation) return;
    const root = navigation.ownerDocument.documentElement;
    const update = () => root.style.setProperty('--bottom-navigation-height', `${navigation.getBoundingClientRect().height}px`);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(navigation);
    window.addEventListener('resize', update, { passive: true });
    cleanup.current = () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      root.style.removeProperty('--bottom-navigation-height');
    };
  }, []);
}
