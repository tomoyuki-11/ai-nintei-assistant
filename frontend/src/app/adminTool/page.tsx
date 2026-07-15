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

// ── Windows 9x スタイルトークン ──────────────────────────────────────────────
const WBG = "#d4d0c8";
const FONT = '"MS Sans Serif", "Segoe UI", Tahoma, Arial, sans-serif';

const RAISED = {
  borderTop: "2px solid #ffffff",
  borderLeft: "2px solid #ffffff",
  borderRight: "2px solid #808080",
  borderBottom: "2px solid #808080",
};

const INSET = {
  borderTop: "2px solid #808080",
  borderLeft: "2px solid #808080",
  borderRight: "2px solid #ffffff",
  borderBottom: "2px solid #ffffff",
};

const INPUT_S = {
  borderTop: "2px solid #808080",
  borderLeft: "2px solid #808080",
  borderRight: "2px solid #dfdfdf",
  borderBottom: "2px solid #dfdfdf",
  backgroundColor: "#ffffff",
  outline: "none",
  fontSize: "12px",
  padding: "2px 5px",
  fontFamily: "inherit",
  color: "#000000",
} as const;

const BTN_S = {
  ...RAISED,
  backgroundColor: WBG,
  fontSize: "11px",
  cursor: "pointer",
  fontFamily: "inherit",
  color: "#000000",
  padding: "3px 12px",
} as const;

