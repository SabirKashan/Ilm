import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { CalendarCheck, Users, BookOpen, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default async function TeacherHomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("school_id, name")
    .eq("id", user.id)
    .single() as { data: { school_id: string; name: string } | null; error: unknown };

  if (!profile) redirect("/auth/login");

  const today = new Date().toISOString().split("T")[0];

  // Find class where this teacher is assigned
  const { data: myClass } = await supabase
    .from("classes")
    .select("id, name, grade_level")
    .eq("school_id", profile.school_id)
    .eq("teacher_id", user.id)
    .single() as { data: { id: string; name: string; grade_level: string | null } | null; error: unknown };

  // School name
  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", profile.school_id)
    .single() as { data: { name: string } | null; error: unknown };

  if (!myClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle size={48} className="text-amber-400 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No class assigned yet</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Ask your school admin to assign you to a class. Once assigned, you&apos;ll be able to
          mark attendance and manage results here.
        </p>
      </div>
    );
  }

  // Today's attendance for this class
  const { data: todayAttRaw } = await supabase
    .from("attendance")
    .select("status")
    .eq("class_id", myClass.id)
    .eq("date", today);

  // Total active students in class
  const { count: totalStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", myClass.id)
    .eq("status", "active");

  const att = (todayAttRaw ?? []) as { status: string }[];
  const present = att.filter((a) => a.status === "present").length;
  const absent = att.filter((a) => a.status === "absent").length;
  const late = att.filter((a) => a.status === "late").length;
  const marked = att.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground">{school?.name}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">Welcome, {profile.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
      </div>

      {/* My Class card */}
      <Card className="border-[#1B4332]/20 bg-[#1B4332]/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your Class</p>
              <p className="text-xl font-bold text-[#1B4332] mt-0.5">{myClass.name}</p>
              {myClass.grade_level && (
                <p className="text-sm text-muted-foreground">{myClass.grade_level}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#1B4332]">{totalStudents ?? 0}</p>
              <p className="text-xs text-muted-foreground">students</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's attendance */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Attendance</h2>
          <Link
            href="/teacher/attendance"
            className="text-xs text-[#1B4332] font-medium hover:underline"
          >
            {marked ? "Edit →" : "Mark now →"}
          </Link>
        </div>

        {marked ? (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <div className="text-2xl font-bold text-green-600">{present}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Present</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <div className="text-2xl font-bold text-red-600">{absent}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Absent</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3 text-center">
                <div className="text-2xl font-bold text-amber-600">{late}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Late</div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Link href="/teacher/attendance">
            <Card className="border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <CalendarCheck size={24} className="text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Attendance not marked yet</p>
                  <p className="text-xs text-amber-700">Tap to mark today&apos;s attendance</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/teacher/students">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Users size={20} className="text-[#1B4332]" />
                <span className="text-sm font-medium">Students</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/teacher/results">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <BookOpen size={20} className="text-[#1B4332]" />
                <span className="text-sm font-medium">Results</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
