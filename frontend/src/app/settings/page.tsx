'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authHeaders, getTokenPayload, isAuthenticated } from '@/lib/auth'

type SaveMode = 'auto' | 'confirm'

type Settings = {
  transcription_save_mode: SaveMode
  formatted_save_mode: SaveMode
}

const MODE_LABELS: Record<SaveMode, string> = {
  auto: '自動保存',
  confirm: '確認モーダル',
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    const payload = getTokenPayload()
    if (payload?.role !== 'admin') { router.push('/'); return }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings`, {
      headers: authHeaders(),
    })
      .then((res) => { if (!res.ok) throw new Error(`エラー: ${res.status}`); return res.json() })
      .then((data) => setSettings(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">設定</h1>
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← ホームへ戻る
          </Link>
        </div>

        {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">{error}</div>
        )}

        {settings && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {/* 文字起こしの保存設定 */}
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-gray-800 mb-1">文字起こしの保存</p>
              <p className="text-xs text-gray-500 mb-3">録音停止後の文字起こし保存の動作を設定します</p>
              <div className="flex gap-3">
                {(['auto', 'confirm'] as SaveMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSettings({ ...settings, transcription_save_mode: mode })}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      settings.transcription_save_mode === mode
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
              {settings.transcription_save_mode === 'confirm' && (
                <p className="mt-2 text-xs text-gray-400">録音停止後に「保存しますか？」の確認を表示します。「いいえ」を選択すると保存されません。</p>
              )}
            </div>

            {/* 整形結果の保存設定 */}
            <div className="px-5 py-5">
              <p className="text-sm font-semibold text-gray-800 mb-1">整形結果の保存</p>
              <p className="text-xs text-gray-500 mb-3">AI整形実行後の整形結果保存の動作を設定します</p>
              <div className="flex gap-3">
                {(['auto', 'confirm'] as SaveMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSettings({ ...settings, formatted_save_mode: mode })}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      settings.formatted_save_mode === mode
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
              {settings.formatted_save_mode === 'confirm' && (
                <p className="mt-2 text-xs text-gray-400">整形完了後に「保存しますか？」の確認を表示します。「いいえ」を選択すると保存されません。</p>
              )}
            </div>
          </div>
        )}

        {settings && (
          <div className="mt-6 flex items-center gap-3 justify-end">
            {saved && <span className="text-sm text-green-600 font-medium">保存しました</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
