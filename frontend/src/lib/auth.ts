export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function setToken(token: string): void {
  localStorage.setItem('token', token)
}

export function removeToken(): void {
  localStorage.removeItem('token')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getTokenPayload(): { sub: string; org_id: string; role: string; name: string } | null {
  const token = getToken()
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}
