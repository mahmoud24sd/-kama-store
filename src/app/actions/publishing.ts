'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertPermission } from '@/lib/auth';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

const BACK = '/admin/publishing';

function fail(message: string): never {
  redirect(`${BACK}?error=${encodeURIComponent(message)}`);
}

async function load(formData: FormData) {
  const { user } = await assertPermission('publishing');
  if (!hasServiceRole) fail('يلزم إعداد SUPABASE_SERVICE_ROLE_KEY');
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) fail('بيانات غير صالحة');
  const db = createAdminClient();
  const { data: req } = await db.from('publish_requests').select('id, product_id, status').eq('id', id.data!).maybeSingle();
  if (!req) fail('الطلب غير موجود');
  if (req!.status !== 'pending') fail('تمت مراجعة هذا الطلب من قبل');
  return { user, db, req: req! };
}

/** تأكيد وصول الدفع → ينشر المنتج */
export async function approvePublish(formData: FormData) {
  const { user, db, req } = await load(formData);
  await db
    .from('publish_requests')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', req.id);
  await db.from('products').update({ status: 'published', is_active: true }).eq('id', req.product_id);
  // من وافق على النشر (منفصل: لا يتعطل لو لم يُشغَّل ملف 008 بعد)
  await db.from('products').update({ published_by: user.id, published_at: new Date().toISOString() }).eq('id', req.product_id);
  revalidatePath('/', 'layout');
  redirect(`${BACK}?done=1`);
}

/** رفض الطلب (لم يصل الدفع أو الرقم خطأ) → يرجع المنتج مسودة مع سبب الرفض */
export async function rejectPublish(formData: FormData) {
  const { user, db, req } = await load(formData);
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || 'لم نتمكن من تأكيد الدفع';
  await db
    .from('publish_requests')
    .update({ status: 'rejected', admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', req.id);
  await db.from('products').update({ status: 'rejected', is_active: false }).eq('id', req.product_id);
  revalidatePath('/admin/publishing');
  redirect(`${BACK}?done=1`);
}
