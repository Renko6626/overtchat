"use client";

import { useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Gauge, KeyRound, Plus, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { getErrorMessage } from "@/lib/errors";
import {
  useQuotaOverview,
  useSetDefaultQuota,
  type QuotaOverride,
} from "@/lib/queries/userQuotas";
import {
  useInvalidateUsers,
  useSetUserRole,
  useUsers,
} from "@/lib/queries/users";
import type { UserRole, UserRow } from "@/lib/queries/users";
import { motionClasses } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  SettingsNotice,
  SettingsPage,
  SettingsPageHeader,
  SettingsRow,
  SettingsSection,
} from "../SettingsRows";
import { AddUserDialog } from "./AddUserDialog";
import { QuotaDialog } from "./QuotaDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { ResetTwoFactorDialog } from "./ResetTwoFactorDialog";

type PendingRoleChange = {
  user: UserRow;
  role: UserRole;
};

export function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const { data: users = [] } = useUsers();
  const { data: overview } = useQuotaOverview();
  const invalidateUsers = useInvalidateUsers();
  const setRoleMutation = useSetUserRole();
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [twoFactorTarget, setTwoFactorTarget] = useState<UserRow | null>(null);
  const [quotaTarget, setQuotaTarget] = useState<UserRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const [pendingRoleChange, setPendingRoleChange] =
    useState<PendingRoleChange | null>(null);
  const [roleError, setRoleError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete || pendingDelete.id === currentUserId) return;
    const email = pendingDelete.email;
    setDeleting(true);
    setDeleteError("");
    const { error } = await authClient.admin.removeUser({
      userId: pendingDelete.id,
    });
    if (error) {
      setDeleteError(error.message ?? "Failed to delete user.");
      setDeleting(false);
      return;
    }
    invalidateUsers();
    setPendingDelete(null);
    setDeleting(false);
    toast.success({
      title: "User deleted",
      description: email,
    });
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return;
    setRoleError("");
    try {
      await setRoleMutation.mutateAsync({
        userId: pendingRoleChange.user.id,
        role: pendingRoleChange.role,
      });
      toast.success({
        title:
          pendingRoleChange.role === "admin"
            ? "Administrator access granted"
            : "Administrator access removed",
        description: pendingRoleChange.user.email,
      });
      setPendingRoleChange(null);
    } catch (cause) {
      setRoleError(
        cause instanceof Error ? cause.message : "The role could not be changed.",
      );
    }
  }

  return (
    <SettingsPage>
      <SettingsPageHeader
        title="Users"
        description="Manage who can sign in to this server."
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add user
          </Button>
        }
      />

      <SettingsSection
        title="Monthly quotas"
        description="Cap what each person spends per calendar month (UTC) on models using this server's API keys. Administrators are always unlimited."
      >
        {overview ? (
          <DefaultQuotaEditor
            key={String(overview.defaultMonthlyLimitUsd)}
            value={overview.defaultMonthlyLimitUsd}
          />
        ) : (
          <SettingsNotice>Loading quota settings…</SettingsNotice>
        )}
      </SettingsSection>

      <SettingsSection
        title="People"
        description={`${users.length} user${users.length === 1 ? "" : "s"} configured.`}
        contentClassName="overflow-x-auto divide-y-0"
      >
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Name</th>
              <th className="px-3 py-2.5 text-left font-medium">Email</th>
              <th className="px-3 py-2.5 text-left font-medium">Role</th>
              <th className="px-3 py-2.5 text-left font-medium">Two-factor</th>
              <th className="px-3 py-2.5 text-left font-medium">Quota / month</th>
              <th className="px-3 py-2.5 text-left font-medium">Created</th>
              <th className="px-3 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium text-foreground">
                  {u.name}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-3 py-3">
                  {u.id === currentUserId ? (
                    <span className="text-muted-foreground">
                      {formatRole(u.role)}
                    </span>
                  ) : (
                    <Select
                      value={normalizeRole(u.role)}
                      disabled={setRoleMutation.isPending}
                      onValueChange={(next) => {
                        const role = next as UserRole;
                        if (role === normalizeRole(u.role)) return;
                        setRoleError("");
                        setPendingRoleChange({ user: u, role });
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Role for ${u.email}`}
                        className="w-28"
                      >
                        <SelectValue>{formatRole(u.role)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {u.twoFactorEnabled ? "On" : "Off"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {!overview ? (
                    "…"
                  ) : normalizeRole(u.role) === "admin" ? (
                    "Unlimited"
                  ) : (
                    <QuotaCell
                      override={overview.overrides.find(
                        (entry) => entry.userId === u.id,
                      )}
                      defaultLimitUsd={overview.defaultMonthlyLimitUsd}
                      spentUsd={overview.monthlyCostsUsd[u.id] ?? 0}
                    />
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-3 text-right">
                  {u.id === currentUserId ? (
                    <span className="text-xs text-muted-foreground">
                      Current user
                    </span>
                  ) : (
                    <div className="flex justify-end gap-1">
                      {normalizeRole(u.role) !== "admin" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuotaTarget(u)}
                        >
                          <Gauge data-icon="inline-start" /> Quota
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setResetTarget(u)}
                      >
                        <KeyRound data-icon="inline-start" /> Reset password
                      </Button>
                      {u.twoFactorEnabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTwoFactorTarget(u)}
                        >
                          <ShieldOff data-icon="inline-start" /> Reset two-factor
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteError("");
                          setPendingDelete(u);
                        }}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsSection>

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={invalidateUsers}
      />
      {twoFactorTarget && (
        <ResetTwoFactorDialog
          key={twoFactorTarget.id}
          target={twoFactorTarget}
          onClose={() => setTwoFactorTarget(null)}
          onReset={invalidateUsers}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          key={resetTarget.id}
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {quotaTarget && (
        <QuotaDialog
          key={quotaTarget.id}
          target={quotaTarget}
          override={overview?.overrides.find(
            (entry) => entry.userId === quotaTarget.id,
          )}
          defaultLimitUsd={overview?.defaultMonthlyLimitUsd ?? null}
          onClose={() => setQuotaTarget(null)}
        />
      )}

      <AlertDialog.Root
        open={pendingRoleChange !== null}
        onOpenChange={(next) => {
          if (!next && !setRoleMutation.isPending) {
            setPendingRoleChange(null);
            setRoleError("");
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop
            className={cn("fixed inset-0 z-40 bg-black/40", motionClasses.overlay)}
          />
          <AlertDialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none",
              motionClasses.dialog,
            )}
          >
            <AlertDialog.Title className="text-base font-semibold tracking-tight">
              {pendingRoleChange?.role === "admin"
                ? "Grant administrator access?"
                : "Remove administrator access?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {pendingRoleChange?.role === "admin" ? (
                <>
                  <span className="font-medium text-foreground">
                    {pendingRoleChange.user.email}
                  </span>{" "}
                  will be able to manage users, models, and agent workspaces,
                  including running code and opening SSH connections from this
                  server.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {pendingRoleChange?.user.email}
                  </span>{" "}
                  will lose administrator features. Their active agent runs
                  will stop.
                </>
              )}{" "}
              They will be signed out on all devices.
            </AlertDialog.Description>
            {roleError && (
              <SettingsNotice tone="error" className="mt-3 text-xs">
                {roleError}
              </SettingsNotice>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Close
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setRoleMutation.isPending}
                  />
                }
              >
                Cancel
              </AlertDialog.Close>
              <Button
                size="sm"
                disabled={setRoleMutation.isPending}
                onClick={() => void confirmRoleChange()}
              >
                {setRoleMutation.isPending
                  ? "Updating…"
                  : pendingRoleChange?.role === "admin"
                    ? "Make admin"
                    : "Make user"}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setPendingDelete(null);
            setDeleteError("");
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop
            className={cn("fixed inset-0 z-40 bg-black/40", motionClasses.overlay)}
          />
          <AlertDialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none",
              motionClasses.dialog,
            )}
          >
            <AlertDialog.Title className="text-base font-semibold tracking-tight">
              Delete user?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {pendingDelete?.email}
              </span>{" "}
              will no longer be able to sign in. Existing chats and projects are
              not deleted.
            </AlertDialog.Description>
            {deleteError && (
              <SettingsNotice tone="error" className="mt-3 text-xs">
                {deleteError}
              </SettingsNotice>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Close
                render={
                  <Button variant="ghost" size="sm" disabled={deleting} />
                }
              >
                Cancel
              </AlertDialog.Close>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </SettingsPage>
  );
}

function formatRole(role: string | null | undefined): string {
  if (role === "admin") return "Admin";
  return "User";
}

function normalizeRole(role: string | null | undefined): UserRole {
  return role === "admin" ? "admin" : "user";
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function DefaultQuotaEditor({ value }: { value: number | null }) {
  const [mode, setMode] = useState<"unlimited" | "limit">(
    value === null ? "unlimited" : "limit",
  );
  const [amount, setAmount] = useState(value === null ? "" : String(value));
  const [error, setError] = useState("");
  const setDefaultQuota = useSetDefaultQuota();

  async function save() {
    let limit: number | null = null;
    if (mode === "limit") {
      const parsed = Number(amount);
      if (!amount.trim() || !Number.isFinite(parsed) || parsed < 0) {
        setError("Enter a monthly limit in USD (0 blocks all generation).");
        return;
      }
      limit = parsed;
    }
    setError("");
    try {
      await setDefaultQuota.mutateAsync(limit);
      toast.success({ title: "Default monthly quota updated" });
    } catch (cause) {
      setError(getErrorMessage(cause, "The quota could not be updated."));
    }
  }

  return (
    <>
      <SettingsRow
        title="Default for new and existing users"
        description="Per-user overrides below take precedence over this default."
        align="center"
      >
        <div className="flex items-center gap-2">
          <Select
            value={mode}
            onValueChange={(next) => {
              if (next === "unlimited" || next === "limit") setMode(next);
            }}
          >
            <SelectTrigger
              aria-label="Default quota mode"
              className="w-36"
            >
              <SelectValue>
                {mode === "unlimited" ? "Unlimited" : "Fixed limit"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unlimited">Unlimited</SelectItem>
              <SelectItem value="limit">Fixed limit</SelectItem>
            </SelectContent>
          </Select>
          {mode === "limit" && (
            <Input
              aria-label="Default monthly limit in USD"
              type="number"
              min={0}
              step="0.01"
              className="w-28"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          )}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={setDefaultQuota.isPending}
          >
            {setDefaultQuota.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SettingsRow>
      {error && (
        <SettingsNotice tone="error" className="py-2 text-xs">
          {error}
        </SettingsNotice>
      )}
    </>
  );
}

function QuotaCell({
  override,
  defaultLimitUsd,
  spentUsd,
}: {
  override: QuotaOverride | undefined;
  defaultLimitUsd: number | null;
  spentUsd: number;
}) {
  let limit: number | null;
  let inherited = false;
  if (override?.mode === "unlimited") {
    limit = null;
  } else if (override?.mode === "limit") {
    limit = override.monthlyLimitUsd ?? 0;
  } else {
    limit = defaultLimitUsd;
    inherited = true;
  }
  return (
    <div>
      <div>
        {limit === null ? "Unlimited" : formatUsd(limit)}
        {inherited && limit !== null ? " (default)" : ""}
      </div>
      <div className="text-xs">{formatUsd(spentUsd)} used</div>
    </div>
  );
}
