import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './config';

const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim().replace(/^["']|["']$/g, '');

export const serviceKeyPresent = serviceKey.length > 0;
export const hasServiceRole = /^[\x21-\x7E]+$/.test(serviceKey);

/**
 * عميل بصلاحيات كاملة — للسيرفر فقط (Server Actions). المفتاح سري ولا يبدأ بـ NEXT_PUBLIC_.
 * يُستخدم هنا فقط لإنشاء الحساب مؤكَّدًا دون الاعتماد على إرسال بريد.
 */
export function createAdminClient() {
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * حسابات قديمة أُنشئت بمحاولات تسجيل فشلت بسبب بريد التأكيد (غير مؤكَّدة ولم تُستخدم قط).
 * يؤكدها الآن، ولو أُرسلت بيانات جديدة يحدّث كلمة المرور والبيانات. تعيد true لو كان الحساب غير مؤكَّد وتم إصلاحه.
 * لا يمس الحسابات المؤكَّدة أبدًا.
 */
export async function confirmStaleAccount(
  email: string,
  fresh?: { password: string; full_name: string; phone: string; governorate: string },
): Promise<boolean> {
  if (!hasServiceRole) return false;
  const db = createAdminClient();
  const { data: prof } = await db.from('profiles').select('id').ilike('email', email.trim()).maybeSingle();
  if (!prof) return false;
  const { data } = await db.auth.admin.getUserById(prof.id as string);
  if (!data?.user || data.user.email_confirmed_at) return false;
  const { error } = await db.auth.admin.updateUserById(prof.id as string, {
    email_confirm: true,
    ...(fresh ? { password: fresh.password, user_metadata: { full_name: fresh.full_name, phone: fresh.phone, governorate: fresh.governorate } } : {}),
  });
  if (error) return false;
  if (fresh) await db.from('profiles').update({ full_name: fresh.full_name, phone: fresh.phone, governorate: fresh.governorate }).eq('id', prof.id as string);
  return true;
}
