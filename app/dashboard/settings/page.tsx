"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { School } from "@/types/database";

type SchoolForm = Pick<School, "name" | "address" | "city" | "phone" | "jazzcash_merchant_id" | "easypaisa_merchant_id">;

export default function SettingsPage() {
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SchoolForm>({
    name: "",
    address: "",
    city: "",
    phone: "",
    jazzcash_merchant_id: "",
    easypaisa_merchant_id: "",
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
        const s = school as School;
        setForm({
          name: s.name ?? "",
          address: s.address ?? "",
          city: s.city ?? "",
          phone: s.phone ?? "",
          jazzcash_merchant_id: s.jazzcash_merchant_id ?? "",
          easypaisa_merchant_id: s.easypaisa_merchant_id ?? "",
        });
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

      {/* WhatsApp placeholder */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900 border-b pb-2">WhatsApp (WATI)</h2>
        <p className="text-xs text-muted-foreground">
          WATI integration coming soon. Attendance alerts, fee reminders, and announcements will be delivered via WhatsApp once configured.
        </p>
        <div className="space-y-2">
          <Label className="text-muted-foreground">WATI API Endpoint</Label>
          <Input placeholder="https://..." disabled className="opacity-50" />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">WATI API Token</Label>
          <Input placeholder="Coming soon" disabled className="opacity-50" />
        </div>
      </section>

      <Button
        className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
