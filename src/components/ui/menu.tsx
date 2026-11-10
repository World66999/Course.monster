"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * A small disclosure menu for the public header (nav groups, account menu).
 *
 * The header is on every page, and the dropdown library it used put ~70 kB of
 * script into every first load, including on phones where these menus are not
 * even shown. This is the subset the header needs: click/tap or keyboard to
 * open, arrow keys / Home / End to move, Escape or an outside press to close,
 * and it closes itself when the route changes. Nothing depends on hover.
 */

interface MenuContextValue {
  close: (returnFocus?: boolean) => void;
}
const MenuContext = React.createContext<MenuContextValue | null>(null);

export function Menu({
  trigger,
  children,
  align = "start",
  className,
  contentClassName,
}: {
  /** Receives the props to spread on the button, plus the open state. */
  trigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref: React.Ref<HTMLButtonElement> }, open: boolean) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const pathname = usePathname();

  const close = React.useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const items = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  const focusItem = (index: number) => {
    const list = items();
    if (list.length === 0) return;
    list[(index + list.length) % list.length]?.focus();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(list.length - 1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      // The list mounts on the next render.
      requestAnimationFrame(() => focusItem(e.key === "ArrowDown" ? 0 : -1));
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger(
        {
          ref: buttonRef,
          type: "button",
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": open ? id : undefined,
          onClick: () => setOpen((v) => !v),
          onKeyDown: onButtonKeyDown,
        },
        open
      )}
      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          onKeyDown={onListKeyDown}
          className={cn(
            "glass-panel absolute top-full z-50 mt-2 min-w-48 animate-pop-in rounded-panel p-1.5",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            contentClassName
          )}
        >
          <MenuContext.Provider value={{ close }}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

export const menuItemClasses =
  "flex w-full cursor-pointer items-center gap-2 rounded-control px-2.5 py-2.5 text-left text-sm transition-colors duration-100 outline-none select-none " +
  "hover:bg-primary-soft hover:text-primary focus-visible:bg-primary-soft focus-visible:text-primary " +
  "aria-[current=page]:font-semibold aria-[current=page]:text-primary [&_svg]:shrink-0";

/** A button row. Link rows use `menuItemClasses` on a <Link role="menuitem">. */
export function MenuButton({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(menuItemClasses, className)}
      onClick={(e) => {
        onClick?.(e);
        ctx?.close();
      }}
      {...props}
    />
  );
}

export const MenuSeparator = ({ className }: { className?: string }) => (
  <div role="separator" className={cn("my-1 h-px bg-border", className)} />
);
