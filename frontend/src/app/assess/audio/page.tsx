'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import { useRecording } from '../../components/RecordingContext'

// --- IndexedDB: アップロードファイルの永続化 ---

async function openUploadDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('recording_recovery', 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('downloadable_audio')) {
        db.createObjectStore('downloadable_audio')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveUploadFile(file: File): Promise<void> {
  try {
    const db = await openUploadDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('downloadable_audio', 'readwrite')
      tx.objectStore('downloadable_audio').put({ blob: file, name: file.name, type: file.type }, 'upload_file')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {}
}

async function getUploadFile(): Promise<File | null> {
  try {
    const db = await openUploadDB()
    const data: { blob: Blob; name: string; type: string } | undefined = await new Promise((resolve, reject) => {
      const tx = db.transaction('downloadable_audio', 'readonly')
      const req = tx.objectStore('downloadable_audio').get('upload_file')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    if (!data) return null
    return new File([data.blob], data.name, { type: data.type })
  } catch {
    return null
  }
}

async function clearUploadFile(): Promise<void> {
  try {
    const db = await openUploadDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('downloadable_audio', 'readwrite')
      tx.objectStore('downloadable_audio').delete('upload_file')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {}
}

// ---

export default function AudioPage() {
  const router = useRouter()
  const { isTranscribing, setText, transcribeFile, recordingError, setRecordingError } = useRecording()

  const [file, setFile] = useState<File | null>(null)
  const [isFormatting, setIsFormatting] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/start'); return }
    setText('')
    window.scrollTo(0, 0)
    getUploadFile().then(f => { if (f) setFile(f) })
  }, [router, setText])

  useEffect(() => {
    if (recordingError) { setError(recordingError); setRecordingError('') }
  }, [recordingError, setRecordingError])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(t)
  }, [error])

  function handleFileSelect(f: File) {
    setFile(f)
    saveUploadFile(f)
  }

  async function handleSubmit() {
    if (!file) return
    setError('')

    const transcribedText = await transcribeFile(file)
    if (!transcribedText.trim()) return

    setIsFormatting(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: transcribedText, save: true }),
      })
      if (res.status === 402) {
        setError(await res.text().catch(() => '') || '使用回数の上限に達しています。クレジットを購入するか、プランをアップグレードしてください。')
        return
      }
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      const data = await res.json()
      setResult(data.formatted)
      clearUploadFile()
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

  function handleReset() {
    setFile(null)
    setResult('')
    setError('')
    setText('')
    clearUploadFile()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isBusy = isTranscribing || isFormatting

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">音声ファイルを整形</h1>
          {isBusy ? (
            <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium opacity-40 cursor-not-allowed">← 戻る</span>
          ) : (
            <Link href="/assess" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors">← 戻る</Link>
          )}
        </div>

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
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">整形結果</h2>
              <button onClick={() => downloadExcel(result)} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition-colors">
                Excelをダウンロード
              </button>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
            <button onClick={handleReset} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              別のファイルを整形する
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm space-y-4">
            {/* 処理中 */}
            {isBusy && (
              <div className="py-4 text-center">
                <div className="inline-block w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  {isTranscribing ? '文字起こし中...' : 'AI整形中...'}
                </p>
                <p className="text-xs text-gray-400 mt-1">しばらくお待ちください</p>
              </div>
            )}

            {/* ファイル選択 */}
            {!isBusy && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.webm,.ogg,.flac"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 w-full py-8 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {file ? (
                    <span className="text-gray-700 font-medium">{file.name}</span>
                  ) : (
                    <>
                      ファイルを選択
                      <span className="text-xs text-gray-400 mt-1 block">mp3 / m4a / wav / mp4 / ogg / flac / webm</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!file}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  AI整形を実行
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
