"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, Calendar, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateScheduleAction } from "@/app/(dashboard)/admin/master-data/actions";

type SessionScheduleData = {
  id: string;
  code: string;
  name: string;
  mode: string;
  scheduledAt: Date | null;
  quorumThresholdPct: number | null;
  activity: {
    id: string;
    code: string;
    name: string;
  };
};

export function ScheduleManager({ initialSessions }: { initialSessions: SessionScheduleData[] }) {
  const [sessions] = useState<SessionScheduleData[]>(initialSessions);
  const [pending, startTransition] = useTransition();

  // State to hold unsaved inputs for each session id
  const [inputs, setInputs] = useState<Record<string, { date: string; quorum: string }>>(
    initialSessions.reduce((acc, sess) => {
      acc[sess.id] = {
        date: sess.scheduledAt ? new Date(sess.scheduledAt).toISOString().split("T")[0] : "",
        quorum: sess.quorumThresholdPct !== null ? String(sess.quorumThresholdPct) : "",
      };
      return acc;
    }, {} as Record<string, { date: string; quorum: string }>),
  );

  const handleInputChange = (id: string, field: "date" | "quorum", value: string) => {
    setInputs((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSave = (id: string) => {
    const { date, quorum } = inputs[id];
    startTransition(async () => {
      const scheduledAt = date ? date : null;
      const quorumThresholdPct = quorum ? Number(quorum) : null;

      const res = await updateScheduleAction(id, scheduledAt, quorumThresholdPct);
      if (res.ok) {
        toast.success("Jadwal dan kuorum berhasil disimpan.");
      } else {
        toast.error(res.error);
      }
    });
  };

  // Filter out UMUM sessions as they are synthetic logic hooks rather than real meetings
  const displaySessions = sessions.filter((s) => s.code !== "UMUM");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Jadwal & Ambang Batas Kuorum Sesi</h3>
        <p className="text-xs text-muted-foreground">
          Konfigurasi tanggal pelaksanaan sesi kegiatan dan kuorum kehadiran minimum H-7.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {displaySessions.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">Belum ada sesi pertemuan yang dikonfigurasi.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Kegiatan</th>
                    <th className="p-3">Kode Sesi</th>
                    <th className="p-3">Nama Sesi</th>
                    <th className="p-3">Mode</th>
                    <th className="p-3 w-56">Tanggal Pelaksanaan</th>
                    <th className="p-3 w-36">Kuorum H-7 (%)</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displaySessions.map((session) => (
                    <tr key={session.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                            {session.activity.code}
                          </span>
                          <span className="text-muted-foreground font-medium">{session.activity.name}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-primary">{session.code}</td>
                      <td className="p-3 font-medium">{session.name}</td>
                      <td className="p-3 font-medium text-muted-foreground">{session.mode}</td>
                      <td className="p-3">
                        <div className="relative flex items-center">
                          <Calendar className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                          <Input
                            type="date"
                            value={inputs[session.id]?.date || ""}
                            onChange={(e) => handleInputChange(session.id, "date", e.target.value)}
                            className="h-8 pl-8 text-xs w-48"
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="relative flex items-center">
                          <Percent className="absolute left-2.5 size-3 text-muted-foreground pointer-events-none" />
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="75"
                            value={inputs[session.id]?.quorum || ""}
                            onChange={(e) => handleInputChange(session.id, "quorum", e.target.value)}
                            className="h-8 pl-8 text-xs w-28"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSave(session.id)}
                          disabled={pending}
                          className="h-8"
                        >
                          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                          Simpan
                        </Button>
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
