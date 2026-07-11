"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { raiseFlagAction } from "@/app/(dashboard)/mentor/actions";

export function RaiseFlagForm({ students }: { students: Array<{ id: string; name: string }> }) {
  const [studentId, setStudentId] = useState<string>("none");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    if (!message.trim()) {
      toast.error("Tuliskan detail flag terlebih dahulu.");
      return;
    }
    startTransition(async () => {
      const result = await raiseFlagAction(studentId === "none" ? null : studentId, message);
      if (result.ok) {
        toast.success("Flag terkirim ke Kepala Region.");
        setMessage("");
        setStudentId("none");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} className="space-y-3" onSubmit={(e) => e.preventDefault()}>
      <Select value={studentId} onValueChange={(value) => setStudentId(value ?? "none")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Terkait maba tertentu (opsional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Umum (tidak terkait maba tertentu)</SelectItem>
          {students.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Jelaskan isu yang perlu perhatian Kepala Region..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
      />
      <Button type="button" onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
        Kirim Flag
      </Button>
    </form>
  );
}
