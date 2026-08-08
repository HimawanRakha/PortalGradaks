"use client";

import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type RegionMatrixItem = {
  id: string;
  code: string;
  name: string;
  unitsCount: number;
  mabaCount: number;
  progress: number;
  pendingLogbooks: number;
  openFlags: number;
};

type SortField = "code" | "name" | "mabaCount" | "progress" | "pendingLogbooks" | "openFlags";
type SortOrder = "asc" | "desc";

export function RegionMatrixTable({ initialRegions }: { initialRegions: RegionMatrixItem[] }) {
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredRegions = initialRegions.filter((reg) => {
    if (selectedRegion === "ALL") return true;
    return reg.id === selectedRegion;
  });

  const sortedRegions = [...filteredRegions].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    const numA = Number(aVal) || 0;
    const numB = Number(bVal) || 0;
    return sortOrder === "asc" ? numA - numB : numB - numA;
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="size-3 text-muted-foreground/60 ml-1 inline" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="size-3 text-primary ml-1 inline" />
    ) : (
      <ArrowDown className="size-3 text-primary ml-1 inline" />
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 pt-2">
        <p className="text-xs text-muted-foreground">
          Klik header kolom untuk mengurutkan (sorting) data tiap region.
        </p>
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filter Region:</span>
          <Select value={selectedRegion} onValueChange={(val) => setSelectedRegion(val || "ALL")}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Semua Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Region ({initialRegions.length})</SelectItem>
              {initialRegions.map((reg) => (
                <SelectItem key={reg.id} value={reg.id}>
                  {reg.code} - {reg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b text-muted-foreground font-medium text-xs select-none">
              <th className="p-3 cursor-pointer hover:bg-muted/60" onClick={() => handleSort("code")}>
                Region {getSortIcon("code")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-muted/60" onClick={() => handleSort("mabaCount")}>
                Total Maba {getSortIcon("mabaCount")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-muted/60 w-56" onClick={() => handleSort("progress")}>
                Rata-rata Pengisian Nilai {getSortIcon("progress")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-muted/60" onClick={() => handleSort("pendingLogbooks")}>
                Logbook Belum Verifikasi {getSortIcon("pendingLogbooks")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-muted/60" onClick={() => handleSort("openFlags")}>
                Eskalasi Isu {getSortIcon("openFlags")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedRegions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Tidak ada data region yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              sortedRegions.map((reg) => (
                <tr key={reg.id} className="hover:bg-muted/30">
                  <td className="p-3 font-semibold text-foreground">
                    <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] mr-1.5 border border-primary/20">
                      {reg.code}
                    </span>
                    {reg.name}
                    <span className="text-[10px] text-muted-foreground ml-2 font-normal">({reg.unitsCount} unit)</span>
                  </td>
                  <td className="p-3 text-muted-foreground font-mono">{reg.mabaCount} maba</td>
                  <td className="p-3 w-56">
                    {reg.mabaCount === 0 ? (
                      <span className="text-muted-foreground font-normal">Tidak ada maba</span>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px]">
                          <span>Progress Pengisian</span>
                          <span>{reg.progress}%</span>
                        </div>
                        <Progress value={reg.progress} className="h-1.5" />
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {reg.pendingLogbooks > 0 ? (
                      <span className="text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-[10px]">
                        {reg.pendingLogbooks} pending
                      </span>
                    ) : (
                      <span className="text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 text-[10px]">
                        Lengkap
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {reg.openFlags > 0 ? (
                      <span className="text-destructive font-bold bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20 text-[10px]">
                        {reg.openFlags} eskalasi
                      </span>
                    ) : (
                      <span className="text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 text-[10px]">
                        Clean
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
