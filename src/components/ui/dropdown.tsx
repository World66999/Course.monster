"use client";

import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          "z-50 min-w-40 rounded-xl border border-border bg-card p-1.5 shadow-xl",
          className
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted",
        className
      )}
      {...props}
    />
  );
}

export const DropdownSeparator = ({ className }: { className?: string }) => (
  <DropdownPrimitive.Separator className={cn("my-1 h-px bg-border", className)} />
);
