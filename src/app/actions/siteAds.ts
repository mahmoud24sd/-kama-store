'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertPermission } from '@/lib/auth';
import { removeImages, uploadImage } from '@/lib/imageStore';
import { AD_PLACEMENTS } from '@/lib/siteAds';

const BUCKET = 'product-images';
const back = (msg: string, ok = false): never => redirect(`/admin/placements?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`);
const bust = () => { revalidateTag('site-ads'); revalidatePath('/', 'layout'); };

export async function createSiteAd(formData: FormData) {
  const { supabase } = await assertPermission('ads');
  const p = z.object({
    advertiser: z.string().trim().min(2, 'اكتب اسم المعلن').max(100),
    placement: z.enum(AD_PLACEMENTS.map((x) => x.value) as [string, ...string[]], { message: 'اختار مكان الإعلان' }),
    kind: z.enum(['image', 'video']),
    link_url: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), 'رابط المعلن لازم يبدأ بـ https://'),
    media_url: z.string().trim().max(500),
    price: z.coerce.number().min(0).max(100000000),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'اختار تاريخ البداية'),
    ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'اختار تاريخ النهاية'),
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return back(p.error.issues[0].message);
  const d = p.data;
  if (d.ends_on < d.starts_on) return back('تاريخ النهاية قبل البداية');

  let media = d.media_url;
  const file = formData.get('image');
  if (d.kind === 'image' && file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) return back('الملف لازم يكون صورة');
    if (file.size > 5 * 1024 * 1024) return back('الصورة أكبر من 5 ميجا');
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    const url = await uploadImage(supabase, BUCKET, `ads/${crypto.randomUUID()}.${ext}`, new Uint8Array(await file.arrayBuffer()), file.type);
    if (!url) return back('تعذّر رفع الصورة. تأكد من إعدادات التخزين');
    media = url;
  }
  if (!media || !/^https?:\/\//i.test(media)) return back(d.kind === 'image' ? 'ارفع صورة الإعلان' : 'حط رابط الفيديو (يوتيوب أو رابط مباشر)');

  const { error } = await supabase.from('site_ads').insert({ advertiser: d.advertiser, placement: d.placement, kind: d.kind, media_url: media, link_url: d.link_url || null, price: d.price, starts_on: d.starts_on, ends_on: d.ends_on });
  if (error) return back('تعذّر الحفظ. اتأكد إنك شغّلت ملف 029 في Supabase');
  bust();
  return back('اتضاف الإعلان', true);
}

export async function toggleSiteAd(formData: FormData) {
  const { supabase } = await assertPermission('ads');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('site_ads').update({ is_active: formData.get('active') === '1' }).eq('id', id.data);
  bust();
  redirect('/admin/placements');
}

export async function deleteSiteAd(formData: FormData) {
  const { supabase } = await assertPermission('ads');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const { data } = await supabase.from('site_ads').select('kind,media_url').eq('id', id.data).maybeSingle();
  await supabase.from('site_ads').delete().eq('id', id.data);
  if (data?.kind === 'image' && String(data.media_url).includes('/ads/')) await removeImages(supabase, BUCKET, [String(data.media_url)]);
  bust();
  redirect('/admin/placements');
}
