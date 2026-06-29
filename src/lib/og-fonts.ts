/**
 * Bundled font descriptors for Takumi's `fonts` option.
 * @see https://takumi.kane.tw/docs/typography-and-fonts#loading-fonts
 *
 * Uses the descriptor form `{ name, data, weight, style }` with raw bytes so fonts
 * work in Cloudflare worker prerender (googleFonts network fetch fails there).
 */
export { ogFonts } from '@/lib/og-fonts.generated';
