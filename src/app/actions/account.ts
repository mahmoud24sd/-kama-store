'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import type { FormState } from './auth';

const phoneRegex = /^[0-9+\s-]{8,15}$/;

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser('/account');
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, 'أدخل اسمك الكامل').max(100),
      phone: z.string().trim().regex(phoneRegex, 'رقم هاتف غير صالح').or(z.literal('')),
    })
    .safeParse({ full_name: formData.get('full_name'), phone: formData.get('phone') ?? '' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
    .eq('id', user.id);
  if (error) return { error: 'تعذر حفظ البيانات' };
  revalidatePath('/account');
  return { message: 'تم حفظ بياناتك' };
}

export async function addAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser('/account/addresses');
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, 'أدخل الاسم الكامل').max(100),
      phone: z.string().trim().regex(phoneRegex, 'رقم هاتف غير صالح'),
      line1: z.string().trim().min(5, 'أدخل العنوان بالتفصيل').max(200),
      city: z.string().trim().min(2, 'أدخل المدينة').max(80),
      governorate: z.string().trim().min(2, 'أدخل المحافظة').max(80),
      notes: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  const { error } = await supabase.from('addresses').insert({
    ...parsed.data,
    notes: parsed.data.notes || null,
    user_id: user.id,
    is_default: (count ?? 0) === 0,
  });
  if (error) return { error: 'تعذر حفظ العنوان' };
  revalidatePath('/account/addresses');
  return { message: 'تمت إضافة العنوان' };
}

export async function deleteAddress(formData: FormData) {
  const user = await requireUser('/account/addresses');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('addresses').delete().eq('id', id.data).eq('user_id', user.id);
  revalidatePath('/account/addresses');
}

export async function setDefaultAddress(formData: FormData) {
  const user = await requireUser('/account/addresses');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
  await supabase.from('addresses').update({ is_default: true }).eq('id', id.data).eq('user_id', user.id);
  revalidatePath('/account/addresses');
}

/** يرجع الحالة الجديدة (true = أصبح في المفضلة). يحوّل لتسجيل الدخول إن لم يكن مسجلًا */
export async function toggleFavorite(productId: string): Promise<{ favorite: boolean } | { needsLogin: true }> {
  const id = z.string().uuid().safeParse(productId);
  if (!id.success) return { needsLogin: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { needsLogin: true };

  const { data: existing } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', user.id)
    .eq('product_id', id.data)
    .maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', id.data);
    revalidatePath('/account/favorites');
    return { favorite: false };
  }
  await supabase.from('favorites').insert({ user_id: user.id, product_id: id.data });
  revalidatePath('/account/favorites');
  return { favorite: true };
}

export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser('/');
  const parsed = z
    .object({
      product_id: z.string().uuid(),
      slug: z.string().min(1),
      rating: z.coerce.number().int().min(1, 'اختر التقييم').max(5),
      comment: z.string().trim().max(1000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

  const { error } = await supabase.from('reviews').insert({
    product_id: parsed.data.product_id,
    user_id: user.id,
    author_name: profile?.full_name || 'عميل Kama Store',
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });
  if (error) {
    if (error.code === '23505') return { error: 'لقد قمت بتقييم هذا المنتج من قبل' };
    // سياسة RLS تسمح بالتقييم فقط لمن اشترى المنتج
    return { error: 'يمكن تقييم المنتج بعد شرائه فقط' };
  }

  revalidatePath(`/products/${parsed.data.slug}`);
  return { message: 'شكرًا لتقييمك!' };
}
