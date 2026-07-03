'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authHeaders, getTokenPayload, isAuthenticated } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL

type Staff = {
  id: string
  email: string
  role: string
  name: string
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export default function StaffPage() {
  const router = useRouter()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const payload = getTokenPayload()
  const myId = payload?.sub

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    const p = getTokenPayload()
    if (p?.role !== 'admin') { router.push('/'); return }
    loadStaff()
  }, [router])

  async function loadStaff() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/staff`, { headers: authHeaders() })
      if (!res.ok) throw new Error(await res.text())
      setStaff(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: loginId, password, role, name }),
      })
      if (!res.ok) throw new Error(await res.text())
      setName('')
      setLoginId('')
      setPassword('')
      setRole('member')
      setShowForm(false)
      loadStaff()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API}/api/staff/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(await res.text())
      setDeletingId(null)
      loadStaff()
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">スタッフ管理</h1>
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← ホームへ戻る
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* スタッフ追加ボタン */}
        <div className="mb-4">
          <button
            onClick={() => { setShowForm(!showForm); setFormError('') }}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition-colors"
          >
            {showForm ? 'キャンセル' : '+ スタッフを追加'}
          </button>
        </div>

        {/* 追加フォーム */}
        {showForm && (
          <div className="rounded-xl border border-green-200 bg-white p-5 shadow-sm mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">新規スタッフ登録</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名 *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="例：山田 太郎"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ログインID
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                  placeholder="例：yamada"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="6文字以上"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  権限
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="member"
                      checked={role === 'member'}
                      onChange={() => setRole('member')}
                      className="accent-green-600"
                    />
                    <span className="text-sm text-gray-700">一般スタッフ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      className="accent-green-600"
                    />
                    <span className="text-sm text-gray-700">管理者</span>
                  </label>
                </div>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '登録中...' : '登録する'}
              </button>
            </form>
          </div>
        )}

        {/* スタッフ一覧 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-600">
              スタッフ一覧 <span className="text-gray-400">({staff.length}名)</span>
            </span>
          </div>

          {loading ? (
            <p className="px-5 py-4 text-sm text-gray-400">読み込み中...</p>
          ) : staff.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">スタッフが登録されていません</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {s.name || s.email}
                    </p>
                    {s.name && (
                      <p className="text-xs text-gray-400">ID: {s.email}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {s.role === 'admin' ? '管理者' : 'スタッフ'}
                      </span>
                      <span className="text-xs text-gray-400">登録: {formatDate(s.created_at)}</span>
                      {s.id === myId && (
                        <span className="text-xs text-blue-500">(あなた)</span>
                      )}
                    </div>
                  </div>

                  {s.id !== myId && (
                    deletingId === s.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">削除しますか？</span>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="rounded px-2.5 py-1 text-xs bg-red-500 text-white hover:bg-red-600"
                        >
                          はい
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="rounded px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          いいえ
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(s.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                      >
                        削除
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
