import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { sendAnnouncement } from "@/lib/wati";

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
  const phones = [...new Set((students ?? []).map((s: any) => s.parent_phone as string).filter(Boolean))];

  if (phones.length === 0) {
    return NextResponse.json({ success: true, announcementId: ann?.id, recipientCount: 0 });
  }

  // Get school WATI credentials
  const { data: school } = await admin
    .from("schools")
    .select("wati_endpoint, wati_token")
    .eq("id", profile.school_id)
    .single() as { data: { wati_endpoint: string | null; wati_token: string | null } | null; error: unknown };

  const watiEndpoint = school?.wati_endpoint;
  const watiToken = school?.wati_token;
  const watiEnabled = !!(watiEndpoint && watiToken);

  // Send to all parent phones
  let sentCount = 0;
  await Promise.allSettled(
    phones.map(async (phone) => {
      const result = watiEnabled
        ? await sendAnnouncement(phone, title.trim(), message.trim(), watiEndpoint!, watiToken!)
        : { success: false };

      await admin.from("whatsapp_logs").insert({
        school_id: profile.school_id,
        phone,
        template_name: "ilm_announcement",
        status: watiEnabled ? (result.success ? "sent" : "failed") : "queued",
      });

      if (result.success) sentCount++;
    })
  );

  // Mark announcement as sent if at least one message went through
  if (watiEnabled && sentCount > 0) {
    await admin.from("announcements").update({ whatsapp_sent: true }).eq("id", ann?.id);
  }

  return NextResponse.json({
    success: true,
    announcementId: ann?.id,
    recipientCount: phones.length,
    sentCount: watiEnabled ? sentCount : 0,
  });
}
