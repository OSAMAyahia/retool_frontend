import {
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  createAdminUser,
  createTransactionStatus,
  getAdminConfig,
  getAdminUsers,
  getStatuses,
  updateAdminConfig,
  updateAdminUser,
  updateTransactionStatus,
  type AdminConfig,
  type AdminUser,
  type CreateUserPayload,
} from '../services/api'
import type { TransactionStatus } from '../types/transaction'

type UserDraft = {
  displayName: string
  role: 'ADMIN' | 'USER'
  active: boolean
  password: string
}

type StatusDraft = {
  label: string
  description: string
  color: string
  sortOrder: number
}

const inputClass =
  'h-11 rounded-lg border border-[#dfe6f4] bg-white px-3 text-sm font-semibold text-[#172452] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15'

const buttonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60'

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

function userToDraft(user: AdminUser): UserDraft {
  return {
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    password: '',
  }
}

function statusToDraft(status: TransactionStatus): StatusDraft {
  return {
    label: status.label,
    description: status.description ?? '',
    color: status.color,
    sortOrder: status.sortOrder,
  }
}

export function AdminPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [statuses, setStatuses] = useState<TransactionStatus[]>([])
  const [config, setConfig] = useState<AdminConfig>({ odooMaxRetries: 3, odooRetryIntervalMinutes: 1 })
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({})
  const [statusDrafts, setStatusDrafts] = useState<Record<string, StatusDraft>>({})
  const [newUser, setNewUser] = useState<CreateUserPayload>({
    username: '',
    password: '',
    displayName: '',
    role: 'USER',
    active: true,
  })
  const [newStatus, setNewStatus] = useState({
    code: '',
    label: '',
    description: '',
    color: '#64748b',
    sortOrder: 100,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadAdminData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [nextUsers, nextConfig, nextStatuses] = await Promise.all([
        getAdminUsers(),
        getAdminConfig(),
        getStatuses(),
      ])

      setUsers(nextUsers)
      setConfig(nextConfig)
      setStatuses(nextStatuses)
      setUserDrafts(Object.fromEntries(nextUsers.map((item) => [item.id, userToDraft(item)])))
      setStatusDrafts(Object.fromEntries(nextStatuses.map((item) => [item.code, statusToDraft(item)])))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAdminData()
  }, [loadAdminData])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const created = await createAdminUser(newUser)
      setUsers((current) => [...current, created].sort((a, b) => a.username.localeCompare(b.username)))
      setUserDrafts((current) => ({ ...current, [created.id]: userToDraft(created) }))
      setNewUser({ username: '', password: '', displayName: '', role: 'USER', active: true })
      setMessage('User saved.')
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveUser = async (user: AdminUser) => {
    const draft = userDrafts[user.id]
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const updated = await updateAdminUser(user.id, {
        displayName: draft.displayName,
        role: draft.role,
        active: draft.active,
        password: draft.password || undefined,
      })
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setUserDrafts((current) => ({ ...current, [updated.id]: userToDraft(updated) }))
      setMessage('User updated.')
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const updated = await updateAdminConfig(config)
      setConfig(updated)
      setMessage('Config updated.')
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const created = await createTransactionStatus(newStatus)
      setStatuses((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder))
      setStatusDrafts((current) => ({ ...current, [created.code]: statusToDraft(created) }))
      setNewStatus({ code: '', label: '', description: '', color: '#64748b', sortOrder: 100 })
      setMessage('Status saved.')
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveStatus = async (status: TransactionStatus) => {
    const draft = statusDrafts[status.code]
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const updated = await updateTransactionStatus(status.code, draft)
      setStatuses((current) => current.map((item) => (item.code === updated.code ? updated : item)))
      setStatusDrafts((current) => ({ ...current, [updated.code]: statusToDraft(updated) }))
      setMessage('Status updated.')
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-4 text-[#172452] sm:px-6">
      <section className="mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[1840px] rounded-xl border border-[#dfe6f4] bg-white/90 px-5 py-7 shadow-[0_18px_50px_rgba(35,48,85,0.08)] sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#eaf2ff] text-[#2563eb]">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold text-[#111b45]">Admin</h1>
              <p className="mt-1 text-sm font-semibold text-[#617096]">Users, Odoo config, statuses</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              className={`${buttonClass} border border-[#dfe6f4] bg-white text-[#172452] hover:bg-[#f8fbff]`}
              to="/"
            >
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
              Dashboard
            </Link>
            <button
              className={`${buttonClass} border border-[#dfe6f4] bg-white text-[#172452] hover:bg-[#f8fbff]`}
              type="button"
              onClick={() => void loadAdminData()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
            <button
              className={`${buttonClass} bg-[#172452] text-white hover:bg-[#243566]`}
              type="button"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
              Logout
            </button>
          </div>
        </header>

        {message ? (
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <section className="rounded-xl border border-[#dfe6f4] bg-white">
            <div className="flex items-center gap-3 border-b border-[#dfe6f4] px-5 py-4">
              <Users className="h-5 w-5 text-[#2563eb]" aria-hidden="true" />
              <h2 className="text-lg font-extrabold text-[#111b45]">Users</h2>
            </div>

            <form className="grid gap-3 border-b border-[#dfe6f4] p-5 lg:grid-cols-[1fr_1fr_1fr_auto_auto]" onSubmit={handleCreateUser}>
              <input
                className={inputClass}
                placeholder="Username"
                value={newUser.username}
                onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="Display name"
                value={newUser.displayName}
                onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="Password"
                type="password"
                value={newUser.password}
                onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
              />
              <select
                className={inputClass}
                value={newUser.role}
                onChange={(event) =>
                  setNewUser((current) => ({ ...current, role: event.target.value as 'ADMIN' | 'USER' }))
                }
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button className={`${buttonClass} bg-[#2563eb] text-white hover:bg-[#1d4ed8]`} type="submit" disabled={isSaving}>
                <Plus className="h-5 w-5" aria-hidden="true" />
                Add
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] table-fixed text-left text-sm">
                <thead className="bg-[#f8fbff] text-[#627194]">
                  <tr>
                    <th className="px-5 py-3 font-bold">Username</th>
                    <th className="px-5 py-3 font-bold">Display name</th>
                    <th className="px-5 py-3 font-bold">Role</th>
                    <th className="px-5 py-3 font-bold">Active</th>
                    <th className="px-5 py-3 font-bold">New password</th>
                    <th className="px-5 py-3 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dfe6f4]">
                  {users.map((adminUser) => {
                    const draft = userDrafts[adminUser.id] ?? userToDraft(adminUser)

                    return (
                      <tr key={adminUser.id}>
                        <td className="px-5 py-4 font-extrabold text-[#15214b]">{adminUser.username}</td>
                        <td className="px-5 py-4">
                          <input
                            className={`${inputClass} w-full`}
                            value={draft.displayName}
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [adminUser.id]: { ...draft, displayName: event.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="px-5 py-4">
                          <select
                            className={`${inputClass} w-full`}
                            value={draft.role}
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [adminUser.id]: { ...draft, role: event.target.value as 'ADMIN' | 'USER' },
                              }))
                            }
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <input
                            className="h-5 w-5 accent-[#2563eb]"
                            type="checkbox"
                            checked={draft.active}
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [adminUser.id]: { ...draft, active: event.target.checked },
                              }))
                            }
                          />
                        </td>
                        <td className="px-5 py-4">
                          <input
                            className={`${inputClass} w-full`}
                            type="password"
                            value={draft.password}
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [adminUser.id]: { ...draft, password: event.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="px-5 py-4">
                          <button
                            className={`${buttonClass} bg-[#172452] text-white hover:bg-[#243566]`}
                            type="button"
                            onClick={() => void handleSaveUser(adminUser)}
                            disabled={isSaving}
                          >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Save
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-[#dfe6f4] bg-white">
            <div className="flex items-center gap-3 border-b border-[#dfe6f4] px-5 py-4">
              <SlidersHorizontal className="h-5 w-5 text-[#2563eb]" aria-hidden="true" />
              <h2 className="text-lg font-extrabold text-[#111b45]">Odoo Config</h2>
            </div>

            <form className="grid gap-5 p-5" onSubmit={handleSaveConfig}>
              <label className="grid gap-2 text-sm font-bold text-[#18234f]">
                Max retries
                <input
                  className={inputClass}
                  min={0}
                  type="number"
                  value={config.odooMaxRetries}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, odooMaxRetries: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-[#18234f]">
                Retry interval minutes
                <input
                  className={inputClass}
                  min={1}
                  type="number"
                  value={config.odooRetryIntervalMinutes}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      odooRetryIntervalMinutes: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <button className={`${buttonClass} bg-[#2563eb] text-white hover:bg-[#1d4ed8]`} type="submit" disabled={isSaving}>
                <Save className="h-5 w-5" aria-hidden="true" />
                Save Config
              </button>
            </form>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-[#dfe6f4] bg-white">
          <div className="flex items-center gap-3 border-b border-[#dfe6f4] px-5 py-4">
            <ShieldCheck className="h-5 w-5 text-[#2563eb]" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-[#111b45]">Statuses</h2>
          </div>

          <form className="grid gap-3 border-b border-[#dfe6f4] p-5 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto]" onSubmit={handleCreateStatus}>
            <input
              className={inputClass}
              placeholder="Code"
              value={newStatus.code}
              onChange={(event) => setNewStatus((current) => ({ ...current, code: event.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Label"
              value={newStatus.label}
              onChange={(event) => setNewStatus((current) => ({ ...current, label: event.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Description"
              value={newStatus.description}
              onChange={(event) => setNewStatus((current) => ({ ...current, description: event.target.value }))}
            />
            <input
              className="h-11 w-full rounded-lg border border-[#dfe6f4] bg-white p-1"
              type="color"
              value={newStatus.color}
              onChange={(event) => setNewStatus((current) => ({ ...current, color: event.target.value }))}
            />
            <button className={`${buttonClass} bg-[#2563eb] text-white hover:bg-[#1d4ed8]`} type="submit" disabled={isSaving}>
              <Plus className="h-5 w-5" aria-hidden="true" />
              Add
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-[1080px] table-fixed text-left text-sm">
              <thead className="bg-[#f8fbff] text-[#627194]">
                <tr>
                  <th className="px-5 py-3 font-bold">Code</th>
                  <th className="px-5 py-3 font-bold">Label</th>
                  <th className="px-5 py-3 font-bold">Description</th>
                  <th className="px-5 py-3 font-bold">Color</th>
                  <th className="px-5 py-3 font-bold">Order</th>
                  <th className="px-5 py-3 font-bold">Type</th>
                  <th className="px-5 py-3 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe6f4]">
                {statuses.map((status) => {
                  const draft = statusDrafts[status.code] ?? statusToDraft(status)

                  return (
                    <tr key={status.code}>
                      <td className="px-5 py-4 font-extrabold text-[#15214b]">{status.code}</td>
                      <td className="px-5 py-4">
                        <input
                          className={`${inputClass} w-full`}
                          value={draft.label}
                          onChange={(event) =>
                            setStatusDrafts((current) => ({
                              ...current,
                              [status.code]: { ...draft, label: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className={`${inputClass} w-full`}
                          value={draft.description}
                          onChange={(event) =>
                            setStatusDrafts((current) => ({
                              ...current,
                              [status.code]: { ...draft, description: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className="h-11 w-full rounded-lg border border-[#dfe6f4] bg-white p-1"
                          type="color"
                          value={draft.color}
                          onChange={(event) =>
                            setStatusDrafts((current) => ({
                              ...current,
                              [status.code]: { ...draft, color: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-5 py-4">
                        <input
                          className={`${inputClass} w-full`}
                          type="number"
                          value={draft.sortOrder}
                          onChange={(event) =>
                            setStatusDrafts((current) => ({
                              ...current,
                              [status.code]: { ...draft, sortOrder: Number(event.target.value) },
                            }))
                          }
                        />
                      </td>
                      <td className="px-5 py-4 font-bold text-[#617096]">
                        {status.systemStatus ? 'System' : 'Custom'}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          className={`${buttonClass} bg-[#172452] text-white hover:bg-[#243566]`}
                          type="button"
                          onClick={() => void handleSaveStatus(status)}
                          disabled={isSaving}
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Save
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}
