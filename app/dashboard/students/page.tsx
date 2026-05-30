"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Upload, Users, ChevronRight, Download } from "lucide-react";
import type { Student, Class } from "@/types/database";
import { formatPakistaniPhone, displayPakistaniPhone } from "@/lib/utils";

type Step = 1 | 2;

const EMPTY_FORM = {
  name: "", father_name: "", date_of_birth: "", gender: "" as "" | "male" | "female",
  class_id: "", roll_number: "", parent_phone: "", address: "", status: "active" as "active" | "inactive",
};

export default function StudentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");

  // Add student dialog
  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  // Import CSV dialog
  const [showImport, setShowImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<{ row: number; error: string }[]>([]);
  const csvRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: studentRows }, { data: classRows }] = await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase.from("classes").select("*").order("grade_level"),
    ]);
    setStudents((studentRows ?? []) as Student[]);
    setClasses((classRows ?? []) as Class[]);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered list
  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      (s.father_name ?? "").toLowerCase().includes(q) ||
      (s.roll_number ?? "").toLowerCase().includes(q);
    const matchClass = filterClass === "all" || s.class_id === filterClass;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchClass && matchStatus;
  });

  // Next roll number suggestion
  async function suggestRollNumber(classId: string) {
    if (!classId) return;
    const { data } = await supabase
      .from("students").select("roll_number").eq("class_id", classId).order("roll_number");
    const nums = ((data ?? []) as { roll_number: string | null }[])
      .map((s) => parseInt(s.roll_number ?? "0", 10))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const next = nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
    setForm((f) => ({ ...f, roll_number: next }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleAddStudent() {
    const phone = formatPakistaniPhone(form.parent_phone);
    if (!phone) { toast.error("Invalid phone number. Enter a valid Pakistani number."); return; }

    setSaving(true);
    let photoUrl: string | null = null;

    if (photoFile) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("users").select("school_id").eq("id", user!.id).single() as { data: { school_id: string } | null; error: unknown };
      if (profile?.school_id) {
        const ext = photoFile.name.split(".").pop();
        const path = `${profile.school_id}/students/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("ilm-assets").upload(path, photoFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("ilm-assets").getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("students").insert({
      name: form.name.trim(),
      father_name: form.father_name.trim() || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      class_id: form.class_id || null,
      roll_number: form.roll_number.trim() || null,
      parent_phone: phone,
      address: form.address.trim() || null,
      status: form.status,
      photo_url: photoUrl,
    });

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Student added!");
    setShowAdd(false);
    setStep(1);
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setPhotoPreview(null);
    fetchData();
  }

  // CSV helpers
  function downloadTemplate() {
    const headers = "name,father_name,date_of_birth,gender,class_name,roll_number,parent_phone,address\n";
    const example = "Ali Khan,Hassan Khan,2010-05-15,male,Class 5A,1,03001234567,House 12 Street 3\n";
    const blob = new Blob([headers + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsv(text: string): Record<string, string>[] {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target?.result as string);
      setCsvPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvFile) return;
    setImporting(true);
    setImportErrors([]);

    const text = await csvFile.text();
    const rows = parseCsv(text);
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const phone = formatPakistaniPhone(row.parent_phone ?? "");
      if (!phone) { errors.push({ row: i + 2, error: `Invalid phone: ${row.parent_phone}` }); continue; }
      if (!row.name?.trim()) { errors.push({ row: i + 2, error: "Name is required" }); continue; }

      const cls = classes.find((c) => c.name.toLowerCase() === row.class_name?.toLowerCase().trim());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("students").insert({
        name: row.name.trim(),
        father_name: row.father_name?.trim() || null,
        date_of_birth: row.date_of_birth?.trim() || null,
        gender: (row.gender?.trim().toLowerCase() === "male" || row.gender?.trim().toLowerCase() === "female") ? row.gender.trim().toLowerCase() : null,
        class_id: cls?.id ?? null,
        roll_number: row.roll_number?.trim() || null,
        parent_phone: phone,
        address: row.address?.trim() || null,
        status: "active",
      });
      if (error) errors.push({ row: i + 2, error: error.message });
    }

    setImporting(false);
    setImportErrors(errors);
    if (errors.length === 0) {
      toast.success(`${rows.length} students imported!`);
      setShowImport(false);
      setCsvFile(null);
      setCsvPreview([]);
      fetchData();
    } else if (errors.length < rows.length) {
      toast.success(`${rows.length - errors.length} imported, ${errors.length} failed`);
      fetchData();
    } else {
      toast.error("All rows failed — check errors below");
    }
  }

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} of {students.length} student{students.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1" /> Import
          </Button>
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => { setShowAdd(true); setStep(1); setForm(EMPTY_FORM); }}>
            <Plus size={16} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, father, roll…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterClass} onValueChange={(v) => setFilterClass(v ?? "all")}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "active")}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[#1B4332]/20 rounded-xl">
          <Users size={48} className="text-[#1B4332]/30 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-1">
            {students.length === 0 ? "No students yet" : "No students match your search"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {students.length === 0 ? "Add your first student or import from CSV." : "Try adjusting your search or filters."}
          </p>
          {students.length === 0 && (
            <Button className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white" onClick={() => setShowAdd(true)}>
              <Plus size={16} className="mr-1" /> Add Student
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Student</TableHead>
                <TableHead className="hidden sm:table-cell">Class</TableHead>
                <TableHead className="hidden md:table-cell">Roll #</TableHead>
                <TableHead className="hidden lg:table-cell">Parent Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/dashboard/students/${s.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={s.photo_url ?? ""} alt={s.name} />
                        <AvatarFallback className="bg-[#1B4332]/10 text-[#1B4332] text-sm font-medium">
                          {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.father_name && <p className="text-xs text-muted-foreground">{s.father_name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {s.class_id ? classMap[s.class_id] ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {s.roll_number ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {s.parent_phone ? displayPakistaniPhone(s.parent_phone) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={s.status === "active"
                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                    }>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell><ChevronRight size={16} className="text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Student Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setStep(1); setForm(EMPTY_FORM); setPhotoFile(null); setPhotoPreview(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Student — Step {step} of 2</DialogTitle>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-4 py-2">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-20 h-20 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer overflow-hidden"
                  onClick={() => photoRef.current?.click()}
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">📷</span>
                  )}
                </div>
                <button type="button" className="text-xs text-[#1B4332] hover:underline" onClick={() => photoRef.current?.click()}>
                  {photoPreview ? "Change photo" : "Upload photo"}
                </button>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>

              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input placeholder="e.g. Muhammad Ali" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Father Name *</Label>
                <Input placeholder="e.g. Hassan Ali" value={form.father_name} onChange={(e) => setForm((f) => ({ ...f, father_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v as "male" | "female" }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Assign to Class</Label>
                <Select value={form.class_id} onValueChange={(v) => { if (v) { setForm((f) => ({ ...f, class_id: v })); suggestRollNumber(v); } }}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Roll Number</Label>
                <Input placeholder="Auto-suggested" value={form.roll_number} onChange={(e) => setForm((f) => ({ ...f, roll_number: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Parent WhatsApp *</Label>
                <Input
                  placeholder="03001234567"
                  value={form.parent_phone}
                  onChange={(e) => setForm((f) => ({ ...f, parent_phone: e.target.value }))}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-2">
                <Label>Home Address</Label>
                <Input placeholder="House/Street/Area" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step === 1 ? (
              <>
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button
                  className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                  onClick={() => setStep(2)}
                  disabled={!form.name.trim() || !form.father_name.trim()}
                >
                  Next →
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button
                  className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
                  onClick={handleAddStudent}
                  disabled={saving || !form.parent_phone.trim()}
                >
                  {saving ? "Saving..." : "Add Student"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImport} onOpenChange={(o) => { setShowImport(o); if (!o) { setCsvFile(null); setCsvPreview([]); setImportErrors([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Import Students from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download size={14} className="mr-1" /> Download Template
            </Button>

            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50"
              onClick={() => csvRef.current?.click()}
            >
              {csvFile ? (
                <p className="text-sm font-medium">{csvFile.name}</p>
              ) : (
                <>
                  <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload CSV file</p>
                </>
              )}
            </div>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />

            {csvPreview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first 5 rows)</p>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="text-xs w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(csvPreview[0]).map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {csvPreview.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-2 py-1.5 text-muted-foreground">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {importErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Row {e.row}: {e.error}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button
              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
              onClick={handleImport}
              disabled={importing || !csvFile}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
