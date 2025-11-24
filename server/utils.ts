/**
 * Normalize phone number to consistent format: +7XXXXXXXXXX
 * Handles various input formats:
 * - 10 digits: 9161234567 -> +79161234567
 * - 11 digits starting with 7: 79161234567 -> +79161234567
 * - 11 digits starting with 8: 89161234567 -> +79161234567
 * - Already formatted: +79161234567 -> +79161234567
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  // Extract only digits
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle different formats
  let normalized: string;
  
  if (digitsOnly.length === 10) {
    // Assume Russian mobile without country code
    normalized = '+7' + digitsOnly;
  } else if (digitsOnly.length === 11) {
    if (digitsOnly.startsWith('7')) {
      normalized = '+' + digitsOnly;
    } else if (digitsOnly.startsWith('8')) {
      normalized = '+7' + digitsOnly.substring(1);
    } else {
      throw new Error(`Invalid phone format: must start with 7 or 8 (got ${digitsOnly})`);
    }
  } else {
    throw new Error(`Invalid phone length: expected 10 or 11 digits (got ${digitsOnly.length})`);
  }
  
  // Final validation: must match +7XXXXXXXXXX pattern
  if (!/^\+7\d{10}$/.test(normalized)) {
    throw new Error(`Phone normalization failed: ${normalized} doesn't match +7XXXXXXXXXX pattern`);
  }
  
  return normalized;
}
