'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertPermission } from '@/lib/auth';
import { runSocialBatch } from '@/lib/social';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

function back(msg: string): never {
  revalidatePath('/admin/social');
  redirect(`/admin/social?msg=${encodeURIComponent(msg)}`);
}

export async function setSocialAuto(formData: FormData) {
  await assertPermission('social');
  if (!hasServiceRole) back('لازم SUPABASE_SERVICE_ROLE_KEY');
  const on = formData.get('on') === '1';
  await createAdminClient().from('app_settings').upsert({ key: 'social_auto', value: on ? 'on' : 'off' }, { onConflict: 'key' });
  back(on ? 'النشر التلقائي شغّال. أي منتج هيتنشر للعلن هيدخل الطابور.' : 'النشر التلقائي اتقفل.');
}

export async function postSocialNow() {
  await assertPermission('social');
  if (!hasServiceRole) back('لازم SUPABASE_SERVICE_ROLE_KEY');
  const r = await runSocialBatch(createAdminClient(), 2);
  back(`اتنشر ${r.sent} · فشل ${r.failed} · اتخطّى ${r.skipped}`);
}

export async function retryFailedSocial() {
  await assertPermission('social');
  if (!hasServiceRole) back('لازم SUPABASE_SERVICE_ROLE_KEY');
  await createAdminClient().from('social_posts').update({ status: 'pending', error: null }).eq('status', 'failed');
  back('رجّعت الفاشل للطابور.');
}
