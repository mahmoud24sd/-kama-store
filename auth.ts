import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

/** المستخدم الحالي — يتحقق من التوكن عبر Supabase Auth (وليس من الكوكي فقط) */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireUser(next = '/') {
  const user = await getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** للصفحات: غير المدير يُعاد توجيهه. ترجع عميل Supabase بصلاحيات المدير (RLS ما زال مطبّقًا) */
export async function requireAdmin() {
  const user = await requireUser('/admin');
  const profile = await getProfile();
  if (!profile || profile.role !== 'admin') redirect('/');
  const supabase = await createClient();
  return { user, profile, supabase };
}

/** للـ Server Actions: يرمي خطأ بدل إعادة التوجيه، فلا ينفَّذ أي تعديل لغير المدير */
export async function assertAdmin() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  if (!user || !profile || profile.role !== 'admin') throw new Error('FORBIDDEN');
  const supabase = await createClient();
  return { user, profile, supabase };
}
