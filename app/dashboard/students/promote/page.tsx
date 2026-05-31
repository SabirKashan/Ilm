"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowUpCircle, Users } from "lucide-react";
import type { Class } from "@/types/database";

type Student = { id: string; name: string; roll_number: string | null; father_name: string | null };

export default function PromoteStudentsPage() {
  const supabase = createClient();

  const [classes, setClasses] = useState<Class[]>([]);
  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("classes").select("*").order("name");
      setClasses((data ?? []) as Class[]);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadStudents() {
      if (!fromClassId) { setStudents([]); setSelected(new Set()); return; }
      setLoadingStudents(true);
      const { data } = await supabase
        .from("students")
        .select("id, name, roll_number, father_name")
        .eq("class_id", fromClassId)
        .eq("status", "active")
        .order("name");
      const rows = (data ?? []) as Student[];
      setStudents(rows);
      setSelected(new Set(rows.map((s) => s.id))); // select all by default
      setLoadingStudents(false);
    }
    loadStudents();
  }, [fromClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleAll() {
    if (selected.size === students.length) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handlePromote() {
    if (!fromClassId || !toClassId) { toast.error("Select both classes"); return; }
    if (fromClassId === toClassId) { toast.error("From and To classes must be different"); return; }
    if (selected.size === 0) { toast.error("Select at least one student"); return; }

    setPromoting(true);
    const ids = Array.from(selected);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("students") as any)
      .update({ class_id: toClassId })
      .in("id", ids);

    if (error) {
      toast.error(error.message);
    } else {
      const toName = classes.find((c) => c.id === toClassId)?.name ?? "new class";
      toast.success(`${ids.length} student${ids.length > 1 ? "s" : ""} promoted to ${toName}`);
      // Reload
      setFromClassId("");
      setToClassId("");
      setStudents([]);
      setSelected(new Set());
    }
    setPromoting(false);
  }

  const fromClasses = classes;
  const toClasses = classes.filter((c) => c.id !== fromClassId);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="text-[#1B4332]" size={24} />
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332]">Promote Students</h1>
          <p className="text-sm text-muted-foreground">Move students from one class to the next at year end</p>
        </div>
      </div>

      {/* Class selectors */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>From Class</Label>
            <Select value={fromClassId} onValueChange={(v) => { setFromClassId(v ?? ""); setToClassId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select current class" /></SelectTrigger>
              <SelectContent>
                {fromClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Promote To</Label>
            <Select value={toClassId} onValueChange={(v) => setToClassId(v ?? "")} disabled={!fromClassId}>
              <SelectTrigger><SelectValue placeholder="Select next class" /></SelectTrigger>
              <SelectContent>
                {toClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Student list */}
      {fromClassId && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={students.length > 0 && selected.size === students.length}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All ({selected.size}/{students.length})
              </label>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users size={12} /> {students.length} active students
            </span>
          </div>

          {loadingStudents ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No active students in this class</div>
          ) : (
            <div className="divide-y">
              {students.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer"
                  onClick={() => toggle(s.id)}
                >
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.name}</p>
                    {s.father_name && <p className="text-xs text-muted-foreground">S/O {s.father_name}</p>}
                  </div>
                  {s.roll_number && (
                    <span className="text-xs text-muted-foreground">Roll #{s.roll_number}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action */}
      {fromClassId && (
        <div className="flex justify-end">
          <Button
            onClick={handlePromote}
            disabled={promoting || selected.size === 0 || !toClassId}
            className="bg-[#1B4332] hover:bg-[#1B4332]/90 gap-2"
          >
            <ArrowUpCircle size={16} />
            {promoting ? "Promoting…" : `Promote ${selected.size} Student${selected.size !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}
