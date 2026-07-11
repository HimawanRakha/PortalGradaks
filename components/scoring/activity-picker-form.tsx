import { AutoSubmitSelect } from "./auto-submit-select";

/**
 * A plain GET form — selecting an option auto-submits and reloads the page
 * with the new query string. No client state needed, and the resulting URL
 * is shareable/refresh-safe since everything is server-rendered from
 * searchParams.
 */
export function ActivityPickerForm({
  action,
  paramName,
  value,
  options,
  extraHidden,
}: {
  action: string;
  paramName: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  extraHidden?: Record<string, string>;
}) {
  return (
    <form action={action} className="w-full max-w-xs">
      {extraHidden
        ? Object.entries(extraHidden).map(([key, val]) => <input key={key} type="hidden" name={key} value={val} />)
        : null}
      <AutoSubmitSelect name={paramName} defaultValue={value} options={options} />
    </form>
  );
}
