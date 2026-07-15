"use client";

import { useEffect, useState } from "react";
import {
  getSuperAdminToken,
  setSuperAdminToken,
  removeSuperAdminToken,
  superAdminHeaders,
} from "@/lib/adminTool-auth";

const API = process.env.NEXT_PUBLIC_API_URL;

type StaffMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

type IndividualUser = {
  id: string;
  email: string;
  plan: string;
  credits: number;
  created_at: string;
  license_expires_at: string | null;
};

type Organization = {
  id: string;
  name: string;
  system_prompt: string;
  plan: string;
  license_expires_at: string | null;
  is_active: boolean;
  license_key: string;
  created_at: string;
};

type EditForm = {
  name: string;
  system_prompt: string;
  plan: string;
  license_expires_at: string;
  is_active: boolean;
};

type CreateForm = {
  name: string;
  plan: string;
  license_expires_at: string;
  system_prompt: string;
};

const PLAN_LABELS: Record<string, string> = {
  trial: "トライアル",
  metered: "従量課金",
  monthly: "スタンダード（2,980円／月）",
  dev: "開発者",
};

const PLAN_COLORS: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600",
  metered: "bg-gray-200 text-gray-700",
  monthly: "bg-gray-300 text-gray-800",
  dev: "bg-gray-200 text-gray-700",
};

