"use client";

import { useState } from "react";
import { Search, Filter, ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle, Users, BarChart3, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type StudentTrackingInfo = {
  id: string;
  name: string;
  nrp: string;
  attendanceByActivity: Record<string, { status: string; participationScore: number | null } | null>;
  scoresCountByActivity: Record<string, number>;
  totalParamsByActivity: Record<string, number>;
  unverifiedLogbooks: number;
};

export type UnitTrackingItem = {
  id: string;
  code: string;
  name: string;
  regionId: string;
  regionCode: string;
  regionName: string;
  mentorName: string | null;
  mentorNrp: string | null;
  mabaCount: number;
  students: StudentTrackingInfo[];
  activityMetrics: Record<
    string,
    {
      attendanceDoneCount: number; // how many students have an attendance entry
      scoringDoneCount: number;    // sum of scored parameters across all students in unit
      scoringTotalCount: number;   // active parameters count * maba count
    }
  >;
  overallMetrics: {
    attendanceDoneCount: number;
    attendanceTotalCount: number;
    scoringDoneCount: number;
    scoringTotalCount: number;
  };
};

export type ActivityOption = { id: string; code: string; name: string };
export type RegionOption = { id: string; code: string; name: string };

export function UnitTrackingMatrix({
  activities,
  regions,
  units,
  defaultActivityCode,
}: {
  activities: ActivityOption[];
  regions: RegionOption[];
  units: UnitTrackingItem[];
  defaultActivityCode: string;
}) {
  const [selectedActivity, setSelectedActivity] = useState<string>(defaultActivityCode || "ALL");
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  // Filter units based on region, search query, and calculated status
  const filteredUnits = units.filter((unit) => {
    if (selectedRegion !== "ALL" && unit.regionId !== selectedRegion) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUnit = unit.name.toLowerCase().includes(q) || unit.code.toLowerCase().includes(q);
      const matchMentor = unit.mentorName?.toLowerCase().includes(q) || unit.mentorNrp?.toLowerCase().includes(q);
      if (!matchUnit && !matchMentor) return false;
    }

    // Calculate metrics for current activity selection
    let attPct = 0;
    let scorePct = 0;

    if (selectedActivity === "ALL") {
      attPct = unit.overallMetrics.attendanceTotalCount > 0
        ? (unit.overallMetrics.attendanceDoneCount / unit.overallMetrics.attendanceTotalCount) * 100
        : 0;
      scorePct = unit.overallMetrics.scoringTotalCount > 0
        ? (unit.overallMetrics.scoringDoneCount / unit.overallMetrics.scoringTotalCount) * 100
        : 0;
    } else {
      const metric = unit.activityMetrics[selectedActivity];
      if (metric) {
        attPct = unit.mabaCount > 0 ? (metric.attendanceDoneCount / unit.mabaCount) * 100 : 0;
        scorePct = metric.scoringTotalCount > 0 ? (metric.scoringDoneCount / metric.scoringTotalCount) * 100 : 0;
      }
    }

    const isComplete = attPct >= 99.9 && scorePct >= 99.9;
    const isNotStarted = attPct === 0 && scorePct === 0;
    const isInProgress = !isComplete && !isNotStarted;

    if (statusFilter === "COMPLETE" && !isComplete) return false;
    if (statusFilter === "NOT_STARTED" && !isNotStarted) return false;
    if (statusFilter === "IN_PROGRESS" && !isInProgress) return false;

    return true;
  });

  // Calculate National Summary Statistics for current selection
  const totalMabaFiltered = filteredUnits.reduce((acc, u) => acc + u.mabaCount, 0);
  
  let nationalAttDone = 0;
  let nationalAttTotal = 0;
  let nationalScoreDone = 0;
  let nationalScoreTotal = 0;

  filteredUnits.forEach((unit) => {
    if (selectedActivity === "ALL") {
      nationalAttDone += unit.overallMetrics.attendanceDoneCount;
      nationalAttTotal += unit.overallMetrics.attendanceTotalCount;
      nationalScoreDone += unit.overallMetrics.scoringDoneCount;
      nationalScoreTotal += unit.overallMetrics.scoringTotalCount;
    } else {
      const metric = unit.activityMetrics[selectedActivity];
      if (metric) {
        nationalAttDone += metric.attendanceDoneCount;
        nationalAttTotal += unit.mabaCount;
        nationalScoreDone += metric.scoringDoneCount;
        nationalScoreTotal += metric.scoringTotalCount;
      }
    }
  });

  const avgAttPct = nationalAttTotal > 0 ? Math.round((nationalAttDone / nationalAttTotal) * 100) : 0;
  const avgScorePct = nationalScoreTotal > 0 ? Math.round((nationalScoreDone / nationalScoreTotal) * 100) : 0;

  const currentActivityObj = activities.find((a) => a.code === selectedActivity);

  return (
    <div className="space-y-6 text-xs">
      {/* Filters Bar */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama/kode unit, nama mentor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Select Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Activity Select */}
              <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-md border border-border/50">
                <Calendar className="size-3.5 text-primary ml-1" />
                <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">Kegiatan:</span>
                <Select value={selectedActivity} onValueChange={(val) => setSelectedActivity(val || "ALL")}>
                  <SelectTrigger className="w-48 h-8 text-xs bg-background">
                    <SelectValue placeholder="Pilih Kegiatan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Kegiatan (Total)</SelectItem>
                    {activities.map((act) => (
                      <SelectItem key={act.id} value={act.code}>
                        {act.name} ({act.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Region Select */}
              <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-md border border-border/50">
                <Filter className="size-3.5 text-muted-foreground ml-1" />
                <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">Region:</span>
                <Select value={selectedRegion} onValueChange={(val) => setSelectedRegion(val || "ALL")}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-background">
                    <SelectValue placeholder="Semua Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Region ({regions.length})</SelectItem>
                    {regions.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.code} - {reg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Select */}
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="w-36 h-8 text-xs bg-background">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="COMPLETE">Selesai 100%</SelectItem>
                  <SelectItem value="IN_PROGRESS">Dalam Proses</SelectItem>
                  <SelectItem value="NOT_STARTED">Belum Mengisi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              Total Unit Filtered
              <Users className="size-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono">{filteredUnits.length} Unit</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{totalMabaFiltered} maba terdaftar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              Progress Presensi Maba
              <BarChart3 className="size-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{avgAttPct}%</div>
            <Progress value={avgAttPct} className="h-1.5 bg-blue-500/20" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              Progress Pengisian Nilai
              <BarChart3 className="size-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            <div className="text-xl font-bold font-mono text-green-600 dark:text-green-400">{avgScorePct}%</div>
            <Progress value={avgScorePct} className="h-1.5 bg-green-500/20" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              Kegiatan Dipantau
              <Calendar className="size-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-sm font-semibold truncate text-foreground">
              {selectedActivity === "ALL" ? "Semua Kegiatan" : currentActivityObj?.name || selectedActivity}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {selectedActivity === "ALL" ? `${activities.length} kegiatan aktif` : `Kode: ${selectedActivity}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Units Table */}
      <Card>
        <CardHeader className="py-3.5 px-4 border-b">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Daftar Unit & Progress Pengisian</span>
            <span className="text-xs font-normal text-muted-foreground">
              Menampilkan {filteredUnits.length} dari {units.length} unit
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b text-muted-foreground font-medium text-xs">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Unit / Mentor</th>
                  <th className="p-3">Region</th>
                  <th className="p-3 text-center">Maba</th>
                  <th className="p-3 w-44">Presensi Maba</th>
                  <th className="p-3 w-44">Pengisian Nilai</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Tidak ada unit yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((unit) => {
                    // Calculate metrics for this specific unit
                    let attDone = 0;
                    let attTotal = unit.mabaCount;
                    let scoreDone = 0;
                    let scoreTotal = 0;

                    if (selectedActivity === "ALL") {
                      attDone = unit.overallMetrics.attendanceDoneCount;
                      attTotal = unit.overallMetrics.attendanceTotalCount;
                      scoreDone = unit.overallMetrics.scoringDoneCount;
                      scoreTotal = unit.overallMetrics.scoringTotalCount;
                    } else {
                      const metric = unit.activityMetrics[selectedActivity];
                      if (metric) {
                        attDone = metric.attendanceDoneCount;
                        attTotal = unit.mabaCount;
                        scoreDone = metric.scoringDoneCount;
                        scoreTotal = metric.scoringTotalCount;
                      }
                    }

                    const attPct = attTotal > 0 ? Math.round((attDone / attTotal) * 100) : 0;
                    const scorePct = scoreTotal > 0 ? Math.round((scoreDone / scoreTotal) * 100) : 0;

                    const isExpanded = expandedUnitId === unit.id;
                    const isComplete = attPct >= 100 && (scoreTotal === 0 || scorePct >= 100);
                    const isNotStarted = attPct === 0 && scorePct === 0;

                    return (
                      <React.Fragment key={unit.id}>
                        <tr
                          className={cn(
                            "hover:bg-muted/30 transition-colors cursor-pointer select-none",
                            isExpanded ? "bg-muted/20" : ""
                          )}
                          onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                        >
                          <td className="p-3 text-center">
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-primary" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono bg-primary/10 text-primary font-bold px-2 py-0.5 rounded text-[11px] border border-primary/20">
                                {unit.code}
                              </span>
                              <div>
                                <p className="font-semibold text-foreground">{unit.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Mentor: <span className="font-medium text-foreground">{unit.mentorName || "Belum ditugaskan"}</span>
                                  {unit.mentorNrp ? ` (${unit.mentorNrp})` : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-medium text-muted-foreground">
                            {unit.regionCode} - {unit.regionName}
                          </td>
                          <td className="p-3 text-center font-mono font-semibold">
                            {unit.mabaCount}
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-muted-foreground">{attDone}/{attTotal} maba</span>
                                <span className="font-bold">{attPct}%</span>
                              </div>
                              <Progress value={attPct} className="h-1.5" />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-muted-foreground">
                                  {scoreTotal > 0 ? `${scoreDone}/${scoreTotal} nilai` : "N/A"}
                                </span>
                                <span className="font-bold">{scorePct}%</span>
                              </div>
                              <Progress value={scorePct} className="h-1.5" />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <CheckCircle2 className="size-3" /> Lengkap
                              </span>
                            ) : isNotStarted ? (
                              <span className="inline-flex items-center gap-1 bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <AlertCircle className="size-3" /> Belum
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <Clock className="size-3" /> Proses
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Detail Rows for Student Attendance & Scoring Breakdown */}
                        {isExpanded ? (
                          <tr className="bg-muted/10">
                            <td colSpan={7} className="p-4 border-t">
                              <div className="space-y-3 bg-background p-4 rounded-lg border shadow-inner">
                                <div className="flex items-center justify-between border-b pb-2">
                                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
                                    <Users className="size-4 text-primary" />
                                    Breakdown Maba Unit {unit.code} ({unit.students.length} Mahasiswa)
                                  </h4>
                                  <span className="text-[10px] text-muted-foreground">
                                    Kegiatan: {selectedActivity === "ALL" ? "Semua" : selectedActivity}
                                  </span>
                                </div>

                                {unit.students.length === 0 ? (
                                  <p className="text-center py-4 text-muted-foreground">Belum ada maba di unit ini.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="bg-muted/30 text-muted-foreground font-medium text-[11px]">
                                          <th className="p-2">Nama Maba / NRP</th>
                                          <th className="p-2">Status Presensi</th>
                                          <th className="p-2">Keaktifan</th>
                                          <th className="p-2">Pengisian Nilai Parameter</th>
                                          <th className="p-2">Logbook Pending</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {unit.students.map((st) => {
                                          let attInfo: { status: string; participationScore: number | null } | null = null;
                                          let scoredCount = 0;
                                          let totalParams = 0;

                                          if (selectedActivity === "ALL") {
                                            // Aggregate count of recorded attendances & scores across all activities
                                            const attDoneCount = Object.values(st.attendanceByActivity).filter(Boolean).length;
                                            attInfo = attDoneCount > 0 ? { status: `${attDoneCount} sesi`, participationScore: null } : null;
                                            scoredCount = Object.values(st.scoresCountByActivity).reduce((a, b) => a + b, 0);
                                            totalParams = Object.values(st.totalParamsByActivity).reduce((a, b) => a + b, 0);
                                          } else {
                                            attInfo = st.attendanceByActivity[selectedActivity] || null;
                                            scoredCount = st.scoresCountByActivity[selectedActivity] || 0;
                                            totalParams = st.totalParamsByActivity[selectedActivity] || 0;
                                          }

                                          return (
                                            <tr key={st.id} className="hover:bg-muted/20">
                                              <td className="p-2">
                                                <p className="font-semibold text-foreground">{st.name}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono">{st.nrp}</p>
                                              </td>
                                              <td className="p-2">
                                                {attInfo ? (
                                                  <span
                                                    className={cn(
                                                      "px-2 py-0.5 rounded font-bold text-[10px] border",
                                                      attInfo.status === "HADIR"
                                                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                                                        : attInfo.status === "IZIN"
                                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                                        : attInfo.status === "ALPA"
                                                        ? "bg-destructive/10 text-destructive border-destructive/20"
                                                        : "bg-muted text-muted-foreground border-border"
                                                    )}
                                                  >
                                                    {attInfo.status}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground text-[10px] italic">Belum Diisi</span>
                                                )}
                                              </td>
                                              <td className="p-2 font-mono text-[10px]">
                                                {attInfo?.participationScore ? (
                                                  <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                                    Skor: {attInfo.participationScore}
                                                  </span>
                                                ) : (
                                                  "-"
                                                )}
                                              </td>
                                              <td className="p-2 font-mono text-[10px]">
                                                {totalParams > 0 ? (
                                                  <span
                                                    className={cn(
                                                      "font-bold px-1.5 py-0.5 rounded border",
                                                      scoredCount >= totalParams
                                                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                                                        : scoredCount > 0
                                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                                        : "bg-destructive/10 text-destructive border-destructive/20"
                                                    )}
                                                  >
                                                    {scoredCount} / {totalParams} parameter
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">Tidak ada parameter</span>
                                                )}
                                              </td>
                                              <td className="p-2 font-mono text-[10px]">
                                                {st.unverifiedLogbooks > 0 ? (
                                                  <span className="text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                    {st.unverifiedLogbooks} unverified
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">0</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// React import fix
import React from "react";
