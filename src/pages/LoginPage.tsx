import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')

    const { error: err } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password })

    setLoading(false)
    if (err) setError(err.message)
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
          <h2 className="mb-1 text-sm font-semibold text-white">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {mode === 'signin' ? 'Welcome back.' : 'Set up your Datum account.'}
          </p>

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
            <input
              type="password"
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50"
            >
              {loading
                ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
              className="text-amber-400 hover:text-amber-300"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
