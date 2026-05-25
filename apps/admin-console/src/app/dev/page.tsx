"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Terminal, Plus, Pencil, Trash2, X, Check, RefreshCw, Search,
  ShieldCheck, User, GraduationCap, CircleDollarSign, AlertTriangle,
} from "lucide-react";

const ROLES = ["ADMIN", "TUTOR", "STUDENT", "FINANCE_CHECKER"] as const;
const VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;

type Role = typeof ROLES[number];

interface DevUser {
  userId: string;
  role: Role;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  profilePictureUrl: string | null;
  isActive: boolean;
  verificationStatus: string;
  verificationComment: string | null;
  sponsorTutorId: string | null;
  createdAt: string;
  oauthIdentities: { provider: string; providerUserId: string }[];
}

const ROLE_META: Record<Role, { label: string; color: string; icon: React.ReactNode }> = {
  ADMIN: {
    label: "Admin",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  TUTOR: {
    label: "Tutor",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    icon: <User className="h-3 w-3" />,
  },
  STUDENT: {
    label: "Student",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    icon: <GraduationCap className="h-3 w-3" />,
  },
  FINANCE_CHECKER: {
    label: "Finance",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    icon: <CircleDollarSign className="h-3 w-3" />,
  },
};

const BLANK_FORM = {
  role: "STUDENT" as Role,
  displayName: "",
  email: "",
  phoneNumber: "",
  isActive: true,
  verificationStatus: "UNVERIFIED",
  verificationComment: "",
  sponsorTutorId: "",
};

// Defined OUTSIDE DevPage — prevents unmount/remount on every keystroke
function FormFields({
  form,
  setForm,
}: {
  form: typeof BLANK_FORM;
  setForm: (f: typeof BLANK_FORM) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Role *</Label>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Display Name</Label>
        <Input className="h-8 text-xs" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. John Doe" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Email</Label>
        <Input className="h-8 text-xs" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Phone</Label>
        <Input className="h-8 text-xs" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+66812345678" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">isActive</Label>
        <Select value={form.isActive ? "true" : "false"} onValueChange={(v) => setForm({ ...form, isActive: v === "true" })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Verification Status</Label>
        <Select value={form.verificationStatus} onValueChange={(v) => setForm({ ...form, verificationStatus: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERIFICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Verification Comment</Label>
        <Input className="h-8 text-xs" value={form.verificationComment} onChange={(e) => setForm({ ...form, verificationComment: e.target.value })} placeholder="Rejection reason…" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Sponsor Tutor ID (UUID)</Label>
        <Input className="h-8 text-xs font-mono" value={form.sponsorTutorId} onChange={(e) => setForm({ ...form, sponsorTutorId: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      </div>
    </div>
  );
}

async function devFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api/proxy${url}`, { ...options, headers });
  const data = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : await res.text();
  if (!res.ok) throw new Error((data as any)?.error || "Request failed");
  return data;
}

export default function DevPage() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...BLANK_FORM });

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ ...BLANK_FORM });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await devFetch("/v1/dev/users");
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type: "ok" | "err", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 3500);
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const startEdit = (u: DevUser) => {
    setEditingId(u.userId);
    setEditForm({
      role: u.role,
      displayName: u.displayName || "",
      email: u.email || "",
      phoneNumber: u.phoneNumber || "",
      isActive: u.isActive,
      verificationStatus: u.verificationStatus,
      verificationComment: u.verificationComment || "",
      sponsorTutorId: u.sponsorTutorId || "",
    });
    setShowCreate(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await devFetch(`/v1/dev/users/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          displayName: editForm.displayName || null,
          email: editForm.email || null,
          phoneNumber: editForm.phoneNumber || null,
          verificationComment: editForm.verificationComment || null,
          sponsorTutorId: editForm.sponsorTutorId || null,
        }),
      });
      flash("ok", "User updated");
      setEditingId(null);
      await load();
    } catch (e: any) {
      flash("err", e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Create ─────────────────────────────────────────────────────────────────
  const saveCreate = async () => {
    setSaving(true);
    try {
      await devFetch("/v1/dev/users", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          displayName: createForm.displayName || null,
          email: createForm.email || null,
          phoneNumber: createForm.phoneNumber || null,
        }),
      });
      flash("ok", "User created");
      setShowCreate(false);
      setCreateForm({ ...BLANK_FORM });
      await load();
    } catch (e: any) {
      flash("err", e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteUser = async (userId: string) => {
    if (!confirm(`Hard delete user ${userId}? This is irreversible.`)) return;
    setDeleting(userId);
    try {
      await devFetch(`/v1/dev/users/${userId}`, { method: "DELETE" });
      flash("ok", "User deleted");
      await load();
    } catch (e: any) {
      flash("err", e.message);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = users.filter((u) => {
    if (filterRole !== "ALL" && u.role !== filterRole) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      u.userId.toLowerCase().includes(q) ||
      (u.displayName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Dev mode is not available in production.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-500/10 rounded-xl">
          <Terminal className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Dev Mode
            <Badge className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">DEVELOPMENT ONLY</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Manage all user accounts — not available in production</p>
        </div>
      </div>

      {actionMsg && (
        <Alert className={actionMsg.type === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}>
          {actionMsg.type === "ok"
            ? <Check className="h-4 w-4 text-emerald-600" />
            : <AlertTriangle className="h-4 w-4 text-red-600" />}
          <AlertDescription className={actionMsg.type === "ok" ? "text-emerald-700" : "text-red-700"}>
            {actionMsg.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Search name / email / ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          {(["ALL", ...ROLES] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r as Role | "ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${filterRole === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
            >
              {r === "ALL" ? "All" : r}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5 h-9">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => { setShowCreate(true); setEditingId(null); }} className="gap-1.5 h-9 bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-3.5 w-3.5" /> New User
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-orange-500" /> Create New User
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormFields form={createForm} setForm={setCreateForm} />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={saveCreate} disabled={saving}>
                <Check className="h-3.5 w-3.5 mr-1" /> Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">{filtered.length} users</p>
          {filtered.map((u) => {
            const meta = ROLE_META[u.role] || ROLE_META.STUDENT;
            const isEditing = editingId === u.userId;
            return (
              <Card key={u.userId} className={`border ${isEditing ? "border-orange-500/50 bg-orange-500/5" : "border-border"}`}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-mono text-muted-foreground">{u.userId}</p>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <FormFields form={editForm} setForm={setEditForm} />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={saveEdit} disabled={saving}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] font-bold gap-1 ${meta.color}`}>
                              {meta.icon} {meta.label}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] font-bold ${u.isActive ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/5" : "text-red-600 border-red-500/30 bg-red-500/5"}`}>
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="font-bold text-sm text-foreground truncate">{u.displayName || <span className="italic text-muted-foreground">no name</span>}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Phone</p>
                          <p className="text-xs font-mono">{u.phoneNumber || "—"}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1.5">OAuth</p>
                          <p className="text-xs">{u.oauthIdentities.map((o) => o.provider).join(", ") || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Verification</p>
                          <Badge variant="outline" className={`text-[10px] ${
                            u.verificationStatus === "VERIFIED" ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/5" :
                            u.verificationStatus === "PENDING" ? "text-amber-600 border-amber-500/30 bg-amber-500/5" :
                            u.verificationStatus === "REJECTED" ? "text-red-600 border-red-500/30 bg-red-500/5" : ""
                          }`}>
                            {u.verificationStatus}
                          </Badge>
                          {u.verificationComment && (
                            <p className="text-xs text-muted-foreground italic truncate">{u.verificationComment}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">User ID</p>
                          <p className="text-[10px] font-mono text-muted-foreground break-all">{u.userId}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("th-TH")}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => startEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-red-600 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => deleteUser(u.userId)}
                          disabled={deleting === u.userId}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div className="py-16 flex flex-col items-center text-muted-foreground">
              <User className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">No users found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
