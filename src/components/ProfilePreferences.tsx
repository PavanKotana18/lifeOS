import { useMemo, useState } from 'react';
import { CURRENCY_CODES, type UserPreferences } from '../services/userPreferences';
import { formatCurrencyChoice } from '../services/financeCore';

type Props = {
  preferences: UserPreferences;
  hasFinancialRecords: boolean;
  onChange: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
};

const selectClass = 'lifeos-input mt-1.5 min-h-11 w-full rounded-xl px-3 py-3 text-sm';

export default function ProfilePreferences({ preferences, hasFinancialRecords, onChange }: Props) {
  const [currencySearch, setCurrencySearch] = useState('');
  const currencyLabels = useMemo(() => new Map(CURRENCY_CODES.map(code => [code, formatCurrencyChoice(code, preferences.locale === 'system' ? undefined : preferences.locale)])), [preferences.locale]);
  const currencyOptions = useMemo(() => {
    const query = currencySearch.trim().toLocaleLowerCase(preferences.locale === 'system' ? undefined : preferences.locale);
    const matched = CURRENCY_CODES.filter(code => code.toLocaleLowerCase().includes(query) || currencyLabels.get(code)?.toLocaleLowerCase().includes(query));
    return matched.includes(preferences.currency) ? matched : [preferences.currency, ...matched];
  }, [currencySearch, currencyLabels, preferences.currency, preferences.locale]);
  return <div className="space-y-4" data-testid="profile-preferences">
    <section className="lifeos-panel rounded-2xl border p-5 space-y-4">
      <div><h2 className="text-base font-semibold">Preferences</h2><p className="mt-1 text-sm text-secondary">Display choices change how new entries and saved values are shown.</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm text-secondary">Currency for financial records
          <input aria-label="Search currencies" type="search" autoComplete="off" value={currencySearch} onChange={event => setCurrencySearch(event.target.value)} placeholder="Search by name, code or symbol" className={selectClass + ' mb-1'} />
          <select aria-label="Currency for financial records" disabled={hasFinancialRecords} value={preferences.currency} onChange={event => onChange('currency', event.target.value)} className={`${selectClass} disabled:opacity-70`}>
            {currencyOptions.map(code => <option key={code} value={code}>{currencyLabels.get(code)}</option>)}
          </select>
          {hasFinancialRecords && <span className="mt-1 block text-xs leading-5 text-muted">Locked because saved financial records do not yet store their own currency. Changing it could misstate past values.</span>}
        </label>
        <label className="text-sm text-secondary">Distance
          <select aria-label="Distance units" value={preferences.distance} onChange={event => onChange('distance', event.target.value as UserPreferences['distance'])} className={selectClass}><option value="km">Kilometres · km</option><option value="mi">Miles · mi</option></select>
        </label>
        <label className="text-sm text-secondary">Speed
          <select aria-label="Speed units" value={preferences.speed} onChange={event => onChange('speed', event.target.value as UserPreferences['speed'])} className={selectClass}><option value="km/h">Kilometres/hour</option><option value="m/s">Metres/second</option><option value="mph">Miles/hour</option></select>
        </label>
        <label className="text-sm text-secondary">Volume
          <select aria-label="Volume units" value={preferences.volume} onChange={event => onChange('volume', event.target.value as UserPreferences['volume'])} className={selectClass}><option value="L">Litres · L</option><option value="mL">Millilitres · mL</option><option value="US gal">US gallons</option><option value="Imp gal">Imperial gallons</option></select>
        </label>
        <label className="text-sm text-secondary">Date format
          <select aria-label="Date format" value={preferences.dateFormat} onChange={event => onChange('dateFormat', event.target.value as UserPreferences['dateFormat'])} className={selectClass}><option value="DMY">DD/MM/YYYY</option><option value="MDY">MM/DD/YYYY</option><option value="YMD">YYYY-MM-DD</option></select>
        </label>
        <label className="text-sm text-secondary">Week starts
          <select aria-label="First day of week" value={preferences.firstDayOfWeek} onChange={event => onChange('firstDayOfWeek', event.target.value as UserPreferences['firstDayOfWeek'])} className={selectClass}><option value="monday">Monday</option><option value="sunday">Sunday</option></select>
        </label>
        <label className="text-sm text-secondary">Time format
          <select aria-label="Time format" value={preferences.timeFormat} onChange={event => onChange('timeFormat', event.target.value as UserPreferences['timeFormat'])} className={selectClass}><option value="12h">12-hour</option><option value="24h">24-hour</option></select>
        </label>
        <label className="text-sm text-secondary">Number locale
          <select aria-label="Number locale" value={preferences.locale} onChange={event => onChange('locale', event.target.value as UserPreferences['locale'])} className={selectClass}><option value="system">Follow device</option><option value="en-IN">English · India</option><option value="en-US">English · US</option><option value="en-GB">English · UK</option><option value="de-DE">German · Germany</option></select>
        </label>
      </div>
      <p className="text-xs leading-5 text-muted">Changing the selected currency never performs an exchange. Unit preferences affect display; canonical stored goal measurements remain unchanged.</p>
    </section>
    <section className="lifeos-panel rounded-2xl border p-5 space-y-3" aria-label="Navigation preferences">
      <div><h2 className="text-base font-semibold">Navigation</h2><p className="mt-1 text-sm text-secondary">Swipe across Today, Money, Plan and Life. Buttons, charts and the Android back edge keep their own gestures.</p></div>
      <div className="lifeos-raised flex min-h-14 items-center justify-between gap-3 rounded-xl px-3"><span className="text-sm font-medium">Swipe between tabs</span><button type="button" role="switch" aria-checked={preferences.swipeNavigationEnabled} onClick={() => onChange('swipeNavigationEnabled', !preferences.swipeNavigationEnabled)} className={`min-h-11 min-w-16 rounded-full px-3 text-xs font-semibold ${preferences.swipeNavigationEnabled ? 'lifeos-accent-button' : 'lifeos-panel border text-secondary'}`}>{preferences.swipeNavigationEnabled ? 'On' : 'Off'}</button></div>
    </section>
  </div>;
}
