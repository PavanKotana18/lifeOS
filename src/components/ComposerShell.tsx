import * as m from 'motion/react-m';
import { useIsPresent } from 'motion/react';
import type { FormEventHandler, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FeatherHeader } from './FeatherHeader';

type Props = {
  id: string;
  title: string;
  accessibleName?: string;
  submitLabel: string;
  mode: 'page' | 'sheet';
  saving: boolean;
  reduced: boolean;
  dismiss: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChange?: FormEventHandler<HTMLFormElement>;
  portal?: boolean;
  children: ReactNode;
};

export default function ComposerShell({ id, title, accessibleName, submitLabel, mode, saving, reduced, dismiss, onSubmit, onChange, portal, children }: Props) {
  const present = useIsPresent();
  const page = mode === 'page';
  const titleId = id + '-title';
  const outside = page ? 'translate3d(100%,0,0)' : 'translate3d(0,24px,0)';
  const rest = 'translate3d(0,0,0)';
  const layer = <div className="ui-sheet-backdrop record-composer-backdrop feather-composer-layer" data-mode={mode}
    data-exiting={!present} aria-hidden={!present || undefined}
    ref={element => element?.toggleAttribute('inert', !present)}
    onMouseDown={event => { if (!saving && event.target === event.currentTarget) dismiss(); }}>
    <m.form id={id} role="dialog" aria-modal="true" aria-label={accessibleName} aria-labelledby={accessibleName ? undefined : titleId} aria-busy={saving}
      className="feather-composer lifeos-page" data-mode={mode}
      initial={reduced ? false : { transform: outside, opacity: page ? 1 : 0 }}
      animate={{ transform: rest, opacity: 1 }}
      exit={reduced ? undefined : { transform: outside, opacity: page ? 1 : 0, transition: { duration: .24, ease: [.32, 0, .67, 1] } }}
      transition={reduced ? { duration: 0 } : { duration: .32, ease: [.22, .7, .22, 1] }}
      onSubmit={onSubmit} onChange={event => {
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
        requestAnimationFrame(() => { if (field.isConnected) field.focus(); });
      }}>
      <FeatherHeader title={title} id={titleId} back={{ label: 'Close', onClick: dismiss, disabled: saving }} />
      <div className="feather-composer-content">
        <p data-record-validation role="alert" className="record-validation text-sm text-[var(--danger)]" />
        {children}
      </div>
      <div className="ui-form-actions feather-composer-actions">
        <button type="button" disabled={saving} onClick={dismiss} className="feather-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="feather-primary">{saving ? 'Saving…' : submitLabel}</button>
      </div>
    </m.form>
  </div>;
  const host = portal && typeof document !== 'undefined' ? document.querySelector('.app-shell') : null;
  return host ? createPortal(layer, host) : layer;
}
