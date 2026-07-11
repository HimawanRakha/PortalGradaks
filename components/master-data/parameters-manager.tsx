"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, SlidersHorizontal, Info } from "lucide-react";
import { ParameterType, InputMethod } from "@/app/generated/prisma/enums";
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
  createParameterAction,
  updateParameterAction,
} from "@/app/(dashboard)/admin/master-data/actions";

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

  const filteredParams = filterMaterialId === "ALL" 
    ? parameters 
    : parameters.filter(p => p.material.id === filterMaterialId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Pengelolaan Parameter Penilaian</h3>
          <p className="text-xs text-muted-foreground">Detail instrumen penilaian, bobot raport, metode pengisian, dan rubrik perilaku.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
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
                    <th className="p-3">Nama Parameter</th>
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
                  {filteredParams.map((param) => (
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
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{param.name}</span>
                          {param.type === ParameterType.B && param.rubricAnchors && (
                            <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1 mt-0.5">
                              <Info className="size-3" /> Rubrik perilaku terisi
                            </span>
                          )}
                        </div>
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
                        <Button size="xs" variant="ghost" onClick={() => openModal(param)}>
                          <Edit2 className="size-3" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
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
                <Label htmlFor="param-subcode">Kode Sub (misal: B1, B2, C1)</Label>
                <Input id="param-subcode" placeholder="B1" value={subCode} onChange={(e) => setSubCode(e.target.value)} className="h-8" />
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="param-name">Nama Parameter Penilaian</Label>
              <Input id="param-name" placeholder="Kedisiplinan dan kerapian atribut" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="param-type">Tipe Parameter (A-E)</Label>
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
