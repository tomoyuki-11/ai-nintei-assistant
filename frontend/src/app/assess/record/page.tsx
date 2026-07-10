'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Inter } from 'next/font/google'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import { useRecording, getExtFromMime } from '../../components/RecordingContext'

const inter = Inter({ subsets: ['latin'], weight: ['700'], variable: '--font-inter' })

export default function RecordPage() {
  const router = useRouter()
  const {
    isRecording, isPaused, isTranscribing,
    setText, recordingError, setRecordingError,
    pendingAudio, downloadableAudio, hasPendingRecovery,
    startRecording, stopRecording, pauseRecording, resumeRecording,
    retryTranscription, recoverAndTranscribe, discardRecovery,
    transcribeFile, transcribeBlob, downloadAudio, clearPendingAudio, clearRecording,
  } = useRecording()

  const continuationRef = useRef<Blob | null>(null)

  const [result, setResult] = useState('')
  const [isFormatting, setIsFormatting] = useState(false)
  const [pipelinePending, setPipelinePending] = useState(() =>
    typeof window !== 'undefined' && !!localStorage.getItem('pipeline_pending')
  )
  const [error, setError] = useState('')
  const [isIOS, setIsIOS] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showScreenWarning, setShowScreenWarning] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [showAutoLockModal, setShowAutoLockModal] = useState(false)
  const [autoLockDontShow, setAutoLockDontShow] = useState(false)
  const [showDownloadHint, setShowDownloadHint] = useState(false)
  const [downloadHintDontShow, setDownloadHintDontShow] = useState(false)
  const savedIdRef = useRef<string | null>(null)
  const recordedThisSessionRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    setText('')
    window.scrollTo(0, 0)
  }, [router, setText])

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/.test(ua)
    setIsIOS(ios)
    setIsMobile(/iPhone|iPad|iPod|Android/.test(ua))
    setShowScreenWarning(ios)
  }, [])

  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return }
    if (isPaused) return
    const id = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [isRecording, isPaused])

  useEffect(() => {
    if (!isRecording) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [isRecording])

  useEffect(() => {
    if (!isRecording) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '録音中です。ページを離れると録音が停止します。'
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isRecording])

  useEffect(() => {
    if (!isRecording) return
    history.pushState(null, '', location.href)
    const handlePopState = () => history.pushState(null, '', location.href)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isRecording])

  useEffect(() => {
    if (downloadableAudio && recordedThisSessionRef.current && !localStorage.getItem('audioDownloadHintDismissed')) {
      setDownloadHintDontShow(false)
      setShowDownloadHint(true)
    }
  }, [downloadableAudio])

  useEffect(() => {
    if (recordingError) { setError(recordingError); setRecordingError('') }
  }, [recordingError, setRecordingError])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(t)
  }, [error])

  function timeParts(s: number) {
    return {
      h: String(Math.floor(s / 3600)).padStart(2, '0'),
      m: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
      s: String(s % 60).padStart(2, '0'),
    }
  }

  const Colon = () => (
    <div className="flex flex-col gap-1.5 pb-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
    </div>
  )

  function handleStartRecordingClick() {
    if (isIOS && !localStorage.getItem('autoLockConfirmed')) {
      setShowAutoLockModal(true)
      return
    }
    startRecording()
  }

  async function saveTranscription(text: string): Promise<string | null> {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text }),
      })
      if (res.ok) return (await res.json()).id
    } catch {}
    return null
  }

  async function formatText(text: string, id: string | null) {
    setIsFormatting(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text, id, save: true }),
      })
      if (res.status === 402) {
        setError(await res.text().catch(() => '') || '使用回数の上限に達しています。クレジットを購入するか、プランをアップグレードしてください。')
        return
      }
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      const data = await res.json()
      setResult(data.formatted)
      localStorage.removeItem('pipeline_pending')
      localStorage.removeItem('pipeline_text')
      setPipelinePending(false)
      setText('')
      window.dispatchEvent(new Event('planStatusChanged'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg === 'Load failed' || msg === 'Failed to fetch'
        ? 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
        : msg || '整形に失敗しました'
      )
    } finally {
      setIsFormatting(false)
    }
  }

  async function handleStopRecording() {
    recordedThisSessionRef.current = true
    const localCont = continuationRef.current
    continuationRef.current = null

    const newText = await stopRecording()

    if (localCont) {
      // 続きから録音：保存済み音声（localCont）を文字起こしして新録音テキストと結合
      const oldText = await transcribeBlob(localCont)
      const parts = [oldText.trim(), newText.trim()].filter(Boolean)
      const combinedText = parts.join('\n')
      if (!combinedText) return
      setText(combinedText)
      localStorage.setItem('pipeline_text', combinedText)
      const id = await saveTranscription(combinedText)
      savedIdRef.current = id
      await formatText(combinedText, id)
      return
    }

    if (!newText.trim()) return
    localStorage.setItem('pipeline_text', newText)
    const id = await saveTranscription(newText)
    savedIdRef.current = id
    await formatText(newText, id)
  }

  async function handleRecoverAndFormat() {
    const currentText = await recoverAndTranscribe()
    if (!currentText.trim()) return
    const id = await saveTranscription(currentText)
    await formatText(currentText, id)
  }

  async function handlePipelineRecoverAndFormat() {
    if (!downloadableAudio) return
    // 整形中断の場合は保存済みの文字起こしテキストを再利用（再API呼び出し不要）
    const savedText = localStorage.getItem('pipeline_text') || ''
    const text = savedText || await transcribeFile(downloadableAudio)
    if (!text.trim()) return
    setPipelinePending(false)
    localStorage.removeItem('pipeline_pending')
    localStorage.removeItem('pipeline_text')
    const id = await saveTranscription(text)
    savedIdRef.current = id
    await formatText(text, id)
  }

  async function handleRetryFormat() {
    const currentText = await retryTranscription()
    if (!currentText.trim()) return
    clearPendingAudio()
    const id = await saveTranscription(currentText)
    await formatText(currentText, id)
  }

  function handleNewRecording() {
    setResult('')
    setError('')
    savedIdRef.current = null
    clearRecording()
  }

  const isBusy = isTranscribing || isFormatting

  return (
    <main className="min-h-screen bg-gray-50">

      {/* iOS録音中フルスクリーンオーバーレイ */}
      {isRecording && isIOS && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center select-none">
          {(() => {
            const { h, m, s } = timeParts(recordingSeconds)
            return (
              <div className={`flex items-center gap-2 mb-14 ${inter.variable}`} style={{ fontFamily: '-apple-system, "SF Pro Display", BlinkMacSystemFont, var(--font-inter), system-ui, sans-serif' }}>
                <span className="text-gray-400 text-5xl font-light">{h}</span>
                <Colon />
                <span className="text-gray-400 text-5xl font-light">{m}</span>
                <Colon />
                <span className="text-gray-400 text-5xl font-light">{s}</span>
              </div>
            )
          })()}
          <div className="flex items-center justify-center mb-14">
            <div className={`w-5 h-5 rounded-full transition-colors duration-300 ${isPaused ? 'bg-gray-600' : 'bg-red-500 animate-pulse'}`} />
          </div>
          <p className="text-gray-500 text-sm mb-14">{isPaused ? '一時停止中' : '録音中'}</p>
          <div className="flex gap-10 items-center">
            <button onClick={handleStopRecording} className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center active:bg-gray-700 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="2" fill="white" /></svg>
            </button>
            <button onClick={isPaused ? resumeRecording : pauseRecording} className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center active:bg-gray-700 transition-colors">
              {isPaused ? (
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none"><path d="M1 1L15 9L1 17V1Z" fill="white" /></svg>
              ) : (
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                  <rect x="0" y="0" width="5" height="18" rx="1.5" fill="white" />
                  <rect x="9" y="0" width="5" height="18" rx="1.5" fill="white" />
                </svg>
              )}
            </button>
          </div>
          {showScreenWarning && !isPaused && (
            <p className="text-gray-500 text-lg mt-12">画面をオンのままにしてください</p>
          )}
          <p className="text-gray-700 text-xs mt-4">リロードすると録音が停止します</p>
        </div>
      )}

      {/* iOS 自動ロック確認モーダル */}
      {showAutoLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">録音前に確認してください</p>
            <p className="text-sm text-gray-600 mb-4">スリープ中は録音が停止します。長時間の録音には自動ロックをオフにすることをお勧めします。</p>
            <p className="text-xs bg-gray-100 rounded-lg px-3 py-2 text-gray-700 mb-5">設定 → 画面表示と明るさ → 自動ロック → なし</p>
            <label className="flex items-center gap-2 text-xs text-gray-500 mb-5 cursor-pointer">
              <input type="checkbox" checked={autoLockDontShow} onChange={(e) => setAutoLockDontShow(e.target.checked)} className="rounded" />
              次回から表示しない
            </label>
            <div className="flex gap-3">
              <button onClick={() => setShowAutoLockModal(false)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">閉じる</button>
              <button
                onClick={() => {
                  if (autoLockDontShow) localStorage.setItem('autoLockConfirmed', '1')
                  setShowAutoLockModal(false)
                  startRecording()
                }}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm text-white font-medium hover:bg-red-600 transition-colors"
              >設定済み・録音開始</button>
            </div>
          </div>
        </div>
      )}

      {/* 音声ダウンロードヒントモーダル */}
      {showDownloadHint && downloadableAudio && (() => {
        const ext = getExtFromMime(downloadableAudio.type)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">録音音声について</p>
              <p className="text-sm text-gray-600 mb-3">音声のダウンロードは任意です。整形はすでに完了しています。このページを閉じると音声はダウンロードできなくなります。</p>
              <p className="text-xs bg-gray-100 rounded-lg px-3 py-2 text-gray-600 mb-4">
                形式：<span className="font-medium">.{ext}</span>
                {ext === 'webm' && <span className="block mt-0.5">※ macOS標準では開けません。VLC などのプレーヤーをお使いください。</span>}
              </p>
              <label className="flex items-center gap-2 text-xs text-gray-500 mb-5 cursor-pointer">
                <input type="checkbox" checked={downloadHintDontShow} onChange={(e) => setDownloadHintDontShow(e.target.checked)} className="rounded" />
                次回から表示しない
              </label>
              <div className="flex gap-3">
                <button onClick={() => { if (downloadHintDontShow) localStorage.setItem('audioDownloadHintDismissed', '1'); setShowDownloadHint(false) }} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">閉じる</button>
                <button onClick={() => { if (downloadHintDontShow) localStorage.setItem('audioDownloadHintDismissed', '1'); setShowDownloadHint(false); downloadAudio() }} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors">ダウンロード</button>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">録音して整形</h1>
          {isBusy ? (
            <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium opacity-40 cursor-not-allowed">← 戻る</span>
          ) : (
            <Link href="/assess" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors">← 戻る</Link>
          )}
        </div>

        {/* リカバリバナー（録音中断） */}
        {hasPendingRecovery && !result && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4">
            <p className="text-xs font-medium text-orange-800 mb-1">前回の録音データが見つかりました</p>
            <p className="text-xs text-orange-700 mb-2">リロード前の録音音声が保存されています。どうしますか？</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleRecoverAndFormat} disabled={isBusy} className="rounded-full bg-orange-500 px-3 py-1 text-xs text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">整形する</button>
              <button onClick={startRecording} disabled={isBusy} className="rounded-full border border-orange-300 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors">録音を再開</button>
              <button onClick={discardRecovery} disabled={isBusy} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">破棄</button>
            </div>
          </div>
        )}

        {/* リカバリバナー（文字起こし・整形中断） */}
        {pipelinePending && !!downloadableAudio && !result && !hasPendingRecovery && !isRecording && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4">
            <p className="text-xs font-medium text-orange-800 mb-1">処理が途中で中断されました</p>
            <p className="text-xs text-orange-700 mb-2">文字起こしまたは整形の途中でリロードされました。録音音声は保存されています。どうしますか？</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handlePipelineRecoverAndFormat} disabled={isBusy} className="rounded-full bg-orange-500 px-3 py-1 text-xs text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">整形する</button>
              <button onClick={() => { continuationRef.current = downloadableAudio; setPipelinePending(false); startRecording() }} disabled={isBusy} className="rounded-full border border-orange-300 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors">録音を再開</button>
              <button onClick={() => { setPipelinePending(false); localStorage.removeItem('pipeline_pending'); localStorage.removeItem('pipeline_text'); clearRecording() }} disabled={isBusy} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">破棄</button>
            </div>
          </div>
        )}

        {/* 文字起こし失敗時のリトライ */}
        {pendingAudio && !result && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4">
            <p className="text-xs font-medium text-orange-800 mb-2">録音済み音声があります</p>
            <div className="flex gap-2">
              <button onClick={handleRetryFormat} disabled={isBusy} className="rounded-full bg-orange-500 px-3 py-1 text-xs text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">再度整形する</button>
              <button onClick={clearPendingAudio} disabled={isBusy} className="rounded-full border border-orange-300 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors">破棄</button>
            </div>
          </div>
        )}

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">整形結果</h2>
              <div className="flex items-center gap-2">
                {downloadableAudio && (
                  <button onClick={downloadAudio} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                    音声DL (.{getExtFromMime(downloadableAudio.type)})
                  </button>
                )}
                <button onClick={() => downloadExcel(result)} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition-colors">
                  Excelをダウンロード
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
            <button onClick={handleNewRecording} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              新しい録音を開始
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 処理中スピナー */}
            {isBusy && (
              <div className="rounded-xl bg-white border border-gray-200 p-8 text-center shadow-sm">
                <div className="inline-block w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-4" />
                <p className="text-sm font-medium text-gray-700">
                  {isTranscribing ? '文字起こし中...' : 'AI整形中...'}
                </p>
                <p className="text-xs text-gray-400 mt-1">しばらくお待ちください</p>
              </div>
            )}

            {/* 録音UI */}
            {!isBusy && (
              <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  {!isRecording ? (
                    <button onClick={handleStartRecordingClick} className="flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm text-white font-medium hover:bg-red-600 transition-colors">
                      <span className="inline-block w-3 h-3 rounded-full bg-white" /> 録音開始
                    </button>
                  ) : (
                    <button onClick={handleStopRecording} className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm text-white font-medium animate-pulse">
                      <span className="inline-block w-3 h-3 rounded-sm bg-white" /> 録音停止
                    </button>
                  )}
                  {isRecording && !isIOS && (
                    <button onClick={isPaused ? resumeRecording : pauseRecording} className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                      {isPaused ? '再開' : '一時停止'}
                    </button>
                  )}
                  {isRecording && <span className="text-xs text-red-500 font-medium animate-pulse">録音中...</span>}
                  {isRecording && showScreenWarning && <span className="text-xs text-orange-500 font-medium">⚠ 画面をオンのまま</span>}
                  {isRecording && isMobile && !isIOS && <span className="text-xs text-orange-500 font-medium">⚠ リロードで停止します</span>}
                </div>
                {!isRecording && (
                  <p className="text-xs text-gray-400 mt-3">録音停止後、自動で文字起こし・整形が行われます</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
