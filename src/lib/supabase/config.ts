const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '');

export const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// القيمتان يجب أن تكونا ASCII فقط (الرابط https والمفتاح بدون مسافات أو حروف عربية)،
// وإلا يُعدّ الإعداد غير مكتمل بدل أن ينهار الموقع.
const validUrl = /^https?:\/\/[\x21-\x7E]+$/.test(supabaseUrl);
const validKey = /^[\x21-\x7E]+$/.test(supabaseAnonKey);

export const isSupabaseConfigured = validUrl && validKey;
