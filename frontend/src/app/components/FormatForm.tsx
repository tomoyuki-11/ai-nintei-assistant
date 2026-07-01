'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'

type SpeechRecognitionConstructor = new () => SpeechRecognition

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
  const [text, setText] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [settings, setSettings] = useState<Settings>({ transcription_save_mode: 'auto', formatted_save_mode: 'auto' })
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [transcriptionDeclined, setTranscriptionDeclined] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseTextRef = useRef('')
  const finalAdditionsRef = useRef('')

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/licence'); return }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings`, { headers: authHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setSettings(data) })
      .catch(() => {})
  }, [router])

  function showSaveMessage(msg: string) {
    setSaveMessage(msg)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  function startRecording() {
    const SpeechRecognitionAPI: SpeechRecognitionConstructor | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setError('このブラウザは音声認識に対応していません。Chrome または Edge をお使いください。')
      return
    }

    baseTextRef.current = text
    finalAdditionsRef.current = ''
    setTranscriptionDeclined(false)

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalAdditionsRef.current += transcript
        } else {
          interim += transcript
        }
      }
      setText(baseTextRef.current + finalAdditionsRef.current + interim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsRecording(false)
    }

    recognition.onend = () => setIsRecording(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  async function stopRecording() {
    recognitionRef.current?.stop()
    setIsRecording(false)

    const currentText = baseTextRef.current + finalAdditionsRef.current
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

      if (!response.ok) throw new Error(`エラー: ${response.status}`)

      const data = await response.json()
      setResult(data.formatted)

      if (settings.formatted_save_mode === 'confirm') {
        setConfirm({ type: 'formatted', text, formatted: data.formatted, id: savedId })
      } else {
        setSavedId(null)
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
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-1.5 text-sm text-white font-medium hover:bg-red-600 transition-colors"
            >
              <span className="inline-block w-3 h-3 rounded-full bg-white" /> 録音開始
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm text-white font-medium animate-pulse"
            >
              <span className="inline-block w-3 h-3 rounded-sm bg-white" /> 録音停止
            </button>
          )}
          {isRecording && (
            <span className="text-xs text-red-500 font-medium animate-pulse">録音中...</span>
          )}
          {saveMessage && (
            <span className="text-xs text-green-600 font-medium">✓ {saveMessage}</span>
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
        onClick={handleSubmit}
        disabled={loading || !text.trim()}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'AI整形中...' : 'AI整形を実行'}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
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
