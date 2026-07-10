'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import PlanLimitModal, { checkPlanLimit, LimitPlan } from '../../components/PlanLimitModal'

export default function TextPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [isFormatting, setIsFormatting] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [limitPlan, setLimitPlan] = useState<LimitPlan | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) router.push('/start')
    const saved = localStorage.getItem('text_draft')
    if (saved) setText(saved)
    window.scrollTo(0, 0)
  }, [router])

  useEffect(() => {
    if (text) localStorage.setItem('text_draft', text)
  }, [text])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(t)
  }, [error])

  async function handleFormat() {
    if (!text.trim()) return
    const blocked = await checkPlanLimit()
    if (blocked) { setLimitPlan(blocked); return }
    setIsFormatting(true)
    setError('')
    const controller = new AbortController()
    abortControllerRef.current = controller
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      if (res.status === 402) {
        setError(await res.text().catch(() => '') || '使用回数の上限に達しています。クレジットを購入するか、プランをアップグレードしてください。')
        return
      }
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      const data = await res.json()
      setResult(data.formatted)
      localStorage.removeItem('text_draft')
      // 保存・課金（クライアントが結果を受け取った後に実行）
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/save-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text, formatted: data.formatted, save_text: true }),
      }).catch(() => {})
      window.dispatchEvent(new Event('planStatusChanged'))
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : ''
      setError(msg === 'Load failed' || msg === 'Failed to fetch'
        ? 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
        : msg || '整形に失敗しました'
      )
    } finally {
      setIsFormatting(false)
      abortControllerRef.current = null
    }
  }

  function handleOpenCancelModal() {
    abortControllerRef.current?.abort()
    setShowCancelModal(true)
  }

  function handleCancelConfirm() {
    setShowCancelModal(false)
  }

  function handleReset() {
    setText('')
    setResult('')
    setError('')
    localStorage.removeItem('text_draft')
  }

  return (
    <main className="min-h-screen bg-gray-50">

      {/* 使用回数上限モーダル */}
      <PlanLimitModal limitPlan={limitPlan} onClose={() => setLimitPlan(null)} />

      {/* キャンセル確認モーダル */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">整形をキャンセルしました</p>
            <p className="text-xs text-gray-500 mb-5">もう一度実行する場合は「AI整形を実行」を押してください。</p>
            <button onClick={handleCancelConfirm} className="w-full rounded-lg bg-gray-700 px-4 py-2 text-sm text-white font-medium hover:bg-gray-800 transition-colors">閉じる</button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">テキストを貼り付けて整形</h1>
          {isFormatting ? (
            <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium opacity-40 cursor-not-allowed">← 戻る</span>
          ) : (
            <Link href="/assess" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors">← 戻る</Link>
          )}
        </div>

        {/* エラー */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start justify-between gap-2 mb-4">
            <span>{error}</span>
            <button onClick={() => setError('')} className="shrink-0 text-red-400 hover:text-red-600 text-base leading-none">✕</button>
          </div>
        )}

        {/* 整形結果 */}
        {result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">整形結果</h2>
              <button onClick={() => downloadExcel(result)} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition-colors">
                Excelをダウンロード
              </button>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
            <button onClick={handleReset} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              新しいテキストを整形する
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="面談の内容を貼り付けてください..."
                rows={12}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <button
                onClick={handleFormat}
                disabled={isFormatting || !text.trim()}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isFormatting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    AI整形中...
                  </span>
                ) : 'AI整形を実行'}
              </button>
              {isFormatting && (
                <button
                  onClick={handleOpenCancelModal}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
