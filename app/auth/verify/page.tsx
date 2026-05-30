"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function VerifyForm() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [pollTrigger, setPollTrigger] = useState(0); // increments to restart polling
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const isDev = process.env.NODE_ENV === "development";

  // Countdown timer — resets whenever pollTrigger changes (i.e. on resend)
  useEffect(() => {
    setCountdown(60);
    setCanResend(false);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); setCanResend(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pollTrigger]);

  // Focus input on first load
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Dev OTP polling — restarts whenever pollTrigger changes
  useEffect(() => {
    if (!isDev || !phone) return;
    setDevOtp(null);
    setOtp("");

    let attempts = 0;
    // Small delay so Supabase/hook has time to write the OTP
    const delay = setTimeout(() => {
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 20) { clearInterval(poll); return; }
        try {
          const res = await fetch(`/api/dev-otp?phone=${encodeURIComponent(phone)}&t=${Date.now()}`);
          const { otp: fetched } = await res.json();
          if (fetched) {
            setDevOtp(fetched);
            setOtp(fetched);
            clearInterval(poll);
          }
        } catch {}
      }, 1500);
      return () => clearInterval(poll);
    }, 500);

    return () => clearTimeout(delay);
  }, [phone, isDev, pollTrigger]);

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Please enter the 6-digit OTP"); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });

    if (error) {
      toast.error(error.message || "Invalid OTP. Please try again.");
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("users").select("role").eq("id", data.user.id).single() as
        { data: { role: string } | null; error: unknown };

      if (!profile) {
        toast.error("Your account is not set up yet. Contact your school administrator.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      toast.success("Logged in successfully!");
      router.replace(profile.role === "teacher" ? "/teacher" : "/dashboard");
    }
  }

  async function handleResend() {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) { toast.error(error.message); return; }
    toast.success("New OTP sent!");
    setPollTrigger((n) => n + 1); // restarts both the timer and the polling
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-[#F59E0B] rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl">📱</span>
          </div>
          <CardTitle className="text-2xl font-bold">Enter OTP</CardTitle>
          <CardDescription>
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{phone}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Dev mode OTP banner */}
          {isDev && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center">
              <p className="text-xs font-medium text-amber-700">DEV MODE</p>
              {devOtp ? (
                <p className="text-lg font-mono font-bold text-amber-900 tracking-widest">{devOtp}</p>
              ) : (
                <p className="text-xs text-amber-600 animate-pulse">Fetching OTP…</p>
              )}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                ref={inputRef}
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
                autoComplete="one-time-code"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>
            <div className="text-center">
              {canResend ? (
                <button type="button" onClick={handleResend}
                  className="text-sm text-[#1B4332] font-medium hover:underline">
                  Resend OTP
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">Resend in {countdown}s</p>
              )}
            </div>
            <button type="button" onClick={() => router.push("/auth/login")}
              className="w-full text-sm text-muted-foreground hover:text-foreground text-center">
              ← Change phone number
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
