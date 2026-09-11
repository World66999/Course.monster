"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, RotateCcw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { safeAction } from "@/lib/safe-action";
import {
  BUTTON_STYLES,
  BUTTON_STYLE_KEYS,
  ICON_KEYS,
  ICON_META,
  LABEL_KEYS,
  LABEL_META,
  MAX_ICON_LENGTH,
  MAX_LABEL_LENGTH,
  iconPlain,
  isIconCustomised,
  isLabelCustomised,
  labelText,
  buttonStyleOf,
  type Branding,
  type ButtonStyle,
  type IconKey,
  type LabelKey,
} from "@/lib/telegram/branding-schema";
import {
  autoAssignPremiumIconsAction,
  verifyEmojiLibraryAction,
  resetAllBrandingAction,
  resetIconAction,
  resetLabelAction,
  saveIconAction,
  saveLabelAction,
  setDefaultStyleAction,
} from "@/server/actions/admin-telegram-branding";

/**
 * Icon Manager + Button Label Manager + Button Style, ported from Bot5's
 * in-Telegram admin panel to this app's web panel.
 *
 * Every row edits independently and saves on its own, so one failure never
 * leaves a half-applied screen. `Reset` deletes the override rather than
 * writing the default back, which means a later change to a shipped default
 * flows through automatically.
 */

const STYLE_SWATCH: Record<ButtonStyle, string> = {
  none: "bg-muted text-foreground",
  primary: "bg-blue-500 text-white",
  success: "bg-emerald-500 text-white",
  danger: "bg-red-500 text-white",
};

/** Mirrors what Telegram will show: "<icon> <label>", capped at 64 chars. */
function caption(icon: string, text: string): string {
  return `${icon} ${text}`.trim().slice(0, MAX_LABEL_LENGTH);
}

