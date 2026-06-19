"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Shield, Plus, Loader2, UserX } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type AdminUser = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
};

export default function RolesPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"ADMIN" | "FINANCE_CHECKER">("FINANCE_CHECKER");

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth("/v1/admin/roles");
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error(t("roles.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleSaveRole = async () => {
    if (!formEmail.trim()) return;

    try {
      setIsSaving(true);
      await fetchWithAuth("/v1/admin/roles", {
        method: "POST",
        body: JSON.stringify({
          email: formEmail,
          role: formRole,
        }),
      });

      toast.success(t("roles.success"));
      setIsModalOpen(false);
      setFormEmail("");
      loadRoles();
    } catch (error) {
      console.error(error);
      toast.error(t("roles.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              {t("roles.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roles.description")}
            </p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="shrink-0 shadow-sm inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-brand-600 text-white shadow hover:bg-brand-600/90 h-9 px-4 py-2">
            <Plus className="mr-2 h-4 w-4" />
            {t("roles.addRoleBtn")}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input
              placeholder={t("roles.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white dark:bg-zinc-900/50"
            />
            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900/50 [&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100 dark:hover:bg-slate-800/50 dark:data-[state=selected]:bg-slate-800">
                <th className="h-10 px-2 text-left align-middle font-medium text-slate-500 [&:has([role=checkbox])]:pr-0 dark:text-slate-400">{t("roles.nameCol")}</th>
                <th className="h-10 px-2 text-left align-middle font-medium text-slate-500 [&:has([role=checkbox])]:pr-0 dark:text-slate-400">{t("roles.emailCol")}</th>
                <th className="h-10 px-2 text-left align-middle font-medium text-slate-500 [&:has([role=checkbox])]:pr-0 dark:text-slate-400">{t("roles.roleCol")}</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100 dark:hover:bg-slate-800/50 dark:data-[state=selected]:bg-slate-800">
                  <td colSpan={3} className="p-2 align-middle [&:has([role=checkbox])]:pr-0 h-48 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100 dark:hover:bg-slate-800/50 dark:data-[state=selected]:bg-slate-800">
                  <td colSpan={3} className="p-2 align-middle [&:has([role=checkbox])]:pr-0 h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <UserX className="h-8 w-8 text-muted-foreground/40" />
                      <p>{t("roles.noUsers")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isPending = user.displayName === user.email.toLowerCase();
                  return (
                    <tr key={user.userId} className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100 dark:hover:bg-slate-800/50 dark:data-[state=selected]:bg-slate-800">
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0 font-medium">
                        {isPending ? (
                          <span className="text-muted-foreground italic">
                            {t("roles.pendingRegistration")}
                          </span>
                        ) : (
                          user.displayName || "-"
                        )}
                      </td>
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="p-2 align-middle [&:has([role=checkbox])]:pr-0">
                        <Badge
                          variant="secondary"
                          className={
                            user.role === "ADMIN"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }
                        >
                          {user.role}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogTitle>{t("roles.modalTitle")}</DialogTitle>
            <DialogDescription>{t("roles.modalDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("roles.emailLabel")}
              </label>
              <Input
                type="email"
                placeholder={t("roles.emailPlaceholder")}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("roles.roleLabel")}
              </label>
              <Select value={formRole} onValueChange={(v: "ADMIN" | "FINANCE_CHECKER") => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="FINANCE_CHECKER">FINANCE_CHECKER</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              type="submit"
              onClick={handleSaveRole}
              disabled={isSaving || !formEmail.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-brand-600 text-white shadow hover:bg-brand-600/90 h-9 px-4 py-2"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? t("roles.savingBtn") : t("roles.submitBtn")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
