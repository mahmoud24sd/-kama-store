'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertOwner } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type AdState = { ok?: boolean; error?: string };

/** طلب إعلان من أي زائر (محمي بحقل مخفي ضد الروبوتات وحدود الأطوال) */
export async function submitAdRequest(_prev: AdState, formData: FormData): Promise<AdState> {
  if (String(formData.get('website') ?? '').trim()) return { ok: true }; // روبوت: نتجاهل بصمت
  const parsed = z
    .object({
      name: z.string().trim().min(2, 'أدخل اسمك').max(100),
      phone: z.string().trim().min(6, 'أدخل رقم هاتف صحيح').max(30),
      email: z
        .string()
        .trim()
        .max(200)
        .refine((v) => v === '' || z.string().email().safeParse(v).success, 'بريد إلكتروني غير صالح'),
      message: z.string().trim().max(2000),
    })
    .safeParse({
      name: formData.get('name') ?? '',
      phone: formData.get('phone') ?? '',
      email: formData.get('email') ?? '',
      message: formData.get('message') ?? '',
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('ad_requests').insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      message: parsed.data.message || null,
    });
    if (error) return { error: 'تعذّر إرسال الطلب الآن. حاول لاحقًا أو تواصل معنا مباشرة.' };
  } catch {
    return { error: 'تعذّر إرسال الطلب الآن. حاول لاحقًا أو تواصل معنا مباشرة.' };
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
