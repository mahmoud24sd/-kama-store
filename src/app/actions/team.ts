'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertOwner, assertPermission } from '@/lib/auth';
import { PERMISSION_KEYS } from '@/lib/permissions';
import { SETTING_KEYS, type ContactSettings } from '@/lib/settings';
import { createAdminClient } from '@/lib/supabase/admin';

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

/* ───────────────────────── الفريق (المالك فقط) ───────────────────────── */

/** اجعله أدمن: يجب أن يكون المستخدم قد سجّل حسابًا أولًا */
export async function promoteToAdmin(formData: FormData) {
  const { supabase } = await assertOwner();
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get('email'));
  if (!parsed.success) fail('/admin/team', 'بريد إلكتروني غير صالح');

  const { data: target } = await supabase.from('profiles').select('id, role').eq('email', parsed.data!).maybeSingle();
  if (!target) fail('/admin/team', 'لا يوجد مستخدم بهذا البريد. يجب أن يسجّل حسابًا في المتجر أولًا');
  if (target!.role === 'owner') fail('/admin/team', 'هذا الحساب هو المالك بالفعل');

  const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', target!.id);
  if (error) fail('/admin/team', 'تعذّر ترقية المستخدم');

  revalidatePath('/admin/team');
  redirect('/admin/team?saved=1');
}

/** من صفحة المستخدمين: اجعله أدمن مع تحديد صلاحياته (مثل: يشوف المستخدمين والسحب أو لا) في خطوة واحدة */
export async function makeAdminWithPermissions(formData: FormData) {
  const { supabase } = await assertOwner();
  const back = '/admin/users';
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) fail(back, 'بيانات غير صالحة');

  const { data: target } = await supabase.from('profiles').select('id, role').eq('id', id.data!).maybeSingle();
  if (!target) fail(back, 'المستخدم غير موجود');
  if (target!.role !== 'customer') fail(back, 'هذا الحساب أدمن أو مالك بالفعل');

  const permissions = formData.getAll('permissions').map(String).filter((p) => PERMISSION_KEYS.includes(p));
  const { error } = await supabase.from('profiles').update({ role: 'admin', permissions }).eq('id', id.data!).eq('role', 'customer');
  if (error) fail(back, 'تعذّرت ترقية المستخدم. تأكد من تشغيل ملف supabase/migrations/001 في Supabase');

  revalidatePath('/admin/users');
  revalidatePath('/admin/team');
  redirect(`${back}?saved=1`);
}

export async function savePermissions(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) fail('/admin/team', 'بيانات غير صالحة');

  const permissions = formData.getAll('permissions').map(String).filter((p) => PERMISSION_KEYS.includes(p));
  const { error } = await supabase.from('profiles').update({ permissions }).eq('id', id.data!).eq('role', 'admin');
  if (error) fail('/admin/team', 'تعذّر حفظ الصلاحيات');

  revalidatePath('/admin/team');
  redirect('/admin/team?saved=1');
}

export async function demoteAdmin(formData: FormData) {
  const { supabase } = await assertOwner();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) fail('/admin/team', 'بيانات غير صالحة');

  const { error } = await supabase.from('profiles').update({ role: 'customer', permissions: [] }).eq('id', id.data!).eq('role', 'admin');
  if (error) fail('/admin/team', 'تعذّر إلغاء صلاحية الأدمن');

  revalidatePath('/admin/team');
  redirect('/admin/team?saved=1');
}

/* ───────────────────────── إعدادات التواصل (المالك فقط) ───────────────────────── */

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/i.test(v), 'الرابط يجب أن يبدأ بـ https://');

export async function saveContactSettings(formData: FormData) {
  const { supabase } = await assertPermission('settings');
  const parsed = z
    .object({
      phone: z.string().trim().max(40),
      email: z.string().trim().max(200).refine((v) => v === '' || z.string().email().safeParse(v).success, 'بريد إلكتروني غير صالح'),
      whatsapp: z.string().trim().max(300),
      facebook: optionalUrl,
      instagram: optionalUrl,
      tiktok: optionalUrl,
    })
    .safeParse({
      phone: formData.get('phone') ?? '',
      email: formData.get('email') ?? '',
      whatsapp: formData.get('whatsapp') ?? '',
      facebook: formData.get('facebook') ?? '',
      instagram: formData.get('instagram') ?? '',
      tiktok: formData.get('tiktok') ?? '',
    });
  if (!parsed.success) fail('/admin/settings', parsed.error.issues[0].message);

  const values = parsed.data as ContactSettings;
  const rows = (Object.keys(SETTING_KEYS) as (keyof ContactSettings)[]).map((k) => ({ key: SETTING_KEYS[k], value: values[k] }));
  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) fail('/admin/settings', 'تعذّر الحفظ. تأكد من تشغيل ملف supabase/migrations/001 في Supabase');

  revalidatePath('/', 'layout');
  redirect('/admin/settings?saved=1');
}

