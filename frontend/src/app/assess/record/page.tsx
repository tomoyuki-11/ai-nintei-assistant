'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Inter } from 'next/font/google'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import { useRecording, getExtFromMime } from '../../components/RecordingContext'
import PlanLimitModal, { checkPlanLimit, LimitPlan } from '../../components/PlanLimitModal'
import MarkdownText from '../../components/MarkdownText'

const inter = Inter({ subsets: ['latin'], weight: ['700'], variable: '--font-inter' })

export default function RecordPage() {
  const router = useRouter()
  const {
    isRecording, isPaused, isTranscribing,
    setText, recordingError, setRecordingError,
    pendingAudio, downloadableAudio, hasPendingRecovery,
    startRecording, stopRecording, pauseRecording, resumeRecording,
    transcribeRecording, retryTranscription, recoverAndTranscribe, discardRecovery,
    transcribeFile, transcribeByPath, downloadAudio, clearPendingAudio, clearRecording,
    getAudioUploadPromise, retryAudioUpload,
  } = useRecording()

  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

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
const [limitPlan, setLimitPlan] = useState<LimitPlan | null>(null)
  const [isPageHidden, setIsPageHidden] = useState(false)
  const [isOnline, setIsOnline] = useState(() => typeof window !== 'undefined' ? navigator.onLine : true)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle')
  const [showDiscardModal, setShowDiscardModal] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    setText('')
    window.scrollTo(0, 0)
  }, [router, setText])

  // オンライン/オフライン状態の監視
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => { setIsOnline(false); setUploadState('idle') }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // downloadableAudioがクリアされたらuploadStateをリセット
  useEffect(() => {
    if (!downloadableAudio) setUploadState('idle')
  }, [downloadableAudio])

  // 新しい録音開始時にuploadStateをリセット
  useEffect(() => {
    if (isRecording) setUploadState('idle')
  }, [isRecording])

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/.test(ua)
    setIsIOS(ios)
    setIsMobile(/iPhone|iPad|iPod|Android/.test(ua))
    setShowScreenWarning(ios)
  }, [])

  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return }
    if (isPaused || isPageHidden) return
    const id = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [isRecording, isPaused, isPageHidden])

  useEffect(() => {
    if (isRecording) return
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [isRecording])

  // 電話着信などでバックグラウンドになったとき録音・タイマーを自動停止、復帰時に再開
  useEffect(() => {
    if (!isRecording) return
    function handleVisibilityChange() {
      if (document.hidden) {
        setIsPageHidden(true)
        pauseRecording()
      } else {
        setIsPageHidden(false)
        resumeRecording()
        if ('wakeLock' in navigator) {
          type WakeLockNav = Navigator & { wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> } }
          ;(navigator as WakeLockNav).wakeLock.request('screen')
            .then(lock => { wakeLockRef.current = lock })
            .catch(() => {})
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      setIsPageHidden(false)
    }
  }, [isRecording, pauseRecording, resumeRecording])

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

  async function requestWakeLock() {
    if (isIOS) return
    try {
      if ('wakeLock' in navigator) {
        type WakeLockNav = Navigator & { wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> } }
        wakeLockRef.current = await (navigator as WakeLockNav).wakeLock.request('screen')
      }
    } catch {}
  }

  async function handleStartRecordingClick() {
    const blocked = await checkPlanLimit()
    if (blocked) { setLimitPlan(blocked); return }
    if (isIOS && !localStorage.getItem('autoLockConfirmed')) {
      setShowAutoLockModal(true)
      return
    }
    startRecording()
    requestWakeLock()
  }

  async function saveTranscription(text: string): Promise<string | null> {
    try {
      const audioPath = await getAudioUploadPromise()
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text, ...(audioPath ? { audio_path: audioPath } : {}) }),
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
        body: JSON.stringify({ text }),
      })
      if (res.status === 402) {
        setError(await res.text().catch(() => '') || '使用回数の上限に達しています。クレジットを購入するか、プランをアップグレードしてください。')
        return
      }
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      const data = await res.json()
      setResult(data.formatted)
      clearRecording()  // downloadableAudio を IndexedDB ごとクリアして次回表示に残らないようにする
      setPipelinePending(false)
      // 保存・課金（クライアントが結果を受け取った後に実行）
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/save-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text, formatted: data.formatted, id, save_text: false }),
      }).catch(() => {})
      window.dispatchEvent(new Event('planStatusChanged'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg === 'Load failed' || msg === 'Failed to fetch'
        ? 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
        : msg || '生成に失敗しました'
      )
    } finally {
      setIsFormatting(false)
    }
  }

  async function handleStopRecording() {
    await stopRecording()
    // UIがdownloadableAudioを検知してアップロードボタンを表示する
  }

  async function handleUpload() {
    setUploadState('uploading')
    const success = await retryAudioUpload()
    setUploadState(success ? 'done' : 'failed')
  }

  async function handleTranscribeAndFormat() {
    const audioPath = await getAudioUploadPromise()
    const currentText = audioPath
      ? await transcribeByPath(audioPath)
      : await transcribeRecording()
    if (!currentText.trim()) return
    localStorage.setItem('pipeline_pending', '1')
    localStorage.setItem('pipeline_text', currentText)
    setPipelinePending(true)
    const id = await saveTranscription(currentText)
    await formatText(currentText, id)
  }

  async function handleRecoverAndFormat() {
    const currentText = await recoverAndTranscribe()
    if (!currentText.trim()) return
    localStorage.setItem('pipeline_pending', '1')
    localStorage.setItem('pipeline_text', currentText)
    setPipelinePending(true)
    const id = await saveTranscription(currentText)
    await formatText(currentText, id)
  }

  async function handlePipelineRecoverAndFormat() {
    if (!downloadableAudio) return
    // 生成中断の場合は保存済みの文字起こしテキストを再利用（再API呼び出し不要）
    const savedText = localStorage.getItem('pipeline_text') || ''
    const text = savedText || await transcribeFile(downloadableAudio)
    if (!text.trim()) return
    // 新たに文字起こしした場合は次回リカバリのためにlocalStorageへ保存
    if (!savedText && text) localStorage.setItem('pipeline_text', text)
    // pipeline_pending・pipelinePendingはformatText成功時にクリアする（生成失敗時もバナーを維持するため）
    const id = await saveTranscription(text)
    await formatText(text, id)
  }

  async function handleRetryFormat() {
    const currentText = await retryTranscription()
    if (!currentText.trim()) return
    clearPendingAudio()
    // 生成失敗時に「処理が途中で中断されました」バナーで再試行できるようにする
    localStorage.setItem('pipeline_pending', '1')
    localStorage.setItem('pipeline_text', currentText)
    setPipelinePending(true)
    const id = await saveTranscription(currentText)
    await formatText(currentText, id)
  }

  function handleNewRecording() {
    setResult('')
    setError('')
    clearRecording()
  }

  const isBusy = isTranscribing || isFormatting

  return (
    <main className="min-h-screen bg-gray-50">

      {/* 録音中フルスクリーンオーバーレイ（iOS・Android共通） */}
      {isRecording && isMobile && (
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
            <div className={`w-5 h-5 rounded-full transition-colors duration-300 ${isPaused || isPageHidden ? 'bg-gray-600' : 'bg-red-500 animate-pulse'}`} />
          </div>
          <p className="text-gray-500 text-sm mb-14">{isPaused || isPageHidden ? '一時停止中' : '録音中'}</p>
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
          {isPageHidden ? (
            <p className="text-gray-500 text-sm mt-12">電話終了後に自動で再開します</p>
          ) : (
            !isPaused && (
              <p className="text-gray-500 text-lg mt-12">
                {isIOS ? '画面をオンのままにしてください' : '画面を閉じないでください'}
              </p>
            )
          )}
          <p className="text-gray-700 text-xs mt-4">録音が完了するまで画面を閉じたり、再読み込みしないでください</p>
        </div>
      )}

      {/* 文字起こし・生成中オーバーレイ */}
      {isBusy && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-200/80 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-xl px-8 py-8 mx-6 max-w-xs w-full flex flex-col items-center gap-5 ${isTranscribing ? 'bg-green-50' : 'bg-purple-50'}`}>
            <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900">
                AI {isTranscribing ? '文字起こし' : '生成'}中です
              </p>
              <p className="text-xs text-gray-400 mt-1">しばらくお待ちください...</p>
            </div>
            <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-amber-800">生成が完了するまでページを離れないでください</p>
              <p className="text-xs text-amber-600 mt-0.5">データが失われる可能性があります</p>
            </div>
          </div>
        </div>
      )}

      {/* 使用回数上限モーダル */}
      <PlanLimitModal limitPlan={limitPlan} onClose={() => setLimitPlan(null)} />

      {/* 破棄確認モーダル */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">録音データを破棄しますか？</p>
            <p className="text-xs text-gray-500 mb-5">破棄すると録音音声が削除されます。この操作は元に戻せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => { setShowDiscardModal(false); clearRecording(); setUploadState('idle') }}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm text-white font-medium hover:bg-red-600 transition-colors"
              >
                破棄する
              </button>
            </div>
          </div>
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
                  requestWakeLock()
                }}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm text-white font-medium hover:bg-red-600 transition-colors"
              >設定済み・録音開始</button>
            </div>
          </div>
        </div>
      )}

<div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">録音して生成</h1>
          {isBusy ? (
            <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium opacity-40 cursor-not-allowed">← 戻る</span>
          ) : (
            <Link href="/assess" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors">← 戻る</Link>
          )}
        </div>

        {/* リカバリバナー（録音中断） */}
        {hasPendingRecovery && !pendingAudio && !result && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4">
            <p className="text-xs font-medium text-orange-800 mb-1">前回の録音データが見つかりました</p>
            <p className="text-xs text-orange-700 mb-2">リロード前の録音音声が保存されています。どうしますか？</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleRecoverAndFormat} disabled={isBusy} className="rounded-full bg-orange-500 px-3 py-1 text-xs text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">生成する</button>
              <button onClick={() => { discardRecovery(); handleStartRecordingClick() }} disabled={isBusy} className="rounded-full border border-orange-300 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors">録音を再開</button>
              <button onClick={discardRecovery} disabled={isBusy} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">破棄</button>
            </div>
          </div>
        )}

        {/* リカバリバナー（文字起こし・生成中断） */}
        {pipelinePending && !!downloadableAudio && !result && !hasPendingRecovery && !isRecording && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4">
            <p className="text-xs font-medium text-orange-800 mb-1">処理が途中で中断されました</p>
            <p className="text-xs text-orange-700 mb-2">文字起こしまたは生成の途中でリロードされました。録音音声は保存されています。どうしますか？</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handlePipelineRecoverAndFormat} disabled={isBusy} className="rounded-full bg-orange-500 px-3 py-1 text-xs text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">生成する</button>
              <button onClick={() => { setPipelinePending(false); localStorage.removeItem('pipeline_pending'); localStorage.removeItem('pipeline_text'); handleStartRecordingClick() }} disabled={isBusy} className="rounded-full border border-orange-300 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors">録音を再開</button>
              <button onClick={() => { setPipelinePending(false); localStorage.removeItem('pipeline_pending'); localStorage.removeItem('pipeline_text'); clearRecording() }} disabled={isBusy} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors">破棄</button>
            </div>
          </div>
        )}

        {/* 文字起こし失敗時のリトライ */}
        {pendingAudio && !result && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4">
            {!isOnline ? (
              <>
                <p className="text-xs font-medium text-orange-800 mb-1">生成待ちのデータがあります</p>
                <p className="text-xs text-orange-700">オンラインになれば作業を再開できます</p>
              </>
            ) : uploadState === 'uploading' ? (
              <>
                <p className="text-xs font-medium text-orange-800 mb-1">生成待ちのデータをアップロード中です</p>
                <p className="text-xs text-orange-600">しばらくお待ちください...</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-orange-800 mb-2">録音済み音声があります</p>
                <div className="flex gap-2">
                  <button onClick={handleRetryFormat} disabled={isBusy} className="rounded-full bg-orange-500 px-3 py-1 text-xs text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">録音済み音声を文字起こし・生成する</button>
                  <button onClick={clearPendingAudio} disabled={isBusy} className="rounded-full border border-orange-300 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors">破棄</button>
                </div>
              </>
            )}
          </div>
        )}

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">生成結果</h2>
              <div className="flex items-center gap-2">
                {/* 音声ダウンロード（一時非表示）
                {downloadableAudio && (
                  <button onClick={downloadAudio} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                    音声DL (.{getExtFromMime(downloadableAudio.type)})
                  </button>
                )}
                */}
                <button onClick={() => downloadExcel(result)} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition-colors">
                  Excelをダウンロード
                </button>
              </div>
            </div>
            <MarkdownText className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 leading-relaxed" text={result} />
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
                  {isTranscribing ? '文字起こし中...' : 'AI生成中...'}
                </p>
                <p className="text-xs text-gray-400 mt-1">しばらくお待ちください</p>
              </div>
            )}

            {/* 録音UI / アップロード・文字起こしステップ */}
            {!isBusy && (
              <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
                {/* 録音完了後のアップロード→文字起こしステップ */}
                {!isRecording && downloadableAudio && !pipelinePending && !hasPendingRecovery && !pendingAudio ? (
                  <div className="space-y-5">
                    <p className="text-sm font-semibold text-gray-800">録音が完了しました</p>

                    {/* STEP 1: アップロード */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-400 tracking-wide">STEP 1 — 音声をアップロード</p>
                      {uploadState === 'done' ? (
                        <p className="text-sm text-green-600 font-medium">✓ アップロード完了</p>
                      ) : uploadState === 'uploading' ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          アップロード中...
                        </div>
                      ) : (
                        <>
                          {uploadState === 'failed' && (
                            <p className="text-xs text-red-600 mb-1">アップロードに失敗しました。再度お試しください。</p>
                          )}
                          {!isOnline && (
                            <p className="text-xs text-orange-600 mb-1">オフラインです。オンラインに戻ったらアップロードしてください。</p>
                          )}
                          <button
                            onClick={handleUpload}
                            disabled={!isOnline}
                            className="flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2.5 text-sm text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            音声をアップロード
                          </button>
                          <p className="text-xs text-gray-400 mt-1">Wi-Fi または電波の安定した環境でアップロードしてください</p>
                        </>
                      )}
                    </div>

                    {/* STEP 2: 文字起こし・生成（アップロード完了後に表示） */}
                    {uploadState === 'done' && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-400 tracking-wide">STEP 2 — 文字起こし・生成</p>
                        <button
                          onClick={handleTranscribeAndFormat}
                          className="flex items-center gap-2 rounded-full bg-green-500 px-5 py-2.5 text-sm text-white font-medium hover:bg-green-600 transition-colors"
                        >
                          文字起こし・生成する
                        </button>
                        <p className="text-xs text-gray-400 mt-1">1時間の音声の場合、完了まで5〜6分ほどかかります</p>
                      </div>
                    )}

                    {/* サブアクション */}
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                      {/* 音声ダウンロード（一時非表示）
                      <button onClick={async () => {
                        try { await downloadAudio() }
                        catch (e) { setError(`ダウンロード失敗: ${e instanceof Error ? e.message : String(e)}`) }
                      }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                        音声をダウンロード (.{getExtFromMime(downloadableAudio.type)}) [{(downloadableAudio.size / 1024 / 1024).toFixed(1)}MB]
                      </button>
                      */}
                      <button onClick={() => setShowDiscardModal(true)} className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors">
                        破棄
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 通常の録音UI */
                  <div>
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
                      <p className="text-xs text-gray-400 mt-3">録音停止後、音声のアップロードと文字起こし・生成を手動で行えます</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
