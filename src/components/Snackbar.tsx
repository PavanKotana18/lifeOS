import { useLayoutEffect, useRef } from 'react';
import * as m from 'motion/react-m';
import { Check, Info, X } from 'lucide-react';

export type SnackbarNotice = { message: string; type: 'info' | 'success' | 'danger' };

export default function Snackbar({ notice, onDismiss, reduced }: {
  notice: SnackbarNotice; onDismiss: () => void; reduced: boolean;
}) {
  const position = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - (viewport ? viewport.height + viewport.offsetTop : window.innerHeight));
      const nav = document.querySelector<HTMLElement>('.app-bottom-nav');
      const actions = [...document.querySelectorAll<HTMLElement>('.feather-composer-actions')].reverse().find(element => {
        const layer = element.closest('.feather-composer-layer');
        return element.getClientRects().length && layer?.getAttribute('data-exiting') !== 'true';
      });
      const gap = bottom > 0 ? bottom : nav && !nav.inert ? nav.getBoundingClientRect().height : 0;
      const occupied = actions ? window.innerHeight - actions.getBoundingClientRect().top : gap;
      position.current?.style.setProperty('--snackbar-inset', Math.max(bottom, occupied) + 'px');
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    const nav = document.querySelector(".app-bottom-nav");
    const visibility = nav ? new MutationObserver(update) : null;
    if (nav) visibility?.observe(nav, { attributes: true, attributeFilter: ["inert", "data-profile-active"] });
    for (const element of document.querySelectorAll('.app-bottom-nav, .feather-composer-actions')) observer?.observe(element);
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      visibility?.disconnect();
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [notice]);

  const Icon = notice.type === 'success' ? Check : Info;
  return <div className="ui-toast lifeos-snackbar" ref={position}>
    <m.div className="snackbar-surface" data-tone={notice.type}
      initial={reduced ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { y: 8, opacity: 0 }} transition={{ duration: reduced ? 0 : .16 }}>
      <Icon size={17} aria-hidden="true" />
      <span role={notice.type === 'danger' ? 'alert' : 'status'}>{notice.message}</span>
      <button type="button" className="snackbar-close" onClick={onDismiss} aria-label="Dismiss message"><X size={18} aria-hidden="true" /></button>
    </m.div>
  </div>;
}
