import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPKR, formatDate } from "@/lib/utils";
import { Users, GraduationCap, CreditCard, AlertCircle, CalendarCheck, BookOpen } from "lucide-react";
import { Suspense } from "react";
import type { DbUser, School, FeeVoucher, Attendance as AttendanceRow } from "@/types/database";
import { FeeTrendChart, StudentDistribution } from "@/components/dashboard/charts";

async function OverviewStats() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("school_id, name")
    .eq("id", user.id)
    .single() as { data: Pick<DbUser, "school_id" | "name"> | null; error: unknown };

  if (!profile) redirect("/auth/login");

  const schoolId = profile.school_id;
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  // Parallel data fetches
  const [
    { count: totalStudents },
    { count: totalTeachers },
    { count: totalClasses },
    { data: paidVouchers },
    { count: outstandingFees },
    { data: todayAttendance },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("role", "teacher"),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("fee_vouchers")
      .select("amount")
      .eq("school_id", schoolId)
      .eq("status", "paid")
      .gte("paid_at", monthStart)
      .lte("paid_at", monthEnd),
    supabase
      .from("fee_vouchers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("status", ["pending", "overdue"]),
    supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .eq("date", today),
  ]);

  const vouchers = (paidVouchers ?? []) as Pick<FeeVoucher, "amount">[];
  const attendance = (todayAttendance ?? []) as Pick<AttendanceRow, "status">[];
  const feesCollected = vouchers.reduce((sum, v) => sum + (v.amount ?? 0), 0);
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const attendancePct =
    attendance.length > 0
      ? Math.round((presentCount / attendance.length) * 100)
      : null;

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .single() as { data: Pick<School, "name"> | null; error: unknown };

  // ── Chart data ──────────────────────────────────────────────
  // Fee collection trend: last 6 months of paid vouchers
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const { data: trendRaw } = await supabase
    .from("fee_vouchers")
    .select("amount, paid_at")
    .eq("school_id", schoolId)
    .eq("status", "paid")
    .gte("paid_at", sixMonthsAgo) as { data: { amount: number; paid_at: string }[] | null; error: unknown };

  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendData: { label: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthAmount = (trendRaw ?? [])
      .filter((v) => {
        if (!v.paid_at) return false;
        const pd = new Date(v.paid_at);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      })
      .reduce((sum, v) => sum + (v.amount ?? 0), 0);
    trendData.push({ label: MONTH_LABELS[d.getMonth()], amount: monthAmount });
  }

  // Student distribution by class
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name") as { data: { id: string; name: string }[] | null; error: unknown };

  const { data: studentClassRows } = await supabase
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("status", "active") as { data: { class_id: string | null }[] | null; error: unknown };

  const distData = (classRows ?? [])
    .map((c) => ({
      label: c.name,
      count: (studentClassRows ?? []).filter((s) => s.class_id === c.id).length,
    }))
    .filter((d) => d.count > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{school?.name ?? "Dashboard"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{formatDate(today)}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Total Students */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
            <Users size={18} className="text-[#1B4332]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {totalStudents ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active students</p>
          </CardContent>
        </Card>

        {/* Total Teachers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Teachers
            </CardTitle>
            <GraduationCap size={18} className="text-[#1B4332]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {totalTeachers ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Staff members</p>
          </CardContent>
        </Card>

        {/* Total Classes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Classes
            </CardTitle>
            <BookOpen size={18} className="text-[#1B4332]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {totalClasses ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active classes</p>
          </CardContent>
        </Card>

        {/* Fees Collected */}
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fees Collected
            </CardTitle>
            <CreditCard size={18} className="text-[#F59E0B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatPKR(feesCollected)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        {/* Outstanding Fees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
            <AlertCircle size={18} className="text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {outstandingFees ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending vouchers</p>
          </CardContent>
        </Card>

        {/* Attendance Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Attendance Today
            </CardTitle>
            <CalendarCheck size={18} className="text-[#1B4332]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {attendancePct !== null ? `${attendancePct}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {attendancePct !== null
                ? `${presentCount} of ${attendance.length} students`
                : "Not marked yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {(totalStudents ?? 0) > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <FeeTrendChart data={trendData} />
          <StudentDistribution data={distData} />
        </div>
      )}

      {/* Empty state hint when school is freshly set up */}
      {(totalStudents === 0) && (
        <div className="mt-8 rounded-xl border-2 border-dashed border-[#1B4332]/20 bg-[#1B4332]/5 p-8 text-center">
          <div className="text-4xl mb-3">🏫</div>
          <h3 className="font-semibold text-gray-900 mb-1">Welcome to MyRahbar!</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Start by adding your classes and students. Everything else — attendance,
            fees, results — flows from there.
          </p>
        </div>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewStats />
    </Suspense>
  );
}
