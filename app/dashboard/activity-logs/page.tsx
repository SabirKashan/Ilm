"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Users, BookOpen, CreditCard, CalendarCheck, Megaphone, Settings2 } from "lucide-react";

type LogRow = {
  id: string;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_label: string | null;
  created_at: string;
};

const ACTION_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  added_student:      { label: "Added Student",      color: "bg-green-100 text-green-800",  icon: Users },
  updated_student:    { label: "Updated Student",    color: "bg-blue-100 text-blue-800",    icon: Users },
  deleted_student:    { label: "Removed Student",    color: "bg-red-100 text-red-800",      icon: Users },
  promoted_students:  { label: "Promoted Students",  color: "bg-purple-100 text-purple-800",icon: Users },
  marked_attendance:  { label: "Marked Attendance",  color: "bg-yellow-100 text-yellow-800",icon: CalendarCheck },
  generated_fees:     { label: "Generated Fees",     color: "bg-orange-100 text-orange-800",icon: CreditCard },
  fee_paid:           { label: "Fee Marked Paid",    color: "bg-green-100 text-green-800",  icon: CreditCard },
  added_exam:         { label: "Added Exam",         color: "bg-indigo-100 text-indigo-800",icon: BookOpen },
  entered_marks:      { label: "Entered Marks",      color: "bg-indigo-100 text-indigo-800",icon: BookOpen },
  sent_announcement:  { label: "Announcement Sent",  color: "bg-pink-100 text-pink-800",    icon: Megaphone },
  updated_settings:   { label: "Updated Settings",   color: "bg-gray-100 text-gray-800",    icon: Settings2 },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

const PAGE_SIZE = 30;

export default function ActivityLogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const { data } = await supabase
        .from("activity_logs")
        .select("id, user_name, action, entity_type, entity_label, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE);
      const rows = (data ?? []) as LogRow[];
      setLogs(rows);
      setHasMore(rows.length === PAGE_SIZE + 1);
      if (rows.length === PAGE_SIZE + 1) rows.pop();
      setLoading(false);
    }
    load();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="text-[#1B4332]" size={24} />
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332]">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">Track every action taken in your school</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p>No activity yet. Actions will appear here as your team works.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const meta = ACTION_META[log.action] ?? {
              label: log.action.replace(/_/g, " "),
              color: "bg-gray-100 text-gray-800",
              icon: ClipboardList,
            };
            const Icon = meta.icon;
            return (
              <div
                key={log.id}
                className="flex items-start gap-4 bg-white border border-border rounded-xl px-4 py-3"
              >
                <div className="mt-0.5 w-8 h-8 rounded-full bg-[#1B4332]/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-[#1B4332]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs font-medium ${meta.color} border-0`}>
                      {meta.label}
                    </Badge>
                    {log.entity_label && (
                      <span className="text-sm font-medium text-foreground truncate">
                        {log.entity_label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.user_name ? `By ${log.user_name}` : "System"} · {timeAgo(log.created_at)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-1">
                  {new Date(log.created_at).toLocaleTimeString("en-PK", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex justify-between pt-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm text-[#1B4332] disabled:opacity-40 font-medium"
          >
            ← Newer
          </button>
          <button
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-[#1B4332] disabled:opacity-40 font-medium"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
