"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Step = "phone" | "otp" | "newPassword" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep]           = useState<Step>("phone");
  const [phone, setPhone]         = useState("");
  const [otp, setOtp]             = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);

  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.wati) {
      // No WATI configured — show contact admin message
      toast.error("WhatsApp not set up for your school. Contact your admin to reset your password.");
      return;
    }
    toast.success("A 6-digit code was sent to your WhatsApp");
    setStep("otp");
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setStep("newPassword");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), otp, newPassword }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error(json.error ?? "Failed to reset password"); return; }
    setStep("done");
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
            <h1 className="text-xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {step === "phone" && "Enter your phone number to receive a code on WhatsApp"}
              {step === "otp"   && "Enter the 6-digit code sent to your WhatsApp"}
              {step === "newPassword" && "Choose a new password"}
              {step === "done"  && "Password reset successfully!"}
            </p>
          </div>

          {/* Step: Phone */}
          {step === "phone" && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="03XX-XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white" disabled={loading}>
                {loading ? "Sending…" : "Send WhatsApp Code"}
              </Button>
            </form>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <Button type="submit" className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white">
                Verify Code
              </Button>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="w-full text-sm text-muted-foreground hover:text-gray-700 text-center"
              >
                Didn&apos;t receive it? Go back
              </button>
            </form>
          )}

          {/* Step: New Password */}
          {step === "newPassword" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white" disabled={loading}>
                {loading ? "Resetting…" : "Set New Password"}
              </Button>
            </form>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">✅</div>
              <p className="text-sm text-muted-foreground">
                Your password has been reset. You can now log in with your new password.
              </p>
              <Button
                className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                onClick={() => router.replace("/auth/login")}
              >
                Go to Login
              </Button>
            </div>
          )}

          {step === "phone" && (
            <Link href="/auth/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-gray-700">
              <ArrowLeft size={14} /> Back to login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
