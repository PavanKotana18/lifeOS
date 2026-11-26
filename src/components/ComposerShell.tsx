import * as m from 'motion/react-m';
import { domAnimation, LazyMotion, useIsPresent } from 'motion/react';
import { useRef, type FormEventHandler, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FeatherHeader } from './FeatherHeader';
import { ChoiceCommitContext } from './PreferenceChoice';

type Props = {
  id: string;
  title: string;
  accessibleName?: string;
  descriptionId?: string;
  submitLabel: string;
  mode: 'page' | 'sheet';
  saving: boolean;
  reduced: boolean;
  dismiss: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChange?: FormEventHandler<HTMLFormElement>;
  portal?: boolean;
  footerDismissOnly?: boolean;
  onChoiceChange?: () => void;
  children: ReactNode;
};

export default function ComposerShell({ id, title, accessibleName, descriptionId, submitLabel, mode, saving, reduced, dismiss, onSubmit, onChange, onChoiceChange, portal, footerDismissOnly, children }: Props) {
  const pressed = useRef<{ button: HTMLButtonElement; pointerId: number } | null>(null);
  const releasePress = (event: PointerEvent<HTMLFormElement>) => {
    if (pressed.current?.pointerId !== event.pointerId) return;
    pressed.current.button.removeAttribute('data-composer-pressed');
    pressed.current = null;
  };
  const present = useIsPresent();
  const page = mode === 'page';
  const titleId = id + '-title';
  const outside = page ? 'translate3d(100%,0,0)' : 'translate3d(0,24px,0)';
  const rest = 'translate3d(0,0,0)';
  const layer = <LazyMotion features={domAnimation}><div className="ui-sheet-backdrop record-composer-backdrop feather-composer-layer" data-mode={mode}
    data-exiting={!present} aria-hidden={!present || undefined}
    ref={element => element?.toggleAttribute('inert', !present)}
    onMouseDown={event => { if (!saving && event.target === event.currentTarget) dismiss(); }}>
    <m.form id={present ? id : undefined} role="dialog" aria-modal="true" aria-label={accessibleName} aria-labelledby={accessibleName ? undefined : titleId} aria-busy={saving} aria-describedby={descriptionId}
      className="feather-composer lifeos-page" data-mode={mode} data-composer-focus={page || undefined} tabIndex={-1}
      initial={reduced ? false : { transform: outside, opacity: page ? 1 : 0 }}
      animate={{ transform: rest, opacity: 1 }}
      exit={reduced ? undefined : { transform: outside, opacity: page ? 1 : 0, transition: { duration: .24, ease: [.32, 0, .67, 1] } }}
      transition={reduced ? { duration: 0 } : { duration: .32, ease: [.22, .7, .22, 1] }}
      onPointerDownCapture={event => {
        if (!event.isPrimary || event.pointerType === 'mouse' || !(event.target instanceof Element)) return;
        const button = event.target.closest<HTMLButtonElement>('button:not(:disabled)');
        if (!button || !event.currentTarget.contains(button)) return;
        pressed.current?.button.removeAttribute('data-composer-pressed');
        button.setAttribute('data-composer-pressed', '');
        pressed.current = { button, pointerId: event.pointerId };
      }}
      onPointerUpCapture={releasePress} onPointerCancelCapture={releasePress} onLostPointerCapture={releasePress}
      onSubmit={event => {
        if (!present || saving) { event.preventDefault(); return; }
        onSubmit(event);
      }}
      onChange={event => {
        const form = event.currentTarget;
        if (!form.querySelector(':invalid')) {
          const error = form.querySelector<HTMLElement>('[data-record-validation]');
          if (error) error.textContent = '';
        }
        onChange?.(event);
      }}
      onInvalid={event => {
        event.preventDefault();
        const field = event.target as HTMLInputElement;
        if (event.currentTarget.querySelector(':is(input,select,textarea):invalid') !== field) return;
        const error = event.currentTarget.querySelector<HTMLElement>('[data-record-validation]');
        if (error) error.textContent = field.validity.valueMissing ? 'Complete the highlighted field.' : 'Check the highlighted value.';
        if (!field.hasAttribute('data-choice-validation')) requestAnimationFrame(() => { if (field.isConnected) field.focus(); });
      }}>
      <FeatherHeader title={title} id={present ? titleId : undefined} back={footerDismissOnly ? undefined : { label: 'Close', onClick: dismiss, disabled: saving }} />
      <div className="feather-composer-content">
        <p data-record-validation role="alert" className="record-validation text-sm text-[var(--danger)]" />
        <ChoiceCommitContext.Provider value={onChoiceChange}>{children}</ChoiceCommitContext.Provider>
      </div>
      <div className="ui-form-actions feather-composer-actions">
        <button type="button" disabled={saving} onClick={dismiss} className="feather-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="feather-primary">{saving ? 'Saving…' : submitLabel}</button>
      </div>
    </m.form>
  </div></LazyMotion>;
  const host = portal && typeof document !== 'undefined' ? document.querySelector('.app-shell') : null;
  return host ? createPortal(layer, host) : layer;
}
