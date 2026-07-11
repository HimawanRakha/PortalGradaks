"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { verifyDamenLayerAction } from "@/app/(dashboard)/damen/actions";

export function DamenVerifyCard({
  student,
  currentStatus,
}: {
  student: { id: string; name: string; nrp: string; unitName: string };
  currentStatus: "PENDING" | "VERIFIED" | "REJECTED";
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function verify(status: "VERIFIED" | "REJECTED") {
    startTransition(async () => {
      const result = await verifyDamenLayerAction(student.id, status, note);
      if (result.ok) toast.success(`${student.name} ditandai ${status === "VERIFIED" ? "terverifikasi" : "ditolak"}.`);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{student.name}</p>
          <p className="text-xs text-muted-foreground">{student.nrp} · {student.unitName}</p>
        </div>
        <Badge variant={currentStatus === "VERIFIED" ? "default" : currentStatus === "REJECTED" ? "destructive" : "secondary"}>
          {currentStatus}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => verify("VERIFIED")} disabled={pending} className="flex-1">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Verifikasi
          </Button>
          <Button size="sm" variant="outline" onClick={() => verify("REJECTED")} disabled={pending} className="flex-1">
            <X className="size-4" />
            Tolak
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
