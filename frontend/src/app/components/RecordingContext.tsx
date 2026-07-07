'use client'

import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { authHeaders } from '@/lib/auth'

type RecordingContextType = {
  isRecording: boolean
  isTranscribing: boolean
  text: string
  setText: (text: string) => void
  recordingError: string
  setRecordingError: (error: string) => void
  pendingAudio: Blob | null
  startRecording: () => void
  stopRecording: () => Promise<string>
  transcribeFile: (file: File | Blob) => Promise<string>
  retryTranscription: () => Promise<string>
  clearPendingAudio: () => void
  clearRecording: () => void
}

const RecordingContext = createContext<RecordingContextType | null>(null)

function getExtFromMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [text, setText] = useState('')
  const [recordingError, setRecordingError] = useState('')
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const silentAudioRef = useRef<HTMLAudioElement | null>(null)
  const textRef = useRef('')
  textRef.current = text

  // Whisperが無音音声に対して返す既知のハルシネーションパターン
  const HALLUCINATIONS = [
    'ご視聴ありがとうございました',
    'チャンネル登録',
    '字幕は自動生成されています',
    'ありがとうございました',
    'Thank you for watching',
    'Subtitles by',
  ]
  function isHallucination(text: string): boolean {
    const t = text.trim()
    if (t.length === 0) return true
    return HALLUCINATIONS.some((h) => t.includes(h))
  }

  // Whisper API呼び出し
  // 戻り値: 文字起こしテキスト（成功）/ null（API/ネットワークエラー）/ ''（無音・ハルシネーション）
  const callWhisper = useCallback(async (blob: Blob, filename?: string): Promise<string | null> => {
    setIsTranscribing(true)
    try {
      const mimeType = blob.type || 'audio/webm'
      const ext = filename ? filename.split('.').pop() || getExtFromMime(mimeType) : getExtFromMime(mimeType)
      const name = filename || `audio.${ext}`

      const formData = new FormData()
      formData.append('audio', blob, name)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transcribe`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      })

      if (!res.ok) return null

      const data = await res.json()
      const transcribed = data.text || ''
      if (transcribed.trim().length === 0 || isHallucination(transcribed)) {
        return ''
      }
      return transcribed
    } catch {
      return null
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  // 文字起こし結果を既存テキストに追記してstateを更新
  const appendTranscription = useCallback((transcribed: string): string => {
    const current = textRef.current
    const accumulated = current ? `${current}\n${transcribed}` : transcribed
    setText(accumulated)
    return accumulated
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      // スリープ防止①: Wake Lock API（iOS 16.4以降 / Android Chrome対応）
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
        } catch { /* 非対応環境では無視 */ }
      }

      // スリープ防止②: AudioContextでオーディオセッションを維持（Safari・PWA両対応）
      try {
        const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext) as any
        if (AudioCtxClass) {
          const audioCtx: AudioContext = new AudioCtxClass()
          const micSource = audioCtx.createMediaStreamSource(stream)
          const silentGain = audioCtx.createGain()
          silentGain.gain.value = 0
          micSource.connect(silentGain)
          silentGain.connect(audioCtx.destination)
          const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate)
          const silentSource = audioCtx.createBufferSource()
          silentSource.buffer = buffer
          silentSource.loop = true
          silentSource.connect(audioCtx.destination)
          silentSource.start()
          audioCtxRef.current = audioCtx
        }
      } catch { /* 非対応環境では無視 */ }

      mediaRecorder.start(1000)
      setIsRecording(true)
      setRecordingError('')
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setRecordingError('マイクへのアクセスが拒否されています。ブラウザのアドレスバー左のアイコンからマイクの使用を許可してください。')
      } else if (e.name === 'NotFoundError') {
        setRecordingError('マイクが見つかりません。マイクが接続されているか確認してください。')
      } else {
        setRecordingError(`録音エラーが発生しました（${e.name}）`)
      }
    }
  }, [])

  const stopRecording = useCallback(async (): Promise<string> => {
    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      setIsRecording(false)
      return textRef.current
    }

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        wakeLockRef.current?.release().catch(() => {})
        wakeLockRef.current = null
        silentAudioRef.current?.pause()
        silentAudioRef.current = null
        audioCtxRef.current?.close().catch(() => {})
        audioCtxRef.current = null
        setIsRecording(false)

        const mimeType = chunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })

        const transcribed = await callWhisper(blob)
        if (transcribed === null) {
          // API/ネットワークエラー → 録音音声を保存してリトライ可能にする
          setPendingAudio(blob)
          setRecordingError('文字起こしに失敗しました。オンラインに戻ってから「録音済み音声を文字起こし」を押してください。')
          resolve(textRef.current)
        } else if (transcribed === '') {
          // 無音またはスリープによる録音不全
          setRecordingError('音声が検出されませんでした。スリープ中は録音が途切れることがあります。画面をオンのままにしてください。')
          resolve(textRef.current)
        } else {
          setPendingAudio(null)
          resolve(appendTranscription(transcribed))
        }
      }

      mediaRecorder.stop()
    })
  }, [callWhisper, appendTranscription])

  // 音声ファイルをアップロードして文字起こし（既存テキストに追記）
  const transcribeFile = useCallback(async (file: File | Blob): Promise<string> => {
    const filename = file instanceof File ? file.name : undefined
    const transcribed = await callWhisper(file, filename)
    if (transcribed === null) {
      setRecordingError('文字起こしに失敗しました。もう一度お試しください。')
      return textRef.current
    }
    if (transcribed === '') {
      setRecordingError('音声が検出されませんでした。音声が含まれているファイルをご確認ください。')
      return textRef.current
    }
    return appendTranscription(transcribed)
  }, [callWhisper, appendTranscription])

  // 録音失敗時に保存された音声を再度文字起こし
  const retryTranscription = useCallback(async (): Promise<string> => {
    if (!pendingAudio) return textRef.current
    const transcribed = await callWhisper(pendingAudio)
    if (transcribed === null) {
      setRecordingError('文字起こしに失敗しました。もう一度お試しください。')
      return textRef.current
    }
    if (transcribed === '') {
      setRecordingError('音声が検出されませんでした。録音音声に音声データが含まれていない可能性があります。')
      return textRef.current
    }
    setPendingAudio(null)
    return appendTranscription(transcribed)
  }, [pendingAudio, callWhisper, appendTranscription])

  const clearPendingAudio = useCallback(() => {
    setPendingAudio(null)
  }, [])

  const clearRecording = useCallback(() => {
    setText('')
    chunksRef.current = []
    setPendingAudio(null)
  }, [])

  return (
    <RecordingContext.Provider value={{
      isRecording,
      isTranscribing,
      text,
      setText,
      recordingError,
      setRecordingError,
      pendingAudio,
      startRecording,
      stopRecording,
      transcribeFile,
      retryTranscription,
      clearPendingAudio,
      clearRecording,
    }}>
      {children}
    </RecordingContext.Provider>
  )
}

export function useRecording() {
  const ctx = useContext(RecordingContext)
  if (!ctx) throw new Error('useRecording must be used within RecordingProvider')
  return ctx
}
