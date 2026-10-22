"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, Copy, HeartHandshake, MessageCircle, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { BroadcastKind } from "@/lib/broadcast/message";
import { buildWhatsAppUrl, usablePhone } from "@/lib/broadcast/whatsapp";
import { recordBroadcastAction } from "@/app/(dashboard)/admin/unit-tracking/actions";

/** One unit's ready-to-send BC. `message` is already rendered by the server (lib/broadcast/message.ts). */
export type BroadcastEntry = {
  unitId: string;
  unitCode: string;
  unitName: string;
  mentorName: string | null;
  mentorPhone: string | null;
  kind: BroadcastKind;
  incompleteCount: number;
  message: string;
};

export type BroadcastView =
  | { mode: "single"; entries: [BroadcastEntry] }
  | { mode: "list"; entries: BroadcastEntry[]; skippedCount: number };

const KIND_LABEL: Record<BroadcastKind, string> = { REMINDER: "BC Reminder", THANK_YOU: "BC Terima Kasih" };

function BroadcastEntryCard({
  entry,
  defaultExpanded,
  handled,
  feedbackUrlConfigured,
  onHandled,
}: {
  entry: BroadcastEntry;
  defaultExpanded: boolean;
  handled: boolean;
  feedbackUrlConfigured: boolean;
  onHandled: (entry: BroadcastEntry) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const phone = usablePhone(entry.mentorPhone);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Salin pesan berikut:", entry.message);
    }
    onHandled(entry);
  };

  return (
    <div className="rounded-lg border bg-background p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
              {entry.unitCode}
            </span>
            <span className="truncate font-semibold text-foreground">{entry.unitName}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Mentor: <span className="font-medium text-foreground">{entry.mentorName ?? "Belum ditugaskan"}</span>
            {phone ? (
              <>
                {" · "}
                <span className="font-mono">{phone}</span>
              </>
            ) : null}
          </p>
        </div>
        {entry.kind === "REMINDER" ? (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {entry.incompleteCount} belum lengkap
          </Badge>
        ) : (
          <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400">
            Lengkap
          </Badge>
        )}
      </div>

      {!phone ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <TriangleAlert className="mt-px size-3 shrink-0" />
          Nomor WA mentor belum diisi (Master Data &gt; Akun). WhatsApp akan terbuka tanpa tujuan — pilih kontak atau grup unit sendiri.
        </p>
      ) : null}
      {entry.kind === "THANK_YOU" && !feedbackUrlConfigured ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <TriangleAlert className="mt-px size-3 shrink-0" />
          Link feedback belum diatur (Master Data &gt; Pengaturan) — pesan terima kasih ini terkirim tanpa link feedback.
        </p>
      ) : null}

      {expanded ? (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 font-sans text-xs text-muted-foreground">
          {entry.message}
        </pre>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="xs" variant="ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Sembunyikan pesan" : "Lihat pesan"}
        </Button>
        <div className="flex items-center gap-2">
          {handled ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="size-3" /> Sudah dibuka
            </span>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Tersalin" : "Salin"}
          </Button>
          <a
            href={buildWhatsAppUrl(entry.mentorPhone, entry.message)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onHandled(entry)}
            className={cn(buttonVariants({ size: "sm" }), "bg-emerald-600 text-white hover:bg-emerald-700")}
          >
            <MessageCircle />
            Buka WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Manual-send BC workflow for the Tracking Unit page: nothing is sent from
 * here — admin taps "Buka WhatsApp" (wa.me deep link, chat straight to the
 * mentor) or copies the text, and presses send in WhatsApp themselves.
 * Opening/copying is recorded once per unit per dialog session so the page
 * can show "BC terakhir dibuka".
 */
export function BroadcastDialog({
  open,
  onOpenChange,
  view,
  feedbackUrlConfigured,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: BroadcastView | null;
  feedbackUrlConfigured: boolean;
  onRecorded: (unitId: string, at: string) => void;
}) {
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());

  const handleOpenChange = (next: boolean) => {
    if (!next) setHandledIds(new Set());
    onOpenChange(next);
  };

  const handleHandled = (entry: BroadcastEntry) => {
    if (handledIds.has(entry.unitId)) return;
    setHandledIds((prev) => new Set(prev).add(entry.unitId));
    recordBroadcastAction(entry.unitId, entry.message)
      .then((res) => {
        if (res.ok) onRecorded(entry.unitId, res.at);
        else toast.error(`Gagal mencatat BC unit ${entry.unitCode}: ${res.error}`);
      })
      .catch(() => toast.error(`Gagal mencatat BC unit ${entry.unitCode}.`));
  };

  const renderCards = (entries: BroadcastEntry[], defaultExpanded: boolean) =>
    entries.length === 0 ? (
      <p className="py-8 text-center text-xs text-muted-foreground">Tidak ada unit di daftar ini.</p>
    ) : (
      <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <BroadcastEntryCard
            key={entry.unitId}
            entry={entry}
            defaultExpanded={defaultExpanded}
            handled={handledIds.has(entry.unitId)}
            feedbackUrlConfigured={feedbackUrlConfigured}
            onHandled={handleHandled}
          />
        ))}
      </div>
    );

  const reminders = view?.entries.filter((e) => e.kind === "REMINDER") ?? [];
  const thanks = view?.entries.filter((e) => e.kind === "THANK_YOU") ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {view?.mode === "single" ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {KIND_LABEL[view.entries[0].kind]} — Unit {view.entries[0].unitCode}
              </DialogTitle>
              <DialogDescription>
                Pesan ini dikirim manual: buka WhatsApp untuk chat langsung ke mentor, atau salin lalu tempel di grup unit.
              </DialogDescription>
            </DialogHeader>
            <BroadcastEntryCard
              entry={view.entries[0]}
              defaultExpanded
              handled={handledIds.has(view.entries[0].unitId)}
              feedbackUrlConfigured={feedbackUrlConfigured}
              onHandled={handleHandled}
            />
          </>
        ) : view?.mode === "list" ? (
          <>
            <DialogHeader>
              <DialogTitle>Daftar BC WhatsApp</DialogTitle>
              <DialogDescription>
                Satu per satu: tekan &ldquo;Buka WhatsApp&rdquo;, kirim pesannya di WhatsApp, lalu lanjut ke unit berikutnya. Unit yang
                sudah dibuka ditandai.
                {view.skippedCount > 0 ? ` ${view.skippedCount} unit tidak masuk daftar karena belum ada kegiatan yang berjalan.` : ""}
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue={reminders.length > 0 ? "REMINDER" : "THANK_YOU"}>
              <TabsList>
                <TabsTrigger value="REMINDER">
                  <BellRing />
                  BC Reminder ({reminders.length})
                </TabsTrigger>
                <TabsTrigger value="THANK_YOU">
                  <HeartHandshake />
                  BC Terima Kasih ({thanks.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="REMINDER">{renderCards(reminders, false)}</TabsContent>
              <TabsContent value="THANK_YOU">{renderCards(thanks, false)}</TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
