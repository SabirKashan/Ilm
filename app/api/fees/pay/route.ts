import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data } = await supabase
    .from("fee_vouchers")
    .select(`
      id, amount, due_date, status, paid_at, payment_method, transaction_id,
      students(name, father_name, classes(name)),
      fee_types(name),
      schools(name, address, city, phone)
    `)
    .eq("id", id)
    .single();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, payment_method, transaction_id } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("fee_vouchers")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method,
      transaction_id: transaction_id || null,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
