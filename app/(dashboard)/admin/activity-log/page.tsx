import type { Metadata } from "next";
import { History, User, FileText, Database, Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/dal";
import { Role } from "@/app/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Log Aktivitas - Admin" };

export default async function ActivityLogPage() {
  await assertRole(Role.ADMIN);

  // Fetch the latest 100 audit logs
  const logs = await prisma.auditLog.findMany({
    include: {
      changedBy: { select: { name: true, nrp: true } },
    },
    orderBy: { changedAt: "desc" },
    take: 100,
  });

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "CREATE":
        return "bg-green-500/10 text-green-500 border border-green-500/20";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "TRANSFER":
        return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h2 className="text-xl font-semibold">Log Aktivitas Sistem (Audit Trail)</h2>
        <p className="text-sm text-muted-foreground">
          Jejak riwayat transaksi perubahan nilai, kehadiran, dan mutasi data maba oleh mentor dan admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            <History className="size-4.5 text-primary" />
            Audit Log Sistem Terbaru
          </CardTitle>
          <CardDescription className="text-xs">
            Log historis di bawah ini mencatat perubahan nilai sesungguhnya. Re-submit nilai yang sama secara identik (idempoten) tidak memicu audit log baru.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Belum ada aktivitas tercatat di log audit.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Aktor</th>
                    <th className="p-3">Aksi</th>
                    <th className="p-3">Entitas</th>
                    <th className="p-3">Field</th>
                    <th className="p-3">Nilai Lama</th>
                    <th className="p-3">Nilai Baru</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-foreground">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground font-mono">
                        {new Date(log.changedAt).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <User className="size-3.5 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-foreground">{log.changedBy.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{log.changedBy.nrp}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-muted-foreground font-mono">
                          <Database className="size-3.5" />
                          <span>
                            {log.entityType} ({log.entityId.slice(0, 8)}...)
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{log.field || "-"}</td>
                      <td className="p-3 font-mono text-amber-600 dark:text-amber-400">
                        {log.oldValue !== null ? formatValue(log.oldValue) : "-"}
                      </td>
                      <td className="p-3 font-mono text-green-600 dark:text-green-400">
                        {formatValue(log.newValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
