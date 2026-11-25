import { useEffect, useId, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { buildCustomAccentOverrides, normalizeCustomAccent } from '../services/customAccent';
import { DEFAULT_THEME_ID, getThemeTokens, type AppearanceMode, type ThemeId } from '../services/themeCatalog';

type Props = {
  value?: string;
  onChange: (color: string | undefined) => void;
  themeId?: string;
  mode?: AppearanceMode;
};

const accentOptions: ReadonlyArray<{ name: string; theme: ThemeId }> = [
  { name: 'Sage', theme: 'soft-ivory-sage' }, { name: 'Ocean', theme: 'ocean-mist' },
  { name: 'Sand', theme: 'warm-sand' }, { name: 'Lavender', theme: 'lavender-haze' },
  { name: 'Slate', theme: 'midnight-slate' }, { name: 'Clay', theme: 'rose-clay' },
];

export function accentSelectionLabel(value?: string) {
  if (!value) return 'Palette accent';
  return accentOptions.find(option => getThemeTokens(option.theme, 'light').accent === value)?.name || 'Custom';
}

export default function CustomAccentPicker({ value, onChange, themeId = DEFAULT_THEME_ID, mode = 'light' }: Props) {
  const id = useId();
  const tokens = getThemeTokens(themeId, mode);
  const catalogColor = tokens.accent;
  const [draft, setDraft] = useState(value || catalogColor);
  useEffect(() => { setDraft(value || catalogColor); }, [value, catalogColor]);
  const normalized = normalizeCustomAccent(draft);
  const overrides = normalized ? buildCustomAccentOverrides(normalized, themeId, mode) : null;
  const adjusted = normalized && overrides?.['--accent'] !== normalized;

  const activeOverrides = value || normalized !== catalogColor ? overrides : null;
  const color = activeOverrides?.['--accent'] ?? tokens.accent;
  const foreground = activeOverrides?.['--accent-foreground'] ?? tokens.accentForeground;
  const tint = activeOverrides?.['--accent-tint'] ?? tokens.accentTint;

  return <div className="appearance-studio">
    <div className="accent-studio-preview" aria-hidden="true" style={{ backgroundColor: tint, color }}>
      <span className="accent-studio-preview-icon" style={{ color: foreground, backgroundColor: color }}><Sparkles size={19} /></span>
      <span className="accent-studio-preview-content"><strong>{accentSelectionLabel(value)}</strong><span className="accent-studio-meter"><span style={{ backgroundColor: color }} /></span></span>
      <span className="accent-studio-preview-icon" style={{ color: foreground, backgroundColor: color }}><Check size={18} /></span>
    </div>
    <section aria-labelledby={`${id}-gallery`}>
      <h2 className="appearance-section-title" id={`${id}-gallery`}>Accent gallery</h2>
      <div className="accent-studio-gallery" role="group" aria-labelledby={`${id}-gallery`}>
        {accentOptions.map(option => {
          const raw = getThemeTokens(option.theme, 'light').accent;
          const sample = buildCustomAccentOverrides(raw, themeId, mode);
          return <button type="button" key={option.theme} className="appearance-choice accent-studio-choice" aria-label={option.name} aria-pressed={value === raw}
            onClick={() => { setDraft(raw); onChange(raw); }}>
            <span className="accent-studio-swatch" aria-hidden="true" style={{ backgroundColor: sample['--accent'], color: sample['--accent-foreground'] }}>
              {value === raw ? <Check size={20} /> : <span>Aa</span>}
            </span>
            <span>{option.name}</span>
          </button>;
        })}
      </div>
    </section>
    <form className="accent-studio-custom" aria-labelledby={`${id}-title`}
      onSubmit={event => { event.preventDefault(); if (normalized) onChange(normalized); }}>
    <h2 id={`${id}-title`} className="appearance-section-title">Custom color</h2>
    <p id={`${id}-help`} className="text-sm text-secondary">Pick a color or enter a hex value.</p>
    <div className="accent-studio-inputs">
      <label className="text-xs text-secondary">Color picker<input type="color" aria-label="Pick accent color"
        value={normalized || catalogColor} onChange={event => setDraft(event.target.value)}
        className="lifeos-input mt-1 block h-11 w-14 rounded-lg p-1" /></label>
      <label className="min-w-0 flex-1 text-xs text-secondary" htmlFor={`${id}-hex`}>Hex color
        <input id={`${id}-hex`} type="text" value={draft} maxLength={7} spellCheck={false} autoCapitalize="characters"
          onChange={event => setDraft(event.target.value)} aria-invalid={!normalized}
          aria-describedby={`${id}-help${normalized ? '' : ` ${id}-error`}`}
          className="lifeos-input mt-1 min-h-11 w-full rounded-lg px-3 text-sm" placeholder="#416B51" /></label>
    </div>
    {!normalized && <p id={`${id}-error`} role="alert" className="text-xs text-[var(--danger)]">Enter six hexadecimal digits after #, for example #416B51.</p>}
    {adjusted && <p className="text-xs text-secondary">Readable accent: {overrides?.['--accent']}</p>}
    <div className="appearance-actions accent-studio-actions">
      <button type="submit" disabled={!normalized || normalized === value} className="feather-primary">Apply accent</button>
      <button type="button" onClick={() => { setDraft(catalogColor); onChange(undefined); }} disabled={!value}
        className="lifeos-panel min-h-11 rounded-lg border px-3 text-xs disabled:opacity-50">Use palette accent</button>
    </div>
  </form>
  </div>;
}
