'use client'

import { useRouter } from 'next/navigation'
import { removeToken } from '@/lib/auth'

export default function LogoutButton() {
  const router = useRouter()

  function handleLogout() {
    if (!confirm('ログアウトしますか？')) return
    removeToken()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
    >
      ログアウト
    </button>
  )
}
