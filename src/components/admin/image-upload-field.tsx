"use client";

import * as React from "react";
import { ImagePlus, Link2, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import type { UploadKind } from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ImageUploadField({
  label,
  kind,
  value,
  onChange,
  hint,
  onDelete,
  onDiscardUpload,
}: {
  label: string;
  kind: UploadKind;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  /**
   * Optional server-side cleanup for the *current* value, called before the
   * field is cleared — wired to deleteCourseImageAction/deleteUploadedFileAction
   * by callers that have somewhere to actually delete the file from. Callers
   * that don't pass this keep the previous plain-clear behavior.
   */
  onDelete?: () => Promise<{ ok: boolean; error?: string }>;
  /**
   * Optional cleanup for a file that was uploaded in this session and then
   * cancelled before saving. Without it, "Cancel" still restores the previous
   * image in the form; the freshly-uploaded file just stays on disk until the
   * next save-time sweep.
   */
  onDiscardUpload?: (path: string) => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [urlMode, setUrlMode] = React.useState(false);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  /**
   * The image that was showing before the admin picked a replacement in this
   * session. Non-null means there is an unsaved change that "Cancel" can undo.
   */
  const [replacedValue, setReplacedValue] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);
  const inputId = React.useId();

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function onFile(file: File) {
    if (busy) return;
    setBusy(true);
    const previous = value;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setLocalPreview(localUrl);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error ?? "Upload failed");
      onChange(data.path);
      // Only remember the replaced image once the upload actually succeeded, so
      // a failed upload leaves the original image (and the form) untouched.
      if (previous) setReplacedValue((prev) => prev ?? previous);
      toast.success(previous ? "Image replaced — save to apply" : "Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setLocalPreview(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /** Undo an unsaved replacement: restore the previous image, drop the new file. */
  async function cancelReplacement() {
    if (busy || replacedValue === null) return;
    const discarded = value;
    onChange(replacedValue);
    setReplacedValue(null);
    if (onDiscardUpload && discarded && discarded.startsWith("/uploads/") && discarded !== replacedValue) {
      await onDiscardUpload(discarded);
    }
    toast.success("Reverted to the previous image");
  }

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    try {
      if (onDelete) {
        const result = await onDelete();
        if (!result.ok) {
          toast.error(result.error ?? "Failed to remove image");
          return;
        }
      }
      onChange("");
      setReplacedValue(null);
      toast.success("Image removed");
      setConfirmOpen(false);
    } catch (err) {
      // Last-resort guard: onDelete callbacks talk to server actions, which
      // reject outright on an expired session or a stale post-deploy bundle.
      // Surface it here instead of letting it escape as an unhandled rejection.
      console.error("[image-upload] delete failed:", err);
      toast.error("Couldn't remove the image. Reload the page and try again.");
    } finally {
      setBusy(false);
    }
  }

  const displaySrc = localPreview ?? value;
  const showingLocalPreview = localPreview !== null;
  const hasUnsavedReplacement = replacedValue !== null;

  const fileInput = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void onFile(file);
      }}
    />
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>

      {displaySrc ? (
        // An image is set: show it with explicit, always-visible controls.
        // (These used to be a single hover-only "x" overlay, which gave no way
        // to replace an image at all and was unreachable on touch devices.)
        <div className="space-y-3">
          <div className="relative w-fit max-w-full overflow-hidden rounded-nested border border-border bg-muted/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc}
              alt={`${label} preview`}
              className={cn("h-28 w-auto max-w-full object-contain", showingLocalPreview && "opacity-70")}
            />
            {showingLocalPreview && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
              </div>
            )}
            {/* Sits over arbitrary artwork, so this chip uses fixed dark styling with
                amber text rather than theme background tokens — readable in both
                themes and over any image. */}
            {hasUnsavedReplacement && !showingLocalPreview && (
              <span className="absolute top-1.5 left-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-warning ring-1 ring-white/15">
                Unsaved
              </span>
            )}
          </div>

          {fileInput}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              {busy ? "Uploading…" : `Replace ${label.toLowerCase()}`}
            </Button>
            {hasUnsavedReplacement && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void cancelReplacement()}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </Button>
          </div>
          {hasUnsavedReplacement && (
            <FieldHint>New image selected — it is applied when you save this course.</FieldHint>
          )}
        </div>
      ) : urlMode ? (
        <div className="flex gap-2">
          <Input
            id={inputId}
            placeholder="https://example.com/image.jpg"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onChange((e.target as HTMLInputElement).value.trim());
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) onChange(v);
            }}
          />
          <Button type="button" variant="outline" onClick={() => setUrlMode(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {fileInput}
          <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            {busy ? "Uploading…" : "Upload image"}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setUrlMode(true)}>
            <Link2 className="h-4 w-4" aria-hidden />
            Use URL
          </Button>
        </div>
      )}

      {hint && <FieldHint>{hint}</FieldHint>}

      <Dialog open={confirmOpen} onOpenChange={(open) => !busy && setConfirmOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Remove {label.toLowerCase()}?</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            This clears the image straight away and can&apos;t be undone.
          </DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" disabled={busy} onClick={confirmDelete}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
