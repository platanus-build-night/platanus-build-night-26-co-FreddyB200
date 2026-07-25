import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIdentity } from '../lib/identity'
import Field from '../components/Field'
import type { OnboardInput } from '../lib/types'

const EMPTY: OnboardInput = { name: '', github: '', linkedin: '', building: '' }

export default function Onboard() {
  const { event, register } = useIdentity()
  const navigate = useNavigate()
  const [form, setForm] = useState<OnboardInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof OnboardInput) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || saving) return

    setSaving(true)
    setError(null)
    try {
      await register(form)
      navigate('/add', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <header className="mb-8">
        <p className="font-mono text-xs tracking-widest text-link uppercase">
          {event?.name ?? 'Tonight'}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight font-bold text-ink">
          Who are you?
        </h1>
        <p className="mt-3 text-sm text-muted">
          Tonight&rsquo;s photos find their way back to you — and so do the people you met.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field
          label="Name"
          value={form.name}
          onChange={set('name')}
          placeholder="Ada Lovelace"
          autoComplete="name"
          required
          autoFocus
        />
        <Field
          label="GitHub"
          value={form.github}
          onChange={set('github')}
          placeholder="adalovelace"
          hint="So people can actually find you tomorrow."
          autoCapitalize="none"
          autoCorrect="off"
          mono
        />
        <Field
          label="LinkedIn"
          value={form.linkedin}
          onChange={set('linkedin')}
          placeholder="in/adalovelace"
          hint="Optional."
          autoCapitalize="none"
          autoCorrect="off"
          mono
        />
        <Field
          label="What are you building?"
          value={form.building}
          onChange={set('building')}
          placeholder="A compiler for the Analytical Engine"
        />

        {error ? (
          <p role="alert" className="rounded-xl bg-signal/10 px-4 py-3 text-sm text-signal">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!form.name.trim() || saving}
          className="mt-2 rounded-xl bg-signal px-5 py-4 font-display text-base font-bold text-night transition-opacity disabled:opacity-40"
        >
          {saving ? 'Saving…' : "I'm in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        No password, no email. This browser remembers you.
      </p>
    </main>
  )
}
