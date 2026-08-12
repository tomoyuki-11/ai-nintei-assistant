'use client'

import { useState } from 'react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSent(true)
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
          <h2 className="text-base font-semibold text-gray-900 mb-2">パスワードをお忘れの方</h2>

          {sent ? (
            <div className="py-4 text-center space-y-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">メールを送信しました</p>
              <p className="text-xs text-gray-500">
                ご登録のメールアドレスにパスワードリセット用のリンクを送りました。<br />
                メールが届かない場合は迷惑メールフォルダをご確認ください。
              </p>
              <p className="text-xs text-gray-400">リンクの有効期限は30分です</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">
                ご登録のメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
              </p>
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
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? '送信中...' : 'リセットメールを送信'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link href="/individual/login" className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
            ← ログイン画面に戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
