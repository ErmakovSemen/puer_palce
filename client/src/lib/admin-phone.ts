export function formatRussianPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const local = (/^[78]/.test(digits) ? digits.slice(1) : digits).slice(0, 10);
  if (!local) return "+7";
  let result = `+7 (${local.slice(0, 3)}`;
  if (local.length >= 3) result += ")";
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
}

export function formatCustomerSearchInput(input: string): string {
  if (/[A-Za-zА-Яа-яЁё]/.test(input)) return input;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits)))
    return formatRussianPhoneInput(input);
  return input;
}
