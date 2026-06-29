import { og } from '@/components/og/og-tokens';

export function OgLabel({ children, color = og.accent }: { children: string; color?: string }) {
  return (
    <div tw="flex items-center" style={{ gap: 14 }}>
      <div style={{ width: og.labelLine, height: 3, backgroundColor: color }} />
      <div
        tw="font-semibold uppercase"
        style={{ fontSize: og.labelSize, letterSpacing: '0.12em', color }}
      >
        {children}
      </div>
    </div>
  );
}
