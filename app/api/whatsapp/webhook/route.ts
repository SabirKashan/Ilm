// POST /api/whatsapp/webhook
// Handles incoming messages from BOTH Meta Cloud API and WATI.
//
// Meta: set webhook URL in Meta Developer Console → WhatsApp → Configuration
//   URL: https://myrahbar.com/api/whatsapp/webhook
//   Verify Token: set WHATSAPP_VERIFY_TOKEN env var, paste same value in Meta
//   Subscribe to: messages
//
// WATI: set webhook URL in WATI dashboard → Settings → Webhook

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

// ── Meta webhook verification (GET) ──────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: true, service: "myrahbar-whatsapp-webhook" });
}

// ── Incoming message (POST) ───────────────────────────────────
export async function POST(req: NextRequest) {
  // Optional token check (works for both WATI and Meta custom header)
  const webhookToken = process.env.WATI_WEBHOOK_TOKEN;
  if (webhookToken) {
    const incoming = req.headers.get("x-wati-token") ?? req.headers.get("authorization");
    if (incoming && incoming !== webhookToken && incoming !== `Bearer ${webhookToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  // Detect and parse Meta vs WATI format
  const messages = parseMessages(payload);
  if (messages.length === 0) return NextResponse.json({ ok: true });

  const supabase = createServiceSupabaseClient();

  for (const msg of messages) {
    // Dedup
    if (msg.watiMsgId) {
      const { data: existing } = await supabase
        .from("whatsapp_messages").select("id")
        .eq("wati_msg_id", msg.watiMsgId).single();
      if (existing) continue;
    }

    // Match school via parent phone
    const { data: student } = await supabase
      .from("students").select("school_id, name")
      .eq("parent_phone", msg.phone).limit(1).single() as
      { data: { school_id: string; name: string } | null; error: unknown };

    await supabase.from("whatsapp_messages").insert({
      school_id:    student?.school_id ?? null,
      phone:        msg.phone,
      direction:    "inbound",
      body:         msg.body,
      wati_msg_id:  msg.watiMsgId ?? null,
      student_name: student?.name ?? null,
      read_at:      null,
    });
  }

  return NextResponse.json({ ok: true });
}

// ── Message parsers ──────────────────────────────────────────
type ParsedMsg = { phone: string; body: string; watiMsgId?: string };

function parseMessages(payload: any): ParsedMsg[] {
  // ── Meta Cloud API format ────────────────────────────────
  if (payload?.object === "whatsapp_business_account") {
    const msgs: ParsedMsg[] = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        for (const msg of change?.value?.messages ?? []) {
          if (msg.type !== "text" || !msg.text?.body) continue;
          const rawPhone = msg.from ?? "";
          const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
          msgs.push({ phone, body: msg.text.body, watiMsgId: msg.id });
        }
      }
    }
    return msgs;
  }

  // ── WATI format ──────────────────────────────────────────
  const watiMsgId = payload?.id ?? payload?.messageId ?? null;
  const rawPhone  = payload?.whatsappNumber ?? payload?.waId ?? payload?.from ?? "";
  const body      = payload?.text?.body ?? payload?.body ?? payload?.message ?? "";
  const msgType   = payload?.type ?? "text";
  if (msgType !== "text" || !rawPhone || !body) return [];
  const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
  return [{ phone, body: body.trim(), watiMsgId }];
}
