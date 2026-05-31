"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useLang } from "@/components/lang-provider";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCog,
  CalendarCheck,
  CreditCard,
  BookOpen,
  Banknote,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  Languages,
  CalendarDays,
  ClipboardList,
  ArrowUpCircle,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",                    label: "Overview",       icon: LayoutDashboard },
  { href: "/dashboard/students",           label: "Students",       icon: Users },
  { href: "/dashboard/students/promote",   label: "Promote",        icon: ArrowUpCircle },
  { href: "/dashboard/classes",            label: "Classes",        icon: GraduationCap },
  { href: "/dashboard/teachers",           label: "Teachers",       icon: UserCog },
  { href: "/dashboard/attendance",         label: "Attendance",     icon: CalendarCheck },
  { href: "/dashboard/fees",               label: "Fees",           icon: CreditCard },
  { href: "/dashboard/exams",              label: "Exams",          icon: BookOpen },
  { href: "/dashboard/timetable",          label: "Timetable",      icon: CalendarDays },
  { href: "/dashboard/payroll",            label: "Payroll",        icon: Banknote   },
  { href: "/dashboard/announcements",      label: "Announcements",  icon: Megaphone  },
  { href: "/dashboard/reports",            label: "Reports",        icon: BarChart3  },
  { href: "/dashboard/activity-logs",      label: "Activity Logs",  icon: ClipboardList },
  { href: "/dashboard/settings",           label: "Settings",       icon: Settings   },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { lang, toggle } = useLang();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Logged out");
    router.replace("/auth/login");
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#1B4332] text-white shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="w-9 h-9 bg-[#F59E0B] rounded-lg flex items-center justify-center font-bold text-white text-lg">
          ع
        </div>
        <span className="font-bold text-lg tracking-tight">Ilm</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Language + Logout */}
      <div className="border-t border-white/10 p-4 space-y-1">
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-2 py-2 text-sm text-white/70 hover:text-white rounded-md hover:bg-white/10 transition-colors"
        >
          <Languages size={18} />
          {lang === "en" ? "اردو" : "English"}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-2 py-2 text-sm text-white/70 hover:text-white rounded-md hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// Bottom nav for mobile
export function BottomNav() {
  const pathname = usePathname();

  const MOBILE_ITEMS = NAV_ITEMS.slice(0, 5); // Show first 5 items on mobile

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-1 rounded-lg min-w-[56px] text-xs font-medium transition-colors",
                active ? "text-[#1B4332]" : "text-muted-foreground"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
