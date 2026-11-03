import type { Product, ProductImage } from './types';

const priceFmt = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' });

export function formatPrice(n: number): string {
  return priceFmt.format(Number.isFinite(n) ? n : 0);
}

export function formatDate(iso: string | Date): string {
  return dateFmt.format(new Date(iso));
}

/** نسبة الخصم من السعر قبل الخصم (0 إذا لا يوجد خصم) */
export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price || compareAt <= 0) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function sortedImages(p: { product_images?: ProductImage[] | null }): ProductImage[] {
  return [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export function firstImage(p: { product_images?: ProductImage[] | null }): string | null {
  return sortedImages(p)[0]?.url ?? null;
}

/** المخزون الكلي: مجموع الخيارات إن وُجدت وإلا مخزون المنتج */
export function totalStock(p: Pick<Product, 'stock' | 'product_variants'>): number {
  const variants = p.product_variants ?? [];
  return variants.length > 0 ? variants.reduce((s, v) => s + v.stock, 0) : p.stock;
}

/** slug يدعم الحروف العربية */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** يرجع null للقيمة الفارغة أو غير الرقمية */
export function toNumber(v: FormDataEntryValue | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
