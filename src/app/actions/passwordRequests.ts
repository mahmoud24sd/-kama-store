'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertPermission } from '@/lib/auth';
import { generateCode, hashCode, expiryFromNow } from '@/lib/resetCodes';
import { getSiteUrl } from '@/lib/site';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { buildResetMessage, sendResetViaCloudApi, waLink, whatsappAutoConfigured } from '@/lib/whatsapp';

export type IssueState = {
  ok?: boolean;
  code?: string;
  expiresAt?: string;
  link?: string;
  message?: string;
  autoSent?: boolean;
  autoError?: string;
  error?: string;
};

/** ينشئ رمزًا جديدًا (صالح 3 أيام) للطلب ويرسله على واتساب الرقم المسجّل في الحساب */
export async function issueResetCode(_prev: IssueState, formData: FormData): Promise<IssueState> {
  try {
    const { profile } = await assertPermission('temp_password');
    if (!hasServiceRole) return { error: 'يلزم إضافة SUPABASE_SERVICE_ROLE_KEY في Vercel' };
    const id = z.string().uuid().safeParse(formData.get('id'));
    if (!id.success) return { error: 'بيانات غير صالحة' };

    const db = createAdminClient();
    const { data: req } = await db.from('password_reset_requests').select('id,user_id,full_name,status').eq('id', id.data).maybeSingle();
    if (!req || (req.status !== 'pending' && req.status !== 'sent')) return { error: 'الطلب غير موجود أو تمت معالجته' };

    // نرسل فقط للرقم المسجّل حاليًا في الحساب، وليس لأي رقم يكتبه الطالب
    const { data: target } = await db.from('profiles').select('phone,role,full_name').eq('id', req.user_id).maybeSingle();
    if (!target) return { error: 'الحساب غير موجود' };
    if (target.role === 'owner') return { error: 'لا يمكن استعادة كلمة مرور المالك من هنا' };
    if (target.role === 'admin' && profile.role !== 'owner') return { error: 'حسابات الأدمن يديرها المالك فقط' };
    if (!target.phone) return { error: 'لا يوجد رقم هاتف مسجّل في هذا الحساب، فلا يمكن إرسال الرمز بأمان. تواصل مع العميل بوسيلة أخرى.' };

    const code = generateCode();
    const expires = expiryFromNow();
    const { error } = await db
      .from('password_reset_requests')
      .update({
        code_hash: hashCode(req.id as string, code),
        code_expires_at: expires.toISOString(),
        attempts: 0,
        status: 'sent',
        sent_at: new Date().toISOString(),
        phone: target.phone,
        handled_by: profile.id,
        handled_by_name: profile.full_name || profile.email,
      })
      .eq('id', req.id);
    if (error) return { error: 'تعذّر إنشاء الرمز' };

    const site = getSiteUrl();
    const message = buildResetMessage((target.full_name as string | null) ?? (req.full_name as string | null), code, site);
    const result: IssueState = { ok: true, code, expiresAt: expires.toISOString(), message, link: waLink(target.phone as string, message) };

    // إرسال تلقائي لو تم إعداد WhatsApp Cloud API، وإلا يضغط الأدمن زر «إرسال على واتساب»
    if (whatsappAutoConfigured()) {
      const sent = await sendResetViaCloudApi(target.phone as string, code, site);
      result.autoSent = sent.ok;
      if (!sent.ok) result.autoError = sent.error;
    }

    revalidatePath('/admin/password-requests');
    return result;
  } catch {
    return { error: 'ليست لديك صلاحية لهذا الإجراء' };
  }
}

export async function cancelResetRequest(formData: FormData) {
  const { profile } = await assertPermission('temp_password');
  if (!hasServiceRole) return;
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  await createAdminClient()
    .from('password_reset_requests')
    .update({ status: 'cancelled', code_hash: null, handled_by: profile.id, handled_by_name: profile.full_name || profile.email })
    .eq('id', id.data)
    .in('status', ['pending', 'sent']);
  revalidatePath('/admin/password-requests');
}
