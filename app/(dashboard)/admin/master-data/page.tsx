import Link from "next/link";
import type { Metadata } from "next";
import { Boxes, Layers, SlidersHorizontal, CalendarClock, Users, Scale3d, ChevronRight } from "lucide-react";
import { assertCanManageMasterData } from "@/lib/auth/dal";
import { getMasterDataOverviewCounts } from "@/lib/data/master-data";
import { MasterDataSectionNav } from "@/components/master-data/section-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Master Data" };

export default async function MasterDataHubPage() {
  await assertCanManageMasterData();
  const counts = await getMasterDataOverviewCounts();

  const sections = [
    {
      href: "/admin/master-data/activities",
      icon: Boxes,
      title: "Kegiatan",
      description: "Kegiatan (Inclenation, Temu FTEIC, Proker) beserta sesi-sesinya.",
      stat: `${counts.activityCount} kegiatan · ${counts.sessionCount} sesi`,
    },
    {
      href: "/admin/master-data/materials",
      icon: Layers,
      title: "Materi",
      description: "Materi di dalam setiap kegiatan (KWYA, BMB, JAD, HTWF, WUWE, dst).",
      stat: `${counts.materialCount} materi`,
    },
    {
      href: "/admin/master-data/parameters",
      icon: SlidersHorizontal,
      title: "Parameter",
      description: "Parameter penilaian per materi — tipe, bobot, rubrik, dan metode input.",
      stat: `${counts.parameterActiveCount} aktif dari ${counts.parameterTotalCount} total`,
    },
    {
      href: "/admin/master-data/schedule",
      icon: CalendarClock,
      title: "Jadwal & Kuorum",
      description: "Tanggal pelaksanaan sesi dan ambang kuorum H-7 per sesi.",
      stat:
        counts.unscheduledSessionCount > 0
          ? `${counts.unscheduledSessionCount} sesi belum dijadwalkan`
          : "Semua sesi sudah dijadwalkan",
      warn: counts.unscheduledSessionCount > 0,
    },
    {
      href: "/admin/master-data/accounts",
      icon: Users,
      title: "Akun",
      description: "Akun PSDM, Kepala Region, Mentor, dan Damen.",
      stat: `${counts.userActiveCount} aktif dari ${counts.userTotalCount} total`,
    },
    {
      href: "/admin/master-data/settings",
      icon: Scale3d,
      title: "Bobot Penilaian",
      description: "Bobot kontribusi kehadiran, logbook, K1/K2, dan ambang kalibrasi/kelulusan.",
      stat: `${counts.settingCount} dari 9 kunci pengaturan`,
      warn: counts.settingCount < 9,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Master Data</h2>
        <p className="text-sm text-muted-foreground">
          Satu-satunya tempat mengubah struktur program — menambah kegiatan/materi/parameter tahun depan berarti
          &ldquo;tambah baris di sini&rdquo;, bukan mengubah kode aplikasi.
        </p>
      </div>

      <MasterDataSectionNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <section.icon className="size-4.5" />
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={section.warn ? "destructive" : "secondary"}>{section.stat}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
