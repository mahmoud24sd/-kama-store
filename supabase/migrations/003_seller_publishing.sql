-- =====================================================================
-- نشر منتجات الغير برسم (10 ج.م عبر InstaPay) + اسم المحل
-- شغّل هذا الملف كاملًا مرة واحدة في Supabase → SQL Editor (بعد 001 و 002).
-- آمن لو اتشغّل أكثر من مرة.
-- =====================================================================

-- ---------- المنتجات: صاحب المنتج + اسم المحل + حالة النشر ----------
alter table public.products add column if not exists seller_id uuid references auth.users(id) on delete set null;
alter table public.products add column if not exists shop_name text;
alter table public.products add column if not exists status text not null default 'published';
alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check check (status in ('draft', 'pending', 'published', 'rejected'));
create index if not exists products_seller_idx on public.products (seller_id);

-- ---------- طلبات النشر (إثبات دفع الرسم) ----------
create table if not exists public.publish_requests (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  amount        numeric(10, 2) not null check (amount >= 0),
  payment_ref   text not null,
  sender_phone  text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note    text,
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists publish_requests_status_idx on public.publish_requests (status, created_at);
-- نفس رقم العملية لا يُستخدم مرتين (إلا لو رُفض الطلب السابق)
create unique index if not exists publish_requests_ref_unique
  on public.publish_requests (lower(payment_ref)) where status <> 'rejected';

alter table public.publish_requests enable row level security;
drop policy if exists publish_requests_select on public.publish_requests;
create policy publish_requests_select on public.publish_requests for select using (
  user_id = auth.uid() or public.has_permission('publishing')
);
-- لا توجد سياسات إدخال/تعديل: الكتابة تتم من السيرفر فقط (service role) بعد التحقق

-- ---------- إعدادات: حساب InstaPay ورسم النشر (قراءة عامة، التعديل للمالك) ----------
drop policy if exists settings_public_read on public.app_settings;
create policy settings_public_read on public.app_settings for select using (
  key in ('contact_phone', 'contact_email', 'contact_whatsapp', 'social_facebook', 'social_instagram', 'social_tiktok',
          'instapay_handle', 'publish_fee')
);
insert into public.app_settings (key, value) values ('instapay_handle', ''), ('publish_fee', '10')
on conflict (key) do nothing;
