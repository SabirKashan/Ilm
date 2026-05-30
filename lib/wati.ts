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
