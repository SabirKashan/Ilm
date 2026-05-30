"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Class, AttendanceStatus } from "@/types/database";

type StudentRow = {
  id: string;
  name: string;
  roll_number: string | null;
  parent_phone: string;
};

function todayPKT() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const supabase = createClient();

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayPKT);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchClasses() {
      const { data } = await supabase.from("classes").select("*").order("name");
      setClasses((data ?? []) as Class[]);
      setLoadingClasses(false);
    }
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStudentsAndAttendance = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);

    const [{ data: studentData }, { data: attData }] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, roll_number, parent_phone")
        .eq("class_id", selectedClassId)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", selectedClassId)
        .eq("date", selectedDate),
    ]);

    setStudents((studentData ?? []) as StudentRow[]);

    const attMap: Record<string, AttendanceStatus> = {};
    for (const a of (attData ?? []) as { student_id: string; status: AttendanceStatus }[]) {
      attMap[a.student_id] = a.status;
    }
    setAttendance(attMap);
    setAlreadyMarked(Object.keys(attMap).length > 0);
    setLoadingStudents(false);
  }, [selectedClassId, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchStudentsAndAttendance(); }, [fetchStudentsAndAttendance]);

  function toggle(studentId: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAllPresent() {
    const all: Record<string, AttendanceStatus> = {};
    for (const s of students) all[s.id] = "present";
    setAttendance(all);
  }

  const presentCount = Object.values(attendance).filter((s) => s === "present").length;
  const absentCount = Object.values(attendance).filter((s) => s === "absent").length;
  const lateCount = Object.values(attendance).filter((s) => s === "late").length;
  const unmarkedCount = students.length - Object.keys(attendance).filter((id) => attendance[id]).length;

  async function handleSave() {
    if (!selectedClassId) return;
    if (unmarkedCount > 0) {
      toast.error(`${unmarkedCount} student${unmarkedCount > 1 ? "s" : ""} still unmarked`);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: selectedClassId,
        date: selectedDate,
        records: students.map((s) => ({
          studentId: s.id,
          studentName: s.name,
          status: attendance[s.id],
          parentPhone: s.parent_phone,
        })),
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(json.error ?? "Failed to save attendance");
      return;
    }

    setAlreadyMarked(true);
    toast.success(
      `Attendance saved — ${presentCount} present, ${absentCount} absent, ${lateCount} late`
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Mark daily attendance for a class</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1.5">
          <Label>Class</Label>
          {loadingClasses ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : (
            <Select value={selectedClassId} onValueChange={(v) => setSelectedClassId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <input
            type="date"
            value={selectedDate}
            max={todayPKT()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex h-10 w-full sm:w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      {!selectedClassId ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[#1B4332]/20 rounded-xl">
          <CalendarCheck size={48} className="text-[#1B4332]/30 mb-4" />
          <p className="text-sm text-muted-foreground">Select a class to mark attendance</p>
        </div>
      ) : loadingStudents ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-[#1B4332]/20 rounded-xl">
          <p className="text-sm text-muted-foreground">No active students in this class</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {presentCount > 0 && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  {presentCount} Present
                </Badge>
              )}
              {absentCount > 0 && (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                  {absentCount} Absent
                </Badge>
              )}
              {lateCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  {lateCount} Late
                </Badge>
              )}
              {unmarkedCount > 0 && (
                <Badge variant="outline">{unmarkedCount} Unmarked</Badge>
              )}
              {alreadyMarked && (
                <Badge className="bg-[#1B4332]/10 text-[#1B4332] hover:bg-[#1B4332]/10">
                  Already marked
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              Mark All Present
            </Button>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white divide-y">
            {students.map((s) => {
              const status = attendance[s.id];
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-[#1B4332]/10 text-[#1B4332] text-sm font-medium">
                        {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      {s.roll_number && (
                        <p className="text-xs text-muted-foreground">Roll #{s.roll_number}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => toggle(s.id, "present")}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        status === "present"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700"
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      <span className="hidden sm:inline">Present</span>
                      <span className="sm:hidden">P</span>
                    </button>
                    <button
                      onClick={() => toggle(s.id, "absent")}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        status === "absent"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-700"
                      }`}
                    >
                      <XCircle size={12} />
                      <span className="hidden sm:inline">Absent</span>
                      <span className="sm:hidden">A</span>
                    </button>
                    <button
                      onClick={() => toggle(s.id, "late")}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                        status === "late"
                          ? "bg-amber-500 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-700"
                      }`}
                    >
                      <Clock size={12} />
                      <span className="hidden sm:inline">Late</span>
                      <span className="sm:hidden">L</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleSave}
              disabled={saving || unmarkedCount > 0}
            >
              {saving ? "Saving..." : alreadyMarked ? "Update Attendance" : "Save Attendance"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
