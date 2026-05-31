"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { MessageCircle, Send, RefreshCw, User } from "lucide-react";
import { displayPakistaniPhone } from "@/lib/utils";

type Msg = {
  id: string;
  phone: string;
  direction: "inbound" | "outbound";
  body: string;
  student_name: string | null;
  read_at: string | null;
  sent_at: string;
};

type Thread = {
  phone: string;
  student_name: string | null;
  lastMsg: string;
  lastTime: string;
  unread: number;
  messages: Msg[];
};

export default function InboxPage() {
  const supabase = createClient();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("id, phone, direction, body, student_name, read_at, sent_at")
      .order("sent_at", { ascending: false })
      .limit(500) as { data: Msg[] | null; error: unknown };

    const msgs = data ?? [];

    // Group into threads by phone
    const map = new Map<string, Thread>();
    for (const m of msgs) {
      if (!map.has(m.phone)) {
        map.set(m.phone, { phone: m.phone, student_name: m.student_name, lastMsg: m.body, lastTime: m.sent_at, unread: 0, messages: [] });
      }
      const t = map.get(m.phone)!;
      t.messages.push(m);
      if (m.direction === "inbound" && !m.read_at) t.unread++;
    }

    // Sort threads by most recent
    const sorted = Array.from(map.values()).sort((a, b) => b.lastTime.localeCompare(a.lastTime));

    setThreads(sorted);
    setLoading(false);

    // Re-select updated thread if one is open
    setSelected((prev) => {
      if (!prev) return null;
      return sorted.find((t) => t.phone === prev.phone) ?? null;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  async function openThread(thread: Thread) {
    setSelected(thread);
    setReply("");

    // Mark all inbound messages in this thread as read
    const unreadIds = thread.messages
      .filter((m) => m.direction === "inbound" && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await (supabase as any)
        .from("whatsapp_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
      await fetchMessages();
    }
  }

  async function handleReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const res = await fetch("/api/whatsapp/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: selected.phone, message: reply.trim() }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      toast.error(json.error ?? "Failed to send");
      return;
    }
    setReply("");
    toast.success("Sent");
    await fetchMessages();
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  }

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 overflow-hidden rounded-xl border bg-white">

      {/* Thread list */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">WhatsApp Inbox</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-muted-foreground">{totalUnread} unread</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-3">
              {[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageCircle size={40} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                When parents reply to WhatsApp messages, they&apos;ll appear here.
              </p>
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.phone}
                onClick={() => openThread(t)}
                className={`w-full text-left p-3 border-b hover:bg-gray-50 transition-colors ${selected?.phone === t.phone ? "bg-[#1B4332]/5 border-l-2 border-l-[#1B4332]" : ""}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#1B4332]/10 flex items-center justify-center shrink-0">
                    <User size={16} className="text-[#1B4332]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {t.student_name ?? displayPakistaniPhone(t.phone)}
                      </span>
                      {t.unread > 0 && (
                        <Badge className="bg-[#1B4332] text-white text-[10px] h-4 px-1.5 shrink-0">{t.unread}</Badge>
                      )}
                    </div>
                    {t.student_name && (
                      <p className="text-[11px] text-muted-foreground">{displayPakistaniPhone(t.phone)}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.lastMsg}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation view */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-4 border-b bg-gray-50">
            <p className="font-semibold text-gray-900">{selected.student_name ?? displayPakistaniPhone(selected.phone)}</p>
            {selected.student_name && <p className="text-xs text-muted-foreground">{displayPakistaniPhone(selected.phone)}</p>}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {[...selected.messages].reverse().map((m) => (
              <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.direction === "outbound"
                    ? "bg-[#1B4332] text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-900 rounded-bl-sm"
                }`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.direction === "outbound" ? "text-white/60 text-right" : "text-gray-400"}`}>
                    {new Date(m.sent_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {new Date(m.sent_at).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          <div className="p-3 border-t bg-white">
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2">
              ⏱ Free-text replies work within 24h of the parent&apos;s last message. After that, use a WhatsApp template.
            </div>
            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="Type a reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                className="resize-none"
              />
              <Button
                className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white self-end"
                onClick={handleReply}
                disabled={sending || !reply.trim()}
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <MessageCircle size={48} className="text-gray-200 mb-4" />
          <p className="text-gray-500 font-medium">Select a conversation</p>
          <p className="text-sm text-muted-foreground mt-1">Parent replies to your WhatsApp messages appear here.</p>
        </div>
      )}
    </div>
  );
}
