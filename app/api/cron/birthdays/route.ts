import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendBirthdayWish } from "@/lib/wati";

// Runs daily at 8:00 AM PKT (03:00 UTC)
// Sends a WhatsApp birthday wish to parents of students whose birthday is today
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day   = String(today.getDate()).padStart(2, "0");
  // Match students born on today's month/day regardless of year
  const pattern = `%-${month}-${day}`;

  const { data: students } = await supabase
    .from("students")
    .select(`
      id, name, parent_phone, school_id,
      schools(name, wati_endpoint, wati_token)
    `)
    .eq("status", "active")
    .like("date_of_birth", pattern);

  if (!students || students.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const s of students as any[]) {
    const endpoint = s.schools?.wati_endpoint;
    const token    = s.schools?.wati_token;
    if (!endpoint || !token || !s.parent_phone) continue;

    const result = await sendBirthdayWish(
      s.parent_phone,
      s.name,
      s.schools?.name ?? "School",
      endpoint,
      token
    );

    if (result.success) {
      await supabase.from("whatsapp_logs").insert({
        school_id: s.school_id,
        phone: s.parent_phone,
        template_name: "ilm_birthday",
        status: "sent",
      });
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
