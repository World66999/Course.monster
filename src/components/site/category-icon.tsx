import {
  BarChart3,
  Blocks,
  BookOpen,
  Bot,
  Braces,
  Briefcase,
  Cloud,
  Code2,
  Cpu,
  Database,
  GraduationCap,
  Languages,
  LineChart,
  Megaphone,
  Palette,
  Server,
  ShieldCheck,
  Smartphone,
  Terminal,
  type LucideIcon,
} from "lucide-react";

/** Icons an admin can pick explicitly (Category.icon). */
const BY_KEY: Record<string, LucideIcon> = {
  code: Code2,
  palette: Palette,
  "bar-chart": BarChart3,
  megaphone: Megaphone,
  briefcase: Briefcase,
  smartphone: Smartphone,
};

/** Otherwise guessed from the category name, so the grid is not one repeated icon. */
const BY_KEYWORD: [string[], LucideIcon][] = [
  [["ai", "ml", "machine learning", "genai", "generative", "llm", "gpt", "deep learning"], Bot],
  [["data structure", "dsa", "algorithm"], Braces],
  [["data", "analytics", "sql", "database", "power bi", "tableau", "excel"], Database],
  [["aws", "azure", "gcp", "cloud"], Cloud],
  [["devops", "docker", "kubernetes", "linux", "server"], Server],
  [["android", "ios", "mobile", "flutter", "react native"], Smartphone],
  [["security", "hacking", "cyber", "pentest"], ShieldCheck],
  [["blockchain", "web3", "crypto", "solidity"], Blocks],
  [["design", "ui", "ux", "figma", "photoshop", "graphic"], Palette],
  [["marketing", "seo", "ads", "social media"], Megaphone],
  [["business", "finance", "management", "startup", "interview", "placement"], Briefcase],
  [["trading", "stock", "invest"], LineChart],
  [["gate", "upsc", "jee", "neet", "exam", "certification", "certificate"], GraduationCap],
  [["english", "language", "communication", "spoken"], Languages],
  [["system design", "architecture", "electronics", "embedded", "hardware"], Cpu],
  [["java", "python", "c++", "c#", "golang", "rust", "kotlin", "php", "ruby", "programming"], Terminal],
  [["web", "frontend", "backend", "full stack", "fullstack", "javascript", "react", "node", "html", "css"], Code2],
];

/** Whole-word match, so "ai" does not fire on "training". */
function hasWord(haystack: string, needle: string): boolean {
  const i = haystack.indexOf(needle);
  if (i < 0) return false;
  const before = i === 0 ? " " : haystack[i - 1]!;
  const after = i + needle.length >= haystack.length ? " " : haystack[i + needle.length]!;
  const isLetter = (ch: string) => ch >= "a" && ch <= "z";
  return !isLetter(before) && !isLetter(after);
}

export function categoryIcon(name: string, key?: string | null): LucideIcon {
  if (key && BY_KEY[key]) return BY_KEY[key];
  const lower = name.toLowerCase();
  for (const [words, icon] of BY_KEYWORD) {
    if (words.some((w) => hasWord(lower, w))) return icon;
  }
  return BookOpen;
}
