"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, Calendar, ClipboardList } from "lucide-react";
import { SessionMode } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createActivityAction,
  updateActivityAction,
  deleteActivityAction,
  createSessionAction,
  updateSessionAction,
  deleteSessionAction,
} from "@/app/(dashboard)/admin/master-data/actions";

type SessionData = {
  id: string;
  code: string;
  name: string;
  mode: SessionMode;
  quorumThresholdPct: number | null;
  scheduledAt: Date | null;
};

type ActivityData = {
  id: string;
  code: string;
  name: string;
  order: number;
  isImportOnly: boolean;
  sessions: SessionData[];
};

export function ActivitiesManager({ initialActivities }: { initialActivities: ActivityData[] }) {
  const [activities, setActivities] = useState<ActivityData[]>(initialActivities);
  const [pending, startTransition] = useTransition();

  // Activity Modal State
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityEditId, setActivityEditId] = useState<string | null>(null);
  const [activityCode, setActivityCode] = useState("");
  const [activityName, setActivityName] = useState("");
  const [activityOrder, setActivityOrder] = useState("");
  const [activityIsImport, setActivityIsImport] = useState(false);

  // Session Modal State
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [sessionEditId, setSessionEditId] = useState<string | null>(null);
  const [sessionActivityId, setSessionActivityId] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionMode, setSessionMode] = useState<SessionMode>(SessionMode.OFFLINE);
  const [sessionQuorum, setSessionQuorum] = useState("");
  const [sessionDate, setSessionDate] = useState("");

  const openActivityModal = (activity?: ActivityData) => {
    if (activity) {
      setActivityEditId(activity.id);
      setActivityCode(activity.code);
      setActivityName(activity.name);
      setActivityOrder(String(activity.order));
      setActivityIsImport(activity.isImportOnly);
    } else {
      setActivityEditId(null);
      setActivityCode("");
      setActivityName("");
      setActivityOrder(String(activities.length + 1));
      setActivityIsImport(false);
    }
    setIsActivityOpen(true);
  };

  const openSessionModal = (activityId: string, session?: SessionData) => {
    setSessionActivityId(activityId);
    if (session) {
      setSessionEditId(session.id);
      setSessionCode(session.code);
      setSessionName(session.name);
      setSessionMode(session.mode);
      setSessionQuorum(session.quorumThresholdPct ? String(session.quorumThresholdPct) : "");
      setSessionDate(session.scheduledAt ? new Date(session.scheduledAt).toISOString().split("T")[0] : "");
    } else {
      setSessionEditId(null);
      setSessionCode("");
      setSessionName("");
      setSessionMode(SessionMode.OFFLINE);
      setSessionQuorum("75");
      setSessionDate("");
    }
    setIsSessionOpen(true);
  };

  const handleSaveActivity = () => {
    if (!activityCode || !activityName || !activityOrder) {
      toast.error("Semua field wajib diisi.");
      return;
    }

    startTransition(async () => {
      let res;
      const data = {
        code: activityCode,
        name: activityName,
        order: Number(activityOrder),
        isImportOnly: activityIsImport,
      };

      if (activityEditId) {
        res = await updateActivityAction(activityEditId, data);
      } else {
        res = await createActivityAction(data);
      }

      if (res.ok) {
        toast.success(activityEditId ? "Kegiatan diperbarui." : "Kegiatan dibuat.");
        setIsActivityOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDeleteActivity = (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kegiatan "${name}"?`)) return;

    startTransition(async () => {
      const res = await deleteActivityAction(id);
      if (res.ok) {
        toast.success("Kegiatan berhasil dihapus.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleSaveSession = () => {
    if (!sessionCode || !sessionName) {
      toast.error("Kode dan Nama sesi wajib diisi.");
      return;
    }

    startTransition(async () => {
      let res;
      const data = {
        activityId: sessionActivityId,
        code: sessionCode,
        name: sessionName,
        mode: sessionMode,
        quorumThresholdPct: sessionQuorum ? Number(sessionQuorum) : null,
        scheduledAt: sessionDate ? sessionDate : null,
      };

      if (sessionEditId) {
        res = await updateSessionAction(sessionEditId, data);
      } else {
        res = await createSessionAction(data);
      }

      if (res.ok) {
        toast.success(sessionEditId ? "Sesi diperbarui." : "Sesi dibuat.");
        setIsSessionOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDeleteSession = (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus sesi "${name}"?`)) return;

    startTransition(async () => {
      const res = await deleteSessionAction(id);
      if (res.ok) {
        toast.success("Sesi berhasil dihapus.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Pengelolaan Kegiatan & Sesi</h3>
          <p className="text-xs text-muted-foreground">Tambah, ubah, atau hapus kegiatan pengembangan dan sesi pertemuannya.</p>
        </div>
        <Button onClick={() => openActivityModal()}>
          <Plus className="size-4" />
          Tambah Kegiatan
        </Button>
      </div>

      <div className="grid gap-6">
        {activities.map((activity) => (
          <Card key={activity.id} className="overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4 flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {activity.code}
                  </span>
                  <CardTitle className="text-base">{activity.name}</CardTitle>
                  {activity.isImportOnly && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-500 font-medium px-1.5 py-0.5 rounded border border-amber-500/20">
                      Hanya Impor
                    </span>
                  )}
                </div>
                <CardDescription className="text-xs mt-1">Urutan ke-{activity.order} di alur pengembangan</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="xs" variant="outline" onClick={() => openActivityModal(activity)}>
                  <Edit2 className="size-3" />
                  Edit
                </Button>
                <Button size="xs" variant="destructive" onClick={() => handleDeleteActivity(activity.id, activity.name)}>
                  <Trash2 className="size-3" />
                  Hapus
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <ClipboardList className="size-3.5" />
                  Sesi Kegiatan ({activity.sessions.filter(s => s.code !== "UMUM").length})
                </span>
                <Button size="xs" variant="outline" onClick={() => openSessionModal(activity.id)}>
                  <Plus className="size-3" />
                  Tambah Sesi
                </Button>
              </div>

              {activity.sessions.length === 0 || (activity.sessions.length === 1 && activity.sessions[0].code === "UMUM") ? (
                <p className="text-center py-6 text-xs text-muted-foreground">Belum ada sesi pertemuan. Tambahkan sesi untuk presensi.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                        <th className="p-3">Kode Sesi</th>
                        <th className="p-3">Nama Sesi</th>
                        <th className="p-3">Mode</th>
                        <th className="p-3">Tanggal Pelaksanaan</th>
                        <th className="p-3">Kuorum H-7</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activity.sessions
                        .filter((session) => session.code !== "UMUM")
                        .map((session) => (
                          <tr key={session.id} className="hover:bg-muted/30">
                            <td className="p-3 font-mono font-medium">{session.code}</td>
                            <td className="p-3 font-medium">{session.name}</td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                session.mode === SessionMode.OFFLINE ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                                session.mode === SessionMode.ONLINE ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                                "bg-gray-500/10 text-gray-500"
                              }`}>
                                {session.mode}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground flex items-center gap-1">
                              <Calendar className="size-3" />
                              {session.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString("id-ID", {
                                day: "numeric", month: "short", year: "numeric"
                              }) : "-"}
                            </td>
                            <td className="p-3 font-mono">{session.quorumThresholdPct ? `${session.quorumThresholdPct}%` : "-"}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button size="xs" variant="ghost" onClick={() => openSessionModal(activity.id, session)}>
                                  <Edit2 className="size-3" />
                                </Button>
                                <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteSession(session.id, session.name)}>
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Add/Edit Dialog */}
      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activityEditId ? "Edit Kegiatan" : "Tambah Kegiatan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="act-code">Kode Kegiatan (misal: INCLENATION, TEMU_1)</Label>
              <Input id="act-code" placeholder="INCLENATION" value={activityCode} onChange={(e) => setActivityCode(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="act-name">Nama Kegiatan</Label>
              <Input id="act-name" placeholder="Inclenation 2026" value={activityName} onChange={(e) => setActivityName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="act-order">Urutan Tampil (Angka)</Label>
              <Input id="act-order" type="number" placeholder="1" value={activityOrder} onChange={(e) => setActivityOrder(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="act-import" checked={activityIsImport} onCheckedChange={(val) => setActivityIsImport(!!val)} />
              <Label htmlFor="act-import" className="font-normal cursor-pointer select-none">
                Hanya Impor (tidak ada pengisian manual dari mentor, misal: Proker Fakultas)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <DialogTrigger render={<Button variant="outline" />}>Batal</DialogTrigger>
            <Button onClick={handleSaveActivity} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Add/Edit Dialog */}
      <Dialog open={isSessionOpen} onOpenChange={setIsSessionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sessionEditId ? "Edit Sesi" : "Tambah Sesi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="sess-code">Kode Sesi (misal: 1.0, H1)</Label>
              <Input id="sess-code" placeholder="1.0" value={sessionCode} onChange={(e) => setSessionCode(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sess-name">Nama Sesi</Label>
              <Input id="sess-name" placeholder="Pertemuan Pertama (Offline)" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sess-mode">Mode Sesi</Label>
              <Select value={sessionMode} onValueChange={(val) => setSessionMode(val as SessionMode)}>
                <SelectTrigger id="sess-mode">
                  <SelectValue placeholder="Pilih Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SessionMode.OFFLINE}>Offline (Tatap Muka)</SelectItem>
                  <SelectItem value={SessionMode.ONLINE}>Online (Daring)</SelectItem>
                  <SelectItem value={SessionMode.NA}>N/A (Sesi Asinkron/Penugasan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sess-date">Tanggal Pelaksanaan (opsional)</Label>
              <Input id="sess-date" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sess-quorum">Ambang Kuorum H-7 (%)</Label>
              <Input id="sess-quorum" type="number" placeholder="75" value={sessionQuorum} onChange={(e) => setSessionQuorum(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogTrigger render={<Button variant="outline" />}>Batal</DialogTrigger>
            <Button onClick={handleSaveSession} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
