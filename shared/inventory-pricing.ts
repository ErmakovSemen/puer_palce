export function calculateInventoryPrice(subtotal: number, discountPercent: number, extraPercent = 0, extraCents = 0, finalCents?: number) {
  const afterCustomer = Math.round(subtotal * (100 - discountPercent) / 100);
  const afterPercent = Math.round(afterCustomer * (100 - extraPercent) / 100);
  const calculatedTotal = Math.max(0, afterPercent - extraCents);
  const total = finalCents ?? calculatedTotal;
  return { afterCustomer, afterPercent, calculatedTotal, total, discountCents: subtotal - total };
}
