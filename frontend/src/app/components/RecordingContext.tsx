'use client'

import { createContext, useContext, useRef, useState, useCallback } from 'react'

type SpeechRecognitionConstructor = new () => SpeechRecognition

type RecordingContextType = {
  isRecording: boolean
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
  const [text, setText] = useState('')
  const [recordingError, setRecordingError] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baseTextRef = useRef('')
  const finalAdditionsRef = useRef('')
  const shouldRecordRef = useRef(false)

  const startRecording = useCallback(() => {
    const SpeechRecognitionAPI: SpeechRecognitionConstructor | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setRecordingError('このブラウザは音声認識に対応していません。Chrome または Edge をお使いください。')
      return
    }

    shouldRecordRef.current = true
    baseTextRef.current = text
    finalAdditionsRef.current = ''

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
      if (event.error === 'no-speech') return  // 無音タイムアウトは自動再起動で対処
      shouldRecordRef.current = false
      setIsRecording(false)
      if (event.error === 'not-allowed') {
        setRecordingError('マイクへのアクセスが拒否されています。ブラウザのアドレスバー左のアイコンからマイクの使用を許可してください。')
      } else if (event.error === 'audio-capture') {
        setRecordingError('マイクが見つかりません。マイクが接続されているか確認してください。')
      } else if (event.error === 'network') {
        setRecordingError('音声認識にはインターネット接続が必要です。')
      } else {
        setRecordingError(`音声認識エラーが発生しました（${event.error}）`)
      }
    }

    recognition.onend = () => {
      if (shouldRecordRef.current) {
        // 録音継続中なら自動再起動
        try { recognition.start() } catch {}
      } else {
        setIsRecording(false)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setRecordingError('')
  }, [text])

  const stopRecording = useCallback(async (): Promise<string> => {
    shouldRecordRef.current = false
    recognitionRef.current?.stop()
    setIsRecording(false)
    return baseTextRef.current + finalAdditionsRef.current
  }, [])

  const clearRecording = useCallback(() => {
    setText('')
    baseTextRef.current = ''
    finalAdditionsRef.current = ''
  }, [])

  return (
    <RecordingContext.Provider value={{
      isRecording,
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
