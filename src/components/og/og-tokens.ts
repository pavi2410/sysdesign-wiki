export const og = {
  paper: '#fafafa',
  ink: '#18181b',
  inkLight: '#52525b',
  inkMuted: '#a1a1aa',
  accent: '#2563eb',
  border: '#e4e4e7',
  tagBg: '#f4f4f5',
  tagText: '#52525b',
  serif: "'Source Serif 4'",
  sans: "'IBM Plex Sans'",
  width: 1200,
  height: 630,
  /** Tuned for legibility in mobile social previews (~1.3× prior scale). */
  padX: 60,
  padY: 44,
  brandIcon: 28,
  labelSize: 17,
  labelLine: 44,
  titleXl: 82,
  titleLg: 72,
  titleMd: 64,
  body: 30,
  tag: 19,
  badge: 18,
  footer: 18,
  badgePad: '10px 20px',
  tagPad: '9px 18px',
  topBar: 5,
} as const;

export function ogTitleSize(text: string, lg: number, md: number, sm: number): number {
  if (text.length > 40) return sm;
  if (text.length > 28) return md;
  return lg;
}
