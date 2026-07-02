'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authHeaders, isAuthenticated } from '@/lib/auth'
import { downloadExcel } from '@/lib/excel'

type Transcription = {
  id: string
  text: string | null
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

export default function HomePage() {
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
  const [deletingTextId, setDeletingTextId] = useState<string | null>(null)
  const [deletingFormattedId, setDeletingFormattedId] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('checkout') === 'success') {
        setPaymentSuccess(true)
        window.history.replaceState({}, '', '/')
      }
    }
  }, [])

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
    setEditText(item.text ?? '')
    setOpenTextId(null)
    setConfirmingId(null)
    setDeletingId(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditText('')
    setDeletingId(null)
    setDeletingTextId(null)
    setDeletingFormattedId(null)
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
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, text: editText } : h))
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

  async function handleDeleteText(id: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${id}/text`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, text: null } : h))
      setDeletingTextId(null)
      setEditingId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  async function handleDeleteFormatted(id: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${id}/formatted`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`エラー: ${res.status}`)
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, formatted: null } : h))
      setDeletingFormattedId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  async function handleFormat(item: Transcription) {
    if (!item.text) return
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* 決済成功バナー */}
        {paymentSuccess && (
          <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-green-700 font-medium">スタンダードプランへのアップグレードが完了しました！</p>
            <button
              onClick={() => setPaymentSuccess(false)}
              className="text-green-500 hover:text-green-700 text-lg leading-none"
            >×</button>
          </div>
        )}

        {/* 認定調査開始ボタン */}
        <Link
          href="/assess"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-4 py-4 text-base text-white font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors mb-6 shadow-sm"
        >
          <span className="text-lg">＋</span> 認定調査を開始
        </Link>

        {/* 調査一覧 */}
        <h2 className="text-sm font-semibold text-gray-500 mb-3">調査履歴</h2>

        {loading && <p className="text-sm text-gray-400 text-center py-8">読み込み中...</p>}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">調査履歴がありません</p>
            <p className="text-xs mt-1">「認定調査を開始する」から始めてください</p>
          </div>
        )}

        <div className="space-y-3">
          {history.map((item) => {
            const isEditing = editingId === item.id
            const isDeleting = deletingId === item.id

            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <p className="text-xs text-gray-400 shrink-0">{formatDate(item.created_at)}</p>
                    {item.user_name && (
                      <p className="text-xs text-gray-500 truncate">担当：{item.user_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {isEditing ? (
                      isDeleting ? (
                        <>
                          <span className="text-xs text-gray-600">レコードを削除しますか？</span>
                          <button onClick={() => handleDelete(item.id)} className="rounded px-2.5 py-1 text-xs bg-red-500 text-white hover:bg-red-600 transition-colors">はい</button>
                          <button onClick={() => setDeletingId(null)} className="rounded px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">いいえ</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setDeletingId(item.id); setDeletingTextId(null); setDeletingFormattedId(null) }} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">削除</button>
                          <button onClick={cancelEditing} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors">キャンセル</button>
                          {item.text && (
                            <button onClick={() => handleSave(item.id)} disabled={savingId === item.id} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">{savingId === item.id ? '保存中...' : '保存'}</button>
                          )}
                        </>
                      )
                    ) : (
                      <>
                        <button onClick={() => startEditing(item)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors">編集</button>
                        {item.text && (
                          formattingId === item.id ? (
                            <span className="text-xs text-blue-500 animate-pulse">整形中...</span>
                          ) : confirmingId === item.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">上書きしますか？</span>
                              <button onClick={() => handleFormat(item)} className="rounded px-2.5 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 transition-colors">はい</button>
                              <button onClick={() => setConfirmingId(null)} className="rounded px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">いいえ</button>
                            </div>
                          ) : (
                            <button onClick={() => onFormatClick(item)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700 transition-colors">AI整形を実行</button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 文字起こし */}
                {item.text ? (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-gray-400">文字起こし</p>
                      {isEditing && (
                        deletingTextId === item.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">文字起こしを削除しますか？</span>
                            <button onClick={() => handleDeleteText(item.id)} className="rounded px-2 py-0.5 text-xs bg-red-500 text-white hover:bg-red-600">はい</button>
                            <button onClick={() => setDeletingTextId(null)} className="rounded px-2 py-0.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100">いいえ</button>
                          </div>
                        ) : (
                          <button onClick={() => { setDeletingTextId(item.id); setDeletingFormattedId(null); setDeletingId(null) }} className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors">文字起こしを削除</button>
                        )
                      )}
                    </div>
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
                          <button onClick={() => setOpenTextId(item.id)} className="ml-1 text-blue-500 hover:underline text-sm">…続きを見る</button>
                        )}
                        {openTextId === item.id && (
                          <button onClick={() => setOpenTextId(null)} className="ml-2 text-xs text-gray-400 hover:underline">閉じる</button>
                        )}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400">（文字起こしなし）</p>
                  </div>
                )}

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
                      <div className="flex items-center gap-2">
                        {isEditing && (
                          deletingFormattedId === item.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">整形結果を削除しますか？</span>
                              <button onClick={() => handleDeleteFormatted(item.id)} className="rounded px-2 py-0.5 text-xs bg-red-500 text-white hover:bg-red-600">はい</button>
                              <button onClick={() => setDeletingFormattedId(null)} className="rounded px-2 py-0.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100">いいえ</button>
                            </div>
                          ) : (
                            <button onClick={() => { setDeletingFormattedId(item.id); setDeletingTextId(null); setDeletingId(null) }} className="text-xs text-red-400 hover:text-red-600 hover:underline transition-colors">整形結果を削除</button>
                          )
                        )}
                        <button
                          onClick={() => downloadExcel(item.formatted!, `認定調査_${formatDate(item.created_at)}.xlsx`)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700 transition-colors"
                        >Excelをダウンロード</button>
                      </div>
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
