import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// DEV ONLY — remove before production
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ otp: null });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const normalised = phone.replace(/^\+/, "");

  // Only return OTPs written in the last 90 seconds — prevents stale codes
  const cutoff = new Date(Date.now() - 90_000).toISOString();

  const { data } = await supabase
    .from("otp_dev_logs")
    .select("otp")
    .eq("phone", normalised)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ otp: (data as { otp: string } | null)?.otp ?? null });
}
