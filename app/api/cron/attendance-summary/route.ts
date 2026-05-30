import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendDailySummary } from "@/lib/wati";

// Runs daily at 9:30 AM PKT (04:30 UTC)
// Sends the admin a WhatsApp summary: present/absent/late counts + outstanding fees
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  // Get all schools with WATI credentials
  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, wati_endpoint, wati_token")
    .not("wati_endpoint", "is", null)
    .not("wati_token", "is", null);

  if (!schools || schools.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const school of schools as any[]) {
    // Get admin phone
    const { data: admin } = await supabase
      .from("users")
      .select("phone")
      .eq("school_id", school.id)
      .eq("role", "admin")
      .single() as { data: { phone: string } | null; error: unknown };

    if (!admin?.phone) continue;

    // Today's attendance counts
    const { data: att } = await supabase
      .from("attendance")
      .select("status")
      .eq("school_id", school.id)
      .eq("date", today);

    const records = (att ?? []) as { status: string }[];
    const present = records.filter((r) => r.status === "present").length;
    const absent  = records.filter((r) => r.status === "absent").length;
    const late    = records.filter((r) => r.status === "late").length;

    // Outstanding fee count
    const { count: outstanding } = await supabase
      .from("fee_vouchers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .in("status", ["pending", "overdue"]);

    if (records.length === 0) continue; // skip if attendance not marked yet

    const dateLabel = new Date(today).toLocaleDateString("en-PK", {
      weekday: "long", day: "numeric", month: "long",
    });

    const result = await sendDailySummary(
      admin.phone,
      school.name,
      dateLabel,
      String(present),
      String(absent),
      String(late),
      String(outstanding ?? 0),
      school.wati_endpoint,
      school.wati_token
    );

    if (result.success) {
      await supabase.from("whatsapp_logs").insert({
        school_id: school.id,
        phone: admin.phone,
        template_name: "ilm_daily_summary",
        status: "sent",
      });
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
