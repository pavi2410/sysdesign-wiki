import { og } from '@/components/og/og-tokens';

export function OgBackground({ accent }: { accent?: string }) {
  const wash = accent ?? og.accent;

  return (
    <>
      <div
        tw="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(${og.border} 1px, transparent 1px),
            linear-gradient(90deg, ${og.border} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.35,
        }}
      />
      <div
        tw="absolute rounded-full"
        style={{
          top: -120,
          right: -80,
          width: 420,
          height: 420,
          backgroundColor: wash,
          opacity: 0.06,
        }}
      />
      <div
        tw="absolute top-0 left-0 right-0"
        style={{ height: og.topBar, backgroundColor: wash }}
      />
    </>
  );
}
