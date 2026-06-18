import { satori } from '@cf-wasm/satori/workerd';
import { Resvg } from '@cf-wasm/resvg/workerd';

export type OgFont = { name: string; data: ArrayBuffer; weight: number; style: string };

export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(url);
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\((.+?)\)/);
  if (!match) throw new Error(`Font URL not found for ${family}:${weight}`);
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

export async function loadOgFonts(): Promise<OgFont[]> {
  const [frauncesBold, plexRegular, plexSemibold] = await Promise.all([
    loadGoogleFont('Fraunces', 700),
    loadGoogleFont('IBM Plex Sans', 400),
    loadGoogleFont('IBM Plex Sans', 600),
  ]);
  return [
    { name: 'Fraunces', data: frauncesBold, weight: 700, style: 'normal' },
    { name: 'IBM Plex Sans', data: plexRegular, weight: 400, style: 'normal' },
    { name: 'IBM Plex Sans', data: plexSemibold, weight: 600, style: 'normal' },
  ];
}

export async function renderSvgToPng(svg: string): Promise<Response> {
  const resvg = await Resvg.async(svg, { fitTo: { mode: 'width', value: 1200 } });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export { satori };
