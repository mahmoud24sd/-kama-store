-- =====================================================================
-- بوت تليجرام: سحب منشورات قناة عامة من اللينك (آخر N يوم). يلزم تشغيل 012 أولًا.
-- شغّل هذا الملف مرة واحدة في Supabase → SQL Editor. آمن لو اتشغّل أكثر من مرة.
-- =====================================================================
alter table public.telegram_items add column if not exists posted_at timestamptz;
alter table public.telegram_items add column if not exists post_url  text;
