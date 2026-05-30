"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Users, BookOpen, Edit2 } from "lucide-react";
import type { Class, Student, Subject, DbUser } from "@/types/database";
import { displayPakistaniPhone } from "@/lib/utils";

const GRADE_LEVELS = ["Nursery", "KG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
type ClassDetail = Class & { teacher: Pick<DbUser, "id" | "name"> | null };

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [teachers, setTeachers] = useState<Pick<DbUser, "id" | "name">[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit class
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; grade_level: string | null; teacher_id: string | null; academic_year: string }>({ name: "", grade_level: null, teacher_id: null, academic_year: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Add subject
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);

  // Add student to class
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [assigningStudent, setAssigningStudent] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: classRow }, { data: studentRows }, { data: subjectRows }, { data: teacherRows }, { data: unassigned }] =
      await Promise.all([
        supabase.from("classes").select("*").eq("id", id).single(),
        supabase.from("students").select("*").eq("class_id", id).eq("status", "active").order("name"),
        supabase.from("subjects").select("*").eq("class_id", id).order("name"),
        supabase.from("users").select("id, name").eq("role", "teacher").order("name"),
        supabase.from("students").select("*").is("class_id", null).eq("status", "active").order("name"),
      ]);

    if (!classRow) { router.replace("/dashboard/classes"); return; }

    const teacherList = (teacherRows ?? []) as Pick<DbUser, "id" | "name">[];
    const c = classRow as Class;
    setSchoolId(c.school_id);
    setTeachers(teacherList);
    setCls({ ...c, teacher: teacherList.find((t) => t.id === c.teacher_id) ?? null });
    setEditForm({ name: c.name, grade_level: c.grade_level, teacher_id: c.teacher_id, academic_year: c.academic_year });
    setStudents((studentRows ?? []) as Student[]);
    setSubjects((subjectRows ?? []) as Subject[]);
    setAllStudents((unassigned ?? []) as Student[]);
    setLoading(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSaveClass() {
    if (!editForm.name.trim()) { toast.error("Class name is required"); return; }
    setSavingEdit(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("classes").update({
      name: editForm.name.trim(),
      grade_level: editForm.grade_level || null,
      teacher_id: editForm.teacher_id || null,
      academic_year: editForm.academic_year,
    }).eq("id", id);
    setSavingEdit(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Class updated");
    setShowEdit(false);
    fetchData();
  }

  async function handleAddSubject() {
    if (!subjectName.trim()) return;
    setSavingSubject(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("subjects").insert({
      school_id: schoolId,
      name: subjectName.trim(),
      class_id: id,
    });
    setSavingSubject(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Subject added");
    setSubjectName("");
    setShowAddSubject(false);
    fetchData();
  }

  async function handleAssignSubjectTeacher(subjectId: string, teacherId: string | null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("subjects").update({ teacher_id: teacherId || null }).eq("id", subjectId);
    if (error) { toast.error(error.message); return; }
    setSubjects((prev) => prev.map((s) => s.id === subjectId ? { ...s, teacher_id: teacherId } : s));
  }

  async function handleRemoveSubject(subjectId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("subjects").delete().eq("id", subjectId);
    if (error) { toast.error(error.message); return; }
    toast.success("Subject removed");
    setSubjects((s) => s.filter((x) => x.id !== subjectId));
  }

  async function handleAssignStudent() {
    if (!selectedStudentId) return;
    setAssigningStudent(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("students").update({ class_id: id }).eq("id", selectedStudentId);
    setAssigningStudent(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Student added to class");
    setShowAddStudent(false);
    setSelectedStudentId("");
    fetchData();
  }

  async function handleRemoveStudent(studentId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("students").update({ class_id: null }).eq("id", studentId);
    if (error) { toast.error(error.message); return; }
    toast.success("Student removed from class");
    setStudents((s) => s.filter((x) => x.id !== studentId));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!cls) return null;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Classes
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cls.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {cls.grade_level && <Badge variant="outline">Grade {cls.grade_level}</Badge>}
              <span className="text-sm text-muted-foreground">{cls.academic_year}</span>
              {cls.teacher
                ? <span className="text-sm text-muted-foreground">· {cls.teacher.name}</span>
                : <span className="text-sm text-amber-600 italic">No teacher assigned</span>
              }
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
              <Edit2 size={14} className="mr-1" /> Edit Class
            </Button>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1B4332]">{students.length}</p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1B4332]">{subjects.length}</p>
              <p className="text-xs text-muted-foreground">Subjects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="students">
        <TabsList className="w-full">
          <TabsTrigger value="students" className="flex-1">
            <Users size={14} className="mr-1" /> Students
          </TabsTrigger>
          <TabsTrigger value="subjects" className="flex-1">
            <BookOpen size={14} className="mr-1" /> Subjects
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={() => setShowAddStudent(true)}
              disabled={allStudents.length === 0}
            >
              <Plus size={14} className="mr-1" />
              {allStudents.length === 0 ? "No unassigned students" : "Add Student"}
            </Button>
          </div>
          {students.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No students in this class</p>
              <p className="text-sm mt-1">Add existing students to get started.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Roll #</TableHead>
                    <TableHead className="hidden sm:table-cell">Parent Phone</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/dashboard/students/${s.id}`)}
                    >
                      <TableCell>
                        <p className="font-medium">{s.name}</p>
                        {s.father_name && <p className="text-xs text-muted-foreground">{s.father_name}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.roll_number ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {s.parent_phone ? displayPakistaniPhone(s.parent_phone) : "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveStudent(s.id); }}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Subjects Tab */}
        <TabsContent value="subjects" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={() => setShowAddSubject(true)}
            >
              <Plus size={14} className="mr-1" /> Add Subject
            </Button>
          </div>
          {subjects.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No subjects yet</p>
              <p className="text-sm mt-1">Add subjects taught in this class.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Subject</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Select
                          value={s.teacher_id ?? "none"}
                          onValueChange={(v) => handleAssignSubjectTeacher(s.id, v === "none" ? null : v)}
                        >
                          <SelectTrigger className="h-8 text-sm w-[180px]">
                            <SelectValue placeholder="Assign teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground italic">Unassigned</span>
                            </SelectItem>
                            {teachers.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleRemoveSubject(s.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Class Dialog */}
      <Dialog open={showEdit} modal={false} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Class</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Grade Level</Label>
              <Select
                value={editForm.grade_level ?? "none"}
                onValueChange={(v) => setEditForm((f) => ({ ...f, grade_level: v === "none" ? null : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="text-muted-foreground italic">None</span></SelectItem>
                  {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class Teacher</Label>
              <Select
                value={editForm.teacher_id ?? "none"}
                onValueChange={(v) => setEditForm((f) => ({ ...f, teacher_id: v === "none" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={teachers.length === 0 ? "No teachers added yet" : "Select teacher"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="text-muted-foreground italic">Unassigned</span></SelectItem>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {teachers.length === 0 && (
                <p className="text-xs text-amber-600">
                  No teachers yet — add one from the <span className="font-medium">Teachers</span> page first.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Input
                value={editForm.academic_year}
                onChange={(e) => setEditForm((f) => ({ ...f, academic_year: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleSaveClass}
              disabled={savingEdit || !editForm.name.trim()}
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subject Dialog */}
      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Subject Name *</Label>
            <Input
              placeholder="e.g. Mathematics, Urdu, Science"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleAddSubject(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSubject(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleAddSubject}
              disabled={savingSubject || !subjectName.trim()}
            >
              {savingSubject ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Student Dialog */}
      <Dialog open={showAddStudent} modal={false} onOpenChange={setShowAddStudent}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Student to Class</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Select Student</Label>
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {allStudents.map((s) => (
                <button
                  key={s.id}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedStudentId === s.id ? "bg-[#1B4332]/5" : ""}`}
                  onClick={() => setSelectedStudentId(s.id)}
                >
                  <p className="font-medium">{s.name}</p>
                  {s.father_name && <p className="text-xs text-muted-foreground">{s.father_name}</p>}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleAssignStudent}
              disabled={assigningStudent || !selectedStudentId}
            >
              {assigningStudent ? "Adding..." : "Add to Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
