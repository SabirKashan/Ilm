"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Class } from "@/types/database";

type ExamRow = {
  id: string;
  name: string;
  class_id: string;
  date: string;
  total_marks: number;
  classes: { name: string } | null;
};

export default function ExamsPage() {
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [examName, setExamName] = useState("");
  const [examClassId, setExamClassId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTotalMarks, setExamTotalMarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("school_id").eq("id", user.id).single();
      if (data) setSchoolId((data as { school_id: string }).school_id);
      const { data: cls } = await supabase.from("classes").select("*").order("name");
      setClasses((cls ?? []) as Class[]);
    }
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exams")
      .select("id, name, class_id, date, total_marks, classes(name)")
      .order("date", { ascending: false });
    setExams((data ?? []) as unknown as ExamRow[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchExams(); }, [fetchExams]);

  async function handleAdd() {
    const marks = parseInt(examTotalMarks);
    if (!examName.trim() || !examClassId || !examDate || isNaN(marks) || marks <= 0 || !schoolId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("exams").insert({
      school_id: schoolId,
      name: examName.trim(),
      class_id: examClassId,
      date: examDate,
      total_marks: marks,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${examName.trim()} created`);
    setShowAdd(false);
    setExamName(""); setExamClassId(""); setExamDate(""); setExamTotalMarks("");
    fetchExams();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create exams and enter student results</p>
        </div>
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
          <Plus size={16} className="mr-1" /> Create Exam
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
          <BookOpen size={48} className="text-[#1B4332]/30 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-1">No exams yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create an exam to start entering results.</p>
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="mr-1" /> Create Exam
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Exam</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden sm:table-cell">Total Marks</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((e) => (
                <TableRow key={e.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell>
                    <Link href={`/dashboard/exams/${e.id}`} className="font-medium text-sm hover:underline">
                      {e.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.classes?.name ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {new Date(e.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{e.total_marks}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/exams/${e.id}`}>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={(o) => {
        setShowAdd(o);
        if (!o) { setExamName(""); setExamClassId(""); setExamDate(""); setExamTotalMarks(""); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Exam Name *</Label>
              <Input placeholder="e.g. Mid-Term, Final Exam" value={examName} onChange={(e) => setExamName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={examClassId} onValueChange={(v) => setExamClassId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Marks *</Label>
              <Input type="number" min="1" placeholder="e.g. 100" value={examTotalMarks} onChange={(e) => setExamTotalMarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleAdd}
              disabled={saving || !examName.trim() || !examClassId || !examDate || !examTotalMarks}
            >
              {saving ? "Creating..." : "Create Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
