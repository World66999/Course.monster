"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { updateAvatarAction } from "@/server/actions/profile";
import { safeAction } from "@/lib/safe-action";

export function AvatarUpload({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const { update } = useSession();
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function onFile(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/avatar", { method: "POST", body });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error ?? "Upload failed");
      const result = await safeAction(() => updateAvatarAction(data.path), "update avatar");
      if (!result.ok) throw new Error(result.error);
      toast.success("Avatar updated");
      await update({ image: data.path });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {image ? (
          <Image src={image} alt="Your profile photo" fill unoptimized className="rounded-full object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
            {initials || "?"}
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change avatar"
          className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-transform hover:scale-105"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Camera className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </div>
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">JPEG, PNG, WebP or GIF, up to 8 MB.</p>
      </div>
    </div>
  );
}
