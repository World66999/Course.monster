"use client";

import * as React from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportContentAction } from "@/server/actions/reports";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Label, FieldHint, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REASONS = [
  { value: "SPAM", label: "Spam" },
  { value: "ABUSE", label: "Abusive or hateful" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "OFF_TOPIC", label: "Off-topic" },
  { value: "OTHER", label: "Other" },
] as const;

export function ReportButton({
  target,
}: {
  target:
    | { commentId: string }
    | { reviewId: string }
    | { chatMessageId: string }
    | { courseRequestId: string }
    | { requestCommentId: string }
    | { codingChannelId: string }
    | { learningResourceId: string }
    | { appListingId: string };
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<(typeof REASONS)[number]["value"]>("SPAM");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const result = await safeAction(() => reportContentAction({ ...target, reason, note }), "report content");
      if (result.ok) {
        toast.success("Thanks — this has been reported to moderators.");
        setOpen(false);
        setNote("");
      } else {
        toast.error(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // 16px tall as drawn — see the ACTION_BUTTON note in
        // components/site/comments/comment-item.tsx; this button sits in the same
        // row and gets the same 44px reach on a coarse pointer.
        className="tap-target inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Report
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Report content</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Let us know what&apos;s wrong — a moderator will review it.
          </DialogDescription>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                <SelectTrigger aria-label="Report reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-note">Additional details (optional)</Label>
              <Textarea
                id="report-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <FieldHint>Never share personal information here.</FieldHint>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={submit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Submit report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
