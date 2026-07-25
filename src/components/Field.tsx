import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  mono?: boolean
}

export default function Field({ label, hint, mono, id, ...input }: Props) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        id={inputId}
        {...input}
        className={[
          'w-full rounded-xl border border-white/10 bg-surface px-4 py-3',
          'text-ink placeholder:text-muted/60',
          'outline-none transition-colors focus:border-link focus:ring-2 focus:ring-link/30',
          mono ? 'font-mono' : '',
        ].join(' ')}
      />
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}
