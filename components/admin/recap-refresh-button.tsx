"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshRecapAction } from "@/app/(dashboard)/admin/actions";

export function RecapRefreshButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await refreshRecapAction();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          router.refresh();
          toast.success("Rekap dihitung ulang dari data terbaru.");
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Hitung ulang
    </Button>
  );
}
