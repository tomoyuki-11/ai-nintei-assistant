export function getSuperAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('superadmin_token')
}

export function setSuperAdminToken(token: string): void {
  localStorage.setItem('superadmin_token', token)
}

export function removeSuperAdminToken(): void {
  localStorage.removeItem('superadmin_token')
}

export function superAdminHeaders(): Record<string, string> {
  const token = getSuperAdminToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
