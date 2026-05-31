// POST /api/auth/reset-password
// Step 1 of forgot-password: look up the user's school WATI credentials,
// generate a 6-digit OTP, store it in password_reset_otps table (5 min TTL),
// and send it via WhatsApp.
// Falls back to "no WATI" message if school hasn't configured it.

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendWatiTemplate } from "@/lib/wati";
import { formatPakistaniPhone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

  const normalized = formatPakistaniPhone(phone);
  if (!normalized) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  // Look up user + school
  const { data: user } = await supabase
    .from("users")
    .select("id, name, school_id, schools(wati_endpoint, wati_token)")
    .eq("phone", normalized)
    .single() as { data: any; error: unknown };

  // Always return success to prevent phone enumeration
  if (!user) return NextResponse.json({ sent: true, wati: false });

  const endpoint = user.schools?.wati_endpoint;
  const token    = user.schools?.wati_token;

  if (!endpoint || !token) {
    // No WATI — tell the client to show "contact admin" message
    return NextResponse.json({ sent: false, wati: false });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  // Upsert OTP (one active OTP per user at a time)
  await supabase.from("password_reset_otps").upsert({
    user_id: user.id,
    phone: normalized,
    otp,
    expires_at: expiresAt,
  }, { onConflict: "user_id" });

  // Send via WhatsApp
  await sendWatiTemplate(
    normalized,
    "ilm_password_reset",
    [user.name?.split(" ")[0] ?? "User", otp],
    endpoint,
    token
  );

  return NextResponse.json({ sent: true, wati: true });
}
