export function userSearchTerm(input: unknown): { kind: "name" | "phone"; pattern: string } | null {
  if (typeof input !== "string") return null;
  const value = input.trim().slice(0, 80);
  if (/[A-Za-zА-Яа-яЁё]/.test(value)) {
    if (value.length < 3) return null;
    return { kind: "name", pattern: `%${value.replace(/[\\%_]/g, "\\$&")}%` };
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 3) return null;
  const normalized = digits.startsWith("8")
    ? `7${digits.slice(1)}`
    : digits;
  return { kind: "phone", pattern: `%${normalized}%` };
}
