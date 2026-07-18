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
import { saveCourseAction } from "@/server/actions/courses";
import { slugify } from "@/lib/utils";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { MarkdownEditor } from "@/components/admin/markdown-editor";

type FormInput = z.input<typeof courseFormSchema>;

export interface CategoryOption {
  id: string;
  name: string;
}

const NONE = "__none__";

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

  async function onSubmit(values: CourseFormValues) {
    const result = await saveCourseAction(courseId, values);
    if (result.ok) {
      toast.success(courseId ? "Course updated" : "Course created");
      router.push("/admin/courses");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/courses"
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

      <div className="grid gap-8 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 xl:col-span-2">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
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
              <Label htmlFor="shortDescription">Short description</Label>
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

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
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

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">SEO</h2>
            <div className="space-y-1.5">
              <Label htmlFor="seoTitle">SEO title</Label>
              <Input id="seoTitle" {...register("seoTitle")} placeholder="Defaults to the course title" />
              <FieldError message={errors.seoTitle?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seoDescription">SEO description</Label>
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
                  hint="1200×630 recommended. Defaults to the banner or thumbnail."
                />
              )}
            />
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Organization</h2>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger aria-label="Category">
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" {...register("tags")} placeholder="react, typescript, nextjs" />
              <FieldHint>Comma-separated, up to 15.</FieldHint>
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
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
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
      <Link href="/admin/courses" className={buttonClasses("ghost", "sm", "sr-only")}>
        Cancel
      </Link>
    </form>
  );
}
