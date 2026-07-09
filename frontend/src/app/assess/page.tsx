'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { useRecording } from '../components/RecordingContext'

export default function AssessPage() {
  const router = useRouter()
  const { hasPendingRecovery, pendingAudio, downloadableAudio } = useRecording()
  const [pipelinePending, setPipelinePending] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) router.push('/start')
    setPipelinePending(!!localStorage.getItem('pipeline_pending'))
  }, [router])

  const hasRecordingData =
    hasPendingRecovery ||
    !!pendingAudio ||
    (pipelinePending && !!downloadableAudio)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">認定調査</h1>
            <p className="text-xs text-gray-500 mt-0.5">整形方法を選択してください</p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← ホームへ戻る
          </Link>
        </div>

        {/* モバイル：縦並び / PC：横並び3列 */}
        <div className="flex flex-col sm:flex-row gap-3">

          {/* 録音して整形（回復データがある場合はオレンジ色） */}
          <Link
            href="/assess/record"
            className={`flex sm:flex-col items-center sm:items-start gap-4 sm:gap-3 rounded-xl px-5 py-4 sm:p-5 shadow-sm transition-all sm:flex-1 ${
              hasRecordingData
                ? 'bg-orange-50 border border-orange-300 hover:shadow-md hover:border-orange-400 active:bg-orange-100'
                : 'bg-white border border-gray-200 hover:shadow-md hover:border-blue-300 active:bg-gray-50'
            }`}
          >
            <div className="shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${hasRecordingData ? 'text-orange-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 sm:flex-none">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-semibold ${hasRecordingData ? 'text-orange-800' : 'text-gray-900'}`}>録音して整形</p>
                {hasRecordingData && (
                  <span className="rounded-full bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700">前回のデータあり</span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${hasRecordingData ? 'text-orange-600' : 'text-gray-500'}`}>
                {hasRecordingData ? '保存された録音データがあります。タップして続きを確認できます。' : 'その場で録音して自動で文字起こし・整形を行います'}
              </p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className={`ml-auto sm:hidden shrink-0 w-5 h-5 ${hasRecordingData ? 'text-orange-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* テキストを貼り付けて整形 */}
          <Link
            href="/assess/text"
            className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-3 rounded-xl bg-white border border-gray-200 px-5 py-4 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-300 active:bg-gray-50 transition-all sm:flex-1"
          >
            <div className="shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="text-sm font-semibold text-gray-900">テキストを貼り付けて整形</p>
              <p className="text-xs text-gray-500 mt-0.5">テキストを貼り付けてAIが認定調査票形式に整形します</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-auto sm:hidden shrink-0 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* 音声ファイルを整形 */}
          <Link
            href="/assess/audio"
            className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-3 rounded-xl bg-white border border-gray-200 px-5 py-4 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-300 active:bg-gray-50 transition-all sm:flex-1"
          >
            <div className="shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="text-sm font-semibold text-gray-900">音声ファイルを整形</p>
              <p className="text-xs text-gray-500 mt-0.5">録音済みの音声ファイルをアップロードして整形します</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-auto sm:hidden shrink-0 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

        </div>
      </div>
    </main>
  )
}
