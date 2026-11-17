import { useEffect, useId, useState } from 'react';
import { buildCustomAccentOverrides, normalizeCustomAccent } from '../services/customAccent';
import { DEFAULT_THEME_ID, getThemeTokens, type AppearanceMode } from '../services/themeCatalog';

type Props = {
  value?: string;
  onChange: (color: string | undefined) => void;
  themeId?: string;
  mode?: AppearanceMode;
};

export default function CustomAccentPicker({ value, onChange, themeId = DEFAULT_THEME_ID, mode = 'light' }: Props) {
  const id = useId();
  const catalogColor = getThemeTokens(themeId, mode).accent;
  const [draft, setDraft] = useState(value || catalogColor);
  useEffect(() => { setDraft(value || catalogColor); }, [value, catalogColor]);
  const normalized = normalizeCustomAccent(draft);
  const overrides = normalized ? buildCustomAccentOverrides(normalized, themeId, mode) : null;
  const adjusted = normalized && overrides?.['--accent'] !== normalized;

  return <form className="lifeos-raised space-y-3 rounded-xl p-3" aria-labelledby={`${id}-title`}
    onSubmit={event => { event.preventDefault(); if (normalized) onChange(normalized); }}>
    <div><h4 id={`${id}-title`} className="text-sm font-semibold">Your accent color</h4>
      <p id={`${id}-help`} className="mt-1 text-xs leading-relaxed text-secondary">Choose a color for buttons, highlights and charts. LifeOS adjusts its brightness for readable text in each appearance.</p></div>
    <div className="flex items-end gap-3">
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
    {overrides && <div className="flex min-h-11 items-center gap-3 text-xs text-secondary">
      <span className="rounded-lg px-3 py-2 font-semibold" style={{ backgroundColor: overrides['--accent'], color: overrides['--accent-foreground'] }}>Preview</span>
      <span>{adjusted ? `Readable accent: ${overrides['--accent']}` : 'This color is readable in the selected appearance.'}</span>
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={!normalized || normalized === value} className="lifeos-accent-button min-h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50">Apply accent</button>
      <button type="button" onClick={() => { setDraft(catalogColor); onChange(undefined); }} disabled={!value}
        className="lifeos-panel min-h-11 rounded-lg border px-3 text-xs disabled:opacity-50">Use palette accent</button>
    </div>
  </form>;
}
