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
import { Plus, CreditCard, Receipt, CheckCircle2, Send } from "lucide-react";
import type { Class, FeeType, FeeVoucherStatus } from "@/types/database";

type VoucherRow = {
  id: string;
  student_id: string;
  fee_type_id: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: FeeVoucherStatus;
  students: { name: string; class_id: string | null; classes: { name: string } | null } | null;
  fee_types: { name: string } | null;
};

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  annual: "Annual",
  "one-time": "One-time",
};

function effectiveStatus(v: VoucherRow): FeeVoucherStatus {
  if (v.status === "paid") return "paid";
  if (new Date(v.due_date) < new Date(new Date().toDateString())) return "overdue";
  return "pending";
}

function StatusBadge({ status }: { status: FeeVoucherStatus }) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
  if (status === "overdue") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
}

export default function FeesPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"vouchers" | "fee-types">("vouchers");
  const [schoolId, setSchoolId] = useState("");
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [filterClassId, setFilterClassId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Add Fee Type dialog
  const [showAddType, setShowAddType] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeAmount, setTypeAmount] = useState("");
  const [typeFreq, setTypeFreq] = useState<"monthly" | "annual" | "one-time">("monthly");
  const [savingType, setSavingType] = useState(false);

  // Generate Vouchers dialog
  const [showGenerate, setShowGenerate] = useState(false);
  const [genClassId, setGenClassId] = useState("");
  const [genFeeTypeId, setGenFeeTypeId] = useState("");
  const [genDueDate, setGenDueDate] = useState("");
  const [genStudents, setGenStudents] = useState<{ id: string; name: string }[]>([]);
  const [loadingGenStudents, setLoadingGenStudents] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Bootstrap: get school_id + user_id
  useEffect(() => {
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("users").select("school_id").eq("id", user.id).single();
      if (data) setSchoolId((data as { school_id: string }).school_id);
    }
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch classes and fee types on mount
  useEffect(() => {
    async function fetchMeta() {
      const [{ data: cls }, { data: types }] = await Promise.all([
        supabase.from("classes").select("*").order("name"),
        supabase.from("fee_types").select("*").order("name"),
      ]);
      setClasses((cls ?? []) as Class[]);
      setFeeTypes((types ?? []) as FeeType[]);
      setLoadingTypes(false);
    }
    fetchMeta();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchVouchers = useCallback(async () => {
    setLoadingVouchers(true);
    const query = supabase
      .from("fee_vouchers")
      .select("id, student_id, fee_type_id, amount, due_date, paid_at, status, students(name, class_id, classes(name)), fee_types(name)")
      .order("due_date", { ascending: false });

    const { data } = await query;
    setVouchers((data ?? []) as unknown as VoucherRow[]);
    setLoadingVouchers(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  // Fetch students when class changes in generate dialog
  useEffect(() => {
    if (!genClassId) { setGenStudents([]); return; }
    setLoadingGenStudents(true);
    supabase
      .from("students")
      .select("id, name")
      .eq("class_id", genClassId)
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        setGenStudents((data ?? []) as { id: string; name: string }[]);
        setLoadingGenStudents(false);
      });
  }, [genClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddFeeType() {
    if (!typeName.trim() || !typeAmount || !schoolId) return;
    const amount = parseFloat(typeAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSavingType(true);
    const { error } = await (supabase as any).from("fee_types").insert({
      school_id: schoolId,
      name: typeName.trim(),
      amount,
      frequency: typeFreq,
    });
    setSavingType(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${typeName.trim()} added`);
    setShowAddType(false);
    setTypeName(""); setTypeAmount(""); setTypeFreq("monthly");
    const { data } = await supabase.from("fee_types").select("*").order("name");
    setFeeTypes((data ?? []) as FeeType[]);
  }

  async function handleGenerate() {
    if (!genClassId || !genFeeTypeId || !genDueDate || genStudents.length === 0 || !schoolId) return;
    const feeType = feeTypes.find((f) => f.id === genFeeTypeId);
    if (!feeType) return;
    setGenerating(true);
    const rows = genStudents.map((s) => ({
      school_id: schoolId,
      student_id: s.id,
      fee_type_id: genFeeTypeId,
      amount: feeType.amount,
      due_date: genDueDate,
      status: "pending" as const,
      whatsapp_sent: false,
    }));
    const { error } = await (supabase as any).from("fee_vouchers").insert(rows);
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} vouchers generated`);
    setShowGenerate(false);
    setGenClassId(""); setGenFeeTypeId(""); setGenDueDate(""); setGenStudents([]);
    fetchVouchers();
  }

  async function handleMarkPaid(voucherId: string) {
    const { error } = await (supabase as any)
      .from("fee_vouchers")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", voucherId);
    if (error) { toast.error(error.message); return; }
    setVouchers((prev) =>
      prev.map((v) => v.id === voucherId ? { ...v, status: "paid", paid_at: new Date().toISOString() } : v)
    );
    toast.success("Marked as paid");
  }

  const filteredVouchers = vouchers.filter((v) => {
    const classMatch = filterClassId === "all" || v.students?.class_id === filterClassId;
    const eff = effectiveStatus(v);
    const statusMatch = filterStatus === "all" || eff === filterStatus;
    return classMatch && statusMatch;
  });

  const pendingTotal = vouchers.filter((v) => effectiveStatus(v) !== "paid").reduce((s, v) => s + v.amount, 0);
  const collectedTotal = vouchers.filter((v) => v.status === "paid").reduce((s, v) => s + v.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage fee types and payment vouchers</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">Rs {collectedTotal.toLocaleString()}</p>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-red-600 mt-1">Rs {pendingTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(["vouchers", "fee-types"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-[#1B4332] text-[#1B4332]"
                : "border-transparent text-muted-foreground hover:text-gray-700"
            }`}
          >
            {tab === "vouchers" ? "Vouchers" : "Fee Types"}
          </button>
        ))}
      </div>

      {/* ── VOUCHERS TAB ── */}
      {activeTab === "vouchers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Select value={filterClassId} onValueChange={(v) => setFilterClassId(v ?? "all")}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white h-9"
              onClick={() => setShowGenerate(true)}
            >
              <Plus size={15} className="mr-1" /> Generate Vouchers
            </Button>
          </div>

          {loadingVouchers ? (
            <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : filteredVouchers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
              <Receipt size={40} className="text-[#1B4332]/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {vouchers.length === 0 ? "No vouchers yet — generate some to get started" : "No vouchers match your filters"}
              </p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden sm:table-cell">Class</TableHead>
                    <TableHead>Fee Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden md:table-cell">Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVouchers.map((v) => {
                    const eff = effectiveStatus(v);
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-sm">{v.students?.name ?? "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {v.students?.classes?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">{v.fee_types?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm font-medium">Rs {v.amount.toLocaleString()}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {new Date(v.due_date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell><StatusBadge status={eff} /></TableCell>
                        <TableCell>
                          {eff !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleMarkPaid(v.id)}
                            >
                              <CheckCircle2 size={12} className="mr-1" /> Paid
                            </Button>
                          )}
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

      {/* ── FEE TYPES TAB ── */}
      {activeTab === "fee-types" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAddType(true)}>
              <Plus size={16} className="mr-1" /> Add Fee Type
            </Button>
          </div>

          {loadingTypes ? (
            <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : feeTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[#1B4332]/20 rounded-xl text-center">
              <CreditCard size={40} className="text-[#1B4332]/30 mb-3" />
              <p className="text-sm text-muted-foreground">No fee types yet. Add one to start generating vouchers.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeTypes.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>Rs {f.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{FREQUENCY_LABELS[f.frequency]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── ADD FEE TYPE DIALOG ── */}
      <Dialog open={showAddType} onOpenChange={(o) => { setShowAddType(o); if (!o) { setTypeName(""); setTypeAmount(""); setTypeFreq("monthly"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Fee Type</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Monthly Tuition" value={typeName} onChange={(e) => setTypeName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Amount (Rs) *</Label>
              <Input type="number" min="0" placeholder="e.g. 3500" value={typeAmount} onChange={(e) => setTypeAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={typeFreq} onValueChange={(v) => setTypeFreq((v ?? "monthly") as "monthly" | "annual" | "one-time")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddType(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleAddFeeType}
              disabled={savingType || !typeName.trim() || !typeAmount}
            >
              {savingType ? "Adding..." : "Add Fee Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GENERATE VOUCHERS DIALOG ── */}
      <Dialog open={showGenerate} onOpenChange={(o) => {
        setShowGenerate(o);
        if (!o) { setGenClassId(""); setGenFeeTypeId(""); setGenDueDate(""); setGenStudents([]); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Generate Vouchers</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fee Type *</Label>
              <Select value={genFeeTypeId} onValueChange={(v) => setGenFeeTypeId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select fee type..." /></SelectTrigger>
                <SelectContent>
                  {feeTypes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} — Rs {f.amount.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={genClassId} onValueChange={(v) => setGenClassId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date *</Label>
              <input
                type="date"
                value={genDueDate}
                onChange={(e) => setGenDueDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            {genClassId && (
              <p className="text-sm text-muted-foreground">
                {loadingGenStudents
                  ? "Loading students..."
                  : genStudents.length === 0
                  ? "No active students in this class"
                  : `Will generate ${genStudents.length} voucher${genStudents.length !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleGenerate}
              disabled={generating || !genClassId || !genFeeTypeId || !genDueDate || genStudents.length === 0}
            >
              {generating ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
