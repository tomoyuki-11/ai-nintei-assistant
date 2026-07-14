'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authHeaders, getTokenPayload, isAuthenticated } from '@/lib/auth'

const APP_VERSION = '0.1.0'
const CONTACT_EMAIL = 'tomoyukiyasohara@gmail.com'

export default function SettingsPage() {
  const router = useRouter()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  const payload = getTokenPayload()

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    const p = getTokenPayload()
    if (p?.role !== 'admin' && p?.role !== 'individual') { router.push('/'); return }
  }, [router])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードが一致しません')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('パスワードは6文字以上にしてください')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      if (!res.ok) throw new Error(await res.text())
      setPasswordSaved(true)
      setShowPasswordForm(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 4000)
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'パスワードの変更に失敗しました')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">設定</h1>
        </div>

        <div className="space-y-6">

          {/* ── アカウント ───────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">アカウント</p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">

              {/* アカウント情報 */}
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-gray-800 mb-1">アカウント情報</p>
                <p className="text-xs text-gray-500">{payload?.name || 'ー'}</p>
              </div>

              {/* パスワード変更 */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">パスワード変更</p>
                  <button
                    onClick={() => {
                      setShowPasswordForm(!showPasswordForm)
                      setPasswordError('')
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {showPasswordForm ? 'キャンセル' : '変更する'}
                  </button>
                </div>
                {passwordSaved && (
                  <p className="mt-2 text-xs text-green-600 font-medium">パスワードを変更しました</p>
                )}
                {showPasswordForm && (
                  <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="現在のパスワード"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="新しいパスワード（6文字以上）"
                      minLength={6}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="新しいパスワード（確認）"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {passwordSaving ? '変更中...' : 'パスワードを変更する'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* ── サポート ─────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">サポート</p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center justify-between px-5 py-4 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>お問い合わせ</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </section>

          {/* ── 法的情報 ─────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">法的情報</p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {[
                { label: '利用規約', href: 'https://lp.ai-nintei-assistant.com/terms' },
                { label: 'プライバシーポリシー', href: 'https://lp.ai-nintei-assistant.com/privacypolicy' },
                { label: '特定商取引法に基づく表記', href: 'https://lp.ai-nintei-assistant.com/tokushoho' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-5 py-4 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>{label}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </section>

          {/* ── アプリ情報 ───────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">アプリ情報</p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-gray-700">バージョン情報</span>
                <span className="text-sm text-gray-400">v{APP_VERSION}</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}
