import { BookOpen, Bot, Code2, FolderGit2, Gem, GraduationCap, Layers, Rocket, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import type { PremiumIconKey } from "@/lib/premium-content";

const ICONS: Record<PremiumIconKey, LucideIcon> = {
  code: Code2,
  sparkles: Sparkles,
  github: FolderGit2,
  graduation: GraduationCap,
  gem: Gem,
  layers: Layers,
  bot: Bot,
  book: BookOpen,
  rocket: Rocket,
  wrench: Wrench,
};

export function PremiumIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name as PremiumIconKey]) || Layers;
  return <Icon className={className} aria-hidden />;
}
