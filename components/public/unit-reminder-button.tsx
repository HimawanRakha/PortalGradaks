"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

// Copy-only by design: /cek-unit is public and unit codes are guessable, so
// no mentor contact (phone / wa.me link) is ever exposed here — the Ketua
// Unit pastes the message into the unit's WA group themselves.
export function UnitReminderButton({
  mentorName,
  unitCode,
  unitName,
  incompleteItems,
  overallPct,
}: {
  mentorName: string | null;
  unitCode: string;
  unitName: string;
  incompleteItems: { activityName: string; label: string }[];
  overallPct: number;
}) {
  const [copied, setCopied] = useState(false);

  const byActivity = new Map<string, string[]>();
  for (const it of incompleteItems) {
    const list = byActivity.get(it.activityName) ?? [];
    list.push(it.label);
    byActivity.set(it.activityName, list);
  }
  const listText = Array.from(byActivity, ([act, labels]) => `*${act}*\n${labels.map((l) => `- ${l}`).join("\n")}`).join("\n\n");

  const message =
    `Halo Kak ${mentorName || "Mentor"}, izin mengingatkan dari Portal Gradaks 🙏\n\n` +
    `Status kelengkapan nilai Unit ${unitName} (${unitCode}) saat ini ${overallPct}%. Berikut yang masih belum lengkap diinput:\n\n` +
    `${listText}\n\n` +
    `Mohon bantuannya ya Kak agar nilai unit kita 100% lengkap. Terima kasih Kak! 🙏`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Salin pesan berikut:", message);
    }
  };

  return (
    <div className="space-y-3">
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 font-sans text-xs text-muted-foreground">
        {message}
      </pre>
      <Button onClick={handleCopy} className="h-11 w-full gap-2 bg-emerald-600 font-medium text-white hover:bg-emerald-700">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Pesan Berhasil Disalin!" : "Salin Chat Reminder WA"}
      </Button>
    </div>
  );
}
