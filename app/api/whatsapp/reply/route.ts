// POST /api/whatsapp/reply
// Admin sends a freeform reply to a parent from the inbox.
// Uses WATI's "sendSessionMessage" endpoint (valid within 24h window).

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
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
    .from("users").select("school_id, role").eq("id", user.id).single() as
    { data: { school_id: string; role: string } | null; error: unknown };

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { phone, message } = await req.json();
  if (!phone || !message?.trim()) {
    return NextResponse.json({ error: "phone and message required" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  // Get school WATI credentials
  const { data: school } = await supabase
    .from("schools")
    .select("wati_endpoint, wati_token")
    .eq("id", profile.school_id)
    .single() as { data: { wati_endpoint: string | null; wati_token: string | null } | null; error: unknown };

  if (!school?.wati_endpoint || !school?.wati_token) {
    return NextResponse.json({ error: "WATI not configured. Add credentials in Settings." }, { status: 400 });
  }

  // WATI session message (free-form text, valid within 24h of last inbound)
  const number = phone.startsWith("+") ? phone.slice(1) : phone;
  const res = await fetch(
    `${school.wati_endpoint.replace(/\/$/, "")}/api/v1/sendSessionMessage/${number}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${school.wati_token}`,
      },
      body: JSON.stringify({ messageText: message.trim() }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    // WATI session expired (>24h since last inbound) — tell admin
    if (err.includes("session") || res.status === 400) {
      return NextResponse.json({
        error: "Session expired. Parent must message you first within the last 24 hours for free-text replies.",
        watiError: err,
      }, { status: 400 });
    }
    return NextResponse.json({ error: err }, { status: 500 });
  }

  // Store outbound message
  await supabase.from("whatsapp_messages").insert({
    school_id:   profile.school_id,
    phone,
    direction:   "outbound",
    body:        message.trim(),
    wati_msg_id: null,
    read_at:     new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
