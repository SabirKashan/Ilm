import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    const body = await req.json();
    const phone: string = body.phone ?? body.user?.phone ?? "";
    const otp: string = body.otp ?? body.sms?.otp ?? body.data?.otp ?? "";

    console.log(`📱 OTP for ${phone}: ${otp}`);

    if (!phone || !otp) return new Response(JSON.stringify({}), { status: 200 });

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    await fetch(`${url}/rest/v1/otp_dev_logs`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ phone, otp, created_at: new Date().toISOString() }),
    });
  } catch (err) {
    console.error("sms-logger error:", err);
  }

  return new Response(JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
