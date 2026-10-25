"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { courseFormSchema, type CourseFormValues } from "@/lib/validation";
import { saveCourseAction, deleteCourseImageAction, deleteUploadedFileAction } from "@/server/actions/courses";
import { slugify } from "@/lib/utils";
import { adminPath } from "@/lib/admin-path";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { safeAction } from "@/lib/safe-action";

type FormInput = z.input<typeof courseFormSchema>;

export interface CategoryOption {
  id: string;
  name: string;
}

const NONE = "__none__";

const SKILL_LEVELS = [
  { value: "", label: "Not specified" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
] as const;

const TRI_STATE = [
  { value: "unset", label: "Not specified" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

function CharCount({ value, max }: { value: string | undefined; max: number }) {
  const len = value?.length ?? 0;
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto text-xs tabular-nums",
        len > max ? "font-medium text-destructive" : "text-muted-foreground"
      )}
    >
      {len}/{max}
    </span>
  );
}

export function CourseForm({
  courseId,
  categories,
  defaultValues,
}: {
  courseId: string | null;
  categories: CategoryOption[];
  defaultValues: FormInput;
}) {
  const router = useRouter();
  const slugTouched = React.useRef(Boolean(courseId));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues,
  });

  const title = watch("title");
  React.useEffect(() => {
    if (!slugTouched.current && title) {
      setValue("slug", slugify(title), { shouldValidate: false });
    }
  }, [title, setValue]);

  /**
   * Deletes the current server-stored image for a field, independent of the
   * rest of the form: an existing course's image is cleared + its file
   * removed immediately via deleteCourseImageAction; a brand-new course
   * draft has no row yet, so a locally-uploaded file (not a pasted external
   * URL) is removed via the standalone deleteUploadedFileAction instead.
   */
  async function deleteImageField(
    field: "thumbnail" | "banner" | "metaImage"
  ): Promise<{ ok: boolean; error?: string }> {
    if (courseId) {
      return safeAction(() => deleteCourseImageAction(courseId, field));
    }
    const current = getValues(field);
    if (!current || !current.startsWith("/uploads/")) {
      return { ok: true };
    }
    return safeAction(() => deleteUploadedFileAction(current));
  }

  /** Removes a file that was uploaded then cancelled before saving, so it doesn't linger as an orphan. */
  async function discardUpload(path: string): Promise<void> {
    await safeAction(() => deleteUploadedFileAction(path), "discard upload");
  }

  async function onSubmit(values: CourseFormValues) {
    const result = await safeAction(() => saveCourseAction(courseId, values));
    if (result.ok) {
      toast.success(courseId ? "Course updated" : "Course created");
      router.push(adminPath("courses"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={adminPath("courses")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to courses
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
            {courseId ? "Save changes" : "Create course"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 xl:col-span-2">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Basics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} placeholder="Modern React with Next.js" />
              <FieldError message={errors.title?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...register("slug", {
                  onChange: () => {
                    slugTouched.current = true;
                  },
                })}
                placeholder="modern-react-with-nextjs"
              />
              <FieldHint>Public URL: /courses/&lt;slug&gt;</FieldHint>
              <FieldError message={errors.slug?.message} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center">
                <Label htmlFor="shortDescription">Short description</Label>
                <CharCount value={watch("shortDescription")} max={220} />
              </div>
              <Input
                id="shortDescription"
                {...register("shortDescription")}
                placeholder="One-line summary shown on cards and in search results"
              />
              <FieldError message={errors.shortDescription?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (Markdown) *</Label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <MarkdownEditor id="description" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              <FieldError message={errors.description?.message} />
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Course details</h2>
            <p className="-mt-2 text-xs text-muted-foreground">
              All optional — only filled-in fields are shown on the public page.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Skill level</Label>
                <Controller
                  control={control}
                  name="skillLevel"
                  render={({ field }) => (
                    <Select
                      value={field.value || ""}
                      onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                    >
                      <SelectTrigger aria-label="Skill level">
                        <SelectValue placeholder="Not specified" />
                      </SelectTrigger>
                      <SelectContent>
                        {SKILL_LEVELS.map((o) => (
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
                <Label htmlFor="language">Primary language</Label>
                <Input id="language" {...register("language")} placeholder="English" />
                <FieldError message={errors.language?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="durationHours">Estimated duration (hours)</Label>
                <Input
                  id="durationHours"
                  type="number"
                  min="0"
                  step="0.5"
                  {...register("durationHours")}
                  placeholder="42"
                />
                <FieldHint>Total content length. Leave empty if unknown.</FieldHint>
                <FieldError message={errors.durationHours?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instructor">Instructor</Label>
                <Input id="instructor" {...register("instructor")} placeholder="Jane Doe" />
                <FieldError message={errors.instructor?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="publisher">Publisher / provider</Label>
                <Input id="publisher" {...register("publisher")} placeholder="Udemy, Coursera, …" />
                <FieldError message={errors.publisher?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sourceUrl">Source website</Label>
                <Input id="sourceUrl" {...register("sourceUrl")} placeholder="https://…" />
                <FieldHint>Official course page, for attribution.</FieldHint>
                <FieldError message={errors.sourceUrl?.message} />
              </div>
              <div className="space-y-1.5">
                <Label>Certificate available</Label>
                <Controller
                  control={control}
                  name="certificate"
                  render={({ field }) => (
                    <Select value={field.value || "unset"} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Certificate available">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRI_STATE.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Lifetime access</Label>
                <Controller
                  control={control}
                  name="lifetimeAccess"
                  render={({ field }) => (
                    <Select value={field.value || "unset"} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Lifetime access">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRI_STATE.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="learningOutcomes">Learning outcomes</Label>
              <Textarea
                id="learningOutcomes"
                rows={5}
                {...register("learningOutcomes")}
                placeholder={"Build production-ready apps\nMaster advanced patterns\n…one outcome per line"}
              />
              <FieldHint>One per line, up to 20. Shown as “What you&apos;ll learn”.</FieldHint>
              <FieldError message={errors.learningOutcomes?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prerequisites">Prerequisites</Label>
              <Textarea
                id="prerequisites"
                rows={3}
                {...register("prerequisites")}
                placeholder={"Basic JavaScript\nFamiliarity with the command line"}
              />
              <FieldHint>One per line, up to 20.</FieldHint>
              <FieldError message={errors.prerequisites?.message} />
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Links</h2>
            <div className="space-y-1.5">
              <Label htmlFor="downloadUrl">Download URL *</Label>
              <Input
                id="downloadUrl"
                {...register("downloadUrl")}
                placeholder="https://drive.google.com/…"
              />
              <FieldHint>
                Where the download button ultimately leads. It is shortened server-side and never
                shown directly to visitors.
              </FieldHint>
              <FieldError message={errors.downloadUrl?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telegramUrl">Telegram URL</Label>
              <Input id="telegramUrl" {...register("telegramUrl")} placeholder="https://t.me/…" />
              <FieldHint>Optional. Falls back to the site-wide Telegram link.</FieldHint>
              <FieldError message={errors.telegramUrl?.message} />
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">SEO</h2>
            <div className="space-y-1.5">
              <div className="flex items-center">
                <Label htmlFor="seoTitle">SEO title</Label>
                <CharCount value={watch("seoTitle")} max={70} />
              </div>
              <Input id="seoTitle" {...register("seoTitle")} placeholder="Defaults to the course title" />
              <FieldError message={errors.seoTitle?.message} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center">
                <Label htmlFor="seoDescription">SEO description</Label>
                <CharCount value={watch("seoDescription")} max={200} />
              </div>
              <Input
                id="seoDescription"
                {...register("seoDescription")}
                placeholder="Defaults to the short description"
              />
              <FieldError message={errors.seoDescription?.message} />
            </div>
            <Controller
              control={control}
              name="metaImage"
              render={({ field }) => (
                <ImageUploadField
                  label="Social share image"
                  kind="meta"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onDelete={() => deleteImageField("metaImage")}
                  onDiscardUpload={discardUpload}
                  hint="1200×630 recommended. Defaults to the banner or thumbnail."
                />
              )}
            />
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Organization</h2>
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
                    options={[
                      { value: NONE, label: "No category" },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" {...register("tags")} placeholder="react, typescript, nextjs" />
              <FieldHint>Comma-separated, up to 15.</FieldHint>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="availableAt">Expected availability date</Label>
              <Input id="availableAt" type="date" {...register("availableAt")} />
              <FieldHint>
                Optional. Set a future date on an <strong>unpublished</strong> course to list it under
                &ldquo;Upcoming&rdquo; in the Telegram bot. Leave empty if it isn&apos;t upcoming.
              </FieldHint>
              <FieldError message={errors.availableAt?.message} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sizeLabel">Size</Label>
                <Input id="sizeLabel" {...register("sizeLabel")} placeholder="4.2 GB" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lecturesCount">Lectures</Label>
                <Input
                  id="lecturesCount"
                  type="number"
                  min="0"
                  {...register("lecturesCount")}
                  placeholder="120"
                />
              </div>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
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
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                Trending
                <Controller
                  control={control}
                  name="trending"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Trending" />
                  )}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                Popular
                <Controller
                  control={control}
                  name="popular"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Popular" />
                  )}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                <span>
                  Premium only
                  <span className="block text-xs font-normal text-muted-foreground">
                    Download needs Premium or a per-user grant
                  </span>
                </span>
                <Controller
                  control={control}
                  name="premium"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Premium only" />
                  )}
                />
              </label>
            </div>
          </section>

          <section className="space-y-5 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Artwork</h2>
            <Controller
              control={control}
              name="thumbnail"
              render={({ field }) => (
                <ImageUploadField
                  label="Thumbnail"
                  kind="thumbnail"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onDelete={() => deleteImageField("thumbnail")}
                  onDiscardUpload={discardUpload}
                  hint="16:9, shown on cards. A branded gradient is used if empty."
                />
              )}
            />
            <Controller
              control={control}
              name="banner"
              render={({ field }) => (
                <ImageUploadField
                  label="Banner"
                  kind="banner"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onDelete={() => deleteImageField("banner")}
                  onDiscardUpload={discardUpload}
                  hint="Wide image for the course page header."
                />
              )}
            />
          </section>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          {courseId ? "Save changes" : "Create course"}
        </Button>
      </div>
      <Link href={adminPath("courses")} className={buttonClasses("ghost", "sm", "sr-only")}>
        Cancel
      </Link>
    </form>
  );
}
