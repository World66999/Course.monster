"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccountAction } from "@/server/actions/profile";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { PasswordField } from "@/components/auth/password-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function DangerZone({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    setBusy(true);
    const result = await safeAction(() => deleteAccountAction({ currentPassword: password }), "delete account");
    if (!result.ok) {
      toast.error(result.error);
      setBusy(false);
      return;
    }
    // Client-side signOut so the session context (and every component
    // reading it) clears instantly, then redirect.
    await signOut({ callbackUrl: "/" });
  }

  return (
    <section className="space-y-3 rounded-card border border-destructive/30 bg-destructive/5 p-6">
      <div>
        <h2 className="font-semibold text-destructive">Delete account</h2>
        <p className="text-sm text-muted-foreground">
          Permanently disables your account and removes your personal info. Your past comments and reviews
          stay visible, attributed to a deleted user.
        </p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            This can&apos;t be undone. You&apos;ll be signed out immediately.
          </DialogDescription>
          {hasPassword && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="delete-password">Confirm your password</Label>
              <PasswordField
                id="delete-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy || (hasPassword && !password)} onClick={onDelete}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
