"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "@/lib/toast";
import type { z } from "zod";
import { aiPlatformFormSchema, type AiPlatformFormValues } from "@/lib/validation";
import { saveAiPlatformAction } from "@/server/actions/admin-ai-platforms";
import { deleteUploadedFileAction } from "@/server/actions/courses";
import { adminPath } from "@/lib/admin-path";
import { AI_CATEGORY_LABELS, AI_PRICING_LABELS } from "@/lib/directory-labels";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { safeAction } from "@/lib/safe-action";

type FormInput = z.input<typeof aiPlatformFormSchema>;

export function AiPlatformForm({
  platformId,
  defaultValues,
}: {
  platformId: string | null;
  defaultValues: FormInput;
}) {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, AiPlatformFormValues>({
    resolver: zodResolver(aiPlatformFormSchema),
    defaultValues,
  });

  async function deleteLogo(): Promise<{ ok: boolean; error?: string }> {
    const current = getValues("logo");
    if (!current || !current.startsWith("/uploads/")) return { ok: true };
    return safeAction(() => deleteUploadedFileAction(current));
  }

  async function discardUpload(path: string): Promise<void> {
    await safeAction(() => deleteUploadedFileAction(path), "discard upload");
  }

  async function onSubmit(values: AiPlatformFormValues) {
    const result = await safeAction(() => saveAiPlatformAction(platformId, values));
    if (result.ok) {
      toast.success(platformId ? "Platform updated" : "Platform created");
      router.push(adminPath("ai-platforms"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={adminPath("ai-platforms")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to AI Platforms
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
            {platformId ? "Save changes" : "Create platform"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Basics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="name">Platform name *</Label>
              <Input id="name" {...register("name")} placeholder="Perplexity" />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Short explanation</Label>
              <Textarea
                id="description"
                rows={4}
                {...register("description")}
                placeholder="What a student would actually use it for."
              />
              <FieldHint>Plain text — HTML is not rendered.</FieldHint>
              <FieldError message={errors.description?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">Official website * (https only)</Label>
              <Input id="url" {...register("url")} placeholder="https://www.perplexity.ai/" />
              <FieldHint>
                Must be the platform&apos;s own official site — not an affiliate, referral or mirror link.
              </FieldHint>
              <FieldError message={errors.url?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" {...register("tags")} placeholder="search, citations, research" />
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">How it is free</h2>
            {/*
              The single most important field on this form: students plan around
              it. The wording of each option lives in AI_PRICING_LABELS, so the
              admin picks a claim rather than typing one.
            */}
            <p className="-mt-2 text-xs text-muted-foreground">
              Pick the option that is actually true today. There is deliberately no &ldquo;free
              forever&rdquo; choice — we can&apos;t verify a vendor&apos;s future pricing, so we don&apos;t
              print that promise.
            </p>
            <div className="space-y-1.5">
              <Label>Free access type *</Label>
              <Controller
                control={control}
                name="pricingType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Free access type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AI_PRICING_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.pricingType?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="freeTierNote">Free-tier limitation</Label>
              <Input
                id="freeTierNote"
                {...register("freeTierNote")}
                placeholder="5 Pro searches every 4 hours"
              />
              <FieldHint>
                The specific limit, in plain words. Shown verbatim under the badge. Leave empty if there
                isn&apos;t a notable limit.
              </FieldHint>
              <FieldError message={errors.freeTierNote?.message} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Classification</h2>
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
                      {Object.entries(AI_CATEGORY_LABELS).map(([value, label]) => (
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

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="font-semibold">Logo</h2>
            <Controller
              control={control}
              name="logo"
              render={({ field }) => (
                <ImageUploadField
                  label="Platform logo"
                  kind="appIcon"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onDelete={deleteLogo}
                  onDiscardUpload={discardUpload}
                  hint="Optional. Square, min 128×128."
                />
              )}
            />
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
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
