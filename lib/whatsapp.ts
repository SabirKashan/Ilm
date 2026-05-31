// ============================================================
// Unified WhatsApp client
// ============================================================
// Picks Meta Cloud API (preferred) or WATI (legacy fallback)
// based on what credentials the school has configured.
// All API routes should import from here instead of wati.ts or meta-whatsapp.ts directly.

import {
  metaSendAbsent,
  metaSendFeeReminder,
  metaSendAnnouncement,
  sendMetaSessionMessage,
  type MetaResult,
} from "./meta-whatsapp";

import {
  sendAbsentAlert,
  sendLateAlert,
  sendFeeVoucher,
  sendAnnouncement,
  sendFeeReminder,
  sendOverdueNotice,
  sendEnrollmentWelcome,
  sendHomework,
  sendMonthlyReport,
  sendDailySummary,
  sendBirthdayWish,
  sendMeritCertificate,
} from "./wati";

export type WaResult = { success: boolean; error?: string };

export type SchoolWaConfig = {
  // Meta Cloud API
  meta_phone_number_id?: string | null;
  meta_access_token?: string | null;
  whatsapp_provider?: string | null;
  // WATI (legacy)
  wati_endpoint?: string | null;
  wati_token?: string | null;
  // School name
  name?: string;
};

function usesMeta(cfg: SchoolWaConfig): boolean {
  return !!(cfg.whatsapp_provider === "meta" && cfg.meta_phone_number_id && cfg.meta_access_token);
}

function usesWati(cfg: SchoolWaConfig): boolean {
  return !!(cfg.wati_endpoint && cfg.wati_token);
}

export function isWhatsAppConfigured(cfg: SchoolWaConfig): boolean {
  return usesMeta(cfg) || usesWati(cfg);
}

// ── Absent alert ────────────────────────────────────────────
export async function waAbsent(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, date: string
): Promise<WaResult> {
  if (usesMeta(cfg)) {
    return metaSendAbsent(cfg.meta_phone_number_id!, cfg.meta_access_token!, parentPhone, studentName, date, cfg.name ?? "School");
  }
  if (usesWati(cfg)) {
    return sendAbsentAlert(parentPhone, studentName, date, cfg.wati_endpoint!, cfg.wati_token!);
  }
  return { success: false, error: "WhatsApp not configured" };
}

// ── Late alert (WATI only for now — Meta template not submitted yet) ─
export async function waLate(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, date: string
): Promise<WaResult> {
  if (usesWati(cfg)) {
    return sendLateAlert(parentPhone, studentName, date, cfg.wati_endpoint!, cfg.wati_token!);
  }
  // For Meta schools, reuse absent template until late template is approved
  if (usesMeta(cfg)) {
    return metaSendAbsent(cfg.meta_phone_number_id!, cfg.meta_access_token!, parentPhone, studentName, date, cfg.name ?? "School");
  }
  return { success: false, error: "WhatsApp not configured" };
}

// ── Fee reminder ─────────────────────────────────────────────
export async function waFeeReminder(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, feeType: string, amount: string,
  dueDate: string, daysLabel: string
): Promise<WaResult> {
  if (usesMeta(cfg)) {
    return metaSendFeeReminder(cfg.meta_phone_number_id!, cfg.meta_access_token!, parentPhone, studentName, amount, feeType, dueDate, cfg.name ?? "School");
  }
  if (usesWati(cfg)) {
    return sendFeeReminder(parentPhone, studentName, feeType, amount, dueDate, daysLabel, cfg.wati_endpoint!, cfg.wati_token!);
  }
  return { success: false, error: "WhatsApp not configured" };
}

// ── Fee overdue ──────────────────────────────────────────────
export async function waFeeOverdue(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, feeType: string, amount: string, daysOverdue: string
): Promise<WaResult> {
  if (usesMeta(cfg)) {
    // Reuse fee_reminder template with "overdue" note until dedicated template approved
    return metaSendFeeReminder(cfg.meta_phone_number_id!, cfg.meta_access_token!, parentPhone, studentName, amount, `${feeType} (OVERDUE - ${daysOverdue} days)`, "as soon as possible", cfg.name ?? "School");
  }
  if (usesWati(cfg)) {
    return sendOverdueNotice(parentPhone, studentName, feeType, amount, daysOverdue, cfg.wati_endpoint!, cfg.wati_token!);
  }
  return { success: false, error: "WhatsApp not configured" };
}

