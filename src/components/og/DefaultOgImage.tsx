import { OgBackground } from '@/components/og/OgBackground';
import { OgBranding } from '@/components/og/OgBranding';
import { OgLabel } from '@/components/og/OgLabel';
import { og } from '@/components/og/og-tokens';

export function DefaultOgImage() {
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
      <OgBackground />
      <div
        tw="flex flex-col justify-between flex-1 relative"
        style={{ padding: `${og.padY}px ${og.padX}px` }}
      >
        <OgBranding />
        <div tw="flex flex-col" style={{ gap: 28, maxWidth: 1000 }}>
          <OgLabel>Practical learning for engineering judgment</OgLabel>
          <h1
            tw="font-bold m-0"
            style={{
              fontFamily: og.serif,
              fontSize: og.titleXl,
              color: og.ink,
              lineHeight: 1.04,
              letterSpacing: '-0.02em',
            }}
          >
            System design without architecture theater.
          </h1>
          <p
            tw="m-0"
            style={{
              fontSize: og.body,
              color: og.inkLight,
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            Tradeoffs, cost drivers, failure modes, and when to evolve a design.
          </p>
        </div>
        <div
          tw="font-semibold"
          style={{ fontSize: og.footer, color: og.inkMuted, letterSpacing: '0.04em' }}
        >
          sysdesign.wiki
        </div>
      </div>
    </div>
  );
}