export async function savePublishSettings(formData: FormData) {
  const { supabase } = await assertPermission('settings');
  const parsed = z
    .object({
      instapay: z.string().trim().max(400),
      fee: z.coerce.number().min(0, 'الرسم غير صالح').max(100000),
    })
    .safeParse({ instapay: formData.get('instapay') ?? '', fee: formData.get('fee') });
  if (!parsed.success) fail('/admin/settings', parsed.error.issues[0].message);

  const { error } = await supabase.from('app_settings').upsert(
    [
      { key: 'instapay_handle', value: parsed.data!.instapay },
      { key: 'publish_fee', value: String(parsed.data!.fee) },
    ],
    { onConflict: 'key' },
  );
  if (error) fail('/admin/settings', 'تعذّر الحفظ. تأكد من تشغيل ملف supabase/migrations/003 في Supabase');

  revalidatePath('/', 'layout');
  redirect('/admin/settings?saved=1');
}

/* ───────────────────────── باسورد مؤقت وحذف المستخدم ───────────────────────── */

export type TempPasswordState = { password?: string; error?: string };

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateTempPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** هل يحق للمنفّذ التعامل مع هذا المستخدم؟ المالك لا يُمَس، وحسابات الأدمن للمالك فقط */
async function checkTarget(
  supabase: Awaited<ReturnType<typeof assertPermission>>['supabase'],
  actor: { id: string; role: string },
  targetId: string,
): Promise<string | null> {
  if (targetId === actor.id) return 'لا يمكنك تنفيذ ذلك على حسابك أنت';
  const { data: target } = await supabase.from('profiles').select('id, role').eq('id', targetId).maybeSingle();
  if (!target) return 'المستخدم غير موجود';
  if (target.role === 'owner') return 'لا يمكن تنفيذ ذلك على المالك';
  if (target.role === 'admin' && actor.role !== 'owner') return 'حسابات الأدمن يديرها المالك فقط';
  return null;
}

export async function createTempPassword(_prev: TempPasswordState, formData: FormData): Promise<TempPasswordState> {
  try {
    const { supabase, profile } = await assertPermission('temp_password');
    const id = z.string().uuid().safeParse(formData.get('id'));
    if (!id.success) return { error: 'بيانات غير صالحة' };

    const problem = await checkTarget(supabase, profile, id.data);
    if (problem) return { error: problem };

    const admin = createAdminClient();
    if (!admin) return { error: 'لم يُضَف المفتاح السري SUPABASE_SERVICE_ROLE_KEY في Vercel بعد' };

    const password = generateTempPassword();
    const { error } = await admin.auth.admin.updateUserById(id.data, { password });
    if (error) return { error: 'تعذّر تعيين كلمة المرور المؤقتة' };
    return { password };
  } catch {
    return { error: 'ليست لديك صلاحية لهذا الإجراء' };
  }
}

export async function deleteUser(formData: FormData) {
  const { supabase, profile } = await assertPermission('delete_user');
  const back = '/admin/customers';
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) fail(back, 'بيانات غير صالحة');

  const problem = await checkTarget(supabase, profile, id.data!);
  if (problem) fail(back, problem);

  const admin = createAdminClient();
  if (!admin) fail(back, 'لم يُضَف المفتاح السري SUPABASE_SERVICE_ROLE_KEY في Vercel بعد');

  const { error } = await admin!.auth.admin.deleteUser(id.data!);
  if (error) fail(back, 'تعذّر حذف المستخدم');

  revalidatePath('/admin/customers');
  revalidatePath('/admin/team');
  redirect(`${back}?saved=1`);
}

/* ───────────────────────── الأرباح والسحب ───────────────────────── */

export async function recordWithdrawal(formData: FormData) {
  const { supabase, profile } = await assertPermission('withdraw');
  const parsed = z
    .object({ amount: z.coerce.number().positive('المبلغ غير صالح').max(100_000_000), note: z.string().trim().max(300).optional() })
    .safeParse({ amount: formData.get('amount'), note: formData.get('note') ?? '' });
  if (!parsed.success) fail('/admin/earnings', parsed.error.issues[0].message);

  const { data: delivered } = await supabase.from('orders').select('total').eq('status', 'delivered');
  const { data: taken } = await supabase.from('withdrawals').select('amount');
  const earned = (delivered ?? []).reduce((s, o) => s + Number(o.total), 0);
  const withdrawn = (taken ?? []).reduce((s, w) => s + Number(w.amount), 0);
  if (parsed.data!.amount > earned - withdrawn) fail('/admin/earnings', 'المبلغ أكبر من الرصيد المتاح');

  const { error } = await supabase.from('withdrawals').insert({
    amount: parsed.data!.amount,
    note: parsed.data!.note || null,
    created_by: profile.id,
    created_by_name: profile.full_name || profile.email,
  });
  if (error) fail('/admin/earnings', 'تعذّر تسجيل السحب. تأكد من تشغيل ملف supabase/migrations/001 في Supabase');

  revalidatePath('/admin/earnings');
  redirect('/admin/earnings?saved=1');
}
