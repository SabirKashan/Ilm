"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, RefreshCw } from "lucide-react";

type School = { id: string; name: string; city: string | null; onboarding_complete: boolean; created_at: string };

export default function AdminSchoolsPage() {
  const [secret, setSecret]       = useState("");
  const [authed, setAuthed]       = useState(false);
  const [schools, setSchools]     = useState<School[]>([]);
  const [loading, setLoading]     = useState(false);
  const [deleteSchool, setDeleteSchool] = useState<School | null>(null);
  const [deleting, setDeleting]   = useState(false);

  async function fetchSchools(s = secret) {
    setLoading(true);
    const res = await fetch("/api/admin/schools", { headers: { "x-admin-secret": s } });
    setLoading(false);
    if (!res.ok) { toast.error("Wrong secret or server error"); return; }
    const json = await res.json();
    setSchools(json.schools ?? []);
    setAuthed(true);
  }

  async function handleDelete() {
    if (!deleteSchool) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/schools?id=${deleteSchool.id}`, {
      method: "DELETE",
      headers: { "x-admin-secret": secret },
    });
    const json = await res.json();
    setDeleting(false);
    if (!res.ok) { toast.error(json.error ?? "Failed"); return; }
    toast.success(`${deleteSchool.name} deleted`);
    setDeleteSchool(null);
    setSchools((prev) => prev.filter((s) => s.id !== deleteSchool.id));
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow p-6 w-full max-w-sm space-y-4">
          <h1 className="text-lg font-bold">Super Admin</h1>
          <Input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchSchools()}
            autoFocus
          />
          <Button className="w-full bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => fetchSchools()}>
            Access
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schools</h1>
          <p className="text-sm text-muted-foreground">{schools.length} school{schools.length !== 1 ? "s" : ""} on platform</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchSchools()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>School</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.city ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={s.onboarding_complete
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"}>
                    {s.onboarding_complete ? "Active" : "Onboarding"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString("en-PK")}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteSchool(s)}>
                    <Trash2 size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteSchool} onOpenChange={(o) => { if (!o) setDeleteSchool(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete School</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{deleteSchool?.name}</strong> and ALL its data — students, teachers, fees, attendance, exams, everything. This <strong>cannot</strong> be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSchool(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
