import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { sendHomework } from "@/lib/wati";
import { formatDate } from "@/lib/utils";

// POST /api/homework
// Creates a homework/diary entry for a class and fans it out to all
// active students' parents on WhatsApp. Admin can post for any class;
// a teacher can only post for a class they are assigned to.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const caller = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await caller
    .from("users")
    .select("school_id, role, name")
    .eq("id", user.id)
    .single() as { data: { school_id: string; role: string; name: string } | null; error: unknown };

  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { classId, subject, title, details, dueDate } = await req.json();
  if (!classId || !title?.trim()) {
    return NextResponse.json({ error: "Class and title are required" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the class belongs to the school, and (for teachers) that they own it
  const { data: cls } = await admin
    .from("classes")
    .select("id, name, school_id, teacher_id")
    .eq("id", classId)
    .single() as { data: { id: string; name: string; school_id: string; teacher_id: string | null } | null; error: unknown };

  if (!cls || cls.school_id !== profile.school_id) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  if (profile.role === "teacher" && cls.teacher_id !== user.id) {
    return NextResponse.json({ error: "You can only post homework for your own class" }, { status: 403 });
  }

  // Insert homework
  const { data: hw, error: hwError } = await admin
    .from("homework")
    .insert({
      school_id: profile.school_id,
      class_id: classId,
      subject: subject?.trim() || null,
      title: title.trim(),
      details: details?.trim() || null,
      due_date: dueDate || null,
      created_by: user.id,
      created_by_name: profile.name,
      whatsapp_sent: false,
    })
    .select("id")
    .single();

  if (hwError) return NextResponse.json({ error: hwError.message }, { status: 500 });

  // Gather active parents in the class
  const { data: students } = await admin
    .from("students")
    .select("parent_phone")
    .eq("school_id", profile.school_id)
    .eq("class_id", classId)
    .eq("status", "active");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phones = [...new Set((students ?? []).map((s: any) => s.parent_phone as string).filter(Boolean))];

  // WATI credentials
  const { data: school } = await admin
    .from("schools")
    .select("name, wati_endpoint, wati_token")
    .eq("id", profile.school_id)
    .single() as { data: { name: string; wati_endpoint: string | null; wati_token: string | null } | null; error: unknown };

  const watiEnabled = !!(school?.wati_endpoint && school?.wati_token);
  const dueLabel = dueDate ? formatDate(dueDate) : "—";
  const subjectLabel = subject?.trim() || title.trim();
  const detailsLabel = details?.trim() || title.trim();

  let sentCount = 0;
  if (watiEnabled && phones.length > 0) {
    await Promise.allSettled(
      phones.map(async (phone) => {
        const result = await sendHomework(
          phone, cls.name, subjectLabel, detailsLabel, dueLabel, school!.name,
          school!.wati_endpoint!, school!.wati_token!
        );
        await admin.from("whatsapp_logs").insert({
          school_id: profile.school_id,
          phone,
          template_name: "ilm_homework",
          status: result.success ? "sent" : "failed",
        });
        if (result.success) sentCount++;
      })
    );
  }

  if (watiEnabled && sentCount > 0) {
    await admin.from("homework").update({ whatsapp_sent: true, recipient_count: sentCount }).eq("id", hw?.id);
  }

  return NextResponse.json({
    success: true,
    homeworkId: hw?.id,
    recipientCount: phones.length,
    sentCount: watiEnabled ? sentCount : 0,
    watiEnabled,
  });
}
