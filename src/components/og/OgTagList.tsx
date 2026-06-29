export function OgTagList({ tags }: { tags: string[] }) {
  return (
    <div tw="flex gap-2.5">
      {tags.map((tag) => (
        <div
          key={tag}
          tw="text-sm rounded-lg"
          style={{
            color: '#6b6b6b',
            backgroundColor: '#f0eeeb',
            padding: '6px 14px',
          }}
        >
          {tag}
        </div>
      ))}
    </div>
  );
}