function formatDate(iso: string | null): string {
  if (!iso) return "無期限";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const DEFAULT_PROMPT = "";

// ─────────────────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<"orgs" | "individuals">("orgs");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    plan: "trial",
    license_expires_at: "",
    system_prompt: DEFAULT_PROMPT,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [issuedInfo, setIssuedInfo] = useState<{
    name: string;
    license_key: string;
    initial_password: string;
  } | null>(null);
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);
  const [staffMap, setStaffMap] = useState<Record<string, StaffMember[]>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [individualUsers, setIndividualUsers] = useState<IndividualUser[]>([]);
  const [individualLoading, setIndividualLoading] = useState(false);
  const [individualError, setIndividualError] = useState('');
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [creditAdding, setCreditAdding] = useState<Record<string, boolean>>({});
  const [creditMessages, setCreditMessages] = useState<Record<string, string>>({});
  const [planSelects, setPlanSelects] = useState<Record<string, string>>({});
  const [planSaving, setPlanSaving] = useState<Record<string, boolean>>({});
  const [planMessages, setPlanMessages] = useState<Record<string, string>>({});

  function copyLicenseKey(orgId: string, key: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(orgId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  useEffect(() => {
    if (getSuperAdminToken()) {
      loadOrgs();
      loadIndividualUsers();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoggedIn && activeTab === "individuals") loadIndividualUsers();
  }, [isLoggedIn, activeTab]);

  async function loadIndividualUsers() {
    setIndividualLoading(true);
    setIndividualError('');
    try {
      const res = await fetch(`${API}/api/adminTool/individual-users`, {
        headers: superAdminHeaders(),
      });
      if (res.status === 401) {
        removeSuperAdminToken();
        setIsLoggedIn(false);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setIndividualUsers(await res.json());
    } catch (e) {
      setIndividualError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setIndividualLoading(false);
    }
  }

  async function handleChangePlan(userId: string, currentPlan: string) {
    const plan = planSelects[userId] ?? currentPlan;
    if (plan === currentPlan) return;
    setPlanSaving((prev) => ({ ...prev, [userId]: true }));
    setPlanMessages((prev) => ({ ...prev, [userId]: '' }));
    try {
      const res = await fetch(`${API}/api/adminTool/individual-users/${userId}/change-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...superAdminHeaders() },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPlanMessages((prev) => ({ ...prev, [userId]: 'プランを変更しました' }));
      setTimeout(() => setPlanMessages((prev) => ({ ...prev, [userId]: '' })), 3000);
      setIndividualUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan } : u))
      );
    } catch (e) {
      setPlanMessages((prev) => ({ ...prev, [userId]: e instanceof Error ? e.message : '失敗しました' }));
    } finally {
      setPlanSaving((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function handleAddCredits(userId: string) {
    const amount = parseInt(creditInputs[userId] || '0', 10);
    if (!amount || amount <= 0) return;
    setCreditAdding((prev) => ({ ...prev, [userId]: true }));
    setCreditMessages((prev) => ({ ...prev, [userId]: '' }));
    try {
      const res = await fetch(`${API}/api/adminTool/individual-users/${userId}/add-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...superAdminHeaders() },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCreditInputs((prev) => ({ ...prev, [userId]: '' }));
      setCreditMessages((prev) => ({ ...prev, [userId]: `+${amount}回 追加しました` }));
      setTimeout(() => setCreditMessages((prev) => ({ ...prev, [userId]: '' })), 3000);
      setIndividualUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, credits: u.credits + amount } : u))
      );
    } catch (e) {
      setCreditMessages((prev) => ({ ...prev, [userId]: e instanceof Error ? e.message : '失敗しました' }));
    } finally {
      setCreditAdding((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API}/api/adminTool/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSuperAdminToken(data.token);
      loadOrgs();
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "ログインに失敗しました");
    }
  }

  async function loadOrgs() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API}/api/adminTool/organizations`, {
        headers: superAdminHeaders(),
      });
      if (res.status === 401) {
        removeSuperAdminToken();
        setIsLoggedIn(false);
        setMounted(true);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIsLoggedIn(true);
      setMounted(true);
      setOrgs(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'データの取得に失敗しました');
      setMounted(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStaff(orgId: string) {
    if (openStaffId === orgId) {
      setOpenStaffId(null);
      return;
    }
    setOpenStaffId(orgId);
    if (!staffMap[orgId]) {
      const res = await fetch(`${API}/api/adminTool/organizations/${orgId}/staff`, {
        headers: superAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStaffMap((prev) => ({ ...prev, [orgId]: data }));
      }
    }
  }

  function startEdit(org: Organization) {
    setEditingId(org.id);
    setDeletingId(null);
    setEditForm({
      name: org.name,
      system_prompt: org.system_prompt,
      plan: org.plan,
      license_expires_at: toDateInput(org.license_expires_at),
      is_active: org.is_active,
    });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/adminTool/organizations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...superAdminHeaders() },
        body: JSON.stringify({
          ...editForm,
          license_expires_at: editForm.license_expires_at || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditingId(null);
      loadOrgs();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${API}/api/adminTool/organizations/${id}`, {
        method: "DELETE",
        headers: superAdminHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      setDeletingId(null);
      loadOrgs();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/adminTool/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...superAdminHeaders() },
        body: JSON.stringify({
          ...createForm,
          license_expires_at: createForm.license_expires_at || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setShowCreate(false);
      setCreateForm({
        name: "",
        plan: "trial",
        license_expires_at: "",
        system_prompt: DEFAULT_PROMPT,
      });
      setIssuedInfo({
        name: data.name,
        license_key: data.license_key,
        initial_password: data.initial_password,
      });
      loadOrgs();
    } catch (e) {
      alert(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // ─── ログイン確認中 ─────────────────────────────────────────────────────────

  if (!mounted) return null;

  // ─── ログイン画面 ───────────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-gray-800 p-8 border border-gray-600">
          <h1 className="text-xl font-bold text-white mb-2">管理者</h1>
          <p className="text-sm text-gray-400 mb-6">
            AI認定調査アシスタント 管理ツール
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="管理者パスワード"
              required
              className="w-full bg-gray-700 border border-gray-500 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            {loginError && <p className="text-sm text-red-400">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-gray-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-gray-500 transition-colors"
            >
              ログイン
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ─── ダッシュボード ──────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">
            AI認定調査アシスタント 管理ツール
          </h1>
        </div>
        <button
          onClick={() => {
            removeSuperAdminToken();
            setIsLoggedIn(false);
          }}
          className="text-sm text-gray-300 hover:text-white transition-colors"
        >
          ログアウト
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-gray-300">
          <button
            onClick={() => setActiveTab("orgs")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "orgs"
                ? "bg-white border border-b-white border-gray-300 text-gray-900 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            施設一覧
            <span className="ml-1.5 text-xs text-gray-400">({orgs.length}件)</span>
          </button>
          <button
            onClick={() => setActiveTab("individuals")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "individuals"
                ? "bg-white border border-b-white border-gray-300 text-gray-900 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            個人一覧
            <span className="ml-1.5 text-xs text-gray-400">({individualUsers.length}件)</span>
          </button>
        </div>

        {activeTab === "individuals" && (
          <div>
            {individualError && (
              <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-red-700 font-medium">{individualError}</p>
                <button
                  onClick={loadIndividualUsers}
                  className="ml-4 shrink-0 bg-red-100 px-3 py-1.5 text-xs text-red-700 hover:bg-red-200 transition-colors"
                >再読み込み</button>
              </div>
            )}
            {individualLoading ? (
              <p className="text-sm text-gray-400">読み込み中...</p>
            ) : (
              <div className="border border-gray-300 bg-white shadow-sm overflow-hidden">
                {individualUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 px-5 py-6">個人ユーザーはいません</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-400 bg-gray-200 text-xs text-gray-700">
                        <th className="text-left px-4 py-2 font-bold border-r border-gray-300">メールアドレス</th>
                        <th className="text-left px-4 py-2 font-bold border-r border-gray-300">プラン</th>
                        <th className="text-left px-4 py-2 font-bold border-r border-gray-300">残クレジット</th>
                        <th className="text-left px-4 py-2 font-bold border-r border-gray-300">トライアル期限</th>
                        <th className="text-left px-4 py-2 font-bold border-r border-gray-300">登録日</th>
                        <th className="text-left px-4 py-2 font-bold border-r border-gray-300">開発のためのプラン変更<span className="font-normal text-gray-500 ml-1">（※変更による料金は発生しない）</span></th>
                        <th className="text-left px-4 py-2 font-bold">クレジット追加</th>
                      </tr>
                    </thead>
                    <tbody>
                      {individualUsers.map((user, i) => (
                        <tr key={user.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-4 py-2 font-mono text-xs text-gray-900 border-r border-gray-200">{user.email}</td>
                          <td className="px-4 py-2 border-r border-gray-200">
                            <span className="text-xs font-medium text-gray-800">
                              {PLAN_LABELS[user.plan] ?? user.plan}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-900 font-bold text-sm border-r border-gray-200">{user.credits}回</td>
                          <td className="px-4 py-2 text-xs text-gray-600 border-r border-gray-200">{formatDate(user.license_expires_at)}</td>
                          <td className="px-4 py-2 text-xs text-gray-600 border-r border-gray-200">{new Date(user.created_at).toLocaleDateString('ja-JP')}</td>
                          <td className="px-4 py-2 border-r border-gray-200">
                            <div className="flex items-center gap-2">
                              <select
                                value={planSelects[user.id] ?? ''}
                                onChange={(e) => setPlanSelects((prev) => ({ ...prev, [user.id]: e.target.value }))}
                                className="border border-gray-400 px-2 py-1 text-xs bg-white text-gray-900 focus:outline-none focus:border-gray-600"
                                style={{ borderRadius: 0 }}
                              >
                                <option value="" disabled>-- 選択 --</option>
                                <option value="trial">開発者用（トライアル）</option>
                                <option value="metered">開発者用（従量課金）</option>
                                <option value="monthly">開発者用（スタンダード）</option>
                              </select>
                              <button
                                onClick={() => handleChangePlan(user.id, user.plan)}
                                disabled={planSaving[user.id] || !planSelects[user.id] || planSelects[user.id] === user.plan}
                                className="border border-gray-400 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 px-3 py-1 text-xs font-bold text-gray-800 disabled:opacity-40"
                                style={{ borderRadius: 0 }}
                              >
                                <span className="whitespace-nowrap">{planSaving[user.id] ? '...' : '変更'}</span>
                              </button>
                            </div>
                            {planMessages[user.id] && (
                              <p className={`text-xs mt-1 ${planMessages[user.id] === 'プランを変更しました' ? 'text-green-700' : 'text-red-700'}`}>
                                {planMessages[user.id]}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={creditInputs[user.id] || ''}
                                onChange={(e) => setCreditInputs((prev) => ({ ...prev, [user.id]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCredits(user.id)}
                                placeholder="回数"
                                className="w-20 border border-gray-400 px-2 py-1 text-xs font-mono bg-white text-gray-900 focus:outline-none focus:border-gray-600"
                                style={{ borderRadius: 0 }}
                              />
                              <button
                                onClick={() => handleAddCredits(user.id)}
                                disabled={creditAdding[user.id]}
                                className="border border-gray-400 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 px-3 py-1 text-xs font-bold text-gray-800 disabled:opacity-50"
                                style={{ borderRadius: 0 }}
                              >
                                <span className="whitespace-nowrap">{creditAdding[user.id] ? '...' : '追加'}</span>
                              </button>
                            </div>
                            {creditMessages[user.id] && (
                              <p className={`text-xs mt-1 font-mono ${creditMessages[user.id].startsWith('+') ? 'text-green-700' : 'text-red-700'}`}>
                                {creditMessages[user.id]}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "orgs" && <>
        {/* 新規施設作成 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            施設一覧{" "}
            <span className="text-sm font-normal text-gray-400">
              ({orgs.length}件)
            </span>
          </h2>
          <button
            onClick={() => {
              setShowCreate(!showCreate);
              setEditingId(null);
            }}
            className="bg-gray-700 px-4 py-2 text-sm text-white font-medium hover:bg-gray-600 transition-colors"
          >
            {showCreate ? "キャンセル" : "+ 新規施設を追加"}
          </button>
        </div>

        {/* 新規施設フォーム */}
        {showCreate && (
          <div className="mb-6 border-2 border-gray-300 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              新規施設の登録
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2">
                ログインID は{" "}
                <span className="font-mono font-semibold">admin</span>{" "}
                で固定されます。パスワードは自動発行されます。
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    施設名 *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    required
                    placeholder="〇〇介護センター"
                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    プラン
                  </label>
                  <select
                    value={createForm.plan}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, plan: e.target.value })
                    }
                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    <option value="trial">トライアル（14日・3回まで）</option>
                    <option value="metered">従量課金</option>
                    <option value="monthly">スタンダード：2,980円／月（8回・毎月リセット）</option>
                    <option value="dev">開発者（制限なし）</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    ライセンス有効期限（空欄＝無期限）
                  </label>
                  <input
                    type="date"
                    value={createForm.license_expires_at}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        license_expires_at: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  システムプロンプト（空欄＝デフォルトを使用）
                </label>
                <textarea
                  value={createForm.system_prompt}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      system_prompt: e.target.value,
                    })
                  }
                  rows={6}
                  placeholder="空欄にするとデフォルトのプロンプトが使用されます"
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y font-mono"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gray-700 px-4 py-2 text-sm text-white font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? "作成中..." : "施設を作成"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 発行済み情報パネル */}
        {issuedInfo && (
          <div className="mb-6 border-2 border-green-300 bg-green-50 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-green-800">
                  ライセンスを発行しました
                </h3>
                <p className="text-xs text-green-700 mt-0.5">
                  施設名: {issuedInfo.name}
                </p>
              </div>
              <button
                onClick={() => setIssuedInfo(null)}
                className="text-green-500 hover:text-green-700 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 mb-4">
              この情報は一度しか表示されません。必ずメモしてから閉じてください。
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">ライセンスキー</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-200 px-3 py-2 text-sm font-mono text-gray-800 break-all">
                    {issuedInfo.license_key}
                  </code>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(issuedInfo.license_key)
                    }
                    className="shrink-0 border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-white transition-colors"
                  >
                    コピー
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">初期ログインID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-200 px-3 py-2 text-sm font-mono text-gray-800">
                    admin
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText("admin")}
                    className="shrink-0 border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-white transition-colors"
                  >
                    コピー
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">初期パスワード</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-200 px-3 py-2 text-sm font-mono text-gray-800">
                    {issuedInfo.initial_password}
                  </code>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(issuedInfo.initial_password)
                    }
                    className="shrink-0 border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-white transition-colors"
                  >
                    コピー
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 施設一覧 */}
        {loadError && (
          <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-700 font-medium">{loadError}</p>
            <button
              onClick={loadOrgs}
              className="ml-4 shrink-0 bg-red-100 px-3 py-1.5 text-xs text-red-700 hover:bg-red-200 transition-colors"
            >再読み込み</button>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : (
          <div className="space-y-4">
            {orgs.map((org) => (
              <div
                key={org.id}
                className="border border-gray-300 bg-white shadow-sm overflow-hidden"
              >
                {/* 施設行 */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900">{org.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">ライセンスキー:</span>
                      <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 font-mono">
                        {org.license_key}
                      </code>
                      <button
                        onClick={() => copyLicenseKey(org.id, org.license_key)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        {copiedId === org.id ? "コピーしました" : "コピー"}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDetailId(detailId === org.id ? null : org.id);
                      setEditingId(null);
                      setDeletingId(null);
                    }}
                    className="shrink-0 ml-4 border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {detailId === org.id ? "閉じる" : "詳細表示"}
                  </button>
                </div>

                {/* 詳細パネル */}
                {detailId === org.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <span className={`px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[org.plan] ?? "bg-gray-100 text-gray-600"}`}>
                        {PLAN_LABELS[org.plan] ?? org.plan}
                      </span>
                      {!org.is_active && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600">無効</span>
                      )}
                      <span className="text-xs text-gray-400">有効期限: {formatDate(org.license_expires_at)}</span>
                      <span className="text-xs text-gray-400">登録: {new Date(org.created_at).toLocaleDateString("ja-JP")}</span>
                    </div>
                    {deletingId === org.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">本当に削除しますか？</span>
                        <button
                          onClick={() => handleDelete(org.id)}
                          className="px-2.5 py-1 text-xs bg-red-500 text-white hover:bg-red-600"
                        >はい</button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50"
                        >いいえ</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleStaff(org.id)}
                          className="border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          {openStaffId === org.id ? "スタッフ▲" : "スタッフ▼"}
                        </button>
                        <button
                          onClick={() => editingId === org.id ? setEditingId(null) : startEdit(org)}
                          className="border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          {editingId === org.id ? "閉じる" : "編集"}
                        </button>
                        <button
                          onClick={() => { setDeletingId(org.id); setEditingId(null); }}
                          className="border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* スタッフ一覧パネル */}
                {openStaffId === org.id && (
                  <div className="border-t border-gray-100 bg-gray-100 px-5 py-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">スタッフ一覧</p>
                    {!staffMap[org.id] ? (
                      <p className="text-xs text-gray-400">読み込み中...</p>
                    ) : staffMap[org.id].length === 0 ? (
                      <p className="text-xs text-gray-400">スタッフが登録されていません</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {staffMap[org.id].map((s) => (
                          <li key={s.id} className="flex items-center gap-3 text-xs">
                            <span className={`px-2 py-0.5 font-medium ${s.role === 'admin' ? 'bg-gray-300 text-gray-800' : 'bg-gray-200 text-gray-600'}`}>
                              {s.role === 'admin' ? '管理者' : 'スタッフ'}
                            </span>
                            <span className="font-medium text-gray-800">{s.name || s.email}</span>
                            {s.name && <span className="text-gray-400">ID: {s.email}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* 編集パネル */}
                {editingId === org.id && editForm && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          施設名
                        </label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          プラン
                        </label>
                        <select
                          value={editForm.plan}
                          onChange={(e) =>
                            setEditForm({ ...editForm, plan: e.target.value })
                          }
                          className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                          <option value="trial">トライアル（14日・3回まで）</option>
                          <option value="metered">従量課金</option>
                          <option value="monthly">スタンダード：2,980円／月（8回・毎月リセット）</option>
                          <option value="dev">開発者（制限なし）</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          ライセンス有効期限
                        </label>
                        <input
                          type="date"
                          value={editForm.license_expires_at}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              license_expires_at: e.target.value,
                            })
                          }
                          className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-5">
                        <span
                          className={`text-xs font-semibold ${
                            !editForm.license_expires_at ||
                            new Date(editForm.license_expires_at) >= new Date()
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {!editForm.license_expires_at ||
                          new Date(editForm.license_expires_at) >= new Date()
                            ? "期限内"
                            : "期限切れ"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              is_active: !editForm.is_active,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            editForm.is_active ? "bg-gray-700" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              editForm.is_active
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                        <span className="text-xs text-gray-500">
                          {editForm.is_active ? "有効" : "無効"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        システムプロンプト（空欄＝デフォルトを使用）
                      </label>
                      <textarea
                        value={editForm.system_prompt}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            system_prompt: e.target.value,
                          })
                        }
                        rows={10}
                        placeholder="空欄にするとデフォルトのプロンプトが使用されます"
                        className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y font-mono"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setEditingId(null)}
                        className="border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleSaveEdit(org.id)}
                        disabled={saving}
                        className="bg-gray-700 px-4 py-2 text-sm text-white font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
                      >
                        {saving ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </>}
      </div>
    </main>
  );
}
