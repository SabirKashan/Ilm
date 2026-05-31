// POST /api/auth/reset-password/confirm
// Step 2: verify OTP + set new password via service role

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { formatPakistaniPhone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { phone, otp, newPassword } = await req.json();
  if (!phone || !otp || !newPassword) {
    return NextResponse.json({ error: "Phone, OTP and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const normalized = formatPakistaniPhone(phone);
  if (!normalized) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  // Fetch OTP record
  const { data: record } = await supabase
    .from("password_reset_otps")
    .select("user_id, otp, expires_at")
    .eq("phone", normalized)
    .single() as { data: { user_id: string; otp: string; expires_at: string } | null; error: unknown };

  if (!record) {
    return NextResponse.json({ error: "No reset request found. Request a new code." }, { status: 400 });
  }

  if (new Date(record.expires_at) < new Date()) {
    await supabase.from("password_reset_otps").delete().eq("phone", normalized);
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (record.otp !== otp) {
    return NextResponse.json({ error: "Incorrect code. Try again." }, { status: 400 });
  }

  // Update password via admin API
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    record.user_id,
    { password: newPassword }
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Delete used OTP
  await supabase.from("password_reset_otps").delete().eq("phone", normalized);

  return NextResponse.json({ success: true });
}