export function AppearanceManager({
  branding,
  capability,
  lastEmojiError,
}: {
  branding: Branding;
  capability: { canResolve: boolean; detail: string };
  lastEmojiError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);

  async function run(
    id: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(id);
    try {
      const result = await safeAction(fn);
      if (result.ok) {
        toast.success(success);
        router.refresh();
        return true;
      }
      toast.error(result.error);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const premiumCount = Object.values(branding.icons).filter((v) => typeof v === "object").length;

  return (
    <div className="space-y-8">
      {/* Telegram, not this app, decides whether a custom emoji renders — say so plainly. */}
      <div
        className={cn(
          "rounded-card border p-4 text-sm",
          capability.canResolve ? "border-border bg-card" : "border-warning/40 bg-warning/10"
        )}
      >
        <p className="font-medium">
          Premium custom emoji — {premiumCount} icon{premiumCount === 1 ? "" : "s"} configured
        </p>
        <p className="mt-1 text-muted-foreground">{capability.detail}</p>
        {lastEmojiError && (
          <p className="mt-2 text-warning">
            Telegram last rejected a custom emoji: <code>{lastEmojiError}</code>. The message was
            re-sent without it, so nothing was lost.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <header>
          <h2 className="font-semibold">✨ Premium Emoji Library</h2>
          <p className="text-sm text-muted-foreground">
            Ids come only from Telegram&apos;s own <code>getForumTopicIconStickers</code> and public
            sets this bot has legitimately seen. Nothing is guessed or copied from the web, and
            every id is checked against Telegram before it is stored.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy !== null}
            onClick={() => void run("auto", () => autoAssignPremiumIconsAction("fill"), "Premium icons assigned")}>
            {busy === "auto" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            Auto Assign Premium Icons
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy !== null}
            onClick={() => void run("replace", () => autoAssignPremiumIconsAction("replace"), "All icons replaced")}>
            {busy === "replace" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
            Replace All Icons
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy !== null}
            onClick={() => void run("verify", verifyEmojiLibraryAction, "Library verified")}>
            {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            Verify Emoji Library
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy !== null}
            onClick={() => setShowAll((v) => !v)}>
            <Eye className="h-4 w-4" aria-hidden />
            {showAll ? "Hide" : "Preview All"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy !== null}
            onClick={() => setConfirmReset(true)} className="text-destructive hover:bg-destructive/10">
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset All
          </Button>
        </div>

        {showAll && (
          <div className="overflow-x-auto rounded-card border border-border bg-card">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <th className="p-3 font-medium">Icon</th>
                  <th className="p-3 font-medium">Current</th>
                  <th className="p-3 font-medium">Custom emoji id</th>
                  <th className="p-3 font-medium">Source</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Used where</th>
                </tr>
              </thead>
              <tbody>
                {ICON_KEYS.map((k) => {
                  const v = branding.icons[k];
                  const premium = typeof v === "object" ? v : null;
                  return (
                    <tr key={k} className="border-b border-border/60 last:border-0">
                      <td className="p-3 font-medium whitespace-nowrap">{ICON_META[k].name}</td>
                      <td className="p-3 text-lg">{iconPlain(branding, k)}</td>
                      <td className="p-3 font-mono text-xs">{premium ? premium.premiumId : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {premium ? `${premium.set ?? "manual"}${premium.auto ? " (auto)" : " (manual)"}` : "default"}
                      </td>
                      <td className="p-3">
                        {premium ? (
                          <Badge variant={premium.verifiedAt ? "success" : "secondary"}>
                            {premium.verifiedAt ? "verified" : "unverified"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">ordinary</Badge>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{ICON_META[k].where}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">🎨 Icon Manager</h2>
            <p className="text-sm text-muted-foreground">
              Every emoji the bot uses. Send a plain emoji, or a premium custom-emoji id with a
              fallback character.
            </p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ICON_KEYS.map((key) => (
            <IconRow
              key={key}
              iconKey={key}
              branding={branding}
              busy={busy}
              onSave={(value) => run(`icon:${key}`, () => saveIconAction(key, value), "Icon updated")}
              onReset={() => run(`icon:${key}`, () => resetIconAction(key), "Icon reset to default")}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="font-semibold">🔘 Button Label Manager</h2>
          <p className="text-sm text-muted-foreground">
            Captions for every inline button, with an optional per-button colour. Max{" "}
            {MAX_LABEL_LENGTH} characters including the icon.
          </p>
        </header>
        <div className="grid gap-3 lg:grid-cols-2">
          {LABEL_KEYS.map((key) => (
            <LabelRow
              key={key}
              labelKey={key}
              branding={branding}
              busy={busy}
              onSave={(value) => run(`label:${key}`, () => saveLabelAction(key, value), "Button updated")}
              onReset={() => run(`label:${key}`, () => resetLabelAction(key), "Button reset to default")}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="font-semibold">🖌️ Global Default Button Style</h2>
          <p className="text-sm text-muted-foreground">
            Applies to every button without its own colour. &ldquo;Default&rdquo; sends no style at
            all, letting each Telegram client use its own appearance.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          {BUTTON_STYLE_KEYS.map((style) => {
            const active = branding.defaultStyle === style;
            return (
              <button
                key={style}
                type="button"
                disabled={busy !== null}
                onClick={() => void run("style", () => setDefaultStyleAction(style), "Default style updated")}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-nested border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                  active ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-muted"
                )}
              >
                <span className={cn("h-4 w-8 rounded", STYLE_SWATCH[style])} aria-hidden />
                {BUTTON_STYLES[style]}
                {active && <Badge variant="success">active</Badge>}
              </button>
            );
          })}
        </div>
      </section>

      <Preview branding={branding} />

      <Dialog open={confirmReset} onOpenChange={(open) => !busy && setConfirmReset(open)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Reset all appearance settings?</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Every icon, button label and colour returns to its shipped default. Courses and bot data
            are not affected.
          </DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" type="button" disabled={busy !== null} onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                const ok = await run("reset-all", resetAllBrandingAction, "Everything reset to defaults");
                if (ok) setConfirmReset(false);
              }}
            >
              {busy === "reset-all" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Reset everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IconRow({
  iconKey,
  branding,
  busy,
  onSave,
  onReset,
}: {
  iconKey: IconKey;
  branding: Branding;
  busy: string | null;
  onSave: (value: unknown) => Promise<boolean>;
  onReset: () => Promise<boolean>;
}) {
  const meta = ICON_META[iconKey];
  const current = branding.icons[iconKey];
  const isPremium = typeof current === "object" && current !== null && "premiumId" in current;
  const customised = isIconCustomised(branding, iconKey);
  const shown = iconPlain(branding, iconKey);

  const [editing, setEditing] = React.useState(false);
  const [emoji, setEmoji] = React.useState(isPremium ? current.char : (current ?? meta.default));
  const [premiumId, setPremiumId] = React.useState(isPremium ? current.premiumId : "");
  const [error, setError] = React.useState("");
  const pending = busy === `icon:${iconKey}`;

  const serverIcon = JSON.stringify({
    emoji: isPremium ? current.char : typeof current === "string" ? current : meta.default,
    premiumId: isPremium ? current.premiumId : "",
  });
  const lastIcon = React.useRef(serverIcon);

  React.useEffect(() => {
    // Never overwrite an open editor, and only re-sync on a real server change.
    if (editing || lastIcon.current === serverIcon) return;
    lastIcon.current = serverIcon;
    const next = JSON.parse(serverIcon) as { emoji: string; premiumId: string };
    setEmoji(next.emoji);
    setPremiumId(next.premiumId);
    setError("");
  }, [serverIcon, editing]);

  async function save() {
    const trimmed = emoji.trim();
    if (!trimmed) return setError("Icon cannot be empty.");
    if (trimmed.length > MAX_ICON_LENGTH) return setError(`Max ${MAX_ICON_LENGTH} characters.`);
    if (premiumId && !/^\d{1,32}$/.test(premiumId.trim())) {
      return setError("Custom emoji id must be numeric.");
    }
    setError("");
    const value = premiumId.trim() ? { premiumId: premiumId.trim(), char: trimmed } : trimmed;
    if (await onSave(value)) setEditing(false);
  }

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-nested bg-muted text-2xl leading-none">
          {shown}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium">{meta.name}</p>
            {isPremium && <Badge variant="warning">premium</Badge>}
            {isPremium && current.auto && <Badge variant="secondary">auto</Badge>}
            {customised && <Badge variant="secondary">customised</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.where}</p>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor={`icon-${iconKey}`}>Emoji</Label>
            <Input
              id={`icon-${iconKey}`}
              value={emoji}
              maxLength={MAX_ICON_LENGTH}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={meta.default}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`icon-premium-${iconKey}`}>Premium custom emoji id (optional)</Label>
            <Input
              id={`icon-premium-${iconKey}`}
              value={premiumId}
              inputMode="numeric"
              onChange={(e) => setPremiumId(e.target.value)}
              placeholder="5368324170671202286"
            />
            <FieldHint>
              The emoji above is the fallback shown wherever a custom emoji can&apos;t render.
            </FieldHint>
          </div>
          <FieldError message={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => setEditing(true)}>
            Edit
          </Button>
          {customised && (
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => void onReset()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function LabelRow({
  labelKey,
  branding,
  busy,
  onSave,
  onReset,
}: {
  labelKey: LabelKey;
  branding: Branding;
  busy: string | null;
  onSave: (value: unknown) => Promise<boolean>;
  onReset: () => Promise<boolean>;
}) {
  const meta = LABEL_META[labelKey];
  const stored = branding.labels[labelKey];
  const customised = isLabelCustomised(branding, labelKey);
  const currentStyle = buttonStyleOf(branding, labelKey);

  const [text, setText] = React.useState(labelText(branding, labelKey));
  const [style, setStyle] = React.useState<ButtonStyle>(stored?.style ?? "none");
  const [iconId, setIconId] = React.useState(stored?.iconId ?? "");
  const [error, setError] = React.useState("");
  const pending = busy === `label:${labelKey}`;

  const serverSnapshot = JSON.stringify({
    text: labelText(branding, labelKey),
    style: stored?.style ?? "none",
    iconId: stored?.iconId ?? "",
  });
  const lastSynced = React.useRef(serverSnapshot);

  // Re-sync only when the *server* value actually changed. Saving any other row
  // triggers router.refresh(), which re-renders every row — without this guard
  // that would silently discard whatever the admin is currently typing here.
  React.useEffect(() => {
    if (lastSynced.current === serverSnapshot) return;
    lastSynced.current = serverSnapshot;
    const next = JSON.parse(serverSnapshot) as { text: string; style: ButtonStyle; iconId: string };
    setText(next.text);
    setStyle(next.style);
    setIconId(next.iconId);
    setError("");
  }, [serverSnapshot]);

  const dirty =
    text !== labelText(branding, labelKey) ||
    style !== (stored?.style ?? "none") ||
    iconId !== (stored?.iconId ?? "");

  async function save() {
    const trimmed = text.trim();
    if (!trimmed) return setError("Label cannot be empty.");
    if (trimmed.length > MAX_LABEL_LENGTH) return setError(`Max ${MAX_LABEL_LENGTH} characters.`);
    if (iconId && !/^\d{1,32}$/.test(iconId.trim())) return setError("Custom emoji id must be numeric.");
    setError("");
    await onSave({
      text: trimmed,
      ...(style !== "none" ? { style } : {}),
      ...(iconId.trim() ? { iconId: iconId.trim() } : {}),
    });
  }

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground uppercase">{meta.where}</p>
        {customised && <Badge variant="secondary">customised</Badge>}
      </div>

      <div className="mt-2 space-y-2">
        <div className="space-y-1.5">
          <Label htmlFor={`label-${labelKey}`}>Caption</Label>
          <Input
            id={`label-${labelKey}`}
            value={text}
            maxLength={MAX_LABEL_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder={meta.default}
          />
          <FieldHint>
            {text.trim().length}/{MAX_LABEL_LENGTH} · default: {meta.default}
          </FieldHint>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`style-${labelKey}`}>Colour</Label>
          <div className="flex flex-wrap gap-1.5">
            {BUTTON_STYLE_KEYS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                aria-pressed={style === s}
                className={cn(
                  "flex items-center gap-1.5 rounded-control border px-2 py-1 text-xs transition-colors",
                  style === s ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-muted"
                )}
              >
                <span className={cn("h-3 w-5 rounded", STYLE_SWATCH[s])} aria-hidden />
                {s === "none" ? "Default" : s}
              </button>
            ))}
          </div>
          <FieldHint>
            Inherits the global default ({BUTTON_STYLES[branding.defaultStyle]}) when set to Default.
            Effective now: {BUTTON_STYLES[currentStyle]}.
          </FieldHint>
        </div>

        <FieldError message={error} />

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={pending || !dirty} onClick={() => void save()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Save
          </Button>
          {customised && (
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => void onReset()}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Approximate Telegram rendering of the main menu using the saved values. */
function Preview({ branding }: { branding: Branding }) {
  const rows: { label: LabelKey; icon: IconKey }[] = [
    { label: "btn_browse", icon: "browse" },
    { label: "btn_search", icon: "search" },
    { label: "btn_upcoming", icon: "upcoming" },
    { label: "btn_website", icon: "website" },
  ];
  return (
    <section className="space-y-3">
      <header>
        <h2 className="font-semibold">👀 Live preview</h2>
        <p className="text-sm text-muted-foreground">
          The main menu as Telegram will render it with the saved values. Premium icons appear as
          their fallback character here.
        </p>
      </header>
      <div className="max-w-sm space-y-2 rounded-card border border-border bg-muted/40 p-4">
        <p className="text-sm">
          <span className="mr-1">{iconPlain(branding, "logo")}</span>
          <strong>Courses Monster</strong>
          <br />
          <span className="text-muted-foreground">Your course library, directly on Telegram.</span>
        </p>
        <div className="space-y-1.5">
          {rows.map(({ label, icon }) => {
            const style = buttonStyleOf(branding, label);
            return (
              <div
                key={label}
                className={cn(
                  "truncate rounded-control px-3 py-2 text-center text-sm font-medium",
                  style === "none" ? "bg-background border border-border" : STYLE_SWATCH[style]
                )}
              >
                {caption(iconPlain(branding, icon), labelText(branding, label))}
              </div>
            );
          })}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden />
          Colours need a Telegram client that supports button styles.
        </p>
      </div>
    </section>
  );
}
