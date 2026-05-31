// POST /api/teachers/reset-password
// Admin resets a teacher's password directly (no OTP needed)

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
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

  const { teacherId, newPassword } = await req.json();
  if (!teacherId || !newPassword) {
    return NextResponse.json({ error: "teacherId and newPassword are required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  // Verify teacher belongs to same school
  const { data: teacher } = await supabase
    .from("users")
    .select("id, school_id, role")
    .eq("id", teacherId)
    .single() as { data: { id: string; school_id: string; role: string } | null; error: unknown };

  if (!teacher || teacher.school_id !== profile.school_id || teacher.role !== "teacher") {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  const { error } = await supabase.auth.admin.updateUserById(teacherId, { password: newPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
