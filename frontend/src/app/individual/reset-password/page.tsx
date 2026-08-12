'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-sm text-red-600 font-medium">無効なリンクです</p>
        <p className="text-xs text-gray-500">パスワードリセットのリンクが無効か、有効期限が切れています。</p>
        <Link href="/individual/forgot-password" className="inline-block text-sm text-blue-600 hover:underline">
          リセットメールを再送する
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません。')
      return
    }
    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください。')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'リセットに失敗しました。')
      }
      setSuccess(true)
      setTimeout(() => router.push('/individual/login'), 3000)
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

  if (success) {
    return (
      <div className="py-4 text-center space-y-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-900">パスワードを変更しました</p>
        <p className="text-xs text-gray-500">3秒後にログイン画面へ移動します...</p>
        <Link href="/individual/login" className="inline-block text-sm text-blue-600 hover:underline">
          今すぐログイン画面へ
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoFocus
          placeholder="8文字以上"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">パスワードを再入力</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="確認のため再入力"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? '変更中...' : 'パスワードを変更する'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
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
          <h2 className="text-base font-semibold text-gray-900 mb-4">パスワードの再設定</h2>
          <Suspense fallback={<p className="text-sm text-gray-500">読み込み中...</p>}>
            <ResetPasswordForm />
          </Suspense>
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
