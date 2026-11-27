import { useMemo } from 'react';
import { PreferenceChoice, type ChoiceOption } from './PreferenceChoice';
import { ProfileGroup, ProfileToggle } from './ProfileSettings';
import { CURRENCY_CODES, formatCurrency, formatDatePreference, formatTimePreference, type UserPreferences } from '../services/userPreferences';
import { formatCurrencyChoice } from '../services/financeCore';

export { PreferenceChoice } from './PreferenceChoice';

export default function ProfilePreferences({ preferences, hasFinancialRecords, onChange, saving = false }: {
  preferences: UserPreferences; saving?: boolean; hasFinancialRecords: boolean;
  onChange: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}) {
  const locale = preferences.locale === 'system' ? undefined : preferences.locale;
  const currencyOptions = useMemo(() => CURRENCY_CODES.map(code => [code, formatCurrencyChoice(code, locale)] as const), [locale]);
  const exampleDate = new Date(2026, 10, 27, 16, 30);
  const choice = <K extends keyof UserPreferences>(key: K, label: string, options: readonly ChoiceOption[]) => <PreferenceChoice profile
    label={label} disabled={saving} value={String(preferences[key])} options={options} onSelect={value => onChange(key, value as UserPreferences[K])} />;
  return <div className="profile-stack" data-testid="profile-preferences" aria-busy={saving}>
    <ProfileGroup title="Region and money" topic="Currency restrictions" description={'Example amount: ' + formatCurrency(1234.5, preferences.currency, preferences.locale)}>
      <PreferenceChoice profile label="Currency" searchable disabled={hasFinancialRecords || saving}
        disabledHint={hasFinancialRecords ? 'Locked while financial records exist. Existing amounts keep their recorded currency.' : undefined}
        value={preferences.currency} options={currencyOptions} onSelect={code => onChange('currency', code)} />
      {choice('locale', 'Number locale', [['system', 'Automatic'], ['en-IN', 'English (India)'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['de-DE', 'German (Germany)']])}
    </ProfileGroup>
    <ProfileGroup title="Date and time" description={formatDatePreference(exampleDate, preferences.dateFormat) + ' · ' + formatTimePreference(exampleDate, preferences.timeFormat, preferences.locale)}>
      {choice('dateFormat', 'Date format', [['DMY', 'DD/MM/YYYY'], ['MDY', 'MM/DD/YYYY'], ['YMD', 'YYYY-MM-DD']])}
      {choice('firstDayOfWeek', 'First day of week', [['monday', 'Monday'], ['sunday', 'Sunday']])}
      {choice('timeFormat', 'Time format', [['12h', '12-hour'], ['24h', '24-hour']])}
    </ProfileGroup>
    <ProfileGroup title="Measurement units" topic="Measurement preferences">
      {choice('distance', 'Distance', [['km', 'Kilometres'], ['mi', 'Miles']])}
      {choice('speed', 'Speed', [['km/h', 'Kilometres per hour'], ['m/s', 'Metres per second'], ['mph', 'Miles per hour']])}
      {choice('volume', 'Volume', [['L', 'Litres'], ['mL', 'Millilitres'], ['US gal', 'US gallons'], ['Imp gal', 'Imperial gallons']])}
    </ProfileGroup>
    <ProfileGroup title="Navigation">
      <ProfileToggle title="Swipe between tabs" checked={preferences.swipeNavigationEnabled} disabled={saving}
        detail="Move between Today, Money, Plan and Profile with a horizontal swipe."
        onChange={() => onChange('swipeNavigationEnabled', !preferences.swipeNavigationEnabled)} />
    </ProfileGroup>
    {saving && <p role="status" className="profile-description">Saving preferences…</p>}
  </div>;
}
