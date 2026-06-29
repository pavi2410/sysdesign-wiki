import type { ImageResponseOptions } from 'takumi-js/response';
import { ogFonts } from '@/lib/og-fonts';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const ogImageOptions: ImageResponseOptions = {
  width: OG_WIDTH,
  height: OG_HEIGHT,
  fonts: ogFonts,
  fontFamilies: ['Fraunces', 'IBM Plex Sans'],
  headers: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
};
