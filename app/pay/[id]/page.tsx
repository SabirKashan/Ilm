"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { use } from "react";

type Voucher = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  students: { name: string; father_name: string | null; classes: { name: string } | null } | null;
  fee_types: { name: string } | null;
  schools: { name: string; address: string | null; city: string | null; phone: string | null } | null;
};

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [payMethod, setPayMethod] = useState<"easypaisa" | "jazzcash" | "bank" | "cash">("easypaisa");
  const [txnId, setTxnId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/fees/pay?id=${id}`);
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setVoucher(data as Voucher);
      setLoading(false);
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!voucher) return;
    setSubmitting(true);

    const res = await fetch("/api/fees/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, payment_method: payMethod, transaction_id: txnId.trim() || null }),
    });

    if (res.ok) {
      setDone(true);
      setVoucher((v) => v ? { ...v, status: "paid", paid_at: new Date().toISOString() } : v);
    }
    setSubmitting(false);
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !voucher) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Voucher not found</h1>
        <p className="text-sm text-muted-foreground mt-2">This payment link is invalid or has expired.</p>
      </div>
    );
  }

  const effStatus = voucher.status === "paid"
    ? "paid"
    : new Date(voucher.due_date) < new Date() ? "overdue" : "pending";

  const school = voucher.schools;
  const student = voucher.students;

  // ── Already paid ──
  if (voucher.status === "paid" || done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Payment Recorded!</h1>
          <p className="text-sm text-muted-foreground">
            Rs {Number(voucher.amount).toLocaleString()} for {student?.name} has been marked as paid.
          </p>
          {voucher.paid_at && (
            <p className="text-xs text-muted-foreground">Paid on {formatDate(voucher.paid_at)}</p>
          )}
          <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee Type</span>
              <span className="font-medium">{voucher.fee_types?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">Rs {Number(voucher.amount).toLocaleString()}</span>
            </div>
            {voucher.payment_method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium capitalize">{voucher.payment_method}</span>
              </div>
            )}
            {voucher.transaction_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ref #</span>
                <span className="font-medium font-mono text-xs">{voucher.transaction_id}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Keep this page as your receipt.</p>
        </div>
      </div>
    );
  }

  // ── Payment form ──
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-sm mx-auto space-y-4">

        {/* School header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-[#1B4332] rounded-xl flex items-center justify-center mx-auto mb-2">
            <span className="text-[#F59E0B] text-xl font-bold">R</span>
          </div>
          <h1 className="font-bold text-gray-900">{school?.name ?? "School"}</h1>
          {(school?.address || school?.city) && (
            <p className="text-xs text-muted-foreground">
              {[school.address, school.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {/* Voucher summary */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Fee Voucher</h2>
            {effStatus === "overdue" ? (
              <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle size={11} /> OVERDUE
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Clock size={11} /> PENDING
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student</span>
              <span className="font-medium">{student?.name}</span>
            </div>
            {student?.father_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Father</span>
                <span className="font-medium">{student.father_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Class</span>
              <span className="font-medium">{student?.classes?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee Type</span>
              <span className="font-medium">{voucher.fee_types?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className={`font-medium ${effStatus === "overdue" ? "text-red-600" : ""}`}>
                {formatDate(voucher.due_date)}
              </span>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Amount Due</span>
              <span className="text-2xl font-bold text-[#1B4332]">
                Rs {Number(voucher.amount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Confirm Payment</h2>

          {/* Payment method selector */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["easypaisa", "jazzcash", "bank", "cash"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayMethod(m)}
                  className={`py-2.5 px-3 rounded-xl border text-sm font-medium capitalize transition-all ${
                    payMethod === m
                      ? "border-[#1B4332] bg-[#1B4332]/5 text-[#1B4332]"
                      : "border-gray-200 text-muted-foreground hover:border-gray-300"
                  }`}
                >
                  {m === "easypaisa" ? "Easypaisa" : m === "jazzcash" ? "JazzCash" : m === "bank" ? "Bank Transfer" : "Cash"}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction ID (not required for cash) */}
          {payMethod !== "cash" && (
            <div className="space-y-2">
              <Label htmlFor="txn">Transaction Reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="txn"
                placeholder="e.g. EP123456789"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
              />
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">⚠️ Important Notice</p>
            <p>
              This form only records your <strong>self-reported payment</strong>. It does not process or transfer any money.
              Your school will verify the payment and update the status. Keep your transaction reference as proof.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white py-5 text-base font-semibold"
            disabled={submitting}
          >
            {submitting ? "Recording…" : "Confirm Payment ✓"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By confirming, you declare that payment of Rs {Number(voucher.amount).toLocaleString()} has been made to the school directly.
          </p>
        </form>
      </div>
    </div>
  );
}
