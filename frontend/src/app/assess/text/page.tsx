'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import PlanLimitModal, { checkPlanLimit, LimitPlan } from '../../components/PlanLimitModal'
import MarkdownText from '../../components/MarkdownText'

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
        : msg || '生成に失敗しました'
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
    window.scrollTo(0, 0)
  }

  return (
    <main className="min-h-screen bg-gray-50">

      {/* 使用回数上限モーダル */}
      <PlanLimitModal limitPlan={limitPlan} onClose={() => setLimitPlan(null)} />

      {/* AI生成中オーバーレイ */}
      {isFormatting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-200/80 backdrop-blur-sm">
          <style>{`
            @keyframes sphere-glow {
              0%, 100% { box-shadow: 0 0 14px 4px rgba(139,92,246,0.55), 0 0 28px 8px rgba(59,130,246,0.3); }
              50% { box-shadow: 0 0 26px 10px rgba(139,92,246,0.8), 0 0 52px 18px rgba(59,130,246,0.45); }
            }
            @keyframes sphere-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes sphere-spin-r {
              from { transform: rotate(0deg); }
              to { transform: rotate(-360deg); }
            }
          `}</style>
          <div className="rounded-2xl shadow-xl px-8 py-8 mx-6 max-w-xs w-full flex flex-col items-center gap-5 bg-purple-50">
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'radial-gradient(circle at 38% 32%, #93c5fd 0%, #3b82f6 28%, #1e40af 58%, #1e1b4b 100%)',
                animation: 'sphere-glow 2.5s ease-in-out infinite',
                overflow: 'hidden', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: '8%', left: '16%',
                  width: '42%', height: '28%', borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.04) 100%)',
                }}/>
                <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: 'sphere-spin 7s linear infinite', transformOrigin: '50% 50%' }}>
                  <line x1="50" y1="5" x2="90" y2="38" stroke="rgba(147,197,253,0.75)" strokeWidth="0.7"/>
                  <line x1="50" y1="5" x2="10" y2="38" stroke="rgba(147,197,253,0.75)" strokeWidth="0.7"/>
                  <line x1="90" y1="38" x2="72" y2="90" stroke="rgba(147,197,253,0.65)" strokeWidth="0.7"/>
                  <line x1="10" y1="38" x2="28" y2="90" stroke="rgba(147,197,253,0.65)" strokeWidth="0.7"/>
                  <line x1="72" y1="90" x2="28" y2="90" stroke="rgba(147,197,253,0.6)" strokeWidth="0.7"/>
                  <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(147,197,253,0.35)" strokeWidth="0.5"/>
                  <line x1="10" y1="38" x2="90" y2="62" stroke="rgba(147,197,253,0.4)" strokeWidth="0.5"/>
                  <line x1="90" y1="38" x2="10" y2="62" stroke="rgba(147,197,253,0.4)" strokeWidth="0.5"/>
                  <circle cx="50" cy="5" r="2.5" fill="rgba(186,230,253,1)"/>
                  <circle cx="90" cy="38" r="2" fill="rgba(186,230,253,0.9)"/>
                  <circle cx="10" cy="38" r="2" fill="rgba(186,230,253,0.9)"/>
                  <circle cx="72" cy="90" r="2" fill="rgba(186,230,253,0.9)"/>
                  <circle cx="28" cy="90" r="2" fill="rgba(186,230,253,0.9)"/>
                  <circle cx="50" cy="50" r="1.8" fill="rgba(186,230,253,0.7)"/>
                </svg>
                <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: 'sphere-spin-r 11s linear infinite', transformOrigin: '50% 50%', opacity: 0.75 }}>
                  <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(196,181,253,0.65)" strokeWidth="0.6"/>
                  <line x1="20" y1="14" x2="80" y2="86" stroke="rgba(196,181,253,0.55)" strokeWidth="0.6"/>
                  <line x1="80" y1="14" x2="20" y2="86" stroke="rgba(196,181,253,0.55)" strokeWidth="0.6"/>
                  <line x1="15" y1="24" x2="85" y2="76" stroke="rgba(196,181,253,0.4)" strokeWidth="0.5"/>
                  <line x1="85" y1="24" x2="15" y2="76" stroke="rgba(196,181,253,0.4)" strokeWidth="0.5"/>
                  <circle cx="5" cy="50" r="2" fill="rgba(216,180,254,0.95)"/>
                  <circle cx="95" cy="50" r="2" fill="rgba(216,180,254,0.95)"/>
                  <circle cx="20" cy="14" r="1.6" fill="rgba(216,180,254,0.85)"/>
                  <circle cx="80" cy="86" r="1.6" fill="rgba(216,180,254,0.85)"/>
                  <circle cx="80" cy="14" r="1.6" fill="rgba(216,180,254,0.85)"/>
                  <circle cx="20" cy="86" r="1.6" fill="rgba(216,180,254,0.85)"/>
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900">AI 生成中です</p>
              <p className="text-xs text-gray-400 mt-1">しばらくお待ちください...</p>
            </div>
            <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-amber-800">生成が完了するまでページを離れないでください</p>
              <p className="text-xs text-amber-600 mt-0.5">データが失われる可能性があります</p>
            </div>
          </div>
        </div>
      )}

      {/* キャンセル確認モーダル */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">生成をキャンセルしました</p>
            <p className="text-xs text-gray-500 mb-5">もう一度実行する場合は「AI生成を実行」を押してください。</p>
            <button onClick={handleCancelConfirm} className="w-full rounded-lg bg-gray-700 px-4 py-2 text-sm text-white font-medium hover:bg-gray-800 transition-colors">閉じる</button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">テキストを貼り付けて生成</h1>
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

        {/* 生成結果 */}
        {result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">生成結果</h2>
              <button onClick={() => downloadExcel(result)} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition-colors">
                Excelをダウンロード
              </button>
            </div>
            <MarkdownText className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 leading-relaxed" text={result} />
            <button onClick={handleReset} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              新しいテキストを生成する
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
                    AI生成中...
                  </span>
                ) : '生成する'}
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
