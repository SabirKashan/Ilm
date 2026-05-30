import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

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
    .select("school_id, role")
    .eq("id", user.id)
    .single() as { data: { school_id: string; role: string } | null; error: unknown };

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, message, target, classId } = await req.json();
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  }
  if (target !== "all" && target !== "class") {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }
  if (target === "class" && !classId) {
    return NextResponse.json({ error: "Class is required for class announcements" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Insert announcement
  const { data: ann, error: annError } = await admin
    .from("announcements")
    .insert({
      school_id: profile.school_id,
      title: title.trim(),
      message: message.trim(),
      target,
      class_id: target === "class" ? classId : null,
      whatsapp_sent: false,
    })
    .select("id")
    .single();

  if (annError) return NextResponse.json({ error: annError.message }, { status: 500 });

  // Get parent phones for the target
  let studentsQuery = admin
    .from("students")
    .select("parent_phone")
    .eq("school_id", profile.school_id)
    .eq("status", "active");

  if (target === "class") studentsQuery = studentsQuery.eq("class_id", classId);

  const { data: students } = await studentsQuery;

  // Deduplicate phones (one parent may have multiple children)
  const phones = [...new Set((students ?? []).map((s: any) => s.parent_phone as string).filter(Boolean))];

  if (phones.length > 0) {
    const logs = phones.map((phone) => ({
      school_id: profile.school_id,
      phone,
      template_name: "announcement",
      status: "queued",
    }));
    await admin.from("whatsapp_logs").insert(logs);
    // TODO: call WATI broadcast API here when integrated
  }

  return NextResponse.json({ success: true, announcementId: ann?.id, recipientCount: phones.length });
}
