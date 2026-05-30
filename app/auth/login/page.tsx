"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { formatPhonePK } from "@/lib/utils";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function isValidPKPhone(p: string) {
    const cleaned = p.replace(/\D/g, "");
    return /^(92|0)?3\d{9}$/.test(cleaned);
  }

  async function handleSendOTP(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValidPKPhone(phone)) {
      toast.error("Please enter a valid Pakistani phone number (03XX-XXXXXXX)");
      return;
    }

    setLoading(true);
    const formatted = formatPhonePK(phone);

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("OTP sent successfully!");
    router.push(`/auth/verify?phone=${encodeURIComponent(formatted)}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-[#1B4332] rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">ع</span>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to Ilm</CardTitle>
          <CardDescription>Sign in with your phone number</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="03XX-XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-lg"
                autoComplete="tel"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Pakistani number only (03XX format)
              </p>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
