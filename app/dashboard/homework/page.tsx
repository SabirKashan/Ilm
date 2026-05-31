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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, BookText, Check, Trash2, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Class, Homework } from "@/types/database";

type HwRow = Homework & { classes?: { name: string } | null };

export default function HomeworkPage() {
  const supabase = createClient();

  const [classes, setClasses] = useState<Pick<Class, "id" | "name">[]>([]);
  const [items, setItems] = useState<HwRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<HwRow | null>(null);

  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: cls }, { data: hw }] = await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("homework").select("*, classes(name)").order("created_at", { ascending: false }).limit(50),
    ]);
    setClasses((cls ?? []) as Pick<Class, "id" | "name">[]);
    setItems((hw ?? []) as HwRow[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  function resetForm() {
    setClassId(""); setSubject(""); setTitle(""); setDetails(""); setDueDate("");
  }

  async function handlePost() {
    if (!classId || !title.trim()) { toast.error("Class and title are required"); return; }
    setSaving(true);
    const res = await fetch("/api/homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, subject: subject.trim(), title: title.trim(), details: details.trim(), dueDate: dueDate || null }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Failed to post homework"); return; }

    if (json.watiEnabled) {
      toast.success(`Homework posted — sent to ${json.sentCount} parent${json.sentCount !== 1 ? "s" : ""} on WhatsApp`);
    } else {
      toast.success(`Homework posted (${json.recipientCount} parents — add WATI in Settings to send on WhatsApp)`);
    }
    setShowAdd(false);
    resetForm();
    fetchData();
  }

  async function handleDelete() {
    if (!deleteItem) return;
    const { error } = await supabase.from("homework").delete().eq("id", deleteItem.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Homework deleted");
    setItems((prev) => prev.filter((h) => h.id !== deleteItem.id));
    setDeleteItem(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homework & Diary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Post homework — parents get it instantly on WhatsApp</p>
        </div>
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
          <Plus size={16} className="mr-1" /> Post Homework
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[#1B4332]/20 rounded-xl">
          <BookText size={48} className="text-[#1B4332]/30 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-1">No homework posted yet</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            Post today&apos;s homework or a diary note. Every parent in the class gets it on WhatsApp.
          </p>
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="mr-1" /> Post Homework
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((h) => (
            <div key={h.id} className="bg-white border rounded-xl p-4 group">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{h.classes?.name ?? "Class"}</Badge>
                    {h.subject && <span className="text-xs font-medium text-[#1B4332]">{h.subject}</span>}
                    {h.whatsapp_sent ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1 text-xs">
                        <MessageCircle size={11} /> Sent to {h.recipient_count}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Not sent</Badge>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 mt-1.5">{h.title}</p>
                  {h.details && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{h.details}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Posted {formatDate(h.created_at)}</span>
                    {h.due_date && <span className="flex items-center gap-1"><Check size={12} /> Due {formatDate(h.due_date)}</span>}
                    {h.created_by_name && <span>by {h.created_by_name}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm"
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => setDeleteItem(h)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Post Homework / Diary</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject (optional)</Label>
              <Input placeholder="e.g. Mathematics" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="e.g. Chapter 5 exercises" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Details (optional)</Label>
              <Textarea placeholder="Q1–Q10 on page 42. Bring graph paper." value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={handlePost} disabled={saving || !classId || !title.trim()}>
              {saving ? "Posting…" : "Post & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => { if (!o) setDeleteItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Homework</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteItem?.title}</strong>? This only removes it from the app — any WhatsApp messages already sent can&apos;t be unsent.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
