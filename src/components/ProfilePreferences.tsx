import { useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { CURRENCY_CODES, type UserPreferences } from '../services/userPreferences';
import { formatCurrencyChoice } from '../services/financeCore';

type Props = {
  preferences: UserPreferences;
  dateOnlyAlertTime?: string;
  onDateOnlyAlertTime?: (time: string) => void;
  hasFinancialRecords: boolean;
  onChange: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
};

type Option = readonly [value: string, name: string];

export function PreferenceChoice({ label, value, options, onSelect, searchable = false, disabled = false }: {
  label: string; value: string; options: readonly Option[]; onSelect: (value: string) => void; searchable?: boolean; disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  const choices = searchable ? options.filter(([key, name]) => (key + ' ' + name).toLocaleLowerCase().includes(query)) : options;
  const selected = options.find(([key]) => key === value)?.[1] || value;
  return <>
    <button type="button" className="preference-row" aria-haspopup="dialog" disabled={disabled} onClick={() => { setSearch(''); dialog.current?.showModal(); }}>
      <span>{label}</span><span className="text-secondary text-right">{selected}</span>
    </button>
    {disabled && <p className="pb-2 text-xs text-secondary">Currency is locked for existing financial records.</p>}
    <dialog ref={dialog} className="preference-sheet lifeos-page" data-preference-choice aria-label={label} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <section className="space-y-2">
        <header className="flex items-center justify-between gap-3"><h2 className="type-section-title">{label}</h2><button type="button" className="min-h-11 px-2 text-sm" onClick={() => dialog.current?.close()}>Close</button></header>
        {searchable && <input aria-label="Search currencies" className="lifeos-input min-h-11 w-full rounded-xl px-3" type="search" autoComplete="off" placeholder="Search by name or code" value={search} onChange={event => setSearch(event.target.value)} />}
        <div className="preference-options" role="group" aria-label={label}>
          {choices.map(([key, name]) => <button key={key} type="button" className="preference-row" aria-pressed={key === value} onClick={() => { if (key !== value) onSelect(key); dialog.current?.close(); }}>
            <span>{name}</span>{key === value && <Check size={16} aria-hidden="true" />}
          </button>)}
          {!choices.length && <p role="status" className="py-3 text-sm text-secondary">No matching options.</p>}
        </div>
      </section>
    </dialog>
  </>;
}

export default function ProfilePreferences({ preferences, hasFinancialRecords, onChange, dateOnlyAlertTime, onDateOnlyAlertTime }: Props) {
  const locale = preferences.locale === 'system' ? undefined : preferences.locale;
  const currencyOptions = useMemo(() => CURRENCY_CODES.map(code => [code, formatCurrencyChoice(code, locale)] as const), [locale]);
  const choice = <K extends keyof UserPreferences>(key: K, label: string, options: readonly Option[]) => <PreferenceChoice
    label={label} value={String(preferences[key])} options={options} onSelect={value => onChange(key, value as UserPreferences[K])} />;
  return <div className="profile-preferences space-y-4" data-testid="profile-preferences">
    <section className="preference-group" aria-label="Currency and locale">
      <PreferenceChoice label="Currency" searchable disabled={hasFinancialRecords} value={preferences.currency}
        options={currencyOptions} onSelect={code => onChange('currency', code)} />
      {choice('locale', 'Number locale', [['system', 'Automatic'], ['en-IN', 'English (India)'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['de-DE', 'German (Germany)']])}
    </section>
    <section className="preference-group" aria-label="Date and time">
      {choice('dateFormat', 'Date format', [['DMY', 'DD/MM/YYYY'], ['MDY', 'MM/DD/YYYY'], ['YMD', 'YYYY-MM-DD']])}
      {choice('firstDayOfWeek', 'First day of week', [['monday', 'Monday'], ['sunday', 'Sunday']])}
      {choice('timeFormat', 'Time format', [['12h', '12-hour'], ['24h', '24-hour']])}
      {onDateOnlyAlertTime && <div className="preference-row"><label htmlFor="date-only-alert-time">Date-only task alerts</label>
        <div className="flex flex-wrap justify-end gap-2">{!dateOnlyAlertTime && <span className="self-center text-secondary">Off</span>}<input className="lifeos-input min-h-11 rounded-lg px-2" id="date-only-alert-time" type="time" value={dateOnlyAlertTime || ''} onChange={event => onDateOnlyAlertTime(event.target.value)} /></div></div>}
      {dateOnlyAlertTime && onDateOnlyAlertTime && <button type="button" className="min-h-11 text-sm lifeos-accent-text" onClick={() => onDateOnlyAlertTime('')}>Turn off date-only alerts</button>}
    </section>
    <section className="preference-group" aria-label="Measurement units">
      {choice('distance', 'Distance', [['km', 'Kilometres'], ['mi', 'Miles']])}
      {choice('speed', 'Speed', [['km/h', 'Kilometres/hour'], ['m/s', 'Metres/second'], ['mph', 'Miles/hour']])}
      {choice('volume', 'Volume', [['L', 'Litres'], ['mL', 'Millilitres'], ['US gal', 'US gallons'], ['Imp gal', 'Imperial gallons']])}
    </section>
    <section className="preference-group" aria-label="Navigation preferences">
      <button type="button" className="preference-row" role="switch" aria-checked={preferences.swipeNavigationEnabled} aria-label="Swipe between tabs" onClick={() => onChange('swipeNavigationEnabled', !preferences.swipeNavigationEnabled)}>
        <span>Swipe between tabs</span><span className="preference-toggle" aria-hidden="true" />
      </button>
    </section>
  </div>;
}
