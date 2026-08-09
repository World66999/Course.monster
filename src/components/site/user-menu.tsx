"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonClasses } from "@/components/ui/button";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";

export function UserMenu() {
  const { data: session, status } = useSession();

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
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-semibold text-primary transition-transform hover:scale-105"
        >
          {image ? (
            <Image src={image} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
          ) : (
            initials || <UserIcon className="h-4 w-4" aria-hidden />
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent align="end">
        <div className="px-2.5 py-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
        </div>
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/account">
            <UserIcon className="h-4 w-4" aria-hidden />
            Account
          </Link>
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem
          onSelect={() => void signOut({ callbackUrl: "/" })}
          className="text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
