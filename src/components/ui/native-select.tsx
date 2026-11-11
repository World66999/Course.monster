import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A styled native `<select>`.
 *
 * Used where a page has a few short pickers and must stay light (the public
 * course filters): a native select needs no JavaScript to render, opens the
 * phone's own picker, which is easier to use by thumb than a custom list, and
 * keeps the menu library out of that page. It is styled to match
 * `SelectTrigger`, so the two look the same when closed.
 */
export function NativeSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-10 w-full cursor-pointer appearance-none truncate rounded-control border border-input bg-card py-2 pr-9 pl-3 text-sm text-foreground shadow-soft transition-[border-color,box-shadow] duration-200 pointer-coarse:h-11",
          "hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
