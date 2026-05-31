// POST /api/whatsapp/reply
// Admin sends a freeform reply to a parent — uses Meta or WATI depending on school config.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { sendMetaSessionMessage } from "@/lib/meta-whatsapp";
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
  const { data: school } = await supabase
    .from("schools")
    .select("name, whatsapp_provider, meta_phone_number_id, meta_access_token, wati_endpoint, wati_token")
    .eq("id", profile.school_id)
    .single() as { data: any | null; error: unknown };

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  let result: { success: boolean; error?: string };

  // ── Meta ─────────────────────────────────────────────────
  if (school.whatsapp_provider === "meta" && school.meta_phone_number_id && school.meta_access_token) {
    result = await sendMetaSessionMessage(school.meta_phone_number_id, school.meta_access_token, phone, message.trim());
    if (!result.success) {
      return NextResponse.json({
        error: result.error?.includes("session") || result.error?.includes("24")
          ? "Session expired. Parent must message you first within 24 hours."
          : result.error,
      }, { status: 400 });
    }
  }
  // ── WATI ─────────────────────────────────────────────────
  else if (school.wati_endpoint && school.wati_token) {
    const number = phone.startsWith("+") ? phone.slice(1) : phone;
    const res = await fetch(
      `${school.wati_endpoint.replace(/\/$/, "")}/api/v1/sendSessionMessage/${number}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${school.wati_token}` },
        body: JSON.stringify({ messageText: message.trim() }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({
        error: err.includes("session")
          ? "Session expired. Parent must message you first within 24 hours."
          : err,
      }, { status: 400 });
    }
    result = { success: true };
  } else {
    return NextResponse.json({ error: "WhatsApp not configured. Set up Meta API or WATI in Settings." }, { status: 400 });
  }

  // Store outbound
  await supabase.from("whatsapp_messages").insert({
    school_id: profile.school_id, phone, direction: "outbound",
    body: message.trim(), wati_msg_id: null, read_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
