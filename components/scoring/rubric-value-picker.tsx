"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Anchors = Record<string, string> | null | undefined;

/** 1-4 rubric buttons for maxValue<=4, a plain number input otherwise (post-test style). */
export function RubricValuePicker({
  value,
  onChange,
  maxValue,
  anchors,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  maxValue: number;
  anchors?: Anchors;
}) {
  if (maxValue > 4) {
    return (
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={maxValue}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? null : Math.max(0, Math.min(maxValue, Number(raw))));
        }}
        className="h-10 w-20 text-center"
      />
    );
  }

  const options = Array.from({ length: maxValue }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? null : opt)}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg border text-base font-semibold transition-colors",
            value === opt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:bg-muted",
          )}
        >
          {opt}
        </button>
      ))}
      {anchors ? (
        <Popover>
          <PopoverTrigger render={<button type="button" className="ml-1 text-muted-foreground" aria-label="Lihat rubrik" />}>
            <Info className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-1.5 text-xs">
            {options.map((opt) => (
              <p key={opt}>
                <span className="font-semibold">{opt}: </span>
                {anchors[String(opt)] ?? "-"}
              </p>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
