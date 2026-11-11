'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertOwner } from '@/lib/auth';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

const back = (q: string): never => redirect(`/admin/telegram?${q}`);
const err = (m: string) => back('error=' + encodeURIComponent(m));

/** إعدادات الملف الذي يطلّعه البوت: الزيادة والقسم والنشر. المالك فقط */
export async function saveBotSettings(formData: FormData) {
  await assertOwner();
  if (!hasServiceRole) return err('يلزم SUPABASE_SERVICE_ROLE_KEY في Vercel');
  const p = z
    .object({
      fixed: z.coerce.number().min(0).max(100000),
      markup: z.coerce.number().min(-90).max(1000),
      category: z.string().trim().max(80),
    })
    .safeParse({ fixed: formData.get('fixed'), markup: formData.get('markup'), category: formData.get('category') ?? '' });
  if (!p.success) return err('أرقام غير صالحة');
  const db = createAdminClient();
  const rows = [
    { key: 'fixed', value: String(p.data.fixed) },
    { key: 'markup', value: String(p.data.markup) },
    { key: 'category', value: p.data.category },
    { key: 'publish', value: formData.get('publish') === 'on' ? 'yes' : 'no' },
  ];
  const { error } = await db.from('telegram_state').upsert(rows);
  if (error) return err('تعذّر الحفظ. شغّل ملف 012 في Supabase.');
  revalidatePath('/admin/telegram');
  back('saved=1');
}

async function readAdmins(db: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data } = await db.from('telegram_state').select('value').eq('key', 'admins').maybeSingle();
  try {
    const v = JSON.parse((data?.value as string | undefined) ?? '[]') as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function addBotAdmin(formData: FormData) {
  await assertOwner();
  if (!hasServiceRole) return err('يلزم SUPABASE_SERVICE_ROLE_KEY في Vercel');
  const id = String(formData.get('id') ?? '').replace(/\D/g, '');
  if (id.length < 5 || id.length > 15) return err('اكتب رقم حساب تليجرام صحيح (الشخص يبعت /start للبوت ويطلعله رقمه)');
  const db = createAdminClient();
  const admins = await readAdmins(db);
  if (admins.length >= 20) return err('وصلت الحد الأقصى (20 أدمن)');
  await db.from('telegram_state').upsert({ key: 'admins', value: JSON.stringify([...new Set([...admins, id])]) });
  revalidatePath('/admin/telegram');
  back('saved=1');
}

export async function removeBotAdmin(formData: FormData) {
  await assertOwner();
  if (!hasServiceRole) return;
  const id = String(formData.get('id') ?? '').replace(/\D/g, '');
  const db = createAdminClient();
  const admins = await readAdmins(db);
  await db.from('telegram_state').upsert({ key: 'admins', value: JSON.stringify(admins.filter((a) => a !== id)) });
  revalidatePath('/admin/telegram');
  back('saved=1');
}
