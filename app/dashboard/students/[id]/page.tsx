"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Edit2, AlertCircle } from "lucide-react";
import type { Student, Class, Attendance, FeeVoucher, Exam, Result } from "@/types/database";
import { formatDate, formatPKR, displayPakistaniPhone, formatPakistaniPhone } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function AttendanceCalendar({ attendance }: { attendance: Attendance[] }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const attendanceMap = Object.fromEntries(attendance.map((a) => [a.date, a.status]));
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const present = attendance.filter((a) => {
    const d = new Date(a.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth && a.status === "present";
  }).length;
  const absent = attendance.filter((a) => {
    const d = new Date(a.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth && a.status === "absent";
  }).length;
  const total = present + absent;
  const pct = total > 0 ? Math.round((present / total) * 100) : null;

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-sm">←</button>
        <span className="font-medium">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-sm" disabled={viewYear === now.getFullYear() && viewMonth === now.getMonth()}>→</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-700">{present}</p>
          <p className="text-xs text-green-600">Present</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-red-700">{absent}</p>
          <p className="text-xs text-red-600">Absent</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-700">{pct !== null ? `${pct}%` : "—"}</p>
          <p className="text-xs text-gray-500">Rate</p>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50">
          {DAYS.map((d, i) => <div key={i} className="text-center text-xs py-2 font-medium text-muted-foreground">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const status = attendanceMap[dateStr];
            return (
              <div
                key={day}
                className={`aspect-square flex items-center justify-center text-sm m-0.5 rounded-full text-xs font-medium
                  ${status === "present" ? "bg-green-500 text-white" :
                    status === "absent" ? "bg-red-500 text-white" :
                    status === "late" ? "bg-amber-400 text-white" : "text-gray-400"}`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Present</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Absent</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />Late</span>
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [student, setStudent] = useState<Student | null>(null);
  const [cls, setCls] = useState<Class | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [vouchers, setVouchers] = useState<FeeVoucher[]>([]);
  const [results, setResults] = useState<(Result & { exam: Exam | null; subjects: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [
      { data: studentRow },
      { data: attendanceRows },
      { data: voucherRows },
      { data: resultRows },
      { data: examRows },
      { data: classRows },
    ] = await Promise.all([
      supabase.from("students").select("*").eq("id", id).single(),
      supabase.from("attendance").select("*").eq("student_id", id).order("date", { ascending: false }),
      supabase.from("fee_vouchers").select("*").eq("student_id", id).order("due_date", { ascending: false }),
      supabase.from("results").select("*, subjects(name)").eq("student_id", id),
      supabase.from("exams").select("*"),
      supabase.from("classes").select("*").order("name"),
    ]);

    if (!studentRow) { router.replace("/dashboard/students"); return; }

    const s = studentRow as Student;
    setStudent(s);
    setEditForm(s);
    setClasses((classRows ?? []) as Class[]);
    setAttendance((attendanceRows ?? []) as Attendance[]);
    setVouchers((voucherRows ?? []) as FeeVoucher[]);

    const examMap = Object.fromEntries(((examRows ?? []) as Exam[]).map((e) => [e.id, e]));
    setResults(((resultRows ?? []) as (Result & { subjects: { name: string } | null })[]).map((r) => ({ ...r, exam: examMap[r.exam_id] ?? null })));

    if (s.class_id) {
      const found = ((classRows ?? []) as Class[]).find((c) => c.id === s.class_id);
      setCls(found ?? null);
    }
    setLoading(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave() {
    if (!editForm.parent_phone) return;
    const phone = formatPakistaniPhone(editForm.parent_phone);
    if (!phone) { toast.error("Invalid phone number"); return; }

    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("students").update({
      name: editForm.name,
      father_name: editForm.father_name,
      gender: editForm.gender,
      date_of_birth: editForm.date_of_birth,
      class_id: editForm.class_id || null,
      roll_number: editForm.roll_number,
      parent_phone: phone,
      address: editForm.address,
      status: editForm.status,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Student updated!");
    setShowEdit(false);
    fetchData();
  }

  async function handleDeactivate() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("students").update({ status: "inactive" }).eq("id", id);
    toast.success("Student deactivated");
    fetchData();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!student) return null;

  const initials = student.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Students
      </button>

      {/* Profile header */}
      <div className="bg-white border rounded-xl p-5 flex flex-wrap gap-4">
        <Avatar className="h-20 w-20 shrink-0">
          <AvatarImage src={student.photo_url ?? ""} alt={student.name} />
          <AvatarFallback className="bg-[#1B4332]/10 text-[#1B4332] text-2xl font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{student.name}</h1>
              {student.father_name && <p className="text-sm text-muted-foreground">{student.father_name}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditForm(student); setShowEdit(true); }}>
                <Edit2 size={14} className="mr-1" /> Edit
              </Button>
              {student.status === "active" && (
                <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={handleDeactivate}>
                  Deactivate
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {cls && <Badge variant="outline">{cls.name}</Badge>}
            {student.roll_number && <span className="text-sm text-muted-foreground">Roll #{student.roll_number}</span>}
            <Badge className={student.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}>
              {student.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1">Attendance</TabsTrigger>
          <TabsTrigger value="fees" className="flex-1">Fees</TabsTrigger>
          <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
        </TabsList>

        {/* Details */}
        <TabsContent value="details" className="mt-4">
          <div className="bg-white border rounded-xl divide-y">
            {[
              { label: "Parent Phone", value: student.parent_phone ? displayPakistaniPhone(student.parent_phone) : "—" },
              { label: "Gender", value: student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—" },
              { label: "Date of Birth", value: student.date_of_birth ? formatDate(student.date_of_birth) : "—" },
              { label: "Address", value: student.address ?? "—" },
              { label: "Enrolled", value: formatDate(student.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right max-w-[60%]">{value}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Attendance */}
        <TabsContent value="attendance" className="mt-4">
          {attendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No attendance records yet</p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl p-4">
              <AttendanceCalendar attendance={attendance} />
            </div>
          )}
        </TabsContent>

        {/* Fees */}
        <TabsContent value="fees" className="mt-4">
          {vouchers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No fee vouchers yet</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((v) => {
                    const effStatus = v.status === "paid" ? "paid" : new Date(v.due_date) < new Date(new Date().toDateString()) ? "overdue" : "pending";
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{formatPKR(v.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(v.due_date)}</TableCell>
                        <TableCell>
                          <Badge className={
                            effStatus === "paid" ? "bg-green-100 text-green-700 hover:bg-green-100" :
                            effStatus === "overdue" ? "bg-red-100 text-red-700 hover:bg-red-100" :
                            "bg-amber-100 text-amber-700 hover:bg-amber-100"
                          }>
                            {effStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Results */}
        <TabsContent value="results" className="mt-4">
          {results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No results yet</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead className="hidden sm:table-cell">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => {
                    const pct = r.exam ? Math.round((r.marks_obtained / r.exam.total_marks) * 100) : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{r.exam?.name ?? "—"}</p>
                          {r.exam && <p className="text-xs text-muted-foreground">{formatDate(r.exam.date)}</p>}
                        </TableCell>
                        <TableCell className="text-sm">{r.subjects?.name ?? "—"}</TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{r.marks_obtained}/{r.exam?.total_marks ?? "?"}</span>
                          {pct !== null && (
                            <span className={`text-xs ml-1 ${pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              ({pct}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.remarks ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEdit} modal={false} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Father Name</Label>
              <Input value={editForm.father_name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, father_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={editForm.date_of_birth ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={editForm.gender ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, gender: v as "male" | "female" }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={editForm.class_id ?? "none"} onValueChange={(v) => setEditForm((f) => ({ ...f, class_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="No class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No class</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Roll Number</Label>
              <Input value={editForm.roll_number ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, roll_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Parent WhatsApp</Label>
              <Input value={editForm.parent_phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, parent_phone: e.target.value }))} inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={editForm.address ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status ?? "active"} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
