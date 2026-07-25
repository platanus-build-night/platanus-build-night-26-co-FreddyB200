import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIdentity } from '../lib/identity'
import Field from '../components/Field'
import TopBar from '../components/TopBar'
import type { OnboardInput } from '../lib/types'

const EMPTY: OnboardInput = { name: '', github: '', linkedin: '', whatsapp: '', building: '' }

/** Colombia primero: es el default mas probable para este evento, pero mucha
 * gente asume +57 sin decirlo — el selector lo hace explicito en vez de
 * depender de que cada quien lo escriba bien en texto libre. */
const WHATSAPP_COUNTRIES = [
  { code: '57', flag: '🇨🇴', label: 'CO +57' },
  { code: '1', flag: '🇺🇸', label: 'US/CA +1' },
  { code: '52', flag: '🇲🇽', label: 'MX +52' },
  { code: '54', flag: '🇦🇷', label: 'AR +54' },
  { code: '55', flag: '🇧🇷', label: 'BR +55' },
  { code: '56', flag: '🇨🇱', label: 'CL +56' },
  { code: '51', flag: '🇵🇪', label: 'PE +51' },
  { code: '34', flag: '🇪🇸', label: 'ES +34' },
]

export default function Onboard() {
  const { register } = useIdentity()
  const navigate = useNavigate()
  const [form, setForm] = useState<OnboardInput>(EMPTY)
  const [whatsappCountry, setWhatsappCountry] = useState(WHATSAPP_COUNTRIES[0].code)
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
      const whatsapp = form.whatsapp.trim() ? `${whatsappCountry}${form.whatsapp.trim()}` : ''
      await register({ ...form, whatsapp })
      navigate('/add', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <header className="mb-8">
          <h1 className="font-display text-4xl leading-tight font-medium text-ink">
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
          <p className="-mb-1 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
            Optional — so people can connect with you
          </p>
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
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">WhatsApp</span>
            <div className="flex gap-2">
              <select
                value={whatsappCountry}
                onChange={(e) => setWhatsappCountry(e.target.value)}
                aria-label="Country code"
                className="rounded-xl border border-border bg-surface px-2.5 py-3 font-mono text-sm text-ink outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/30"
              >
                {WHATSAPP_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} +{c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                value={form.whatsapp}
                onChange={set('whatsapp')}
                placeholder="300 123 4567"
                autoComplete="tel-national"
                className="w-full min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 font-mono text-ink placeholder:text-muted/60 outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/30"
              />
            </div>
            <span className="mt-1.5 block text-xs text-muted">
              Optional. Pick your country — just the local number after that, no need to type the
              prefix yourself.
            </span>
          </label>
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
            className="mt-2 rounded-xl bg-signal px-5 py-4 font-display text-base font-medium text-night transition-opacity disabled:opacity-40"
          >
            {saving ? 'Saving…' : "I'm in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          No password, no email. This browser remembers you.
        </p>
      </main>
    </div>
  )
}
