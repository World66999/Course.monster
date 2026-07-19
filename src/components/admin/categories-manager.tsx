"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "@/lib/validation";
import {
  deleteCategoryAction,
  moveCategoryAction,
  saveCategoryAction,
} from "@/server/actions/categories";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  courseCount: number;
}

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<CategoryRow | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<CategoryRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing("new")}>
        <Plus className="h-4 w-4" aria-hidden />
        New category
      </Button>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {categories.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No categories yet. Create your first one.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((category, index) => (
              <li key={category.id} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Move ${category.name} up`}
                    disabled={busy || index === 0}
                    onClick={() => run(() => moveCategoryAction(category.id, "up"), "Order updated")}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Move ${category.name} down`}
                    disabled={busy || index === categories.length - 1}
                    onClick={() => run(() => moveCategoryAction(category.id, "down"), "Order updated")}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{category.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    /{category.slug}
                    {category.description ? ` — ${category.description}` : ""}
                  </p>
                </div>
                <Badge variant="secondary">{category.courseCount} courses</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${category.name}`}
                  onClick={() => setEditing(category)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${category.name}`}
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleting(category)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing !== null && (
        <CategoryDialog
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Courses in this category are kept and become uncategorized.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const target = deleting!;
                setDeleting(null);
                void run(() => deleteCategoryAction(target.id), "Category deleted");
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: CategoryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const slugTouched = React.useRef(Boolean(category));
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof categoryFormSchema>, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? "",
    },
  });

  const name = watch("name");
  React.useEffect(() => {
    if (!slugTouched.current && name) setValue("slug", slugify(name));
  }, [name, setValue]);

  async function onSubmit(values: CategoryFormValues) {
    const result = await saveCategoryAction(category?.id ?? null, values);
    if (result.ok) {
      toast.success(category ? "Category updated" : "Category created");
      onSaved();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription className="sr-only">Category details</DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name *</Label>
            <Input id="cat-name" {...register("name")} placeholder="Web Development" />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">Slug *</Label>
            <Input
              id="cat-slug"
              {...register("slug", {
                onChange: () => {
                  slugTouched.current = true;
                },
              })}
              placeholder="web-development"
            />
            <FieldError message={errors.slug?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Input id="cat-desc" {...register("description")} placeholder="Optional short description" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-icon">Icon</Label>
            <Input id="cat-icon" {...register("icon")} placeholder="code" />
            <FieldHint>
              One of: code, palette, bar-chart, megaphone, briefcase, smartphone — or leave empty.
            </FieldHint>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {category ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
