import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, gradientFromString } from "@/lib/utils";

export interface AppCardDTO {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  shortDescription: string | null;
  developer: string | null;
  platform: string;
  category: string;
  version: string | null;
  isOpenSource: boolean;
  tags: string[];
  featured: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  ANDROID: "Android",
  WINDOWS: "Windows",
  MACOS: "macOS",
  LINUX: "Linux",
  WEB: "Web",
  IOS: "iOS",
  CROSS_PLATFORM: "Cross-platform",
};

const CATEGORY_LABELS: Record<string, string> = {
  DEVELOPER_TOOLS: "Developer Tools",
  PROGRAMMING: "Programming",
  EDUCATION: "Education",
  PRODUCTIVITY: "Productivity",
  UTILITIES: "Utilities",
  OPEN_SOURCE: "Open Source",
  MEDIA_TOOLS: "Media Tools",
  FILE_MANAGEMENT: "File Management",
  PRIVACY_TOOLS: "Privacy Tools",
  NETWORKING: "Networking",
  OTHER: "Other",
};

function AppIcon({ name, icon }: { name: string; icon: string | null }) {
  if (icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt={name} className="h-12 w-12 rounded-xl object-cover" loading="lazy" />;
  }
  const { from, to, light } = gradientFromString(name);
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className={cn("text-base font-bold", light ? "text-slate-900/85" : "text-white/90")}>{initials}</span>
    </div>
  );
}

export function AppCard({ app }: { app: AppCardDTO }) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
    >
      <div className="flex items-start gap-3">
        <AppIcon name={app.name} icon={app.icon} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary">{app.name}</h3>
          {app.developer && <p className="truncate text-xs text-muted-foreground">{app.developer}</p>}
        </div>
      </div>

      {app.shortDescription && <p className="line-clamp-2 text-sm text-muted-foreground">{app.shortDescription}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {app.featured && (
          <Badge variant="warning">
            <Sparkles className="h-3 w-3" aria-hidden />
            Featured
          </Badge>
        )}
        <Badge variant="secondary">{PLATFORM_LABELS[app.platform] ?? app.platform}</Badge>
        {app.isOpenSource && <Badge variant="success">Open Source</Badge>}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span>{CATEGORY_LABELS[app.category] ?? app.category}</span>
        <span className="inline-flex items-center gap-1">
          {app.version && <span>v{app.version}</span>}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export { PLATFORM_LABELS, CATEGORY_LABELS };
