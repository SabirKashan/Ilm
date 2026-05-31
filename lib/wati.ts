// WATI WhatsApp Business API client

export type WatiResult = { success: boolean; error?: string };

function normalizePhone(phone: string): string {
  // WATI expects phone without leading +, e.g. 923001234567
  return phone.startsWith("+") ? phone.slice(1) : phone;
}

export async function sendWatiTemplate(
  phone: string,
  templateName: string,
  parameters: string[],
  endpoint: string,
  token: string
): Promise<WatiResult> {
  try {
    const number = normalizePhone(phone);
    const res = await fetch(
      `${endpoint.replace(/\/$/, "")}/api/v1/sendTemplateMessage?whatsappNumber=${number}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          template_name: templateName,
          broadcast_name: templateName,
          parameters: parameters.map((value) => ({ name: "body", value })),
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// Convenience wrappers for each notification type

export function sendAbsentAlert(
  parentPhone: string,
  studentName: string,
  date: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_attendance_absent",
    [studentName, date],
    endpoint,
    token
  );
}

export function sendLateAlert(
  parentPhone: string,
  studentName: string,
  date: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_attendance_late",
    [studentName, date],
    endpoint,
    token
  );
}

export function sendFeeVoucher(
  parentPhone: string,
  studentName: string,
  feeType: string,
  amount: string,
  dueDate: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_fee_voucher",
    [studentName, feeType, amount, dueDate],
    endpoint,
    token
  );
}

export function sendAnnouncement(
  parentPhone: string,
  title: string,
  message: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_announcement",
    [title, message],
    endpoint,
    token
  );
}

export function sendFeeReminder(
  parentPhone: string,
  studentName: string,
  feeType: string,
  amount: string,
  dueDate: string,
  daysLabel: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_fee_reminder",
    [studentName, feeType, amount, dueDate, daysLabel],
    endpoint,
    token
  );
}

export function sendOverdueNotice(
  parentPhone: string,
  studentName: string,
  feeType: string,
  amount: string,
  daysOverdue: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_fee_overdue",
    [studentName, feeType, amount, daysOverdue],
    endpoint,
    token
  );
}

export function sendBirthdayWish(
  parentPhone: string,
  studentName: string,
  schoolName: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_birthday",
    [studentName, schoolName],
    endpoint,
    token
  );
}

export function sendMeritCertificate(
  parentPhone: string,
  studentName: string,
  examName: string,
  percentage: string,
  grade: string,
  schoolName: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_merit_certificate",
    [studentName, examName, percentage, grade, schoolName],
    endpoint,
    token
  );
}

export function sendDailySummary(
  adminPhone: string,
  schoolName: string,
  date: string,
  present: string,
  absent: string,
  late: string,
  outstanding: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    adminPhone,
    "ilm_daily_summary",
    [schoolName, date, present, absent, late, outstanding],
    endpoint,
    token
  );
}

// ── Fee escalation ladder ─────────────────────────────────────────────

// Level 2: firm notice (7+ days overdue). params: [studentName, feeType, amount, daysOverdue, schoolName]
export function sendFeeEscalation2(
  parentPhone: string, studentName: string, feeType: string, amount: string, daysOverdue: string,
  schoolName: string, endpoint: string, token: string
): Promise<WatiResult> {
  return sendWatiTemplate(parentPhone, "ilm_fee_escalation_firm",
    [studentName, feeType, amount, daysOverdue, schoolName], endpoint, token);
}

// Level 3: meet principal (15+ days overdue). params: [studentName, feeType, amount, schoolName]
export function sendFeeMeetPrincipal(
  parentPhone: string, studentName: string, feeType: string, amount: string,
  schoolName: string, endpoint: string, token: string
): Promise<WatiResult> {
  return sendWatiTemplate(parentPhone, "ilm_fee_meet_principal",
    [studentName, feeType, amount, schoolName], endpoint, token);
}

// Level 4: admin summary of 30-day+ defaulters. params: [schoolName, defaulterCount, totalAmount, date]
export function sendDefaulterAlert(
  adminPhone: string, schoolName: string, defaulterCount: string, totalAmount: string,
  date: string, endpoint: string, token: string
): Promise<WatiResult> {
  return sendWatiTemplate(adminPhone, "ilm_fee_defaulter_alert",
    [schoolName, defaulterCount, totalAmount, date], endpoint, token);
}

// Sent once when a student is first enrolled (onboarding or manual add)
// Template params: [studentName, className, schoolName]
export function sendEnrollmentWelcome(
  parentPhone: string,
  studentName: string,
  className: string,
  schoolName: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_enrollment_welcome",
    [studentName, className, schoolName],
    endpoint,
    token
  );
}

// Sent to parents when a teacher posts homework / daily diary.
// Template params: [className, subjectOrTitle, details, dueDate, schoolName]
export function sendHomework(
  parentPhone: string,
  className: string,
  subjectOrTitle: string,
  details: string,
  dueDate: string,
  schoolName: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_homework",
    [className, subjectOrTitle, details, dueDate, schoolName],
    endpoint,
    token
  );
}

export function sendMonthlyReport(
  parentPhone: string,
  studentName: string,
  month: string,
  attendancePct: string,
  lastGrade: string,
  feeStatus: string,
  schoolName: string,
  endpoint: string,
  token: string
): Promise<WatiResult> {
  return sendWatiTemplate(
    parentPhone,
    "ilm_monthly_report",
    [studentName, month, attendancePct, lastGrade, feeStatus, schoolName],
    endpoint,
    token
  );
}
