"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Markdown } from "@/components/site/markdown";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MarkdownEditor({
  value,
  onChange,
  rows = 16,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  id?: string;
}) {
  return (
    <Tabs.Root defaultValue="write">
      <Tabs.List className="mb-2 inline-flex rounded-lg bg-muted p-1" aria-label="Editor mode">
        {(["write", "preview"] as const).map((tab) => (
          <Tabs.Trigger
            key={tab}
            value={tab}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
              "data-[state=active]:bg-card data-[state=active]:shadow-sm",
              "data-[state=inactive]:text-muted-foreground"
            )}
          >
            {tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="write">
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder ?? "Write markdown…"}
          className="font-mono text-[13px] leading-relaxed"
        />
      </Tabs.Content>
      <Tabs.Content value="preview">
        <div className="min-h-40 rounded-lg border border-border bg-card p-4">
          {value.trim() ? (
            <Markdown content={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
