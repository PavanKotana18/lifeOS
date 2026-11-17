import { useEffect, useRef, useState } from 'react';
import { StorageService } from '../db';
import { createMotionPreferenceController, getMotionCssVariables } from '../services/interfaceMotion';

const readReducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

export function useInterfaceMotion() {
  const controllerRef = useRef<ReturnType<typeof createMotionPreferenceController> | null>(null);
  if (!controllerRef.current) {
    const cache = {
      getItem: (key: string) => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
      setItem: (key: string, value: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); },
    };
    controllerRef.current = createMotionPreferenceController({
      get: (key, fallback) => StorageService.settings.get(key, fallback),
      set: (key, value) => StorageService.settings.set(key, value),
    }, cache);
  }
  const controller = controllerRef.current;
  const [state, setState] = useState(controller.getSnapshot);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    setState(controller.getSnapshot());
    void controller.load();
    return unsubscribe;
  }, [controller]);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.motionPreset = state.preset;
    Object.entries(getMotionCssVariables(state.preset, reducedMotion)).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [state.preset, reducedMotion]);
  return { ...state, setPreset: controller.setPreset, reducedMotion };
}
