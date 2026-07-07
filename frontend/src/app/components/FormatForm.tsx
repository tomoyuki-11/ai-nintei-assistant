'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import { useRecording } from './RecordingContext'

type Settings = {
  transcription_save_mode: 'auto' | 'confirm'
  formatted_save_mode: 'auto' | 'confirm'
}

type ConfirmState =
  | { type: 'transcription'; text: string }
  | { type: 'formatted'; text: string; formatted: string; id: string | null }
  | null

export default function FormatForm() {
  const router = useRouter()
  const { isRecording, isPaused, isTranscribing, text, setText, recordingError, setRecordingError, pendingAudio, startRecording, stopRecording, pauseRecording, resumeRecording, transcribeFile, retryTranscription, clearPendingAudio, clearRecording } = useRecording()
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [settings, setSettings] = useState<Settings>({ transcription_save_mode: 'auto', formatted_save_mode: 'auto' })
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [transcriptionDeclined, setTranscriptionDeclined] = useState(false)
  const [showFormatConfirm, setShowFormatConfirm] = useState(false)
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showScreenWarning, setShowScreenWarning] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/.test(ua)
    setIsIOS(ios)
    // 警告はSafari（Chrome等を除く）またはPWAのみ
    // iOSは全ブラウザ（Safari・Chrome等）でスリープ時に音声セッションが中断されるため警告表示
    setShowScreenWarning(ios)
  }, [])

  useEffect(() => {
    if (!isRecording) { setRecordingSeconds(0); return }
    if (isPaused) return
    const id = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [isRecording, isPaused])

  function formatTime(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  useEffect(() => {
    return () => { clearRecording() }
  }, [clearRecording])

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings`, { headers: authHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setSettings(data) })
      .catch(() => {})
  }, [router])

  // コンテキストのエラーをローカルのerrorに表示（8秒後に自動消去）
  useEffect(() => {
    if (recordingError) {
      setError(recordingError)
      setRecordingError('')
    }
  }, [recordingError, setRecordingError])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(t)
  }, [error])

  function showSaveMessage(msg: string) {
    setSaveMessage(msg)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  async function handleStopRecording() {
    const currentText = await stopRecording()
    if (!currentText.trim()) return
    if (settings.transcription_save_mode === 'confirm') {
      setConfirm({ type: 'transcription', text: currentText })
    } else {
      await saveTranscription(currentText)
    }
  }

  async function saveTranscription(currentText: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: currentText }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedId(data.id)
        showSaveMessage('文字起こしを保存しました')
      }
    } catch (e) {
      console.error('Failed to save transcription:', e)
    }
  }

  async function handleSubmit() {
    if (!text.trim()) return

    setLoading(true)
    setError('')
    setResult('')

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          text,
          id: savedId,
          save: settings.formatted_save_mode === 'auto',
          save_text: !transcriptionDeclined,
        }),
      })

      if (!response.ok) {
        const msg = await response.text().catch(() => '')
        throw new Error(msg || `エラー: ${response.status}`)
      }

      const data = await response.json()
      setResult(data.formatted)
      window.dispatchEvent(new Event('planStatusChanged'))

      if (settings.formatted_save_mode === 'confirm') {
        setConfirm({ type: 'formatted', text, formatted: data.formatted, id: savedId })
      } else {
        setSavedId(null)
        clearRecording()
        showSaveMessage('整形結果を保存しました')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmYes() {
    if (!confirm) return
    if (confirm.type === 'transcription') {
      setConfirm(null)
      await saveTranscription(confirm.text)
    } else {
      const payload = { text: confirm.text, formatted: confirm.formatted, id: confirm.id, save_text: !transcriptionDeclined }
      setConfirm(null)
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/save-result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        })
        setSavedId(null)
        clearRecording()
        showSaveMessage('整形結果を保存しました')
      } catch (e) {
        console.error('Failed to save result:', e)
      }
    }
  }

  function handleConfirmNo() {
    if (confirm?.type === 'transcription') setTranscriptionDeclined(true)
    setConfirm(null)
  }

  return (
    <div className="space-y-6">
      {/* iOS録音中フルスクリーンオーバーレイ（節電・OLED最適化） */}
      {isRecording && isIOS && (
        <div className="fixed inset-0 z-200 bg-black flex flex-col items-center justify-center select-none">
          {/* タイマー */}
          <p className="text-white text-5xl font-mono font-thin tracking-[0.15em] mb-14">
            {formatTime(recordingSeconds)}
          </p>

          {/* 録音インジケーター */}
          <div className="flex items-center justify-center mb-14">
            <div className={`w-5 h-5 rounded-full transition-colors duration-300 ${isPaused ? 'bg-gray-600' : 'bg-red-500 animate-pulse'}`} />
          </div>

          {/* ステータス */}
          <p className="text-gray-500 text-xs tracking-[0.3em] uppercase mb-14">
            {isPaused ? '一時停止中' : '録音中'}
          </p>

          {/* ボタン */}
          <div className="flex gap-10 items-center">
            <button
              onClick={handleStopRecording}
              className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center active:bg-gray-700 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect width="16" height="16" rx="2" fill="white" />
              </svg>
            </button>
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center active:bg-gray-700 transition-colors"
            >
              {isPaused ? (
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
                  <path d="M1 1L15 9L1 17V1Z" fill="white" />
                </svg>
              ) : (
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                  <rect x="0" y="0" width="5" height="18" rx="1.5" fill="white" />
                  <rect x="9" y="0" width="5" height="18" rx="1.5" fill="white" />
                </svg>
              )}
            </button>
          </div>

          {showScreenWarning && !isPaused && (
            <p className="text-gray-700 text-xs mt-12">⚠ 画面をオンのままにしてください</p>
          )}
        </div>
      )}

      {/* AI整形確認モーダル */}
      {showFormatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">AI整形を実行しますか？</p>
            <p className="text-xs text-gray-500 mb-5">入力されたテキストをAIが認定調査票形式に整形します。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFormatConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => { setShowFormatConfirm(false); handleSubmit() }}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 音声ファイルアップロード確認モーダル */}
      {pendingUploadFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">音声ファイルをアップロードし文字起こしを行いますか？</p>
            <p className="text-xs text-gray-500 mb-5 truncate">ファイル：{pendingUploadFile.name}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setPendingUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  const file = pendingUploadFile
                  setPendingUploadFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                  await transcribeFile(file)
                }}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認モーダル */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              {confirm.type === 'transcription' ? '文字起こしを保存しますか？' : '整形結果を保存しますか？'}
            </p>
            <p className="text-xs text-gray-500 mb-5">
              「いいえ」を選択すると保存されません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmNo}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                いいえ
              </button>
              <button
                onClick={handleConfirmYes}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
              >
                はい
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-3 mb-2">
          {isTranscribing ? (
            <button
              disabled
              className="flex items-center gap-1.5 rounded-full bg-gray-400 px-4 py-1.5 text-sm text-white font-medium cursor-not-allowed"
            >
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> 文字起こし中...
            </button>
          ) : !isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-1.5 text-sm text-white font-medium hover:bg-red-600 transition-colors"
            >
              <span className="inline-block w-3 h-3 rounded-full bg-white" /> 録音開始
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm text-white font-medium animate-pulse"
            >
              <span className="inline-block w-3 h-3 rounded-sm bg-white" /> 録音停止
            </button>
          )}
          {isRecording && (
            <span className="text-xs text-red-500 font-medium animate-pulse">録音中...</span>
          )}
          {isRecording && showScreenWarning && (
            <span className="text-xs text-orange-500 font-medium">⚠ 画面をオンのままにしてください</span>
          )}
          {isTranscribing && (
            <span className="text-xs text-gray-500 font-medium">Whisperで文字起こし中...</span>
          )}
          {saveMessage && (
            <span className="text-xs text-green-600 font-medium">✓ {saveMessage}</span>
          )}
        </div>
        {/* 音声ファイルアップロード / 録音済み音声リトライ */}
        <div className="flex items-center gap-2 mt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setPendingUploadFile(file)
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTranscribing}
            className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            音声ファイルをアップロード
          </button>
          {pendingAudio && (
            <button
              onClick={async () => { await retryTranscription() }}
              disabled={isTranscribing}
              className="flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              録音済み音声を文字起こし
            </button>
          )}
          {pendingAudio && (
            <button
              onClick={clearPendingAudio}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              破棄
            </button>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setSavedId(null) }}
          placeholder="面談の文字起こしテキストを貼り付けるか、録音ボタンを押して話してください..."
          rows={10}
          className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      <button
        onClick={() => setShowFormatConfirm(true)}
        disabled={loading || !text.trim()}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'AI整形中...' : 'AI整形を実行'}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="shrink-0 text-red-400 hover:text-red-600 leading-none text-base">✕</button>
        </div>
      )}

      {result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">整形結果</h2>
            <button
              onClick={() => downloadExcel(result)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition-colors"
            >
              Excelをダウンロード
            </button>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
            {result}
          </div>
        </div>
      )}
    </div>
  )
}
