import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendOverdueNotice } from "@/lib/wati";
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

  const { voucherId } = await req.json();
  if (!voucherId) return NextResponse.json({ error: "Missing voucherId" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  const { data: v } = await supabase
    .from("fee_vouchers")
    .select(`
      id, amount, due_date,
      students(name, parent_phone),
      fee_types(name),
      schools(name, wati_endpoint, wati_token)
    `)
    .eq("id", voucherId)
    .single() as { data: any; error: unknown };

  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const endpoint = v.schools?.wati_endpoint;
  const token    = v.schools?.wati_token;
  if (!endpoint || !token) return NextResponse.json({ error: "WATI not configured" }, { status: 400 });

  const daysOverdue = Math.floor(
    (Date.now() - new Date(v.due_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  const result = await sendOverdueNotice(
    v.students?.parent_phone,
    v.students?.name ?? "Student",
    v.fee_types?.name ?? "Fee",
    `Rs ${Number(v.amount).toLocaleString()}`,
    String(daysOverdue),
    endpoint,
    token
  );

  if (result.success) {
    await supabase.from("whatsapp_logs").insert({
      school_id: (v as any).school_id,
      phone: v.students?.parent_phone,
      template_name: "ilm_fee_overdue",
      status: "sent",
    });
  }

  return NextResponse.json({ success: result.success });
}
