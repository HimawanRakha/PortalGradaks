"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmSessionAction, cancelConfirmSessionAction } from "@/app/(dashboard)/mentor/actions";

export function ConfirmSessionButton({ sessionId, confirmed }: { sessionId: string; confirmed: boolean }) {
  const [pending, startTransition] = useTransition();

  if (confirmed) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelConfirmSessionAction(sessionId);
            if (result.ok) toast.success("Konfirmasi dibatalkan.");
            else toast.error(result.error);
          })
        }
        className="group gap-1.5 border-emerald-500 text-emerald-600 hover:border-destructive hover:bg-destructive hover:text-destructive-foreground dark:border-emerald-500/50 dark:text-emerald-400"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Check className="size-4 group-hover:hidden" />
            <X className="size-4 hidden group-hover:block" />
          </>
        )}
        <span className="group-hover:hidden">Terkonfirmasi</span>
        <span className="hidden group-hover:inline">Batal Konfirmasi</span>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await confirmSessionAction(sessionId);
          if (result.ok) toast.success("Sesi dikonfirmasi.");
          else toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      Konfirmasi
    </Button>
  );
}
