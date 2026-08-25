type Props = {
  text: string
  className?: string
}

export default function MarkdownText({ text, className }: Props) {
  return (
    <div className={className}>
      {text.split('\n').map((line, i) => (
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
