import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { PrintActions } from "../print-actions";

async function getVoucherData(id: string) {
  const supabase = await createServerSupabaseClient();

  const { data: v } = await supabase
    .from("fee_vouchers")
    .select(`
      *,
      students(name, father_name, roll_number, class_id, classes(name)),
      fee_types(name, frequency)
    `)
    .eq("id", id)
    .single();

  if (!v) return null;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("school_id").eq("id", user.id).single() as { data: { school_id: string } | null; error: unknown }
    : { data: null };

  const { data: school } = profile
    ? await supabase.from("schools").select("name, address, city, phone").eq("id", profile.school_id).single()
    : { data: null };

  return { voucher: v as any, school: school as any };
}

export default async function VoucherPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getVoucherData(id);
  if (!data) notFound();

  const { voucher: v, school } = data;
  const student = v.students;
  const className = student?.classes?.name ?? "—";
  const issuedDate = formatDate(v.created_at ?? new Date().toISOString());
  const dueDate = formatDate(v.due_date);
  const voucherRef = id.slice(0, 8).toUpperCase();
  const effStatus = v.status === "paid" ? "PAID" : new Date(v.due_date) < new Date() ? "OVERDUE" : "PENDING";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Fee Voucher — {student?.name}</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .page { max-width: 680px; margin: 0 auto; }
          .voucher { background: white; border: 2px solid #1B4332; border-radius: 8px; overflow: hidden; }
          .header { background: #1B4332; color: white; padding: 20px 24px; display: flex; align-items: center; gap: 16px; }
          .logo { width: 48px; height: 48px; background: #F59E0B; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: white; flex-shrink: 0; }
          .school-info { flex: 1; }
          .school-name { font-size: 18px; font-weight: bold; }
          .school-sub { font-size: 12px; opacity: 0.8; margin-top: 2px; }
          .voucher-title { text-align: right; }
          .voucher-title h2 { font-size: 16px; font-weight: bold; letter-spacing: 2px; }
          .voucher-title p { font-size: 11px; opacity: 0.8; margin-top: 2px; }
          .body { padding: 24px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
          .row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
          .label { font-size: 12px; color: #666; }
          .value { font-size: 13px; font-weight: 600; color: #111; }
          .amount-box { background: #1B4332; color: white; border-radius: 8px; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; margin: 20px 0; }
          .amount-label { font-size: 12px; opacity: 0.8; }
          .amount-value { font-size: 28px; font-weight: bold; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-overdue { background: #fee2e2; color: #991b1b; }
          .footer { background: #f9fafb; border-top: 1px dashed #ddd; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
          .footer-note { font-size: 11px; color: #888; }
          .ref { font-size: 11px; color: #888; font-family: monospace; }
          .divider { border: none; border-top: 1px dashed #ccc; margin: 16px 0; }
          .paid-stamp { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-20deg); font-size: 48px; font-weight: bold; color: rgba(6,95,70,0.15); border: 6px solid rgba(6,95,70,0.15); padding: 8px 16px; border-radius: 8px; white-space: nowrap; pointer-events: none; }
          .relative { position: relative; }
          @media print {
            body { background: white; padding: 0; }
            .voucher { border: 2px solid #1B4332; }
            .no-print { display: none !important; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Print button — hidden when printing */}
          <PrintActions />

          <div className="voucher">
            {/* Header */}
            <div className="header">
              <div className="logo">ع</div>
              <div className="school-info">
                <div className="school-name">{school?.name ?? "School"}</div>
                <div className="school-sub">
                  {[school?.address, school?.city].filter(Boolean).join(", ") || ""}
                  {school?.phone ? ` · ${school.phone}` : ""}
                </div>
              </div>
              <div className="voucher-title">
                <h2>FEE VOUCHER</h2>
                <p>Ref: {voucherRef}</p>
              </div>
            </div>

            {/* Body */}
            <div className="body">
              {/* Student info */}
              <div className="section">
                <div className="section-title">Student Details</div>
                <div className="row">
                  <span className="label">Student Name</span>
                  <span className="value">{student?.name ?? "—"}</span>
                </div>
                {student?.father_name && (
                  <div className="row">
                    <span className="label">Father's Name</span>
                    <span className="value">{student.father_name}</span>
                  </div>
                )}
                <div className="row">
                  <span className="label">Class</span>
                  <span className="value">{className}</span>
                </div>
                {student?.roll_number && (
                  <div className="row">
                    <span className="label">Roll Number</span>
                    <span className="value">{student.roll_number}</span>
                  </div>
                )}
              </div>

              {/* Fee details */}
              <div className="section">
                <div className="section-title">Fee Details</div>
                <div className="row">
                  <span className="label">Fee Type</span>
                  <span className="value">{v.fee_types?.name ?? "—"}</span>
                </div>
                <div className="row">
                  <span className="label">Issue Date</span>
                  <span className="value">{issuedDate}</span>
                </div>
                <div className="row">
                  <span className="label">Due Date</span>
                  <span className="value">{dueDate}</span>
                </div>
                <div className="row">
                  <span className="label">Status</span>
                  <span className={`status-badge status-${effStatus.toLowerCase()}`}>{effStatus}</span>
                </div>
              </div>

              {/* Amount */}
              <div className="amount-box">
                <div>
                  <div className="amount-label">Amount Due</div>
                  <div className="amount-value">Rs {Number(v.amount).toLocaleString()}</div>
                </div>
                {v.status === "paid" && v.paid_at && (
                  <div style={{ textAlign: "right", fontSize: "12px", opacity: 0.8 }}>
                    <div>Paid on</div>
                    <div style={{ fontWeight: "bold" }}>{formatDate(v.paid_at)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="footer">
              <div className="footer-note">
                Please pay before the due date to avoid any late fees.<br />
                Keep this voucher as proof of payment.
              </div>
              <div className="ref">#{voucherRef}</div>
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: "window.onload = () => window.print();" }} />
      </body>
    </html>
  );
}
