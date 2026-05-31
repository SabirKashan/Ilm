"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPakistaniPhone } from "@/lib/utils";
import { CheckCircle2, School, BookOpen, Users, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { step: 1, label: "School",  icon: School },
  { step: 2, label: "Class",   icon: BookOpen },
  { step: 3, label: "Student", icon: Users },
  { step: 4, label: "Done",    icon: Sparkles },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const logoRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — School profile
  const [schoolName, setSchoolName] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 2 — First class
  const [className, setClassName] = useState("");
  const [classId, setClassId] = useState<string | null>(null);

  // Step 3 — First student
  const [studentName, setStudentName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function getSchoolId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: profile } = await supabase
      .from("users").select("school_id").eq("id", user.id).single() as { data: { school_id: string } | null; error: unknown };
    if (!profile?.school_id) throw new Error("School not found");
    return profile.school_id;
  }

  // ── Step 1 → save school profile ──────────────────────────────────────────

  async function saveSchoolProfile() {
    setSaving(true);
    try {
      const schoolId = await getSchoolId();

      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${schoolId}/logo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("ilm-assets").upload(path, logoFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("ilm-assets").getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("schools").update({
        name: schoolName.trim(),
        city: schoolCity.trim() || null,
        phone: schoolPhone.trim() || null,
        logo_url: logoUrl,
      }).eq("id", schoolId);

      if (error) throw error;
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── Step 2 → create first class ───────────────────────────────────────────

  async function saveClass() {
    setSaving(true);
    try {
      const schoolId = await getSchoolId();

      const currentYear = new Date().getFullYear().toString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("classes").insert({
        school_id: schoolId,
        name: className.trim(),
        grade_level: null,
        academic_year: currentYear,
      }).select("id").single();

      if (error) throw new Error(error.message ?? JSON.stringify(error));
      setClassId(data.id);
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setSaving(false);
    }
  }

  // ── Step 3 → create first student + mark onboarding complete ──────────────

  async function saveStudent() {
    const phone = formatPakistaniPhone(parentPhone);
    if (!phone) { toast.error("Enter a valid Pakistani WhatsApp number"); return; }
    setSaving(true);
    try {
      const schoolId = await getSchoolId();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newStudent, error: stuErr } = await (supabase as any).from("students").insert({
        school_id: schoolId,
        name: studentName.trim(),
        father_name: fatherName.trim() || null,
        class_id: classId,
        parent_phone: phone,
        status: "active",
      }).select("id").single();
      if (stuErr) throw new Error(stuErr.message ?? JSON.stringify(stuErr));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("schools").update({ onboarding_complete: true }).eq("id", schoolId);

      // Fire-and-forget welcome WhatsApp — non-blocking, ignore if WATI not set up yet
      if (newStudent?.id) {
        fetch("/api/students/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: newStudent.id }),
        }).catch(() => {});
      }

      setStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setSaving(false);
    }
  }

  async function skipAndFinish() {
    setSaving(true);
    try {
      const schoolId = await getSchoolId();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("schools").update({ onboarding_complete: true }).eq("id", schoolId);
      setStep(4);
    } finally {
      setSaving(false);
    }
  }

  const progress = step === 4 ? 100 : ((step - 1) / 3) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#1B4332] flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-[#F59E0B] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-white text-2xl font-bold">R</span>
        </div>
        <p className="text-white/70 text-sm">Let&apos;s set up your school</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.step;
          const active = step === s.step;
          return (
            <div key={s.step} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                done   ? "bg-[#F59E0B] text-white" :
                active ? "bg-white text-[#1B4332]" :
                         "bg-white/10 text-white/40"
              }`}>
                {done ? <CheckCircle2 size={12} /> : <Icon size={12} />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-4 h-0.5 mx-1 transition-colors ${step > s.step ? "bg-[#F59E0B]" : "bg-white/20"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm mb-6 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* ── Step 1: School Profile ── */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Your School</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Tell us about your school</p>
            </div>

            {/* Logo upload */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors shrink-0"
                onClick={() => logoRef.current?.click()}
              >
                {logoPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                  : <span className="text-2xl">🏫</span>
                }
              </div>
              <div>
                <button type="button" onClick={() => logoRef.current?.click()}
                  className="text-sm font-medium text-[#1B4332] hover:underline">
                  {logoPreview ? "Change logo" : "Upload logo"}
                </button>
                <p className="text-xs text-muted-foreground mt-0.5">Optional — PNG or JPG</p>
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <div className="space-y-2">
              <Label>School Name *</Label>
              <Input placeholder="e.g. Al-Noor Public School" value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input placeholder="e.g. Lahore" value={schoolCity}
                  onChange={(e) => setSchoolCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="03001234567" value={schoolPhone}
                  onChange={(e) => setSchoolPhone(e.target.value)} inputMode="tel" />
              </div>
            </div>

            <Button className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              disabled={!schoolName.trim() || saving} onClick={saveSchoolProfile}>
              {saving ? "Saving…" : <span className="flex items-center justify-center gap-1">Next <ArrowRight size={15} /></span>}
            </Button>
          </div>
        )}

        {/* ── Step 2: First Class ── */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add Your First Class</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Classes group students together. You can add more later.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input placeholder="e.g. Class 5-A, Grade 3, Nursery" value={className}
                onChange={(e) => setClassName(e.target.value)} autoFocus />
              <p className="text-xs text-muted-foreground">
                Tip: include section — &ldquo;Class 6-A&rdquo; and &ldquo;Class 6-B&rdquo;
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ArrowLeft size={15} className="mr-1" /> Back
              </Button>
              <Button className="flex-1 bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                disabled={!className.trim() || saving} onClick={saveClass}>
                {saving ? "Saving…" : <span className="flex items-center justify-center gap-1">Next <ArrowRight size={15} /></span>}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: First Student ── */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add Your First Student</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Adding to <span className="font-medium text-gray-700">{className}</span>. Import the rest from CSV after setup.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Student Name *</Label>
              <Input placeholder="e.g. Muhammad Ali" value={studentName}
                onChange={(e) => setStudentName(e.target.value)} autoFocus />
            </div>

            <div className="space-y-2">
              <Label>Father&apos;s Name</Label>
              <Input placeholder="e.g. Hassan Ali" value={fatherName}
                onChange={(e) => setFatherName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Parent WhatsApp Number *</Label>
              <Input placeholder="03001234567" value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)} inputMode="tel" />
              <p className="text-xs text-muted-foreground">
                All notifications — fees, attendance, results — go here
              </p>
            </div>

            <Button className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              disabled={!studentName.trim() || !parentPhone.trim() || saving} onClick={saveStudent}>
              {saving ? "Saving…" : <span className="flex items-center justify-center gap-1">Finish Setup <Sparkles size={15} /></span>}
            </Button>

            <button type="button" onClick={skipAndFinish} disabled={saving}
              className="w-full text-sm text-muted-foreground hover:text-gray-700 text-center py-1">
              Skip — I&apos;ll add students later
            </button>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 4 && (
          <div className="p-6 text-center space-y-5">
            <div className="py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {schoolName || "Your school"} is ready! 🎉
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Here&apos;s what to do next.
              </p>
            </div>

            <div className="space-y-2 text-left">
              <NextAction href="/dashboard/students" emoji="👨‍🎓"
                title="Add more students" desc="Import from CSV or add one by one" />
              <NextAction href="/dashboard/fees" emoji="💰"
                title="Set up fee types" desc="Monthly tuition, transport, etc." />
              <NextAction href="/dashboard/classes" emoji="📚"
                title="Add more classes" desc="Organise students by grade" />
            </div>

            <Button className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white mt-2"
              onClick={() => router.replace("/dashboard")}>
              <span className="flex items-center justify-center gap-1">Go to Dashboard <ArrowRight size={15} /></span>
            </Button>
          </div>
        )}
      </div>

      {step < 4 && (
        <p className="text-white/40 text-xs mt-5">Step {step} of 3</p>
      )}
    </div>
  );
}

function NextAction({ href, emoji, title, desc }: {
  href: string; emoji: string; title: string; desc: string;
}) {
  return (
    <a href={href}
      className="flex items-center gap-3 p-3 rounded-xl border hover:border-[#1B4332]/40 hover:bg-[#1B4332]/5 transition-colors group">
      <span className="text-xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight size={14} className="text-muted-foreground group-hover:text-[#1B4332] shrink-0" />
    </a>
  );
}
