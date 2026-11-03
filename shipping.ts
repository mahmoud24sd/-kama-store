// ⚠️ يجب أن تطابق هذه القيم دالة create_order في supabase/schema.sql
export const FREE_SHIPPING_THRESHOLD = 1000;
export const STANDARD_FEE = 60;
export const EXPRESS_FEE = 120;

export type ShippingMethod = 'standard' | 'express';

export const SHIPPING_OPTIONS: { id: ShippingMethod; label: string; eta: string }[] = [
  { id: 'standard', label: 'شحن عادي', eta: '3 – 5 أيام عمل' },
  { id: 'express', label: 'شحن سريع', eta: '1 – 2 يوم عمل' },
];

/** تقدير للعرض فقط — الحساب الفعلي يتم داخل قاعدة البيانات */
export function shippingFee(method: ShippingMethod, subtotalAfterDiscount: number): number {
  if (method === 'express') return EXPRESS_FEE;
  return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_FEE;
}
