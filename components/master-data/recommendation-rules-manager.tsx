"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, Info } from "lucide-react";
import { RecommendationMetric, RuleOperator } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createRecommendationRuleAction,
  updateRecommendationRuleAction,
  deleteRecommendationRuleAction,
} from "@/app/(dashboard)/admin/master-data/actions";

const METRIC_LABELS: Record<RecommendationMetric, string> = {
  [RecommendationMetric.PERSONAL_SCORE]: "Nilai Personal (Total)",
  [RecommendationMetric.SKILL_SCORE]: "Nilai Keahlian (Total)",
  [RecommendationMetric.PERSONAL_KOLEKTIF]: "Personal — Kolektif (A)",
  [RecommendationMetric.PERSONAL_KOLABORASI]: "Personal — Kolaborasi (B)",
  [RecommendationMetric.PERSONAL_KONTRIBUSI]: "Personal — Kontribusi (C)",
  [RecommendationMetric.SKILL_MANAJERIAL]: "Keahlian — Manajerial (M)",
  [RecommendationMetric.SKILL_KEILMIAHAN]: "Keahlian — Keilmiahan (K)",
  [RecommendationMetric.SKILL_MINAT_BAKAT]: "Keahlian — Minat Bakat (MB)",
  [RecommendationMetric.SKILL_KEWIRAUSAHAAN]: "Keahlian — Kewirausahaan (KW)",
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  [RuleOperator.LT]: "< (Kurang dari)",
  [RuleOperator.LTE]: "≤ (Kurang dari atau sama dengan)",
  [RuleOperator.GT]: "> (Lebih dari)",
  [RuleOperator.GTE]: "≥ (Lebih dari atau sama dengan)",
  [RuleOperator.BETWEEN]: "Di antara (rentang)",
};

function formatCondition(metric: RecommendationMetric, operator: RuleOperator, value: number, valueTo: number | null): string {
  const m = METRIC_LABELS[metric];
  if (operator === RuleOperator.BETWEEN) return `${m} antara ${value} – ${valueTo ?? "?"}`;
  const symbol = operator === RuleOperator.LT ? "<" : operator === RuleOperator.LTE ? "≤" : operator === RuleOperator.GT ? ">" : "≥";
  return `${m} ${symbol} ${value}`;
}

export type RecommendationRuleData = {
  id: string;
  name: string;
  metric: RecommendationMetric;
  operator: RuleOperator;
  value: number;
  valueTo: number | null;
  recommendationText: string | null;
  descriptionText: string | null;
  order: number;
  active: boolean;
};

