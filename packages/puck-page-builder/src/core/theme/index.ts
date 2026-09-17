export type ThemeTokenName = "color.background" | "color.surface" | "color.text" | "color.muted" | "color.primary" | "color.border" | "font.family" | "font.size" | "radius" | "spacing";
export type ThemeTokens = Partial<Record<ThemeTokenName, string>>;
export type ThemeTokenValidation = { success: true; data: ThemeTokens } | { success: false };

export const systemThemeTokens: Readonly<Required<ThemeTokens>> = Object.freeze({
  "color.background": "#ffffff", "color.surface": "#ffffff", "color.text": "#202223", "color.muted": "#6d7175", "color.primary": "#005bd3", "color.border": "#d2d5d8", "font.family": "system-ui, sans-serif", "font.size": "16px", radius: "8px", spacing: "16px"
});

const themeTokenNames = new Set<ThemeTokenName>(Object.keys(systemThemeTokens) as ThemeTokenName[]);
const unsafeCssValue = /[{};]|url\s*\(|expression\s*\(|@import/i;

export function normalizeThemeTokens(value: unknown): ThemeTokenValidation {
  if (value === undefined) return { success: true, data: {} };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { success: false };
  const tokens: ThemeTokens = {};
  for (const [name, tokenValue] of Object.entries(value)) {
    if (!themeTokenNames.has(name as ThemeTokenName) || typeof tokenValue !== "string" || !tokenValue || unsafeCssValue.test(tokenValue)) return { success: false };
    tokens[name as ThemeTokenName] = tokenValue;
  }
  return { success: true, data: tokens };
}

export function mergeThemeTokens(...layers: Array<ThemeTokens | undefined>): Required<ThemeTokens> {
  return Object.freeze(Object.assign({}, systemThemeTokens, ...layers)) as Required<ThemeTokens>;
}

export function toThemeStyle(tokens: ThemeTokens): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`--pb-${name.replaceAll(".", "-")}`, value]));
}
