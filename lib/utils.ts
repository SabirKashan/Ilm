import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatPhonePK(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("92")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+92${cleaned.slice(1)}`;
  return `+92${cleaned}`;
}

export function formatPakistaniPhone(input: string): string | null {
  const digits = input.trim().replace(/\D/g, "");
  let national = "";
  if (digits.startsWith("0092") && digits.length === 14) national = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) national = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) national = digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("3")) national = digits;
  if (!national.startsWith("3") || national.length !== 10) return null;
  return `+92${national}`;
}

export function displayPakistaniPhone(normalized: string): string {
  if (!normalized.startsWith("+92")) return normalized;
  const n = normalized.slice(3);
  return `0${n.slice(0, 3)}-${n.slice(3)}`;
}
