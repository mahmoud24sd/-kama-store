/** اسم موحّد للمقارنة: بدون تشكيل/همزات/ة/ى ورموز، وحروف صغيرة */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** أسماء كل المنتجات الموجودة (غير المحذوفة) كمجموعة موحّدة */
export async function existingNames(supabase: Sb): Promise<Set<string>> {
  const set = new Set<string>();
  for (let from = 0; from < 50000; from += 1000) {
    let res = await supabase.from('products').select('name').is('deleted_at', null).range(from, from + 999);
    if (res.error) res = await supabase.from('products').select('name').range(from, from + 999);
    const rows = (res.data ?? []) as { name: string }[];
    for (const r of rows) set.add(normName(r.name));
    if (rows.length < 1000) break;
  }
  return set;
}

/** هل عمود trash_reason موجود (ملف 022 اتشغّل)؟ */
export async function hasTrashReason(supabase: Sb): Promise<boolean> {
  const { error } = await supabase.from('products').select('trash_reason').limit(1);
  return !error;
}
