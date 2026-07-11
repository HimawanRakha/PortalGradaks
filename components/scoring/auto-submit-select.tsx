"use client";

/**
 * A native <select> that submits its enclosing GET form on change — the
 * simplest robust way to make a filter control that's fully server-driven
 * via searchParams (shareable/refresh-safe URLs), no client state needed.
 */
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  className,
}: {
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className={
        className ??
        "h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      }
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
