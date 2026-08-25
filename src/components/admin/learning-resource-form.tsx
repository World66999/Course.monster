"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { learningResourceFormSchema, type LearningResourceFormValues } from "@/lib/validation";
import { saveLearningResourceAction } from "@/server/actions/admin-learning-resources";
import { fetchYoutubeMetaAction } from "@/server/actions/admin-coding-channels";
import { deleteUploadedFileAction } from "@/server/actions/courses";
import { slugify } from "@/lib/utils";
import { adminPath } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { safeAction } from "@/lib/safe-action";

type FormInput = z.input<typeof learningResourceFormSchema>;

const NONE = "__none__";

const LEVELS = [
  { value: "", label: "Not specified" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "ALL_LEVELS", label: "All Levels" },
] as const;

export interface CategoryOption {
  id: string;
  name: string;
}

export function LearningResourceForm({
  resourceId,
  categories,
  defaultValues,
}: {
  resourceId: string | null;
  categories: CategoryOption[];
  defaultValues: FormInput;
}) {
  const router = useRouter();
  const slugTouched = React.useRef(Boolean(resourceId));
  const [fetchingMeta, setFetchingMeta] = React.useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, LearningResourceFormValues>({
    resolver: zodResolver(learningResourceFormSchema),
    defaultValues,
  });

  const title = watch("title");
  React.useEffect(() => {
    if (!slugTouched.current && title) {
      setValue("slug", slugify(title), { shouldValidate: false });
    }
  }, [title, setValue]);

  async function deleteThumbnail(): Promise<{ ok: boolean; error?: string }> {
    const current = getValues("thumbnail");
    if (!current || !current.startsWith("/uploads/")) return { ok: true };
    return safeAction(() => deleteUploadedFileAction(current));
  }

  /** Removes a file that was uploaded then cancelled before saving, so it doesn't linger as an orphan. */
  async function discardUpload(path: string): Promise<void> {
    await safeAction(() => deleteUploadedFileAction(path), "discard upload");
  }

  async function onFetchMeta() {
    // Guard against a second concurrent lookup from a double click.
    if (fetchingMeta) return;
    const url = getValues("url");
    if (!url) {
      toast.error("Paste a YouTube URL first.");
      return;
    }
    setFetchingMeta(true);
    try {
      const result = await safeAction(() => fetchYoutubeMetaAction({ url }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const filled: string[] = [];
      // Only fill blanks — never clobber something the admin typed.
      if (!getValues("title")?.trim() && result.title) {
        setValue("title", result.title, { shouldValidate: true });
        filled.push("title");
        if (!slugTouched.current) setValue("slug", slugify(result.title), { shouldValidate: false });
      }
      if (!getValues("creatorName")?.trim() && result.authorName) {
        setValue("creatorName", result.authorName);
        filled.push("creator");
      }
      if (!getValues("thumbnail")?.trim() && result.thumbnailUrl) {
        setValue("thumbnail", result.thumbnailUrl);
        filled.push("thumbnail");
      }

      toast.success(
        filled.length
          ? `Filled ${filled.join(", ")} from YouTube.`
          : "Nothing new to fill — the existing values were kept."
      );
    } finally {
      setFetchingMeta(false);
    }
  }

  async function onSubmit(values: LearningResourceFormValues) {
    const result = await safeAction(() => saveLearningResourceAction(resourceId, values));
    if (result.ok) {
      toast.success(resourceId ? "Resource updated" : "Resource created");
      router.push(adminPath("learning-resources"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={adminPath("learning-resources")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Learning Resources
        </Link>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Controller control={control} name="published" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Published" />} />
            Published
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {resourceId ? "Save changes" : "Create resource"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Basics</h2>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Controller
                control={control}
                name="resourceType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Resource type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="PLAYLIST">Playlist</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">YouTube URL *</Label>
              <div className="flex gap-2">
                <Input id="url" {...register("url")} placeholder="https://www.youtube.com/watch?v=..." className="flex-1" />
                <Button type="button" variant="outline" disabled={fetchingMeta} onClick={() => void onFetchMeta()}>
                  {fetchingMeta ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  Fetch from YouTube
                </Button>
              </div>
              <FieldError message={errors.url?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} placeholder="Learn React in 30 Minutes" />
              <FieldError message={errors.title?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <Input id="slug" {...register("slug", { onChange: () => { slugTouched.current = true; } })} placeholder="learn-react-in-30-minutes" />
              <FieldHint>Public URL: /learn/&lt;slug&gt;</FieldHint>
              <FieldError message={errors.slug?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={5} {...register("description")} />
              <FieldError message={errors.description?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creatorName">Creator / channel name</Label>
              <Input id="creatorName" {...register("creatorName")} placeholder="Fireship" />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Classification</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Combobox
                      aria-label="Category"
                      value={field.value || NONE}
                      onChange={(v) => field.onChange(v === NONE ? "" : v)}
                      placeholder="No category"
                      searchPlaceholder="Search categories…"
                      options={[{ value: NONE, label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty level</Label>
                <Controller
                  control={control}
                  name="skillLevel"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger aria-label="Difficulty level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((o) => (
                          <SelectItem key={o.value || NONE} value={o.value || NONE}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spokenLanguage">Spoken language</Label>
                <Input id="spokenLanguage" {...register("spokenLanguage")} placeholder="English" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input id="durationMinutes" type="number" min={0} {...register("durationMinutes")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags / topics (comma-separated)</Label>
              <Input id="tags" {...register("tags")} placeholder="javascript, react" />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Thumbnail</h2>
            <Controller
              control={control}
              name="thumbnail"
              render={({ field }) => (
                <ImageUploadField
                  label="Thumbnail (optional override)"
                  kind="resourceThumbnail"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onDelete={deleteThumbnail}
                  onDiscardUpload={discardUpload}
                  hint="Defaults to the YouTube thumbnail when left empty."
                />
              )}
            />
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
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
