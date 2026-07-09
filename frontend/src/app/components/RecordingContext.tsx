'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { authHeaders } from '@/lib/auth'

type RecordingContextType = {
  isRecording: boolean
  isPaused: boolean
  isTranscribing: boolean
  text: string
  setText: (text: string) => void
  recordingError: string
  setRecordingError: (error: string) => void
  pendingAudio: Blob | null
  downloadableAudio: Blob | null
  startRecording: () => void
  stopRecording: () => Promise<string>
  pauseRecording: () => void
  resumeRecording: () => void
  transcribeFile: (file: File | Blob) => Promise<string>
  retryTranscription: () => Promise<string>
  downloadAudio: () => void
  clearPendingAudio: () => void
  clearRecording: () => void
}

const RecordingContext = createContext<RecordingContextType | null>(null)

const MAX_WHISPER_BYTES = 24 * 1024 * 1024  // 25MB上限に対して1MB余裕を持たせる

// Whisperの25MB上限に合わせてチャンク配列をグループ分割する
// chunks[0]はwebm/m4a両方で初期化セグメント（ヘッダ）を含むため各グループ先頭に付与する
function splitChunksIntoGroups(chunks: Blob[], maxBytes: number): Blob[][] {
  if (chunks.length === 0) return []
  const groups: Blob[][] = []
  let current: Blob[] = [chunks[0]]
  let currentSize = chunks[0].size
  for (let i = 1; i < chunks.length; i++) {
    if (currentSize + chunks[i].size > maxBytes && current.length > 1) {
      groups.push(current)
      current = [chunks[0], chunks[i]]
      currentSize = chunks[0].size + chunks[i].size
    } else {
      current.push(chunks[i])
      currentSize += chunks[i].size
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

function getExtFromMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('flac')) return 'flac'
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

function getMimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'mp4': case 'm4a': return 'audio/mp4'
    case 'ogg': case 'oga': return 'audio/ogg'
    case 'mp3': case 'mpeg': case 'mpga': return 'audio/mpeg'
    case 'wav': return 'audio/wav'
    case 'flac': return 'audio/flac'
    default: return 'audio/webm'
  }
}

const DRAFT_KEY = 'transcription_draft'

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [text, setText] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(DRAFT_KEY) ?? '') : ''
  )
  const [recordingError, setRecordingError] = useState('')
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null)
  const [downloadableAudio, setDownloadableAudio] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const textRef = useRef('')
  textRef.current = text

  // テキストをlocalStorageに随時保存してリロード後も復元できるようにする
  useEffect(() => {
    if (text) {
      localStorage.setItem(DRAFT_KEY, text)
    } else {
      localStorage.removeItem(DRAFT_KEY)
    }
  }, [text])

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
      const rawExt = filename ? (filename.split('.').pop()?.toLowerCase() ?? '') : ''
      const ext = rawExt || getExtFromMime(blob.type || 'audio/webm')
      const mimeType = blob.type || getMimeFromExt(ext)
      const name = filename || `audio.${ext}`

      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/transcribe`
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

      let ok: boolean
      let responseText: string

      if (isIOS) {
        // iOS Safari: FormData のマルチパート送信が壊れるため Blob を直接送信
        const res = await fetch(url, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': mimeType },
          body: blob,
        })
        ok = res.ok
        responseText = ok ? await res.text() : ''
      } else {
        const formData = new FormData()
        formData.append('audio', blob, name)
        const res = await fetch(url, {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        })
        ok = res.ok
        responseText = ok ? await res.text() : ''
      }

      if (!ok) return null

      const data = JSON.parse(responseText)
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
      setDownloadableAudio(null)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(1000)
      setIsRecording(true)
      setIsPaused(false)
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

  const pauseRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.pause()
        setIsPaused(true)
      }
    } catch { /* 非対応環境では無視 */ }
  }, [])

  const resumeRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state === 'paused') {
        mediaRecorderRef.current.resume()
        setIsPaused(false)
      }
    } catch { /* 非対応環境では無視 */ }
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
        setIsPaused(false)

        const mimeType = chunksRef.current[0]?.type || 'audio/webm'
        const totalSize = chunksRef.current.reduce((sum, c) => sum + c.size, 0)

        if (totalSize <= MAX_WHISPER_BYTES) {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          let transcribed = await callWhisper(blob)
          if (transcribed === null) {
            await new Promise((r) => setTimeout(r, 3000))
            transcribed = await callWhisper(blob)
          }
          if (transcribed === null) {
            setDownloadableAudio(blob)
            setPendingAudio(blob)
            setRecordingError('文字起こしに失敗しました。オンラインに戻ってから「録音済み音声を文字起こし」を押してください。')
            resolve(textRef.current)
          } else if (transcribed === '') {
            // 無音 → ダウンロード不要のためdownloadableAudioは設定しない
            setRecordingError('音声が検出されませんでした。スリープ中は録音が途切れることがあります。画面をオンのままにしてください。')
            resolve(textRef.current)
          } else {
            setDownloadableAudio(blob)
            setPendingAudio(null)
            resolve(appendTranscription(transcribed))
          }
        } else {
          // 25MB超：チャンク分割して順次送信
          const fullBlob = new Blob(chunksRef.current, { type: mimeType })
          const groups = splitChunksIntoGroups(chunksRef.current, MAX_WHISPER_BYTES)
          const accumulated: string[] = []

          for (const group of groups) {
            const groupBlob = new Blob(group, { type: mimeType })
            let result = await callWhisper(groupBlob)
            if (result === null) {
              await new Promise((r) => setTimeout(r, 3000))
              result = await callWhisper(groupBlob)
            }
            if (result === null) {
              // 失敗したグループのみ保存 → リトライ可能（25MB未満）
              const newText = accumulated.length > 0
                ? appendTranscription(accumulated.join('\n'))
                : textRef.current
              setDownloadableAudio(fullBlob)
              setPendingAudio(groupBlob)
              setRecordingError('文字起こしに失敗しました。オンラインに戻ってから「録音済み音声を文字起こし」を押してください。')
              resolve(newText)
              return
            }
            if (result !== '') accumulated.push(result)
          }

          if (accumulated.length === 0) {
            // 全て無音 → ダウンロード不要
            setRecordingError('音声が検出されませんでした。スリープ中は録音が途切れることがあります。画面をオンのままにしてください。')
            resolve(textRef.current)
          } else {
            setDownloadableAudio(fullBlob)
            setPendingAudio(null)
            resolve(appendTranscription(accumulated.join('\n')))
          }
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
      setRecordingError('文字起こしに失敗しました。対応形式: m4a / mp3 / mp4 / ogg / wav / flac / webm')
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

  const downloadAudio = useCallback(() => {
    if (!downloadableAudio) return
    const ext = getExtFromMime(downloadableAudio.type)
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const url = URL.createObjectURL(downloadableAudio)
    const a = document.createElement('a')
    a.href = url
    a.download = `recording_${ts}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [downloadableAudio])

  const clearPendingAudio = useCallback(() => {
    setPendingAudio(null)
  }, [])

  const clearRecording = useCallback(() => {
    setText('')
    localStorage.removeItem(DRAFT_KEY)
    chunksRef.current = []
    setPendingAudio(null)
    setDownloadableAudio(null)
  }, [])

  return (
    <RecordingContext.Provider value={{
      isRecording,
      isPaused,
      isTranscribing,
      text,
      setText,
      recordingError,
      setRecordingError,
      pendingAudio,
      downloadableAudio,
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,
      transcribeFile,
      retryTranscription,
      downloadAudio,
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
