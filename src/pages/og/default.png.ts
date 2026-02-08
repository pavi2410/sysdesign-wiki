import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(url);
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\((.+?)\)/);
  if (!match) throw new Error(`Font URL not found for ${family}:${weight}`);
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

export const GET: APIRoute = async () => {
  const [playfairBold, interRegular, interSemibold] = await Promise.all([
    loadGoogleFont('Playfair Display', 700),
    loadGoogleFont('Inter', 400),
    loadGoogleFont('Inter', 600),
  ]);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fafaf8',
          fontFamily: 'Inter',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                backgroundColor: '#6b4c3b',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '-120px',
                right: '-120px',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                backgroundColor: '#6b4c3b',
                opacity: 0.04,
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '-80px',
                left: '-80px',
                width: '300px',
                height: '300px',
                borderRadius: '50%',
                backgroundColor: '#6b4c3b',
                opacity: 0.03,
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '64px',
                      height: '64px',
                      borderRadius: '12px',
                      backgroundColor: '#6b4c3b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '32px',
                      fontWeight: 700,
                    },
                    children: 'S',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '14px',
                      fontWeight: 600,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.2em',
                      color: '#6b4c3b',
                    },
                    children: 'The Encyclopedia of',
                  },
                },
                {
                  type: 'h1',
                  props: {
                    style: {
                      fontFamily: 'Playfair Display',
                      fontSize: '72px',
                      fontWeight: 700,
                      color: '#1a1a1a',
                      lineHeight: 1.1,
                      margin: 0,
                      textAlign: 'center',
                      letterSpacing: '-0.02em',
                    },
                    children: 'System Design & Architecture',
                  },
                },
                {
                  type: 'p',
                  props: {
                    style: {
                      fontSize: '22px',
                      color: '#4a4a4a',
                      textAlign: 'center',
                      maxWidth: '600px',
                      margin: 0,
                    },
                    children: 'Deep-dive into the architectures powering the world\u2019s most popular applications.',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Playfair Display', data: playfairBold, weight: 700, style: 'normal' },
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interSemibold, weight: 600, style: 'normal' },
      ],
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
