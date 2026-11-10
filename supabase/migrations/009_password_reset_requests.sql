-- =====================================================================
-- استعادة كلمة المرور عبر الدعم: الطلب يصل للأدمن، والأدمن يرسل رمزًا (صالح 3 أيام) على واتساب
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor (بعد 001). آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

create table if not exists public.password_reset_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  identifier      text not null,            -- ما كتبه العميل (بريد أو رقم)
  full_name       text,
  email           text,
  phone           text,                     -- الرقم المسجّل في الحساب وقت الطلب (الإرسال له فقط)
  -- pending = ينتظر الأدمن | sent = أُرسل رمز | used = استُخدم | cancelled = أُلغي أو استُهلكت محاولاته
  status          text not null default 'pending' check (status in ('pending', 'sent', 'used', 'cancelled')),
  code_hash       text,                     -- HMAC للرمز، لا يُخزَّن الرمز نفسه أبدًا
  code_expires_at timestamptz,
  attempts        int not null default 0,
  handled_by      uuid references auth.users(id) on delete set null,
  handled_by_name text,
  sent_at         timestamptz,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists password_reset_status_idx on public.password_reset_requests (status, created_at desc);
create index if not exists password_reset_user_idx on public.password_reset_requests (user_id, created_at desc);

alter table public.password_reset_requests enable row level security;

-- القراءة لمن لديه صلاحية «باسورد مؤقت» (والمالك). لا توجد سياسات كتابة: الكتابة من السيرفر فقط (service role)
drop policy if exists password_reset_select on public.password_reset_requests;
create policy password_reset_select on public.password_reset_requests for select using (public.has_permission('temp_password'));
