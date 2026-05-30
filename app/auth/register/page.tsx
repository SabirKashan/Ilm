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

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) { toast.error("Enter your name"); return; }

    const formatted = formatPakistaniPhone(phone);
    if (!formatted) { toast.error("Enter a valid Pakistani number (03XX-XXXXXXX)"); return; }

    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }

    setLoading(true);

    // Step 1: Create auth user + school + admin profile server-side
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: formatted, password }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(json.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    // Step 2: Sign in to get a session (user is already created + confirmed)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      phone: formatted,
      password,
    });

    if (signInError) {
      toast.error("Account created but sign-in failed — try logging in manually");
      router.replace("/auth/login");
      return;
    }

    toast.success("Account created! Let's set up your school.");
    router.replace("/onboarding");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 space-y-5">

          <div className="text-center">
            <div className="w-14 h-14 bg-[#1B4332] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-[#F59E0B] text-2xl font-bold">ع</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Register Your School</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create your admin account</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="e.g. Ahmad Hassan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </div>

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
              />
              <p className="text-xs text-muted-foreground">
                This will be your login — use a number you always have access to
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white font-semibold"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create Account →"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#1B4332] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
