'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { removeToken, getTokenPayload } from '@/lib/auth'

export default function TopNav() {
  const router = useRouter()
  const payload = getTokenPayload()
  const isAdmin = payload?.role === 'admin'

  function handleLogout() {
    if (!confirm('ログアウトしますか？')) return
    removeToken()
    router.push('/start')
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/history"
        className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
      >
        履歴を見る
      </Link>
      {isAdmin && (
        <Link
          href="/staff"
          className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          スタッフ管理
        </Link>
      )}
      <button
        onClick={handleLogout}
        className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
      >
        ログアウト
      </button>
    </div>
  )
}
