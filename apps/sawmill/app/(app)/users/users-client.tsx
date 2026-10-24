"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Lock,
  Plus,
  Trash2,
  Unlock,
  UserCheck,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { type SawmillRole } from "@/lib/auth/roles";
import { type Locale, t } from "@/lib/i18n";
import {
  archiveUserAction,
  changeUserPasswordAction,
  toggleLockUserAction,
  updateUserRoleAction,
  type UserItem,
} from "./actions";
import { UserDialog } from "./user-dialog";

interface UsersClientProps {
  initialUsers: UserItem[];
  currentUserId: string;
  canManage: boolean;
  locale: Locale;
}

export function UsersClient({
  initialUsers,
  currentUserId,
  canManage,
  locale,
}: UsersClientProps) {
  const router = useRouter();
  const [usersList] = React.useState<UserItem[]>(initialUsers);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Archive modal
  const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(null);

  // Change password modal
  const [passwordTargetUser, setPasswordTargetUser] = React.useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const roleLabels: Record<SawmillRole, string> = {
    owner: t("role_owner", locale),
    accountant: t("role_accountant", locale),
    viewer: t("role_viewer", locale),
  };

  const handleToggleLock = async (u: UserItem) => {
    if (u.id === currentUserId) return;
    await toggleLockUserAction(u.id);
    router.refresh();
  };

  const handleRoleChange = async (userId: string, newRole: SawmillRole) => {
    await updateUserRoleAction(userId, newRole);
    router.refresh();
  };

  const handleConfirmArchive = async () => {
    if (!archiveTargetId) return;
    await archiveUserAction(archiveTargetId);
    setArchiveTargetId(null);
    router.refresh();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;
    setSavingPassword(true);
    setPasswordError(null);

    const res = await changeUserPasswordAction(passwordTargetUser.id, newPassword);
    setSavingPassword(false);

    if (!res.ok) {
      setPasswordError(res.error || t("status_error", locale));
      return;
    }

    setPasswordTargetUser(null);
    setNewPassword("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {t("users_title", locale)}
          </h1>
          <p className="text-body text-muted-foreground">
            {t("users_subtitle", locale)}
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            <span>{t("users_add", locale)}</span>
          </Button>
        )}
      </div>

      {/* Users List Table */}
      <Card className="overflow-hidden border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-body">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-caption">
                <th className="p-3 font-semibold">{t("users_name", locale)}</th>
                <th className="p-3 font-semibold">{t("users_phone", locale)}</th>
                <th className="p-3 font-semibold">{t("users_role", locale)}</th>
                <th className="p-3 font-semibold">Holat</th>
                <th className="p-3 font-semibold text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {t("users_empty", locale)}
                  </td>
                </tr>
              ) : (
                usersList.map((u) => {
                  const isSelf = u.id === currentUserId;
                  const isLocked = !!u.lockedAt;

                  return (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{u.name}</span>
                          {isSelf && (
                            <Badge tone="info" className="text-2xs">
                              Siz
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-caption text-muted-foreground">
                        {u.phone}
                      </td>
                      <td className="p-3">
                        {canManage && !isSelf ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as SawmillRole)}
                            className="h-8 px-2 rounded-control border border-border bg-card text-foreground text-caption focus:outline-none"
                          >
                            <option value="owner">{roleLabels.owner}</option>
                            <option value="accountant">{roleLabels.accountant}</option>
                            <option value="viewer">{roleLabels.viewer}</option>
                          </select>
                        ) : (
                          <Badge
                            tone={
                              u.role === "owner"
                                ? "info"
                                : u.role === "accountant"
                                  ? "success"
                                  : "neutral"
                            }
                          >
                            {roleLabels[u.role]}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {isLocked ? (
                          <Badge tone="danger" className="gap-1">
                            <Lock className="size-3" />
                            <span>{t("users_locked_status", locale)}</span>
                          </Badge>
                        ) : (
                          <Badge tone="success" className="gap-1">
                            <UserCheck className="size-3" />
                            <span>{t("users_active_status", locale)}</span>
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            {/* Change Password */}
                            <button
                              type="button"
                              onClick={() => setPasswordTargetUser(u)}
                              className="p-1.5 rounded-btn text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title={t("users_password", locale)}
                            >
                              <KeyRound className="size-4" />
                            </button>

                            {/* Lock / Unlock */}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleToggleLock(u)}
                                className={`p-1.5 rounded-btn transition-colors cursor-pointer ${
                                  isLocked
                                    ? "text-emerald-600 hover:bg-emerald-500/10"
                                    : "text-amber-600 hover:bg-amber-500/10"
                                }`}
                                title={isLocked ? t("users_unlock", locale) : t("users_lock", locale)}
                              >
                                {isLocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                              </button>
                            )}

                            {/* Archive */}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => setArchiveTargetId(u.id)}
                                className="p-1.5 rounded-btn text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title={t("users_delete", locale)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Create Dialog */}
      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} locale={locale} />

      {/* Change Password Modal */}
      <Modal
        open={!!passwordTargetUser}
        onOpenChange={(open) => !open && setPasswordTargetUser(null)}
        title={`${t("users_password", locale)}: ${passwordTargetUser?.name ?? ""}`}
        position="center"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
          {passwordError && (
            <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
              {passwordError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Yangi parol *</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Kamida 8 ta belgi"
              required
              minLength={8}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPasswordTargetUser(null)}
              disabled={savingPassword}
            >
              {t("action_cancel", locale)}
            </Button>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? t("status_loading", locale) : t("action_save", locale)}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Archive Modal */}
      <ConfirmModal
        open={!!archiveTargetId}
        onOpenChange={(open) => !open && setArchiveTargetId(null)}
        title={t("users_delete", locale)}
        message={t("users_delete_confirm", locale)}
        confirmLabel={t("users_delete", locale)}
        cancelLabel={t("action_cancel", locale)}
        onConfirm={handleConfirmArchive}
      />
    </div>
  );
}
