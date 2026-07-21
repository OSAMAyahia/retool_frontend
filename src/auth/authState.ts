import { createContext } from 'react'
import type { AdminUser } from '../services/api'

export interface AuthContextValue {
  user: AdminUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<AdminUser>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
