import type { LucideIcon } from "lucide-react";
import {
  Home,
  ClipboardList,
  CalendarCheck2,
  BookOpenCheck,
  Users,
  Flag,
  Scale,
  AlertTriangle,
  BarChart3,
  Database,
  UploadCloud,
  CheckSquare,
  FileSpreadsheet,
  Download,
  History,
} from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom nav (max ~5 per role, most-used first). */
  primary?: boolean;
};

export const ROLE_LABEL: Record<Role, string> = {
  [Role.ADMIN]: "PSDM / Admin",
  [Role.KEPALA_REGION]: "Kepala Region",
  [Role.MENTOR]: "Mentor",
  [Role.DAMEN]: "Damen",
};

export const ROLE_HOME: Record<Role, string> = {
  [Role.ADMIN]: "/admin",
  [Role.KEPALA_REGION]: "/kepala-region",
  [Role.MENTOR]: "/mentor",
  [Role.DAMEN]: "/damen",
};

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  [Role.MENTOR]: [
    { label: "Beranda", href: "/mentor", icon: Home, primary: true },
    { label: "Scoring", href: "/mentor/scoring", icon: ClipboardList, primary: true },
    { label: "Presensi", href: "/mentor/attendance", icon: CalendarCheck2, primary: true },
    { label: "Logbook", href: "/mentor/logbook", icon: BookOpenCheck, primary: true },
    { label: "Maba", href: "/mentor/students", icon: Users, primary: true },
    { label: "Konfirmasi H-7", href: "/mentor/confirmations", icon: CheckSquare },
    { label: "Flag ke KR", href: "/mentor/flags", icon: Flag },
  ],
  [Role.DAMEN]: [
    { label: "Beranda", href: "/damen", icon: Home, primary: true },
    { label: "Verifikasi Akhir", href: "/damen/verification", icon: CheckSquare, primary: true },
  ],
  [Role.KEPALA_REGION]: [
    { label: "Beranda Region", href: "/kepala-region", icon: Home, primary: true },
    { label: "Temu FTEIC", href: "/kepala-region/temu-fteic", icon: CalendarCheck2, primary: true },
    { label: "Kalibrasi Mentor", href: "/kepala-region/calibration", icon: Scale, primary: true },
    { label: "Papan Eskalasi", href: "/kepala-region/escalation", icon: AlertTriangle, primary: true },
    { label: "Rekap Sub-nilai", href: "/kepala-region/recap", icon: BarChart3, primary: true },
  ],
  [Role.ADMIN]: [
    { label: "Monitoring", href: "/admin", icon: Home, primary: true },
    { label: "Master Data", href: "/admin/master-data", icon: Database, primary: true },
    { label: "Impor Data", href: "/admin/imports", icon: UploadCloud, primary: true },
    { label: "Pemeriksaan Akhir", href: "/admin/verification", icon: CheckSquare, primary: true },
    { label: "Finalisasi", href: "/admin/finalization", icon: FileSpreadsheet, primary: true },
    { label: "Ekspor", href: "/admin/exports", icon: Download },
    { label: "Log Aktivitas", href: "/admin/activity-log", icon: History },
  ],
};
