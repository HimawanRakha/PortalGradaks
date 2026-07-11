"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ROLE_LABEL } from "./nav-config";
import { Role } from "@/app/generated/prisma/enums";

function isActive(pathname: string, href: string) {
  return href === "/mentor" || href === "/kepala-region" || href === "/admin" || href === "/damen"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role, unitLabel }: { role: Role; unitLabel?: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Portal MABA 26</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{ROLE_LABEL[role]}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {unitLabel ? (
        <div className="border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/60">
          {unitLabel}
        </div>
      ) : null}
    </aside>
  );
}
