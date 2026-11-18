"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import type { QuotaMode, QuotaOverride } from "@/lib/queries/userQuotas";
import { useSetUserQuota } from "@/lib/queries/userQuotas";
import type { UserRow } from "@/lib/queries/users";
import { cn } from "@/lib/utils";
import { motionClasses } from "@/lib/motion";
import { SettingsActions, SettingsNotice } from "../SettingsRows";

const MODE_LABELS: Record<QuotaMode, string> = {
  inherit: "Use server default",
  unlimited: "Unlimited",
  limit: "Fixed monthly limit",
};

export function QuotaDialog({
  target,
  override,
  defaultLimitUsd,
  onClose,
}: {
  target: UserRow;
  override: QuotaOverride | undefined;
  defaultLimitUsd: number | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<QuotaMode>(override?.mode ?? "inherit");
  const [amount, setAmount] = useState(
    override?.mode === "limit" && override.monthlyLimitUsd !== null
      ? String(override.monthlyLimitUsd)
      : defaultLimitUsd !== null
        ? String(defaultLimitUsd)
        : "",
  );
  const [error, setError] = useState("");
  const setUserQuota = useSetUserQuota();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (setUserQuota.isPending) return;
    let monthlyLimitUsd: number | null = null;
    if (mode === "limit") {
      const parsed = Number(amount);
      if (!amount.trim() || !Number.isFinite(parsed) || parsed < 0) {
        setError("Enter a monthly limit in USD (0 blocks all generation).");
        return;
      }
      monthlyLimitUsd = parsed;
    }
    setError("");
    try {
      await setUserQuota.mutateAsync({
        userId: target.id,
        mode,
        monthlyLimitUsd,
      });
      toast.success({
        title: "Quota updated",
        description: target.email,
      });
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause, "The quota could not be updated."));
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !setUserQuota.isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-40 bg-black/40",
            motionClasses.overlay,
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none",
            motionClasses.dialog,
          )}
        >
          <Dialog.Title className="text-lg font-semibold tracking-tight">
            Monthly quota
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Limit what {target.email} can spend per calendar month (UTC) on
            models running with this server&apos;s API keys. Generations on
            their own keys are not counted.
          </Dialog.Description>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="quota-mode">Quota</Label>
              <Select
                value={mode}
                onValueChange={(next) => {
                  if (next) setMode(next as QuotaMode);
                }}
              >
                <SelectTrigger id="quota-mode" className="w-full">
                  <SelectValue>{MODE_LABELS[mode]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">
                    Use server default
                    {defaultLimitUsd === null
                      ? " (unlimited)"
                      : ` ($${defaultLimitUsd.toFixed(2)})`}
                  </SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                  <SelectItem value="limit">Fixed monthly limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "limit" && (
              <div className="space-y-1.5">
                <Label htmlFor="quota-amount">Monthly limit (USD)</Label>
                <Input
                  id="quota-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={setUserQuota.isPending}
                />
              </div>
            )}
            {error && <SettingsNotice tone="error">{error}</SettingsNotice>}
            <SettingsActions bordered={false} className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={setUserQuota.isPending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={setUserQuota.isPending}>
                {setUserQuota.isPending ? "Saving…" : "Save quota"}
              </Button>
            </SettingsActions>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}