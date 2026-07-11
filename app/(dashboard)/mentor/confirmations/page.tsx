import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireMentorUnit } from "@/lib/data/mentor";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmSessionButton } from "@/components/scoring/confirm-session-button";

export const metadata: Metadata = { title: "Konfirmasi H-7" };

export default async function MentorConfirmationsPage() {
  const user = await getCurrentUser();
  const unit = await requireMentorUnit(user);

  const sessions = await prisma.activitySession.findMany({
    where: { code: { not: "UMUM" } },
    include: {
      activity: true,
      confirmations: { where: { unitId: unit.id } },
    },
    orderBy: [{ activity: { order: "asc" } }, { code: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Konfirmasi H-7</h2>
        <p className="text-sm text-muted-foreground">
          Konfirmasi kesiapan unit Anda untuk setiap sesi, idealnya 7 hari sebelum pelaksanaan.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y py-0">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {session.activity.name} — {session.name}
                </p>
                {session.scheduledAt ? (
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.scheduledAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
              <ConfirmSessionButton sessionId={session.id} confirmed={session.confirmations.length > 0} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