const DANGER_S = {
  ...BTN_S,
  color: "#cc0000",
} as const;

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
  const [loadError, setLoadError] = useState("");
  const [individualUsers, setIndividualUsers] = useState<IndividualUser[]>([]);
  const [individualLoading, setIndividualLoading] = useState(false);
  const [individualError, setIndividualError] = useState("");
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});
  const [creditAdding, setCreditAdding] = useState<Record<string, boolean>>({});
  const [creditMessages, setCreditMessages] = useState<Record<string, string>>({});

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
    setIndividualError("");
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
      setIndividualError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setIndividualLoading(false);
    }
  }

  async function handleAddCredits(userId: string) {
    const amount = parseInt(creditInputs[userId] || "0", 10);
    if (!amount || amount <= 0) return;
    setCreditAdding((prev) => ({ ...prev, [userId]: true }));
    setCreditMessages((prev) => ({ ...prev, [userId]: "" }));
    try {
      const res = await fetch(`${API}/api/adminTool/individual-users/${userId}/add-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...superAdminHeaders() },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCreditInputs((prev) => ({ ...prev, [userId]: "" }));
      setCreditMessages((prev) => ({ ...prev, [userId]: `+${amount}回 追加しました` }));
      setTimeout(() => setCreditMessages((prev) => ({ ...prev, [userId]: "" })), 3000);
      setIndividualUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, credits: u.credits + amount } : u))
      );
    } catch (e) {
      setCreditMessages((prev) => ({ ...prev, [userId]: e instanceof Error ? e.message : "失敗しました" }));
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
    setLoadError("");
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
      setLoadError(e instanceof Error ? e.message : "データの取得に失敗しました");
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
      setCreateForm({ name: "", plan: "trial", license_expires_at: "", system_prompt: DEFAULT_PROMPT });
      setIssuedInfo({ name: data.name, license_key: data.license_key, initial_password: data.initial_password });
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
      <div style={{ minHeight: "100vh", backgroundColor: "#008080", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        {/* ダイアログウィンドウ */}
        <div style={{ width: "300px", backgroundColor: WBG, ...RAISED }}>
          {/* タイトルバー */}
          <div style={{ background: "linear-gradient(to right, #000080, #1c5fbd)", padding: "3px 6px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}>
            <span style={{ color: "#ffffff", fontSize: "11px", fontWeight: "bold" }}>管理ツール - ログイン</span>
            <button style={{ ...RAISED, backgroundColor: WBG, width: "16px", height: "14px", padding: 0, fontSize: "9px", cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontFamily: "inherit" }}>X</button>
          </div>

          {/* 本文 */}
          <div style={{ padding: "20px 18px 16px" }}>
            <p style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "2px" }}>AI認定調査アシスタント</p>
            <p style={{ fontSize: "11px", color: "#555", marginBottom: "14px" }}>管理ツール</p>

            <div style={{ borderTop: "1px solid #808080", borderBottom: "1px solid #ffffff", marginBottom: "14px" }} />

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "11px", marginBottom: "3px" }}>パスワード(P):</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...INPUT_S, width: "100%", boxSizing: "border-box" }}
                  required
                  autoFocus
                />
              </div>

              {loginError && (
                <p style={{ color: "#cc0000", fontSize: "11px", marginBottom: "8px" }}>{loginError}</p>
              )}

              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
                <button type="submit" style={{ ...BTN_S, minWidth: "80px", fontWeight: "bold" }}>
                  ログイン
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── ダッシュボード ──────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", backgroundColor: WBG, fontFamily: FONT }}>

      {/* タイトルバー */}
      <div style={{ background: "linear-gradient(to right, #000080, #1c5fbd)", padding: "4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}>
        <span style={{ color: "#ffffff", fontSize: "12px", fontWeight: "bold" }}>
          AI認定調査アシスタント 管理ツール
        </span>
        <button
          onClick={() => { removeSuperAdminToken(); setIsLoggedIn(false); }}
          style={{ ...BTN_S, fontSize: "11px", padding: "2px 10px" }}
        >
          ログアウト
        </button>
      </div>

      {/* メニューバー */}
      <div style={{ backgroundColor: WBG, padding: "2px 6px", borderBottom: "1px solid #808080", fontSize: "11px", display: "flex", gap: "0" }}>
        {["ファイル(F)", "表示(V)", "ヘルプ(H)"].map((label) => (
          <span key={label} style={{ padding: "1px 8px", cursor: "default" }}>{label}</span>
        ))}
      </div>

      {/* タブバー */}
      <div style={{ backgroundColor: WBG, padding: "6px 10px 0", borderBottom: "2px solid #808080", display: "flex", gap: "2px", alignItems: "flex-end" }}>
        {(["orgs", "individuals"] as const).map((tab) => {
          const active = activeTab === tab;
          const label = tab === "orgs" ? `施設一覧 (${orgs.length})` : `個人一覧 (${individualUsers.length})`;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                borderTop: "2px solid #ffffff",
                borderLeft: "2px solid #ffffff",
                borderRight: "2px solid #808080",
                borderBottom: active ? `2px solid ${WBG}` : "2px solid #808080",
                backgroundColor: active ? WBG : "#bfbcb4",
                fontSize: "11px",
                padding: active ? "5px 18px 7px" : "4px 18px 5px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: active ? "bold" : "normal",
                marginBottom: active ? "-2px" : "0",
                position: "relative",
                zIndex: active ? 1 : 0,
                color: "#000",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* コンテンツエリア */}
      <div style={{ padding: "12px 14px", backgroundColor: "#ffffff", ...INSET, minHeight: "calc(100vh - 100px)" }}>

        {/* ── 個人一覧タブ ── */}
        {activeTab === "individuals" && (
          <div>
            {individualError && (
              <div style={{ ...RAISED, backgroundColor: "#fff0f0", padding: "6px 10px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#cc0000", fontSize: "11px" }}>{individualError}</span>
                <button onClick={loadIndividualUsers} style={{ ...BTN_S, fontSize: "10px", padding: "2px 8px" }}>再読み込み</button>
              </div>
            )}
            {individualLoading ? (
              <p style={{ fontSize: "11px", color: "#666" }}>読み込み中...</p>
            ) : individualUsers.length === 0 ? (
              <p style={{ fontSize: "11px", color: "#666" }}>個人ユーザーはいません</p>
            ) : (
              <div style={{ ...INSET, backgroundColor: "#ffffff", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ backgroundColor: WBG }}>
                      {["メールアドレス", "プラン", "残クレジット", "トライアル期限", "登録日", "クレジット追加"].map((h) => (
                        <th key={h} style={{ padding: "3px 8px", textAlign: "left", borderRight: "1px solid #808080", borderBottom: "2px solid #808080", fontWeight: "bold", fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {individualUsers.map((user, i) => (
                      <tr key={user.id} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#eeecea" }}>
                        <td style={{ padding: "3px 8px", borderRight: "1px solid #c0c0c0", borderBottom: "1px solid #c0c0c0", fontFamily: "monospace", fontSize: "11px" }}>{user.email}</td>
                        <td style={{ padding: "3px 8px", borderRight: "1px solid #c0c0c0", borderBottom: "1px solid #c0c0c0" }}>{PLAN_LABELS[user.plan] ?? user.plan}</td>
                        <td style={{ padding: "3px 8px", borderRight: "1px solid #c0c0c0", borderBottom: "1px solid #c0c0c0", fontWeight: "bold" }}>{user.credits}回</td>
                        <td style={{ padding: "3px 8px", borderRight: "1px solid #c0c0c0", borderBottom: "1px solid #c0c0c0" }}>{formatDate(user.license_expires_at)}</td>
                        <td style={{ padding: "3px 8px", borderRight: "1px solid #c0c0c0", borderBottom: "1px solid #c0c0c0" }}>{new Date(user.created_at).toLocaleDateString("ja-JP")}</td>
                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #c0c0c0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <input
                              type="number"
                              min="1"
                              value={creditInputs[user.id] || ""}
                              onChange={(e) => setCreditInputs((prev) => ({ ...prev, [user.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && handleAddCredits(user.id)}
                              placeholder="回数"
                              style={{ ...INPUT_S, width: "64px" }}
                            />
                            <button
                              onClick={() => handleAddCredits(user.id)}
                              disabled={creditAdding[user.id]}
                              style={{ ...BTN_S, padding: "2px 8px", opacity: creditAdding[user.id] ? 0.5 : 1 }}
                            >
                              {creditAdding[user.id] ? "..." : "追加"}
                            </button>
                          </div>
                          {creditMessages[user.id] && (
                            <p style={{ fontSize: "10px", marginTop: "2px", color: creditMessages[user.id].startsWith("+") ? "#006600" : "#cc0000", fontFamily: "monospace" }}>
                              {creditMessages[user.id]}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 施設一覧タブ ── */}
        {activeTab === "orgs" && (
          <>
            {/* ツールバー */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>施設一覧 ({orgs.length}件)</span>
              <button
                onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}
                style={{ ...BTN_S }}
              >
                {showCreate ? "キャンセル" : "+ 新規施設を追加"}
              </button>
            </div>

            {/* 新規作成フォーム */}
            {showCreate && (
              <div style={{ ...RAISED, backgroundColor: WBG, padding: "12px", marginBottom: "12px" }}>
                <p style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>新規施設の登録</p>
                <div style={{ ...INSET, backgroundColor: "#fffff0", padding: "5px 8px", marginBottom: "10px", fontSize: "11px" }}>
                  ログインIDは <strong>admin</strong> で固定されます。パスワードは自動発行されます。
                </div>
                <form onSubmit={handleCreate}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>施設名 *</label>
                      <input
                        type="text"
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        required
                        placeholder="〇〇介護センター"
                        style={{ ...INPUT_S, width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>プラン</label>
                      <select
                        value={createForm.plan}
                        onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}
                        style={{ ...INPUT_S, width: "100%", boxSizing: "border-box" }}
                      >
                        <option value="trial">トライアル（14日・3回まで）</option>
                        <option value="metered">従量課金</option>
                        <option value="monthly">スタンダード：2,980円／月（8回・毎月リセット）</option>
                        <option value="dev">開発者（制限なし）</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>ライセンス有効期限（空欄＝無期限）</label>
                      <input
                        type="date"
                        value={createForm.license_expires_at}
                        onChange={(e) => setCreateForm({ ...createForm, license_expires_at: e.target.value })}
                        style={{ ...INPUT_S, width: "200px" }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>システムプロンプト（空欄＝デフォルトを使用）</label>
                    <textarea
                      value={createForm.system_prompt}
                      onChange={(e) => setCreateForm({ ...createForm, system_prompt: e.target.value })}
                      rows={6}
                      placeholder="空欄にするとデフォルトのプロンプトが使用されます"
                      style={{ ...INPUT_S, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "monospace" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                    <button type="button" onClick={() => setShowCreate(false)} style={{ ...BTN_S }}>キャンセル</button>
                    <button type="submit" disabled={saving} style={{ ...BTN_S, fontWeight: "bold", opacity: saving ? 0.5 : 1 }}>
                      {saving ? "作成中..." : "施設を作成"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 発行済み情報 */}
            {issuedInfo && (
              <div style={{ ...RAISED, backgroundColor: "#f0fff4", padding: "12px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "bold", color: "#006600" }}>ライセンスを発行しました</p>
                    <p style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>施設名: {issuedInfo.name}</p>
                  </div>
                  <button onClick={() => setIssuedInfo(null)} style={{ ...BTN_S, padding: "1px 6px" }}>X</button>
                </div>
                <div style={{ ...INSET, backgroundColor: "#fff0f0", padding: "5px 8px", marginBottom: "10px", fontSize: "11px", color: "#cc0000", fontWeight: "bold" }}>
                  この情報は一度しか表示されません。必ずメモしてから閉じてください。
                </div>
                {[
                  { label: "ライセンスキー", value: issuedInfo.license_key },
                  { label: "初期ログインID", value: "admin" },
                  { label: "初期パスワード", value: issuedInfo.initial_password },
                ].map((item) => (
                  <div key={item.label} style={{ marginBottom: "8px" }}>
                    <label style={{ display: "block", fontSize: "10px", color: "#666", marginBottom: "2px" }}>{item.label}</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <code style={{ ...INSET, backgroundColor: "#ffffff", padding: "2px 6px", fontSize: "11px", fontFamily: "monospace", flex: 1, wordBreak: "break-all" }}>
                        {item.value}
                      </code>
                      <button onClick={() => navigator.clipboard.writeText(item.value)} style={{ ...BTN_S, fontSize: "10px", padding: "2px 6px", whiteSpace: "nowrap" }}>
                        コピー
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* エラー表示 */}
            {loadError && (
              <div style={{ ...RAISED, backgroundColor: "#fff0f0", padding: "6px 10px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#cc0000", fontSize: "11px" }}>{loadError}</span>
                <button onClick={loadOrgs} style={{ ...BTN_S, fontSize: "10px" }}>再読み込み</button>
              </div>
            )}

            {/* 施設リスト */}
            {loading ? (
              <p style={{ fontSize: "11px", color: "#666" }}>読み込み中...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {orgs.map((org) => (
                  <div key={org.id} style={{ ...RAISED, backgroundColor: WBG }}>
                    {/* 施設ヘッダー行 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "12px", fontWeight: "bold" }}>{org.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", color: "#666" }}>ライセンスキー:</span>
                          <code style={{ ...INSET, backgroundColor: "#ffffff", padding: "1px 4px", fontSize: "10px", fontFamily: "monospace" }}>{org.license_key}</code>
                          <button onClick={() => copyLicenseKey(org.id, org.license_key)} style={{ ...BTN_S, fontSize: "10px", padding: "1px 6px" }}>
                            {copiedId === org.id ? "コピー済み" : "コピー"}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => { setDetailId(detailId === org.id ? null : org.id); setEditingId(null); setDeletingId(null); }}
                        style={{ ...BTN_S, flexShrink: 0, marginLeft: "8px" }}
                      >
                        {detailId === org.id ? "閉じる" : "詳細表示"}
                      </button>
                    </div>

                    {/* 詳細パネル */}
                    {detailId === org.id && (
                      <div style={{ ...INSET, backgroundColor: "#f4f0ec", padding: "8px 10px", margin: "0 4px 4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                          <span style={{ ...RAISED, backgroundColor: WBG, padding: "1px 6px", fontSize: "11px" }}>{PLAN_LABELS[org.plan] ?? org.plan}</span>
                          {!org.is_active && <span style={{ fontSize: "11px", color: "#cc0000", fontWeight: "bold" }}>[無効]</span>}
                          <span style={{ fontSize: "11px", color: "#444" }}>有効期限: {formatDate(org.license_expires_at)}</span>
                          <span style={{ fontSize: "11px", color: "#444" }}>登録: {new Date(org.created_at).toLocaleDateString("ja-JP")}</span>
                        </div>
                        {deletingId === org.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "11px", color: "#cc0000" }}>本当に削除しますか？</span>
                            <button onClick={() => handleDelete(org.id)} style={{ ...DANGER_S, fontWeight: "bold" }}>はい</button>
                            <button onClick={() => setDeletingId(null)} style={{ ...BTN_S }}>いいえ</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => toggleStaff(org.id)} style={{ ...BTN_S }}>
                              {openStaffId === org.id ? "スタッフ [-]" : "スタッフ [+]"}
                            </button>
                            <button onClick={() => editingId === org.id ? setEditingId(null) : startEdit(org)} style={{ ...BTN_S }}>
                              {editingId === org.id ? "閉じる" : "編集"}
                            </button>
                            <button onClick={() => { setDeletingId(org.id); setEditingId(null); }} style={{ ...DANGER_S }}>削除</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* スタッフパネル */}
                    {openStaffId === org.id && (
                      <div style={{ ...INSET, backgroundColor: "#f0f4ff", padding: "8px 10px", margin: "0 4px 4px" }}>
                        <p style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>スタッフ一覧</p>
                        {!staffMap[org.id] ? (
                          <p style={{ fontSize: "11px", color: "#666" }}>読み込み中...</p>
                        ) : staffMap[org.id].length === 0 ? (
                          <p style={{ fontSize: "11px", color: "#666" }}>スタッフが登録されていません</p>
                        ) : (
                          <table style={{ borderCollapse: "collapse", fontSize: "11px" }}>
                            <tbody>
                              {staffMap[org.id].map((s) => (
                                <tr key={s.id}>
                                  <td style={{ padding: "2px 8px 2px 0", whiteSpace: "nowrap" }}>
                                    <span style={{ ...RAISED, backgroundColor: WBG, padding: "1px 5px", fontSize: "10px" }}>
                                      {s.role === "admin" ? "管理者" : "スタッフ"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "2px 8px", fontWeight: "bold" }}>{s.name || s.email}</td>
                                  {s.name && <td style={{ padding: "2px 8px", color: "#666" }}>ID: {s.email}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* 編集パネル */}
                    {editingId === org.id && editForm && (
                      <div style={{ ...INSET, backgroundColor: "#f4f0ec", padding: "12px", margin: "0 4px 4px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>施設名</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              style={{ ...INPUT_S, width: "100%", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>プラン</label>
                            <select
                              value={editForm.plan}
                              onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                              style={{ ...INPUT_S, width: "100%", boxSizing: "border-box" }}
                            >
                              <option value="trial">トライアル（14日・3回まで）</option>
                              <option value="metered">従量課金</option>
                              <option value="monthly">スタンダード：2,980円／月（8回・毎月リセット）</option>
                              <option value="dev">開発者（制限なし）</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>ライセンス有効期限</label>
                            <input
                              type="date"
                              value={editForm.license_expires_at}
                              onChange={(e) => setEditForm({ ...editForm, license_expires_at: e.target.value })}
                              style={{ ...INPUT_S, width: "100%", boxSizing: "border-box" }}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingTop: "18px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: (!editForm.license_expires_at || new Date(editForm.license_expires_at) >= new Date()) ? "#006600" : "#cc0000" }}>
                              {(!editForm.license_expires_at || new Date(editForm.license_expires_at) >= new Date()) ? "期限内" : "期限切れ"}
                            </span>
                            <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={editForm.is_active}
                                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                style={{ width: "13px", height: "13px", cursor: "pointer" }}
                              />
                              有効
                            </label>
                          </div>
                        </div>
                        <div style={{ marginBottom: "10px" }}>
                          <label style={{ display: "block", fontSize: "11px", marginBottom: "2px" }}>システムプロンプト（空欄＝デフォルトを使用）</label>
                          <textarea
                            value={editForm.system_prompt}
                            onChange={(e) => setEditForm({ ...editForm, system_prompt: e.target.value })}
                            rows={10}
                            placeholder="空欄にするとデフォルトのプロンプトが使用されます"
                            style={{ ...INPUT_S, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "monospace" }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                          <button onClick={() => setEditingId(null)} style={{ ...BTN_S }}>キャンセル</button>
                          <button onClick={() => handleSaveEdit(org.id)} disabled={saving} style={{ ...BTN_S, fontWeight: "bold", opacity: saving ? 0.5 : 1 }}>
                            {saving ? "保存中..." : "保存"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
