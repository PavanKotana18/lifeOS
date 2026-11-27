import { useEffect, useId, useState } from 'react';
import { Check } from 'lucide-react';
import { buildCustomAccentOverrides, normalizeCustomAccent } from '../services/customAccent';
import { DEFAULT_THEME_ID, getThemeTokens, type AppearanceMode, type ThemeId } from '../services/themeCatalog';
import { InterfacePreview } from './ProfileInterfacePreview';
import { ProfileButton, ProfileGroup } from './ProfileSettings';

const accentOptions: ReadonlyArray<{ name: string; theme: ThemeId }> = [
  { name: 'Sage', theme: 'soft-ivory-sage' }, { name: 'Ocean', theme: 'ocean-mist' },
  { name: 'Sand', theme: 'warm-sand' }, { name: 'Lavender', theme: 'lavender-haze' },
  { name: 'Slate', theme: 'midnight-slate' }, { name: 'Clay', theme: 'rose-clay' },
];

export function accentSelectionLabel(value?: string) {
  if (!value) return 'Palette accent';
  return accentOptions.find(option => getThemeTokens(option.theme, 'light').accent.toUpperCase() === value.toUpperCase())?.name ?? 'Custom';
}

export default function CustomAccentPicker({ value, onChange, themeId = DEFAULT_THEME_ID, mode = 'light' }: {
  value?: string; onChange: (color: string | undefined) => Promise<void>; themeId?: string; mode?: AppearanceMode;
}) {
  const id = useId();
  const tokens = getThemeTokens(themeId, mode);
  const catalogColor = tokens.accent.toUpperCase();
  const [draft, setDraft] = useState(value || catalogColor);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(value || catalogColor); }, [value, catalogColor]);
  const normalized = normalizeCustomAccent(draft);
  const overrides = buildCustomAccentOverrides(normalized || normalizeCustomAccent(value), themeId, mode);
  const adjusted = normalized && overrides['--accent'] !== normalized;
  const save = async (color: string | undefined) => {
    setSaving(true);
    try { await onChange(color); } finally { setSaving(false); }
  };

  return <>
    <ProfileGroup title="Live accent preview" variant="feature" topic="Accent contrast"
      description={normalized && normalized !== (value || catalogColor) ? 'Previewing ' + normalized : accentSelectionLabel(value)}>
      <InterfacePreview tokens={tokens} accent={normalized === catalogColor && !value ? undefined : overrides} />
      {adjusted && <p className="profile-description">Readable shade in this mode: {overrides['--accent']}.</p>}
    </ProfileGroup>
    <ProfileGroup title="Accent gallery" description="Choose a color to preview it." variant="plain">
      <div className="profile-swatch-grid">
        {accentOptions.map(option => {
          const raw = getThemeTokens(option.theme, 'light').accent.toUpperCase();
          const sample = buildCustomAccentOverrides(raw, themeId, mode);
          return <button type="button" key={option.theme} className="profile-swatch" aria-label={option.name} aria-pressed={normalized === raw}
            disabled={saving} onClick={() => setDraft(raw)}>
            <span aria-hidden="true" style={{ background: sample['--accent'], color: sample['--accent-foreground'] }}>
              {normalized === raw ? <Check size={22} /> : 'Aa'}
            </span><strong>{option.name}</strong>
          </button>;
        })}
      </div>
    </ProfileGroup>
    <ProfileGroup title="Custom color" variant="plain">
      <form className="profile-sheet-fields" onSubmit={event => { event.preventDefault(); if (normalized && !saving) void save(normalized); }}>
        <div className="profile-accent-inputs">
          <label className="profile-field">Picker<input type="color" aria-label="Pick accent color"
            value={normalized || catalogColor} onChange={event => setDraft(event.target.value)} disabled={saving} /></label>
          <label className="profile-field" htmlFor={id}>Hex color<input id={id} type="text" value={draft} maxLength={7}
            spellCheck={false} autoCapitalize="characters" onChange={event => setDraft(event.target.value)} disabled={saving}
            aria-invalid={!normalized} aria-describedby={!normalized ? id + '-error' : undefined} placeholder="#416B51" /></label>
        </div>
        {!normalized && <p id={id + '-error'} role="alert" className="profile-error">Enter # followed by six hex digits, for example #416B51.</p>}
        <div className="profile-actions">
          <ProfileButton tone="primary" type="submit" disabled={saving || !normalized || normalized === (value || catalogColor)}>{saving ? 'Saving…' : 'Apply accent'}</ProfileButton>
          <ProfileButton disabled={saving || (!value && normalized === catalogColor)} onClick={() => {
            setDraft(catalogColor); if (value) void save(undefined);
          }}>Use palette accent</ProfileButton>
        </div>
      </form>
    </ProfileGroup>
  </>;
}
