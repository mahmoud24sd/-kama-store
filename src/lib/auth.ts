import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { hasPermission, isStaff, type Permission } from '@/lib/permissions';

/** المستخدم الحالي — يتحقق من التوكن عبر Supabase Auth (وليس من الكوكي فقط) */
export const getUser = cache(async () => {
  // زائر بلا كوكي جلسة: لا داعي لأي طلب شبكة
  const jar = await cookies();
  if (!jar.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))) return null;
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

/** للصفحات: غير الموظف (أدمن أو مالك) يُعاد توجيهه. ترجع عميل Supabase بصلاحيات المستخدم (RLS ما زال مطبّقًا) */
export async function requireAdmin() {
  const user = await requireUser('/admin');
  const profile = await getProfile();
  if (!profile || !isStaff(profile)) redirect('/');
  const supabase = await createClient();
  return { user, profile, supabase };
}

/** للصفحات التي تحتاج صلاحية محددة. بدونها يُعاد التوجيه لصفحة الطلبات */
export async function requirePermission(perm: Permission) {
  const ctx = await requireAdmin();
  if (!hasPermission(ctx.profile, perm)) redirect('/admin/orders');
  return ctx;
}

/** صفحات المالك فقط */
export async function requireOwner() {
  const ctx = await requireAdmin();
  if (ctx.profile.role !== 'owner') redirect('/admin');
  return ctx;
}

/** للـ Server Actions: يرمي خطأ بدل إعادة التوجيه، فلا ينفَّذ أي تعديل لغير المصرّح له */
export async function assertAdmin() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  if (!user || !profile || !isStaff(profile)) throw new Error('FORBIDDEN');
  const supabase = await createClient();
  return { user, profile, supabase };
}

export async function assertPermission(perm: Permission) {
  const ctx = await assertAdmin();
  if (!hasPermission(ctx.profile, perm)) throw new Error('FORBIDDEN');
  return ctx;
}

export async function assertOwner() {
  const ctx = await assertAdmin();
  if (ctx.profile.role !== 'owner') throw new Error('FORBIDDEN');
  return ctx;
}
