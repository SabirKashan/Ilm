import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendFeeReminder, sendOverdueNotice } from "@/lib/wati";

// Runs daily at 10:00 AM PKT (05:00 UTC)
// Sends WhatsApp reminders for:
//   - Vouchers due in 7 days
//   - Vouchers due tomorrow
//   - Vouchers 3 days overdue
//   - Vouchers 14 days overdue (final notice)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const d7  = offsetDate(today,  7);
  const d1  = offsetDate(today,  1);
  const dm3 = offsetDate(today, -3);
  const dm14 = offsetDate(today, -14);

  // Fetch pending/overdue vouchers matching reminder dates
  const { data: vouchers } = await supabase
    .from("fee_vouchers")
    .select(`
      id, amount, due_date, status,
      students(name, parent_phone),
      fee_types(name),
      schools(name, wati_endpoint, wati_token)
    `)
    .in("status", ["pending", "overdue"])
    .in("due_date", [d7, d1, dm3, dm14]);

  if (!vouchers || vouchers.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const v of vouchers as any[]) {
    const endpoint = v.schools?.wati_endpoint;
    const token    = v.schools?.wati_token;
    if (!endpoint || !token) continue;

    const phone   = v.students?.parent_phone;
    const name    = v.students?.name ?? "Student";
    const feeType = v.fee_types?.name ?? "Fee";
    const amount  = `Rs ${Number(v.amount).toLocaleString()}`;
    const due     = v.due_date;
    const school  = v.schools?.name ?? "School";

    let result;
    if (due === d7) {
      result = await sendFeeReminder(phone, name, feeType, amount, due, "7 days", endpoint, token);
    } else if (due === d1) {
      result = await sendFeeReminder(phone, name, feeType, amount, due, "tomorrow", endpoint, token);
    } else if (due === dm3) {
      result = await sendOverdueNotice(phone, name, feeType, amount, "3", endpoint, token);
    } else if (due === dm14) {
      result = await sendOverdueNotice(phone, name, feeType, amount, "14", endpoint, token);
    }

    if (result?.success) {
      await supabase.from("whatsapp_logs").insert({
        school_id: (v as any).school_id,
        phone,
        template_name: due === d7 || due === d1 ? "ilm_fee_reminder" : "ilm_fee_overdue",
        status: "sent",
      });
      sent++;
    }
  }

  return NextResponse.json({ sent, checked: vouchers.length });
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
