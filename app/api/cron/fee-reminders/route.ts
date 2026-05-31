import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import {
  sendFeeReminder,
  sendOverdueNotice,
  sendFeeEscalation2,
  sendFeeMeetPrincipal,
  sendDefaulterAlert,
} from "@/lib/wati";
import { formatPKR } from "@/lib/utils";

// ============================================================
// Fee Escalation Ladder — runs daily at 10:00 AM PKT (05:00 UTC)
// ============================================================
// Escalation levels per overdue voucher:
//  Level 0 → 1  : first day overdue          → gentle reminder
//  Level 1 → 2  : 7+ days overdue            → firm notice
//  Level 2 → 3  : 15+ days overdue           → "please meet the principal"
//  Level 3 → 4  : 30+ days overdue           → admin WhatsApp alert
//  Level 4      : already fully escalated    → skip
//
// Pre-due reminders (unchanged):
//  due in 7 days → reminder
//  due tomorrow  → reminder
// ============================================================

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const today = new Date().toISOString().split("T")[0];
  const d7 = offsetDate(today,  7);
  const d1 = offsetDate(today,  1);

  let totalSent = 0;
  const results: Record<string, number> = {};

  // ── Pre-due reminders ─────────────────────────────────────
  const { data: upcoming } = await supabase
    .from("fee_vouchers")
    .select(`id, amount, due_date, school_id,
      students(name, parent_phone),
      fee_types(name),
      schools(name, wati_endpoint, wati_token)`)
    .in("status", ["pending"])
    .in("due_date", [d7, d1]) as { data: any[] | null; error: unknown };

  for (const v of upcoming ?? []) {
    const { endpoint, token, phone, name, feeType, amount } = extract(v);
    if (!endpoint || !token || !phone) continue;
    const daysLabel = v.due_date === d7 ? "7 days" : "tomorrow";
    const result = await sendFeeReminder(phone, name, feeType, amount, v.due_date, daysLabel, endpoint, token);
    if (result.success) {
      totalSent++;
      results["pre_due"] = (results["pre_due"] ?? 0) + 1;
      await logWhatsapp(supabase, v.school_id, phone, "ilm_fee_reminder");
    }
  }

  // ── Escalation for overdue vouchers ───────────────────────
  const { data: overdue } = await supabase
    .from("fee_vouchers")
    .select(`id, amount, due_date, status, escalation_level, school_id,
      students(name, parent_phone),
      fee_types(name),
      schools(name, phone, wati_endpoint, wati_token)`)
    .in("status", ["pending", "overdue"])
    .lt("due_date", today)
    .lt("escalation_level", 4)
    .order("due_date") as { data: any[] | null; error: unknown };

  // Group level-4 (30d+) by school to send one admin alert per school
  const level4BySchool: Record<string, { vouchers: any[]; school: any }> = {};

  for (const v of overdue ?? []) {
    const daysOverdue = daysBetween(v.due_date, today);
    const currentLevel: number = v.escalation_level ?? 0;
    const { endpoint, token, phone, name, feeType, amount, school } = extract(v);

    let nextLevel: number | null = null;

    if (daysOverdue >= 30 && currentLevel < 4) {
      if (!level4BySchool[v.school_id]) {
        level4BySchool[v.school_id] = { vouchers: [], school: v.schools };
      }
      level4BySchool[v.school_id].vouchers.push(v);
      nextLevel = 4;
    } else if (daysOverdue >= 15 && currentLevel < 3) {
      if (endpoint && token && phone) {
        const result = await sendFeeMeetPrincipal(phone, name, feeType, amount, school, endpoint, token);
        if (result.success) {
          await logWhatsapp(supabase, v.school_id, phone, "ilm_fee_meet_principal");
          totalSent++;
          results["level3"] = (results["level3"] ?? 0) + 1;
        }
        nextLevel = 3;
      }
    } else if (daysOverdue >= 7 && currentLevel < 2) {
      if (endpoint && token && phone) {
        const result = await sendFeeEscalation2(phone, name, feeType, amount, String(daysOverdue), school, endpoint, token);
        if (result.success) {
          await logWhatsapp(supabase, v.school_id, phone, "ilm_fee_escalation_firm");
          totalSent++;
          results["level2"] = (results["level2"] ?? 0) + 1;
        }
        nextLevel = 2;
      }
    } else if (daysOverdue >= 1 && currentLevel < 1) {
      if (endpoint && token && phone) {
        const result = await sendOverdueNotice(phone, name, feeType, amount, String(daysOverdue), endpoint, token);
        if (result.success) {
          await logWhatsapp(supabase, v.school_id, phone, "ilm_fee_overdue");
          totalSent++;
          results["level1"] = (results["level1"] ?? 0) + 1;
        }
        nextLevel = 1;
      }
    }

    if (nextLevel !== null) {
      await supabase
        .from("fee_vouchers")
        .update({ escalation_level: nextLevel, status: "overdue" })
        .eq("id", v.id);
    }
  }

  // ── Send one admin alert per school (level 4) ─────────────
  for (const [schoolId, { vouchers, school }] of Object.entries(level4BySchool)) {
    const endpoint   = school?.wati_endpoint;
    const token      = school?.wati_token;
    const adminPhone = school?.phone;
    if (!endpoint || !token || !adminPhone) continue;
    const totalOwed = vouchers.reduce((s: number, v: any) => s + Number(v.amount), 0);
    const result = await sendDefaulterAlert(
      adminPhone, school.name, String(vouchers.length), formatPKR(totalOwed), today, endpoint, token
    );
    if (result.success) {
      await logWhatsapp(supabase, schoolId, adminPhone, "ilm_fee_defaulter_alert");
      totalSent++;
      results["level4_admin_alerts"] = (results["level4_admin_alerts"] ?? 0) + 1;
    }
  }

  return NextResponse.json({ sent: totalSent, breakdown: results });
}

function extract(v: any) {
  return {
    endpoint: v.schools?.wati_endpoint as string | null,
    token:    v.schools?.wati_token    as string | null,
    phone:    v.students?.parent_phone as string | null,
    name:     (v.students?.name     ?? "Student") as string,
    feeType:  (v.fee_types?.name    ?? "Fee")     as string,
    amount:   `Rs ${Number(v.amount).toLocaleString()}`,
    school:   (v.schools?.name      ?? "School")  as string,
  };
}

async function logWhatsapp(supabase: any, schoolId: string, phone: string, template: string) {
  await supabase.from("whatsapp_logs").insert({ school_id: schoolId, phone, template_name: template, status: "sent" });
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysBetween(pastDate: string, today: string): number {
  return Math.floor((new Date(today).getTime() - new Date(pastDate).getTime()) / 86400000);
}
