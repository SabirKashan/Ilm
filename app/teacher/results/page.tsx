"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, AlertCircle, ChevronRight, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Exam = { id: string; name: string; date: string; total_marks: number };
type Subject = { id: string; name: string };
type Student = { id: string; name: string; roll_number: string | null };
type MarksMap = Record<string, Record<string, string>>; // studentId → subjectId → marks string
type ClassRow = { id: string; name: string };

export default function TeacherResultsPage() {
  const supabase = createClient();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [noClass, setNoClass] = useState(false);

  const className = classes.find((c) => c.id === classId)?.name ?? "";

  // Selected exam
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<MarksMap>({});
  const [loadingExam, setLoadingExam] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load the teacher's classes once
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users").select("school_id").eq("id", user.id).single() as
        { data: { school_id: string } | null; error: unknown };
      if (!profile) return;

      const { data: cls } = await supabase
        .from("classes").select("id, name")
        .eq("school_id", profile.school_id)
        .eq("teacher_id", user.id)
        .order("name") as { data: ClassRow[] | null; error: unknown };

      if (!cls || cls.length === 0) { setNoClass(true); setLoading(false); return; }
      setClasses(cls);
      setClassId(cls[0].id);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load exams whenever the selected class changes
  useEffect(() => {
    if (!classId) return;
    (async () => {
      setLoading(true);
      setSelectedExam(null);
      const { data: ex } = await supabase
        .from("exams").select("id, name, date, total_marks")
        .eq("class_id", classId).order("date", { ascending: false });
      setExams((ex ?? []) as Exam[]);
      setLoading(false);
    })();
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openExam = useCallback(async (exam: Exam) => {
    if (!classId) return;
    setSelectedExam(exam);
    setLoadingExam(true);

    const [{ data: subs }, { data: studs }, { data: existing }] = await Promise.all([
      supabase.from("subjects").select("id, name").eq("class_id", classId).order("name"),
      supabase.from("students").select("id, name, roll_number").eq("class_id", classId).eq("status", "active").order("name"),
      supabase.from("results").select("student_id, subject_id, marks_obtained").eq("exam_id", exam.id),
    ]);

    setSubjects((subs ?? []) as Subject[]);
    setStudents((studs ?? []) as Student[]);

    const m: MarksMap = {};
    for (const r of (existing ?? []) as { student_id: string; subject_id: string; marks_obtained: number }[]) {
      if (!m[r.student_id]) m[r.student_id] = {};
      m[r.student_id][r.subject_id] = String(r.marks_obtained);
    }
    setMarks(m);
    setLoadingExam(false);
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveResults() {
    if (!selectedExam || !classId) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("users").select("school_id").eq("id", user!.id).single() as
      { data: { school_id: string } | null; error: unknown };

    const rows = [];
    for (const s of students) {
      for (const sub of subjects) {
        const raw = marks[s.id]?.[sub.id];
        if (raw === undefined || raw === "") continue;
        const val = Number(raw);
        if (isNaN(val)) continue;
        rows.push({
          school_id: profile!.school_id,
          exam_id: selectedExam.id,
          student_id: s.id,
          subject_id: sub.id,
          marks_obtained: Math.min(val, selectedExam.total_marks),
          whatsapp_sent: false,
        });
      }
    }

    if (rows.length === 0) { toast.error("No marks entered"); setSaving(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("results") as any).upsert(rows, {
      onConflict: "exam_id,student_id,subject_id",
    });

    if (error) toast.error("Failed to save: " + error.message);
    else toast.success("Results saved!");
    setSaving(false);
  }

  function setMark(studentId: string, subjectId: string, value: string) {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [subjectId]: value },
    }));
  }

  if (noClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle size={48} className="text-amber-400 mb-4" />
        <h2 className="text-lg font-semibold">No class assigned</h2>
      </div>
    );
  }

  // ── Exam detail view ──────────────────────────────────────────────────────

  if (selectedExam) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedExam(null)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedExam.name}</h1>
            <p className="text-sm text-muted-foreground">
              {className} · {formatDate(selectedExam.date)} · Max {selectedExam.total_marks} marks
            </p>
          </div>
        </div>

        {loadingExam ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No subjects found for this class. Ask admin to add subjects.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {students.map((s) => (
                <div key={s.id} className="bg-white border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                    {s.roll_number && (
                      <Badge variant="outline" className="text-xs">#{s.roll_number}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {subjects.map((sub) => (
                      <div key={sub.id}>
                        <label className="text-xs text-muted-foreground font-medium">{sub.name}</label>
                        <Input
                          type="number"
                          min={0}
                          max={selectedExam.total_marks}
                          placeholder={`/${selectedExam.total_marks}`}
                          value={marks[s.id]?.[sub.id] ?? ""}
                          onChange={(e) => setMark(s.id, sub.id, e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-20 pt-2">
              <Button
                className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white py-5 text-base font-semibold shadow-lg"
                onClick={saveResults}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Results"}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Exam list ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Results</h1>
          <p className="text-sm text-muted-foreground">{className}</p>
        </div>
        {classes.length > 1 && (
          <Select value={classId ?? ""} onValueChange={(v) => v && setClassId(v)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <BookOpen size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-muted-foreground">No exams scheduled for your class yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => openExam(exam)}
              className="w-full bg-white border rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-shadow text-left"
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">{exam.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(exam.date)} · Max {exam.total_marks} marks
                </p>
              </div>
              <ChevronRight size={18} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
