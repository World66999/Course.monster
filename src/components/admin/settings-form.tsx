"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Tabs from "@radix-ui/react-tabs";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import {
  siteSettingsSchema,
  type SiteSettings,
} from "@/lib/settings-schema";
import { saveSettingsAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError, FieldHint } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { cn } from "@/lib/utils";
import { safeAction } from "@/lib/safe-action";

const TABS = [
  { value: "general", label: "General" },
  { value: "announcement", label: "Announcement" },
  { value: "social", label: "Social" },
  { value: "seo", label: "SEO" },
  { value: "comments", label: "Comments" },
  { value: "chat", label: "Chat" },
  { value: "advanced", label: "Advanced" },
] as const;

export function SettingsForm({ defaultValues }: { defaultValues: SiteSettings }) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof siteSettingsSchema>, unknown, SiteSettings>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues,
  });

  async function onSubmit(values: SiteSettings) {
    const result = await safeAction(() => saveSettingsAction(values));
    if (result.ok) {
      toast.success("Settings saved");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const sectionClass = "space-y-4 rounded-card border border-border bg-card p-6";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs.Root defaultValue="general">
        <Tabs.List
          aria-label="Settings sections"
          className="mb-6 flex w-full flex-wrap gap-1 rounded-nested bg-muted p-1"
        >
          {TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "flex-1 cursor-pointer rounded-control px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                "data-[state=active]:bg-card data-[state=active]:shadow-sm",
                "data-[state=inactive]:text-muted-foreground"
              )}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ---- General ---- */}
        <Tabs.Content value="general" className="space-y-6">
          <section className={sectionClass}>
            <h2 className="font-semibold">Identity</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="siteName">Website name</Label>
                <Input id="siteName" {...register("siteName")} />
                <FieldError message={errors.siteName?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" {...register("tagline")} />
                <FieldError message={errors.tagline?.message} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register("description")} />
              <FieldHint>Shown in the hero and used as the default meta description.</FieldHint>
              <FieldError message={errors.description?.message} />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Controller
                control={control}
                name="logoUrl"
                render={({ field }) => (
                  <ImageUploadField
                    label="Logo"
                    kind="logo"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    hint="Shown in the header. Falls back to a branded icon."
                  />
                )}
              />
              <Controller
                control={control}
                name="faviconUrl"
                render={({ field }) => (
                  <ImageUploadField
                    label="Favicon"
                    kind="logo"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    hint="Square image, ideally 64×64 or larger."
                  />
                )}
              />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="font-semibold">Footer & community</h2>
            <div className="space-y-1.5">
              <Label htmlFor="footerText">Footer text</Label>
              <Textarea id="footerText" rows={2} {...register("footerText")} />
              <FieldError message={errors.footerText?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telegramUrl">Telegram link</Label>
              <Input id="telegramUrl" {...register("telegramUrl")} placeholder="https://t.me/yourchannel" />
              <FieldHint>Used for the header button and as the default course Telegram link.</FieldHint>
              <FieldError message={errors.telegramUrl?.message} />
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Newsletter signup in footer
              <Controller
                control={control}
                name="newsletterEnabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Newsletter enabled" />
                )}
              />
            </label>
          </section>

          <section className={sectionClass}>
            <h2 className="font-semibold">Download flow</h2>
            <div className="space-y-1.5">
              <Label htmlFor="downloadCountdownSeconds">Countdown seconds</Label>
              <Input
                id="downloadCountdownSeconds"
                type="number"
                min="0"
                max="60"
                {...register("downloadCountdownSeconds", { valueAsNumber: true })}
              />
              <FieldHint>Wait time on the protected download page (0–60, default 3).</FieldHint>
              <FieldError message={errors.downloadCountdownSeconds?.message} />
            </div>
            <div className="space-y-1.5">
              <Label>Default theme</Label>
              <Controller
                control={control}
                name="theme.defaultMode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Default theme" className="sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">Follow system</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </section>
        </Tabs.Content>

        {/* ---- Announcement ---- */}
        <Tabs.Content value="announcement">
          <section className={sectionClass}>
            <h2 className="font-semibold">Announcement bar</h2>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Show announcement bar
              <Controller
                control={control}
                name="announcement.enabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Announcement enabled" />
                )}
              />
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="announcement-text">Text</Label>
              <Input
                id="announcement-text"
                {...register("announcement.text")}
                placeholder="🎉 100 new courses added this week!"
              />
              <FieldError message={errors.announcement?.text?.message} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="announcement-link">Link URL</Label>
                <Input id="announcement-link" {...register("announcement.linkUrl")} placeholder="https://…" />
                <FieldError message={errors.announcement?.linkUrl?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="announcement-label">Link label</Label>
                <Input id="announcement-label" {...register("announcement.linkLabel")} placeholder="Learn more" />
              </div>
            </div>
          </section>
        </Tabs.Content>

        {/* ---- Social ---- */}
        <Tabs.Content value="social">
          <section className={sectionClass}>
            <h2 className="font-semibold">Social links</h2>
            <FieldHint>Shown in the footer. Leave empty to hide.</FieldHint>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["twitter", "youtube", "github", "instagram", "facebook", "discord"] as const).map(
                (key) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`social-${key}`} className="capitalize">
                      {key}
                    </Label>
                    <Input
                      id={`social-${key}`}
                      {...register(`social.${key}`)}
                      placeholder={`https://${key}.com/…`}
                    />
                    <FieldError message={errors.social?.[key]?.message} />
                  </div>
                )
              )}
            </div>
          </section>
        </Tabs.Content>

        {/* ---- SEO ---- */}
        <Tabs.Content value="seo">
          <section className={sectionClass}>
            <h2 className="font-semibold">Search engine appearance</h2>
            <div className="space-y-1.5">
              <Label htmlFor="seo-title">Default title</Label>
              <Input id="seo-title" {...register("seo.defaultTitle")} />
              <FieldError message={errors.seo?.defaultTitle?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-template">Title template</Label>
              <Input id="seo-template" {...register("seo.titleTemplate")} />
              <FieldHint>%s is replaced by the page title, e.g. “%s | CourseVault”.</FieldHint>
              <FieldError message={errors.seo?.titleTemplate?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-desc">Default description</Label>
              <Textarea id="seo-desc" rows={3} {...register("seo.defaultDescription")} />
              <FieldError message={errors.seo?.defaultDescription?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-twitter">Twitter handle</Label>
              <Input id="seo-twitter" {...register("seo.twitterHandle")} placeholder="@yoursite" />
            </div>
            <Controller
              control={control}
              name="seo.metaImageUrl"
              render={({ field }) => (
                <ImageUploadField
                  label="Default social share image"
                  kind="meta"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  hint="1200×630 recommended. Used when a page has no image of its own."
                />
              )}
            />
          </section>
        </Tabs.Content>

        {/* ---- Comments ---- */}
        <Tabs.Content value="comments" className="space-y-6">
          <section className={sectionClass}>
            <h2 className="font-semibold">Comments & reviews</h2>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Enable comments &amp; reviews
              <Controller
                control={control}
                name="comments.enabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Comments enabled" />
                )}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Profanity/spam filter
              <Controller
                control={control}
                name="comments.profanityFilterEnabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Profanity filter enabled"
                  />
                )}
              />
            </label>
            <FieldHint>Flagged posts are hidden pending moderator review rather than rejected outright.</FieldHint>
          </section>

          <section className={sectionClass}>
            <h2 className="font-semibold">Length limits</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="comments-minLength">Comment min length</Label>
                <Input
                  id="comments-minLength"
                  type="number"
                  min="1"
                  max="500"
                  {...register("comments.minLength", { valueAsNumber: true })}
                />
                <FieldError message={errors.comments?.minLength?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comments-maxLength">Comment max length</Label>
                <Input
                  id="comments-maxLength"
                  type="number"
                  min="10"
                  max="10000"
                  {...register("comments.maxLength", { valueAsNumber: true })}
                />
                <FieldError message={errors.comments?.maxLength?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comments-reviewMaxLength">Review max length</Label>
                <Input
                  id="comments-reviewMaxLength"
                  type="number"
                  min="10"
                  max="20000"
                  {...register("comments.reviewMaxLength", { valueAsNumber: true })}
                />
                <FieldError message={errors.comments?.reviewMaxLength?.message} />
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="font-semibold">Anti-spam</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="comments-rateLimitCount">Max posts per window</Label>
                <Input
                  id="comments-rateLimitCount"
                  type="number"
                  min="1"
                  max="1000"
                  {...register("comments.rateLimitCount", { valueAsNumber: true })}
                />
                <FieldError message={errors.comments?.rateLimitCount?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comments-rateLimitWindowMinutes">Window (minutes)</Label>
                <Input
                  id="comments-rateLimitWindowMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  {...register("comments.rateLimitWindowMinutes", { valueAsNumber: true })}
                />
                <FieldError message={errors.comments?.rateLimitWindowMinutes?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comments-cooldownSeconds">Cooldown between posts (seconds)</Label>
                <Input
                  id="comments-cooldownSeconds"
                  type="number"
                  min="0"
                  max="3600"
                  {...register("comments.cooldownSeconds", { valueAsNumber: true })}
                />
                <FieldError message={errors.comments?.cooldownSeconds?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comments-duplicateWindowMinutes">Duplicate-post window (minutes)</Label>
                <Input
                  id="comments-duplicateWindowMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  {...register("comments.duplicateWindowMinutes", { valueAsNumber: true })}
                />
                <FieldHint>Blocks the same user re-posting identical text within this window.</FieldHint>
                <FieldError message={errors.comments?.duplicateWindowMinutes?.message} />
              </div>
            </div>
          </section>
        </Tabs.Content>

        {/* ---- Chat ---- */}
        <Tabs.Content value="chat" className="space-y-6">
          <section className={sectionClass}>
            <h2 className="font-semibold">Community chat</h2>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Enable chat
              <Controller
                control={control}
                name="chat.enabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Chat enabled" />
                )}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
              Profanity/spam filter
              <Controller
                control={control}
                name="chat.profanityFilterEnabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Chat profanity filter enabled"
                  />
                )}
              />
            </label>
            <FieldHint>
              Flagged messages are hidden pending moderator review. Messages containing a link always require
              admin approval before they&apos;re publicly visible, regardless of this filter.
            </FieldHint>
          </section>

          <section className={sectionClass}>
            <h2 className="font-semibold">Length &amp; polling</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="chat-minLength">Message min length</Label>
                <Input
                  id="chat-minLength"
                  type="number"
                  min="0"
                  max="500"
                  {...register("chat.minLength", { valueAsNumber: true })}
                />
                <FieldError message={errors.chat?.minLength?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chat-maxLength">Message max length</Label>
                <Input
                  id="chat-maxLength"
                  type="number"
                  min="10"
                  max="4000"
                  {...register("chat.maxLength", { valueAsNumber: true })}
                />
                <FieldError message={errors.chat?.maxLength?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chat-pollIntervalSeconds">Poll interval (seconds)</Label>
                <Input
                  id="chat-pollIntervalSeconds"
                  type="number"
                  min="2"
                  max="60"
                  {...register("chat.pollIntervalSeconds", { valueAsNumber: true })}
                />
                <FieldHint>How often the browser checks for new messages while chat is open.</FieldHint>
                <FieldError message={errors.chat?.pollIntervalSeconds?.message} />
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="font-semibold">Anti-spam</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="chat-rateLimitCount">Max messages per window</Label>
                <Input
                  id="chat-rateLimitCount"
                  type="number"
                  min="1"
                  max="2000"
                  {...register("chat.rateLimitCount", { valueAsNumber: true })}
                />
                <FieldError message={errors.chat?.rateLimitCount?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chat-rateLimitWindowMinutes">Window (minutes)</Label>
                <Input
                  id="chat-rateLimitWindowMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  {...register("chat.rateLimitWindowMinutes", { valueAsNumber: true })}
                />
                <FieldError message={errors.chat?.rateLimitWindowMinutes?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chat-cooldownSeconds">Cooldown between messages (seconds)</Label>
                <Input
                  id="chat-cooldownSeconds"
                  type="number"
                  min="0"
                  max="3600"
                  {...register("chat.cooldownSeconds", { valueAsNumber: true })}
                />
                <FieldError message={errors.chat?.cooldownSeconds?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chat-duplicateWindowMinutes">Duplicate-message window (minutes)</Label>
                <Input
                  id="chat-duplicateWindowMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  {...register("chat.duplicateWindowMinutes", { valueAsNumber: true })}
                />
                <FieldHint>Blocks the same user re-posting identical text within this window.</FieldHint>
                <FieldError message={errors.chat?.duplicateWindowMinutes?.message} />
              </div>
            </div>
          </section>
        </Tabs.Content>

        {/* ---- Advanced ---- */}
        <Tabs.Content value="advanced" className="space-y-6">
          <section className={sectionClass}>
            <h2 className="font-semibold">Analytics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="ga-id">Google Analytics ID</Label>
              <Input id="ga-id" {...register("analytics.googleAnalyticsId")} placeholder="G-XXXXXXXXXX" />
              <FieldHint>Leave empty to disable analytics entirely.</FieldHint>
              <FieldError message={errors.analytics?.googleAnalyticsId?.message} />
            </div>
          </section>
          <section className={sectionClass}>
            <h2 className="font-semibold">robots.txt</h2>
            <div className="space-y-1.5">
              <Label htmlFor="robots">Content</Label>
              <Textarea id="robots" rows={8} {...register("robotsTxt")} className="font-mono text-[13px]" />
              <FieldHint>
                Served at /robots.txt. The sitemap line is appended automatically.
              </FieldHint>
              <FieldError message={errors.robotsTxt?.message} />
            </div>
          </section>
        </Tabs.Content>
      </Tabs.Root>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting} className="shadow-xl">
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Save settings
        </Button>
      </div>
    </form>
  );
}
