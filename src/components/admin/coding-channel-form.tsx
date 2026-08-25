"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { codingChannelFormSchema, type CodingChannelFormValues } from "@/lib/validation";
import { saveChannelAction, fetchYoutubeMetaAction } from "@/server/actions/admin-coding-channels";
import { deleteUploadedFileAction } from "@/server/actions/courses";
import { slugify } from "@/lib/utils";
import { adminPath } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { safeAction } from "@/lib/safe-action";

type FormInput = z.input<typeof codingChannelFormSchema>;

const NONE = "__none__";

const LEVELS = [
  { value: "", label: "Not specified" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "ALL_LEVELS", label: "All Levels" },
] as const;

export const CHANNEL_TAG_SUGGESTIONS = [
  "web-development", "javascript", "typescript", "react", "next-js", "node-js", "python", "java", "c", "cpp",
  "csharp", "go", "rust", "php", "android", "flutter", "data-science", "ai", "machine-learning", "devops",
  "cloud", "docker", "kubernetes", "cybersecurity", "dsa", "competitive-programming", "system-design",
  "databases", "git-github",
];

export function CodingChannelForm({
  channelId,
  defaultValues,
}: {
  channelId: string | null;
  defaultValues: FormInput;
}) {
  const router = useRouter();
  const slugTouched = React.useRef(Boolean(channelId));
  const [fetchingMeta, setFetchingMeta] = React.useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, CodingChannelFormValues>({
    resolver: zodResolver(codingChannelFormSchema),
    defaultValues,
  });

  const name = watch("name");
  React.useEffect(() => {
    if (!slugTouched.current && name) {
      setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, setValue]);

  async function deleteLogo(): Promise<{ ok: boolean; error?: string }> {
    const current = getValues("logo");
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
      toast.error("Paste a YouTube video URL from this channel first.");
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
      if (!getValues("name")?.trim() && result.authorName) {
        setValue("name", result.authorName, { shouldValidate: true });
        filled.push("channel name");
      }
      // oEmbed reports the uploader's canonical channel URL, so a pasted sample
      // video can be turned into the real channel link. Validated server-side as
      // a YouTube channel URL before we get here.
      if (result.authorUrl) {
        setValue("url", result.authorUrl, { shouldValidate: true });
        filled.push("channel URL");
        if (!slugTouched.current && result.authorName) {
          setValue("slug", slugify(result.authorName), { shouldValidate: false });
        }
      }

      toast.success(
        filled.length
          ? `Filled ${filled.join(" and ")} from YouTube. Add a logo manually.`
          : "Nothing new to fill — the existing values were kept."
      );
    } finally {
      setFetchingMeta(false);
    }
  }

  async function onSubmit(values: CodingChannelFormValues) {
    const result = await safeAction(() => saveChannelAction(channelId, values));
    if (result.ok) {
      toast.success(channelId ? "Channel updated" : "Channel created");
      router.push(adminPath("coding-channels"));
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={adminPath("coding-channels")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Coding Channels
        </Link>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Controller
              control={control}
              name="published"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Published" />}
            />
            Published
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {channelId ? "Save changes" : "Create channel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Basics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="url">Channel URL (or a sample video URL) *</Label>
              <div className="flex gap-2">
                <Input id="url" {...register("url")} placeholder="https://www.youtube.com/@channelname" className="flex-1" />
                <Button type="button" variant="outline" disabled={fetchingMeta} onClick={() => void onFetchMeta()}>
                  {fetchingMeta ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  Fetch from YouTube
                </Button>
              </div>
              <FieldHint>
                Paste any <strong>video</strong> from the channel and press Fetch — the channel name and canonical
                channel URL are filled in from it. YouTube provides no public details for a channel page itself, so
                pasting a bare <code>/@handle</code> URL works for saving but can&apos;t be auto-filled.
              </FieldHint>
              <FieldError message={errors.url?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Channel name *</Label>
              <Input id="name" {...register("name")} placeholder="Fireship" />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...register("slug", { onChange: () => { slugTouched.current = true; } })}
                placeholder="fireship"
              />
              <FieldHint>Public URL: /coding-channels/&lt;slug&gt;</FieldHint>
              <FieldError message={errors.slug?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shortDescription">Short description</Label>
              <Input id="shortDescription" {...register("shortDescription")} placeholder="Fast-paced videos on modern web dev" />
              <FieldError message={errors.shortDescription?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Detailed description</Label>
              <Textarea id="description" rows={6} {...register("description")} placeholder="What this channel covers, teaching style, upload frequency…" />
              <FieldError message={errors.description?.message} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Classification</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Label htmlFor="spokenLanguage">Primary spoken language</Label>
                <Input id="spokenLanguage" {...register("spokenLanguage")} placeholder="English" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Topics / tags (comma-separated)</Label>
              <Input id="tags" {...register("tags")} placeholder="javascript, react, dsa" />
              <FieldHint>Suggestions: {CHANNEL_TAG_SUGGESTIONS.slice(0, 8).join(", ")}…</FieldHint>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bestSuitedFor">Best suited for</Label>
              <Input id="bestSuitedFor" {...register("bestSuitedFor")} placeholder="Beginners transitioning into web development" />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Logo</h2>
            <Controller
              control={control}
              name="logo"
              render={({ field }) => (
                <ImageUploadField
                  label="Channel logo"
                  kind="channelLogo"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onDelete={deleteLogo}
                  onDiscardUpload={discardUpload}
                  hint="Square image recommended, min 128×128."
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
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Verified
              <Controller control={control} name="verified" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Verified" />} />
            </label>
          </section>
        </div>
      </div>
    </form>
  );
}
