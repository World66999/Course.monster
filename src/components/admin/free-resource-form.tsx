"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { freeResourceFormSchema, type FreeResourceFormValues } from "@/lib/validation";
import { saveFreeResourceAction } from "@/server/actions/admin-free-resources";
import { deleteUploadedFileAction } from "@/server/actions/courses";
import { detectSourceType } from "@/lib/external-resource";
import { adminPath } from "@/lib/admin-path";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_SOURCE_LABELS, labelFor } from "@/lib/directory-labels";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Badge } from "@/components/ui/badge";
import { safeAction } from "@/lib/safe-action";

type FormInput = z.input<typeof freeResourceFormSchema>;

export function FreeResourceForm({
  resourceId,
  defaultValues,
}: {
  resourceId: string | null;
  defaultValues: FormInput;
}) {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FreeResourceFormValues>({
    resolver: zodResolver(freeResourceFormSchema),
    defaultValues,
  });

  const url = watch("url");
  /**
   * Preview only. The source badge shown publicly is recomputed on the server
   * from the saved URL — this just tells the admin, before they save, which
   * platform the link will be labelled as. There is no form field to override
   * it, by design.
   */
  const detected = React.useMemo(() => (url ? detectSourceType(url) : null), [url]);

  async function deleteThumbnail(): Promise<{ ok: boolean; error?: string }> {
    const current = getValues("thumbnail");
    if (!current || !current.startsWith("/uploads/")) return { ok: true };
    return safeAction(() => deleteUploadedFileAction(current));
  }

  async function discardUpload(path: string): Promise<void> {
    await safeAction(() => deleteUploadedFileAction(path), "discard upload");
  }

  async function onSubmit(values: FreeResourceFormValues) {
    const result = await safeAction(() => saveFreeResourceAction(resourceId, values));
    if (result.ok) {
      toast.success(resourceId ? "Resource updated" : "Resource created");
      router.push(adminPath("free-resources"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={adminPath("free-resources")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Free Resources
        </Link>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Controller
              control={control}
              name="published"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Published" />
              )}
            />
            Published
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {resourceId ? "Save changes" : "Create resource"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Basics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} placeholder="Complete Python Notes (MEGA folder)" />
              <FieldError message={errors.title?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                {...register("description")}
                placeholder="What's inside, and who it's useful for."
              />
              <FieldHint>Plain text. Shown as a two-line excerpt on the card.</FieldHint>
              <FieldError message={errors.description?.message} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Destination</h2>
            <div className="space-y-1.5">
              <Label htmlFor="url">Resource URL * (https only)</Label>
              <Input id="url" {...register("url")} placeholder="https://mega.nz/folder/..." />
              <FieldHint>
                Must be https, with no username:password in it. The link opens directly in a new tab — the
                site never re-hosts, mirrors or proxies it.
              </FieldHint>
              <FieldError message={errors.url?.message} />
              {detected && (
                <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  Will be labelled as:
                  <Badge variant="secondary">{labelFor(RESOURCE_SOURCE_LABELS, detected)}</Badge>
                  <span>(detected from the hostname — not editable)</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" {...register("tags")} placeholder="python, notes, beginner" />
              <FieldHint>Up to 15 tags. Used by the tag filter on the public page.</FieldHint>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Classification</h2>
            <div className="space-y-1.5">
              <Label>Resource type *</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Resource type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RESOURCE_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.category?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order">Display order</Label>
              <Input id="order" type="number" min={0} {...register("order")} />
              <FieldHint>Lower shows first within the Recommended sort.</FieldHint>
              <FieldError message={errors.order?.message} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Thumbnail</h2>
            <Controller
              control={control}
              name="thumbnail"
              render={({ field }) => (
                <ImageUploadField
                  label="Thumbnail"
                  kind="appIcon"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onDelete={deleteThumbnail}
                  onDiscardUpload={discardUpload}
                  hint="Optional. Square works best; a lettermark is generated when empty."
                />
              )}
            />
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Curation</h2>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Featured
              <Controller
                control={control}
                name="featured"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Featured" />
                )}
              />
            </label>
          </section>
        </div>
      </div>
    </form>
  );
}
