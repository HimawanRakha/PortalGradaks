"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmSessionAction } from "@/app/(dashboard)/mentor/actions";

export function ConfirmSessionButton({ sessionId, confirmed }: { sessionId: string; confirmed: boolean }) {
  const [pending, startTransition] = useTransition();

  if (confirmed) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1.5">
        <Check className="size-4" />
        Terkonfirmasi
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
