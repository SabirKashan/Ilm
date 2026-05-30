import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendMonthlyReport } from "@/lib/wati";

// Runs on the 1st of every month at 9:00 AM PKT (04:00 UTC)
// Sends each parent a WhatsApp progress summary for the previous month:
//   attendance %, last exam grade, and fee status
// Uses bulk queries per school (not per student) to avoid N+1 timeouts.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    // ── 1. Get all active students ──────────────────────────────────────────
    const { data: students } = await supabase
      .from("students")
      .select("id, name, parent_phone")
      .eq("school_id", school.id)
      .eq("status", "active");

    if (!students || students.length === 0) continue;

    const studentIds = (students as any[]).map((s) => s.id);

    // ── 2. Bulk-fetch attendance for ALL students in this school ────────────
    const { data: allAtt } = await supabase
      .from("attendance")
      .select("student_id, status")
      .in("student_id", studentIds)
      .gte("date", monthStart)
      .lte("date", monthEnd);

    // Group by student_id
    const attByStudent: Record<string, { status: string }[]> = {};
    for (const r of (allAtt ?? []) as any[]) {
      if (!attByStudent[r.student_id]) attByStudent[r.student_id] = [];
      attByStudent[r.student_id].push({ status: r.status });
    }

    // ── 3. Bulk-fetch latest result per student ─────────────────────────────
    // Use a subquery approach: fetch all results ordered desc, take distinct first per student in JS
    const { data: allResults } = await supabase
      .from("results")
      .select("student_id, marks_obtained, exams(total_marks, name)")
      .in("student_id", studentIds)
      .order("id", { ascending: false });

    // First result per student = latest
    const latestResultByStudent: Record<string, any> = {};
    for (const r of (allResults ?? []) as any[]) {
      if (!latestResultByStudent[r.student_id]) {
        latestResultByStudent[r.student_id] = r;
      }
    }

    // ── 4. Bulk-fetch pending fee vouchers for ALL students ─────────────────
    const { data: allVouchers } = await supabase
      .from("fee_vouchers")
      .select("student_id, status")
      .in("student_id", studentIds)
      .in("status", ["pending", "overdue"]);

    // Count pending per student
    const pendingByStudent: Record<string, number> = {};
    for (const v of (allVouchers ?? []) as any[]) {
      pendingByStudent[v.student_id] = (pendingByStudent[v.student_id] ?? 0) + 1;
    }

    // ── 5. Build per-student message and send ──────────────────────────────
    const logRows: any[] = [];

    for (const student of students as any[]) {
      if (!student.parent_phone) continue;

      // Attendance %
      const attRecords = attByStudent[student.id] ?? [];
      const totalDays = attRecords.length;
      const presentDays = attRecords.filter((r) => r.status === "present").length;
      const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      // Grade
      let gradeLabel = "N/A";
      const latestResult = latestResultByStudent[student.id];
      if (latestResult && latestResult.exams?.total_marks > 0) {
        const pct = Math.round((latestResult.marks_obtained / latestResult.exams.total_marks) * 100);
        gradeLabel = getGrade(pct);
      }

      // Fee status
      const pendingCount = pendingByStudent[student.id] ?? 0;
      const feeStatus = pendingCount > 0
        ? `${pendingCount} voucher${pendingCount > 1 ? "s" : ""} pending`
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

      logRows.push({
        school_id: school.id,
        phone: student.parent_phone,
        template_name: "ilm_monthly_report",
        status: result.success ? "sent" : "failed",
      });

      if (result.success) sent++;
    }

    // Bulk-insert all log rows for this school
    if (logRows.length > 0) {
      await supabase.from("whatsapp_logs").insert(logRows);
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
