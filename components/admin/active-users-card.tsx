"use client";

import { Activity, User as UserIcon, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export type ActiveUserItem = {
  id: string;
  name: string;
  nrp: string | null;
  role: string;
  lastActiveAt: Date | string;
  regionName?: string | null;
  unitCode?: string | null;
};

export function ActiveUsersCard({ activeUsers }: { activeUsers: ActiveUserItem[] }) {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "KEPALA_REGION":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "MENTOR":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "DAMEN":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "EVENT":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Admin (PSDM)";
      case "KEPALA_REGION":
        return "Kepala Region";
      case "MENTOR":
        return "Mentor";
      case "DAMEN":
        return "Damen";
      case "EVENT":
        return "Panitia Event";
      default:
        return role;
    }
  };

  const getRelativeTime = (dateInput: Date | string) => {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "Baru saja";
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m yang lalu`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    return `${diffInHours}j yang lalu`;
  };

  // Group counts by role
  const roleCounts = activeUsers.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <Activity className="size-4.5 text-primary" />
            Pengguna Aktif Real-Time
          </CardTitle>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {activeUsers.length} Online (15m Terakhir)
          </span>
        </div>
        <CardDescription className="text-xs">
          Daftar pengguna (Admin, Kepala Region, Mentor) yang aktif di portal dalam 15 menit terakhir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Role breakdown chips */}
        <div className="flex flex-wrap gap-2 text-[11px] pb-2 border-b border-border">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Users className="size-3.5" /> Distribusi:
          </span>
          {Object.entries(roleCounts).map(([role, count]) => (
            <span
              key={role}
              className={`px-2 py-0.5 rounded-md font-semibold border ${getRoleBadge(role)}`}
            >
              {formatRoleLabel(role)}: {count}
            </span>
          ))}
          {activeUsers.length === 0 && (
            <span className="text-muted-foreground italic">Belum ada pengguna aktif</span>
          )}
        </div>

        {/* User list table */}
        {activeUsers.length === 0 ? (
          <p className="text-center py-6 text-xs text-muted-foreground">
            Tidak ada pengguna aktif dalam 15 menit terakhir.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground font-medium">
                  <th className="p-2.5">Pengguna</th>
                  <th className="p-2.5">Peran (Role)</th>
                  <th className="p-2.5">Unit / Region</th>
                  <th className="p-2.5">Aktivitas Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {activeUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <UserIcon className="size-3.5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold text-foreground">{user.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {user.nrp || "Admin"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(
                          user.role
                        )}`}
                      >
                        {formatRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="p-2.5 text-muted-foreground">
                      {user.unitCode ? (
                        <span className="font-mono text-foreground font-semibold">
                          Unit {user.unitCode}
                        </span>
                      ) : user.regionName ? (
                        <span>{user.regionName}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Nasional</span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {getRelativeTime(user.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
