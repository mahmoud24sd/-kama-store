import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './config';

/**
 * عميل بصلاحيات كاملة (Service Role / Secret key) — للسيرفر فقط ولا يُستورد في أي مكوّن Client.
 * يُستخدم فقط لتعيين كلمة مرور مؤقتة وحذف المستخدمين.
 * يعمل فقط إذا أُضيف المتغير السري SUPABASE_SERVICE_ROLE_KEY في Vercel (بدون NEXT_PUBLIC_).
 */
export function createAdminClient() {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim().replace(/^["']|["']$/g, '');
  if (!supabaseUrl || !key || !/^[\x21-\x7E]+$/.test(key)) return null;
  return createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
