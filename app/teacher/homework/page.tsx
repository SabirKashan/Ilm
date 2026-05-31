"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookText, AlertCircle, MessageCircle, Check } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Homework } from "@/types/database";

type ClassRow = { id: string; name: string };
type HwRow = Homework & { classes?: { name: string } | null };

export default function TeacherHomeworkPage() {
  const supabase = createClient();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [items, setItems] = useState<HwRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [noClass, setNoClass] = useState(false);
  const [saving, setSaving] = useState(false);

  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Load classes once
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("users").select("school_id").eq("id", user.id).single() as
        { data: { school_id: string } | null; error: unknown };
      if (!profile) return;
      const { data: cls } = await supabase
        .from("classes").select("id, name")
        .eq("school_id", profile.school_id)
        .eq("teacher_id", user.id)
        .order("name") as { data: ClassRow[] | null; error: unknown };
      if (!cls || cls.length === 0) { setNoClass(true); setLoading(false); return; }
      setClasses(cls);
      setClassId(cls[0].id);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchItems = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const { data: hw } = await supabase
      .from("homework").select("*, classes(name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: false }).limit(30);
    setItems((hw ?? []) as HwRow[]);
    setLoading(false);
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handlePost() {
    if (!classId || !title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const res = await fetch("/api/homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, subject: subject.trim(), title: title.trim(), details: details.trim(), dueDate: dueDate || null }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
    if (json.watiEnabled) toast.success(`Sent to ${json.sentCount} parent${json.sentCount !== 1 ? "s" : ""} on WhatsApp`);
    else toast.success("Homework posted");
    setSubject(""); setTitle(""); setDetails(""); setDueDate("");
    fetchItems();
  }

  if (noClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle size={48} className="text-amber-400 mb-4" />
        <h2 className="text-lg font-semibold">No class assigned</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">Ask your admin to assign you to a class first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
          <p className="text-sm text-muted-foreground">Parents get it on WhatsApp instantly</p>
        </div>
        {classes.length > 1 && (
          <Select value={classId ?? ""} onValueChange={(v) => v && setClassId(v)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Quick post form */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Subject (optional)</Label>
            <Input placeholder="Maths" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Due date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Homework *</Label>
          <Input placeholder="e.g. Ch.5 Q1–Q10" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Details (optional)</Label>
          <Textarea placeholder="Any extra instructions for parents…" value={details} onChange={(e) => setDetails(e.target.value)} rows={2} />
        </div>
        <Button className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={handlePost} disabled={saving || !title.trim()}>
          {saving ? "Sending…" : "Post & Send to Parents"}
        </Button>
      </div>

      {/* Recent */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Recent</h2>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
            <BookText size={32} className="text-gray-300 mb-2" />
            <p className="text-sm text-muted-foreground">Nothing posted yet for this class.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((h) => (
              <div key={h.id} className="bg-white border rounded-xl p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {h.subject && <span className="text-xs font-medium text-[#1B4332]">{h.subject}</span>}
                  {h.whatsapp_sent && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1 text-xs">
                      <MessageCircle size={11} /> {h.recipient_count}
                    </Badge>
                  )}
                </div>
                <p className="font-medium text-sm text-gray-900 mt-1">{h.title}</p>
                {h.details && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{h.details}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(h.created_at)}</span>
                  {h.due_date && <span className="flex items-center gap-1"><Check size={11} /> Due {formatDate(h.due_date)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
