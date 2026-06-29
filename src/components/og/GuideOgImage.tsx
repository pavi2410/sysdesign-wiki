import type { CollectionEntry } from 'astro:content';
import { OgBranding } from '@/components/og/OgBranding';
import { OgTagList } from '@/components/og/OgTagList';
import { guideCategoryLabels, guideCategoryHexColors } from '@/lib/categories';

export function GuideOgImage({ guide }: { guide: CollectionEntry<'guides'> }) {
  const color = guideCategoryHexColors[guide.data.category] ?? '#6b4c3b';
  const tags = guide.data.tags.slice(0, 5);

  return (
    <div
      tw="flex flex-col relative overflow-hidden"
      style={{
        width: 1200,
        height: 630,
        backgroundColor: '#fafaf8',
        fontFamily: 'IBM Plex Sans',
      }}
    >
      <div tw="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: color }} />
      <div
        tw="absolute rounded-full"
        style={{
          top: -80,
          right: -80,
          width: 400,
          height: 400,
          backgroundColor: color,
          opacity: 0.05,
        }}
      />
      <div
        tw="absolute rounded-full"
        style={{
          bottom: -60,
          left: -60,
          width: 250,
          height: 250,
          backgroundColor: color,
          opacity: 0.03,
        }}
      />
      <div tw="flex flex-col justify-between flex-1" style={{ padding: '56px 64px' }}>
        <div tw="flex justify-between items-center">
          <OgBranding />
          <div
            tw="text-sm font-semibold rounded-full"
            style={{
              backgroundColor: color,
              color: 'white',
              padding: '6px 18px',
            }}
          >
            {guideCategoryLabels[guide.data.category]}
          </div>
        </div>
        <div tw="flex flex-col gap-4">
          <div
            tw="text-sm font-semibold uppercase"
            style={{ letterSpacing: '0.15em', color }}
          >
            Capability Guide
          </div>
          <h1
            tw="font-bold m-0"
            style={{
              fontFamily: 'Fraunces',
              fontSize: 60,
              color: '#1a1a1a',
              lineHeight: 1.1,
            }}
          >
            {guide.data.title}
          </h1>
          <p
            tw="m-0"
            style={{
              fontSize: 22,
              color: '#4a4a4a',
              lineHeight: 1.4,
              maxWidth: 700,
            }}
          >
            {guide.data.tagline}
          </p>
        </div>
        <OgTagList tags={tags} />
      </div>
    </div>
  );
}
