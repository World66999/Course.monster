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
          "glass-panel z-50 min-w-44 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-panel p-1.5 data-[state=open]:animate-pop-in",
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
        "flex cursor-pointer items-center gap-2 rounded-control px-2.5 py-2 text-sm transition-colors duration-100 outline-none select-none data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export const DropdownSeparator = ({ className }: { className?: string }) => (
  <DropdownPrimitive.Separator className={cn("my-1 h-px bg-border", className)} />
);
