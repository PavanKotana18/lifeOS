# LifeOS theme system

The versioned local catalog in `src/services/themeCatalog.ts` provides six palettes: Soft Ivory + Sage Feather (default), Ocean Mist, Warm Sand, Lavender Haze, Midnight Slate and Rose Clay. Each palette defines light and dark mappings for page/surface/text, accent/foreground, border/focus, status colors and five chart series.

Appearance (`system`, `light`, `dark`) remains separate from palette selection. The saved `visualTheme` is a nonsensitive bootstrap preference; startup reads it with a deadline and validates its identifier before the first React render. A cache in localStorage is cosmetic only. Selecting a palette previews it live; Apply persists it, Cancel restores the previous palette, and Restore default previews Soft Ivory + Sage Feather.

Semantic CSS variables are used by the app shell, shared slate/indigo color utilities, finance charts and the new planner/security surfaces. The migration remains incremental; a few legacy component colors and visual workflows still need UI review. Automated contrast assertions cover primary/secondary/disabled/status text and accent foregrounds against theme surfaces, plus chart visibility; they do not replace screen-reader, screenshot or physical-device review.

Run `npm run test:themes` for the catalog and contrast checks. The Android system appearance bridge continues to control light/dark mode independently of the selected palette.
