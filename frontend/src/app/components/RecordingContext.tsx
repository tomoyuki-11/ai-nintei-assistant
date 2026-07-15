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
  hasPendingRecovery: boolean
  startRecording: () => void
  stopRecording: () => Promise<string>
  pauseRecording: () => void
  resumeRecording: () => void
  transcribeFile: (file: File | Blob) => Promise<string>
  transcribeBlob: (blob: Blob) => Promise<string>
  retryTranscription: () => Promise<string>
  recoverAndTranscribe: () => Promise<string>
  getRecoveryBlob: () => Promise<Blob | null>
  discardRecovery: () => void
  downloadAudio: () => void
  clearPendingAudio: () => void
  clearRecording: () => void
  getAudioUploadPromise: () => Promise<string | null>
}

const RecordingContext = createContext<RecordingContextType | null>(null)

const MAX_WHISPER_BYTES = 24 * 1024 * 1024  // 25MB上限に対して1MB余裕を持たせる
const DRAFT_KEY = 'transcription_draft'
const RECOVERY_DB = 'recording_recovery'
const RECOVERY_STORE = 'chunks'
const DOWNLOAD_STORE = 'downloadable_audio'

// --- IndexedDB ユーティリティ ---

function openRecoveryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RECOVERY_DB, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(RECOVERY_STORE)) {
        db.createObjectStore(RECOVERY_STORE, { autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(DOWNLOAD_STORE)) {
        db.createObjectStore(DOWNLOAD_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDownloadableAudio(blob: Blob): Promise<void> {
  try {
    const db = await openRecoveryDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOWNLOAD_STORE, 'readwrite')
      tx.objectStore(DOWNLOAD_STORE).put(blob, 'audio')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* ストレージエラーは無視 */ }
}

async function getDownloadableAudio(): Promise<Blob | null> {
  try {
    const db = await openRecoveryDB()
    const blob: Blob | undefined = await new Promise((resolve, reject) => {
      const tx = db.transaction(DOWNLOAD_STORE, 'readonly')
      const req = tx.objectStore(DOWNLOAD_STORE).get('audio')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return blob ?? null
  } catch {
    return null
  }
}

async function clearDownloadableAudio(): Promise<void> {
  try {
    const db = await openRecoveryDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOWNLOAD_STORE, 'readwrite')
      tx.objectStore(DOWNLOAD_STORE).delete('audio')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* 無視 */ }
}

async function savePendingAudioToDB(blob: Blob): Promise<void> {
  try {
    const db = await openRecoveryDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOWNLOAD_STORE, 'readwrite')
      tx.objectStore(DOWNLOAD_STORE).put(blob, 'pending')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* ストレージエラーは無視 */ }
}

async function getPendingAudioFromDB(): Promise<Blob | null> {
  try {
    const db = await openRecoveryDB()
    const blob: Blob | undefined = await new Promise((resolve, reject) => {
      const tx = db.transaction(DOWNLOAD_STORE, 'readonly')
      const req = tx.objectStore(DOWNLOAD_STORE).get('pending')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return blob ?? null
  } catch {
    return null
  }
}

async function clearPendingAudioFromDB(): Promise<void> {
  try {
    const db = await openRecoveryDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOWNLOAD_STORE, 'readwrite')
      tx.objectStore(DOWNLOAD_STORE).delete('pending')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* 無視 */ }
}

async function appendChunkToDB(chunk: Blob, mimeType: string): Promise<void> {
  try {
    const db = await openRecoveryDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECOVERY_STORE, 'readwrite')
      tx.objectStore(RECOVERY_STORE).add({ chunk, mimeType })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* ストレージエラーは無視 */ }
}

async function getRecoveryData(): Promise<{ chunks: Blob[]; mimeType: string } | null> {
  try {
    const db = await openRecoveryDB()
    const entries: Array<{ chunk: Blob; mimeType: string }> = await new Promise((resolve, reject) => {
      const tx = db.transaction(RECOVERY_STORE, 'readonly')
      const req = tx.objectStore(RECOVERY_STORE).getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    if (entries.length === 0) return null
    return { chunks: entries.map(e => e.chunk), mimeType: entries[0].mimeType }
  } catch {
    return null
  }
}

async function clearRecoveryDB(): Promise<void> {
  try {
    const db = await openRecoveryDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RECOVERY_STORE, 'readwrite')
      tx.objectStore(RECOVERY_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* 無視 */ }
}

// --- 音声ユーティリティ ---

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

export function getExtFromMime(mimeType: string): string {
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

// --- Whisperへのチャンク送信（分割対応） ---

async function transcribeChunks(
  chunks: Blob[],
  mimeType: string,
  callWhisper: (blob: Blob) => Promise<string | null>
): Promise<{ result: string | null; failedGroupBlob?: Blob; fullBlob: Blob }> {
  const fullBlob = new Blob(chunks, { type: mimeType })
  const totalSize = chunks.reduce((sum, c) => sum + c.size, 0)

  if (totalSize <= MAX_WHISPER_BYTES) {
    let transcribed = await callWhisper(fullBlob)
    if (transcribed === null) {
      await new Promise((r) => setTimeout(r, 3000))
      transcribed = await callWhisper(fullBlob)
    }
    return { result: transcribed, fullBlob }
  }

  // 25MB超：チャンク分割して順次送信
  const groups = splitChunksIntoGroups(chunks, MAX_WHISPER_BYTES)
  const accumulated: string[] = []
  for (const group of groups) {
    const groupBlob = new Blob(group, { type: mimeType })
    let result = await callWhisper(groupBlob)
    if (result === null) {
      await new Promise((r) => setTimeout(r, 3000))
      result = await callWhisper(groupBlob)
    }
    if (result === null) {
      return { result: null, failedGroupBlob: groupBlob, fullBlob }
    }
    if (result !== '') accumulated.push(result)
  }
  return { result: accumulated.join('\n'), fullBlob }
}

// --- Provider ---

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
  const [hasPendingRecovery, setHasPendingRecovery] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const downloadableAudioInitRef = useRef(false)
  const pendingAudioInitRef = useRef(false)
  const userStoppedRef = useRef(false)
  const audioUploadPromiseRef = useRef<Promise<string | null>>(Promise.resolve(null))

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

  // 起動時にIndexedDBの回復データを確認する
  useEffect(() => {
    getRecoveryData().then(data => {
      if (data && data.chunks.length > 0) setHasPendingRecovery(true)
    })
  }, [])

  // 起動時にダウンロード可能な音声をIndexedDBから復元する
  useEffect(() => {
    getDownloadableAudio().then(blob => {
      downloadableAudioInitRef.current = true
      if (blob) setDownloadableAudio(blob)
    })
  }, [])

  // downloadableAudioが変わるたびにIndexedDBへ同期する（初回null状態はスキップ）
  useEffect(() => {
    if (!downloadableAudioInitRef.current) return
    if (downloadableAudio) {
      saveDownloadableAudio(downloadableAudio)
    } else {
      clearDownloadableAudio()
    }
  }, [downloadableAudio])

  // 起動時にpendingAudioをIndexedDBから復元する
  useEffect(() => {
    getPendingAudioFromDB().then(blob => {
      pendingAudioInitRef.current = true
      if (blob) setPendingAudio(blob)
    })
  }, [])

  // pendingAudioが変わるたびにIndexedDBへ同期する（初回null状態はスキップ）
  useEffect(() => {
    if (!pendingAudioInitRef.current) return
    if (pendingAudio) {
      savePendingAudioToDB(pendingAudio)
    } else {
      clearPendingAudioFromDB()
    }
  }, [pendingAudio])

  // 画面が隠れる直前（電話着信・タブ切り替え等）に最新チャンクをDBへ書き出す
  useEffect(() => {
    function flushOnHide() {
      if (mediaRecorderRef.current?.state === 'recording') {
        try { mediaRecorderRef.current.requestData() } catch {}
      }
    }
    function handleVisibilityChange() {
      if (document.hidden) flushOnHide()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flushOnHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', flushOnHide)
    }
  }, [])

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

  // 音声ファイルをサーバーへアップロード（全チャンク結合済みの fullBlob を1ファイルとして保存）
  const uploadAudioToServer = useCallback(async (blob: Blob, mimeType: string): Promise<string | null> => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/audio-upload`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': mimeType },
        body: blob,
      })
      if (!res.ok) return null
      const data = await res.json()
      return (data.audio_path as string) ?? null
    } catch {
      return null
    }
  }, [])

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
    // 新しい録音開始時に前回のリカバリデータ・テキストを破棄
    clearRecoveryDB()
    setHasPendingRecovery(false)
    localStorage.removeItem('pipeline_pending')
    localStorage.removeItem('pipeline_text')
    setText('')
    localStorage.removeItem(DRAFT_KEY)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent)

      // iOSはwebm/oggを録音できないためmimeType指定なしでデフォルト（audio/mp4）に任せる
      const selectedMimeType = isIOSDevice
        ? ''
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)

      // 実際に使われているmimeTypeを取得（iOSではaudio/mp4になる）
      const actualMimeType = mediaRecorder.mimeType || (isIOSDevice ? 'audio/mp4' : 'audio/webm')

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      setDownloadableAudio(null)
      setPendingAudio(null)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          // リロード時の復元用にIndexedDBへ随時保存（fire and forget）
          appendChunkToDB(e.data, actualMimeType)
        }
      }

      // 電話着信など予期せぬ停止のハンドラ（stopRecording呼び出し時に上書きされる）
      function onInterrupted() {
        if (userStoppedRef.current) return
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setIsRecording(false)
        setIsPaused(false)
        if (chunksRef.current.length > 0) {
          setHasPendingRecovery(true)
          setRecordingError('通話などにより録音が中断されました。「録音を再開」から続きを録音できます。')
        } else {
          setRecordingError('録音が中断されました。もう一度録音してください。')
        }
      }
      mediaRecorder.onstop = onInterrupted
      mediaRecorder.onerror = () => onInterrupted()

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
      userStoppedRef.current = true  // ユーザー操作による正常停止フラグ
      mediaRecorder.onstop = async () => {
        userStoppedRef.current = false  // 次の録音のためリセット
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setIsRecording(false)
        setIsPaused(false)

        // 正常停止したのでIndexedDBの回復データは不要
        clearRecoveryDB()

        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
        const mimeType = chunksRef.current[0]?.type || (isIOS ? 'audio/mp4' : 'audio/webm')

        // 文字起こし開始前に音声をIndexedDBへ保存し、パイプライン中リロード時のリカバリに備える
        const preSaveBlob = new Blob(chunksRef.current, { type: mimeType })
        setDownloadableAudio(preSaveBlob)
        localStorage.setItem('pipeline_pending', '1')

        const { result, failedGroupBlob, fullBlob } = await transcribeChunks(
          chunksRef.current, mimeType, callWhisper
        )

        if (result === null) {
          setPendingAudio(failedGroupBlob ?? fullBlob)
          localStorage.removeItem('pipeline_pending')
          setRecordingError('文字起こしに失敗しました。オンラインに戻ってから「録音済み音声を文字起こし」を押してください。')
          resolve(textRef.current)
        } else if (result === '') {
          localStorage.removeItem('pipeline_pending')
          setRecordingError('音声が検出されませんでした。スリープ中は録音が途切れることがあります。画面をオンのままにしてください。')
          resolve(textRef.current)
        } else {
          setPendingAudio(null)
          // 全チャンク結合済みの fullBlob を1ファイルとしてアップロード（saveTranscription が await する）
          audioUploadPromiseRef.current = uploadAudioToServer(fullBlob, mimeType)
          // pipeline_pending は整形完了後に record/page.tsx 側でクリアする
          resolve(appendTranscription(result))
        }
      }

      mediaRecorder.stop()
    })
  }, [callWhisper, appendTranscription, uploadAudioToServer])

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
    // 文字起こし成功時にファイルをサーバーへアップロード
    const mimeType = file.type || 'audio/webm'
    audioUploadPromiseRef.current = uploadAudioToServer(file, mimeType)
    return appendTranscription(transcribed)
  }, [callWhisper, appendTranscription, uploadAudioToServer])

  // 音声 blob を文字起こしして生テキストを返す（text state は変更しない）
  const transcribeBlob = useCallback(async (blob: Blob): Promise<string> => {
    const transcribed = await callWhisper(blob)
    return transcribed ?? ''
  }, [callWhisper])

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
    const audioToUpload = pendingAudio
    setPendingAudio(null)
    audioUploadPromiseRef.current = uploadAudioToServer(audioToUpload, audioToUpload.type || 'audio/webm')
    return appendTranscription(transcribed)
  }, [pendingAudio, callWhisper, appendTranscription, uploadAudioToServer])

  // リロードで中断された録音をIndexedDBから復元して文字起こし
  const recoverAndTranscribe = useCallback(async (): Promise<string> => {
    const data = await getRecoveryData()
    if (!data) return textRef.current

    const { result, failedGroupBlob, fullBlob } = await transcribeChunks(
      data.chunks, data.mimeType, callWhisper
    )

    if (result === null) {
      setDownloadableAudio(fullBlob)
      setPendingAudio(failedGroupBlob ?? fullBlob)
      setRecordingError('文字起こしに失敗しました。オンラインに戻ってから「録音済み音声を文字起こし」を押してください。')
      return textRef.current
    }

    await clearRecoveryDB()
    setHasPendingRecovery(false)

    if (result === '') {
      setRecordingError('音声が検出されませんでした。')
      return textRef.current
    }

    setDownloadableAudio(fullBlob)
    audioUploadPromiseRef.current = uploadAudioToServer(fullBlob, data.mimeType)
    return appendTranscription(result)
  }, [callWhisper, appendTranscription, uploadAudioToServer])

  const getRecoveryBlob = useCallback(async (): Promise<Blob | null> => {
    const data = await getRecoveryData()
    if (!data || data.chunks.length === 0) return null
    return new Blob(data.chunks, { type: data.mimeType })
  }, [])

  const discardRecovery = useCallback(() => {
    clearRecoveryDB()
    setHasPendingRecovery(false)
    localStorage.removeItem('pipeline_pending')
  }, [])

  const downloadAudio = useCallback(() => {
    if (!downloadableAudio) return
    const ext = getExtFromMime(downloadableAudio.type)
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const url = URL.createObjectURL(downloadableAudio)
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

    if (isIOS) {
      // iOS Safari: download属性が非対応のため新タブで開く
      // 即時revokeするとLoad failedになるため60秒後に解放
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = `recording_${ts}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }, [downloadableAudio])

  const clearPendingAudio = useCallback(() => {
    setPendingAudio(null)
  }, [])

  const clearRecording = useCallback(() => {
    setText('')
    localStorage.removeItem(DRAFT_KEY)
    localStorage.removeItem('pipeline_pending')
    localStorage.removeItem('pipeline_text')
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
      hasPendingRecovery,
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,
      transcribeFile,
      transcribeBlob,
      retryTranscription,
      recoverAndTranscribe,
      getRecoveryBlob,
      discardRecovery,
      downloadAudio,
      clearPendingAudio,
      clearRecording,
      getAudioUploadPromise: () => audioUploadPromiseRef.current,
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
