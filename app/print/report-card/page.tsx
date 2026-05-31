import type { Metadata } from "next";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { AutoPrint, PrintButtons } from "../[id]/print-page-client";

export const metadata: Metadata = { title: "Report Card / نتیجہ نامہ" };

function grade(marks: number, total: number) {
  const p = (marks / total) * 100;
  if (p >= 90) return { en: "A+", ur: "اے پلس", color: "#166534" };
  if (p >= 80) return { en: "A",  ur: "اے",    color: "#166534" };
  if (p >= 70) return { en: "B",  ur: "بی",    color: "#1e40af" };
  if (p >= 60) return { en: "C",  ur: "سی",    color: "#92400e" };
  if (p >= 50) return { en: "D",  ur: "ڈی",    color: "#9a3412" };
  return         { en: "F",  ur: "فیل",  color: "#991b1b" };
}

async function getData(examId: string, studentId: string) {
  const supabase = createServiceSupabaseClient();
  const [{ data: exam }, { data: student }, { data: results }] = await Promise.all([
    supabase.from("exams").select("id, name, date, total_marks, school_id, classes(name)").eq("id", examId).single(),
    supabase.from("students").select("id, name, father_name, roll_number, date_of_birth, school_id").eq("id", studentId).single(),
    supabase.from("results").select("subject_id, marks_obtained, remarks, subjects(name)").eq("exam_id", examId).eq("student_id", studentId),
  ]);
  if (!exam || !student) return null;
  const { data: school } = await supabase.from("schools").select("name, city, logo_url, phone").eq("id", (exam as any).school_id).single();
  return { exam: exam as any, student: student as any, results: (results ?? []) as any[], school: school as any };
}

