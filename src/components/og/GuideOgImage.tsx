import type { CollectionEntry } from 'astro:content';
import { OgBackground } from '@/components/og/OgBackground';
import { OgBranding } from '@/components/og/OgBranding';
import { OgLabel } from '@/components/og/OgLabel';
import { OgTagList } from '@/components/og/OgTagList';
import { og, ogTitleSize } from '@/components/og/og-tokens';
import { guideCategoryLabels, guideCategoryHexColors } from '@/lib/categories';

export function GuideOgImage({ guide }: { guide: CollectionEntry<'guides'> }) {
  const color = guideCategoryHexColors[guide.data.category] ?? og.accent;
  const tags = guide.data.tags.slice(0, 4);
  const titleSize = ogTitleSize(guide.data.title, og.titleLg, og.titleMd, 56);

  return (
    <div
      tw="flex flex-col relative overflow-hidden"
      style={{
        width: og.width,
        height: og.height,
        backgroundColor: og.paper,
        fontFamily: og.sans,
      }}
    >
      <OgBackground accent={color} />
      <div
        tw="flex flex-col justify-between flex-1 relative"
        style={{ padding: `${og.padY}px ${og.padX}px` }}
      >
        <div tw="flex justify-between items-start" style={{ gap: 20 }}>
          <OgBranding />
          <div
            tw="font-bold shrink-0"
            style={{
              fontSize: og.badge,
              backgroundColor: color,
              color: 'white',
              borderRadius: 3,
              padding: og.badgePad,
            }}
          >
            {guideCategoryLabels[guide.data.category]}
          </div>
        </div>
        <div tw="flex flex-col" style={{ gap: 24, maxWidth: 1000 }}>
          <OgLabel color={color}>Capability guide</OgLabel>
          <h1
            tw="font-bold m-0"
            style={{
              fontFamily: og.serif,
              fontSize: titleSize,
              color: og.ink,
              lineHeight: 1.06,
              letterSpacing: '-0.02em',
            }}
          >
            {guide.data.title}
          </h1>
          <p
            tw="m-0"
            style={{
              fontSize: og.body,
              color: og.inkLight,
              lineHeight: 1.38,
              maxWidth: 900,
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
