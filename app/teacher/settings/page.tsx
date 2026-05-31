"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export default function TeacherSettingsPage() {
  const supabase = createClient();

  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showNewPw, setShowNewPw]   = useState(false);
  const [saving, setSaving]         = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) { toast.error("All fields are required"); return; }
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    setSaving(true);

    // Re-authenticate to verify current password
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("users")
      .select("phone")
      .eq("id", user!.id)
      .single() as { data: { phone: string } | null; error: unknown };

    if (!profile) { toast.error("Could not verify identity"); setSaving(false); return; }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      phone: profile.phone,
      password: currentPw,
    });
    if (signInError) { toast.error("Current password is incorrect"); setSaving(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) { toast.error(error.message); return; }

    toast.success("Password updated successfully");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  }

  return (
    <div className="space-y-6 max-w-sm mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input
              type="password"
              placeholder="Enter current password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNewPw ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              placeholder="Re-enter new password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
            disabled={saving}
          >
            {saving ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
