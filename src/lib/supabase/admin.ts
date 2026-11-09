import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './config';

const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim().replace(/^["']|["']$/g, '');

export const hasServiceRole = /^[\x21-\x7E]+$/.test(serviceKey);

/**
 * عميل بصلاحيات كاملة — للسيرفر فقط (Server Actions). المفتاح سري ولا يبدأ بـ NEXT_PUBLIC_.
 * يُستخدم هنا فقط لإنشاء الحساب مؤكَّدًا دون الاعتماد على إرسال بريد.
 */
export function createAdminClient() {
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
