import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type ChoiceOption = readonly [value: string, label: string, disabled?: boolean];
export const ChoiceCommitContext = createContext<(() => void) | undefined>(undefined);

type Props = {
  label: string;
  value: string;
  options: readonly ChoiceOption[];
  onSelect: (value: string) => void;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  icon?: ReactNode;
  disabledHint?: string;
  variant?: 'row' | 'field' | 'quick';
};

export function PreferenceChoice({ label, value, options, onSelect, searchable = options.length > 9,
  disabled = false, required = false, icon, disabledHint, variant = 'row' }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const notify = useContext(ChoiceCommitContext);
  const id = useId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [focusKey, setFocusKey] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const query = search.trim().toLocaleLowerCase();
  const choices = query ? options.filter(([key, name]) => (key + ' ' + name).toLocaleLowerCase().includes(query)) : options;
  const focusable = choices.find(([key, , unavailable]) => key === focusKey && !unavailable)?.[0] ?? choices.find(([, , unavailable]) => !unavailable)?.[0];
  const matched = options.find(([key]) => key === value);
  const selected = matched?.[1] ?? (value || 'Choose an option');
  const missing = required && (!value || !matched || matched[2]);
  const showError = invalid && missing;
  const close = () => dialog.current?.close();
  useLayoutEffect(() => {
    if (open) list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  return <div className={variant === 'field' ? 'choice-field' : 'choice-row'} data-choice-field={variant} data-choice-value={value}>
    {variant === 'field' && <span className="choice-field-label">{label}</span>}
    <button ref={trigger} type="button" className={icon ? 'task-option' : variant === 'field' ? 'choice-trigger' : 'preference-row'}
      aria-label={variant !== 'row' ? label : undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      aria-invalid={showError || undefined} aria-describedby={variant !== 'row' ? id + '-value' + (showError ? ' ' + id + '-error' : '') : showError ? id + '-error' : undefined} disabled={disabled}
      onClick={() => { setSearch(''); setFocusKey(value); setOpen(true); dialog.current?.showModal(); }}>
      {icon}{icon ? <span><strong>{label}</strong><small id={id + '-value'}>{disabled && disabledHint ? disabledHint : selected}</small></span> : <>
        {variant === 'row' && <span>{label}</span>}
        <span id={id + '-value'} className="choice-current">{disabled && disabledHint ? disabledHint : selected}</span>
        {variant === 'field' && <ChevronDown size={16} aria-hidden="true" />}
      </>}
    </button>
    {required && !disabled && <input className="choice-validation" data-choice-validation required tabIndex={-1}
      aria-hidden="true" value={missing ? '' : value} onChange={() => {}}
      onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); }} />}
    {showError && <p id={id + '-error'} className="text-xs text-[var(--danger)]" role="alert">Choose an option for {label.toLocaleLowerCase()}.</p>}
    {disabled && !disabledHint && variant === 'row' && <p className="pb-2 text-xs text-secondary">Currency is locked for existing financial records.</p>}
    <dialog ref={dialog} id={id} className="preference-sheet choice-sheet lifeos-page" data-preference-choice aria-label={label}
      onClose={() => { setOpen(false); if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="choice-sheet-layout">
        <header className="flex items-center justify-between gap-3"><h2 className="type-section-title">{label}</h2>
          <button type="button" className="feather-secondary" onClick={close}>Close</button>
        </header>
        {open && searchable && <input aria-label={label === 'Currency' ? 'Search currencies' : 'Search ' + label.toLocaleLowerCase()}
          className="lifeos-input min-h-11 w-full rounded-xl px-3" type="search" autoComplete="off" aria-controls={id + "-options"}
          placeholder={label === 'Currency' ? 'Search by name or code' : 'Search options'} value={search} onChange={event => { event.stopPropagation(); setSearch(event.target.value); }}
          onKeyDown={event => {
            if (event.key === 'Enter') event.preventDefault();
            if (event.key === 'ArrowDown') { event.preventDefault(); list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }
          }} />}
        <div ref={list} id={id + "-options"} className="preference-options choice-options" role="listbox" aria-label={label}
          onKeyDown={event => {
            if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
            const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
              Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
            event.preventDefault();
            buttons[target]?.focus();
          }}>
          {open && choices.map(([key, name, unavailable]) => <button key={key} type="button" className="preference-row choice-option"
            data-option-value={key} role="option" disabled={unavailable} aria-disabled={unavailable || undefined} aria-selected={key === value}
            tabIndex={key === focusable ? 0 : -1} onFocus={() => setFocusKey(key)}
            onClick={() => { if (key !== value) { notify?.(); onSelect(key); } setInvalid(false); close(); }}>
            <span>{name}</span>{key === value && <Check size={17} aria-hidden="true" />}
          </button>)}
        </div>
        {open && !choices.length && <p role="status" className="py-4 text-sm text-secondary">No matching options.</p>}
      </section>
    </dialog>
  </div>;
}
