import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { sendAbsentAlert, sendLateAlert } from "@/lib/wati";

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

  // Upsert attendance records
  const rows = (records as { studentId: string; studentName: string; status: string; parentPhone: string }[]).map((r) => ({
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

  // Get school WATI credentials
  const { data: school } = await admin
    .from("schools")
    .select("wati_endpoint, wati_token")
    .eq("id", profile.school_id)
    .single() as { data: { wati_endpoint: string | null; wati_token: string | null } | null; error: unknown };

  const watiEndpoint = school?.wati_endpoint;
  const watiToken = school?.wati_token;
  const watiEnabled = !!(watiEndpoint && watiToken);

  // Send WhatsApp alerts for absent/late students
  const notifiable = (records as { studentId: string; studentName: string; status: string; parentPhone: string }[]).filter(
    (r) => r.status !== "present"
  );

  if (notifiable.length > 0) {
    const formattedDate = new Date(date).toLocaleDateString("en-PK", {
      day: "numeric", month: "long", year: "numeric",
    });

    const results = await Promise.allSettled(
      notifiable.map(async (r) => {
        const logStatus = watiEnabled
          ? (r.status === "absent"
              ? await sendAbsentAlert(r.parentPhone, r.studentName, formattedDate, watiEndpoint!, watiToken!)
              : await sendLateAlert(r.parentPhone, r.studentName, formattedDate, watiEndpoint!, watiToken!))
          : { success: false };

        await admin.from("whatsapp_logs").insert({
          school_id: profile.school_id,
          phone: r.parentPhone,
          template_name: r.status === "absent" ? "ilm_attendance_absent" : "ilm_attendance_late",
          status: watiEnabled ? (logStatus.success ? "sent" : "failed") : "queued",
        });

        return logStatus;
      })
    );

    // Mark attendance rows whatsapp_sent=true for successful sends
    if (watiEnabled) {
      const sentIds = notifiable
        .filter((_, i) => {
          const r = results[i];
          return r.status === "fulfilled" && r.value.success;
        })
        .map((r) => r.studentId);

      if (sentIds.length > 0) {
        await admin
          .from("attendance")
          .update({ whatsapp_sent: true })
          .in("student_id", sentIds)
          .eq("date", date);
      }
    }
  }

  return NextResponse.json({ success: true });
}
