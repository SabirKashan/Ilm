"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle2, Clock, XCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { School } from "@/types/database";
import { STARTER_TEMPLATES, submitMetaTemplate, getMetaTemplates } from "@/lib/meta-whatsapp";

type SchoolForm = Pick<School, "name" | "address" | "city" | "phone" | "jazzcash_merchant_id" | "easypaisa_merchant_id" | "wati_endpoint" | "wati_token">;

export default function SettingsPage() {
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Meta WhatsApp
  const [metaPhoneId, setMetaPhoneId]     = useState("");
  const [metaToken, setMetaToken]         = useState("");
  const [metaWabaId, setMetaWabaId]       = useState("");
  const [metaProvider, setMetaProvider]   = useState<string | null>(null);
  const [savingMeta, setSavingMeta]       = useState(false);
  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submittingTemplate, setSubmittingTemplate] = useState<string | null>(null);
  const [showMetaGuide, setShowMetaGuide] = useState(false);

  // Change password
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showNewPw, setShowNewPw]   = useState(false);
  const [savingPw, setSavingPw]     = useState(false);
  const [form, setForm] = useState<SchoolForm>({
    name: "",
    address: "",
    city: "",
    phone: "",
    jazzcash_merchant_id: "",
    easypaisa_merchant_id: "",
    wati_endpoint: "",
    wati_token: "",
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("users").select("school_id").eq("id", user.id).single();
      if (!profile) return;
      const sid = (profile as { school_id: string }).school_id;
      setSchoolId(sid);
      const { data: school } = await supabase.from("schools").select("*").eq("id", sid).single();
      if (school) {
        const s = school as any;
        setForm({
          name: s.name ?? "",
          address: s.address ?? "",
          city: s.city ?? "",
          phone: s.phone ?? "",
          jazzcash_merchant_id: s.jazzcash_merchant_id ?? "",
          easypaisa_merchant_id: s.easypaisa_merchant_id ?? "",
          wati_endpoint: s.wati_endpoint ?? "",
          wati_token: s.wati_token ?? "",
        });
        setMetaPhoneId(s.meta_phone_number_id ?? "");
        setMetaToken(s.meta_access_token ?? "");
        setMetaWabaId(s.meta_waba_id ?? "");
        setMetaProvider(s.whatsapp_provider ?? null);
      }
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function field(key: keyof SchoolForm) {
    return {
      value: form[key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  async function handleChangePassword() {
    if (!currentPw || !newPw || !confirmPw) { toast.error("All password fields are required"); return; }
    if (newPw.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    setSavingPw(true);
    // Re-authenticate with current password first
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("users").select("phone").eq("id", user!.id).single() as { data: { phone: string } | null; error: unknown };
    if (!profile) { toast.error("Could not verify identity"); setSavingPw(false); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ phone: profile.phone, password: currentPw });
    if (signInError) { toast.error("Current password is incorrect"); setSavingPw(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed successfully");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  }

  async function handleSaveMeta() {
    if (!metaPhoneId.trim() || !metaToken.trim()) {
      toast.error("Phone Number ID and Access Token are required");
      return;
    }
    setSavingMeta(true);
    const { error } = await (supabase as any).from("schools").update({
      meta_phone_number_id: metaPhoneId.trim() || null,
      meta_access_token: metaToken.trim() || null,
      meta_waba_id: metaWabaId.trim() || null,
      whatsapp_provider: "meta",
    }).eq("id", schoolId);
    setSavingMeta(false);
    if (error) { toast.error(error.message); return; }
    setMetaProvider("meta");
    toast.success("Meta WhatsApp credentials saved. You are now using Meta Cloud API.");
  }

  async function handleCheckTemplates() {
    if (!metaWabaId || !metaToken) { toast.error("Add your WABA ID and Access Token first"); return; }
    setLoadingTemplates(true);
    const result = await getMetaTemplates(metaWabaId, metaToken);
    setLoadingTemplates(false);
    if (!result.success) { toast.error(result.error ?? "Failed to fetch templates"); return; }
    setMetaTemplates(result.templates ?? []);
  }

  async function handleSubmitTemplate(templateName: string) {
    if (!metaWabaId || !metaToken) { toast.error("Add your WABA ID and Access Token first"); return; }
    const tpl = STARTER_TEMPLATES.find((t) => t.name === templateName);
    if (!tpl) return;
    setSubmittingTemplate(templateName);
    const result = await submitMetaTemplate(metaWabaId, metaToken, {
      name: tpl.name,
      language: tpl.language,
      category: tpl.category,
      components: tpl.components,
    });
    setSubmittingTemplate(null);
    if (!result.success) { toast.error(result.error ?? "Submission failed"); return; }
    toast.success(`"${templateName}" submitted to Meta for review. Status: ${result.status ?? "PENDING"}. Check back in 24-48h.`);
    handleCheckTemplates();
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("School name is required"); return; }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("schools")
      .update({
        name: form.name.trim(),
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        phone: form.phone?.trim() || null,
        jazzcash_merchant_id: form.jazzcash_merchant_id?.trim() || null,
        easypaisa_merchant_id: form.easypaisa_merchant_id?.trim() || null,
        wati_endpoint: form.wati_endpoint?.trim() || null,
        wati_token: form.wati_token?.trim() || null,
      })
      .eq("id", schoolId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved");
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-lg">
        <Skeleton className="h-8 w-48" />
        {[1,2,3,4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your school profile and integrations</p>
      </div>

      {/* School Profile */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-2">School Profile</h2>
        <div className="space-y-2">
          <Label>School Name *</Label>
          <Input placeholder="e.g. Al-Noor Academy" {...field("name")} />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input placeholder="e.g. Lahore" {...field("city")} />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input placeholder="Street address" {...field("address")} />
        </div>
        <div className="space-y-2">
          <Label>School Phone</Label>
          <Input placeholder="03001234567" inputMode="tel" {...field("phone")} />
        </div>
      </section>

      {/* Payment Settings */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Payment Integration</h2>
        <p className="text-xs text-muted-foreground">
          Add merchant IDs to enable JazzCash / Easypaisa payment links on fee vouchers.
        </p>
        <div className="space-y-2">
          <Label>JazzCash Merchant ID</Label>
          <Input placeholder="Optional" {...field("jazzcash_merchant_id")} />
        </div>
        <div className="space-y-2">
          <Label>Easypaisa Merchant ID</Label>
          <Input placeholder="Optional" {...field("easypaisa_merchant_id")} />
        </div>
      </section>

      {/* WhatsApp — Meta Cloud API */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-base font-semibold text-gray-900">WhatsApp (Meta Cloud API)</h2>
          {metaProvider === "meta" && metaPhoneId
            ? <Badge className="bg-green-100 text-green-700">Active</Badge>
            : <Badge variant="outline" className="text-muted-foreground">Not configured</Badge>}
        </div>

        {/* Step by step guide toggle */}
        <button
          onClick={() => setShowMetaGuide(v => !v)}
          className="flex items-center gap-2 text-sm text-[#1B4332] font-medium hover:underline"
        >
          {showMetaGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          How to set up Meta WhatsApp (step-by-step)
        </button>

        {showMetaGuide && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 text-sm">
            <p className="font-semibold text-blue-900">Setup takes ~15 minutes. Do it once, never touch WATI again.</p>
            <ol className="space-y-2 text-blue-800 list-decimal list-inside">
              <li>Go to <a href="https://developers.facebook.com" target="_blank" className="underline font-medium">developers.facebook.com <ExternalLink size={12} className="inline" /></a> → Create App → Business type</li>
              <li>Add <strong>WhatsApp</strong> product to your app</li>
              <li>Go to <strong>WhatsApp → API Setup</strong> → copy the <strong>Phone Number ID</strong></li>
              <li>Go to <strong>Business Settings → System Users → Add System User</strong> (Admin role)</li>
              <li>Click the system user → <strong>Generate New Token</strong> → select your app → grant <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> permissions → copy the token</li>
              <li>Go to <strong>WhatsApp → API Setup</strong> → copy the <strong>WhatsApp Business Account ID</strong> (WABA ID) — this is different from Phone Number ID</li>
              <li>Paste all 3 values below and click Save</li>
            </ol>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-800 text-xs">
              ⚠️ <strong>Important:</strong> Use a fresh SIM that has never been registered on personal WhatsApp. Register it through Meta Business — do NOT use your own phone number.
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Phone Number ID</Label>
          <Input
            placeholder="e.g. 123456789012345"
            value={metaPhoneId}
            onChange={(e) => setMetaPhoneId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Found in Meta Developer Console → WhatsApp → API Setup</p>
        </div>
        <div className="space-y-2">
          <Label>Permanent Access Token</Label>
          <Input
            type="password"
            placeholder="EAAxxxxxxxxxxxxx..."
            value={metaToken}
            onChange={(e) => setMetaToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Generate from Business Settings → System Users → Generate Token</p>
        </div>
        <div className="space-y-2">
          <Label>WABA ID (WhatsApp Business Account ID)</Label>
          <Input
            placeholder="e.g. 987654321098765"
            value={metaWabaId}
            onChange={(e) => setMetaWabaId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Needed to submit and check templates. Found in API Setup page.</p>
        </div>
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={handleSaveMeta} disabled={savingMeta}>
          {savingMeta ? "Saving..." : "Save & Use Meta API"}
        </Button>

        {/* Template management */}
        {metaPhoneId && metaToken && metaWabaId && (
          <div className="border rounded-lg p-4 space-y-4 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Message Templates</p>
                <p className="text-xs text-muted-foreground">Submit one at a time. Wait for approval before submitting the next.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCheckTemplates} disabled={loadingTemplates}>
                {loadingTemplates ? "Checking..." : "Check Status"}
              </Button>
            </div>

            <div className="space-y-2">
              {STARTER_TEMPLATES.map((tpl) => {
                const existing = metaTemplates.find((t: any) => t.name === tpl.name);
                const status = existing?.status;
                return (
                  <div key={tpl.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono text-gray-700">{tpl.name}</code>
                        {status === "APPROVED" && <Badge className="bg-green-100 text-green-700 text-[10px]"><CheckCircle2 size={10} className="mr-0.5" />Approved</Badge>}
                        {status === "PENDING" && <Badge className="bg-amber-100 text-amber-700 text-[10px]"><Clock size={10} className="mr-0.5" />Pending review</Badge>}
                        {status === "REJECTED" && <Badge className="bg-red-100 text-red-700 text-[10px]"><XCircle size={10} className="mr-0.5" />Rejected</Badge>}
                        {!existing && <Badge variant="outline" className="text-[10px]">Not submitted</Badge>}
                        {tpl.submitFirst && !existing && <Badge className="bg-[#1B4332]/10 text-[#1B4332] text-[10px]">Submit this first</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{tpl.bodyText}</p>
                    </div>
                    {!existing && (
                      <Button size="sm" variant="outline" className="shrink-0"
                        onClick={() => handleSubmitTemplate(tpl.name)}
                        disabled={submittingTemplate === tpl.name}>
                        {submittingTemplate === tpl.name ? "Submitting..." : "Submit"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
              ⚠️ Submit templates <strong>one at a time</strong>, spaced at least 24–48h apart. Submitting many at once is what got the previous number banned.
            </p>
          </div>
        )}
      </section>

      {/* WhatsApp / WATI (Legacy) */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-2 text-muted-foreground">WhatsApp (WATI — Legacy)</h2>
        <p className="text-xs text-muted-foreground">
          Only use this if you already have a working WATI account. New schools should use Meta Cloud API above.
        </p>
        <div className="space-y-2">
          <Label>API Endpoint</Label>
          <Input placeholder="https://live-mt-server.wati.io/XXXXX" {...field("wati_endpoint")} />
        </div>
        <div className="space-y-2">
          <Label>API Token</Label>
          <Input
            type="password"
            placeholder="eyJhbGci..."
            value={form.wati_token ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, wati_token: e.target.value }))
            }
          />
        </div>
        {form.wati_endpoint && form.wati_token && (
          <p className="text-xs text-green-600 font-medium">WATI credentials saved — WhatsApp notifications are active.</p>
        )}
      </section>

      <Button
        className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Settings"}
      </Button>

      {/* Change Password */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Change Password</h2>
        <div className="space-y-2">
          <Label>Current Password</Label>
          <Input type="password" placeholder="Enter current password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
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
            <button type="button" onClick={() => setShowNewPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Confirm New Password</Label>
          <Input type="password" placeholder="Re-enter new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
        <Button variant="outline" onClick={handleChangePassword} disabled={savingPw}>
          {savingPw ? "Updating..." : "Update Password"}
        </Button>
      </section>
    </div>
  );
}
