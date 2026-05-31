import type { Metadata } from "next";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { AutoPrint, PrintButtons } from "../[id]/print-page-client";

export const metadata: Metadata = { title: "Leaving Certificate / سند ترک تعلیم" };

async function getData(studentId: string) {
  const supabase = createServiceSupabaseClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, name, father_name, roll_number, date_of_birth, school_id, parent_phone, class_id, created_at, classes(name)")
    .eq("id", studentId).single();
  if (!student) return null;
  const { data: school } = await supabase.from("schools").select("name, city, address, phone, logo_url").eq("id", (student as any).school_id).single();
  return { student: student as any, school: school as any };
}

export default async function LeavingCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; lang?: string; reason?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.student) notFound();
  const data = await getData(sp.student);
  if (!data) notFound();

  const { student, school } = data;
  const isUrdu = sp.lang === "ur";
  const reason = sp.reason ?? (isUrdu ? "ذاتی وجوہات" : "Personal reasons");

  const today = new Date().toLocaleDateString(isUrdu ? "ur-PK" : "en-PK", { year: "numeric", month: "long", day: "numeric" });
  const admissionYear = new Date(student.created_at).getFullYear();

  const dir  = isUrdu ? "rtl" : "ltr";
  const font = isUrdu ? "'Noto Nastaliq Urdu', serif" : "Georgia, serif";

  const certNo = `LC-${student.id.slice(0, 6).toUpperCase()}-${new Date().getFullYear()}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
        body { background: #f0ebe0 !important; margin: 0; }
        .lc * { box-sizing: border-box; font-family: ${font}; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .lc-wrap { box-shadow: none !important; border: 4px double #1B4332 !important; }
        }
      `}</style>
      <AutoPrint />
      <PrintButtons />

      <div className="lc" dir={dir} style={{ padding: "48px 20px 20px", minHeight: "100vh", background: "#f0ebe0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="lc-wrap" style={{ background: "white", border: "6px double #1B4332", borderRadius: 4, padding: "40px 48px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", position: "relative", minHeight: 800 }}>

            {/* Watermark */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 0, opacity: 0.04 }}>
              <div style={{ fontSize: 120, fontWeight: "bold", color: "#1B4332", transform: "rotate(-30deg)", fontFamily: "'Noto Nastaliq Urdu', serif" }}>R</div>
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 28, direction: "ltr" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  {school?.logo_url
                    ? <img src={school.logo_url} alt="" style={{ width: 70, height: 70, borderRadius: 12, objectFit: "cover", border: "2px solid #1B4332" }} />
                    : <div style={{ width: 70, height: 70, background: "#1B4332", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: "bold", color: "#F59E0B" }}>R</div>
                  }
                </div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#1B4332", fontFamily: "'Noto Nastaliq Urdu', Georgia, serif" }}>{school?.name ?? "School"}</div>
                {school?.city && <div style={{ fontSize: 13, color: "#666", marginTop: 3 }}>{school.city}</div>}
                {school?.address && <div style={{ fontSize: 12, color: "#888" }}>{school.address}</div>}
              </div>

              {/* Title */}
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ display: "inline-block", background: "#1B4332", color: "white", padding: "8px 40px", borderRadius: 4 }}>
                  <div style={{ fontSize: 22, fontWeight: "bold", fontFamily: font, letterSpacing: isUrdu ? 0 : 2 }}>
                    {isUrdu ? "سند ترک تعلیم" : "LEAVING CERTIFICATE"}
                  </div>
                </div>
              </div>

              {/* Certificate no & date */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, fontSize: 12, color: "#555", direction: "ltr" }}>
                <span>Certificate No: <strong>{certNo}</strong></span>
                <span>{isUrdu ? "تاریخ:" : "Date:"} <strong>{today}</strong></span>
              </div>

              {/* Body text */}
              <div style={{ fontSize: isUrdu ? 15 : 14, lineHeight: isUrdu ? 2.2 : 2, color: "#222", marginBottom: 32, fontFamily: font }}>
                {isUrdu ? (
                  <p>
                    یہ تصدیق کی جاتی ہے کہ <strong>{student.name}</strong> ولد <strong>{student.father_name ?? "—"}</strong>
                    {student.roll_number ? ` رول نمبر ${student.roll_number} ` : " "}
                    {student.classes?.name ? `کلاس ${student.classes.name}` : ""} کے طالب علم تھے۔
                    انہوں نے سن {admissionYear} میں اس ادارے میں داخلہ لیا تھا اور {today} کو
                    <strong> {reason}</strong> کی وجہ سے ترک تعلیم کیا۔
                    ان کا اخلاق و کردار اچھا رہا اور کوئی واجبات ان کے ذمہ نہیں ہیں۔
                    ہم انہیں مستقبل میں کامیابی کی دعا دیتے ہیں۔
                  </p>
                ) : (
                  <p>
                    This is to certify that <strong>{student.name}</strong>, son/daughter of <strong>{student.father_name ?? "—"}</strong>
                    {student.roll_number ? `, Roll No. ${student.roll_number},` : ""}
                    {student.classes?.name ? ` of Class ${student.classes.name},` : ""}
                    {" "}was a bonafide student of this institution from <strong>{admissionYear}</strong> to <strong>{today}</strong>.
                    {" "}The student is leaving this institution due to <strong>{reason}</strong>.
                    The student has maintained good character and conduct throughout and has no dues outstanding.
                    We wish them success in their future endeavours.
                  </p>
                )}
              </div>

              {/* Details table */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "16px 20px", marginBottom: 40, fontSize: 13 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 32px" }}>
                  <Detail label={isUrdu ? "نام" : "Name"} value={student.name} />
                  {student.father_name && <Detail label={isUrdu ? "نام والد" : "Father's Name"} value={student.father_name} />}
                  {student.classes?.name && <Detail label={isUrdu ? "آخری کلاس" : "Last Class"} value={student.classes.name} />}
                  {student.roll_number && <Detail label={isUrdu ? "رول نمبر" : "Roll No."} value={student.roll_number} />}
                  <Detail label={isUrdu ? "سال داخلہ" : "Admission Year"} value={String(admissionYear)} />
                  <Detail label={isUrdu ? "تاریخ اخراج" : "Leaving Date"} value={today} />
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 20, borderTop: "1px dashed #bbb" }}>
                <SigBlock label={isUrdu ? "دستخط کلاس ٹیچر" : "Class Teacher"} />
                <SigBlock label={isUrdu ? "دستخط و مہر پرنسپل" : "Principal (Signature & Stamp)"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: "#111" }}>{value}</div>
    </div>
  );
}

function SigBlock({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 160 }}>
      <div style={{ borderBottom: "1px solid #999", marginBottom: 8, paddingBottom: 30, width: 200 }} />
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
    </div>
  );
}
