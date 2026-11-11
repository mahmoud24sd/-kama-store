'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertOwner } from '@/lib/auth';
import { runSource, type Source } from '@/lib/importer';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

const back = (q: string): never => redirect(`/admin/sources?${q}`);

export async function addSource(formData: FormData) {
  await assertOwner();
  if (formData.get('consent') !== 'on') back('error=' + encodeURIComponent('أكّد أن عندك إذن من صاحب المتجر لاستخدام منتجاته'));
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      kind: z.enum(['shopify', 'woocommerce']),
      base_url: z.string().trim().url().max(300),
      category_id: z.string().uuid().optional().or(z.literal('')),
      markup_percent: z.coerce.number().min(-90).max(1000),
      rate: z.coerce.number().gt(0).max(100000),
      per_run: z.coerce.number().int().min(1).max(200),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return back('error=' + encodeURIComponent('بيانات غير صالحة. راجع الحقول.'));
  const d = parsed.data;
  const u = new URL(d.base_url);
  if (u.protocol !== 'https:') return back('error=' + encodeURIComponent('الرابط لازم يبدأ بـ https://'));

  const supabase = (await assertOwner()).supabase;
  const { error } = await supabase.from('product_sources').insert({
    name: d.name,
    kind: d.kind,
    base_url: u.origin,
    category_id: d.category_id || null,
    markup_percent: d.markup_percent,
    rate: d.rate,
    per_run: d.per_run,
  });
  if (error) return back('error=' + encodeURIComponent('تعذّر الحفظ. شغّل ملف 011 في Supabase.'));
  revalidatePath('/admin/sources');
  back('saved=1');
}

export async function toggleSource(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await supabase.from('product_sources').update({ is_active: formData.get('active') === '1' }).eq('id', id.data);
  revalidatePath('/admin/sources');
}

export async function deleteSource(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  // حذف المصدر لا يحذف المنتجات التي سُحبت منه
  await supabase.from('product_sources').delete().eq('id', id.data);
  revalidatePath('/admin/sources');
}

export async function runSourceNow(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  if (!hasServiceRole) return back('error=' + encodeURIComponent('يلزم SUPABASE_SERVICE_ROLE_KEY في Vercel'));
  const { data } = await supabase.from('product_sources').select('*').eq('id', id.data).maybeSingle();
  if (!data) return;
  const db = createAdminClient();
  const r = await runSource(db, data as Source);
  await db
    .from('product_sources')
    .update({ last_run_at: new Date().toISOString(), last_status: r.status, imported_total: Number(data.imported_total) + r.added })
    .eq('id', id.data);
  revalidatePath('/', 'layout');
  back('saved=1');
}
