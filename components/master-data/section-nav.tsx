"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin/master-data", label: "Ringkasan" },
  { href: "/admin/master-data/activities", label: "Kegiatan" },
  { href: "/admin/master-data/materials", label: "Materi" },
  { href: "/admin/master-data/parameters", label: "Parameter" },
  { href: "/admin/master-data/schedule", label: "Jadwal & Kuorum" },
  { href: "/admin/master-data/accounts", label: "Akun" },
  { href: "/admin/master-data/settings", label: "Bobot Penilaian" },
];

/**
 * The top-level nav only has one "Master Data" entry (nav-config.ts) — this
 * secondary in-page nav is what lets PSDM move between the 6 sections
 * without going back through the hub every time. Shared across all 7 pages.
 */
export function MasterDataSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {SECTIONS.map((section) => {
        const active = section.href === "/admin/master-data" ? pathname === section.href : pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
