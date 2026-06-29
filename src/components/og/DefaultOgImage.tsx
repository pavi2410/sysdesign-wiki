import { BookIcon } from '@/components/og/BookIcon';

const BRAND = '#6b4c3b';

export function DefaultOgImage() {
  return (
    <div
      tw="flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        width: 1200,
        height: 630,
        backgroundColor: '#fafaf8',
        fontFamily: 'IBM Plex Sans',
      }}
    >
      <div tw="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: BRAND }} />
      <div
        tw="absolute rounded-full"
        style={{
          bottom: -120,
          right: -120,
          width: 500,
          height: 500,
          backgroundColor: BRAND,
          opacity: 0.04,
        }}
      />
      <div
        tw="absolute rounded-full"
        style={{
          top: -80,
          left: -80,
          width: 300,
          height: 300,
          backgroundColor: BRAND,
          opacity: 0.03,
        }}
      />
      <div tw="flex flex-col items-center gap-6">
        <div
          tw="flex items-center justify-center rounded-xl"
          style={{
            width: 64,
            height: 64,
            backgroundColor: BRAND,
          }}
        >
          <BookIcon size={36} />
        </div>
        <div
          tw="text-sm font-semibold uppercase"
          style={{ letterSpacing: '0.2em', color: BRAND }}
        >
          Practical Learning for
        </div>
        <h1
          tw="font-bold text-center m-0"
          style={{
            fontFamily: 'Fraunces',
            fontSize: 72,
            color: '#1a1a1a',
            lineHeight: 1.1,
          }}
        >
          System Design Judgment
        </h1>
        <p
          tw="text-center m-0"
          style={{
            fontSize: 22,
            color: '#4a4a4a',
            maxWidth: 600,
          }}
        >
          Tradeoffs, cost drivers, cloud constraints, and failure modes for practical architecture
          learning.
        </p>
      </div>
    </div>
  );
}
