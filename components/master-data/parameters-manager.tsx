"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, SlidersHorizontal, Info, Trash2, HelpCircle, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { ParameterType, InputMethod } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  createParameterAction,
  updateParameterAction,
  deleteParameterAction,
} from "@/app/(dashboard)/admin/master-data/actions";
import { getScoreCategoryMapping, STANDARD_SUB_CODE_REFERENCES } from "@/lib/scoring/mapping-utils";

type ParameterData = {
  id: string;
  subCode: string;
  name: string;
  type: ParameterType;
  personalWeight: number | null;
  skillWeight: number | null;
  maxValue: number;
  inputMethod: InputMethod;
  order: number;
  clusterLabel: string | null;
  rubricAnchors: Record<string, string> | null;
  active: boolean;
  material: {
    id: string;
    code: string;
    name: string;
    activity: {
      id: string;
      code: string;
      name: string;
    };
  };
};

type MaterialOption = {
  id: string;
  code: string;
  name: string;
  activityId: string;
};

export function ParametersManager({
  initialParameters,
  materials,
}: {
  initialParameters: ParameterData[];
  materials: MaterialOption[];
}) {
  const [parameters] = useState<ParameterData[]>(initialParameters);
  const [filterMaterialId, setFilterMaterialId] = useState<string>("ALL");
  const [showGuide, setShowGuide] = useState(false);
  const [pending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState("");
  const [subCode, setSubCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ParameterType>(ParameterType.A);
  const [personalWeight, setPersonalWeight] = useState("");
  const [skillWeight, setSkillWeight] = useState("");
  const [maxValue, setMaxValue] = useState("4");
  const [inputMethod, setInputMethod] = useState<InputMethod>(InputMethod.MENTOR);
  const [order, setOrder] = useState("");
  const [clusterLabel, setClusterLabel] = useState("");
  const [active, setActive] = useState(true);

  // Rubric Anchors (Type B behaviors)
  const [anchor1, setAnchor1] = useState("");
  const [anchor2, setAnchor2] = useState("");
  const [anchor3, setAnchor3] = useState("");
  const [anchor4, setAnchor4] = useState("");

  const openModal = (param?: ParameterData) => {
    if (param) {
      setEditId(param.id);
      setMaterialId(param.material.id);
      setSubCode(param.subCode);
      setName(param.name);
      setType(param.type);
      setPersonalWeight(param.personalWeight !== null ? String(param.personalWeight) : "");
      setSkillWeight(param.skillWeight !== null ? String(param.skillWeight) : "");
      setMaxValue(String(param.maxValue));
      setInputMethod(param.inputMethod);
      setOrder(String(param.order));
      setClusterLabel(param.clusterLabel ?? "");
      setActive(param.active);

      const anchors = param.rubricAnchors || {};
      setAnchor1(anchors["1"] || "");
      setAnchor2(anchors["2"] || "");
      setAnchor3(anchors["3"] || "");
      setAnchor4(anchors["4"] || "");
    } else {
      setEditId(null);
      setMaterialId(materials[0]?.id || "");
      setSubCode("");
      setName("");
      setType(ParameterType.B);
      setPersonalWeight("");
      setSkillWeight("");
      setMaxValue("4");
      setInputMethod(InputMethod.MENTOR);
      setOrder(String(parameters.length + 1));
      setClusterLabel("");
      setActive(true);
      setAnchor1("");
      setAnchor2("");
      setAnchor3("");
      setAnchor4("");
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!materialId || !subCode || !name || !maxValue || !order) {
      toast.error("Semua field wajib diisi.");
      return;
    }

    startTransition(async () => {
      let res;
      const anchors = type === ParameterType.B ? {
        "1": anchor1.trim(),
        "2": anchor2.trim(),
        "3": anchor3.trim(),
        "4": anchor4.trim(),
      } : null;

      const data = {
        materialId,
        subCode,
        name,
        type,
        personalWeight: personalWeight ? Number(personalWeight) : null,
        skillWeight: skillWeight ? Number(skillWeight) : null,
        maxValue: Number(maxValue),
        inputMethod,
        order: Number(order),
        clusterLabel: clusterLabel.trim() || null,
        rubricAnchors: anchors,
        active,
      };

      if (editId) {
        res = await updateParameterAction(editId, data);
      } else {
        res = await createParameterAction(data);
      }

      if (res.ok) {
        toast.success(editId ? "Parameter diperbarui." : "Parameter dibuat.");
        setIsOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus parameter "${name}"? Semua log nilai maba yang menggunakan parameter ini juga akan terhapus secara permanen.`)) return;

    startTransition(async () => {
      const res = await deleteParameterAction(id);
      if (res.ok) {
        toast.success("Parameter berhasil dihapus.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const filteredParams = filterMaterialId === "ALL" 
    ? parameters 
    : parameters.filter(p => p.material.id === filterMaterialId);

  // Live mapping preview for current input state inside the dialog
  const liveMapping = getScoreCategoryMapping(
    subCode,
    type,
    personalWeight ? Number(personalWeight) : null,
    skillWeight ? Number(skillWeight) : null
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Pengelolaan Parameter Penilaian</h3>
          <p className="text-xs text-muted-foreground">Detail instrumen penilaian, kode sub, komponen raport, bobot hitung, dan rubrik perilaku.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => setShowGuide(!showGuide)} className="gap-1 text-xs">
            <BookOpen className="size-3.5 text-primary" />
            Panduan Mapping Kode Sub
            {showGuide ? <ChevronUp className="size-3.5 ml-0.5" /> : <ChevronDown className="size-3.5 ml-0.5" />}
          </Button>
          <Label htmlFor="filter-material" className="text-xs font-medium text-muted-foreground">Filter Materi:</Label>
          <Select value={filterMaterialId} onValueChange={(val) => setFilterMaterialId(val || "ALL")}>
            <SelectTrigger id="filter-material" className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Pilih Materi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Materi</SelectItem>
              {materials.map(m => (
                <SelectItem key={m.id} value={m.id}>[{m.code}] {m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => openModal()} size="sm">
            <Plus className="size-4" />
            Tambah Parameter
          </Button>
        </div>
      </div>

      {/* Guide Panel: Kode Sub & Penilaian Mapping */}
      {showGuide && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" />
              Panduan Acuan Kode Sub & Mapping Penilaian Raport
            </CardTitle>
            <CardDescription className="text-[11px]">
              Setiap <strong>Kode Sub</strong> secara otomatis dibaca oleh Mesin Perhitungan Raport (<code>lib/scoring/calculate.ts</code>). Berikut adalah daftar kode sub standar beserta target komponen nilainya:
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="overflow-x-auto rounded-lg border bg-background">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b text-muted-foreground font-medium text-[11px]">
                    <th className="p-2.5">Kode Sub</th>
                    <th className="p-2.5">Grup Penilaian</th>
                    <th className="p-2.5">Komponen / Sub-Nilai</th>
                    <th className="p-2.5">Bobot Raport</th>
                    <th className="p-2.5">Aturan Penamaan Kode</th>
                    <th className="p-2.5">Deskripsi Singkat</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                  {STANDARD_SUB_CODE_REFERENCES.map((ref) => (
                    <tr key={ref.code} className="hover:bg-muted/20">
                      <td className="p-2.5 font-mono font-bold text-primary">{ref.code}</td>
                      <td className="p-2.5 font-medium">{ref.targetGroup}</td>
                      <td className="p-2.5 font-semibold text-foreground">{ref.category}</td>
                      <td className="p-2.5 font-mono text-muted-foreground">{ref.weightInfo}</td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{ref.matchingPattern}</td>
                      <td className="p-2.5 text-muted-foreground">{ref.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {filteredParams.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">Tidak ada parameter ditemukan untuk filter ini.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Materi</th>
                    <th className="p-3">Kode Sub</th>
                    <th className="p-3">Masuk Penilaian (Raport/Event)</th>
                    <th className="p-3">Nama Parameter</th>
                    <th className="p-3">Rumpun Penilaian</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Metode Input</th>
                    <th className="p-3">Bobot Personal</th>
                    <th className="p-3">Bobot Skill</th>
                    <th className="p-3">Nilai Maks</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredParams.map((param) => {
                    const categoryMapping = getScoreCategoryMapping(
                      param.subCode,
                      param.type,
                      param.personalWeight,
                      param.skillWeight
                    );

                    return (
                      <tr key={param.id} className={`hover:bg-muted/30 ${!param.active ? "opacity-60" : ""}`}>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-muted-foreground text-[10px] uppercase">
                              {param.material.activity.name}
                            </span>
                            <span className="font-semibold text-foreground text-xs">
                              {param.material.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">{param.subCode}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap ${categoryMapping.badgeClass}`}
                            title={categoryMapping.explanation}
                          >
                            {categoryMapping.fullCategoryLabel}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{param.name}</span>
                            {param.type === ParameterType.B && param.rubricAnchors && (
                              <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1 mt-0.5">
                                <Info className="size-3" /> Rubrik perilaku terisi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {param.clusterLabel ?? <span className="opacity-50">— (berdiri sendiri)</span>}
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded border">
                            Tipe {param.type}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-muted-foreground">{param.inputMethod}</td>
                        <td className="p-3 font-mono">{param.personalWeight !== null ? param.personalWeight : "-"}</td>
                        <td className="p-3 font-mono">{param.skillWeight !== null ? param.skillWeight : "-"}</td>
                        <td className="p-3 font-mono">{param.maxValue}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            param.active ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                          }`}>
                            {param.active ? "Aktif" : "Non-aktif"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button size="xs" variant="ghost" onClick={() => openModal(param)}>
                              <Edit2 className="size-3" />
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(param.id, param.name)}
                              disabled={pending}
                            >
                              <Trash2 className="size-3" />
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Parameter" : "Tambah Parameter"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="param-material">Materi Induk</Label>
                <Select value={materialId} onValueChange={(val) => setMaterialId(val || "")}>
                  <SelectTrigger id="param-material" className="h-8">
                    <SelectValue placeholder="Pilih Materi" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        [{m.code}] {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="param-subcode">Kode Sub (misal: A.2_1, B.1_2, M_1)</Label>
                <Input id="param-subcode" placeholder="B.1_1" value={subCode} onChange={(e) => setSubCode(e.target.value)} className="h-8 font-mono" />
              </div>
            </div>

            {/* Live Indicator Preview of Target Score Category */}
            {subCode ? (
              <div className="rounded-lg border p-2.5 bg-muted/40 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Info className="size-3.5 text-primary" /> Target Penilaian Raport / Event:
                  </span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${liveMapping.badgeClass}`}>
                    {liveMapping.fullCategoryLabel}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">{liveMapping.explanation}</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-2.5 text-[10px] text-muted-foreground space-y-1">
                <p>
                  <span className="font-semibold text-foreground">Nilai Personal</span> (A.1/A.2/B.1/B.2/C.1/C.2): kode cukup <em>mengandung</em> salah satunya — mis. <code className="bg-background px-1 rounded border">A.2_1</code>, <code className="bg-background px-1 rounded border">A.2_2</code>.
                </p>
                <p>
                  <span className="font-semibold text-foreground">Nilai Keahlian</span> (M/K/MB/KW): bagian sebelum tanda <code className="bg-background px-1 rounded border">_</code> atau <code className="bg-background px-1 rounded border">.</code> harus persis — mis. <code className="bg-background px-1 rounded border">M_1</code>, <code className="bg-background px-1 rounded border">M_2</code>.
                </p>
              </div>
            )}

            <div className="grid gap-1">
              <Label htmlFor="param-name">Nama Parameter Penilaian</Label>
              <Input id="param-name" placeholder="Kedisiplinan dan kerapian atribut" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="param-cluster">Rumpun Penilaian (opsional)</Label>
              <Input
                id="param-cluster"
                placeholder="mis. Intrapersonal & Self-Mastery"
                value={clusterLabel}
                onChange={(e) => setClusterLabel(e.target.value)}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">
                Parameter lain di materi yang sama dengan rumpun yang sama tampil sebagai SATU pertanyaan untuk mentor — nilai yang mentor pilih otomatis berlaku untuk semuanya. Kosongkan agar parameter ini berdiri sendiri.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="param-type">Tipe Parameter (A-F)</Label>
                <Select value={type} onValueChange={(val) => {
                  if (val) {
                    setType(val as ParameterType);
                    if (val === ParameterType.B) setMaxValue("4");
                  }
                }}>
                  <SelectTrigger id="param-type" className="h-8">
                    <SelectValue placeholder="Pilih Tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ParameterType.A}>Tipe A (Kehadiran & Keaktifan)</SelectItem>
                    <SelectItem value={ParameterType.B}>Tipe B (Rubrik Perilaku Skala 1-4)</SelectItem>
                    <SelectItem value={ParameterType.C}>Tipe C (Rubrik Penugasan Butir)</SelectItem>
                    <SelectItem value={ParameterType.D}>Tipe D (Post-test / Pengujian)</SelectItem>
                    <SelectItem value={ParameterType.E}>Tipe E (Data Eksternal & Verifikasi)</SelectItem>
                    <SelectItem value={ParameterType.F}>Tipe F (Kompetisi Event Inclenation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="param-input">Metode Pengisian</Label>
                <Select value={inputMethod} onValueChange={(val) => setInputMethod((val as InputMethod) || InputMethod.MENTOR)}>
                  <SelectTrigger id="param-input" className="h-8">
                    <SelectValue placeholder="Pilih Metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={InputMethod.MENTOR}>Input Manual Mentor</SelectItem>
                    <SelectItem value={InputMethod.IMPORT}>Impor CSV / Excel</SelectItem>
                    <SelectItem value={InputMethod.GROUP}>Kelompok (Tugas kelompok)</SelectItem>
                    <SelectItem value={InputMethod.UNIT_MENTOR}>Event: Per Unit oleh Mentor</SelectItem>
                    <SelectItem value={InputMethod.UNIT_EVENT}>Event: Per Unit oleh Panitia Event</SelectItem>
                    <SelectItem value={InputMethod.REGION_EVENT}>Event: Per Region oleh Panitia Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="param-pweight">Bobot Nilai Personal (Desimal)</Label>
                <Input id="param-pweight" placeholder="0.05" value={personalWeight} onChange={(e) => setPersonalWeight(e.target.value)} className="h-8" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="param-sweight">Bobot Nilai Keahlian (Desimal)</Label>
                <Input id="param-sweight" placeholder="0.05" value={skillWeight} onChange={(e) => setSkillWeight(e.target.value)} className="h-8" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="param-maxval">Nilai Maksimum</Label>
                <Input id="param-maxval" type="number" placeholder="4" value={maxValue} disabled={type === ParameterType.B} onChange={(e) => setMaxValue(e.target.value)} className="h-8" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center pt-2">
              <div className="grid gap-1">
                <Label htmlFor="param-order">Urutan Tampil</Label>
                <Input id="param-order" type="number" placeholder="1" value={order} onChange={(e) => setOrder(e.target.value)} className="h-8" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Checkbox id="param-active" checked={active} onCheckedChange={(val) => setActive(!!val)} />
                <Label htmlFor="param-active" className="cursor-pointer font-normal">Parameter Aktif & Diperhitungkan</Label>
              </div>
            </div>

            {type === ParameterType.B && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-3 mt-2">
                <h4 className="font-semibold text-foreground flex items-center gap-1 text-xs">
                  <SlidersHorizontal className="size-3.5" />
                  Rubrik Jangkar Perilaku (Skala 1-4)
                </h4>
                <p className="text-[10px] text-muted-foreground">Deskripsikan standar perilaku maba untuk masing-masing skor penilaian berikut.</p>
                <div className="space-y-2.5">
                  <div className="grid gap-1">
                    <Label htmlFor="anchor-1">Deskripsi Skor 1 (Sangat Kurang)</Label>
                    <Textarea id="anchor-1" placeholder="Deskripsi maba melanggar aturan berat..." value={anchor1} onChange={(e) => setAnchor1(e.target.value)} rows={2} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="anchor-2">Deskripsi Skor 2 (Kurang)</Label>
                    <Textarea id="anchor-2" placeholder="Deskripsi maba melakukan pelanggaran ringan..." value={anchor2} onChange={(e) => setAnchor2(e.target.value)} rows={2} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="anchor-3">Deskripsi Skor 3 (Baik)</Label>
                    <Textarea id="anchor-3" placeholder="Deskripsi maba mematuhi standar secara konsisten..." value={anchor3} onChange={(e) => setAnchor3(e.target.value)} rows={2} />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="anchor-4">Deskripsi Skor 4 (Sangat Baik)</Label>
                    <Textarea id="anchor-4" placeholder="Deskripsi maba berinisiatif tinggi dan melebihi ekspektasi..." value={anchor4} onChange={(e) => setAnchor4(e.target.value)} rows={2} />
                  </div>
                </div>
              </div>
            )}
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
