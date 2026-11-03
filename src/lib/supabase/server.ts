import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from './config';

/** عميل Supabase للسيرفر: يعمل بصلاحيات المستخدم الحالي (RLS مفعّل دائمًا) */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // الاستدعاء من Server Component: تحديث الجلسة يتم في middleware
        }
      },
    },
  });
}
