import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { animateRoute, readRoutePose } from '../services/aliveMotion';
import { normalizeMotionPreset } from '../services/interfaceMotion';

export default function AliveDetailDialog({ title, eyebrow, onClose, children }: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const animation = useRef<ReturnType<typeof animateRoute> | null>(null);
  const closing = useRef(false);
  const preset = () => normalizeMotionPreset(document.documentElement.dataset.motionPreset);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    if (!reduced()) {
      const opening = animateRoute(dialog, { x: dialog.clientWidth, opacity: 1 }, { x: 0, opacity: 1 }, preset());
      animation.current = opening;
      void opening.then(() => {
        if (animation.current === opening) {
          animation.current = null;
          opening.cancel();
        }
      });
    }
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stopForReduced = () => {
      if (!preference.matches) return;
      animation.current?.cancel();
      animation.current = null;
      if (closing.current && dialog.open) dialog.close();
    };
    preference.addEventListener?.('change', stopForReduced);
    return () => {
      preference.removeEventListener?.('change', stopForReduced);
      animation.current?.cancel();
      animation.current = null;
    };
  }, []);

  const returnToList = () => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closing.current) return;
    if (reduced()) { dialog.close(); return; }
    closing.current = true;
    const pose = readRoutePose(dialog);
    animation.current?.cancel();
    dialog.dataset.exiting = 'true';
    const exit = animateRoute(dialog, pose, { x: dialog.clientWidth, opacity: 1 }, preset());
    animation.current = exit;
    const finish = () => {
      if (animation.current === exit && dialog.open) dialog.close();
    };
    void exit.then(finish, finish);
  };

  return <dialog ref={dialogRef} aria-labelledby="scheduled-detail-title" className="alive-detail-dialog lifeos-page"
    data-scheduled-details onClose={onClose} onCancel={event => { event.preventDefault(); returnToList(); }}>
    <header className="alive-detail-header">
      <button type="button" onClick={returnToList} data-motion-back aria-label="Back to Scheduled" className="profile-page-back lifeos-raised">
        <ChevronLeft size={23} aria-hidden="true" />
      </button>
      <div><p className="text-xs text-secondary">{eyebrow}</p><h2 className="type-page-title" id="scheduled-detail-title">{title}</h2></div>
    </header>
    {children}
  </dialog>;
}
