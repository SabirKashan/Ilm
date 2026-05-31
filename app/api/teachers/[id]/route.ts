import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teacherId } = await params;

  const cookieStore = await cookies();
  const caller = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminProfile } = await caller
    .from("users").select("school_id, role").eq("id", user.id).single() as
    { data: { school_id: string; role: string } | null; error: unknown };

  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceSupabaseClient();

  // Verify teacher belongs to same school
  const { data: teacher } = await supabase
    .from("users").select("id, school_id, role").eq("id", teacherId).single() as
    { data: { id: string; school_id: string; role: string } | null; error: unknown };

  if (!teacher || teacher.school_id !== adminProfile.school_id || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  // Delete from public.users (cascades to activity_logs, etc.)
  await supabase.from("users").delete().eq("id", teacherId);

  // Delete auth user
  await supabase.auth.admin.deleteUser(teacherId);

  return NextResponse.json({ success: true });
}
