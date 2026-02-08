import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { systems, categoryLabels } from '../../data';

export const getStaticPaths: GetStaticPaths = () => {
  return systems.map((system) => ({
    params: { slug: system.slug },
    props: { system },
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
  const { system } = props as { system: (typeof systems)[0] };

  const [playfairBold, interRegular, interSemibold] = await Promise.all([
    loadGoogleFont('Playfair Display', 700),
    loadGoogleFont('Inter', 400),
    loadGoogleFont('Inter', 600),
  ]);

  const categoryColor: Record<string, string> = {
    messaging: '#2d6a4f',
    social: '#7b2d8b',
    streaming: '#c2185b',
    transport: '#1565c0',
    search: '#e65100',
    commerce: '#4e342e',
    infra: '#37474f',
  };

  const color = categoryColor[system.category] ?? '#6b4c3b';
  const scaleEntries = Object.entries(system.scale).slice(0, 4);

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
          // Decorative background element
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
                opacity: 0.04,
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
                // Top: branding + category
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
                                  color: 'white',
                                  fontSize: '18px',
                                  fontWeight: 700,
                                },
                                children: 'S',
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
                          children: categoryLabels[system.category],
                        },
                      },
                    ],
                  },
                },
                // Middle: title + tagline
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
                          children: 'System Design & Architecture',
                        },
                      },
                      {
                        type: 'h1',
                        props: {
                          style: {
                            fontFamily: 'Playfair Display',
                            fontSize: '64px',
                            fontWeight: 700,
                            color: '#1a1a1a',
                            lineHeight: 1.1,
                            margin: 0,
                            letterSpacing: '-0.02em',
                          },
                          children: `How to Build ${system.name}`,
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
                          children: system.tagline,
                        },
                      },
                    ],
                  },
                },
                // Bottom: scale metrics
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      gap: '32px',
                    },
                    children: scaleEntries.map(([key, value]) => ({
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        },
                        children: [
                          {
                            type: 'span',
                            props: {
                              style: {
                                fontFamily: 'Playfair Display',
                                fontSize: '24px',
                                fontWeight: 700,
                                color: color,
                              },
                              children: value,
                            },
                          },
                          {
                            type: 'span',
                            props: {
                              style: {
                                fontSize: '13px',
                                color: '#8a8a8a',
                              },
                              children: key,
                            },
                          },
                        ],
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
