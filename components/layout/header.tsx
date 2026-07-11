"use client";

import { usePathname } from "next/navigation";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { UserMenu } from "./user-menu";
import { NAV_ITEMS } from "./nav-config";
import { Role } from "@/app/generated/prisma/enums";

function currentTitle(role: Role, pathname: string) {
  const items = NAV_ITEMS[role];
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "Portal MABA 26";
}

export function Header({
  role,
  name,
  nrp,
}: {
  role: Role;
  name: string;
  nrp: string;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <MobileNavSheet role={role} />
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold md:text-lg">
        {currentTitle(role, pathname)}
      </h1>
      <UserMenu name={name} nrp={nrp} role={role} />
    </header>
  );
}
