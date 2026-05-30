"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatPKR } from "@/lib/utils";
import {
  BarChart3,
  CalendarCheck,
  CreditCard,
  BookOpen,
  Download,
  Users,
  TrendingUp,
  AlertCircle,
  Clock,
  MessageSquare,
} from "lucide-react";

type Tab = "attendance" | "fees" | "results" | "defaulters";

type Cls = { id: string; name: string };
type Exam = { id: string; name: string; date: string; total_marks: number; class_id: string };

// ─── Attendance Report ───────────────────────────────────────────────────────

type AttRow = {
  student_id: string;
  studentName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  pct: number;
};

function AttendanceReport({ schoolId }: { schoolId: string }) {
  const supabase = createClient();
  const [classes, setClasses] = useState<Cls[]>([]);
  const [classId, setClassId] = useState("all");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name")
      .then(({ data }) => setClasses((data ?? []) as Cls[]));
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    // Get all students for filter
    let studentsQ = supabase
      .from("students")
      .select("id, name")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("name");
    if (classId !== "all") studentsQ = studentsQ.eq("class_id", classId);
    const { data: students } = await studentsQ;

    // Get attendance records
    let attQ = supabase
      .from("attendance")
      .select("student_id, status")
      .eq("school_id", schoolId)
      .gte("date", from)
      .lte("date", to);
    if (classId !== "all") attQ = attQ.eq("class_id", classId);
    const { data: attRaw } = await attQ;
    const att = (attRaw ?? []) as { student_id: string; status: string }[];

    const attMap: Record<string, { present: number; absent: number; late: number }> = {};
    for (const a of att) {
      if (!attMap[a.student_id]) attMap[a.student_id] = { present: 0, absent: 0, late: 0 };
      attMap[a.student_id][a.status as "present" | "absent" | "late"]++;
    }

    const result: AttRow[] = (students ?? []).map((s: { id: string; name: string }) => {
      const counts = attMap[s.id] ?? { present: 0, absent: 0, late: 0 };
      const total = counts.present + counts.absent + counts.late;
      return {
        student_id: s.id,
        studentName: s.name,
        ...counts,
        total,
        pct: total > 0 ? Math.round((counts.present / total) * 100) : 0,
      };
    });

    setRows(result);
    setLoading(false);
  }, [schoolId, classId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const avgPct = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;
  const belowThreshold = rows.filter((r) => r.pct < 75).length;

  function exportCSV() {
    const header = "Student,Present,Absent,Late,Total Days,Attendance %";
    const body = rows
      .map((r) => `${r.studentName},${r.present},${r.absent},${r.late},${r.total},${r.pct}%`)
      .join("\n");
    downloadCSV(`attendance_report_${from}_${to}.csv`, header + "\n" + body);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 rounded-xl p-4">
        <div className="flex-1 min-w-[140px] space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Class</label>
          <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button
          className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Loading…" : "Generate"}
        </Button>
      </div>

      {/* Summary cards */}
      {searched && !loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#1B4332]" />
                <span className="text-xs text-muted-foreground">Students</span>
              </div>
              <div className="text-2xl font-bold mt-1">{rows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#1B4332]" />
                <span className="text-xs text-muted-foreground">Avg Attendance</span>
              </div>
              <div className={`text-2xl font-bold mt-1 ${avgPct >= 75 ? "text-green-600" : "text-red-600"}`}>
                {avgPct}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-xs text-muted-foreground">Below 75%</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-red-600">{belowThreshold}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {searched && !loading && rows.length > 0 && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download size={14} /> Export CSV
            </Button>
          </div>
          <div className="border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.student_id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell className="text-center text-green-700 font-medium">{r.present}</TableCell>
                    <TableCell className="text-center text-red-600 font-medium">{r.absent}</TableCell>
                    <TableCell className="text-center text-amber-600 font-medium">{r.late}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{r.total}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-14 h-6 rounded-full text-xs font-bold ${
                          r.pct >= 75
                            ? "bg-green-100 text-green-700"
                            : r.pct >= 50
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.pct}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {searched && !loading && rows.length === 0 && (
        <EmptyState message="No attendance data found for the selected filters." />
      )}
    </div>
  );
}

// ─── Fees Report ─────────────────────────────────────────────────────────────

type FeeRow = {
  id: string;
  studentName: string;
  className: string;
  feeType: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
};

function FeesReport({ schoolId }: { schoolId: string }) {
  const supabase = createClient();
  const [classes, setClasses] = useState<Cls[]>([]);
  const [classId, setClassId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name")
      .then(({ data }) => setClasses((data ?? []) as Cls[]));
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    const [year, m] = month.split("-");
    const from = `${year}-${m}-01`;
    const lastDay = new Date(Number(year), Number(m), 0).getDate();
    const to = `${year}-${m}-${String(lastDay).padStart(2, "0")}`;

    // If a class is selected, get its student IDs first for accurate filtering
    let studentIdFilter: string[] | null = null;
    if (classId !== "all") {
      const { data: classStudents } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", classId);
      studentIdFilter = (classStudents ?? []).map((s: { id: string }) => s.id);
      if (studentIdFilter.length === 0) { setRows([]); setLoading(false); return; }
    }

    let q = supabase
      .from("fee_vouchers")
      .select(`
        id, amount, due_date, status, paid_at,
        students(name, class_id, classes(name)),
        fee_types(name)
      `)
      .eq("school_id", schoolId)
      .gte("created_at", from)
      .lte("created_at", to + "T23:59:59");

    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (studentIdFilter) q = q.in("student_id", studentIdFilter);

    const { data } = await q.order("created_at", { ascending: false });

    const result: FeeRow[] = (data ?? []).map((v: any) => ({
      id: v.id,
      studentName: v.students?.name ?? "—",
      className: v.students?.classes?.name ?? "—",
      feeType: v.fee_types?.name ?? "—",
      amount: v.amount,
      dueDate: v.due_date,
      status: v.status,
      paidAt: v.paid_at,
    }));

    setRows(result);
    setLoading(false);
  }, [schoolId, classId, statusFilter, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const collected = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const outstanding = rows.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount, 0);
  const paidCount = rows.filter((r) => r.status === "paid").length;

  function exportCSV() {
    const header = "Student,Class,Fee Type,Amount,Due Date,Status,Paid On";
    const body = rows
      .map(
        (r) =>
          `${r.studentName},${r.className},${r.feeType},${r.amount},${r.dueDate},${r.status},${r.paidAt ? formatDate(r.paidAt) : ""}`
      )
      .join("\n");
    downloadCSV(`fees_report_${month}.csv`, header + "\n" + body);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 rounded-xl p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex-1 min-w-[140px] space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Class</label>
          <Select value={classId} onValueChange={(v) => v && setClassId(v)}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px] space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Loading…" : "Generate"}
        </Button>
      </div>

      {/* Summary */}
      {searched && !loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-green-600" />
                <span className="text-xs text-muted-foreground">Collected</span>
              </div>
              <div className="text-xl font-bold mt-1 text-green-700">{formatPKR(collected)}</div>
              <div className="text-xs text-muted-foreground">{paidCount} paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-xs text-muted-foreground">Outstanding</span>
              </div>
              <div className="text-xl font-bold mt-1 text-red-600">{formatPKR(outstanding)}</div>
              <div className="text-xs text-muted-foreground">{rows.length - paidCount} unpaid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#1B4332]" />
                <span className="text-xs text-muted-foreground">Collection Rate</span>
              </div>
              <div className="text-xl font-bold mt-1">
                {rows.length > 0 ? Math.round((paidCount / rows.length) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {searched && !loading && rows.length > 0 && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download size={14} /> Export CSV
            </Button>
          </div>
          <div className="border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Class</TableHead>
                  <TableHead className="hidden md:table-cell">Fee Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Due / Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.className}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.feeType}</TableCell>
                    <TableCell className="text-right font-medium">Rs {Number(r.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          r.status === "paid"
                            ? "border-green-300 bg-green-50 text-green-700"
                            : r.status === "overdue"
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-amber-300 bg-amber-50 text-amber-700"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {r.paidAt ? formatDate(r.paidAt) : formatDate(r.dueDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {searched && !loading && rows.length === 0 && (
        <EmptyState message="No fee vouchers found for the selected filters." />
      )}
    </div>
  );
}

// ─── Results Report ───────────────────────────────────────────────────────────

type ResultRow = {
  studentName: string;
  subjects: Record<string, number>; // subject name → marks
  total: number;
  maxTotal: number;
  pct: number;
  grade: string;
};

function ResultsReport({ schoolId }: { schoolId: string }) {
  const supabase = createClient();
  const [classes, setClasses] = useState<Cls[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classId, setClassId] = useState("all");
  const [examId, setExamId] = useState("");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("exams").select("id, name, date, total_marks, class_id").eq("school_id", schoolId).order("date", { ascending: false }),
    ]).then(([{ data: cls }, { data: ex }]) => {
      setClasses((cls ?? []) as Cls[]);
      setExams((ex ?? []) as Exam[]);
    });
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredExams = classId === "all" ? exams : exams.filter((e) => e.class_id === classId);

  const run = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setSearched(true);

    const exam = exams.find((e) => e.id === examId);
    if (!exam) { setLoading(false); return; }

    const [{ data: results }, { data: students }] = await Promise.all([
      supabase
        .from("results")
        .select("student_id, marks_obtained, subjects(name)")
        .eq("exam_id", examId),
      supabase
        .from("students")
        .select("id, name")
        .eq("school_id", schoolId)
        .eq("class_id", exam.class_id)
        .eq("status", "active")
        .order("name"),
    ]);

    // Collect unique subject names
    const typedResults = (results ?? []) as { student_id: string; marks_obtained: number; subjects: { name: string } | null }[];
    const subjSet = new Set<string>();
    for (const r of typedResults) {
      const name = r.subjects?.name;
      if (name) subjSet.add(name);
    }
    const subjNames = Array.from(subjSet).sort();
    setSubjectNames(subjNames);

    // Build per-student map
    const studentSubjMap: Record<string, Record<string, number>> = {};
    for (const r of typedResults) {
      const sName = r.subjects?.name;
      if (!sName) continue;
      if (!studentSubjMap[r.student_id]) studentSubjMap[r.student_id] = {};
      studentSubjMap[r.student_id][sName] = r.marks_obtained;
    }

    const maxPerSubject = exam.total_marks;
    const maxTotal = maxPerSubject * subjNames.length;

    const resultRows: ResultRow[] = (students ?? []).map((s: any) => {
      const sMap = studentSubjMap[s.id] ?? {};
      const total = Object.values(sMap).reduce((a: number, b: number) => a + b, 0);
      const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
      return {
        studentName: s.name,
        subjects: sMap,
        total,
        maxTotal,
        pct,
        grade: getGrade(pct),
      };
    });

    // Sort by total desc
    resultRows.sort((a, b) => b.total - a.total);
    setRows(resultRows);
    setLoading(false);
  }, [examId, exams, schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const avgPct = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;
  const passed = rows.filter((r) => r.pct >= 40).length;

  function exportCSV() {
    const header = ["Student", ...subjectNames, "Total", "Max", "%", "Grade"].join(",");
    const body = rows
      .map((r) =>
        [
          r.studentName,
          ...subjectNames.map((s) => r.subjects[s] ?? ""),
          r.total,
          r.maxTotal,
          r.pct + "%",
          r.grade,
        ].join(",")
      )
      .join("\n");
    const exam = exams.find((e) => e.id === examId);
    downloadCSV(`results_${exam?.name ?? "report"}.csv`, header + "\n" + body);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 rounded-xl p-4">
        <div className="flex-1 min-w-[140px] space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Class</label>
          <Select value={classId} onValueChange={(v) => { if (v) { setClassId(v); setExamId(""); } }}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px] space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Exam *</label>
          <Select value={examId} onValueChange={(v) => v && setExamId(v)}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Select exam" />
            </SelectTrigger>
            <SelectContent>
              {filteredExams.length === 0 ? (
                <SelectItem value="_none" disabled>No exams found</SelectItem>
              ) : (
                filteredExams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {formatDate(e.date)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
          onClick={run}
          disabled={loading || !examId}
        >
          {loading ? "Loading…" : "Generate"}
        </Button>
      </div>

      {/* Summary */}
      {searched && !loading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#1B4332]" />
                <span className="text-xs text-muted-foreground">Students</span>
              </div>
              <div className="text-2xl font-bold mt-1">{rows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#1B4332]" />
                <span className="text-xs text-muted-foreground">Class Average</span>
              </div>
              <div className={`text-2xl font-bold mt-1 ${avgPct >= 40 ? "text-green-600" : "text-red-600"}`}>
                {avgPct}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-green-600" />
                <span className="text-xs text-muted-foreground">Pass Rate</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-green-700">
                {rows.length > 0 ? Math.round((passed / rows.length) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {searched && !loading && rows.length > 0 && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download size={14} /> Export CSV
            </Button>
          </div>
          <div className="border rounded-xl overflow-x-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>#</TableHead>
                  <TableHead>Student</TableHead>
                  {subjectNames.map((s) => (
                    <TableHead key={s} className="text-center text-xs">{s}</TableHead>
                  ))}
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.studentName}>
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    {subjectNames.map((s) => (
                      <TableCell key={s} className="text-center text-sm">
                        {r.subjects[s] ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold">
                      {r.total}/{r.maxTotal}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-12 h-6 rounded-full text-xs font-bold ${
                          r.pct >= 80
                            ? "bg-green-100 text-green-700"
                            : r.pct >= 60
                            ? "bg-blue-100 text-blue-700"
                            : r.pct >= 40
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.pct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-bold text-sm">{r.grade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {searched && !loading && rows.length === 0 && (
        <EmptyState message="No results entered for this exam yet." />
      )}
    </div>
  );
}

// ─── Fee Defaulters (Aging) ───────────────────────────────────────────────────

type DefaulterRow = {
  studentName: string;
  className: string;
  parentPhone: string;
  voucherId: string;
  feeType: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
};

function DefaultersReport({ schoolId }: { schoolId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<DefaulterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("fee_vouchers")
        .select(`
          id, amount, due_date,
          students(name, parent_phone, classes(name)),
          fee_types(name)
        `)
        .eq("school_id", schoolId)
        .in("status", ["pending", "overdue"])
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      const today_ = new Date();
      const result: DefaulterRow[] = (data ?? []).map((v: any) => {
        const due = new Date(v.due_date);
        const days = Math.floor((today_.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        return {
          studentName: v.students?.name ?? "—",
          className: v.students?.classes?.name ?? "—",
          parentPhone: v.students?.parent_phone ?? "",
          voucherId: v.id,
          feeType: v.fee_types?.name ?? "—",
          amount: v.amount,
          dueDate: v.due_date,
          daysOverdue: days,
        };
      });

      setRows(result);
      setLoading(false);
    })();
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendReminder(voucherId: string) {
    setSending(voucherId);
    const res = await fetch(`/api/fees/vouchers/remind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voucherId }),
    });
    setSending(null);
    if (res.ok) {
      const { toast: t } = await import("sonner");
      t.success("Reminder sent on WhatsApp");
    }
  }

  function exportCSV() {
    const header = "Student,Class,Fee Type,Amount,Due Date,Days Overdue,Parent Phone";
    const body = rows
      .map((r) => `${r.studentName},${r.className},${r.feeType},${r.amount},${r.dueDate},${r.daysOverdue},${r.parentPhone}`)
      .join("\n");
    downloadCSV("fee_defaulters.csv", header + "\n" + body);
  }

  const totalOutstanding = rows.reduce((s, r) => s + r.amount, 0);
  const critical = rows.filter((r) => r.daysOverdue >= 30).length;

  if (loading) {
    return <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>;
  }

  if (rows.length === 0) {
    return <EmptyState message="No overdue vouchers. All fees are up to date!" />;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-xs text-muted-foreground">Total Defaulters</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-red-500" />
              <span className="text-xs text-muted-foreground">Total Outstanding</span>
            </div>
            <div className="text-xl font-bold mt-1 text-red-600">{formatPKR(totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <span className="text-xs text-muted-foreground">30+ Days Overdue</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-600">{critical}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download size={14} /> Export CSV
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Class</TableHead>
              <TableHead>Fee Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Days Late</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.voucherId}>
                <TableCell className="font-medium">{r.studentName}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.className}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.feeType}</TableCell>
                <TableCell className="text-right font-medium">Rs {r.amount.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                    r.daysOverdue >= 30 ? "bg-red-100 text-red-700" :
                    r.daysOverdue >= 14 ? "bg-amber-100 text-amber-700" :
                    "bg-yellow-50 text-yellow-700"
                  }`}>
                    {r.daysOverdue}d
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => sendReminder(r.voucherId)}
                    disabled={sending === r.voucherId || !r.parentPhone}
                    title="Send WhatsApp reminder"
                    className="p-1.5 rounded-md hover:bg-green-50 text-green-700 disabled:opacity-40 transition-colors"
                  >
                    <MessageSquare size={15} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
      <BarChart3 size={40} className="text-gray-300 mb-3" />
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}

function getGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  return "F";
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const supabase = createClient();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("attendance");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", user.id)
        .single();
      setSchoolId((data as any)?.school_id ?? null);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "fees",       label: "Fees",       icon: CreditCard    },
    { id: "results",    label: "Results",    icon: BookOpen      },
    { id: "defaulters", label: "Defaulters", icon: AlertCircle   },
  ];

  if (!schoolId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate and export attendance, fee, and result reports
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? "bg-white text-[#1B4332] shadow-sm"
                : "text-muted-foreground hover:text-gray-900"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "attendance" && <AttendanceReport schoolId={schoolId} />}
      {tab === "fees"       && <FeesReport       schoolId={schoolId} />}
      {tab === "results"    && <ResultsReport    schoolId={schoolId} />}
      {tab === "defaulters" && <DefaultersReport schoolId={schoolId} />}
    </div>
  );
}
