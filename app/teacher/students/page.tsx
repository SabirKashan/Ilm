"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertCircle } from "lucide-react";
import { displayPakistaniPhone } from "@/lib/utils";

type Student = {
  id: string;
  name: string;
  father_name: string | null;
  roll_number: string | null;
  gender: "male" | "female" | null;
  parent_phone: string;
};

export default function TeacherStudentsPage() {
  const supabase = createClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [noClass, setNoClass] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", user.id)
        .single() as { data: { school_id: string } | null; error: unknown };
      if (!profile) return;

      const { data: cls } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", profile.school_id)
        .eq("teacher_id", user.id)
        .single() as { data: { id: string; name: string } | null; error: unknown };

      if (!cls) { setNoClass(true); setLoading(false); return; }
      setClassName(cls.name);

      const { data: studs } = await supabase
        .from("students")
        .select("id, name, father_name, roll_number, gender, parent_phone")
        .eq("class_id", cls.id)
        .eq("status", "active")
        .order("name");

      setStudents((studs ?? []) as Student[]);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (noClass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle size={48} className="text-amber-400 mb-4" />
        <h2 className="text-lg font-semibold">No class assigned</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          Ask your admin to assign you to a class first.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <p className="text-sm text-muted-foreground">
          {className} · {students.length} student{students.length !== 1 ? "s" : ""}
        </p>
      </div>

      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <Users size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-muted-foreground">No students in this class yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => (
            <div key={s.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className={`text-sm font-semibold ${s.gender === "female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                  {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900 truncate">{s.name}</p>
                  {s.roll_number && (
                    <Badge variant="outline" className="text-xs shrink-0">#{s.roll_number}</Badge>
                  )}
                </div>
                {s.father_name && (
                  <p className="text-xs text-muted-foreground truncate">s/o {s.father_name}</p>
                )}
                <p className="text-xs text-muted-foreground">{displayPakistaniPhone(s.parent_phone)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
