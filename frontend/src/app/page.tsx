'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import { downloadExcel } from '@/lib/excel'

type Transcription = {
  id: string
  text: string | null
  formatted: string | null
  user_name: string
  created_at: string
  audio_path: string | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HomePage() {
  const router = useRouter()
  const [history, setHistory] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openFormattedId, setOpenFormattedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [splash, setSplash] = useState<'visible' | 'fading' | 'hidden'>('visible')
  const [headerHeight, setHeaderHeight] = useState(61)

  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const update = () => setHeaderHeight(header.getBoundingClientRect().height)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(header)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkoutType = params.get('checkout')
    if (checkoutType === 'success' || checkoutType === 'credit') {
      const returnPath = localStorage.getItem('stripe_return_path') ?? '/'
      localStorage.removeItem('stripe_return_path')
      const paymentType = checkoutType === 'success' ? 'subscription' : 'credit'
      sessionStorage.setItem('payment_banner', JSON.stringify({ type: paymentType, path: returnPath }))

      if (returnPath !== '/') {
        window.location.replace(returnPath)
      } else {
        window.history.replaceState({}, '', '/')
        window.dispatchEvent(new Event('payment_banner_ready'))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/start')
      return
    }
    const fetchPromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history`, {
      headers: authHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`エラー: ${res.status}`)
        return res.json()
      })
      .then((data) => setHistory(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 900))
    Promise.all([fetchPromise, minDelay]).then(() => {
      setSplash('fading')
      setTimeout(() => setSplash('hidden'), 350)
    })
  }, [router])

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      setHistory((prev) => prev.filter((h) => h.id !== id))
      setDeletingId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  return (
    <>
    {/* スプラッシュ画面 */}
    {splash !== 'hidden' && (
      <div
        className="fixed inset-0 z-50 bg-gray-50 flex flex-col items-center justify-center"
        style={{
          opacity: splash === 'fading' ? 0 : 1,
          transition: 'opacity 0.35s ease-out',
          pointerEvents: splash === 'fading' ? 'none' : 'auto',
        }}
      >
        <div className="relative w-32 h-32">
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ transform: 'rotate(-90deg)' }}
            viewBox="0 0 100 100"
          >
            <circle cx="50" cy="50" r="44" fill="none" stroke="#E5E7EB" strokeWidth="4" />
            <circle
              cx="50" cy="50" r="44"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="277"
              style={{ animation: 'splash-ring 0.85s cubic-bezier(0.4,0,0.2,1) forwards' }}
            />
          </svg>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-transparent_1.png"
            alt=""
            className="absolute inset-0 w-full h-full object-contain p-4"
            style={{ animation: 'splash-logo 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          />
        </div>
      </div>
    )}
    <main className="flex-1 bg-gray-50">

      {/* 認定調査を開始ボタン（AppHeader直下にスティッキー固定） */}
      <div
        className="sticky bg-blue-600 shadow-sm"
        style={{ top: headerHeight }}
      >
        <Link
          href="/assess"
          className="flex items-center justify-center gap-2 w-full px-4 py-4 text-base text-white font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          <span className="text-lg">＋</span> 認定調査を開始
        </Link>
      </div>

      {/* 調査履歴 */}
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">調査履歴</h2>

          {loading && <p className="text-sm text-gray-400 text-center py-8">読み込み中...</p>}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-3 w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-sm">調査履歴がありません</p>
              <p className="text-xs mt-1">「認定調査を開始」から始めてください</p>
            </div>
          )}

          <div className="space-y-3">
            {history.map((item) => {
              const isDeleting = deletingId === item.id

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  {/* ヘッダー */}
                  <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <p className="text-xs text-gray-400 shrink-0">{formatDate(item.created_at)}</p>
                      {item.user_name && (
                        <p className="text-xs text-gray-500 truncate">担当：{item.user_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isDeleting ? (
                        <>
                          <span className="text-xs text-gray-600">削除しますか？</span>
                          <button onClick={() => handleDelete(item.id)} className="rounded px-2.5 py-1 text-xs bg-red-500 text-white hover:bg-red-600 transition-colors">はい</button>
                          <button onClick={() => setDeletingId(null)} className="rounded px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">いいえ</button>
                        </>
                      ) : (
                        <button onClick={() => setDeletingId(item.id)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">削除</button>
                      )}
                    </div>
                  </div>

                  {/* 整形結果 */}
                  {item.formatted && (
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setOpenFormattedId(openFormattedId === item.id ? null : item.id)}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          {openFormattedId === item.id ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                          整形結果を{openFormattedId === item.id ? '閉じる' : '見る'}
                        </button>
                        <button
                          onClick={() => {
                            downloadExcel(item.formatted!, `認定調査_${formatDate(item.created_at)}.xlsx`)
                            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${item.id}/mark-downloaded`, {
                              method: 'POST',
                              headers: authHeaders(),
                            }).catch(() => {})
                          }}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700 transition-colors"
                        >Excelをダウンロード</button>
                      </div>
                      {openFormattedId === item.id && (
                        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                          {item.formatted}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 音声ダウンロード */}
                  {item.audio_path && (
                    <div className={`px-4 py-3 flex items-center gap-3${item.formatted ? ' border-t border-gray-100' : ''}`}>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${item.id}/audio`, {
                              headers: authHeaders(),
                            })
                            if (!res.ok) { alert('音声ファイルが見つかりません'); return }
                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            const ext = item.audio_path?.split('.').pop() ?? 'webm'
                            a.href = url
                            a.download = `録音_${formatDate(item.created_at)}.${ext}`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                          } catch {
                            alert('ダウンロードに失敗しました')
                          }
                        }}
                        className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-gray-700 transition-colors"
                      >音声をダウンロード</button>
                      <span className="text-xs text-gray-400">作成から5日間</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
    </main>
    </>
  )
}
