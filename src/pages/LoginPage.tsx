import { LockKeyhole, LogIn } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Login failed'
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const loggedInUser = await login(username, password)
      const next = searchParams.get('next')
      navigate(next || (loggedInUser.role === 'ADMIN' ? '/admin' : '/'), { replace: true })
    } catch (loginError) {
      setError(errorMessage(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fc] px-4 text-[#172452]">
      <section className="w-full max-w-md rounded-xl border border-[#dfe6f4] bg-white px-7 py-8 shadow-[0_18px_50px_rgba(35,48,85,0.08)]">
        <div className="mb-7 flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#eaf2ff] text-[#2563eb]">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-[#111b45]">Admin Login</h1>
            <p className="mt-1 text-sm font-medium text-[#617096]">Retool Odoo access</p>
          </div>
        </div>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-bold text-[#18234f]">
            Username
            <input
              className="h-12 rounded-lg border border-[#dfe6f4] px-4 text-sm font-medium outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#18234f]">
            Password
            <input
              className="h-12 rounded-lg border border-[#dfe6f4] px-4 text-sm font-medium outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#172452] px-5 text-sm font-extrabold text-white transition hover:bg-[#243566] disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            <LogIn className="h-5 w-5" aria-hidden="true" />
            Sign in
          </button>
        </form>
      </section>
    </main>
  )
}
