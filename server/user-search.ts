export function phoneSearchDigits(input: string): string {
  const value = input.trim();
  const digits = value.replace(/\D/g, "");
  const hasDialPrefix = /^[78]/.test(digits) &&
    (digits.length === 11 || /^\+7/.test(value) || /^[78][\s(-]/.test(value) || /^[78]9/.test(digits));
  return hasDialPrefix ? digits.slice(1) : digits;
}

export function userSearchTerm(input: unknown): { kind: "name" | "phone"; pattern: string } | null {
  if (typeof input !== "string") return null;
  const value = input.trim().slice(0, 80);
  if (/[A-Za-zА-Яа-яЁё]/.test(value)) {
    if (value.length < 3) return null;
    return { kind: "name", pattern: `%${value.replace(/[\\%_]/g, "\\$&")}%` };
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return { kind: "phone", pattern: `%${phoneSearchDigits(value)}%` };
}
