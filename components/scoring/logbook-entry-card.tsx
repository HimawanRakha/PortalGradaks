"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { verifyLogbookEntryAction } from "@/app/(dashboard)/mentor/actions";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  LENGKAP: { label: "Lengkap", variant: "default" },
  PERLU_REVISI: { label: "Perlu Revisi", variant: "destructive" },
  BELUM_DIVERIFIKASI: { label: "Belum Diverifikasi", variant: "secondary" },
};

export function LogbookEntryCard({
  entry,
}: {
  entry: {
    id: string;
    periodLabel: string;
    content: string;
    status: string;
    note: string | null;
    student: { name: string; nrp: string };
  };
}) {
  const [note, setNote] = useState(entry.note ?? "");
  const [pending, startTransition] = useTransition();
  const status = STATUS_LABEL[entry.status] ?? STATUS_LABEL.BELUM_DIVERIFIKASI;

  function verify(next: "LENGKAP" | "PERLU_REVISI") {
    startTransition(async () => {
      const result = await verifyLogbookEntryAction(entry.id, next, note);
      if (result.ok) toast.success(`Logbook ${entry.student.name} ditandai ${STATUS_LABEL[next].label}.`);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{entry.student.name}</p>
          <p className="text-xs text-muted-foreground">{entry.student.nrp} · {entry.periodLabel}</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg bg-muted p-3 text-sm">{entry.content}</p>
        <Textarea
          placeholder="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => verify("LENGKAP")} disabled={pending} className="flex-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Lengkap
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => verify("PERLU_REVISI")}
            disabled={pending}
            className="flex-1"
          >
            <RotateCcw className="size-4" />
            Perlu Revisi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
