import type { Metadata } from "next";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { AutoPrint, PrintButtons } from "./print-page-client";

async function getVoucherData(id: string) {
  const supabase = createServiceSupabaseClient();

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

  const { data: school } = await supabase
    .from("schools")
    .select("name, address, city, phone")
    .eq("id", (v as any).school_id)
    .single();

  return { voucher: v as any, school: school as any };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getVoucherData(id);
  const name = data?.voucher?.students?.name ?? "Student";
  return { title: `Fee Voucher — ${name}` };
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

  const statusColors: Record<string, { bg: string; color: string }> = {
    PAID:    { bg: "#d1fae5", color: "#065f46" },
    PENDING: { bg: "#fef3c7", color: "#92400e" },
    OVERDUE: { bg: "#fee2e2", color: "#991b1b" },
  };
  const sc = statusColors[effStatus];

  return (
    <>
      {/* Global styles scoped to this page */}
      <style>{`
        body { background: #f5f5f5 !important; }
        .voucher-page * { box-sizing: border-box; }
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .voucher-page { padding: 0 !important; }
          .voucher-wrap { box-shadow: none !important; }
        }
      `}</style>

      <AutoPrint />
      <PrintButtons />

      <div
        className="voucher-page"
        style={{
          fontFamily: "Arial, sans-serif",
          padding: "20px",
          minHeight: "100vh",
          background: "#f5f5f5",
        }}
      >
        <div style={{ maxWidth: 680, margin: "48px auto 0" }}>
          <div
            className="voucher-wrap"
            style={{
              background: "white",
              border: "2px solid #1B4332",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#1B4332",
                color: "white",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: "#F59E0B",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "white",
                  flexShrink: 0,
                }}
              >
                ع
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: "bold" }}>{school?.name ?? "School"}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  {[school?.address, school?.city].filter(Boolean).join(", ") || ""}
                  {school?.phone ? ` · ${school.phone}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: "bold", letterSpacing: 2 }}>FEE VOUCHER</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>Ref: {voucherRef}</div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 24 }}>
              {/* Student Details */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#666",
                    marginBottom: 10,
                    borderBottom: "1px solid #eee",
                    paddingBottom: 6,
                  }}
                >
                  Student Details
                </div>
                <Row label="Student Name" value={student?.name ?? "—"} />
                {student?.father_name && <Row label="Father's Name" value={student.father_name} />}
                <Row label="Class" value={className} />
                {student?.roll_number && <Row label="Roll Number" value={student.roll_number} />}
              </div>

              {/* Fee Details */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#666",
                    marginBottom: 10,
                    borderBottom: "1px solid #eee",
                    paddingBottom: 6,
                  }}
                >
                  Fee Details
                </div>
                <Row label="Fee Type" value={v.fee_types?.name ?? "—"} />
                <Row label="Issue Date" value={issuedDate} />
                <Row label="Due Date" value={dueDate} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                  <span style={{ fontSize: 12, color: "#666" }}>Status</span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: "bold",
                      background: sc.bg,
                      color: sc.color,
                    }}
                  >
                    {effStatus}
                  </span>
                </div>
              </div>

              {/* Amount Box */}
              <div
                style={{
                  background: "#1B4332",
                  color: "white",
                  borderRadius: 8,
                  padding: "16px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  margin: "20px 0",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Amount Due</div>
                  <div style={{ fontSize: 28, fontWeight: "bold" }}>
                    Rs {Number(v.amount).toLocaleString()}
                  </div>
                </div>
                {v.status === "paid" && v.paid_at && (
                  <div style={{ textAlign: "right", fontSize: 12, opacity: 0.8 }}>
                    <div>Paid on</div>
                    <div style={{ fontWeight: "bold" }}>{formatDate(v.paid_at)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                background: "#f9fafb",
                borderTop: "1px dashed #ddd",
                padding: "16px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6 }}>
                Please pay before the due date to avoid any late fees.<br />
                Keep this voucher as proof of payment.
              </div>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>#{voucherRef}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
      <span style={{ fontSize: 12, color: "#666" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{value}</span>
    </div>
  );
}
