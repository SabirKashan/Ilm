import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

// Single server-side route that:
// 1. Creates the Supabase auth user (admin API — no OTP, phone marked confirmed)
// 2. Creates the school record
// 3. Creates the admin user profile
// All in one transaction-like flow — client just calls signInWithPassword() after.
export async function POST(req: NextRequest) {
  const { name, phone, password } = await req.json();

  if (!name || !phone || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password too short" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  // Check if phone already registered
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("phone", phone)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "This phone number is already registered. Try signing in." },
      { status: 409 }
    );
  }

  // Create auth user via admin API — marks phone as confirmed, no OTP needed
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // Create school with placeholder name — onboarding fills it in
  const { data: school, error: schoolErr } = await supabase
    .from("schools")
    .insert({ name: "My School", onboarding_complete: false })
    .select("id")
    .single();

  if (schoolErr || !school) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: schoolErr?.message ?? "Failed to create school" },
      { status: 500 }
    );
  }

  // Create admin profile
  const { error: userErr } = await supabase.from("users").insert({
    id: userId,
    school_id: school.id,
    name: name.trim(),
    phone,
    role: "admin",
  });

  if (userErr) {
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from("schools").delete().eq("id", school.id);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
