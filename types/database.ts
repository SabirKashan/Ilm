export type UserRole = "admin" | "teacher";
export type AttendanceStatus = "present" | "absent" | "late";
export type FeeFrequency = "monthly" | "annual" | "one-time";
export type FeeVoucherStatus = "pending" | "paid" | "overdue";
export type SalaryStatus = "pending" | "paid";
export type AnnouncementTarget = "all" | "class";
export type StudentStatus = "active" | "inactive";

export interface School {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  logo_url: string | null;
  jazzcash_merchant_id: string | null;
  easypaisa_merchant_id: string | null;
  wati_endpoint: string | null;
  wati_token: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

export interface DbUser {
  id: string;
  school_id: string;
  name: string;
  phone: string;
  role: UserRole;
  created_at: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  grade_level: string | null;
  teacher_id: string | null;
  academic_year: string;
}

export interface Student {
  id: string;
  school_id: string;
  name: string;
  father_name: string | null;
  gender: "male" | "female" | null;
  class_id: string | null;
  roll_number: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
  parent_phone: string;
  address: string | null;
  status: StudentStatus;
  created_at: string;
}

export interface Subject {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  teacher_id: string | null;
}

export interface Attendance {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: string;
  whatsapp_sent: boolean;
  created_at: string;
}

export interface FeeType {
  id: string;
  school_id: string;
  name: string;
  amount: number;
  frequency: FeeFrequency;
}

export interface FeeVoucher {
  id: string;
  school_id: string;
  student_id: string;
  fee_type_id: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  status: FeeVoucherStatus;
  pdf_url: string | null;
  whatsapp_sent: boolean;
  created_at: string;
}

export interface Exam {
  id: string;
  school_id: string;
  name: string;
  class_id: string;
  date: string;
  total_marks: number;
}

export interface Result {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
  remarks: string | null;
  pdf_url: string | null;
  whatsapp_sent: boolean;
}

export interface TeacherSalary {
  id: string;
  school_id: string;
  user_id: string;
  month: number;
  year: number;
  base_salary: number;
  advances_deducted: number;
  bonus: number;
  net_salary: number;
  paid_at: string | null;
  status: SalaryStatus;
}

export interface Advance {
  id: string;
  school_id: string;
  user_id: string;
  amount: number;
  reason: string | null;
  requested_at: string;
  approved_at: string | null;
  repaid: boolean;
}

export interface Announcement {
  id: string;
  school_id: string;
  title: string;
  message: string;
  target: AnnouncementTarget;
  class_id: string | null;
  sent_at: string;
  whatsapp_sent: boolean;
}

export interface WhatsappLog {
  id: string;
  school_id: string;
  phone: string;
  template_name: string;
  status: string;
  sent_at: string;
}

// Supabase Database type map — must match column names exactly
export interface Database {
  public: {
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Tables: {
      schools: {
        Row: School;
        Insert: Omit<School, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<School, "id">>;
        Relationships: [];
      };
      users: {
        Row: DbUser;
        Insert: Omit<DbUser, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbUser, "id">>;
        Relationships: [];
      };
      classes: {
        Row: Class;
        Insert: Omit<Class, "id"> & { id?: string };
        Update: Partial<Omit<Class, "id">>;
        Relationships: [];
      };
      students: {
        Row: Student;
        Insert: Omit<Student, "id" | "created_at"> & { id?: string; created_at?: string; gender?: "male" | "female" | null };
        Update: Partial<Omit<Student, "id">>;
        Relationships: [];
      };
      subjects: {
        Row: Subject;
        Insert: Omit<Subject, "id"> & { id?: string };
        Update: Partial<Omit<Subject, "id">>;
        Relationships: [];
      };
      attendance: {
        Row: Attendance;
        Insert: Omit<Attendance, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Attendance, "id">>;
        Relationships: [];
      };
      fee_types: {
        Row: FeeType;
        Insert: Omit<FeeType, "id"> & { id?: string };
        Update: Partial<Omit<FeeType, "id">>;
        Relationships: [];
      };
      fee_vouchers: {
        Row: FeeVoucher;
        Insert: Omit<FeeVoucher, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<FeeVoucher, "id">>;
        Relationships: [];
      };
      exams: {
        Row: Exam;
        Insert: Omit<Exam, "id"> & { id?: string };
        Update: Partial<Omit<Exam, "id">>;
        Relationships: [];
      };
      results: {
        Row: Result;
        Insert: Omit<Result, "id"> & { id?: string };
        Update: Partial<Omit<Result, "id">>;
        Relationships: [];
      };
      teacher_salaries: {
        Row: TeacherSalary;
        Insert: Omit<TeacherSalary, "id"> & { id?: string };
        Update: Partial<Omit<TeacherSalary, "id">>;
        Relationships: [];
      };
      advances: {
        Row: Advance;
        Insert: Omit<Advance, "id"> & { id?: string };
        Update: Partial<Omit<Advance, "id">>;
        Relationships: [];
      };
      announcements: {
        Row: Announcement;
        Insert: Omit<Announcement, "id"> & { id?: string };
        Update: Partial<Omit<Announcement, "id">>;
        Relationships: [];
      };
      whatsapp_logs: {
        Row: WhatsappLog;
        Insert: Omit<WhatsappLog, "id"> & { id?: string };
        Update: Partial<Omit<WhatsappLog, "id">>;
        Relationships: [];
      };
    };
  };
}
