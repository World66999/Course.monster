import { TelegramTabs } from "@/components/admin/telegram/telegram-tabs";

export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Telegram bot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The bot serves the same published courses as the website — courses are created and edited
          under <strong>Courses</strong>, never here.
        </p>
      </div>
      <TelegramTabs />
      {children}
    </div>
  );
}
