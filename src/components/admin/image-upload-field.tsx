"use client";

import * as React from "react";
import { ImagePlus, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { UploadKind } from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/input";

export function ImageUploadField({
  label,
  kind,
  value,
  onChange,
  hint,
}: {
  label: string;
  kind: UploadKind;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [urlMode, setUrlMode] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();

  async function onFile(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error ?? "Upload failed");
      onChange(data.path);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {value ? (
        <div className="group relative w-fit overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-28 w-auto max-w-full object-cover" />
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={() => onChange("")}
            className="absolute top-1.5 right-1.5 cursor-pointer rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
          <Button variant="outline" onClick={() => setUrlMode(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
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
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4" aria-hidden />
            )}
            {uploading ? "Uploading…" : "Upload image"}
          </Button>
          <Button variant="ghost" onClick={() => setUrlMode(true)}>
            <Link2 className="h-4 w-4" aria-hidden />
            Use URL
          </Button>
        </div>
      )}
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}
