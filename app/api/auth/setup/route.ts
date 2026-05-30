import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

// Called immediately after supabase.auth.signUp() on the register page.
// Creates the school and users records for the new admin.
// Uses service role to bypass RLS since the user has no profile yet.
export async function POST(req: NextRequest) {
  // Verify the caller is actually authenticated (just signed up)
  const cookieStore = await cookies();
  const caller = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, phone } = await req.json();
  if (!name || !phone) return NextResponse.json({ error: "Missing name or phone" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  // Check if this user already has a profile (idempotent — safe to call twice)
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, existing: true });
  }

  // Create school with placeholder name — onboarding will fill it in
  const { data: school, error: schoolErr } = await supabase
    .from("schools")
    .insert({
      name: "My School",
      onboarding_complete: false,
    })
    .select("id")
    .single();

  if (schoolErr || !school) {
    return NextResponse.json({ error: schoolErr?.message ?? "Failed to create school" }, { status: 500 });
  }

  // Create admin user profile
  const { error: userErr } = await supabase
    .from("users")
    .insert({
      id: user.id,
      school_id: school.id,
      name: name.trim(),
      phone: phone,
      role: "admin",
    });

  if (userErr) {
    // Clean up school if user insert fails
    await supabase.from("schools").delete().eq("id", school.id);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
