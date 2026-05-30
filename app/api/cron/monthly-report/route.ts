import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendMonthlyReport } from "@/lib/wati";

// Runs on the 1st of every month at 9:00 AM PKT (04:00 UTC)
// Sends each parent a WhatsApp progress summary for the previous month:
//   attendance %, last exam grade, and fee status
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();

  // Previous month range
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStart = prevMonth.toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  const monthLabel = prevMonth.toLocaleDateString("en-PK", { month: "long", year: "numeric" });

  // Get all schools with WATI credentials
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, wati_endpoint, wati_token")
    .not("wati_endpoint", "is", null)
    .not("wati_token", "is", null);

  if (!schools || schools.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const school of schools as any[]) {
    // Get all active students in this school
    const { data: students } = await supabase
      .from("students")
      .select("id, name, parent_phone")
      .eq("school_id", school.id)
      .eq("status", "active");

    if (!students || students.length === 0) continue;

    for (const student of students as any[]) {
      if (!student.parent_phone) continue;

      // Attendance % for previous month
      const { data: att } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", student.id)
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const attRecords = (att ?? []) as { status: string }[];
      const totalDays = attRecords.length;
      const presentDays = attRecords.filter((r) => r.status === "present").length;
      const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Last exam grade
      const { data: latestResult } = await supabase
        .from("results")
        .select("marks_obtained, exams(total_marks, name)")
        .eq("student_id", student.id)
        .order("id", { ascending: false })
        .limit(1)
        .single() as { data: any; error: unknown };

      let gradeLabel = "N/A";
      if (latestResult) {
        const pct = latestResult.exams?.total_marks > 0
          ? Math.round((latestResult.marks_obtained / latestResult.exams.total_marks) * 100)
          : 0;
        gradeLabel = getGrade(pct);
      }

      // Fee status
      const { count: pendingCount } = await supabase
        .from("fee_vouchers")
        .select("id", { count: "exact", head: true })
        .eq("student_id", student.id)
        .in("status", ["pending", "overdue"]);

      const feeStatus = (pendingCount ?? 0) > 0
        ? `${pendingCount} voucher${pendingCount! > 1 ? "s" : ""} pending`
        : "All clear";

      const result = await sendMonthlyReport(
        student.parent_phone,
        student.name,
        monthLabel,
        `${attPct}%`,
        gradeLabel,
        feeStatus,
        school.name,
        school.wati_endpoint,
        school.wati_token
      );

      if (result.success) {
        await supabase.from("whatsapp_logs").insert({
          school_id: school.id,
          phone: student.parent_phone,
          template_name: "ilm_monthly_report",
          status: "sent",
        });
        sent++;
      }
    }
  }

  return NextResponse.json({ sent });
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
