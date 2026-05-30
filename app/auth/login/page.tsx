"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPakistaniPhone } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const formatted = formatPakistaniPhone(phone);
    if (!formatted) {
      toast.error("Enter a valid Pakistani number (03XX-XXXXXXX)");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      phone: formatted,
      password,
    });

    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "Wrong phone number or password"
          : error.message
      );
      setLoading(false);
      return;
    }

    if (!data.user) { setLoading(false); return; }

    // Check profile
    const { data: profile } = await supabase
      .from("users")
      .select("role, school_id")
      .eq("id", data.user.id)
      .single() as { data: { role: string; school_id: string } | null; error: unknown };

    if (!profile) {
      toast.error("Account not set up. Contact your administrator.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (profile.role === "teacher") {
      router.replace("/teacher");
      return;
    }

    // Check onboarding
    const { data: school } = await supabase
      .from("schools")
      .select("onboarding_complete")
      .eq("id", profile.school_id)
      .single() as { data: { onboarding_complete: boolean } | null; error: unknown };

    router.replace(school?.onboarding_complete ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 space-y-5">

          {/* Header */}
          <div className="text-center">
            <div className="w-14 h-14 bg-[#1B4332] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-[#F59E0B] text-2xl font-bold">ع</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Welcome to Ilm</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Sign in to your school account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="03XX-XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            New school?{" "}
            <Link href="/auth/register" className="text-[#1B4332] font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
