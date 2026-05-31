"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, UserCog, Eye, EyeOff } from "lucide-react";
import type { DbUser } from "@/types/database";
import { displayPakistaniPhone } from "@/lib/utils";

type Teacher = Pick<DbUser, "id" | "name" | "phone" | "created_at">;

export default function TeachersPage() {
  const supabase = createClient();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, phone, created_at")
      .eq("role", "teacher")
      .order("name");
    setTeachers((data ?? []) as Teacher[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  async function handleAddTeacher() {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      toast.error("Name, phone number, and password are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), password: password.trim() }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(json.error ?? "Failed to add teacher");
      return;
    }

    toast.success(`${name.trim()} added as teacher`);
    setShowAdd(false);
    setName("");
    setPhone("");
    setPassword("");
    fetchTeachers();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {teachers.length} teacher{teachers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
          <Plus size={16} className="mr-1" /> Add Teacher
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : teachers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[#1B4332]/20 rounded-xl">
          <UserCog size={48} className="text-[#1B4332]/30 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-1">No teachers yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add teachers so you can assign them to classes.
          </p>
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="mr-1" /> Add Teacher
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Teacher</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden sm:table-cell">Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-[#1B4332]/10 text-[#1B4332] text-sm font-medium">
                          {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {displayPakistaniPhone(t.phone)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    Logs in with phone + password
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setName(""); setPhone(""); setPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Teacher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. Muhammad Usman"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                placeholder="03001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                They will log in with this phone number and password.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleAddTeacher}
              disabled={saving || !name.trim() || !phone.trim() || !password.trim()}
            >
              {saving ? "Adding..." : "Add Teacher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
