export type ThemeId = 'soft-ivory-sage' | 'ocean-mist' | 'warm-sand' | 'lavender-haze' | 'midnight-slate' | 'rose-clay';
export type AppearanceMode = 'light' | 'dark';

export interface ThemeTokens {
  background: string; surface: string; elevatedSurface: string; primaryText: string; secondaryText: string;
  accent: string; accentForeground: string; accentTint: string; border: string; focus: string;
  success: string; warning: string; danger: string; disabled: string; chartSeries: readonly string[];
}

const pair = (light: ThemeTokens, dark: ThemeTokens) => Object.freeze({ light: Object.freeze(light), dark: Object.freeze(dark) });
export const DEFAULT_THEME_ID: ThemeId = 'soft-ivory-sage';

/** Local, versioned design palette; it stores no user content and makes no network request. */
export const THEME_CATALOG: Readonly<Record<ThemeId, { label: string; light: ThemeTokens; dark: ThemeTokens }>> = Object.freeze({
  'soft-ivory-sage': {
    label: 'Soft Ivory + Sage Feather',
    ...pair(
      { background:'#FAFAF7',surface:'#FFFFFF',elevatedSurface:'#F5F7F3',primaryText:'#25312A',secondaryText:'#58665B',accent:'#416B51',accentForeground:'#FFFFFF',accentTint:'#E8F0E7',border:'#E9EEE8',focus:'#416B51',success:'#286747',warning:'#704900',danger:'#A52A2A',disabled:'#626D64',chartSeries:['#416B51','#386F8A','#80649B','#B76842','#69766B'] },
      { background:'#101712',surface:'#17211A',elevatedSurface:'#202D23',primaryText:'#F2F6F2',secondaryText:'#C3D0C5',accent:'#A3C7A9',accentForeground:'#142017',accentTint:'#263C2C',border:'#3A493D',focus:'#B8D9BD',success:'#8AD09E',warning:'#FFD17E',danger:'#FF9690',disabled:'#A4B0A6',chartSeries:['#A3C7A9','#7DC0D6','#C1A3DA','#F0A47E','#D0D8D1'] }
    ),
  },
  'ocean-mist': {
    label: 'Ocean Mist',
    ...pair(
      { background:'#F5FAFC',surface:'#FFFFFF',elevatedSurface:'#EAF3F6',primaryText:'#20333B',secondaryText:'#536A73',accent:'#275E78',accentForeground:'#FFFFFF',accentTint:'#DCECF3',border:'#D6E4E9',focus:'#24566D',success:'#246344',warning:'#715000',danger:'#A32D35',disabled:'#5A696E',chartSeries:['#275E78','#477F69','#80669B','#B36E44','#536A73'] },
      { background:'#11191D',surface:'#192329',elevatedSurface:'#24323A',primaryText:'#F1F6F8',secondaryText:'#C3D0D5',accent:'#91C4D9',accentForeground:'#13232B',accentTint:'#203B47',border:'#3B4B53',focus:'#A7D7E8',success:'#8ACBA2',warning:'#F5D079',danger:'#FF969A',disabled:'#A2B0B5',chartSeries:['#91C4D9','#91C6A9','#C2A4DC','#F0A77D','#D0D9DD'] }
    ),
  },
  'warm-sand': {
    label: 'Warm Sand',
    ...pair(
      { background:'#FCF8F1',surface:'#FFFFFF',elevatedSurface:'#F6EFE3',primaryText:'#332B20',secondaryText:'#6A5D4B',accent:'#80572A',accentForeground:'#FFFFFF',accentTint:'#F1E4D1',border:'#EDE3D4',focus:'#80572A',success:'#356344',warning:'#704700',danger:'#A42D28',disabled:'#70665B',chartSeries:['#80572A','#536F71','#77709C','#B65C43','#6A5D4B'] },
      { background:'#1B1712',surface:'#252018',elevatedSurface:'#332B20',primaryText:'#F8F3EA',secondaryText:'#D0C5B4',accent:'#E2B779',accentForeground:'#2A1B0A',accentTint:'#413321',border:'#4E4333',focus:'#F0C88F',success:'#91C99D',warning:'#FFD27A',danger:'#FFA09A',disabled:'#B2A89A',chartSeries:['#E2B779','#8BC4C5','#B9A6E4','#F09A79','#D0C5B4'] }
    ),
  },
  'lavender-haze': {
    label: 'Lavender Haze',
    ...pair(
      { background:'#F9F7FC',surface:'#FFFFFF',elevatedSurface:'#F0ECF7',primaryText:'#30283D',secondaryText:'#675D75',accent:'#69518C',accentForeground:'#FFFFFF',accentTint:'#EAE3F4',border:'#E4DDEC',focus:'#69518C',success:'#286747',warning:'#704900',danger:'#A52A36',disabled:'#6A6272',chartSeries:['#69518C','#39758A','#557C61','#B26942','#675D75'] },
      { background:'#17141D',surface:'#211D29',elevatedSurface:'#2D2738',primaryText:'#F5F1FA',secondaryText:'#CFC6D9',accent:'#C4A9E5',accentForeground:'#281B38',accentTint:'#382C49',border:'#4A4056',focus:'#D3BCEF',success:'#8AD09E',warning:'#FFD17E',danger:'#FF969A',disabled:'#AFA6B8',chartSeries:['#C4A9E5','#83C9DC','#A4D0A6','#F0A47E','#D0C6D9'] }
    ),
  },
  'midnight-slate': {
    label: 'Midnight Slate',
    ...pair(
      { background:'#F5F7FA',surface:'#FFFFFF',elevatedSurface:'#EAEFF5',primaryText:'#26323E',secondaryText:'#5C6977',accent:'#334E68',accentForeground:'#FFFFFF',accentTint:'#E1EAF2',border:'#DCE3EB',focus:'#334E68',success:'#286747',warning:'#704900',danger:'#A52A2A',disabled:'#626D78',chartSeries:['#334E68','#3F7C73','#78658F','#B36C49','#5C6977'] },
      { background:'#111820',surface:'#19222C',elevatedSurface:'#242F3B',primaryText:'#F2F5F8',secondaryText:'#C3CDD7',accent:'#A8C6E2',accentForeground:'#172330',accentTint:'#28394A',border:'#3B4958',focus:'#BED9F1',success:'#8AD09E',warning:'#FFD17E',danger:'#FF9690',disabled:'#A4AFBA',chartSeries:['#A8C6E2','#8CCFC2','#C4A9E5','#EDA17A','#CCD5DF'] }
    ),
  },
  'rose-clay': {
    label: 'Rose Clay',
    ...pair(
      { background:'#FCF7F5',surface:'#FFFFFF',elevatedSurface:'#F5EBE7',primaryText:'#352925',secondaryText:'#705E58',accent:'#8A4B45',accentForeground:'#FFFFFF',accentTint:'#F2E2DE',border:'#EDE0DC',focus:'#8A4B45',success:'#286747',warning:'#704900',danger:'#A52A2A',disabled:'#70625D',chartSeries:['#8A4B45','#3B7587','#78658E','#A3743F','#705E58'] },
      { background:'#1C1514',surface:'#281F1D',elevatedSurface:'#382A27',primaryText:'#F8F1EF',secondaryText:'#D2C2BE',accent:'#E0A39A',accentForeground:'#321A17',accentTint:'#452D29',border:'#51403C',focus:'#F0B8B0',success:'#8AD09E',warning:'#FFD17E',danger:'#FF9690',disabled:'#B5A6A2',chartSeries:['#E0A39A','#8BCBDC','#C0A6E0','#E6B275','#D2C2BE'] }
    ),
  },
});

