import type { Metadata } from "next";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { displayPakistaniPhone } from "@/lib/utils";
import { AutoPrint, PrintButtons } from "../[id]/print-page-client";

export const metadata: Metadata = { title: "Student ID Cards" };

type StudentCard = {
  id: string;
  name: string;
  father_name: string | null;
  roll_number: string | null;
  photo_url: string | null;
  parent_phone: string;
  date_of_birth: string | null;
  class_id: string | null;
};

async function getData(schoolId: string | undefined, classId: string | undefined, ids: string | undefined) {
  const supabase = createServiceSupabaseClient();

  let query = supabase
    .from("students")
    .select("id, name, father_name, roll_number, photo_url, parent_phone, date_of_birth, class_id, school_id, status")
    .eq("status", "active")
    .order("roll_number");

  if (ids) {
    query = query.in("id", ids.split(",").filter(Boolean));
  } else if (classId) {
    query = query.eq("class_id", classId);
  } else if (schoolId) {
    query = query.eq("school_id", schoolId);
  } else {
    return null;
  }

  const { data: students } = await query;
  if (!students || students.length === 0) return { students: [], school: null, classMap: {} };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sid = (students[0] as any).school_id as string;

  const [{ data: school }, { data: classes }] = await Promise.all([
    supabase.from("schools").select("name, city, logo_url").eq("id", sid).single(),
    supabase.from("classes").select("id, name").eq("school_id", sid),
  ]);

  const classMap: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (classes ?? []) as any[]) classMap[c.id] = c.name;

  return { students: students as unknown as StudentCard[], school: school as { name: string; city: string | null; logo_url: string | null } | null, classMap };
}

export default async function IdCardsPage({ searchParams }: { searchParams: Promise<{ class?: string; ids?: string; school?: string }> }) {
  const sp = await searchParams;
  const data = await getData(sp.school, sp.class, sp.ids);
  if (!data) notFound();

  const { students, school, classMap } = data;

  return (
    <>
      <style>{`
        body { background: #e5e7eb !important; margin: 0; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .cards-grid { gap: 8mm !important; padding: 0 !important; }
          .id-card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>

      <AutoPrint />
      <PrintButtons />

      <div style={{ padding: "48px 20px 20px" }}>
        {students.length === 0 ? (
          <div style={{ textAlign: "center", fontFamily: "Arial, sans-serif", color: "#666", marginTop: 80 }}>
            No active students found for this selection.
          </div>
        ) : (
          <div
            className="cards-grid"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              justifyContent: "center",
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {students.map((s) => (
              <IdCard
                key={s.id}
                student={s}
                schoolName={school?.name ?? "School"}
                schoolCity={school?.city ?? ""}
                logoUrl={school?.logo_url ?? null}
                className={s.class_id ? classMap[s.class_id] ?? "—" : "—"}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function IdCard({
  student, schoolName, schoolCity, logoUrl, className,
}: {
  student: StudentCard; schoolName: string; schoolCity: string; logoUrl: string | null; className: string;
}) {
  const initials = student.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      className="id-card"
      style={{
        width: 252,            // ~ 66mm
        height: 400,           // ~ 105mm (portrait card)
        background: "white",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
        border: "1px solid #ddd",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ background: "#1B4332", color: "white", padding: "12px", display: "flex", alignItems: "center", gap: 8 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", background: "white", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 32, height: 32, background: "#F59E0B", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: "bold", flexShrink: 0 }}>ع</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: "bold", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{schoolName}</div>
          {schoolCity && <div style={{ fontSize: 9, opacity: 0.8 }}>{schoolCity}</div>}
        </div>
      </div>

      {/* Photo */}
      <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 8px" }}>
        {student.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={student.photo_url}
            alt={student.name}
            style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "3px solid #1B4332" }}
          />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#1B4332", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: "bold", border: "3px solid #1B4332" }}>
            {initials}
          </div>
        )}
      </div>

      {/* Name + class */}
      <div style={{ textAlign: "center", padding: "0 12px" }}>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#111", lineHeight: 1.2 }}>{student.name}</div>
        <div style={{ display: "inline-block", marginTop: 4, background: "#F59E0B", color: "white", fontSize: 11, fontWeight: "bold", padding: "2px 12px", borderRadius: 20 }}>
          {className}
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: "12px 16px", fontSize: 11, color: "#444", flex: 1 }}>
        {student.father_name && <CardRow label="Father" value={student.father_name} />}
        {student.roll_number && <CardRow label="Roll #" value={student.roll_number} />}
        <CardRow label="Contact" value={displayPakistaniPhone(student.parent_phone)} />
      </div>

      {/* Footer strip */}
      <div style={{ background: "#1B4332", color: "white", textAlign: "center", padding: "6px", fontSize: 9, letterSpacing: 1, fontWeight: "bold" }}>
        STUDENT ID CARD
      </div>
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#222", textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
