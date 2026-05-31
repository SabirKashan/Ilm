"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CalendarCheck, Users, BookOpen, LogOut, Settings, BookText } from "lucide-react";

const NAV = [
  { href: "/teacher",            label: "Home",       icon: LayoutDashboard },
  { href: "/teacher/attendance", label: "Attendance", icon: CalendarCheck   },
  { href: "/teacher/homework",   label: "Homework",   icon: BookText        },
  { href: "/teacher/students",   label: "Students",   icon: Users           },
  { href: "/teacher/results",    label: "Results",    icon: BookOpen        },
  { href: "/teacher/settings",   label: "Settings",   icon: Settings        },
];

export function TeacherNav({ teacherName }: { teacherName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <>
      {/* Top bar */}
      <header className="bg-[#1B4332] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center text-sm font-bold">ع</div>
          <div>
            <div className="text-sm font-semibold leading-none">Ilm</div>
            <div className="text-xs text-white/60 leading-none mt-0.5">{teacherName}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
        <div className="flex items-center justify-around px-2 py-2 max-w-2xl mx-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  active ? "text-[#1B4332]" : "text-muted-foreground"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
