'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { parseAdCode } from '@/lib/adCodes';
import { assertPermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { AD_PLACEMENTS } from '@/lib/siteAds';

const back = (msg: string, ok = false): never => redirect(`/admin/ad-codes?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`);
const bust = () => { revalidateTag('ad-codes'); revalidatePath('/', 'layout'); };
const PLACES = ['global', ...AD_PLACEMENTS.map((p) => p.value)];

/** إضافة كود إعلان: للمالك أو أدمن معاه صلاحية «إضافة وحذف أكواد الإعلانات» */
export async function addAdCode(formData: FormData) {
  const { supabase, profile } = await assertPermission('ad_codes_manage');
  if (!hasPermission(profile, 'ad_codes_manage')) return back('إضافة الأكواد محتاجة صلاحية من المالك');
  const name = String(formData.get('name') ?? '').trim().slice(0, 100);
  const placement = String(formData.get('placement') ?? '');
  if (name.length < 2) return back('اكتب اسم للإعلان (مثلًا: Monetag بانر)');
  if (!PLACES.includes(placement)) return back('اختار مكان الإعلان');
  const parsed = parseAdCode(String(formData.get('code') ?? ''));
  if ('error' in parsed) return back(parsed.error);
  const label = String(formData.get('link_label') ?? '').trim().slice(0, 60);
  const row = { ...parsed, link_label: parsed.type === 'link' ? label || parsed.link_label : null, name, placement };
  let { error } = await supabase.from('ad_codes').insert({ ...row, created_by: profile.id });
  if (error) ({ error } = await supabase.from('ad_codes').insert(row)); // قبل تشغيل ملف 034
  if (error) return back('تعذّر الحفظ. اتأكد إنك شغّلت ملف 031 في Supabase');
  bust();
  return back('اتضاف الكود وشغّال', true);
}

/** تشغيل/إيقاف: المالك أو الأدمن اللي معاه صلاحية «تشغيل وإيقاف الإعلانات التلقائية» */
export async function toggleAdCode(formData: FormData) {
  const { supabase } = await assertPermission('ad_codes');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('ad_codes').update({ is_active: formData.get('active') === '1' }).eq('id', id.data);
  bust();
  redirect('/admin/ad-codes');
}

/** إيقاف/تشغيل كل الأكواد مرة واحدة */
export async function toggleAllAdCodes(formData: FormData) {
  const { supabase } = await assertPermission('ad_codes');
  await supabase.from('ad_codes').update({ is_active: formData.get('active') === '1' }).not('id', 'is', null);
  bust();
  redirect('/admin/ad-codes');
}

export async function deleteAdCode(formData: FormData) {
  const { supabase, profile } = await assertPermission('ad_codes_manage');
  if (!hasPermission(profile, 'ad_codes_manage')) return back('الحذف محتاج صلاحية من المالك');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('ad_codes').delete().eq('id', id.data);
  bust();
  redirect('/admin/ad-codes');
}
