"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";
import { Role } from "@/app/generated/prisma/enums";

function isActive(pathname: string, href: string) {
  return href === "/mentor" || href === "/kepala-region" || href === "/admin" || href === "/damen"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role].filter((item) => item.primary);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
