import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { guides, guideCategoryLabels } from '../../../data/guides';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () => {
  return guides.map((guide) => ({
    params: { slug: guide.slug },
    props: { guide },
  }));
};

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const cssRes = await fetch(url);
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\((.+?)\)/);
  if (!match) throw new Error(`Font URL not found for ${family}:${weight}`);
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}

export const GET: APIRoute = async ({ props }) => {
  const { guide } = props as { guide: (typeof guides)[0] };

  const [playfairBold, interRegular, interSemibold] = await Promise.all([
    loadGoogleFont('Playfair Display', 700),
    loadGoogleFont('Inter', 400),
    loadGoogleFont('Inter', 600),
  ]);

  const categoryColor: Record<string, string> = {
    'real-time': '#0d7377',
    platform: '#5b21b6',
    data: '#b45309',
    reliability: '#064e3b',
    security: '#991b1b',
    media: '#7c3aed',
    collaboration: '#0369a1',
  };

  const color = categoryColor[guide.category] ?? '#6b4c3b';
  const tagList = guide.tags.slice(0, 5);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fafaf8',
          fontFamily: 'Inter',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          // Top accent bar
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                backgroundColor: color,
              },
            },
          },
          // Decorative background circle
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '-80px',
                right: '-80px',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                backgroundColor: color,
                opacity: 0.05,
              },
            },
          },
          // Second decorative circle
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '-60px',
                left: '-60px',
                width: '250px',
                height: '250px',
                borderRadius: '50%',
                backgroundColor: color,
                opacity: 0.03,
              },
            },
          },
          // Main content
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '56px 64px',
                flex: 1,
              },
              children: [
                // Top: branding + category badge
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          },
                          children: [
                            {
                              type: 'div',
                              props: {
                                style: {
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '6px',
                                  backgroundColor: '#6b4c3b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                },
                                children: {
                                  type: 'svg',
                                  props: {
                                    width: 20,
                                    height: 20,
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'white',
                                    'stroke-width': '2',
                                    'stroke-linecap': 'round',
                                    'stroke-linejoin': 'round',
                                    children: [
                                      { type: 'path', props: { d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' } },
                                      { type: 'path', props: { d: 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' } },
                                    ],
                                  },
                                },
                              },
                            },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '20px',
                                  fontWeight: 600,
                                  color: '#1a1a1a',
                                  letterSpacing: '-0.01em',
                                },
                                children: 'SysDesignWiki',
                              },
                            },
                          ],
                        },
                      },
                      {
                        type: 'div',
                        props: {
                          style: {
                            backgroundColor: color,
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            padding: '6px 18px',
                            borderRadius: '20px',
                          },
                          children: guideCategoryLabels[guide.category],
                        },
                      },
                    ],
                  },
                },
                // Middle: label + title + tagline
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: '14px',
                            fontWeight: 600,
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.15em',
                            color: color,
                          },
                          children: 'Feature Guide',
                        },
                      },
                      {
                        type: 'h1',
                        props: {
                          style: {
                            fontFamily: 'Playfair Display',
                            fontSize: '60px',
                            fontWeight: 700,
                            color: '#1a1a1a',
                            lineHeight: 1.1,
                            margin: 0,
                            letterSpacing: '-0.02em',
                          },
                          children: guide.title,
                        },
                      },
                      {
                        type: 'p',
                        props: {
                          style: {
                            fontSize: '22px',
                            color: '#4a4a4a',
                            lineHeight: 1.4,
                            margin: 0,
                            maxWidth: '700px',
                          },
                          children: guide.tagline,
                        },
                      },
                    ],
                  },
                },
                // Bottom: tags
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      gap: '10px',
                    },
                    children: tagList.map((tag) => ({
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '14px',
                          color: '#6b6b6b',
                          backgroundColor: '#f0eeeb',
                          padding: '6px 14px',
                          borderRadius: '8px',
                        },
                        children: tag,
                      },
                    })),
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

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
