'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type FormState = { error?: string; message?: string };

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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
  if (m.includes('already registered') || m.includes('already been registered')) return 'هذا البريد مسجل بالفعل';
  if (m.includes('email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني أولًا من الرسالة المرسلة إليك';
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
  const parsed = z
    .object({ email: z.string().email('بريد إلكتروني غير صالح'), password: z.string().min(1, 'أدخل كلمة المرور') })
    .safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: friendlyAuthError(error.message) };
  } catch (e) {
    return { error: friendlyAuthError(errMsg(e)) };
  }

  redirect(safeNext(formData.get('next')));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      full_name: z.string().min(2, 'أدخل اسمك الكامل').max(100),
      email: z.string().email('بريد إلكتروني غير صالح'),
      password: passwordSchema,
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, { message: 'كلمتا المرور غير متطابقتين', path: ['confirm'] })
    .safeParse({
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirm: formData.get('confirm'),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.full_name },
        emailRedirectTo: `${siteUrl()}/auth/callback`,
      },
    });
    if (error) return { error: friendlyAuthError(error.message) };
    hasSession = Boolean(data.session);
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
