"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit2 } from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
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
  createUserAction,
  updateUserAction,
} from "@/app/(dashboard)/admin/master-data/actions";

type UserData = {
  id: string;
  nrp: string;
  name: string;
  role: Role;
  active: boolean;
  region: { id: string; code: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
};

type RegionOption = {
  id: string;
  code: string;
  name: string;
};

type UnitOption = {
  id: string;
  code: string;
  name: string;
  region: { id: string; code: string; name: string };
};

export function AccountsManager({
  initialUsers,
  regions,
  units,
}: {
  initialUsers: UserData[];
  regions: RegionOption[];
  units: UnitOption[];
}) {
  const [users] = useState<UserData[]>(initialUsers);
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [pending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nrp, setNrp] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>(Role.MENTOR);
  const [password, setPassword] = useState("");
  const [regionId, setRegionId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [active, setActive] = useState(true);

  const openModal = (user?: UserData) => {
    if (user) {
      setEditId(user.id);
      setNrp(user.nrp);
      setName(user.name);
      setRole(user.role);
      setPassword("");
      setRegionId(user.region?.id || "");
      setUnitId(user.unit?.id || "");
      setActive(user.active);
    } else {
      setEditId(null);
      setNrp("");
      setName("");
      setRole(Role.MENTOR);
      setPassword("gradaks2026");
      setRegionId("");
      setUnitId("");
      setActive(true);
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!nrp || !name || (!editId && !password)) {
      toast.error("NRP, nama, dan password (untuk akun baru) wajib diisi.");
      return;
    }

    startTransition(async () => {
      let res;
      const data = {
        nrp,
        name,
        role,
        password: password || undefined,
        regionId: role === Role.KEPALA_REGION ? regionId || null : null,
        unitId: role === Role.MENTOR ? unitId || null : null,
        active,
      };

      if (editId) {
        res = await updateUserAction(editId, data);
      } else {
        res = await createUserAction(data);
      }

      if (res.ok) {
        toast.success(editId ? "Akun diperbarui." : "Akun dibuat.");
        setIsOpen(false);
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    });
  };

  const filteredUsers = filterRole === "ALL" 
    ? users 
    : users.filter(u => u.role === filterRole);

  const getRoleBadgeClass = (r: Role) => {
    switch (r) {
      case Role.ADMIN: return "bg-red-500/10 text-red-500 border-red-500/20";
      case Role.KEPALA_REGION: return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case Role.MENTOR: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case Role.DAMEN: return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Pengelolaan Akun Pengguna</h3>
          <p className="text-xs text-muted-foreground">Kelola akun administrator, kepala region, mentor, dan dewan verifikator.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Label htmlFor="filter-role" className="text-xs font-medium text-muted-foreground">Filter Peran:</Label>
          <Select value={filterRole} onValueChange={(val) => setFilterRole(val || "ALL")}>
            <SelectTrigger id="filter-role" className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Pilih Peran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Peran</SelectItem>
              <SelectItem value={Role.ADMIN}>PSDM / Admin</SelectItem>
              <SelectItem value={Role.KEPALA_REGION}>Kepala Region</SelectItem>
              <SelectItem value={Role.MENTOR}>Mentor</SelectItem>
              <SelectItem value={Role.DAMEN}>Damen</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => openModal()} size="sm">
            <Plus className="size-4" />
            Tambah Akun
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <p className="text-center py-8 text-xs text-muted-foreground">Tidak ada akun ditemukan untuk filter ini.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b text-muted-foreground font-medium">
                    <th className="p-3">Nama</th>
                    <th className="p-3">NRP / Username</th>
                    <th className="p-3">Peran</th>
                    <th className="p-3">Tautan Struktur</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className={`hover:bg-muted/30 ${!user.active ? "opacity-60" : ""}`}>
                      <td className="p-3 font-semibold text-foreground">{user.name}</td>
                      <td className="p-3 font-mono font-medium text-muted-foreground">{user.nrp}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getRoleBadgeClass(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground font-medium">
                        {user.role === Role.KEPALA_REGION && user.region && (
                          <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-mono text-[11px]">
                            Region: {user.region.code} ({user.region.name})
                          </span>
                        )}
                        {user.role === Role.MENTOR && user.unit && (
                          <span className="bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-mono text-[11px]">
                            Unit: {user.unit.code} ({user.unit.name})
                          </span>
                        )}
                        {user.role !== Role.KEPALA_REGION && user.role !== Role.MENTOR && "-"}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.active ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}>
                          {user.active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button size="xs" variant="ghost" onClick={() => openModal(user)}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Akun Pengguna" : "Tambah Akun Pengguna"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid gap-1">
              <Label htmlFor="user-nrp">NRP / Username</Label>
              <Input id="user-nrp" placeholder="admin / mentor.r01-u01" value={nrp} onChange={(e) => setNrp(e.target.value)} className="h-8" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="user-name">Nama Lengkap</Label>
              <Input id="user-name" placeholder="Ahmad Wijaya" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="user-role">Peran</Label>
              <Select value={role} onValueChange={(val) => setRole((val as Role) || Role.MENTOR)}>
                <SelectTrigger id="user-role" className="h-8">
                  <SelectValue placeholder="Pilih Peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Role.ADMIN}>PSDM / Admin</SelectItem>
                  <SelectItem value={Role.KEPALA_REGION}>Kepala Region</SelectItem>
                  <SelectItem value={Role.MENTOR}>Mentor</SelectItem>
                  <SelectItem value={Role.DAMEN}>Damen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="user-pass">Password {editId && "(Kosongkan jika tidak ingin diubah)"}</Label>
              <Input id="user-pass" type="password" placeholder={editId ? "••••••••" : "gradaks2026"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-8" />
            </div>

            {role === Role.KEPALA_REGION && (
              <div className="grid gap-1">
                <Label htmlFor="user-region">Tautkan Wilayah Region</Label>
                <Select value={regionId} onValueChange={(val) => setRegionId(val || "")}>
                  <SelectTrigger id="user-region" className="h-8">
                    <SelectValue placeholder="Pilih Region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        [{reg.code}] {reg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {role === Role.MENTOR && (
              <div className="grid gap-1">
                <Label htmlFor="user-unit">Tautkan Kelompok Unit Mentoring</Label>
                <Select value={unitId} onValueChange={(val) => setUnitId(val || "")}>
                  <SelectTrigger id="user-unit" className="h-8">
                    <SelectValue placeholder="Pilih Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        [{u.code}] {u.name} (Region: {u.region.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editId && (
              <div className="flex items-center gap-2 pt-2">
                <Checkbox id="user-active" checked={active} onCheckedChange={(val) => setActive(!!val)} />
                <Label htmlFor="user-active" className="cursor-pointer font-normal">Akun Aktif (Bisa Log In)</Label>
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
