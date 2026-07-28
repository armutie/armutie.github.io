import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: digits,
  }).format(value);
}
