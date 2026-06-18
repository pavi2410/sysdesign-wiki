export type BrandColors = {
  accent: string;
  accentHover: string;
};

/**
 * Brand-inspired accent colors for system case study pages.
 * Overrides --color-accent and --color-accent-hover on the page wrapper
 * so heading bars, link hovers, list bullets, TOC, and buttons pick up
 * the brand tint without changing backgrounds, body text, or typography.
 *
 * Systems not listed here fall back to the default warm-brown accent.
 * Multicolor brands (Google Photos) and pure-black brands (Uber) are
 * intentionally omitted — no single hue represents them cleanly.
 */
export const systemBrandColors: Record<string, BrandColors> = {
  airbnb: { accent: '#FF5A5F', accentHover: '#E04E52' },
  chatgpt: { accent: '#10A37F', accentHover: '#0D8A6B' },
  discord: { accent: '#5865F2', accentHover: '#4752C4' },
  github: { accent: '#0969DA', accentHover: '#0860CA' },
  gmail: { accent: '#EA4335', accentHover: '#C5221F' },
  'google-drive': { accent: '#4285F4', accentHover: '#3367D6' },
  'google-maps': { accent: '#34A853', accentHover: '#2D7A45' },
  'google-meet': { accent: '#00897B', accentHover: '#00695C' },
  instagram: { accent: '#C13584', accentHover: '#A12868' },
  netflix: { accent: '#E50914', accentHover: '#B20710' },
  slack: { accent: '#611F69', accentHover: '#4A154B' },
  telegram: { accent: '#0088CC', accentHover: '#006699' },
  twitter: { accent: '#1DA1F2', accentHover: '#0C7ABF' },
  whatsapp: { accent: '#25D366', accentHover: '#1DA851' },
  youtube: { accent: '#FF0000', accentHover: '#CC0000' },
};
