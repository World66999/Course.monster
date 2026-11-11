"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Crown, LifeBuoy, LogOut, User as UserIcon } from "lucide-react";
import { usePremium } from "@/hooks/use-premium";
import { PremiumNameBadge } from "@/components/premium/crown";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonClasses } from "@/components/ui/button";
import { Menu, MenuButton, MenuSeparator, menuItemClasses } from "@/components/ui/menu";

export function UserMenu() {
  const { data: session, status } = useSession();
  const { me } = usePremium();

  if (status === "loading") {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (!session?.user) {
    return (
      <Link href="/login" className={buttonClasses("outline", "sm")}>
        Sign in
      </Link>
    );
  }

  const { name, image } = session.user;
  const initials = (name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Menu
      align="end"
      trigger={(props) => (
        <button
          {...props}
          aria-label="Account menu"
          className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {image ? (
            <Image src={image} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
          ) : (
            initials || <UserIcon className="h-4 w-4" aria-hidden />
          )}
        </button>
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <p className="truncate text-sm font-medium">{name}</p>
        {me.subscribed && <PremiumNameBadge />}
      </div>
      <MenuSeparator />
      <Link href="/account" role="menuitem" className={menuItemClasses}>
        <UserIcon className="h-4 w-4" aria-hidden />
        Account
      </Link>
      <Link href="/premium" role="menuitem" className={menuItemClasses}>
        <Crown className="h-4 w-4" aria-hidden />
        {me.subscribed ? "My Premium" : "Go Premium"}
      </Link>
      <Link href="/premium/support" role="menuitem" className={menuItemClasses}>
        <LifeBuoy className="h-4 w-4" aria-hidden />
        Purchase support
      </Link>
      <MenuSeparator />
      <MenuButton onClick={() => void signOut({ callbackUrl: "/" })} className="text-destructive">
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </MenuButton>
    </Menu>
  );
}
