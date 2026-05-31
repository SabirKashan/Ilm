// POST /api/whatsapp/webhook
// ─────────────────────────────────────────────────────────────
// WATI calls this URL when a parent replies to any WhatsApp message.
// Configure in WATI dashboard → Settings → Webhook → set URL to:
//   https://nexaab.com/api/whatsapp/webhook
// Optionally set a webhook token in WATI and match it with WATI_WEBHOOK_TOKEN env.
//
// WATI payload shape (simplified):
// {
//   "id": "wamid.xxx",
//   "whatsappNumber": "923001234567",
//   "text": { "body": "message text" },
//   "type": "text"
// }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  // Optional webhook token verification
  const webhookToken = process.env.WATI_WEBHOOK_TOKEN;
  if (webhookToken) {
    const incoming = req.headers.get("x-wati-token") ?? req.headers.get("authorization");
    if (incoming !== webhookToken && incoming !== `Bearer ${webhookToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // always 200 to WATI
  }

  // WATI sends different shapes depending on message type — handle both
  const watiMsgId = payload.id ?? payload.messageId ?? null;
  const rawPhone  = payload.whatsappNumber ?? payload.waId ?? payload.from ?? "";
  const body      = payload.text?.body ?? payload.body ?? payload.message ?? "";
  const msgType   = payload.type ?? "text";

  // Only process text messages
  if (msgType !== "text" || !rawPhone || !body) {
    return NextResponse.json({ ok: true });
  }

  // Normalise to E.164
  const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

  const supabase = createServiceSupabaseClient();

  // Deduplicate by wati_msg_id
  if (watiMsgId) {
    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("wati_msg_id", watiMsgId)
      .single();
    if (existing) return NextResponse.json({ ok: true, duplicate: true });
  }

  // Look up which school this parent belongs to
  const { data: student } = await supabase
    .from("students")
    .select("school_id, name")
    .eq("parent_phone", phone)
    .limit(1)
    .single() as { data: { school_id: string; name: string } | null; error: unknown };

  await supabase.from("whatsapp_messages").insert({
    school_id:    student?.school_id ?? null,
    phone,
    direction:    "inbound",
    body:         body.trim(),
    wati_msg_id:  watiMsgId ?? null,
    student_name: student?.name ?? null,
    read_at:      null,
  });

  return NextResponse.json({ ok: true });
}

// WATI also sends GET requests to verify the webhook endpoint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get("hub.challenge") ?? searchParams.get("challenge");
  if (challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ ok: true, service: "ilm-whatsapp-webhook" });
}
