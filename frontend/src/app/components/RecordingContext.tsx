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
  const textRef = useRef('')
  textRef.current = text

  // Whisper API呼び出し（成功時は文字起こしテキスト、失敗時は null）
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
      return data.text || ''
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
        setIsRecording(false)

        const mimeType = chunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })

        const transcribed = await callWhisper(blob)
        if (transcribed === null) {
          setPendingAudio(blob)
          setRecordingError('文字起こしに失敗しました。オンラインに戻ってから「録音済み音声を文字起こし」を押してください。')
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
