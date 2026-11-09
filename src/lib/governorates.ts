export const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ',
  'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح',
] as const;

/** يقبل 01xxxxxxxxx أو +20 1xxxxxxxxx ويعيد الرقم بصيغة 01xxxxxxxxx، أو null لو غير صالح */
export function normalizeEgyptPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const local = digits.replace(/^(\+?20|0020)/, '0');
  return /^01[0125]\d{8}$/.test(local) ? local : null;
}
