import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireMentorUnit } from "@/lib/data/mentor";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionnaireCode } from "@/app/generated/prisma/enums";

export const metadata: Metadata = { title: "Profil Maba" };

export default async function MentorStudentsPage() {
  const user = await getCurrentUser();
  const unit = await requireMentorUnit(user);

  const students = await prisma.student.findMany({
    where: { unitId: unit.id },
    include: {
      personalityProfile: true,
      questionnaireStatuses: true,
      _count: { select: { logbookEntries: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Profil Maba</h2>
        <p className="text-sm text-muted-foreground">{unit.name} · {students.length} maba</p>
      </div>

      <Card>
        <CardContent className="divide-y py-0">
          {students.map((student) => {
            const k1 = student.questionnaireStatuses.find((q) => q.code === QuestionnaireCode.K1)?.submitted;
            const k2 = student.questionnaireStatuses.find((q) => q.code === QuestionnaireCode.K2)?.submitted;
            return (
              <Link
                key={student.id}
                href={`/mentor/students/${student.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.nrp}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {student.personalityProfile ? (
                    <Badge variant="secondary">{student.personalityProfile.mbtiType}</Badge>
                  ) : null}
                  <Badge variant={k1 ? "default" : "secondary"}>K1</Badge>
                  <Badge variant={k2 ? "default" : "secondary"}>K2</Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
          {students.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada maba terdaftar.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
