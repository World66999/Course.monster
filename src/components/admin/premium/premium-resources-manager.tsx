"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  deletePremiumCategoryAction,
  deletePremiumResourceAction,
  savePremiumCategoryAction,
  savePremiumResourceAction,
  setPremiumCategoryOrderAction,
  setPremiumResourceOrderAction,
  togglePremiumResourcePublishedAction,
} from "@/server/actions/admin-premium-content";
import { PREMIUM_ICON_KEYS } from "@/lib/premium-content";
import { safeAction } from "@/lib/safe-action";
import { slugify } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumIcon } from "@/components/premium/premium-icon";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  count: number;
}
interface Resource {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  content: string;
  url: string | null;
  tags: string[];
  published: boolean;
  order: number;
}

type Result = { ok: boolean; error?: string };

function useRunner() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(
    async (fn: () => Promise<Result>, done?: string): Promise<boolean> => {
      setBusy(true);
      const res = await safeAction(fn);
      setBusy(false);
      if (res.ok) {
        if (done) toast.success(done);
        router.refresh();
        return true;
      }
      toast.error(res.error ?? "Failed");
      return false;
    },
    [router]
  );
  return { busy, run };
}

/**
 * Move one row up or down. The whole list is renumbered 0..n-1 in its new
 * order (only rows whose number changes are written), so legacy duplicate
 * order values can never make a move a no-op.
 */
async function swap<T extends { id: string; order: number }>(
  list: T[],
  index: number,
  dir: -1 | 1,
  setOrder: (input: { id: string; order: number }) => Promise<Result>
): Promise<Result> {
  const j = index + dir;
  if (j < 0 || j >= list.length) return { ok: true };
  const next = [...list];
  [next[index], next[j]] = [next[j]!, next[index]!];
  for (let k = 0; k < next.length; k++) {
    if (next[k]!.order === k) continue;
    const res = await setOrder({ id: next[k]!.id, order: k });
    if (!res.ok) return res;
  }
  return { ok: true };
}