export function RecommendationRulesManager({ initialRules }: { initialRules: RecommendationRuleData[] }) {
  const [rules] = useState<RecommendationRuleData[]>(initialRules);
  const [pending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<RecommendationMetric>(RecommendationMetric.PERSONAL_SCORE);
  const [operator, setOperator] = useState<RuleOperator>(RuleOperator.LT);
  const [value, setValue] = useState("");
  const [valueTo, setValueTo] = useState("");
  const [recommendationText, setRecommendationText] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [order, setOrder] = useState("");
  const [active, setActive] = useState(true);

  const openModal = (rule?: RecommendationRuleData) => {
    if (rule) {
      setEditId(rule.id);
      setName(rule.name);
      setMetric(rule.metric);
      setOperator(rule.operator);
      setValue(String(rule.value));
      setValueTo(rule.valueTo !== null ? String(rule.valueTo) : "");
      setRecommendationText(rule.recommendationText ?? "");
      setDescriptionText(rule.descriptionText ?? "");
      setOrder(String(rule.order));
      setActive(rule.active);
    } else {
      setEditId(null);
      setName("");
      setMetric(RecommendationMetric.PERSONAL_SCORE);
      setOperator(RuleOperator.LT);
      setValue("");
      setValueTo("");
      setRecommendationText("");
      setDescriptionText("");
      setOrder(String(rules.length + 1));
      setActive(true);
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !value || !order) {
      toast.error("Nama, nilai ambang, dan urutan wajib diisi.");
      return;
    }
    if (operator === RuleOperator.BETWEEN && !valueTo) {
      toast.error("Operator 'Di antara' wajib mengisi nilai batas atas.");
      return;
    }
    if (!recommendationText.trim() && !descriptionText.trim()) {
      toast.error("Isi minimal salah satu dari Teks Rekomendasi atau Teks Deskripsi.");
      return;
    }

    startTransition(async () => {
      const data = {
        name,
        metric,
        operator,
        value: Number(value),
        valueTo: operator === RuleOperator.BETWEEN ? Number(valueTo) : null,
        recommendationText: recommendationText.trim() || null,
        descriptionText: descriptionText.trim() || null,
        order: Number(order),
        active,
      };

      const res = editId ? await updateRecommendationRuleAction(editId, data) : await createRecommendationRuleAction(data);

      if (res.ok) {
        toast.success(editId ? "Rule rekomendasi diperbarui." : "Rule rekomendasi dibuat.");
        setIsOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (id: string, ruleName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus rule "${ruleName}"?`)) return;

    startTransition(async () => {
      const res = await deleteRecommendationRuleAction(id);
      if (res.ok) {
        toast.success("Rule rekomendasi berhasil dihapus.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Rule Rekomendasi & Deskripsi Otomatis</h3>
          <p className="text-xs text-muted-foreground">
            Setiap rule diuji terhadap Nilai Personal/Keahlian maba saat finalisasi. Rule pertama (urutan terkecil) yang cocok dan mengisi
            Teks Rekomendasi menjadi label utama raport; semua rule yang cocok dan mengisi Teks Deskripsi digabung menjadi narasi lengkap.
          </p>
        </div>
        <Button onClick={() => openModal()} size="sm">
          <Plus className="size-4" />
          Tambah Rule
        </Button>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 text-[11px] flex items-start gap-2">
          <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Rule ini tidak berlaku untuk maba yang kena gate &ldquo;Tidak Dapat Diagregasi&rdquo; (kekurangan presensi Temu FTEIC) — maba tersebut
            selalu dapat status &amp; pesan tetap, diatur terpisah di halaman Bobot Penilaian.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">Belum ada rule rekomendasi.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Urutan</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3">Kondisi</th>
                    <th className="p-3">Rekomendasi</th>
                    <th className="p-3">Deskripsi</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rules.map((rule) => (
                    <tr key={rule.id} className={`hover:bg-muted/30 ${!rule.active ? "opacity-60" : ""}`}>
                      <td className="p-3 font-mono">{rule.order}</td>
                      <td className="p-3 font-semibold text-foreground">{rule.name}</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {formatCondition(rule.metric, rule.operator, rule.value, rule.valueTo)}
                      </td>
                      <td className="p-3">{rule.recommendationText ?? <span className="opacity-50">—</span>}</td>
                      <td className="p-3 max-w-xs truncate text-muted-foreground" title={rule.descriptionText ?? ""}>
                        {rule.descriptionText ?? <span className="opacity-50">—</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rule.active ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}>
                          {rule.active ? "Aktif" : "Non-aktif"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="xs" variant="ghost" onClick={() => openModal(rule)}>
                            <Edit2 className="size-3" />
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(rule.id, rule.name)}
                            disabled={pending}
                          >
                            <Trash2 className="size-3" />
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Rule Rekomendasi" : "Tambah Rule Rekomendasi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid gap-1">
              <Label htmlFor="rule-name">Nama Rule (referensi internal)</Label>
              <Input id="rule-name" placeholder="Personal rendah" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="rule-metric">Metrik yang Diuji</Label>
                <Select value={metric} onValueChange={(val) => val && setMetric(val as RecommendationMetric)}>
                  <SelectTrigger id="rule-metric" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(RecommendationMetric).map((m) => (
                      <SelectItem key={m} value={m}>{METRIC_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="rule-operator">Operator</Label>
                <Select value={operator} onValueChange={(val) => val && setOperator(val as RuleOperator)}>
                  <SelectTrigger id="rule-operator" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(RuleOperator).map((op) => (
                      <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={`grid gap-3 ${operator === RuleOperator.BETWEEN ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="grid gap-1">
                <Label htmlFor="rule-value">{operator === RuleOperator.BETWEEN ? "Nilai Batas Bawah" : "Nilai Ambang"}</Label>
                <Input id="rule-value" type="number" placeholder="60" value={value} onChange={(e) => setValue(e.target.value)} className="h-8" />
              </div>
              {operator === RuleOperator.BETWEEN && (
                <div className="grid gap-1">
                  <Label htmlFor="rule-value-to">Nilai Batas Atas</Label>
                  <Input id="rule-value-to" type="number" placeholder="84" value={valueTo} onChange={(e) => setValueTo(e.target.value)} className="h-8" />
                </div>
              )}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="rule-rec">Teks Rekomendasi (label singkat — opsional)</Label>
              <Input
                id="rule-rec"
                placeholder="Perlu Pendampingan Tambahan"
                value={recommendationText}
                onChange={(e) => setRecommendationText(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">
                Kosongkan jika rule ini hanya menambahkan narasi (lihat di bawah), tidak menentukan label utama raport.
              </span>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="rule-desc">Teks Deskripsi (narasi — opsional)</Label>
              <Textarea
                id="rule-desc"
                placeholder="Menunjukkan kebutuhan pendampingan lebih lanjut pada aspek ini."
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-center pt-2">
              <div className="grid gap-1">
                <Label htmlFor="rule-order">Urutan Evaluasi</Label>
                <Input id="rule-order" type="number" placeholder="1" value={order} onChange={(e) => setOrder(e.target.value)} className="h-8" />
                <span className="text-[10px] text-muted-foreground">Rule urutan terkecil dievaluasi lebih dulu.</span>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Checkbox id="rule-active" checked={active} onCheckedChange={(val) => setActive(!!val)} />
                <Label htmlFor="rule-active" className="cursor-pointer font-normal">Rule Aktif</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogTrigger render={<Button variant="outline" />}>Batal</DialogTrigger>
            <Button onClick={handleSave} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
