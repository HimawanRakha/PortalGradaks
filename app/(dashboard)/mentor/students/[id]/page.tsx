import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser, assertCanViewStudent } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { computeScores } from "@/lib/scoring/calculate";
import { StudentRaportView, studentRaportInclude } from "@/components/scoring/student-raport-view";

export const metadata: Metadata = { title: "Profil Maba" };

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  await assertCanViewStudent(id, user);

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      unit: { include: { region: true } },
      department: true,
      ...studentRaportInclude,
    },
  });
  if (!student) notFound();

  const computed = await computeScores(id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{student.name}</h2>
        <p className="text-sm text-muted-foreground">
          {student.nrp} · {student.unit.name} · {student.unit.region.name}
          {student.department ? ` · ${student.department.name}` : ""}
        </p>
      </div>

      <StudentRaportView student={student} computed={computed} />
    </div>
  );
}
