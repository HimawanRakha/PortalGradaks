"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Flag, CheckSquare, History, User } from "lucide-react";
import { FlagStatus } from "@/app/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveFlagAction } from "@/app/(dashboard)/kepala-region/actions";

type FlagItem = {
  id: string;
  message: string;
  status: FlagStatus;
  createdAt: Date;
  student: { name: string; nrp: string } | null;
  unit: { code: string; name: string };
  raisedByUser: { name: string };
  resolvedByUser?: { name: string } | null;
  resolvedAt?: Date | null;
};

export function EscalationPanel({
  openFlags,
  resolvedFlags,
}: {
  openFlags: FlagItem[];
  resolvedFlags: FlagItem[];
}) {
  const [pending, startTransition] = useTransition();

  const handleResolve = (flagId: string) => {
    startTransition(async () => {
      const res = await resolveFlagAction(flagId);
      if (res.ok) {
        toast.success("Isu / Flag berhasil diselesaikan.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Open Issues Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
          <Flag className="size-4 text-destructive animate-pulse" />
          Isu Eskalasi Aktif ({openFlags.length})
        </h3>
        {openFlags.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-xs">
              Tidak ada isu eskalasi aktif saat ini. Region Anda bersih!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {openFlags.map((flag) => (
              <Card key={flag.id} className="border-l-4 border-l-destructive">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] mr-1.5 border border-primary/20">
                        {flag.unit.code}
                      </span>
                      <span className="font-semibold text-foreground">{flag.unit.name}</span>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">OPEN</Badge>
                  </div>
                  <CardDescription className="text-[10px] mt-1">
                    Dilaporkan oleh {flag.raisedByUser.name} pada {new Date(flag.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <div className="bg-muted/40 p-3 rounded-lg border text-foreground font-medium italic">
                    &ldquo;{flag.message}&rdquo;
                  </div>
                  {flag.student && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="size-3.5" />
                      <span>Terkait Maba: <strong>{flag.student.name}</strong> ({flag.student.nrp})</span>
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleResolve(flag.id)}
                    disabled={pending}
                  >
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckSquare className="size-3.5" />}
                    Tandai Isu Selesai (Resolve)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Resolved History Section */}
      <div className="space-y-3 pt-4 border-t">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
          <History className="size-4" />
          Riwayat Isu Diselesaikan ({resolvedFlags.length})
        </h3>
        {resolvedFlags.length === 0 ? (
          <p className="text-muted-foreground text-xs italic pl-1">Belum ada riwayat penyelesaian isu.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 opacity-75">
            {resolvedFlags.map((flag) => (
              <Card key={flag.id} className="border-l-4 border-l-green-500 bg-muted/20">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] mr-1.5 border">
                        {flag.unit.code}
                      </span>
                      <span className="font-semibold text-foreground">{flag.unit.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">
                      RESOLVED
                    </Badge>
                  </div>
                  <CardDescription className="text-[10px] mt-1">
                    Dilaporkan oleh {flag.raisedByUser.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  <p className="text-muted-foreground italic">&ldquo;{flag.message}&rdquo;</p>
                  {flag.student && (
                    <p className="text-muted-foreground text-[10px]">Terkait Maba: {flag.student.name} ({flag.student.nrp})</p>
                  )}
                  <div className="bg-green-500/5 text-green-600 dark:text-green-400 p-2 rounded border border-green-500/10 text-[10px]">
                    Diselesaikan oleh <strong>{flag.resolvedByUser?.name}</strong> pada {flag.resolvedAt ? new Date(flag.resolvedAt).toLocaleString("id-ID") : "-"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
