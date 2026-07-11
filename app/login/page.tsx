import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

const DEMO_ACCOUNTS = [
  { role: "PSDM / Admin", nrp: "admin", password: "gradaks2026" },
  { role: "Kepala Region", nrp: "kr.r01", password: "gradaks2026" },
  { role: "Mentor", nrp: "mentor.r01-u01", password: "gradaks2026" },
];

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </div>
          <h1 className="text-lg font-semibold">Portal Pengembangan MABA 26</h1>
          <p className="text-sm text-muted-foreground">GRADAKS 2026 — PSDM BEM FTEIC</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>Gunakan NRP dan password akun Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        {process.env.NODE_ENV !== "production" ? (
          <Card className="border-dashed bg-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Akun demo (data seed, hanya development)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              {DEMO_ACCOUNTS.map((acc) => (
                <div key={acc.nrp} className="flex items-center justify-between gap-2">
                  <span>{acc.role}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {acc.nrp} / {acc.password}
                  </code>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
