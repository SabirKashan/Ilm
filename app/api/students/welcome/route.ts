import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendEnrollmentWelcome } from "@/lib/wati";
import type { Database } from "@/types/database";

// Called after a student is added (during onboarding or from the students page).
// Sends a WhatsApp welcome message to the parent — fire and forget.
// Returns { sent: true } or { sent: false, reason } — caller should not block on this.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const caller = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  const { data: student } = await supabase
    .from("students")
    .select(`
      id, name, parent_phone, school_id,
      classes(name),
      schools(name, wati_endpoint, wati_token)
    `)
    .eq("id", studentId)
    .single() as { data: any; error: unknown };

  if (!student) return NextResponse.json({ sent: false, reason: "Student not found" });

  const endpoint = student.schools?.wati_endpoint;
  const token    = student.schools?.wati_token;

  if (!endpoint || !token) {
    return NextResponse.json({ sent: false, reason: "WATI not configured" });
  }

  if (!student.parent_phone) {
    return NextResponse.json({ sent: false, reason: "No parent phone" });
  }

  const result = await sendEnrollmentWelcome(
    student.parent_phone,
    student.name,
    student.classes?.name ?? "your class",
    student.schools?.name ?? "School",
    endpoint,
    token
  );

  if (result.success) {
    await supabase.from("whatsapp_logs").insert({
      school_id: student.school_id,
      phone: student.parent_phone,
      template_name: "ilm_enrollment_welcome",
      status: "sent",
    });
  }

  return NextResponse.json({ sent: result.success });
}
