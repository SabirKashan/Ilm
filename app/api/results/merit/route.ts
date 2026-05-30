import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendMeritCertificate } from "@/lib/wati";
import type { Database } from "@/types/database";

// Called after results are saved. Sends WhatsApp merit certificates
// to parents of students who scored >= 90% on any subject in this exam.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const caller = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { examId, subjectId } = await req.json();
  if (!examId || !subjectId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  // Get exam info and school WATI credentials
  const { data: exam } = await supabase
    .from("exams")
    .select("name, total_marks, school_id, schools(name, wati_endpoint, wati_token)")
    .eq("id", examId)
    .single() as { data: any; error: unknown };

  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const endpoint = exam.schools?.wati_endpoint;
  const token    = exam.schools?.wati_token;
  if (!endpoint || !token) return NextResponse.json({ sent: 0, reason: "WATI not configured" });

  // Find results for this exam+subject where marks >= 90%
  const threshold = exam.total_marks * 0.9;
  const { data: results } = await supabase
    .from("results")
    .select("student_id, marks_obtained")
    .eq("exam_id", examId)
    .eq("subject_id", subjectId)
    .gte("marks_obtained", threshold);

  if (!results || results.length === 0) return NextResponse.json({ sent: 0 });

  const studentIds = (results as any[]).map((r) => r.student_id);

  const { data: students } = await supabase
    .from("students")
    .select("id, name, parent_phone")
    .in("id", studentIds);

  let sent = 0;

  for (const s of (students ?? []) as any[]) {
    if (!s.parent_phone) continue;
    const result = (results as any[]).find((r) => r.student_id === s.id);
    const pct = Math.round((result.marks_obtained / exam.total_marks) * 100);
    const grade = getGrade(pct);

    const res = await sendMeritCertificate(
      s.parent_phone,
      s.name,
      exam.name,
      `${pct}%`,
      grade,
      exam.schools?.name ?? "School",
      endpoint,
      token
    );

    if (res.success) {
      await supabase.from("whatsapp_logs").insert({
        school_id: exam.school_id,
        phone: s.parent_phone,
        template_name: "ilm_merit_certificate",
        status: "sent",
      });
      sent++;
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
  return "F";
}
