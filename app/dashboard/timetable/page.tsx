"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2, Pencil } from "lucide-react";
import type { Class } from "@/types/database";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
type Day = typeof DAYS[number];

type Subject = { id: string; name: string };
type Teacher = { id: string; name: string };
type Slot = {
  id: string;
  day: Day;
  period: number;
  start_time: string;
  end_time: string;
  subject_id: string | null;
  teacher_id: string | null;
  subjects: { name: string } | null;
  users: { name: string } | null;
};

export default function TimetablePage() {
  const supabase = createClient();

  const [schoolId, setSchoolId] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [formDay, setFormDay] = useState<Day>("Monday");
  const [formPeriod, setFormPeriod] = useState("1");
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("08:45");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("users").select("school_id").eq("id", user.id).single();
      if (!profile) return;
      const sid = (profile as { school_id: string }).school_id;
      setSchoolId(sid);

      const [{ data: cls }, { data: tch }] = await Promise.all([
        supabase.from("classes").select("*").eq("school_id", sid).order("name"),
        supabase.from("users").select("id, name").eq("school_id", sid).eq("role", "teacher").order("name"),
      ]);
      const classList = (cls ?? []) as Class[];
      setClasses(classList);
      setTeachers((tch ?? []) as Teacher[]);
      if (classList.length > 0) setSelectedClassId(classList[0].id);
      setLoading(false);
    }
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSlots = useCallback(async () => {
    if (!selectedClassId) return;
    const { data: sub } = await supabase.from("subjects").select("id, name").eq("class_id", selectedClassId).order("name");
    setSubjects((sub ?? []) as Subject[]);

    const { data } = await supabase
      .from("timetable_slots")
      .select("id, day, period, start_time, end_time, subject_id, teacher_id, subjects(name), users(name)")
      .eq("class_id", selectedClassId)
      .order("period");
    setSlots((data ?? []) as unknown as Slot[]);
  }, [selectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSlots(); }, [loadSlots]);

  function openAdd() {
    setEditSlot(null);
    setFormDay("Monday");
    setFormPeriod("1");
    setFormStart("08:00");
    setFormEnd("08:45");
    setFormSubjectId("");
    setFormTeacherId("");
    setShowDialog(true);
  }

  function openEdit(slot: Slot) {
    setEditSlot(slot);
    setFormDay(slot.day);
    setFormPeriod(String(slot.period));
    setFormStart(slot.start_time.slice(0, 5));
    setFormEnd(slot.end_time.slice(0, 5));
    setFormSubjectId(slot.subject_id ?? "");
    setFormTeacherId(slot.teacher_id ?? "");
    setShowDialog(true);
  }

  async function handleSave() {
    if (!formDay || !formPeriod || !formStart || !formEnd) {
      toast.error("Fill all required fields"); return;
    }
    setSaving(true);
    const payload = {
      school_id:  schoolId,
      class_id:   selectedClassId,
      day:        formDay,
      period:     parseInt(formPeriod),
      start_time: formStart,
      end_time:   formEnd,
      subject_id: formSubjectId || null,
      teacher_id: formTeacherId || null,
    };

    let error;
    if (editSlot) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error } = await (supabase.from("timetable_slots") as any).update(payload).eq("id", editSlot.id));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ error } = await (supabase.from("timetable_slots") as any).insert(payload));
    }

    if (error) {
      toast.error(error.message.includes("unique") ? "A slot already exists for that day & period" : error.message);
    } else {
      toast.success(editSlot ? "Slot updated" : "Slot added");
      setShowDialog(false);
      loadSlots();
    }
    setSaving(false);
  }

  async function handleDelete(slotId: string) {
    const { error } = await supabase.from("timetable_slots").delete().eq("id", slotId);
    if (error) toast.error(error.message);
    else { toast.success("Slot removed"); loadSlots(); }
  }

  // Group slots by day
  const byDay = DAYS.reduce<Record<Day, Slot[]>>((acc, d) => {
    acc[d] = slots.filter((s) => s.day === d).sort((a, b) => a.period - b.period);
    return acc;
  }, {} as Record<Day, Slot[]>);

  const activeDays = DAYS.filter((d) => byDay[d].length > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="text-[#1B4332]" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-[#1B4332]">Timetable</h1>
            <p className="text-sm text-muted-foreground">Manage class schedules by period</p>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-[#1B4332] hover:bg-[#1B4332]/90 gap-2">
          <Plus size={16} /> Add Slot
        </Button>
      </div>

      {/* Class selector */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-sm font-medium">Class:</Label>
        <Select value={selectedClassId} onValueChange={(v) => setSelectedClassId(v ?? "")}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : slots.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No timetable yet for this class</p>
          <p className="text-sm mt-1">Click "Add Slot" to build the schedule</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(activeDays.length > 0 ? activeDays : DAYS).map((day) => (
            <div key={day}>
              <h2 className="text-sm font-semibold text-[#1B4332] uppercase tracking-wide mb-2">{day}</h2>
              {byDay[day].length === 0 ? (
                <p className="text-xs text-muted-foreground pl-1">No periods</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byDay[day].map((slot) => (
                    <div key={slot.id} className="bg-white border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white bg-[#1B4332] rounded px-1.5 py-0.5">P{slot.period}</span>
                          <span className="text-xs text-muted-foreground">{slot.start_time.slice(0,5)} – {slot.end_time.slice(0,5)}</span>
                        </div>
                        <p className="font-medium text-sm mt-1">{slot.subjects?.name ?? <span className="text-muted-foreground italic">No subject</span>}</p>
                        {slot.users?.name && <p className="text-xs text-muted-foreground">{slot.users.name}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(slot)} className="p-1.5 rounded hover:bg-muted transition-colors">
                          <Pencil size={13} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(slot.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                          <Trash2 size={13} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSlot ? "Edit Slot" : "Add Timetable Slot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Day *</Label>
                <Select value={formDay} onValueChange={(v) => setFormDay(v as Day)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Period # *</Label>
                <Input type="number" min={1} max={10} value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Time *</Label>
                <Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time *</Label>
                <Input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={formSubjectId} onValueChange={(v) => setFormSubjectId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select value={formTeacherId} onValueChange={(v) => setFormTeacherId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
              {saving ? "Saving…" : editSlot ? "Update" : "Add Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
