'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { confirmStaleAccount, createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { getSiteUrl } from '@/lib/site';
import { GOVERNORATES, normalizeInternationalPhone, phoneToEmail } from '@/lib/governorates';

export type FormState = { error?: string; message?: string };

const siteUrl = () => getSiteUrl();

const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف')
  .max(72, 'كلمة المرور طويلة جدًا');

function safeNext(raw: FormDataEntryValue | null): string {
  const next = String(raw ?? '/');
  // يمنع إعادة التوجيه لروابط خارجية
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

const GENERIC_ERROR = 'تعذّر إكمال الطلب الآن. يرجى المحاولة بعد قليل، وإن استمر الأمر تواصل مع الدعم.';

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('already exists')) return 'هذا البريد مسجل بالفعل';
  if (m.includes('email not confirmed')) return 'حسابك لم يُفعَّل بعد. تواصل مع الدعم لتفعيله';
  if (m.includes('rate limit') || m.includes('too many')) return 'محاولات كثيرة، حاول مرة أخرى بعد قليل';
  if (m.includes('invalid api key') || m.includes('apikey')) {
    return 'إعداد الموقع غير صحيح: مفتاح Supabase (NEXT_PUBLIC_SUPABASE_ANON_KEY) غير صالح';
  }
  if (m.includes('database error saving new user')) {
    return 'تعذّر إنشاء ملف المستخدم في قاعدة البيانات (راجع schema.sql ودالة handle_new_user)';
  }
  if (m.includes('error sending') && m.includes('email')) {
    return 'تم إنشاء الحساب لكن تعذّر إرسال بريد التأكيد. حاول لاحقًا أو اطلب من الدعم تفعيل الحساب';
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'التسجيل غير مفعّل حاليًا';
  if (m.includes('fetch failed') || m.includes('failed to fetch') || m.includes('invalid url')) {
    return 'تعذّر الاتصال بـ Supabase: تأكد من NEXT_PUBLIC_SUPABASE_URL';
  }
  if (m.includes('bytestring')) {
    return 'إعداد الموقع غير صحيح: إحدى قيم Supabase في Vercel تحتوي على حروف غير مسموحة';
  }
  // السبب الحقيقي يُسجَّل في Vercel Logs فقط ولا يُعرض للزائر
  console.error('[auth] unexpected error:', message);
  return GENERIC_ERROR;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const byPhone = formData.get('mode') === 'phone';
  let email = String(formData.get('email') ?? '').trim();
  if (byPhone) {
    const e164 = normalizeInternationalPhone(String(formData.get('phone_country') ?? '20'), String(formData.get('phone') ?? ''));
    if (!e164) return { error: 'أدخل رقم هاتف صحيح واختر الدولة' };
    email = phoneToEmail(e164);
  }
  const parsed = z
    .object({ email: z.string().email('بريد إلكتروني غير صالح'), password: z.string().min(1, 'أدخل كلمة المرور') })
    .safeParse({ email, password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    let { error } = await supabase.auth.signInWithPassword(parsed.data);
    // حساب قديم لم يُؤكَّد بسبب فشل البريد: نؤكده ونعيد المحاولة مرة واحدة
    if (error?.message.toLowerCase().includes('email not confirmed') && (await confirmStaleAccount(parsed.data.email))) {
      ({ error } = await supabase.auth.signInWithPassword(parsed.data));
    }
    if (error) {
      const wrong = error.message.toLowerCase().includes('invalid login');
      return { error: byPhone && wrong ? 'رقم الهاتف أو كلمة المرور غير صحيحة' : friendlyAuthError(error.message) };
    }
  } catch (e) {
    return { error: friendlyAuthError(errMsg(e)) };
  }

  redirect(safeNext(formData.get('next')));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const byPhone = formData.get('mode') === 'phone';
  const phoneE164 = normalizeInternationalPhone(String(formData.get('phone_country') ?? '20'), String(formData.get('phone') ?? '')) ?? '';
  // التسجيل برقم الهاتف لا يرسل بريدًا أبدًا، فيحتاج المفتاح السري للسيرفر
  if (byPhone && !hasServiceRole) return { error: 'التسجيل برقم الهاتف غير متاح حاليًا. سجّل بالبريد الإلكتروني.' };
  const parsed = z
    .object({
      full_name: z.string().min(2, 'أدخل اسمك الكامل').max(100),
      email: z.string().trim().email('بريد إلكتروني غير صالح'),
      phone: z.string().min(1, 'أدخل رقم هاتف صحيح واختر الدولة'),
      governorate: z.enum(GOVERNORATES, { errorMap: () => ({ message: 'اختر المحافظة' }) }),
      password: passwordSchema,
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, { message: 'كلمتا المرور غير متطابقتين', path: ['confirm'] })
    .safeParse({
      full_name: formData.get('full_name'),
      email: byPhone ? phoneToEmail(phoneE164) : formData.get('email'),
      phone: phoneE164,
      governorate: formData.get('governorate'),
      password: formData.get('password'),
      confirm: formData.get('confirm'),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let hasSession = false;
  const meta = { full_name: parsed.data.full_name, phone: parsed.data.phone, governorate: parsed.data.governorate };
  try {
    const supabase = await createClient();

    if (hasServiceRole) {
      // إنشاء الحساب مؤكَّدًا من السيرفر (لا يحتاج إرسال بريد) ثم تسجيل الدخول مباشرة
      const admin = createAdminClient();
      const { error: createError } = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: meta,
      });
      if (createError) {
        const exists = /already|exists|registered/i.test(createError.message);
        // بريد سُجّل في محاولة سابقة فشلت ولم يُؤكَّد: نكمل التسجيل عليه بدل رسالة «مسجل بالفعل»
        const fixed = exists && (await confirmStaleAccount(parsed.data.email, { password: parsed.data.password, ...meta }));
        if (!fixed && byPhone && !exists) return { error: 'تعذّر التسجيل برقم الهاتف حاليًا. سجّل بالبريد الإلكتروني أو تواصل معنا.' };
        if (!fixed) return { error: byPhone && exists ? 'هذا الرقم مسجل بالفعل. سجّل الدخول.' : friendlyAuthError(createError.message) };
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInError) return { message: 'تم إنشاء الحساب بنجاح. سجّل الدخول الآن.' };
      hasSession = true;
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: meta, emailRedirectTo: `${siteUrl()}/auth/callback` },
      });
      if (error) return { error: friendlyAuthError(error.message) };
      hasSession = Boolean(data.session);
    }
  } catch (e) {
    return { error: friendlyAuthError(errMsg(e)) };
  }

  // إذا كان تأكيد البريد مفعّلًا في Supabase لن تكون هناك جلسة بعد
  if (!hasSession) {
    return { message: 'تم إنشاء الحساب. أرسلنا رسالة تأكيد إلى بريدك، افتحها لتفعيل الحساب ثم سجّل الدخول.' };
  }
  redirect(safeNext(formData.get('next')));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.string().email('بريد إلكتروني غير صالح').safeParse(formData.get('email'));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset`,
    });
  } catch (e) {
    console.error('[auth] reset error:', errMsg(e));
  }
  // نفس الرد دائمًا حتى لا نكشف وجود البريد من عدمه
  return { message: 'إذا كان البريد مسجلًا لدينا فقد أرسلنا إليه رابط استعادة كلمة المرور.' };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: 'كلمتا المرور غير متطابقتين', path: ['confirm'] })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'انتهت صلاحية الرابط. اطلب رابطًا جديدًا.' };

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { error: friendlyAuthError(error.message) };
  } catch (e) {
    return { error: friendlyAuthError(errMsg(e)) };
  }
  redirect('/account?updated=1');
}
