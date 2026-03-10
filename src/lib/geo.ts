/** Canadian province/territory codes → names */
export const STATE_NAMES: Record<string, string> = {
  'ON': 'Ontario',
  'QC': 'Quebec',
  'BC': 'British Columbia',
  'AB': 'Alberta',
  'MB': 'Manitoba',
  'SK': 'Saskatchewan',
  'NS': 'Nova Scotia',
  'NB': 'New Brunswick',
  'NL': 'Newfoundland and Labrador',
  'PE': 'Prince Edward Island',
  'NT': 'Northwest Territories',
  'YT': 'Yukon Territory',
  'NU': 'Nunavut',
};

/** Map from province full name (as in GeoJSON) to province code */
export const PROVINCE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name, code])
);

/** Convenience array of all province codes */
export const ALL_STATE_FIPS = Object.keys(STATE_NAMES);

/**
 * Returns a teal rgba fill for mapped provinces.
 * @param intensity 0..1 — maps to 8–60% opacity
 */
export function regionFillColor(intensity: number): string {
  const clamped = Math.max(0, Math.min(1, intensity));
  const opacity = 0.08 + clamped * 0.52; // 0.08 → 0.60
  return `rgba(80,184,154,${opacity.toFixed(2)})`;
}
