import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const caller = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await caller
    .from("users")
    .select("school_id, role")
    .eq("id", user.id)
    .single() as { data: { school_id: string; role: string } | null; error: unknown };

  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { classId, date, records } = await req.json();
  if (!classId || !date || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const rows = (records as { studentId: string; status: string; parentPhone: string }[]).map((r) => ({
    school_id: profile.school_id,
    student_id: r.studentId,
    class_id: classId,
    date,
    status: r.status,
    marked_by: user.id,
    whatsapp_sent: false,
  }));

  const { error } = await admin
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log WhatsApp notifications for absent/late students (WATI integration pending)
  const notifiable = (records as { studentId: string; status: string; parentPhone: string }[]).filter(
    (r) => r.status !== "present"
  );
  if (notifiable.length > 0) {
    const logs = notifiable.map((r) => ({
      school_id: profile.school_id,
      phone: r.parentPhone,
      template_name: r.status === "absent" ? "attendance_absent" : "attendance_late",
      status: "queued",
    }));
    await admin.from("whatsapp_logs").insert(logs);
  }

  return NextResponse.json({ success: true });
}
