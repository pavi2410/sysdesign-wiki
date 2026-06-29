import { BookIcon } from '@/components/og/BookIcon';
import { og } from '@/components/og/og-tokens';

export function OgBranding({ iconSize = og.brandIcon }: { iconSize?: number }) {
  return (
    <div tw="flex items-center" style={{ gap: 14 }}>
      <div
        tw="flex items-center justify-center"
        style={{
          width: iconSize + 20,
          height: iconSize + 20,
          borderRadius: 3,
          backgroundColor: og.accent,
        }}
      >
        <BookIcon size={iconSize} />
      </div>
      <span
        tw="font-bold"
        style={{
          fontFamily: og.serif,
          fontSize: iconSize + 12,
          color: og.ink,
          letterSpacing: '-0.01em',
        }}
      >
        SysDesign<span style={{ color: og.accent }}>Wiki</span>
      </span>
    </div>
  );
}
