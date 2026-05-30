import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { formatPakistaniPhone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  // Verify the calling user is an authenticated admin
  const cookieStore = await cookies();
  const caller = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
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

  const { name, phone } = await req.json();
  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  const normalized = formatPakistaniPhone(phone);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid Pakistani phone number" }, { status: 400 });
  }

  // Use service role to create auth user
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create auth user with phone (pre-confirmed so they can log in via OTP)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    phone: normalized,
    phone_confirm: true,
  });

  if (authError) {
    // If user already exists with this phone, look them up
    if (!authError.message.includes("already")) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    // User exists in auth — check if they're already in our users table
    const { data: existing } = await admin
      .from("users")
      .select("id, school_id")
      .eq("phone", normalized)
      .single() as { data: { id: string; school_id: string } | null; error: unknown };

    if (existing) {
      return NextResponse.json({ error: "A user with this phone number already exists" }, { status: 409 });
    }
  }

  const authUserId = authData?.user?.id;
  if (!authUserId) {
    return NextResponse.json({ error: "Failed to create auth user" }, { status: 500 });
  }

  // Insert into public.users
  const { error: insertError } = await admin.from("users").insert({
    id: authUserId,
    school_id: profile.school_id,
    name: name.trim(),
    phone: normalized,
    role: "teacher",
  });

  if (insertError) {
    // Roll back: delete the auth user we just created
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
