"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Clock, CheckCheck, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Status = "present" | "absent" | "late";
type Student = { id: string; name: string; roll_number: string | null };
type AttMap = Record<string, Status>;

export default function TeacherAttendancePage() {
  const supabase = createClient();

  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [userId, setUserId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [att, setAtt] = useState<AttMap>({});
  const [today] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noClass, setNoClass] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", user.id)
      .single() as { data: { school_id: string } | null; error: unknown };
    if (!profile) return;
    setSchoolId(profile.school_id);

    const { data: cls } = await supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", profile.school_id)
      .eq("teacher_id", user.id)
      .single() as { data: { id: string; name: string } | null; error: unknown };

    if (!cls) { setNoClass(true); setLoading(false); return; }
    setClassId(cls.id);
    setClassName(cls.name);

    const [{ data: studsRaw }, { data: existingRaw }] = await Promise.all([
      supabase.from("students").select("id, name, roll_number").eq("class_id", cls.id).eq("status", "active").order("name"),
      supabase.from("attendance").select("student_id, status").eq("class_id", cls.id).eq("date", today),
    ]);

    setStudents((studsRaw ?? []) as Student[]);
    const map: AttMap = {};
    for (const r of (existingRaw ?? []) as { student_id: string; status: string }[]) {
      map[r.student_id] = r.status as Status;
    }
    setAtt(map);
    setLoading(false);
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function toggle(studentId: string, status: Status) {
    setAtt((prev) => ({ ...prev, [studentId]: prev[studentId] === status ? "present" : status }));
  }

  function markAll() {
    const m: AttMap = {};
    students.forEach((s) => { m[s.id] = "present"; });
    setAtt(m);
  }

  async function save() {
    if (!classId || !schoolId || !userId) return;
    if (unmarked > 0) {
      toast.error(`${unmarked} student${unmarked > 1 ? "s" : ""} still unmarked`);
      return;
    }
    setSaving(true);
    const rows: { school_id: string; class_id: string; student_id: string; date: string; status: string; marked_by: string; whatsapp_sent: boolean }[] = students.map((s) => ({
      school_id: schoolId,
      class_id: classId,
      student_id: s.id,
      date: today,
      status: att[s.id] ?? "present",
      marked_by: userId,
      whatsapp_sent: false,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("attendance") as any).upsert(rows, {
      onConflict: "student_id,date",
    });

    if (error) {
      toast.error("Failed to save attendance");
    } else {
      toast.success("Attendance saved!");
    }
    setSaving(false);
  }

  const unmarked = students.filter((s) => att[s.id] === undefined).length;
  const present = students.filter((s) => att[s.id] === "present").length;
  const absent  = students.filter((s) => att[s.id] === "absent").length;
  const late    = students.filter((s) => att[s.id] === "late").length;

  if (noClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle size={48} className="text-amber-400 mb-4" />
        <h2 className="text-lg font-semibold">No class assigned</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Ask your admin to assign you to a class first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3,4,5].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-sm text-muted-foreground">{className} · {formatDate(today)}</p>
      </div>

      {/* Counts */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 gap-1">
          <Check size={12} /> {present} present
        </Badge>
        <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700 gap-1">
          <X size={12} /> {absent} absent
        </Badge>
        <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 gap-1">
          <Clock size={12} /> {late} late
        </Badge>
        {unmarked > 0 && (
          <Badge variant="outline" className="bg-gray-50 border-gray-300 text-gray-500 gap-1">
            {unmarked} unmarked
          </Badge>
        )}
      </div>

      {/* Mark All */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={markAll} className="gap-1.5 text-xs">
          <CheckCheck size={14} /> Mark All Present
        </Button>
      </div>

      {/* Student list */}
      {students.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No active students in this class yet.
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => {
            const status = att[s.id] ?? "present";
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                  att[s.id] === "absent" ? "bg-red-50 border-red-200" :
                  att[s.id] === "late"   ? "bg-amber-50 border-amber-200" :
                  att[s.id] === "present" ? "bg-green-50 border-green-200" :
                                            "bg-white border-gray-200"
                }`}
              >
                <div>
                  <p className="font-medium text-sm text-gray-900">{s.name}</p>
                  {s.roll_number && (
                    <p className="text-xs text-muted-foreground">Roll #{s.roll_number}</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggle(s.id, "present")}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      status === "present"
                        ? "bg-green-500 text-white shadow-sm"
                        : "bg-white border border-gray-200 text-gray-400 hover:border-green-400"
                    }`}
                  >
                    <Check size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => toggle(s.id, "late")}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      status === "late"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-white border border-gray-200 text-gray-400 hover:border-amber-400"
                    }`}
                  >
                    <Clock size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => toggle(s.id, "absent")}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      status === "absent"
                        ? "bg-red-500 text-white shadow-sm"
                        : "bg-white border border-gray-200 text-gray-400 hover:border-red-400"
                    }`}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save button — sticky at bottom */}
      {students.length > 0 && (
        <div className="sticky bottom-20 pt-4">
          <Button
            className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white py-5 text-base font-semibold shadow-lg"
            onClick={save}
            disabled={saving || unmarked > 0}
          >
            {saving ? "Saving…" : "Save Attendance"}
          </Button>
        </div>
      )}
    </div>
  );
}
