"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; nrp: string };
export type AttendanceEntry = { status: "HADIR" | "IZIN" | "ALPA"; participationScore: number | null };
type ActionResult = { ok: true } | { ok: false; error: string };

const STATUS_OPTIONS: Array<{ value: AttendanceEntry["status"]; label: string }> = [
  { value: "HADIR", label: "H" },
  { value: "IZIN", label: "I" },
  { value: "ALPA", label: "A" },
];

/**
 * Shared by mentor-marks-maba and kepala-region-marks-mentor attendance —
 * both are "status + 1-4 keaktifan-if-hadir, per person, per session."
 * Domain-specific bits (which Server Action to call, how sessionId/mode
 * get bound) live in the caller via `onSave`, kept bindable with
 * Server Action .bind() rather than an inline closure since a plain
 * function can't cross the server->client prop boundary.
 */
export function AttendanceGrid({
  people,
  draftKey,
  initialEntries,
  onSave,
  saveLabel = "Simpan Presensi",
}: {
  people: Person[];
  draftKey: string;
  initialEntries: Record<string, AttendanceEntry>;
  onSave: (entries: Array<{ id: string } & AttendanceEntry>) => Promise<ActionResult>;
  saveLabel?: string;
}) {
  const [entries, setEntries] = useState<Record<string, AttendanceEntry>>(initialEntries);
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

  function update(id: string, patch: Partial<AttendanceEntry>) {
    setEntries((prev) => {
      const current = prev[id] ?? { status: "HADIR" as const, participationScore: null };
      const next = { ...prev, [id]: { ...current, ...patch } };
      window.localStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
  }

  const filled = Object.keys(entries).length;

  function submitAll() {
    startTransition(async () => {
      const payload = Object.entries(entries).map(([id, entry]) => ({ id, ...entry }));
      const result = await onSave(payload);
      if (result.ok) {
        window.localStorage.removeItem(draftKey);
        toast.success(`Presensi tersimpan untuk ${payload.length} orang.`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="divide-y py-0">
          {people.map((person) => {
            const entry = entries[person.id];
            return (
              <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{person.name}</p>
                  <p className="text-xs text-muted-foreground">{person.nrp}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = entry?.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              // UNDO: Unselect / remove person entry from state & localStorage draft
                              setEntries((prev) => {
                                const next = { ...prev };
                                delete next[person.id];
                                window.localStorage.setItem(draftKey, JSON.stringify(next));
                                return next;
                              });
                            } else {
                              update(person.id, { status: opt.value });
                            }
                          }}
                          className={cn(
                            "flex size-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
                            isSelected
                              ? opt.value === "ALPA"
                                ? "border-destructive bg-destructive/10 text-destructive"
                                : "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:bg-muted"
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {entry?.status === "HADIR" ? (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((v) => {
                        const isScoreSelected = entry.participationScore === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              if (isScoreSelected) {
                                // UNDO: Reset participation score to null when clicked again
                                update(person.id, { participationScore: null });
                              } else {
                                update(person.id, { participationScore: v });
                              }
                            }}
                            className={cn(
                              "flex size-9 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                              isScoreSelected
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-input bg-background hover:bg-muted"
                            )}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{filled}/{people.length} ditandai</p>
        <Button onClick={submitAll} disabled={pending || filled === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
