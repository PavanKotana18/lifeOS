import { useEffect, useRef, useState } from 'react';
import BusyDooLaunchArtwork from './BusyDooLaunchArtwork';
import { CINEMATIC_SECONDS, REGULAR_LAUNCH_MS, createLaunchRenderer } from './busyDooLaunchTimeline';
import './busyDooLaunch.css';

const ICON = './brand/busydoo-approved-icon.png';
const FIRST_LAUNCH_KEY = 'busydoo-harmony-seen';
// Match the existing Android exit animation before starting the reference timeline.
const NATIVE_HANDOFF_MS = 180;
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const REPLAY_BUSYDOO_LAUNCH = 'busydoo:replay-launch';

export function initialBusyDooLaunch() {
  try { return localStorage.getItem(FIRST_LAUNCH_KEY) !== 'yes'; }
  catch { return false; }
}

export default function BusyDooLaunch({ cinematic, releaseNativeSplash, onFinish }: {
  cinematic: boolean;
  releaseNativeSplash?: () => Promise<void>;
  onFinish: () => void;
}) {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(MOTION_QUERY).matches);
  const [phase, setPhase] = useState<'native' | 'cinematic' | 'regular' | 'leaving'>('native');
  const stage = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLImageElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const complete = useRef(onFinish);
  complete.current = onFinish;

  useEffect(() => {
    const preference = window.matchMedia(MOTION_QUERY);
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let timer = 0;
    let watchdog = 0;
    let released = false;
    const exit = () => {
      if (disposed) return;
      if (reduced) { complete.current(); return; }
      setPhase('leaving');
      timer = window.setTimeout(() => complete.current(), 120);
    };
    const play = () => {
      if (disposed) return;
      if (!cinematic || reduced) {
        setPhase('regular');
        timer = window.setTimeout(exit, reduced ? REGULAR_LAUNCH_MS : REGULAR_LAUNCH_MS - 120);
        return;
      }

      const render = createLaunchRenderer(stage.current!);
      render(0);
      setPhase('cinematic');
      frame = requestAnimationFrame(start => {
        const tick = (now: number) => {
          const time = Math.min(CINEMATIC_SECONDS, (now - start) / 1000);
          render(time);
          if (time < CINEMATIC_SECONDS) frame = requestAnimationFrame(tick);
          else exit();
        };
        tick(start);
      });
    };

    if (releaseNativeSplash) {
      // Preload the matching image while the native cover still owns the screen.
      const release = () => {
        if (disposed || released) return;
        released = true;
        void releaseNativeSplash().catch(() => {});
        if (cinematic && !reduced) timer = window.setTimeout(play, NATIVE_HANDOFF_MS);
        else play();
      };
      const image = mark.current;
      const show = () => {
        window.clearTimeout(watchdog);
        release();
      };
      watchdog = window.setTimeout(show, 350);
      if (image?.decode) void image.decode().then(show, show);
      else show();
    } else {
      play();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.clearTimeout(watchdog);
    };
  }, [cinematic, reduced, releaseNativeSplash]);

  useEffect(() => {
    if (phase === 'cinematic') skip.current?.focus({ preventScroll: true });
  }, [phase]);

  const cinematicVisible = cinematic && !reduced && (phase === 'cinematic' || phase === 'leaving');
  return <div className="busydoo-launch" data-phase={phase} data-cinematic={cinematicVisible}
    data-reduced={reduced} role={cinematicVisible ? 'dialog' : 'status'} aria-modal={cinematicVisible || undefined}
    aria-label={cinematicVisible ? 'BusyDoo ? A Life in Harmony. Planning, habits, goals and finances come together.' : 'BusyDoo is opening'}>
    <div ref={stage} className="busydoo-launch-stage">
      {cinematic && !reduced && <BusyDooLaunchArtwork />}
    </div>
    <img ref={mark} className="busydoo-launch-icon" src={ICON} alt="" fetchPriority="high" />
    <div className="busydoo-launch-lockup" aria-hidden="true">
      <div className="busydoo-launch-word">BusyD<span>oo</span></div>
      <div className="busydoo-launch-tagline">Life, in one place.</div>
    </div>
    {cinematicVisible && <button ref={skip} type="button" className="busydoo-launch-skip" onClick={onFinish}
      onKeyDown={event => {
        if (event.key === 'Escape') onFinish();
        if (event.key === 'Tab') event.preventDefault();
      }}>Skip intro</button>}
  </div>;
}
