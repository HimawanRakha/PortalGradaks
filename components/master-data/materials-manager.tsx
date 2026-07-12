"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, Layers, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  createMaterialAction,
  updateMaterialAction,
  setMaterialActiveAction,
  deleteMaterialAction,
} from "@/app/(dashboard)/admin/master-data/actions";

type MaterialData = {
  id: string;
  code: string;
  name: string;
  order: number;
  active: boolean;
  activity: {
    id: string;
    code: string;
    name: string;
  };
  _count: {
    parameters: number;
  };
};

type ActivityOption = {
  id: string;
  code: string;
  name: string;
};

export function MaterialsManager({
  initialMaterials,
  activities,
}: {
  initialMaterials: MaterialData[];
  activities: ActivityOption[];
}) {
  const [materials] = useState<MaterialData[]>(initialMaterials);
  const [pending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const [active, setActive] = useState(true);

  const openModal = (material?: MaterialData) => {
    if (material) {
      setEditId(material.id);
      setActivityId(material.activity.id);
      setCode(material.code);
      setName(material.name);
      setOrder(String(material.order));
      setActive(material.active);
    } else {
      setEditId(null);
      setActivityId(activities[0]?.id || "");
      setCode("");
      setName("");
      setOrder(String(materials.length + 1));
      setActive(true);
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!activityId || !code || !name || !order) {
      toast.error("Semua field wajib diisi.");
      return;
    }

    startTransition(async () => {
      let res;
      const data = {
        activityId,
        code,
        name,
        order: Number(order),
        active,
      };

      if (editId) {
        res = await updateMaterialAction(editId, data);
      } else {
        res = await createMaterialAction(data);
      }

      if (res.ok) {
        toast.success(editId ? "Materi diperbarui." : "Materi dibuat.");
        setIsOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleToggleActive = (id: string, nextActive: boolean) => {
    startTransition(async () => {
      const res = await setMaterialActiveAction(id, nextActive);
      if (res.ok) {
        toast.success(nextActive ? "Materi diaktifkan kembali." : "Materi dinonaktifkan.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus materi "${name}"?`)) return;

    startTransition(async () => {
      const res = await deleteMaterialAction(id);
      if (res.ok) {
        toast.success("Materi berhasil dihapus.");
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Pengelolaan Materi</h3>
          <p className="text-xs text-muted-foreground">Kelola materi pembelajaran di dalam setiap alur kegiatan.</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="size-4" />
          Tambah Materi
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {materials.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">Belum ada materi pembelajaran yang dibuat.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Kegiatan</th>
                    <th className="p-3">Kode Materi</th>
                    <th className="p-3">Nama Materi</th>
                    <th className="p-3">Urutan</th>
                    <th className="p-3">Jumlah Parameter</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {materials.map((material) => (
                    <tr key={material.id} className={`hover:bg-muted/30 ${!material.active ? "opacity-60" : ""}`}>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                            {material.activity.code}
                          </span>
                          <span className="text-muted-foreground">{material.activity.name}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono font-medium">{material.code}</td>
                      <td className="p-3 font-medium flex items-center gap-1">
                        <Layers className="size-3.5 text-muted-foreground" />
                        {material.name}
                      </td>
                      <td className="p-3 font-mono">{material.order}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${
                          material._count.parameters > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {material._count.parameters} parameter
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            material.active
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                          }`}
                        >
                          {material.active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="xs" variant="ghost" onClick={() => openModal(material)}>
                            <Edit2 className="size-3" />
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleToggleActive(material.id, !material.active)}
                            disabled={pending}
                          >
                            {material.active ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                          </Button>
                          <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(material.id, material.name)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Materi" : "Tambah Materi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="mat-activity">Kegiatan Induk</Label>
              <Select value={activityId} onValueChange={(val) => setActivityId(val || "")}>
                <SelectTrigger id="mat-activity">
                  <SelectValue placeholder="Pilih Kegiatan" />
                </SelectTrigger>
                <SelectContent>
                  {activities.map((act) => (
                    <SelectItem key={act.id} value={act.id}>
                      [{act.code}] {act.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mat-code">Kode Materi (misal: KWYA, BMB, JAD)</Label>
              <Input id="mat-code" placeholder="KWYA" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mat-name">Nama Materi</Label>
              <Input id="mat-name" placeholder="KWYA (Know Who You Are)" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mat-order">Urutan Tampil (Angka)</Label>
              <Input id="mat-order" type="number" placeholder="1" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="mat-active" checked={active} onCheckedChange={(val) => setActive(!!val)} />
              <Label htmlFor="mat-active" className="font-normal cursor-pointer select-none">
                Aktif (muncul di form scoring mentor & dashboard pemantauan)
              </Label>
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
