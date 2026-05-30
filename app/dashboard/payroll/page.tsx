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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, CheckCircle2, Banknote } from "lucide-react";

type Teacher = { id: string; name: string };

type SalaryRow = {
  id: string;
  user_id: string;
  month: number;
  year: number;
  base_salary: number;
  advances_deducted: number;
  bonus: number;
  net_salary: number;
  paid_at: string | null;
  status: "pending" | "paid";
};

type AdvanceRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: string | null;
  requested_at: string;
  repaid: boolean;
  users: { name: string } | null;
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function PayrollPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"salaries" | "advances">("salaries");
  const [schoolId, setSchoolId] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());

  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [loadingSalaries, setLoadingSalaries] = useState(true);
  const [loadingAdvances, setLoadingAdvances] = useState(true);

  // Salary edit state — keyed by teacher id (for unsaved rows)
  const [editBase, setEditBase] = useState<Record<string, string>>({});
  const [editBonus, setEditBonus] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Advance dialog
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [advTeacherId, setAdvTeacherId] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advReason, setAdvReason] = useState("");
  const [savingAdv, setSavingAdv] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("school_id").eq("id", user.id).single();
      if (data) setSchoolId((data as { school_id: string }).school_id);
      const { data: t } = await supabase.from("users").select("id, name").eq("role", "teacher").order("name");
      setTeachers((t ?? []) as Teacher[]);
    }
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSalaries = useCallback(async () => {
    setLoadingSalaries(true);
    const { data } = await supabase
      .from("teacher_salaries")
      .select("*")
      .eq("month", selMonth)
      .eq("year", selYear)
      .order("user_id");
    setSalaries((data ?? []) as SalaryRow[]);
    setLoadingSalaries(false);
  }, [selMonth, selYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAdvances = useCallback(async () => {
    setLoadingAdvances(true);
    const { data } = await supabase
      .from("advances")
      .select("id, user_id, amount, reason, requested_at, repaid, users(name)")
      .order("requested_at", { ascending: false });
    setAdvances((data ?? []) as unknown as AdvanceRow[]);
    setLoadingAdvances(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);
  useEffect(() => { fetchAdvances(); }, [fetchAdvances]);

  // Teachers without a salary record this month
  const salaryMap = Object.fromEntries(salaries.map((s) => [s.user_id, s]));
  const teachersWithoutSalary = teachers.filter((t) => !salaryMap[t.id]);

  // Unpaid advance total per teacher
  const advanceByTeacher: Record<string, number> = {};
  for (const a of advances) {
    if (!a.repaid) advanceByTeacher[a.user_id] = (advanceByTeacher[a.user_id] ?? 0) + a.amount;
  }

  async function handleSaveOrUpdate(teacherId: string, existingSalary: SalaryRow | null) {
    const base = parseFloat(editBase[teacherId] ?? existingSalary?.base_salary ?? "0");
    const bonus = parseFloat(editBonus[teacherId] ?? existingSalary?.bonus ?? "0");
    if (isNaN(base) || base < 0) { toast.error("Enter a valid base salary"); return; }
    const advDed = advanceByTeacher[teacherId] ?? 0;
    const net = base + bonus - advDed;

    setSaving((p) => ({ ...p, [teacherId]: true }));

    if (existingSalary) {
      const { error } = await (supabase as any)
        .from("teacher_salaries")
        .update({ base_salary: base, bonus: isNaN(bonus) ? 0 : bonus, advances_deducted: advDed, net_salary: net })
        .eq("id", existingSalary.id);
      if (error) { toast.error(error.message); setSaving((p) => ({ ...p, [teacherId]: false })); return; }
    } else {
      const { error } = await (supabase as any)
        .from("teacher_salaries")
        .insert({
          school_id: schoolId,
          user_id: teacherId,
          month: selMonth,
          year: selYear,
          base_salary: base,
          bonus: isNaN(bonus) ? 0 : bonus,
          advances_deducted: advDed,
          net_salary: net,
          status: "pending",
        });
      if (error) { toast.error(error.message); setSaving((p) => ({ ...p, [teacherId]: false })); return; }
    }

    setSaving((p) => ({ ...p, [teacherId]: false }));
    toast.success("Salary saved");
    fetchSalaries();
  }

  async function handleMarkPaid(salary: SalaryRow) {
    const { error } = await (supabase as any)
      .from("teacher_salaries")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", salary.id);
    if (error) { toast.error(error.message); return; }
    setSalaries((prev) => prev.map((s) => s.id === salary.id ? { ...s, status: "paid", paid_at: new Date().toISOString() } : s));
    toast.success("Marked as paid");
  }

  async function handleAddAdvance() {
    if (!advTeacherId || !advAmount || !schoolId) return;
    const amount = parseFloat(advAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSavingAdv(true);
    const { error } = await (supabase as any).from("advances").insert({
      school_id: schoolId,
      user_id: advTeacherId,
      amount,
      reason: advReason.trim() || null,
      repaid: false,
    });
    setSavingAdv(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Advance recorded");
    setShowAddAdvance(false);
    setAdvTeacherId(""); setAdvAmount(""); setAdvReason("");
    fetchAdvances();
  }

  async function handleRepaid(advanceId: string) {
    const { error } = await (supabase as any).from("advances").update({ repaid: true }).eq("id", advanceId);
    if (error) { toast.error(error.message); return; }
    setAdvances((prev) => prev.map((a) => a.id === advanceId ? { ...a, repaid: true } : a));
    toast.success("Marked as repaid");
  }

  const totalPending = salaries.filter((s) => s.status === "pending").reduce((sum, s) => sum + s.net_salary, 0);
  const totalPaid = salaries.filter((s) => s.status === "paid").reduce((sum, s) => sum + s.net_salary, 0);

  const years = [selYear - 1, selYear, selYear + 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage teacher salaries and advances</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(["salaries", "advances"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              activeTab === tab
                ? "border-[#1B4332] text-[#1B4332]"
                : "border-transparent text-muted-foreground hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── SALARIES TAB ── */}
      {activeTab === "salaries" && (
        <div className="space-y-4">
          {/* Month/Year selector + summary */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex gap-2">
              <Select value={String(selMonth)} onValueChange={(v) => setSelMonth(parseInt(v ?? "1"))}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(selYear)} onValueChange={(v) => setSelYear(parseInt(v ?? String(now.getFullYear())))}>
                <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              {totalPending > 0 && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Rs {totalPending.toLocaleString()} pending</Badge>}
              {totalPaid > 0 && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Rs {totalPaid.toLocaleString()} paid</Badge>}
            </div>
          </div>

          {loadingSalaries ? (
            <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
              <Banknote size={40} className="text-[#1B4332]/30 mb-3" />
              <p className="text-sm text-muted-foreground">No teachers added yet.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Teacher</TableHead>
                    <TableHead>Base (Rs)</TableHead>
                    <TableHead className="hidden sm:table-cell">Bonus (Rs)</TableHead>
                    <TableHead className="hidden md:table-cell">Advances</TableHead>
                    <TableHead>Net (Rs)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((t) => {
                    const sal = salaryMap[t.id];
                    const base = editBase[t.id] ?? (sal ? String(sal.base_salary) : "");
                    const bonus = editBonus[t.id] ?? (sal ? String(sal.bonus) : "0");
                    const advDed = advanceByTeacher[t.id] ?? 0;
                    const net = (parseFloat(base) || 0) + (parseFloat(bonus) || 0) - advDed;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-sm">{t.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={base}
                            onChange={(e) => setEditBase((p) => ({ ...p, [t.id]: e.target.value }))}
                            disabled={sal?.status === "paid"}
                            className="h-8 w-28 text-sm"
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={bonus}
                            onChange={(e) => setEditBonus((p) => ({ ...p, [t.id]: e.target.value }))}
                            disabled={sal?.status === "paid"}
                            className="h-8 w-24 text-sm"
                          />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-red-600">
                          {advDed > 0 ? `− Rs ${advDed.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          {net > 0 ? `Rs ${net.toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell>
                          {sal?.status === "paid"
                            ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>
                            : <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {sal?.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={saving[t.id]}
                                onClick={() => handleSaveOrUpdate(t.id, sal ?? null)}
                              >
                                {saving[t.id] ? "..." : sal ? "Update" : "Save"}
                              </Button>
                            )}
                            {sal && sal.status === "pending" && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                                onClick={() => handleMarkPaid(sal)}
                              >
                                <CheckCircle2 size={11} className="mr-0.5" /> Paid
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── ADVANCES TAB ── */}
      {activeTab === "advances" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAddAdvance(true)}>
              <Plus size={16} className="mr-1" /> Record Advance
            </Button>
          </div>

          {loadingAdvances ? (
            <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : advances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
              <Banknote size={40} className="text-[#1B4332]/30 mb-3" />
              <p className="text-sm text-muted-foreground">No advances recorded yet.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Teacher</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Reason</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{a.users?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">Rs {a.amount.toLocaleString()}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{a.reason ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(a.requested_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        {a.repaid
                          ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Repaid</Badge>
                          : <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Outstanding</Badge>}
                      </TableCell>
                      <TableCell>
                        {!a.repaid && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRepaid(a.id)}>
                            Mark Repaid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── ADD ADVANCE DIALOG ── */}
      <Dialog open={showAddAdvance} modal={false} onOpenChange={(o) => {
        setShowAddAdvance(o);
        if (!o) { setAdvTeacherId(""); setAdvAmount(""); setAdvReason(""); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Advance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Teacher *</Label>
              <Select value={advTeacherId} onValueChange={(v) => setAdvTeacherId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select teacher..." /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (Rs) *</Label>
              <Input type="number" min="1" placeholder="e.g. 5000" value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="Optional" value={advReason} onChange={(e) => setAdvReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAdvance(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleAddAdvance}
              disabled={savingAdv || !advTeacherId || !advAmount}
            >
              {savingAdv ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
