'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertOwner } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type AdState = { ok?: boolean; error?: string };

export const AD_TYPES = ['بانر في الصفحة الرئيسية', 'إعلان على منتج أو قسم', 'منشور على صفحاتنا (فيسبوك / إنستجرام / تيك توك)', 'رعاية قسم كامل', 'أخرى'] as const;

/** طلب إعلان من أي زائر (محمي بحقل مخفي ضد الروبوتات وحدود الأطوال) */
export async function submitAdRequest(_prev: AdState, formData: FormData): Promise<AdState> {
  if (String(formData.get('website') ?? '').trim()) return { ok: true }; // روبوت: نتجاهل بصمت
  const parsed = z
    .object({
      name: z.string().trim().min(2, 'أدخل اسمك').max(100),
      phone: z.string().trim().min(6, 'أدخل رقم هاتف صحيح').max(30),
      email: z.string().trim().max(200).email('أدخل بريدًا إلكترونيًا صحيحًا'),
      ad_type: z.enum(AD_TYPES, { message: 'اختر نوع الإعلان' }),
      ad_price: z.coerce.number({ message: 'أدخل سعر الإعلان' }).min(0, 'السعر غير صالح').max(100000000, 'السعر كبير جدًا'),
      message: z.string().trim().max(2000),
    })
    .safeParse({
      name: formData.get('name') ?? '',
      phone: formData.get('phone') ?? '',
      email: formData.get('email') ?? '',
      ad_type: formData.get('ad_type') ?? '',
      ad_price: formData.get('ad_price') ?? '',
      message: formData.get('message') ?? '',
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const FAIL = 'تعذّر إرسال الطلب الآن. حاول لاحقًا أو تواصل معنا مباشرة.';

  try {
    const supabase = await createClient();
    const base = { name: d.name, phone: d.phone, email: d.email, message: d.message || null };
    const { error } = await supabase.from('ad_requests').insert({ ...base, ad_type: d.ad_type, ad_price: d.ad_price });
    if (error) {
      // لو لم يُشغَّل ملف 014 بعد: نحفظ النوع والسعر داخل الرسالة حتى لا يضيع الطلب
      const { error: e2 } = await supabase
        .from('ad_requests')
        .insert({ ...base, message: `نوع الإعلان: ${d.ad_type}\nالسعر المعروض: ${d.ad_price} ج.م${d.message ? '\n' + d.message : ''}` });
      if (e2) return { error: FAIL };
    }
  } catch {
    return { error: FAIL };
  }
  return { ok: true };
}

export async function toggleAdHandled(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('ad_requests').update({ is_handled: formData.get('handled') === '1' }).eq('id', id.data);
  revalidatePath('/admin/ads');
}

export async function deleteAdRequest(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('ad_requests').delete().eq('id', id.data);
  revalidatePath('/admin/ads');
}
