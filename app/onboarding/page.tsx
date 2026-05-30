"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { DbUser } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const STEPS = [
  { label: "School Name", step: 1 },
  { label: "Location", step: 2 },
  { label: "Logo", step: 3 },
];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", user.id)
        .single() as { data: Pick<DbUser, "school_id"> | null; error: unknown };

      if (!profile?.school_id) throw new Error("School not found");

      let logoUrl: string | null = null;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${profile.school_id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("ilm-assets")
          .upload(path, logoFile, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("ilm-assets")
            .getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("schools")
        .update({
          name,
          address: address || null,
          city: city || null,
          logo_url: logoUrl,
          onboarding_complete: true,
        })
        .eq("id", profile.school_id);

      if (error) throw error;

      toast.success("School set up successfully!");
      window.location.replace("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Setup failed";
      toast.error(msg);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] p-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.step} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s.step
                  ? "bg-[#F59E0B] text-white"
                  : "bg-white/20 text-white/60"
              }`}
            >
              {s.step}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  step > s.step ? "bg-[#F59E0B]" : "bg-white/20"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="w-full max-w-sm">
        {/* Step 1: School Name */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>School Name</CardTitle>
              <CardDescription>What is your school called?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">School Name</Label>
                <Input
                  id="school-name"
                  placeholder="e.g. Al-Noor Public School"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                disabled={!name.trim()}
                onClick={() => setStep(2)}
              >
                Next →
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>Where is your school located?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Street address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g. Lahore"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button
                  className="flex-1 bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                  onClick={() => setStep(3)}
                >
                  Next →
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Logo */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>School Logo</CardTitle>
              <CardDescription>Upload your school logo (optional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-24 h-24 rounded-xl object-cover border-2 border-[#1B4332]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                    <span className="text-3xl">🏫</span>
                  </div>
                )}
                <label
                  htmlFor="logo-upload"
                  className="cursor-pointer text-sm text-[#1B4332] font-medium hover:underline"
                >
                  {logoPreview ? "Change logo" : "Upload logo"}
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  ← Back
                </Button>
                <Button
                  className="flex-1 bg-[#F59E0B] hover:bg-[#D97706] text-white"
                  onClick={handleFinish}
                  disabled={saving}
                >
                  {saving ? "Setting up..." : "Finish Setup 🎉"}
                </Button>
              </div>
              {!logoFile && (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
                >
                  Skip for now
                </button>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
