// ============================================================
// Meta WhatsApp Cloud API client
// ============================================================
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
// How to get credentials (per school):
//  1. Go to developers.facebook.com → My Apps → Create App → Business
//  2. Add WhatsApp product
//  3. Go to WhatsApp → API Setup
//  4. Copy Phone Number ID and generate a permanent access token
//     via System User (Business Settings → System Users → Generate Token)
//  5. Paste both into MyRahbar Settings → WhatsApp Setup
//
// Template names we use (submit ONE at a time, spaced days apart):
//  - myrahbar_absent          : attendance absent alert
//  - myrahbar_fee_reminder    : fee due soon
//  - myrahbar_announcement    : school announcement
//  (Add more only after these 3 are approved)
// ============================================================

const GRAPH = "https://graph.facebook.com/v18.0";

export type MetaResult = { success: boolean; error?: string; messageId?: string };

function normalize(phone: string): string {
  // Meta expects E.164 without leading + e.g. 923001234567
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("92")) return clean;
  if (clean.startsWith("0")) return `92${clean.slice(1)}`;
  return clean;
}

// ── Core send function ────────────────────────────────────────
export async function sendMetaTemplate(
  phoneNumberId: string,
  accessToken: string,
  toPhone: string,
  templateName: string,
  languageCode: string = "en",
  components: object[] = []
): Promise<MetaResult> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalize(toPhone),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });

    const json = await res.json() as any;
    if (!res.ok) {
      return { success: false, error: json?.error?.message ?? "Unknown Meta API error" };
    }
    return { success: true, messageId: json?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── Session message (freeform, within 24h of parent reply) ───
export async function sendMetaSessionMessage(
  phoneNumberId: string,
  accessToken: string,
  toPhone: string,
  text: string
): Promise<MetaResult> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalize(toPhone),
        type: "text",
        text: { body: text },
      }),
    });
    const json = await res.json() as any;
    if (!res.ok) return { success: false, error: json?.error?.message };
    return { success: true, messageId: json?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── Submit a template for Meta approval ──────────────────────
// Call this from the Settings page — ONE template at a time.
export async function submitMetaTemplate(
  wabaId: string,
  accessToken: string,
  template: {
    name: string;
    language: string;
    category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
    components: object[];
  }
): Promise<{ success: boolean; id?: string; status?: string; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(template),
    });
    const json = await res.json() as any;
    if (!res.ok) return { success: false, error: json?.error?.message };
    return { success: true, id: json.id, status: json.status };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── Check template status ─────────────────────────────────────
export async function getMetaTemplates(
  wabaId: string,
  accessToken: string
): Promise<{ success: boolean; templates?: any[]; error?: string }> {
  try {
    const res = await fetch(
      `${GRAPH}/${wabaId}/message_templates?fields=name,status,category,language`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json = await res.json() as any;
    if (!res.ok) return { success: false, error: json?.error?.message };
    return { success: true, templates: json.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── Named wrappers (3 starter templates) ─────────────────────

// Template: myrahbar_absent
// Body: "Dear parent, {{1}} was marked *Absent* today ({{2}}) at {{3}}. Please contact the school if needed."
// Params: [studentName, date, schoolName]
export function metaSendAbsent(
  phoneNumberId: string, accessToken: string,
  parentPhone: string, studentName: string, date: string, schoolName: string
): Promise<MetaResult> {
  return sendMetaTemplate(phoneNumberId, accessToken, parentPhone, "myrahbar_absent", "en", [{
    type: "body",
    parameters: [
      { type: "text", text: studentName },
      { type: "text", text: date },
      { type: "text", text: schoolName },
    ],
  }]);
}

// Template: myrahbar_fee_reminder
// Body: "Dear parent, {{1}}'s fee of *Rs {{2}}* ({{3}}) is due on {{4}}. Please pay at your earliest. - {{5}}"
// Params: [studentName, amount, feeType, dueDate, schoolName]
export function metaSendFeeReminder(
  phoneNumberId: string, accessToken: string,
  parentPhone: string, studentName: string, amount: string,
  feeType: string, dueDate: string, schoolName: string
): Promise<MetaResult> {
  return sendMetaTemplate(phoneNumberId, accessToken, parentPhone, "myrahbar_fee_reminder", "en", [{
    type: "body",
    parameters: [
      { type: "text", text: studentName },
      { type: "text", text: amount },
      { type: "text", text: feeType },
      { type: "text", text: dueDate },
      { type: "text", text: schoolName },
    ],
  }]);
}

// Template: myrahbar_announcement
// Body: "📢 *{{1}}*\n\n{{2}}\n\n— {{3}}"
// Params: [title, message, schoolName]
export function metaSendAnnouncement(
  phoneNumberId: string, accessToken: string,
  parentPhone: string, title: string, message: string, schoolName: string
): Promise<MetaResult> {
  return sendMetaTemplate(phoneNumberId, accessToken, parentPhone, "myrahbar_announcement", "en", [{
    type: "body",
    parameters: [
      { type: "text", text: title },
      { type: "text", text: message },
      { type: "text", text: schoolName },
    ],
  }]);
}

// ── The 3 starter templates to submit to Meta ─────────────────
// Copy these exact body texts when submitting templates in Meta Business Manager.
// Submit ONE, wait for approval (usually 24-48h), then submit the next.
export const STARTER_TEMPLATES = [
  {
    name: "myrahbar_absent",
    category: "UTILITY" as const,
    language: "en",
    submitFirst: true,
    bodyText: "Dear parent, {{1}} was marked *Absent* today ({{2}}) at {{3}}. Please contact the school if needed.",
    components: [{
      type: "BODY",
      text: "Dear parent, {{1}} was marked *Absent* today ({{2}}) at {{3}}. Please contact the school if needed.",
    }],
  },
  {
    name: "myrahbar_fee_reminder",
    category: "UTILITY" as const,
    language: "en",
    submitFirst: false,
    bodyText: "Dear parent, {{1}}'s fee of Rs {{2}} ({{3}}) is due on {{4}}. Please pay at your earliest. - {{5}}",
    components: [{
      type: "BODY",
      text: "Dear parent, {{1}}'s fee of Rs {{2}} ({{3}}) is due on {{4}}. Please pay at your earliest. - {{5}}",
    }],
  },
  {
    name: "myrahbar_announcement",
    category: "UTILITY" as const,
    language: "en",
    submitFirst: false,
    bodyText: "📢 {{1}}\n\n{{2}}\n\n— {{3}}",
    components: [{
      type: "BODY",
      text: "📢 {{1}}\n\n{{2}}\n\n— {{3}}",
    }],
  },
];
