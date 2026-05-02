import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 shadow-lg">
            <span className="text-2xl font-bold text-surface">D</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-white">Datum</h1>
            <p className="mt-0.5 text-sm text-gray-400">Project task manager</p>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-muted p-6 shadow-xl">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-white">Check your email</h2>
              <p className="mt-2 text-sm text-gray-400">
                We sent a magic link to <strong className="text-gray-300">{email}</strong>.
                Click it to sign in.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-4 text-sm text-amber-400 hover:text-amber-300"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-sm font-semibold text-white">Sign in with email</h2>
              <p className="mb-4 text-xs text-gray-500">No password needed — we'll send a link.</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
