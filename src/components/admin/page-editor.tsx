"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { savePageAction } from "@/server/actions/pages";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { safeAction } from "@/lib/safe-action";

export function PageEditor({
  slug,
  publicPath,
  defaultTitle,
  defaultContent,
}: {
  slug: string;
  publicPath: string;
  defaultTitle: string;
  defaultContent: string;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(defaultTitle);
  const [content, setContent] = React.useState(defaultContent);
  const [saving, setSaving] = React.useState(false);

  async function onSave() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await safeAction(() => savePageAction(slug, { title, content }));
      if (result.ok) {
        toast.success("Page saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 rounded-card border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{defaultTitle}</h2>
        <div className="flex gap-2">
          <Link href={publicPath} target="_blank" className={buttonClasses("outline", "sm")}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View page
          </Link>
          <Button size="sm" onClick={() => void onSave()} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden />
            )}
            Save
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="page-title">Title</Label>
        <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="page-content">Content (Markdown)</Label>
        <MarkdownEditor id="page-content" value={content} onChange={setContent} rows={22} />
      </div>
    </div>
  );
}
