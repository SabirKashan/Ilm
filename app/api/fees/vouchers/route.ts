import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { sendFeeVoucher } from "@/lib/wati";

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

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { classId, feeTypeId, dueDate } = await req.json();
  if (!classId || !feeTypeId || !dueDate) {
    return NextResponse.json({ error: "classId, feeTypeId and dueDate are required" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get fee type details
  const { data: feeType } = await admin
    .from("fee_types")
    .select("name, amount")
    .eq("id", feeTypeId)
    .single() as { data: { name: string; amount: number } | null; error: unknown };

  if (!feeType) return NextResponse.json({ error: "Fee type not found" }, { status: 404 });

  // Get active students in class with parent phones
  const { data: students } = await admin
    .from("students")
    .select("id, name, parent_phone")
    .eq("class_id", classId)
    .eq("status", "active") as { data: { id: string; name: string; parent_phone: string }[] | null; error: unknown };

  if (!students || students.length === 0) {
    return NextResponse.json({ error: "No active students in this class" }, { status: 400 });
  }

  // Insert vouchers
  const rows = students.map((s) => ({
    school_id: profile.school_id,
    student_id: s.id,
    fee_type_id: feeTypeId,
    amount: feeType.amount,
    due_date: dueDate,
    status: "pending" as const,
    whatsapp_sent: false,
  }));

  const { error: insertError } = await admin.from("fee_vouchers").insert(rows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Get school WATI credentials
  const { data: school } = await admin
    .from("schools")
    .select("wati_endpoint, wati_token")
    .eq("id", profile.school_id)
    .single() as { data: { wati_endpoint: string | null; wati_token: string | null } | null; error: unknown };

  const watiEnabled = !!(school?.wati_endpoint && school?.wati_token);

  const formattedDue = new Date(dueDate).toLocaleDateString("en-PK", {
    day: "numeric", month: "long", year: "numeric",
  });
  const formattedAmount = feeType.amount.toLocaleString();

  // Send WhatsApp to each parent
  let sentCount = 0;
  if (watiEnabled) {
    await Promise.allSettled(
      students.map(async (s) => {
        const result = await sendFeeVoucher(
          s.parent_phone,
          s.name,
          feeType.name,
          formattedAmount,
          formattedDue,
          school!.wati_endpoint!,
          school!.wati_token!
        );

        await admin.from("whatsapp_logs").insert({
          school_id: profile.school_id,
          phone: s.parent_phone,
          template_name: "ilm_fee_voucher",
          status: result.success ? "sent" : "failed",
        });

        if (result.success) sentCount++;
      })
    );

    // Mark vouchers whatsapp_sent for successful sends
    if (sentCount > 0) {
      const sentStudentIds = students.slice(0, sentCount).map((s) => s.id);
      await admin
        .from("fee_vouchers")
        .update({ whatsapp_sent: true })
        .in("student_id", sentStudentIds)
        .eq("fee_type_id", feeTypeId)
        .eq("due_date", dueDate);
    }
  } else {
    // Queue logs for when WATI is configured
    const logs = students.map((s) => ({
      school_id: profile.school_id,
      phone: s.parent_phone,
      template_name: "ilm_fee_voucher",
      status: "queued",
    }));
    await admin.from("whatsapp_logs").insert(logs);
  }

  return NextResponse.json({
    success: true,
    voucherCount: students.length,
    sentCount: watiEnabled ? sentCount : 0,
  });
}
