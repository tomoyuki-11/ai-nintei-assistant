'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated, setToken } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL

export default function IndividualRegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) router.replace('/')
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/individual/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setToken(data.token)
      router.push(data.is_first_login ? '/individual/plan-select' : '/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(
        msg === 'Failed to fetch' || msg === 'Load failed' || msg === ''
          ? 'サーバーに接続できませんでした。しばらくしてからお試しください。'
          : msg
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo-login.png"
        alt="AI認定調査アシスタント"
        className="w-[80vw] max-w-[360px] mb-8"
      />

      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">新規登録（個人）</h2>
          <p className="text-xs text-gray-400 mb-4">トライアルプランで14日間・3回まで無料でお試しいただけます</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="example@email.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="6文字以上"
                minLength={6}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '登録中...' : '無料で登録する'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              すでにアカウントをお持ちの方は{' '}
              <Link href="/individual/login" className="text-blue-600 hover:underline font-medium">
                ログインはこちら
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/start" className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
            ← 選択画面に戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
