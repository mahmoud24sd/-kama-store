-- سبب النقل للمهملات (مثلًا: «متكرر» لو المنتج موجود قبل كده). شغّله مرة واحدة بعد 020.
alter table public.products add column if not exists trash_reason text;
