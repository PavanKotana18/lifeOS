import { contrastRatio, getThemeTokens, type AppearanceMode } from './themeCatalog';

/** Only opaque six-digit colors can enter CSS or persisted preferences. */
export function normalizeCustomAccent(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase() : undefined;
}

function blend(color: string, target: string, amount: number): string {
  return '#' + [1, 3, 5].map(index => Math.round(
    parseInt(color.slice(index, index + 2), 16) * (1 - amount) +
    parseInt(target.slice(index, index + 2), 16) * amount,
  ).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Apply these overrides AFTER applyThemeTokens on each palette/appearance change.
 * A missing preference adds no overrides, so reset retains the selected catalog.
 * Accent is used for both button fills and small text in the existing design.
 */
export function buildCustomAccentOverrides(
  color: string | undefined,
  themeId: string,
  mode: AppearanceMode,
): Record<string, string> {
  if (color === undefined) return {};
  const selected = normalizeCustomAccent(color);
  if (!selected) throw new TypeError('Choose a color in #RRGGBB format.');
  const tokens = getThemeTokens(themeId, mode);
  const backgrounds = [tokens.background, tokens.surface, tokens.elevatedSurface];
  const minimumContrast = (candidate: string) => Math.min(
    ...backgrounds.map(background => contrastRatio(candidate, background)),
    contrastRatio(candidate, blend(tokens.surface, candidate, 0.12)),
  );
  const target = minimumContrast('#000000') >= minimumContrast('#FFFFFF') ? '#000000' : '#FFFFFF';
  let accent = selected;
  for (let step = 0; step <= 255; step++) {
    accent = blend(selected, target, step / 255);
    if (minimumContrast(accent) >= 4.5) break;
  }
  if (minimumContrast(accent) < 4.5) {
    throw new Error('This palette cannot provide readable custom accent text.');
  }
  const foreground = contrastRatio('#000000', accent) >= contrastRatio('#FFFFFF', accent)
    ? '#000000' : '#FFFFFF';
  const tint = blend(tokens.surface, accent, 0.12);
  return {
    '--accent': accent,
    '--accent-foreground': foreground,
    '--accent-tint': tint,
    '--surface-muted': tint,
    '--focus-color': accent,
    '--chart-1': accent,
  };
}
