import { useRef } from 'react';
import { InterfacePreview } from './ProfileInterfacePreview';
import { Activity, Check, Layers, Palette } from 'lucide-react';
import { ProfileButton, ProfileGroup, ProfileSettingRow } from './ProfileSettings';
import { MOTION_PRESET_OPTIONS, type MotionPresetId } from '../services/interfaceMotion';
import { buildCustomAccentOverrides } from '../services/customAccent';
import { DEFAULT_THEME_ID, THEME_CATALOG, type AppearanceMode, type ThemeId } from '../services/themeCatalog';
import { accentSelectionLabel } from './CustomAccentPicker';

export type DisplayMode = AppearanceMode | 'system';
const displayLabels = { light: 'Light', dark: 'Dark', system: 'System' } as const;

export function AppearanceStudio({ theme, mode, resolved, accent, motion, onOpen }: {
  theme: ThemeId; mode: DisplayMode; resolved: AppearanceMode; accent?: string; motion: MotionPresetId;
  onOpen: (page: 'themes' | 'accent' | 'motion') => void;
}) {
  return <>
    <ProfileGroup title="Your current look" variant="feature"
      description={THEME_CATALOG[theme].label + ' · ' + displayLabels[mode]}>
      <InterfacePreview tokens={THEME_CATALOG[theme][resolved]} accent={buildCustomAccentOverrides(accent, theme, resolved)} />
    </ProfileGroup>
    <ProfileGroup title="Personalize BusyDoo">
      <ProfileSettingRow title="Themes" detail="Display mode and interface palettes" icon={Layers} onClick={() => onOpen('themes')} />
      <ProfileSettingRow title="Accent color" detail="Highlights, selection and controls" icon={Palette} value={accentSelectionLabel(accent)} onClick={() => onOpen('accent')} />
      <ProfileSettingRow title="Motion" detail="The pace of transitions and feedback" icon={Activity}
        value={MOTION_PRESET_OPTIONS.find(option => option.id === motion)?.label} onClick={() => onOpen('motion')} />
    </ProfileGroup>
  </>;
}

export function ThemeStudio({ current, preview, appearance, resolved, accent, saving, onAppearance, onPreview, onApply, onCancel }: {
  current: ThemeId; preview: ThemeId | null; appearance: DisplayMode; resolved: AppearanceMode; accent?: string; saving: boolean;
  onAppearance: (value: DisplayMode) => void; onPreview: (value: ThemeId) => void; onApply: () => void; onCancel: () => void;
}) {
  const shown = preview ?? current;
  const previewRegion = useRef<HTMLDivElement>(null);
  const previewPalette = (id: ThemeId) => {
    onPreview(id);
    if (id !== current) {
      previewRegion.current?.scrollIntoView({ block: 'start' });
      previewRegion.current?.focus({ preventScroll: true });
    }
  };
  return <>
    <div className="profile-preview-anchor" ref={previewRegion} tabIndex={-1}>
    <ProfileGroup title={preview ? 'Previewing ' + THEME_CATALOG[shown].label : 'Current palette'} variant="feature"
      description={preview ? 'Apply the preview to keep it, or cancel to return to your saved palette.' : THEME_CATALOG[current].label}>
      <InterfacePreview tokens={THEME_CATALOG[shown][resolved]} accent={buildCustomAccentOverrides(accent, shown, resolved)} />
      {preview && <div className="profile-actions">
        <ProfileButton onClick={onCancel} disabled={saving}>Cancel preview</ProfileButton>
        <ProfileButton tone="primary" onClick={onApply} disabled={saving}>{saving ? 'Saving…' : 'Apply theme'}</ProfileButton>
      </div>}
    </ProfileGroup>
    </div>
    <ProfileGroup title="Display mode" topic="System appearance" variant="plain" description="Display mode saves as soon as you select it.">
      <div className="profile-mode-group" role="group" aria-label="Display mode">
        {(['light', 'dark', 'system'] as const).map(mode => <ProfileButton key={mode} aria-pressed={appearance === mode}
          onClick={() => onAppearance(mode)}>{displayLabels[mode]}</ProfileButton>)}
      </div>
    </ProfileGroup>
    <ProfileGroup title="Theme palettes" variant="plain">
      <div className="profile-palette-grid">
        {(Object.entries(THEME_CATALOG) as [ThemeId, typeof THEME_CATALOG[ThemeId]][]).map(([id, option]) =>
          <button type="button" key={id} className="profile-palette" aria-label={'Preview ' + option.label}
            aria-pressed={shown === id} data-current={current === id || undefined} aria-disabled={saving || undefined}
            disabled={saving} onClick={() => previewPalette(id)}>
            <span className="profile-palette-sample" aria-hidden="true" style={{ background: option[resolved].background, borderColor: option[resolved].border }}>
              <span style={{ background: option[resolved].surface, color: option[resolved].primaryText }}>Aa</span>
              <span style={{ background: option[resolved].accent }} />
            </span>
            <strong>{option.label}</strong>
            {current === id && <span className="profile-palette-state">Saved</span>}
            {preview === id && <span className="profile-palette-state"><Check size={14} aria-hidden="true" /> Preview</span>}
          </button>)}
      </div>
      {shown !== DEFAULT_THEME_ID && <div className="profile-actions"><ProfileButton onClick={() => previewPalette(DEFAULT_THEME_ID)}
        disabled={saving}>Preview default palette</ProfileButton></div>}
    </ProfileGroup>
  </>;
}
