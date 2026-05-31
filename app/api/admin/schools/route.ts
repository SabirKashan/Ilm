// Super-admin only. Protected by ADMIN_SECRET env var.
// GET  /api/admin/schools        — list all schools
// DELETE /api/admin/schools?id=X — delete a school + all its data

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

function authorized(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, city, onboarding_complete, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schools: data });
}

export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServiceSupabaseClient();

  // Get all users in this school so we can delete their auth accounts
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("school_id", id) as { data: { id: string }[] | null; error: unknown };

  // Delete school (cascades to all data)
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete auth users
  for (const u of users ?? []) {
    await supabase.auth.admin.deleteUser(u.id);
  }

  return NextResponse.json({ success: true });
}
