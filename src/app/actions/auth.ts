'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { confirmStaleAccount, createAdminClient, emailsForPhone, hasServiceRole } from '@/lib/supabase/admin';
import { getSiteUrl } from '@/lib/site';
import { GOVERNORATES, normalizeInternationalPhone, phoneToEmail } from '@/lib/governorates';
import { findProfiles } from '@/lib/resetLookup';
import { codesMatch, MAX_ATTEMPTS } from '@/lib/resetCodes';

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
  let candidates: string[] | null = null;
  if (byPhone) {
    const e164 = normalizeInternationalPhone(String(formData.get('phone_country') ?? '20'), String(formData.get('phone') ?? ''));
    if (!e164) return { error: 'أدخل رقم هاتف صحيح واختر الدولة' };
    email = phoneToEmail(e164);
    try {
      candidates = await emailsForPhone(e164, email);
    } catch {
      candidates = [email];
    }
  }
  const parsed = z
    .object({ email: z.string().email('بريد إلكتروني غير صالح'), password: z.string().min(1, 'أدخل كلمة المرور') })
    .safeParse({ email, password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    let error: { message: string } | null = null;
    // الدخول بالهاتف: نجرّب كل حساب مرتبط بالرقم (بريد حقيقي أو حساب هاتف فقط) حتى تنجح كلمة المرور
    for (const candidate of candidates ?? [parsed.data.email]) {
      const creds = { email: candidate, password: parsed.data.password };
      ({ error } = await supabase.auth.signInWithPassword(creds));
      // حساب قديم لم يُؤكَّد بسبب فشل البريد: نؤكده ونعيد المحاولة مرة واحدة
      if (error?.message.toLowerCase().includes('email not confirmed') && (await confirmStaleAccount(candidate))) {
        ({ error } = await supabase.auth.signInWithPassword(creds));
      }
      if (!error) break;
      if (!error.message.toLowerCase().includes('invalid login')) break;
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
  // التسجيل يتطلب البريد الإلكتروني ورقم الهاتف معًا (الاسم والمحافظة وكلمة المرور أيضًا)
  const byPhone = false;
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

const RESET_REQUEST_MESSAGE =
  'تم استلام طلبك. إذا كان الحساب موجودًا فسيرسل لك فريق الدعم رمزًا على واتساب (على الرقم المسجّل في حسابك)، وهو صالح 3 أيام. بعد وصوله افتح صفحة «لدي رمز».';

/** نسيت كلمة المرور: يصل طلب للأدمن (بالبريد أو الرقم)، ويُرسل له رمز على واتساب. نفس الرد دائمًا حتى لا نكشف وجود الحساب */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const byPhone = formData.get('mode') === 'phone';
  const dial = String(formData.get('phone_country') ?? '20');
  const rawPhone = String(formData.get('phone') ?? '');
  let email = '';
  let e164: string | null = null;
  if (byPhone) {
    e164 = normalizeInternationalPhone(dial, rawPhone);
    if (!e164) return { error: 'أدخل رقم هاتف صحيح واختر الدولة' };
  } else {
    const parsed = z.string().trim().email('بريد إلكتروني غير صالح').safeParse(formData.get('email'));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    email = parsed.data;
  }

  // 1) سجّل طلبًا ينتظر الأدمن (لو وُجد حساب مطابق). طلب واحد نشط لكل حساب كل ساعة
  if (hasServiceRole) {
    try {
      const db = createAdminClient();
      const found = await findProfiles(db, byPhone ? { dial, phone: rawPhone } : { email });
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      for (const p of found) {
        const { data: recent } = await db
          .from('password_reset_requests')
          .select('id')
          .eq('user_id', p.id)
          .in('status', ['pending', 'sent'])
          .gte('created_at', since)
          .limit(1);
        if (recent && recent.length > 0) continue;
        await db.from('password_reset_requests').insert({
          user_id: p.id,
          identifier: byPhone ? (e164 as string) : email,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
        });
      }
    } catch (e) {
      console.error('[auth] reset request error:', errMsg(e));
    }
  } else {
    console.error('[auth] reset request skipped: SUPABASE_SERVICE_ROLE_KEY missing');
  }

  // 2) بريد الاستعادة التقليدي كخيار إضافي (يعمل لو إعدادات البريد في Supabase سليمة)
  if (!byPhone) {
    try {
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset` });
    } catch (e) {
      console.error('[auth] reset email error:', errMsg(e));
    }
  }
  return { message: RESET_REQUEST_MESSAGE };
}

/** تعيين كلمة مرور جديدة بالرمز الذي أرسله الدعم (8 أرقام، صالح 3 أيام، 5 محاولات خاطئة كحد أقصى) */
export async function resetWithCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const byPhone = formData.get('mode') === 'phone';
  const dial = String(formData.get('phone_country') ?? '20');
  const rawPhone = String(formData.get('phone') ?? '');
  const BAD = 'الرمز غير صحيح أو منتهي الصلاحية. اطلب رمزًا جديدًا من «نسيت كلمة المرور».';

  const toLatin = (v: string) => v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const parsed = z
    .object({
      code: z.string().regex(/^\d{8}$/, 'الرمز مكوّن من 8 أرقام'),
      password: passwordSchema,
      confirm: z.string(),
      email: z.string().trim().email('بريد إلكتروني غير صالح').optional(),
    })
    .refine((d) => d.password === d.confirm, { message: 'كلمتا المرور غير متطابقتين', path: ['confirm'] })
    .safeParse({
      code: toLatin(String(formData.get('code') ?? '')).replace(/\s/g, ''),
      password: formData.get('password'),
      confirm: formData.get('confirm'),
      email: byPhone ? undefined : String(formData.get('email') ?? ''),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (byPhone && !normalizeInternationalPhone(dial, rawPhone)) return { error: 'أدخل رقم هاتف صحيح واختر الدولة' };
  if (!hasServiceRole) return { error: 'الخدمة غير متاحة حاليًا. تواصل مع الدعم.' };

  let signInEmail: string | null = null;
  try {
    const db = createAdminClient();
    const found = await findProfiles(db, byPhone ? { dial, phone: rawPhone } : { email: parsed.data.email });
    if (found.length === 0) return { error: BAD };

    const { data: reqs } = await db
      .from('password_reset_requests')
      .select('id,user_id,code_hash,attempts')
      .in('user_id', found.map((f) => f.id))
      .eq('status', 'sent')
      .gt('code_expires_at', new Date().toISOString())
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!reqs || reqs.length === 0) return { error: BAD };

    const match = reqs.find((r) => r.code_hash && codesMatch(r.code_hash as string, r.id as string, parsed.data.code));
    if (!match) {
      for (const r of reqs) {
        const attempts = Number(r.attempts) + 1;
        await db
          .from('password_reset_requests')
          .update({ attempts, ...(attempts >= MAX_ATTEMPTS ? { status: 'cancelled', code_hash: null } : {}) })
          .eq('id', r.id);
      }
      return { error: BAD };
    }

    const { error: upErr } = await db.auth.admin.updateUserById(match.user_id as string, { password: parsed.data.password });
    if (upErr) return { error: GENERIC_ERROR };

    // الرمز يُستخدم مرة واحدة، وأي طلبات أخرى لنفس الحساب تُلغى
    await db.from('password_reset_requests').update({ status: 'used', used_at: new Date().toISOString(), code_hash: null }).eq('id', match.id);
    await db
      .from('password_reset_requests')
      .update({ status: 'cancelled', code_hash: null })
      .eq('user_id', match.user_id)
      .in('status', ['pending', 'sent']);

    // حسابات الهاتف لها بريد داخلي في نظام الدخول وليس في profiles، فنقرأه من Auth
    const { data: au } = await db.auth.admin.getUserById(match.user_id as string);
    signInEmail = au?.user?.email ?? found.find((f) => f.id === match.user_id)?.email ?? null;
  } catch (e) {
    console.error('[auth] reset with code error:', errMsg(e));
    return { error: GENERIC_ERROR };
  }

  let signedIn = false;
  if (signInEmail) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: parsed.data.password });
      signedIn = !error;
    } catch {
      signedIn = false;
    }
  }
  if (signedIn) redirect('/account?updated=1');
  return { message: 'تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.' };
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
