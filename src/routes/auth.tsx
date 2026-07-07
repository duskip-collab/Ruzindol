import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { LogIn, Mail, Lock } from 'lucide-react'

import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/auth')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [isMounted, setIsMounted] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const resetForm = () => {
    setError(null)
    setMessage(null)
  }

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetForm()
    setBusy(true)

    if (!email) {
      setError('Zadaj e-mail.')
      setBusy(false)
      return
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Heslo musí mať aspoň 6 znakov.')
      setBusy(false)
      return
    }

    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        navigate({ to: '/' })
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        })
        if (signUpError) throw signUpError
        setMessage('Registrácia bola úspešná. Skontroluj svoj e-mail pre overenie.')
        setMode('signin')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Niečo sa pokazilo. Skús znova.')
    } finally {
      setBusy(false)
    }
  }

  const handleForgotSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetForm()
    setBusy(true)

    if (!email) {
      setError('Zadaj e-mail.')
      setBusy(false)
      return
    }

    try {
      const { error: forgotError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (forgotError) throw forgotError
      setMessage('Na tvoj e-mail bol odoslaný odkaz na obnovenie hesla.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Niečo sa pokazilo. Skús znova.')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    resetForm()
    setBusy(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

    if (oauthError) {
      setError(oauthError.message)
      setBusy(false)
    }
  }

  if (!isMounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.25)]">
          <div className="mb-8 flex items-center gap-3 text-slate-950">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Prihlásenie</h1>
              <p className="mt-1 text-sm text-slate-500">
                Prihlás sa do svojej lokálnej komunitnej aplikácie.
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setForgotOpen(false)
                resetForm()
              }}
              className={`rounded-full px-4 py-2 transition ${mode === 'signin' && !forgotOpen ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Prihlásiť sa
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setForgotOpen(false)
                resetForm()
              }}
              className={`rounded-full px-4 py-2 transition ${mode === 'signup' && !forgotOpen ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Registrovať sa
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotOpen(true)
                resetForm()
              }}
              className={`rounded-full px-4 py-2 transition ${forgotOpen ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Zabudnuté heslo
            </button>
          </div>

          {(error || message) && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {error || message}
            </div>
          )}

          {forgotOpen ? (
            <form onSubmit={handleForgotSubmit} className="grid gap-4">
              <label className="grid gap-2 text-sm text-slate-700">
                <span className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" /> E-mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tvoj@email.com"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? 'Odosielam...' : 'Obnoviť heslo'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="grid gap-4">
              {mode === 'signup' && (
                <label className="grid gap-2 text-sm text-slate-700">
                  <span className="flex items-center gap-2 font-medium">
                    Meno
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Tvoje meno"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              )}
              <label className="grid gap-2 text-sm text-slate-700">
                <span className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" /> E-mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tvoj@email.com"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                <span className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4" /> Heslo
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? 'Spracovávam...' : mode === 'signin' ? 'Prihlásiť sa' : 'Registrovať'}
              </button>
            </form>
          )}

          {!forgotOpen && (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  G
                </span>
                Pokračovať cez Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
