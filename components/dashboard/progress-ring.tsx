import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  className,
  label,
}: {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 100 ? "text-emerald-500" : clamped >= 50 ? "text-primary" : "text-amber-500";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("fill-none stroke-current transition-[stroke-dashoffset] duration-500", color)}
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums">{label ?? `${Math.round(clamped)}%`}</span>
    </div>
  );
}
