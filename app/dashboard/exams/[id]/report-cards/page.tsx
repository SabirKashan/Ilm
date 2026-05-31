"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Download } from "lucide-react";

type ExamInfo = {
  id: string;
  name: string;
  date: string;
  total_marks: number;
  class_id: string;
  school_id: string;
  classes: { name: string } | null;
};

type Subject = { id: string; name: string };
type Student = { id: string; name: string; roll_number: string | null; father_name: string | null };
type ResultRow = { student_id: string; subject_id: string; marks_obtained: number; remarks: string | null };
type SchoolInfo = { name: string; logo_url: string | null; city: string | null };

function grade(marks: number, total: number): string {
  const pct = (marks / total) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

function gradeColor(g: string): string {
  switch (g) {
    case "A+": return "bg-green-100 text-green-800";
    case "A":  return "bg-green-100 text-green-700";
    case "B":  return "bg-blue-100 text-blue-800";
    case "C":  return "bg-yellow-100 text-yellow-800";
    case "D":  return "bg-orange-100 text-orange-800";
    default:   return "bg-red-100 text-red-800";
  }
}

export default function ReportCardsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState("all");

  useEffect(() => {
    async function load() {
      const { data: examData } = await supabase
        .from("exams")
        .select("id, name, date, total_marks, class_id, school_id, classes(name)")
        .eq("id", id)
        .single();
      if (!examData) { setLoading(false); return; }
      const e = examData as unknown as ExamInfo;
      setExam(e);

      const [{ data: sch }, { data: sub }, { data: stu }, { data: res }] = await Promise.all([
        supabase.from("schools").select("name, logo_url, city").eq("id", e.school_id).single(),
        supabase.from("subjects").select("id, name").eq("class_id", e.class_id).order("name"),
        supabase.from("students").select("id, name, roll_number, father_name").eq("class_id", e.class_id).eq("status", "active").order("name"),
        supabase.from("results").select("student_id, subject_id, marks_obtained, remarks").eq("exam_id", id),
      ]);

      setSchool(sch as unknown as SchoolInfo);
      setSubjects((sub ?? []) as Subject[]);
      setStudents((stu ?? []) as Student[]);
      setResults((res ?? []) as ResultRow[]);
      setLoading(false);
    }
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePrint() {
    window.print();
  }

  const displayStudents = selectedStudentId === "all"
    ? students
    : students.filter((s) => s.id === selectedStudentId);

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );

  if (!exam) return (
    <div className="p-6 text-center text-muted-foreground">Exam not found.</div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Controls — hidden on print */}
      <div className="print:hidden flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
            <ArrowLeft size={16} /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-[#1B4332]">Report Cards — {exam.name}</h1>
            <p className="text-sm text-muted-foreground">{exam.classes?.name} · {new Date(exam.date).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedStudentId} onValueChange={(v) => setSelectedStudentId(v ?? "all")}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} className="bg-[#1B4332] hover:bg-[#1B4332]/90 gap-2">
            <Printer size={16} /> Print
          </Button>
        </div>
      </div>

      {/* Report Cards */}
      <div ref={printRef} className="space-y-8">
        {displayStudents.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl print:hidden">
            No students found in this class.
          </div>
        ) : (
          displayStudents.map((student, idx) => {
            const studentResults = results.filter((r) => r.student_id === student.id);
            const totalObtained = studentResults.reduce((sum, r) => sum + r.marks_obtained, 0);
            const totalPossible = subjects.length * exam.total_marks;
            const percentage = totalPossible > 0 ? ((totalObtained / totalPossible) * 100).toFixed(1) : "0";
            const overallGrade = totalPossible > 0 ? grade(totalObtained, totalPossible) : "—";
            const isPassing = parseFloat(percentage) >= 50;

            return (
              <div
                key={student.id}
                className="bg-white border border-border rounded-xl overflow-hidden print:break-after-page print:border-none print:rounded-none"
              >
                {/* Card header */}
                <div className="bg-[#1B4332] text-white px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {school?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={school.logo_url} alt="logo" className="w-12 h-12 rounded-lg object-contain bg-white p-1" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#F59E0B] flex items-center justify-center font-bold text-xl">ع</div>
                    )}
                    <div>
                      <p className="font-bold text-lg">{school?.name ?? "School"}</p>
                      {school?.city && <p className="text-white/70 text-sm">{school.city}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/70 text-xs uppercase tracking-wide">Result Card</p>
                    <p className="font-semibold">{exam.name}</p>
                    <p className="text-white/70 text-sm">{new Date(exam.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                </div>

                {/* Student info */}
                <div className="px-6 py-3 bg-muted/30 border-b grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Student Name</p>
                    <p className="font-semibold">{student.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Father Name</p>
                    <p className="font-semibold">{student.father_name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Class</p>
                    <p className="font-semibold">{exam.classes?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Roll No.</p>
                    <p className="font-semibold">{student.roll_number ?? "—"}</p>
                  </div>
                </div>

                {/* Marks table */}
                <div className="px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-semibold text-muted-foreground">Subject</th>
                        <th className="text-center py-2 font-semibold text-muted-foreground">Total Marks</th>
                        <th className="text-center py-2 font-semibold text-muted-foreground">Obtained</th>
                        <th className="text-center py-2 font-semibold text-muted-foreground">%</th>
                        <th className="text-center py-2 font-semibold text-muted-foreground">Grade</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((sub) => {
                        const r = studentResults.find((res) => res.subject_id === sub.id);
                        const pct = r ? ((r.marks_obtained / exam.total_marks) * 100).toFixed(0) : "—";
                        const g = r ? grade(r.marks_obtained, exam.total_marks) : "—";
                        return (
                          <tr key={sub.id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{sub.name}</td>
                            <td className="py-2 text-center text-muted-foreground">{exam.total_marks}</td>
                            <td className="py-2 text-center font-semibold">{r ? r.marks_obtained : <span className="text-muted-foreground">—</span>}</td>
                            <td className="py-2 text-center">{pct}{r ? "%" : ""}</td>
                            <td className="py-2 text-center">
                              {r ? <Badge className={`text-xs border-0 ${gradeColor(g)}`}>{g}</Badge> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2 text-muted-foreground text-xs">{r?.remarks ?? ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="px-6 py-4 bg-muted/30 border-t flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Marks</p>
                      <p className="font-bold text-lg">{totalObtained} / {totalPossible}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Percentage</p>
                      <p className="font-bold text-lg">{percentage}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Overall Grade</p>
                      <Badge className={`text-sm font-bold border-0 ${gradeColor(overallGrade)}`}>{overallGrade}</Badge>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-lg font-bold text-sm ${isPassing ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {isPassing ? "✓ PASS" : "✗ FAIL"}
                  </div>
                </div>

                {/* Signature area */}
                <div className="px-6 py-4 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                  <div className="text-center border-t pt-2">Class Teacher</div>
                  <div className="text-center border-t pt-2">Principal</div>
                  <div className="text-center border-t pt-2">Parent / Guardian</div>
                </div>

                {idx < displayStudents.length - 1 && (
                  <div className="print:hidden mx-6 mb-4 border-t border-dashed" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #report-cards-print, #report-cards-print * { visibility: visible; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
