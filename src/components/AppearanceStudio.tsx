import { Activity, Check, Layers, Palette } from 'lucide-react';
import { ProfileNavigationRow } from './ProfileSettings';
import { MOTION_PRESET_OPTIONS, type MotionPresetId } from '../services/interfaceMotion';
import { DEFAULT_THEME_ID, THEME_CATALOG, type AppearanceMode, type ThemeId, type ThemeTokens } from '../services/themeCatalog';
import { accentSelectionLabel } from './CustomAccentPicker';

export type DisplayMode = AppearanceMode | 'system';
const displayModes = ['light', 'dark', 'system'] as const;
const displayLabels = { light: 'Light', dark: 'Dark', system: 'System' } as const;

export function AppearanceStudio({ theme, mode, accent, motion, onOpen }: {
  theme: ThemeId;
  mode: DisplayMode;
  accent?: string;
  motion: MotionPresetId;
  onOpen: (page: 'themes' | 'accent' | 'motion') => void;
}) {
  return <nav className="appearance-destinations profile-link-group" aria-label="Appearance settings">
    <ProfileNavigationRow title="Themes" detail="Choose the look of LifeOS" icon={Layers}
      value={THEME_CATALOG[theme].label + ' · ' + displayLabels[mode]} onClick={() => onOpen('themes')} />
    <ProfileNavigationRow title="Accent color" detail="Personalize highlights and controls" icon={Palette}
      value={accentSelectionLabel(accent)} onClick={() => onOpen('accent')} />
    <ProfileNavigationRow title="Motion" detail="Choose how LifeOS moves" icon={Activity}
      value={MOTION_PRESET_OPTIONS.find(option => option.id === motion)?.label} onClick={() => onOpen('motion')} />
  </nav>;
}

function InterfacePreview({ tokens }: { tokens: ThemeTokens }) {
  return <span className="appearance-mini" aria-hidden="true" style={{
    backgroundColor: tokens.background, color: tokens.primaryText, borderColor: tokens.border,
  }}>
    <span className="appearance-mini-header"><span style={{ backgroundColor: tokens.accent }} />LifeOS</span>
    <span className="appearance-mini-card" style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}>
      <strong>Today</strong><span style={{ color: tokens.secondaryText }}>Daily plan</span>
      <span className="appearance-mini-action" style={{ backgroundColor: tokens.accent, color: tokens.accentForeground }}>Add</span>
    </span>
  </span>;
}

export function ThemeStudio({ current, preview, appearance, resolved, saving, onAppearance, onPreview, onApply, onCancel }: {
  current: ThemeId;
  preview: ThemeId | null;
  appearance: DisplayMode;
  resolved: AppearanceMode;
  saving: boolean;
  onAppearance: (value: DisplayMode) => void;
  onPreview: (value: ThemeId) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const palette = THEME_CATALOG[preview ?? current];
  return <div className="appearance-studio">
    <section aria-labelledby="appearance-display-mode">
      <h2 className="appearance-section-title" id="appearance-display-mode">Display mode</h2>
      <div className="appearance-mode-grid" role="group" aria-labelledby="appearance-display-mode">
        {displayModes.map(mode => <button type="button" key={mode} className="appearance-choice appearance-mode-card"
          aria-label={displayLabels[mode]} aria-pressed={appearance === mode} onClick={() => onAppearance(mode)}>
          <span className={'appearance-mode-preview' + (mode === 'system' ? ' appearance-mode-system' : '')}>
            {mode === 'system' ? <><InterfacePreview tokens={palette.light} /><InterfacePreview tokens={palette.dark} /></>
              : <InterfacePreview tokens={palette[mode]} />}
          </span>
          <span className="appearance-choice-label">{displayLabels[mode]}<Check size={16} aria-hidden="true" /></span>
        </button>)}
      </div>
    </section>
    <section aria-labelledby="appearance-palettes">
      <h2 className="appearance-section-title" id="appearance-palettes">Theme palettes</h2>
      <div className="appearance-palette-grid" role="group" aria-labelledby="appearance-palettes" aria-busy={saving}>
        {(Object.entries(THEME_CATALOG) as [ThemeId, typeof palette][]).map(([id, option]) =>
          <button type="button" key={id} className="appearance-choice appearance-palette-card" aria-label={'Preview ' + option.label}
            aria-pressed={(preview ?? current) === id} disabled={saving} onClick={() => onPreview(id)}>
            <InterfacePreview tokens={option[resolved]} />
            <span className="appearance-choice-label">{option.label}<Check size={16} aria-hidden="true" /></span>
          </button>)}
      </div>
      <div className="appearance-actions">
        <button type="button" className="appearance-secondary" disabled={saving || (preview ?? current) === DEFAULT_THEME_ID} onClick={() => onPreview(DEFAULT_THEME_ID)}>Restore default</button>
        <button type="button" className="appearance-secondary" disabled={saving || !preview} onClick={onCancel}>Cancel preview</button>
        <button type="button" className="appearance-primary" disabled={saving || !preview || preview === current} onClick={onApply}>
          {saving ? 'Saving…' : 'Apply theme'}
        </button>
      </div>
    </section>
  </div>;
}
