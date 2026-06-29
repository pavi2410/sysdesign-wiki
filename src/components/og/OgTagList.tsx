import { og } from '@/components/og/og-tokens';

export function OgTagList({ tags }: { tags: string[] }) {
  return (
    <div tw="flex flex-wrap" style={{ gap: 10 }}>
      {tags.map((tag) => (
        <div
          key={tag}
          tw="font-semibold"
          style={{
            fontSize: og.tag,
            color: og.tagText,
            backgroundColor: og.tagBg,
            border: `1px solid ${og.border}`,
            borderRadius: 3,
            padding: og.tagPad,
          }}
        >
          {tag}
        </div>
      ))}
    </div>
  );
}
