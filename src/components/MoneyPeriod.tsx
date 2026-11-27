import { useId, useRef, useState } from 'react';

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' });
const periodFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthLabels = Array.from({ length: 12 }, (_, index) => monthFormatter.format(new Date(Date.UTC(2024, index, 1))));

export default function MoneyPeriod({ label, month, onChange }: {
  label: string; month: string; onChange: (month: string) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = periodPattern.test(month) && !month.startsWith('0000') ? new Date(month + '-01T12:00:00Z') : new Date();
  const [year, setYear] = useState(String(current.getUTCFullYear()));
  const yearNumber = Number(year);
  const validYear = /^\d{1,4}$/.test(year) && yearNumber >= 1 && yearNumber <= 9999;
  const name = periodFormatter.format(current);
  return <>
    <button ref={trigger} type="button" className="money-period-control money-period-unified" aria-label={label + ' period, ' + name}
      aria-haspopup="dialog" aria-controls={id} onClick={() => {
        setYear(String(current.getUTCFullYear()));
        dialog.current?.showModal();
        dialog.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
      }}><span className="money-period-value">{name}</span></button>
    <dialog ref={dialog} id={id} className="lifeos-info-dialog money-period-dialog" data-money-period aria-labelledby={id + '-title'}
      onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <section className="lifeos-info-dialog-content">
        <header className="flex items-center justify-between gap-2"><h2 id={id + '-title'} className="type-section-title">Reporting period</h2><button type="button" className="feather-secondary" onClick={() => dialog.current?.close()}>Close</button></header>
        <div className="period-year">
          <button type="button" className="feather-back-text" aria-label="Previous year" disabled={!validYear || yearNumber <= 1} onClick={() => setYear(String(yearNumber - 1))}>Previous</button>
          <label className="period-year-field">Year<input type="number" className="lifeos-input" min="1" max="9999" step="1" inputMode="numeric" value={year} onChange={event => setYear(event.target.value)} /></label>
          <button type="button" className="feather-back-text" aria-label="Next year" disabled={!validYear || yearNumber >= 9999} onClick={() => setYear(String(yearNumber + 1))}>Next</button>
        </div>
        <div className="period-months" role="group" aria-label="Months">
          {monthLabels.map((monthLabel, index) => <button key={monthLabel} type="button" className="feather-secondary"
            disabled={!validYear} aria-pressed={current.getUTCFullYear() === yearNumber && current.getUTCMonth() === index} onClick={() => {
              if (!validYear) return;
              onChange(String(yearNumber).padStart(4, '0') + '-' + String(index + 1).padStart(2, '0'));
              dialog.current?.close();
            }}>{monthLabel}</button>)}
        </div>
      </section>
    </dialog>
  </>;
}