export function getThemeTokens(themeId: string, mode: AppearanceMode): ThemeTokens {
  const selected = Object.prototype.hasOwnProperty.call(THEME_CATALOG, themeId) ? THEME_CATALOG[themeId as ThemeId] : THEME_CATALOG[DEFAULT_THEME_ID];
  return selected[mode];
}

export function resolveThemeId(themeId: unknown): ThemeId {
  return typeof themeId === 'string' && Object.prototype.hasOwnProperty.call(THEME_CATALOG, themeId)
    ? themeId as ThemeId : DEFAULT_THEME_ID;
}

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const raw = hex.replace('#', '');
    if (!/^[\da-f]{6}$/i.test(raw)) throw new TypeError('Theme colors must be six-digit hex values.');
    const channels = [0, 2, 4].map(index => parseInt(raw.slice(index, index + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function applyThemeTokens(themeId: string, mode: AppearanceMode, root: HTMLElement = document.documentElement): void {
  const tokens = getThemeTokens(themeId, mode);
  const variables: Record<string, string> = {
    '--page': tokens.background, '--surface': tokens.surface, '--surface-raised': tokens.elevatedSurface,
    '--surface-muted': tokens.accentTint, '--ink': tokens.primaryText, '--ink-secondary': tokens.secondaryText,
    '--ink-muted': tokens.disabled, '--stroke': tokens.border, '--accent': tokens.accent,
    '--accent-foreground': tokens.accentForeground, '--accent-tint': tokens.accentTint,
    '--focus-color': tokens.focus, '--success': tokens.success, '--warning': tokens.warning,
    '--danger': tokens.danger, '--disabled': tokens.disabled,
    '--chart-1': tokens.chartSeries[0], '--chart-2': tokens.chartSeries[1], '--chart-3': tokens.chartSeries[2],
    '--chart-4': tokens.chartSeries[3], '--chart-5': tokens.chartSeries[4],
  };
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
}
