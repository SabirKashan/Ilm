"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, GraduationCap, ChevronRight } from "lucide-react";
import type { Class, DbUser } from "@/types/database";

const GRADE_LEVELS = ["Nursery", "KG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

type ClassRow = Class & {
  teacher: Pick<DbUser, "id" | "name"> | null;
  studentCount: number;
};

const currentYear = new Date().getFullYear();
const DEFAULT_YEAR = `${currentYear}-${currentYear + 1}`;

export default function ClassesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<Pick<DbUser, "id" | "name">[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ name: string; grade_level: string | null; teacher_id: string | null; academic_year: string }>(
    { name: "", grade_level: null, teacher_id: null, academic_year: DEFAULT_YEAR }
  );
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("users").select("school_id").eq("id", user!.id).single() as { data: { school_id: string } | null; error: unknown };
    if (profile?.school_id) setSchoolId(profile.school_id);

    const [{ data: classRows }, { data: teacherRows }, { data: studentRows }] = await Promise.all([
      supabase.from("classes").select("*").order("grade_level"),
      supabase.from("users").select("id, name").eq("role", "teacher").order("name"),
      supabase.from("students").select("id, class_id").eq("status", "active"),
    ]);

    const teacherList = (teacherRows ?? []) as Pick<DbUser, "id" | "name">[];
    setTeachers(teacherList);

    const countMap: Record<string, number> = {};
    for (const s of (studentRows ?? []) as { id: string; class_id: string | null }[]) {
      if (s.class_id) countMap[s.class_id] = (countMap[s.class_id] ?? 0) + 1;
    }

    const classList = (classRows ?? []) as Class[];
    setClasses(
      classList.map((c) => ({
        ...c,
        teacher: teacherList.find((t) => t.id === c.teacher_id) ?? null,
        studentCount: countMap[c.id] ?? 0,
      }))
    );
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAddClass() {
    if (!form.name.trim()) { toast.error("Class name is required"); return; }
    if (!schoolId) { toast.error("School not found"); return; }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("classes").insert({
      school_id: schoolId,
      name: form.name.trim(),
      grade_level: form.grade_level || null,
      teacher_id: form.teacher_id || null,
      academic_year: form.academic_year,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Class added!");
    setShowAdd(false);
    setForm({ name: "", grade_level: null, teacher_id: null, academic_year: DEFAULT_YEAR });
    fetchData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{classes.length} class{classes.length !== 1 ? "es" : ""}</p>
        </div>
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
          <Plus size={16} className="mr-1" /> Add Class
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[#1B4332]/20 rounded-xl">
          <GraduationCap size={48} className="text-[#1B4332]/30 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-1">No classes yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your first class to get started.</p>
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="mr-1" /> Add Class
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Class Name</TableHead>
                <TableHead className="hidden sm:table-cell">Grade</TableHead>
                <TableHead className="hidden md:table-cell">Teacher</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="hidden lg:table-cell">Year</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow
                  key={cls.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
                >
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {cls.grade_level ? <Badge variant="outline" className="text-xs">{cls.grade_level}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {cls.teacher?.name ?? <span className="italic">Unassigned</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-[#1B4332]/10 text-[#1B4332] hover:bg-[#1B4332]/10">{cls.studentCount}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{cls.academic_year}</TableCell>
                  <TableCell><ChevronRight size={16} className="text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Class</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input
                placeholder="e.g. Class 5A, Grade 8B"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Grade Level</Label>
              <Select value={form.grade_level ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, grade_level: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign Teacher</Label>
              <Select value={form.teacher_id ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, teacher_id: v || null }))}>
                <SelectTrigger>
                  <SelectValue placeholder={teachers.length === 0 ? "No teachers yet" : "Select teacher"} />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Input
                placeholder="2025-2026"
                value={form.academic_year}
                onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleAddClass}
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Adding..." : "Add Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
