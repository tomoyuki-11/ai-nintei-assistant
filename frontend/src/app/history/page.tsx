'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { downloadExcel } from '@/lib/excel'
import { authHeaders, isAuthenticated } from '@/lib/auth'

type Transcription = {
  id: string
  text: string
  formatted: string | null
  user_name: string
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openFormattedId, setOpenFormattedId] = useState<string | null>(null)
  const [openTextId, setOpenTextId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [formattingId, setFormattingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/licence')
      return
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history`, {
      headers: authHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`エラー: ${res.status}`)
        return res.json()
      })
      .then((data) => setHistory(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  function startEditing(item: Transcription) {
    setEditingId(item.id)
    setEditText(item.text)
    setOpenTextId(null)
    setConfirmingId(null)
    setDeletingId(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditText('')
    setDeletingId(null)
  }

  async function handleSave(id: string) {
    setSavingId(id)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: editText }),
      })
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      setHistory((prev) =>
        prev.map((h) => h.id === id ? { ...h, text: editText } : h)
      )
      setEditingId(null)
      setEditText('')
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      setHistory((prev) => prev.filter((h) => h.id !== id))
      setEditingId(null)
      setDeletingId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  async function handleFormat(item: Transcription) {
    setConfirmingId(null)
    setFormattingId(item.id)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: item.text, id: item.id }),
      })
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      const data = await res.json()
      setHistory((prev) =>
        prev.map((h) => h.id === item.id ? { ...h, formatted: data.formatted } : h)
      )
      setOpenFormattedId(item.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : '整形に失敗しました')
    } finally {
      setFormattingId(null)
    }
  }

  function onFormatClick(item: Transcription) {
    if (item.formatted) {
      setConfirmingId(item.id)
    } else {
      handleFormat(item)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">文字起こし履歴</h1>
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← トップへ戻る
          </Link>
        </div>

        {loading && <p className="text-sm text-gray-500">読み込み中...</p>}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <p className="text-sm text-gray-500">履歴がありません。</p>
        )}

        <div className="space-y-4">
          {history.map((item) => {
            const isEditing = editingId === item.id
            const isDeleting = deletingId === item.id

            return (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                    {item.user_name && (
                      <p className="text-xs text-gray-500">担当者：{item.user_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      /* 編集モードのヘッダーボタン群 */
                      isDeleting ? (
                        <>
                          <span className="text-xs text-gray-600">本当に削除しますか？</span>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded px-2.5 py-1 text-xs bg-red-500 text-white hover:bg-red-600 transition-colors"
                          >
                            はい
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="rounded px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            いいえ
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setDeletingId(item.id)}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                          >
                            削除
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleSave(item.id)}
                            disabled={savingId === item.id}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {savingId === item.id ? '保存中...' : '保存'}
                          </button>
                        </>
                      )
                    ) : (
                      /* 通常モードのヘッダーボタン群 */
                      <>
                        <button
                          onClick={() => startEditing(item)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          編集
                        </button>
                        {formattingId === item.id ? (
                          <span className="text-xs text-blue-500 animate-pulse">整形中...</span>
                        ) : confirmingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">整形されていますが、上書きしますか？</span>
                            <button
                              onClick={() => handleFormat(item)}
                              className="rounded px-2.5 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                            >
                              はい
                            </button>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="rounded px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              いいえ
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => onFormatClick(item)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700 transition-colors"
                          >
                            AI整形を実行
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 文字起こし */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-400 mb-1">文字起こし</p>
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-blue-400 p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  ) : (
                    <p className="text-sm text-gray-900">
                      {openTextId === item.id ? item.text : item.text.slice(0, 120)}
                      {item.text.length > 120 && openTextId !== item.id && (
                        <button
                          onClick={() => setOpenTextId(item.id)}
                          className="ml-1 text-blue-500 hover:underline text-sm"
                        >
                          …続きを見る
                        </button>
                      )}
                      {openTextId === item.id && (
                        <button
                          onClick={() => setOpenTextId(null)}
                          className="ml-2 text-xs text-gray-400 hover:underline"
                        >
                          閉じる
                        </button>
                      )}
                    </p>
                  )}
                </div>

                {/* 整形結果 */}
                {item.formatted && (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setOpenFormattedId(openFormattedId === item.id ? null : item.id)}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <span>{openFormattedId === item.id ? '▲' : '▶'}</span>
                        整形結果を{openFormattedId === item.id ? '閉じる' : '見る'}
                      </button>
                      <button
                        onClick={() => downloadExcel(item.formatted!, `認定調査_${formatDate(item.created_at)}.xlsx`)}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700 transition-colors"
                      >
                        Excelをダウンロード
                      </button>
                    </div>
                    {openFormattedId === item.id && (
                      <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                        {item.formatted}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