// ── Announcement ─────────────────────────────────────────────
export async function waAnnouncement(
  cfg: SchoolWaConfig, parentPhone: string,
  title: string, message: string
): Promise<WaResult> {
  if (usesMeta(cfg)) {
    return metaSendAnnouncement(cfg.meta_phone_number_id!, cfg.meta_access_token!, parentPhone, title, message, cfg.name ?? "School");
  }
  if (usesWati(cfg)) {
    return sendAnnouncement(parentPhone, title, message, cfg.wati_endpoint!, cfg.wati_token!);
  }
  return { success: false, error: "WhatsApp not configured" };
}

// ── Session reply (inbox) ─────────────────────────────────────
export async function waSessionReply(
  cfg: SchoolWaConfig, toPhone: string, text: string
): Promise<WaResult> {
  if (usesMeta(cfg)) {
    return sendMetaSessionMessage(cfg.meta_phone_number_id!, cfg.meta_access_token!, toPhone, text);
  }
  // WATI session reply handled separately in the existing route
  return { success: false, error: "Meta not configured for session replies" };
}

// ── WATI-only features (until Meta templates approved) ────────
// These fall through gracefully if not configured
export async function waFeeVoucher(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, feeType: string, amount: string, dueDate: string
): Promise<WaResult> {
  if (usesWati(cfg)) return sendFeeVoucher(parentPhone, studentName, feeType, amount, dueDate, cfg.wati_endpoint!, cfg.wati_token!);
  return { success: false, error: "WhatsApp not configured" };
}

export async function waHomework(
  cfg: SchoolWaConfig, parentPhone: string,
  className: string, subject: string, details: string, dueDate: string
): Promise<WaResult> {
  if (usesWati(cfg)) return sendHomework(parentPhone, className, subject, details, dueDate, cfg.name ?? "School", cfg.wati_endpoint!, cfg.wati_token!);
  return { success: false, error: "WhatsApp not configured" };
}

export async function waEnrollmentWelcome(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, className: string
): Promise<WaResult> {
  if (usesWati(cfg)) return sendEnrollmentWelcome(parentPhone, studentName, className, cfg.name ?? "School", cfg.wati_endpoint!, cfg.wati_token!);
  return { success: false, error: "WhatsApp not configured" };
}

export async function waMonthlyReport(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, month: string, attendancePct: string,
  lastGrade: string, feeStatus: string
): Promise<WaResult> {
  if (usesWati(cfg)) return sendMonthlyReport(parentPhone, studentName, month, attendancePct, lastGrade, feeStatus, cfg.name ?? "School", cfg.wati_endpoint!, cfg.wati_token!);
  return { success: false, error: "WhatsApp not configured" };
}

export async function waDailySummary(
  cfg: SchoolWaConfig, adminPhone: string,
  date: string, present: string, absent: string, late: string, outstanding: string
): Promise<WaResult> {
  if (usesWati(cfg)) return sendDailySummary(adminPhone, cfg.name ?? "School", date, present, absent, late, outstanding, cfg.wati_endpoint!, cfg.wati_token!);
  return { success: false, error: "WhatsApp not configured" };
}

export async function waBirthday(
  cfg: SchoolWaConfig, parentPhone: string, studentName: string
): Promise<WaResult> {
  if (usesWati(cfg)) return sendBirthdayWish(parentPhone, studentName, cfg.name ?? "School", cfg.wati_endpoint!, cfg.wati_token!);
  return { success: false, error: "WhatsApp not configured" };
}

export async function waMeritCertificate(
  cfg: SchoolWaConfig, parentPhone: string,
  studentName: string, examName: string, percentage: string, grade: string
): Promise<WaResult> {
  if (usesWati(cfg)) return sendMeritCertificate(parentPhone, studentName, examName, percentage, grade, cfg.name ?? "School", cfg.wati_endpoint!, cfg.wati_token!);
  return { success: false, error: "WhatsApp not configured" };
}
