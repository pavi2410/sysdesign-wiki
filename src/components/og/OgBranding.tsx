import { BookIcon } from '@/components/og/BookIcon';

export function OgBranding({ iconSize = 20 }: { iconSize?: number }) {
  return (
    <div tw="flex items-center gap-3">
      <div
        tw="flex items-center justify-center rounded-md"
        style={{
          width: iconSize + 16,
          height: iconSize + 16,
          backgroundColor: '#6b4c3b',
        }}
      >
        <BookIcon size={iconSize} />
      </div>
      <span tw="text-xl font-semibold" style={{ color: '#1a1a1a' }}>
        SysDesignWiki
      </span>
    </div>
  );
}
