"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { z } from "zod";
import { appListingFormSchema, type AppListingFormValues } from "@/lib/validation";
import { saveAppAction } from "@/server/actions/admin-apps";
import { deleteUploadedFileAction } from "@/server/actions/courses";
import { slugify } from "@/lib/utils";
import { adminPath } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { CATEGORY_LABELS, PLATFORM_LABELS } from "@/components/site/apps/app-card";
import { safeAction } from "@/lib/safe-action";

type FormInput = z.input<typeof appListingFormSchema>;

export function AppListingForm({
  appId,
  defaultValues,
}: {
  appId: string | null;
  defaultValues: FormInput;
}) {
  const router = useRouter();
  const slugTouched = React.useRef(Boolean(appId));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, AppListingFormValues>({
    resolver: zodResolver(appListingFormSchema),
    defaultValues,
  });

  const name = watch("name");
  React.useEffect(() => {
    if (!slugTouched.current && name) {
      setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, setValue]);

  async function deleteIcon(): Promise<{ ok: boolean; error?: string }> {
    const current = getValues("icon");
    if (!current || !current.startsWith("/uploads/")) return { ok: true };
    return safeAction(() => deleteUploadedFileAction(current));
  }

  /** Removes a file that was uploaded then cancelled before saving, so it doesn't linger as an orphan. */
  async function discardUpload(path: string): Promise<void> {
    await safeAction(() => deleteUploadedFileAction(path), "discard upload");
  }

  async function onSubmit(values: AppListingFormValues) {
    const result = await safeAction(() => saveAppAction(appId, values));
    if (result.ok) {
      toast.success(appId ? "App updated" : "App created");
      router.push(adminPath("apps"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link prefetch={false} href={adminPath("apps")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Apps Hub
        </Link>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Controller control={control} name="published" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Published" />} />
            Published
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {appId ? "Save changes" : "Create app"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Basics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="name">App name *</Label>
              <Input id="name" {...register("name")} placeholder="Notepad++" />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <Input id="slug" {...register("slug", { onChange: () => { slugTouched.current = true; } })} placeholder="notepad-plus-plus" />
              <FieldHint>Public URL: /apps/&lt;slug&gt;</FieldHint>
              <FieldError message={errors.slug?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shortDescription">Short description</Label>
              <Input id="shortDescription" {...register("shortDescription")} placeholder="A free source code editor" />
              <FieldError message={errors.shortDescription?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Full description</Label>
              <Textarea id="description" rows={6} {...register("description")} />
              <FieldError message={errors.description?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="developer">Developer</Label>
              <Input id="developer" {...register("developer")} placeholder="Don Ho" />
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Links</h2>
            <p className="-mt-2 text-xs text-muted-foreground">
              Every link must point at the official developer/project source — never a third-party mirror.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="downloadUrl">Download URL * (https only)</Label>
              <Input id="downloadUrl" {...register("downloadUrl")} placeholder="https://notepad-plus-plus.org/downloads/" />
              <FieldError message={errors.downloadUrl?.message} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="projectUrl">Project / homepage URL</Label>
                <Input id="projectUrl" {...register("projectUrl")} placeholder="https://notepad-plus-plus.org/" />
                <FieldError message={errors.projectUrl?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sourceUrl">Source repository URL</Label>
                <Input id="sourceUrl" {...register("sourceUrl")} placeholder="https://github.com/notepad-plus-plus/notepad-plus-plus" />
                <FieldError message={errors.sourceUrl?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Technical details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="version">Version</Label>
                <Input id="version" {...register("version")} placeholder="8.6.9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appUpdatedAt">Last updated</Label>
                <Input id="appUpdatedAt" type="date" {...register("appUpdatedAt")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fileSizeLabel">File size</Label>
                <Input id="fileSizeLabel" {...register("fileSizeLabel")} placeholder="4.5 MB" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="license">License</Label>
                <Input id="license" {...register("license")} placeholder="GPL-3.0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minAndroidVersion">Min Android version</Label>
                <Input id="minAndroidVersion" {...register("minAndroidVersion")} placeholder="8.0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="architecture">Architecture</Label>
                <Input id="architecture" {...register("architecture")} placeholder="arm64-v8a" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" {...register("tags")} placeholder="editor, text, developer-tools" />
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Open-source
              <Controller control={control} name="isOpenSource" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Open-source" />} />
            </label>
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Classification</h2>
            <div className="space-y-1.5">
              <Label>Platform *</Label>
              <Controller
                control={control}
                name="platform"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Icon</h2>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <ImageUploadField label="App icon" kind="appIcon" value={field.value ?? ""} onChange={field.onChange} onDelete={deleteIcon}
                  onDiscardUpload={discardUpload} hint="Square, min 128×128." />
              )}
            />
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Screenshots</h2>
            <Controller
              control={control}
              name="screenshots"
              render={({ field }) => {
                const shots = field.value ?? [];
                return (
                  <div className="space-y-3">
                    {shots.map((shot, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1">
                          <ImageUploadField
                            label={`Screenshot ${i + 1}`}
                            kind="appScreenshot"
                            value={shot ?? ""}
                            onChange={(v) => {
                              const next = [...shots];
                              next[i] = v;
                              field.onChange(next);
                            }}
                            onDelete={async () => {
                              // Removing the row from the form is what matters here; an
                              // orphaned file left on disk is harmless and gets swept by
                              // the save-time cleanup, so a failed unlink must not block it.
                              if (shot && shot.startsWith("/uploads/")) {
                                await safeAction(() => deleteUploadedFileAction(shot), "screenshot delete");
                              }
                              field.onChange(shots.filter((_, idx) => idx !== i));
                              return { ok: true };
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove screenshot"
                          onClick={() => field.onChange(shots.filter((_, idx) => idx !== i))}
                          className="mt-6 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => field.onChange([...shots, ""])}
                      disabled={shots.length >= 10}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Add screenshot
                    </Button>
                  </div>
                );
              }}
            />
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Curation</h2>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Featured
              <Controller control={control} name="featured" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Featured" />} />
            </label>
          </section>
        </div>
      </div>
    </form>
  );
}
