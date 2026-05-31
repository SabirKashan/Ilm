"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Save, FileText } from "lucide-react";
import Link from "next/link";

type ExamDetail = {
  id: string;
  name: string;
  class_id: string;
  date: string;
  total_marks: number;
  school_id: string;
  classes: { name: string } | null;
};

type Subject = { id: string; name: string };
type Student = { id: string; name: string; roll_number: string | null };
type ResultMap = Record<string, { marks: string; remarks: string; existingId: string | null }>;

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [results, setResults] = useState<ResultMap>({});
  const [userId, setUserId] = useState("");
  const [loadingExam, setLoadingExam] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load exam + students + subjects on mount
  useEffect(() => {
    async function load() {
      const [{ data: { user } }, { data: examData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("exams")
          .select("id, name, class_id, date, total_marks, school_id, classes(name)")
          .eq("id", id)
          .single(),
      ]);

      if (user) setUserId(user.id);

      if (!examData) { setLoadingExam(false); return; }
      const e = examData as unknown as ExamDetail;
      setExam(e);

      const [{ data: subData }, { data: stuData }] = await Promise.all([
        supabase.from("subjects").select("id, name").eq("class_id", e.class_id).order("name"),
        supabase
          .from("students")
          .select("id, name, roll_number")
          .eq("class_id", e.class_id)
          .eq("status", "active")
          .order("name"),
      ]);

      setSubjects((subData ?? []) as Subject[]);
      setStudents((stuData ?? []) as Student[]);
      if (subData && subData.length > 0) setSelectedSubjectId((subData[0] as Subject).id);
      setLoadingExam(false);
    }
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load results when subject changes
  const loadResults = useCallback(async () => {
    if (!selectedSubjectId || students.length === 0) return;
    setLoadingResults(true);

    const { data } = await supabase
      .from("results")
      .select("id, student_id, marks_obtained, remarks")
      .eq("exam_id", id)
      .eq("subject_id", selectedSubjectId);

    type RawResult = { id: string; student_id: string; marks_obtained: number; remarks: string | null };
    const map: ResultMap = {};
    for (const s of students) {
      const existing = (data ?? [] as RawResult[]).find((r) => (r as RawResult).student_id === s.id) as RawResult | undefined;
      map[s.id] = {
        marks: existing ? String(existing.marks_obtained) : "",
        remarks: existing?.remarks ?? "",
        existingId: existing?.id ?? null,
      };
    }
    setResults(map);
    setLoadingResults(false);
  }, [selectedSubjectId, students, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadResults(); }, [loadResults]);

  function setMark(studentId: string, marks: string) {
    setResults((prev) => ({ ...prev, [studentId]: { ...prev[studentId], marks } }));
  }

  function setRemarks(studentId: string, remarks: string) {
    setResults((prev) => ({ ...prev, [studentId]: { ...prev[studentId], remarks } }));
  }

  async function handleSave() {
    if (!exam || !selectedSubjectId) return;

    const filled = students.filter((s) => results[s.id]?.marks !== "");
    if (filled.length === 0) { toast.error("Enter at least one student's marks"); return; }

    for (const s of filled) {
      const val = parseFloat(results[s.id].marks);
      if (isNaN(val) || val < 0 || val > exam.total_marks) {
        toast.error(`${s.name}: marks must be between 0 and ${exam.total_marks}`);
        return;
      }
    }

    setSaving(true);

    const toUpsert = filled.map((s) => ({
      school_id: exam.school_id,
      exam_id: exam.id,
      student_id: s.id,
      subject_id: selectedSubjectId,
      marks_obtained: parseFloat(results[s.id].marks),
      remarks: results[s.id].remarks.trim() || null,
      whatsapp_sent: false,
    }));

    const { error } = await (supabase as any)
      .from("results")
      .upsert(toUpsert, { onConflict: "exam_id,student_id,subject_id" });

    setSaving(false);
    if (error) { toast.error(error.message); return; }

    toast.success(`Results saved for ${filled.length} student${filled.length !== 1 ? "s" : ""}`);
    loadResults();

    // Send merit certificates to students who scored 90%+
    fetch("/api/results/merit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId: exam.id, subjectId: selectedSubjectId }),
    }).then((r) => r.json()).then((data) => {
      if (data.sent > 0) toast.success(`${data.sent} merit certificate${data.sent > 1 ? "s" : ""} sent on WhatsApp`);
    }).catch(() => {});
  }

  const filledCount = students.filter((s) => results[s.id]?.marks !== "").length;
  const avgMarks = filledCount > 0
    ? (students.filter((s) => results[s.id]?.marks !== "")
        .reduce((sum, s) => sum + parseFloat(results[s.id]?.marks || "0"), 0) / filledCount)
    : null;

  if (loadingExam) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Exam not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-900 mb-3"
        >
          <ArrowLeft size={14} /> Back to Exams
        </button>
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{exam.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {exam.classes?.name} &middot;{" "}
              {new Date(exam.date).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })} &middot;{" "}
              {exam.total_marks} marks
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {filledCount > 0 && (
              <Badge className="bg-[#1B4332]/10 text-[#1B4332] hover:bg-[#1B4332]/10">
                {filledCount}/{students.length} filled
              </Badge>
            )}
            {avgMarks !== null && (
              <Badge variant="outline">
                Avg {avgMarks.toFixed(1)}/{exam.total_marks}
              </Badge>
            )}
          </div>
          <Link href={`/dashboard/exams/${id}/report-cards`}>
            <Button variant="outline" className="gap-2">
              <FileText size={15} /> Report Cards
            </Button>
          </Link>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">
            No subjects in this class yet.{" "}
            <a href={`/dashboard/classes/${exam.class_id}`} className="underline text-[#1B4332]">
              Add subjects
            </a>{" "}
            first.
          </p>
        </div>
      ) : (
        <>
          {/* Subject selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium shrink-0">Subject</span>
            <Select value={selectedSubjectId} onValueChange={(v) => setSelectedSubjectId(v ?? "")}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results table */}
          {loadingResults ? (
            <div className="space-y-2">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
              <p className="text-sm text-muted-foreground">No active students in this class.</p>
            </div>
          ) : (
            <>
              <div className="border rounded-xl overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Student</TableHead>
                      <TableHead className="w-32">
                        Marks <span className="text-muted-foreground font-normal">/ {exam.total_marks}</span>
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">Remarks</TableHead>
                      <TableHead className="w-20 text-center hidden sm:table-cell">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => {
                      const r = results[s.id] ?? { marks: "", remarks: "", existingId: null };
                      const pct = r.marks !== "" ? ((parseFloat(r.marks) / exam.total_marks) * 100) : null;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{s.name}</p>
                            {s.roll_number && <p className="text-xs text-muted-foreground">Roll #{s.roll_number}</p>}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={exam.total_marks}
                              step="0.5"
                              placeholder="—"
                              value={r.marks}
                              onChange={(e) => setMark(s.id, e.target.value)}
                              className="h-8 w-24 text-sm"
                            />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Input
                              placeholder="Optional"
                              value={r.remarks}
                              onChange={(e) => setRemarks(s.id, e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-center">
                            {pct !== null && (
                              <span className={`text-sm font-medium ${pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                {pct.toFixed(0)}%
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                  onClick={handleSave}
                  disabled={saving || filledCount === 0}
                >
                  <Save size={15} className="mr-1.5" />
                  {saving ? "Saving..." : "Save Results"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
