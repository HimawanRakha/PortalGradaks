"use client";

import { useState } from "react";
import { MapPin, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegionEventCard } from "@/components/event/region-event-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TerkompakParam = { id: string; subCode: string; name: string };
type Unit = { id: string; code: string; name: string };
type RegionData = {
  id: string;
  code: string;
  name: string;
  units: Unit[];
};

export function RegionScoringTabs({
  regions,
  terkompakParams,
  throneParam,
  regionScoreMap,
  throneValueByUnit,
}: {
  regions: RegionData[];
  terkompakParams: TerkompakParam[];
  throneParam: { id: string; name: string };
  regionScoreMap: Map<string, Record<string, number | null>>;
  throneValueByUnit: Map<string, number | null>;
}) {
  const [selectedRegionId, setSelectedRegionId] = useState<string>(regions[0]?.id ?? "ALL");

  const selectedRegion = regions.find((r) => r.id === selectedRegionId);
  const displayedRegions = selectedRegionId === "ALL" ? regions : regions.filter((r) => r.id === selectedRegionId);

  return (
    <div className="space-y-6">
      {/* Header Control Bar with Dropdown & Region Tabs */}
      <div className="rounded-xl border bg-card p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <MapPin className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Region Penilaian</p>
              <h3 className="text-base font-bold text-foreground">
                {selectedRegionId === "ALL" ? "Semua Region Penilaian" : selectedRegion?.name}
              </h3>
            </div>
          </div>

          {/* Main Region Dropdown Selector */}
          <div className="flex items-center gap-2">
            <Select value={selectedRegionId} onValueChange={(val) => setSelectedRegionId(val || regions[0]?.id || "ALL")}>
              <SelectTrigger className="w-full sm:w-[280px] h-10 font-medium bg-background border-primary/20 hover:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-all shadow-xs">
                <SelectValue placeholder="Pilih Region...">
                  {selectedRegionId === "ALL" ? (
                    <span className="flex items-center gap-2 font-semibold text-primary">
                      <Layers className="size-4" /> Semua Region ({regions.length})
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 font-semibold truncate text-foreground">
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0">
                        {selectedRegion?.code}
                      </Badge>
                      <span className="truncate">{selectedRegion?.name}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="w-[300px]">
                <SelectItem value="ALL" className="font-medium">
                  <span className="flex items-center gap-2 text-primary font-semibold">
                    <Layers className="size-4" /> Tampilkan Semua Region ({regions.length})
                  </span>
                </SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="cursor-pointer py-2">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-semibold truncate">{r.name}</span>
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border text-muted-foreground shrink-0">{r.code}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Region Pills / Quick Switch Tabs showing Region Name */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t scrollbar-none">
          <Button
            variant={selectedRegionId === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRegionId("ALL")}
            className="h-8 text-xs shrink-0 rounded-full px-3"
          >
            <Layers className="size-3.5 mr-1.5" />
            Semua
          </Button>
          {regions.map((r) => {
            const isActive = selectedRegionId === r.id;
            return (
              <Button
                key={r.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRegionId(r.id)}
                className="h-8 text-xs shrink-0 rounded-full px-3 transition-all"
              >
                <span className="font-mono opacity-75 mr-1 text-[10px]">{r.code}</span>
                {r.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Region Content Display Grid/Card */}
      <div className={selectedRegionId === "ALL" ? "grid gap-4 lg:grid-cols-2" : "max-w-2xl mx-auto"}>
        {displayedRegions.map((region) => (
          <RegionEventCard
            key={region.id}
            region={{ id: region.id, code: region.code, name: region.name }}
            units={region.units}
            terkompakParams={terkompakParams}
            throneParam={throneParam}
            initialTerkompakValues={regionScoreMap.get(region.id) ?? {}}
            initialThroneValues={Object.fromEntries(region.units.map((u) => [u.id, throneValueByUnit.get(u.id) ?? null]))}
          />
        ))}
      </div>
    </div>
  );
}
