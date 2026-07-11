import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireMentorUnit, getActivitiesOverview, getRealSessions, getAttendanceForSession } from "@/lib/data/mentor";
import { AutoSubmitSelect } from "@/components/scoring/auto-submit-select";
import { AttendanceGrid } from "@/components/scoring/attendance-grid";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Presensi & Keaktifan" };

export default async function MentorAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; session?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const unit = await requireMentorUnit(user);
  const activities = await getActivitiesOverview();

  const selectedActivity = activities.find((a) => a.code === params.activity) ?? activities[0];
  if (!selectedActivity) {
    return <p className="text-sm text-muted-foreground">Belum ada kegiatan yang dikonfigurasi.</p>;
  }

  const realSessions = await getRealSessions(selectedActivity.code);
  const selectedSession = realSessions.find((s) => s.code === params.session) ?? realSessions[0];

  const students = unit.students;

  let initialEntries: Record<string, { status: "HADIR" | "IZIN" | "ALPA"; participationScore: number | null }> = {};
  if (selectedSession) {
    const map = await getAttendanceForSession(students.map((s) => s.id), selectedSession.id);
    initialEntries = Object.fromEntries(
      Array.from(map.entries()).map(([studentId, row]) => [
        studentId,
        { status: row.status, participationScore: row.participationScore },
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Presensi & Keaktifan</h2>
        <p className="text-sm text-muted-foreground">{unit.name} · {students.length} maba</p>
      </div>

      <form action="/mentor/attendance" className="flex flex-col gap-3 sm:flex-row">
        <AutoSubmitSelect
          name="activity"
          defaultValue={selectedActivity.code}
          options={activities.map((a) => ({ value: a.code, label: a.name }))}
        />
        {realSessions.length > 0 ? (
          <AutoSubmitSelect
            name="session"
            defaultValue={selectedSession?.code ?? ""}
            options={realSessions.map((s) => ({ value: s.code, label: s.name }))}
          />
        ) : null}
      </form>

      {!selectedSession ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Kegiatan ini belum memiliki sesi presensi.
          </CardContent>
        </Card>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Belum ada maba terdaftar di unit ini.
          </CardContent>
        </Card>
      ) : (
        <AttendanceGrid
          key={selectedSession.id}
          students={students}
          sessionId={selectedSession.id}
          mode={selectedSession.mode}
          initialEntries={initialEntries}
        />
      )}
    </div>
  );
}
