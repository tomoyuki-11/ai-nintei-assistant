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
  startRecording: () => void
  stopRecording: () => Promise<string>
  clearRecording: () => void
}

const RecordingContext = createContext<RecordingContextType | null>(null)

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [text, setText] = useState('')
  const [recordingError, setRecordingError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

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
      return text
    }

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setIsRecording(false)
        setIsTranscribing(true)

        try {
          const mimeType = chunksRef.current[0]?.type || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type: mimeType })
          const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'

          const formData = new FormData()
          formData.append('audio', blob, `audio.${ext}`)

          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transcribe`, {
            method: 'POST',
            headers: authHeaders(),
            body: formData,
          })

          if (res.ok) {
            const data = await res.json()
            const transcribed: string = data.text || ''
            setText(transcribed)
            resolve(transcribed)
          } else {
            setRecordingError('文字起こしに失敗しました。もう一度お試しください。')
            resolve(text)
          }
        } catch {
          setRecordingError('文字起こしに失敗しました。もう一度お試しください。')
          resolve(text)
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.stop()
    })
  }, [text])

  const clearRecording = useCallback(() => {
    setText('')
    chunksRef.current = []
  }, [])

  return (
    <RecordingContext.Provider value={{
      isRecording,
      isTranscribing,
      text,
      setText,
      recordingError,
      setRecordingError,
      startRecording,
      stopRecording,
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
