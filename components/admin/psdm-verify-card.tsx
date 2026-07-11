"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { verifyPsdmLayerAction } from "@/app/(dashboard)/admin/actions";

type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

type StudentVerifyItem = {
  id: string;
  name: string;
  nrp: string;
  unitName: string;
  mentorStatus: VerificationStatus;
  damenStatus: VerificationStatus;
  psdmStatus: VerificationStatus;
  damenEnabled: boolean;
};

export function PsdmVerifyCard({
  student,
  currentStatus,
}: {
  student: StudentVerifyItem;
  currentStatus: VerificationStatus;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const handleVerify = (status: "VERIFIED" | "REJECTED") => {
    startTransition(async () => {
      const result = await verifyPsdmLayerAction(student.id, status, note);
      if (result.ok) {
        toast.success(`${student.name} ditandai ${status === "VERIFIED" ? "terverifikasi" : "ditolak"}.`);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  };

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-500/10 text-green-500 border border-green-500/20 text-[9px] font-bold">VERIFIED</Badge>;
      case "REJECTED":
        return <Badge variant="destructive" className="text-[9px] font-bold">REJECTED</Badge>;
      default:
        return <Badge variant="secondary" className="text-[9px] font-bold">PENDING</Badge>;
    }
  };

  return (
    <Card className="text-xs">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3 border-b">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{student.name}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{student.nrp} · {student.unitName}</p>
        </div>
        {getStatusBadge(currentStatus)}
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {/* Verification Layers Status Checklist */}
        <div className="grid grid-cols-3 gap-2 border rounded-lg p-2.5 bg-muted/20">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="text-[9px] text-muted-foreground font-medium uppercase">1. Mentor</span>
            {getStatusBadge(student.mentorStatus)}
          </div>
          <div className="flex flex-col items-center text-center gap-1 border-x px-1">
            <span className="text-[9px] text-muted-foreground font-medium uppercase">2. Damen</span>
            {student.damenEnabled ? getStatusBadge(student.damenStatus) : <Badge variant="secondary" className="text-[9px] font-medium bg-gray-100 text-gray-400">DISABLED</Badge>}
          </div>
          <div className="flex flex-col items-center text-center gap-1">
            <span className="text-[9px] text-muted-foreground font-medium uppercase">3. PSDM</span>
            {getStatusBadge(student.psdmStatus)}
          </div>
        </div>

        <Textarea
          placeholder="Catatan verifikasi (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={1}
          className="h-8 py-1.5 text-xs"
        />

        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleVerify("VERIFIED")} disabled={pending} className="flex-1 h-7">
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Verifikasi
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleVerify("REJECTED")} disabled={pending} className="flex-1 h-7">
            <X className="size-3.5" />
            Tolak
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
