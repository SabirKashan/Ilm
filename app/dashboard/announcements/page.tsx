"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Megaphone, Users, GraduationCap } from "lucide-react";
import type { Class } from "@/types/database";

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  target: "all" | "class";
  class_id: string | null;
  sent_at: string;
  whatsapp_sent: boolean;
  classes: { name: string } | null;
};

export default function AnnouncementsPage() {
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annTarget, setAnnTarget] = useState<"all" | "class">("all");
  const [annClassId, setAnnClassId] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchClasses() {
      const { data } = await supabase.from("classes").select("*").order("name");
      setClasses((data ?? []) as Class[]);
    }
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("id, title, message, target, class_id, sent_at, whatsapp_sent, classes(name)")
      .order("sent_at", { ascending: false });
    setAnnouncements((data ?? []) as unknown as AnnouncementRow[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  function resetDialog() {
    setAnnTitle(""); setAnnMessage(""); setAnnTarget("all"); setAnnClassId("");
  }

  async function handleSend() {
    if (!annTitle.trim() || !annMessage.trim()) return;
    if (annTarget === "class" && !annClassId) { toast.error("Select a class"); return; }

    setSending(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: annTitle.trim(),
        message: annMessage.trim(),
        target: annTarget,
        classId: annTarget === "class" ? annClassId : null,
      }),
    });
    const json = await res.json();
    setSending(false);

    if (!res.ok) { toast.error(json.error ?? "Failed to send announcement"); return; }

    const count = json.recipientCount ?? 0;
    toast.success(`Announcement sent to ${count} parent${count !== 1 ? "s" : ""}`);
    setShowCreate(false);
    resetDialog();
    fetchAnnouncements();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Broadcast messages to parents via WhatsApp</p>
        </div>
        <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-1" /> New Announcement
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
          <Megaphone size={48} className="text-[#1B4332]/30 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-1">No announcements yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Send your first announcement to parents.</p>
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowCreate(true)}>
            <Plus size={16} className="mr-1" /> New Announcement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="border rounded-xl p-4 bg-white space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <div className="flex gap-2 shrink-0">
                  {a.target === "all" ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
                      <Users size={11} /> All Parents
                    </Badge>
                  ) : (
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 gap-1">
                      <GraduationCap size={11} /> {a.classes?.name ?? "Class"}
                    </Badge>
                  )}
                  <Badge
                    className={a.whatsapp_sent
                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-100"}
                  >
                    {a.whatsapp_sent ? "Sent" : "Queued"}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{a.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.sent_at).toLocaleDateString("en-PK", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) resetDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. School closed tomorrow"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Write your message here..."
                value={annMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnnMessage(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Send To</Label>
              <Select value={annTarget} onValueChange={(v) => setAnnTarget((v ?? "all") as "all" | "class")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parents</SelectItem>
                  <SelectItem value="class">Specific Class</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {annTarget === "class" && (
              <div className="space-y-2">
                <Label>Class *</Label>
                <Select value={annClassId} onValueChange={(v) => setAnnClassId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleSend}
              disabled={sending || !annTitle.trim() || !annMessage.trim() || (annTarget === "class" && !annClassId)}
            >
              {sending ? "Sending..." : "Send Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
