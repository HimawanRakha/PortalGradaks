"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveAttendanceAction } from "@/app/(dashboard)/mentor/actions";

type Student = { id: string; name: string; nrp: string };
type Entry = { status: "HADIR" | "IZIN" | "ALPA"; participationScore: number | null };

const STATUS_OPTIONS: Array<{ value: Entry["status"]; label: string }> = [
  { value: "HADIR", label: "H" },
  { value: "IZIN", label: "I" },
  { value: "ALPA", label: "A" },
];

export function AttendanceGrid({
  students,
  sessionId,
  mode,
  initialEntries,
}: {
  students: Student[];
  sessionId: string;
  mode: "ONLINE" | "OFFLINE" | "NA";
  initialEntries: Record<string, Entry>;
}) {
  const draftKey = `attendance-draft:${sessionId}`;
  const [entries, setEntries] = useState<Record<string, Entry>>(initialEntries);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Deliberately an effect, not a lazy useState initializer: localStorage
    // isn't available during SSR, so reading it in the initializer would
    // make the client's first render mismatch the server-rendered HTML.
    const raw = window.localStorage.getItem(draftKey);
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEntries((prev) => ({ ...prev, ...JSON.parse(raw) }));
      } catch {
        // corrupt draft, ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(studentId: string, patch: Partial<Entry>) {
    setEntries((prev) => {
      const current = prev[studentId] ?? { status: "HADIR" as const, participationScore: null };
      const next = { ...prev, [studentId]: { ...current, ...patch } };
      window.localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
  }

  const filled = Object.keys(entries).length;

  function submitAll() {
    startTransition(async () => {
      const payload = Object.entries(entries).map(([studentId, entry]) => ({ studentId, ...entry }));
      const result = await saveAttendanceAction(sessionId, mode, payload);
      if (result.ok) {
        window.localStorage.removeItem(draftKey);
        toast.success(`Presensi tersimpan untuk ${payload.length} maba.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="divide-y py-0">
          {students.map((student) => {
            const entry = entries[student.id];
            return (
              <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.nrp}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update(student.id, { status: opt.value })}
                        className={cn(
                          "flex size-11 items-center justify-center rounded-lg border text-sm font-semibold",
                          entry?.status === opt.value
                            ? opt.value === "ALPA"
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-muted",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {entry?.status === "HADIR" ? (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => update(student.id, { participationScore: v })}
                          className={cn(
                            "flex size-9 items-center justify-center rounded-md border text-xs font-semibold",
                            entry.participationScore === v
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input bg-background hover:bg-muted",
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{filled}/{students.length} ditandai</p>
        <Button onClick={submitAll} disabled={pending || filled === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan Presensi
        </Button>
      </div>
    </div>
  );
}