export default async function ReportCardPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; student?: string; lang?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.exam || !sp.student) notFound();
  const data = await getData(sp.exam, sp.student);
  if (!data) notFound();

  const { exam, student, results, school } = data;
  const isUrdu = sp.lang === "ur";

  const totalObtained = results.reduce((s: number, r: any) => s + Number(r.marks_obtained), 0);
  const totalPossible = results.length * Number(exam.total_marks);
  const overallPct    = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) : 0;
  const overallGrade  = results.length > 0 ? grade(totalObtained, totalPossible) : null;

  const L = {
    title:        isUrdu ? "نتیجہ نامہ" : "Report Card",
    studentName:  isUrdu ? "نام طالب علم" : "Student Name",
    fatherName:   isUrdu ? "نام والد" : "Father's Name",
    rollNo:       isUrdu ? "رول نمبر" : "Roll Number",
    class:        isUrdu ? "کلاس" : "Class",
    exam:         isUrdu ? "امتحان" : "Exam",
    date:         isUrdu ? "تاریخ" : "Date",
    subject:      isUrdu ? "مضمون" : "Subject",
    marks:        isUrdu ? "نمبر" : "Marks",
    total:        isUrdu ? "کل" : "Total",
    grade:        isUrdu ? "گریڈ" : "Grade",
    percentage:   isUrdu ? "فیصد" : "Percentage",
    result:       isUrdu ? "نتیجہ" : "Result",
    pass:         isUrdu ? "کامیاب" : "PASS",
    fail:         isUrdu ? "ناکام" : "FAIL",
    remarks:      isUrdu ? "ریمارکس" : "Remarks",
    principal:    isUrdu ? "دستخط پرنسپل" : "Principal's Signature",
    teacher:      isUrdu ? "دستخط استاد" : "Class Teacher's Signature",
  };

  const dir = isUrdu ? "rtl" : "ltr";
  const font = isUrdu ? "'Noto Nastaliq Urdu', serif" : "Arial, sans-serif";

  const examDate = new Date(exam.date).toLocaleDateString(isUrdu ? "ur-PK" : "en-PK", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
        body { background: #f5f5f5 !important; margin: 0; }
        .rc * { box-sizing: border-box; font-family: ${font}; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .rc-wrap { box-shadow: none !important; }
        }
      `}</style>
      <AutoPrint />
      <PrintButtons />

      <div className="rc" dir={dir} style={{ padding: "48px 20px 20px", minHeight: "100vh", background: "#f5f5f5" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="rc-wrap" style={{ background: "white", border: "2px solid #1B4332", borderRadius: 8, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>

            {/* Header */}
            <div style={{ background: "#1B4332", color: "white", padding: "20px 28px", display: "flex", alignItems: "center", gap: 16, direction: "ltr" }}>
              {school?.logo_url
                ? <img src={school.logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", background: "white", flexShrink: 0 }} />
                : <div style={{ width: 56, height: 56, background: "#F59E0B", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: "bold", flexShrink: 0 }}>R</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: "bold", fontFamily: "'Noto Nastaliq Urdu', Arial, sans-serif" }}>{school?.name ?? "School"}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 3 }}>{school?.city ?? ""}{school?.phone ? ` · ${school.phone}` : ""}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: "bold", fontFamily: font, letterSpacing: isUrdu ? 0 : 1 }}>{L.title}</div>
              </div>
            </div>

            <div style={{ padding: "24px 28px" }}>

              {/* Student info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginBottom: 24, padding: "16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <InfoRow label={L.studentName} value={student.name} />
                <InfoRow label={L.class}       value={exam.classes?.name ?? "—"} />
                <InfoRow label={L.fatherName}  value={student.father_name ?? "—"} />
                <InfoRow label={L.rollNo}      value={student.roll_number ?? "—"} />
                <InfoRow label={L.exam}        value={exam.name} />
                <InfoRow label={L.date}        value={examDate} />
              </div>

              {/* Results table */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#1B4332", color: "white" }}>
                    <th style={{ padding: "10px 14px", textAlign: isUrdu ? "right" : "left", fontFamily: font }}>{L.subject}</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontFamily: font }}>{L.marks}</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontFamily: font }}>{L.total}</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontFamily: font }}>{L.grade}</th>
                    {!isUrdu && <th style={{ padding: "10px 14px", textAlign: "left" }}>{L.remarks}</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: any, i: number) => {
                    const g = grade(Number(r.marks_obtained), Number(exam.total_marks));
                    return (
                      <tr key={r.subject_id} style={{ background: i % 2 === 0 ? "white" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "9px 14px", fontFamily: font }}>{r.subjects?.name ?? "—"}</td>
                        <td style={{ padding: "9px 14px", textAlign: "center", fontWeight: "bold" }}>{r.marks_obtained}</td>
                        <td style={{ padding: "9px 14px", textAlign: "center", color: "#666" }}>{exam.total_marks}</td>
                        <td style={{ padding: "9px 14px", textAlign: "center" }}>
                          <span style={{ display: "inline-block", background: g.color + "22", color: g.color, padding: "2px 10px", borderRadius: 12, fontWeight: "bold", fontFamily: font }}>
                            {isUrdu ? g.ur : g.en}
                          </span>
                        </td>
                        {!isUrdu && <td style={{ padding: "9px 14px", color: "#666", fontSize: 12 }}>{r.remarks ?? "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Summary */}
              <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
                <SummaryBox label={L.total}      value={`${totalObtained} / ${totalPossible}`} color="#1B4332" />
                <SummaryBox label={L.percentage} value={`${overallPct}%`}                       color="#1B4332" />
                {overallGrade && (
                  <SummaryBox label={L.grade} value={isUrdu ? overallGrade.ur : overallGrade.en} color={overallGrade.color} />
                )}
                <SummaryBox
                  label={L.result}
                  value={overallPct >= 50 ? L.pass : L.fail}
                  color={overallPct >= 50 ? "#166534" : "#991b1b"}
                />
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, paddingTop: 16, borderTop: "1px dashed #ddd" }}>
                <SigBlock label={L.teacher}   />
                <SigBlock label={L.principal} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{value}</span>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: color + "0f", border: `1px solid ${color}33`, borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: "bold", color }}>{value}</div>
    </div>
  );
}

function SigBlock({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 150 }}>
      <div style={{ borderBottom: "1px solid #999", marginBottom: 6, width: 180 }} />
      <div style={{ fontSize: 11, color: "#666" }}>{label}</div>
    </div>
  );
}
