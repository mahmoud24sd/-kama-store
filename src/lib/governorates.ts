export const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ',
  'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح',
] as const;

const toLatinDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/**
 * يوحّد رقم الهاتف إلى الصيغة الدولية +<رمز الدولة><الرقم> أو يعيد null لو غير صالح.
 * يقبل الرقم المحلي (بصفر في أوله أو بدونه) أو مكتوبًا بالرمز الدولي (+20… أو 0020…).
 * مصر (20) تُفحص بدقة: موبايل 1[0125] + 8 أرقام. باقي الدول: 6 إلى 12 رقمًا.
 */
export function normalizeInternationalPhone(dial: string, raw: string): string | null {
  const d = dial.replace(/\D/g, '');
  if (!d) return null;
  let digits = toLatinDigits(raw).replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith(d) && digits.length > d.length + 5) digits = digits.slice(d.length);
  const national = digits.replace(/^0+/, '');
  if (d === '20') return /^1[0125]\d{8}$/.test(national) ? `+20${national}` : null;
  return /^\d{6,12}$/.test(national) ? `+${d}${national}` : null;
}

/** حسابات التسجيل برقم الهاتف تُخزَّن ببريد داخلي مشتق من الرقم (لا يُرسَل إليه شيء ولا يظهر للمستخدم) */
export const PHONE_EMAIL_DOMAIN = 'phone.invalid';
export const phoneToEmail = (e164: string) => `${e164.replace(/\D/g, '')}@${PHONE_EMAIL_DOMAIN}`;
