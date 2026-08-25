type Props = {
  text: string
  className?: string
}

function normalizeSpacing(text: string): string {
  return text
    // 「番号 項目名 **判定**」→ 「番号 項目名　**判定**」（項目名と判定の間を全角スペースに）
    .replace(/^(\d{3} .+?) (\*\*)/gm, '$1　$2')
    // 「**判定**。 特記：」または「**判定**。特記：」→ 「**判定**。　特記：」
    .replace(/(\*\*[。])\s*(特記：)/g, '$1　特記：')
}

export default function MarkdownText({ text, className }: Props) {
  const normalized = normalizeSpacing(text)
  return (
    <div className={className}>
      {normalized.split('\n').map((line, i) => (
        <div key={i} className="min-h-[1.25em] whitespace-pre-wrap">
          {line.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/).map((part, j) =>
            /^\*\*(.+)\*\*$/.test(part)
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
        </div>
      ))}
    </div>
  )
}
