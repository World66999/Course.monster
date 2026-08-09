"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Eye, Lightbulb, Pencil, Sparkles, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { createCourseRequestAction, editCourseRequestAction } from "@/server/actions/course-requests";
import { parseTagsInput, REQUEST_TAG_SUGGESTIONS, type RequestKind } from "@/lib/request-shared";
import { RequestStatusBadge } from "@/components/site/requests/status-badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourseImage } from "@/components/site/course-image";

interface CategoryOption {
  id: string;
  name: string;
}

export interface ExistingRequest {
  id: string;
  kind: RequestKind;
  title: string;
  categoryId: string | null;
  subject: string;
  description: string;
  motivation: string;
  skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  instructor: string | null;
  sourceProvider: string | null;
  referenceUrl: string | null;
  tags: string[];
  imageUrl: string | null;
  anonymous: boolean;
}

const LEVELS = [
  { value: "", label: "Not specified" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
] as const;

export function RequestForm({
  categories,
  existing,
}: {
  categories: CategoryOption[];
  existing?: ExistingRequest;
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<RequestKind>(existing?.kind ?? "REQUEST");
  const requestKindBtnRef = React.useRef<HTMLButtonElement>(null);
  const recommendationKindBtnRef = React.useRef<HTMLButtonElement>(null);
  const [title, setTitle] = React.useState(existing?.title ?? "");
  const [categoryId, setCategoryId] = React.useState(existing?.categoryId ?? "");
  const [subject, setSubject] = React.useState(existing?.subject ?? "");
  const [description, setDescription] = React.useState(existing?.description ?? "");
  const [motivation, setMotivation] = React.useState(existing?.motivation ?? "");
  const [skillLevel, setSkillLevel] = React.useState<string>(existing?.skillLevel ?? "");
  const [instructor, setInstructor] = React.useState(existing?.instructor ?? "");
  const [sourceProvider, setSourceProvider] = React.useState(existing?.sourceProvider ?? "");
  const [referenceUrl, setReferenceUrl] = React.useState(existing?.referenceUrl ?? "");
  const [tagsInput, setTagsInput] = React.useState(existing?.tags.join(", ") ?? "");
  const [anonymous, setAnonymous] = React.useState(existing?.anonymous ?? false);
  const [image, setImage] = React.useState<{ path: string; thumbPath: string } | null>(
    existing?.imageUrl ? { path: existing.imageUrl, thumbPath: existing.imageUrl } : null
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(existing?.imageUrl ?? null);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");
  const [submitting, setSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const tags = React.useMemo(() => parseTagsInput(tagsInput), [tagsInput]);
  const canSubmit = title.trim().length >= 3 && subject.trim().length >= 2 && description.trim().length >= 20;

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/request-image", { method: "POST", body: form });
      const data = (await res.json()) as { path?: string; thumbPath?: string; error?: string };
      if (!res.ok || !data.path || !data.thumbPath) {
        throw new Error(data.error ?? "Upload failed");
      }
      setImage({ path: data.path, thumbPath: data.thumbPath });
      setPreviewUrl(data.thumbPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setPreviewUrl(existing?.imageUrl ?? null);
    } finally {
      setUploadingImage(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  function removeImage() {
    setImage(null);
    setPreviewUrl(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting || uploadingImage) return;
    setSubmitting(true);
    try {
      const payload = {
        kind,
        title: title.trim(),
        categoryId: categoryId || undefined,
        subject: subject.trim(),
        description: description.trim(),
        motivation: motivation.trim(),
        skillLevel: (skillLevel || "") as "" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
        instructor: instructor.trim(),
        sourceProvider: sourceProvider.trim(),
        referenceUrl: referenceUrl.trim(),
        tags: tagsInput,
        imageUrl: image?.path,
        imageThumbUrl: image?.thumbPath,
        anonymous,
      };
      const result = existing
        ? await editCourseRequestAction(existing.id, payload)
        : await createCourseRequestAction(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(existing ? "Request updated" : "Request submitted!");
      router.push(`/requests/${result.request?.slug ?? ""}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "preview") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Preview</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setMode("edit")}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Back to editing
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {previewUrl && (
            <div className="relative aspect-[16/9] bg-muted">
              <CourseImage src={previewUrl} title={title || "Course request"} />
            </div>
          )}
          <div className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {kind === "REQUEST" ? <Lightbulb className="h-3 w-3" aria-hidden /> : <Sparkles className="h-3 w-3" aria-hidden />}
                {kind === "REQUEST" ? "Request" : "Recommendation"}
              </span>
              <RequestStatusBadge status="REQUESTED" />
              {anonymous && <span className="text-xs text-muted-foreground">Posting anonymously</span>}
            </div>
            <h3 className="text-xl font-bold">{title || "Untitled request"}</h3>
            <p className="text-sm font-medium text-muted-foreground">{subject}</p>
            <p className="break-words whitespace-pre-wrap text-sm text-foreground/90">{description}</p>
            {motivation && (
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {kind === "REQUEST" ? "Why I want this" : "Why I recommend this"}
                </p>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{motivation}</p>
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button type="button" className="w-full" disabled={submitting} onClick={onSubmit}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {existing ? "Save changes" : "Publish request"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <Label>What would you like to do?</Label>
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Request type"
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault();
              const next = kind === "REQUEST" ? "RECOMMENDATION" : "REQUEST";
              setKind(next);
              (next === "REQUEST" ? requestKindBtnRef : recommendationKindBtnRef).current?.focus();
            }
          }}
        >
          <button
            ref={requestKindBtnRef}
            type="button"
            role="radio"
            aria-checked={kind === "REQUEST"}
            tabIndex={kind === "REQUEST" ? 0 : -1}
            onClick={() => setKind("REQUEST")}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              kind === "REQUEST" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40"
            )}
          >
            <Lightbulb className={cn("mt-0.5 h-5 w-5 shrink-0", kind === "REQUEST" ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <span>
              <span className="block font-medium">Request a course</span>
              <span className="block text-sm text-muted-foreground">Ask for something that doesn&apos;t exist here yet.</span>
            </span>
          </button>
          <button
            ref={recommendationKindBtnRef}
            type="button"
            role="radio"
            aria-checked={kind === "RECOMMENDATION"}
            tabIndex={kind === "RECOMMENDATION" ? 0 : -1}
            onClick={() => setKind("RECOMMENDATION")}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              kind === "RECOMMENDATION" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40"
            )}
          >
            <Sparkles className={cn("mt-0.5 h-5 w-5 shrink-0", kind === "RECOMMENDATION" ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <span>
              <span className="block font-medium">Recommend a resource</span>
              <span className="block text-sm text-muted-foreground">Share something publicly available you found useful.</span>
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="req-title">Course title</Label>
        <Input
          id="req-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="e.g. Advanced React Server Components"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="req-category">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="req-category" aria-label="Category">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-subject">Technology / Subject</Label>
          <Input
            id="req-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="e.g. React, Machine Learning, UI Design"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="req-description">Description</Label>
        <Textarea
          id="req-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={20_000}
          placeholder="What should this course cover?"
          required
        />
        <FieldHint>At least 20 characters.</FieldHint>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="req-motivation">
          {kind === "REQUEST" ? "Why do you want this course?" : "Why do you recommend this?"}
        </Label>
        <Textarea
          id="req-motivation"
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          rows={3}
          maxLength={4_000}
          placeholder={kind === "REQUEST" ? "Optional — helps others understand the need" : "Optional — what makes this worth checking out"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="req-level">Skill level</Label>
          <Select value={skillLevel} onValueChange={setSkillLevel}>
            <SelectTrigger id="req-level" aria-label="Skill level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value || "none"} value={l.value || "none"}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-instructor">Instructor (optional)</Label>
          <Input id="req-instructor" value={instructor} onChange={(e) => setInstructor(e.target.value)} maxLength={120} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="req-source">Source / provider (optional)</Label>
          <Input
            id="req-source"
            value={sourceProvider}
            onChange={(e) => setSourceProvider(e.target.value)}
            maxLength={120}
            placeholder="e.g. Udemy, YouTube, Coursera"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-link">Reference link (optional)</Label>
          <Input
            id="req-link"
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            maxLength={2000}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="req-tags">Tags</Label>
        <Input
          id="req-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          maxLength={300}
          placeholder="comma, separated, tags"
        />
        <div className="flex flex-wrap gap-1.5">
          {REQUEST_TAG_SUGGESTIONS.slice(0, 8).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagsInput((prev) => (prev ? `${prev}, ${tag}` : tag))}
              className="cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Course thumbnail (optional)</Label>
        {previewUrl ? (
          <div className="relative h-40 w-full max-w-xs overflow-hidden rounded-xl border border-border bg-muted">
            <Image src={previewUrl} alt="Course thumbnail preview" fill sizes="320px" className="object-cover" unoptimized />
            <button
              type="button"
              onClick={removeImage}
              aria-label="Remove image"
              className="absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85"
            >
              <X className="h-4 w-4" />
            </button>
            {uploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="flex h-32 w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
          >
            {uploadingImage ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="h-5 w-5" aria-hidden />
            )}
            Upload an image
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => void onFileSelected(e)}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
        />
        Post anonymously
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="sm:w-auto"
          disabled={!canSubmit}
          onClick={() => setMode("preview")}
        >
          <Eye className="h-4 w-4" aria-hidden />
          Preview
        </Button>
        <Button type="submit" className="flex-1" disabled={!canSubmit || submitting || uploadingImage}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {existing ? "Save changes" : "Publish request"}
        </Button>
      </div>
    </form>
  );
}