export function PremiumResourcesManager({ categories, resources }: { categories: Category[]; resources: Resource[] }) {
  const { busy, run } = useRunner();
  const [editCat, setEditCat] = React.useState<Partial<Category> | null>(null);
  const [editRes, setEditRes] = React.useState<Partial<Resource> | null>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <section className="min-w-0 space-y-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Categories</h2>
          <Button size="sm" variant="outline" onClick={() => setEditCat({ order: categories.length })}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
        <ul className="space-y-1.5">
          {categories.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-muted">
              <PremiumIcon name={c.icon} className="h-4 w-4 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.count}</span>
              <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={busy || i === 0} onClick={() => run(() => swap(categories, i, -1, setPremiumCategoryOrderAction))}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={busy || i === categories.length - 1} onClick={() => run(() => swap(categories, i, 1, setPremiumCategoryOrderAction))}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditCat(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Delete"
                disabled={busy}
                onClick={() => confirm(`Delete category “${c.name}”?`) && run(() => deletePremiumCategoryAction(c.id), "Category deleted")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {categories.length === 0 && <li className="text-sm text-muted-foreground">No categories yet.</li>}
        </ul>
      </section>

      <section className="min-w-0 space-y-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Resources</h2>
          <Button size="sm" disabled={categories.length === 0} onClick={() => setEditRes({ categoryId: categories[0]?.id, published: false })}>
            <Plus className="h-4 w-4" /> New resource
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {resources.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {categories.find((c) => c.id === r.categoryId)?.name ?? "—"} {r.url && "· has link"}
                </p>
              </div>
              <Badge variant={r.published ? "success" : "secondary"}>{r.published ? "Published" : "Draft"}</Badge>
              <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={busy || i === 0} onClick={() => run(() => swap(resources, i, -1, setPremiumResourceOrderAction))}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={busy || i === resources.length - 1} onClick={() => run(() => swap(resources, i, 1, setPremiumResourceOrderAction))}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={r.published ? "Unpublish" : "Publish"} disabled={busy} onClick={() => run(() => togglePremiumResourcePublishedAction(r.id))}>
                {r.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditRes(r)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Delete"
                disabled={busy}
                onClick={() => confirm(`Delete “${r.title}”?`) && run(() => deletePremiumResourceAction(r.id), "Resource deleted")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {resources.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No resources yet.</li>}
        </ul>
      </section>

      <CategoryDialog value={editCat} onClose={() => setEditCat(null)} run={run} busy={busy} />
      <ResourceDialog value={editRes} categories={categories} onClose={() => setEditRes(null)} run={run} busy={busy} />
    </div>
  );
}

function CategoryDialog({
  value,
  onClose,
  run,
  busy,
}: {
  value: Partial<Category> | null;
  onClose: () => void;
  run: (fn: () => Promise<Result>, done?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [f, setF] = React.useState({ name: "", slug: "", description: "", icon: "", order: 0 });
  React.useEffect(() => {
    if (value) setF({ name: value.name ?? "", slug: value.slug ?? "", description: value.description ?? "", icon: value.icon ?? "", order: value.order ?? 0 });
  }, [value]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => savePremiumCategoryAction(value?.id ?? null, { ...f, slug: f.slug || slugify(f.name) }), "Category saved")) onClose();
  }
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">{value?.id ? "Edit category" : "New category"}</DialogTitle>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="space-y-1"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} /></div>
          <div className="space-y-1"><Label htmlFor="c-slug">Slug</Label><Input id="c-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={slugify(f.name)} maxLength={60} /></div>
          <div className="space-y-1"><Label htmlFor="c-desc">Description</Label><Textarea id="c-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} maxLength={300} /></div>
          <div className="space-y-1">
            <Label htmlFor="c-icon">Icon</Label>
            <Select value={f.icon || "layers"} onValueChange={(v) => setF({ ...f, icon: v })}>
              <SelectTrigger id="c-icon"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PREMIUM_ICON_KEYS.map((k) => (
                  <SelectItem key={k} value={k}><span className="inline-flex items-center gap-2"><PremiumIcon name={k} className="h-4 w-4" />{k}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResourceDialog({
  value,
  categories,
  onClose,
  run,
  busy,
}: {
  value: Partial<Resource> | null;
  categories: Category[];
  onClose: () => void;
  run: (fn: () => Promise<Result>, done?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const empty = { categoryId: "", title: "", summary: "", content: "", url: "", tags: "", published: false, order: 0 };
  const [f, setF] = React.useState(empty);
  React.useEffect(() => {
    if (value)
      setF({
        categoryId: value.categoryId ?? categories[0]?.id ?? "",
        title: value.title ?? "",
        summary: value.summary ?? "",
        content: value.content ?? "",
        url: value.url ?? "",
        tags: (value.tags ?? []).join(", "),
        published: value.published ?? false,
        order: value.order ?? 0,
      });
  }, [value, categories]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => savePremiumResourceAction(value?.id ?? null, f), "Resource saved")) onClose();
  }
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold">{value?.id ? "Edit resource" : "New resource"}</DialogTitle>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="r-cat">Category</Label>
            <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}>
              <SelectTrigger id="r-cat"><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="r-title">Title (public)</Label><Input id="r-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={140} /></div>
          <div className="space-y-1"><Label htmlFor="r-sum">Summary (public)</Label><Textarea id="r-sum" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} rows={2} required maxLength={400} /></div>
          <div className="space-y-1"><Label htmlFor="r-content">Content — Markdown (Premium only)</Label><Textarea id="r-content" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} rows={10} required maxLength={50000} className="font-mono text-xs" /></div>
          <div className="space-y-1"><Label htmlFor="r-url">Link (Premium only, optional)</Label><Input id="r-url" type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></div>
          <div className="space-y-1"><Label htmlFor="r-tags">Tags (comma separated)</Label><Input id="r-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} maxLength={300} /></div>
          <label className="flex items-center justify-between gap-2 text-sm font-medium">Published<Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} aria-label="Published" /></label>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
