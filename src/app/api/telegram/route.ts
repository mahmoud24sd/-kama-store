import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { csvRow, parseCaption, withMarkup } from '@/lib/telegramParse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOKEN = () => (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
const OWNER = () => (process.env.TELEGRAM_OWNER_ID ?? '').trim();
const BUCKET = 'product-images';
const HEADER = 'name,price,compare_at_price,stock,category,brand,shop_name,description,details,image_urls,publish,cost_price,supplier,private_notes,affiliate_url,asin';

type TgPhoto = { file_id: string };
type TgMsg = {
  message_id: number;
  chat: { id: number; type: string; title?: string; username?: string };
  from?: { id: number };
  text?: string;
  caption?: string;
  photo?: TgPhoto[];
  media_group_id?: string;
  forward_origin?: { chat?: { title?: string }; sender_user?: { first_name?: string }; sender_user_name?: string };
  forward_from_chat?: { title?: string };
};

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return (await res.json().catch(() => null)) as { ok?: boolean; result?: Record<string, unknown> } | null;
}
const say = (chat: number, text: string) => tg('sendMessage', { chat_id: chat, text }).catch(() => null);

async function sendCsv(chat: number, csv: string, filename: string, caption: string) {
  const form = new FormData();
  form.append('chat_id', String(chat));
  form.append('caption', caption);
  form.append('document', new Blob(['﻿' + csv], { type: 'text/csv' }), filename);
  await fetch(`https://api.telegram.org/bot${TOKEN()}/sendDocument`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
}

type Db = ReturnType<typeof createAdminClient>;

async function getState(db: Db, key: string, fallback: string) {
  const { data } = await db.from('telegram_state').select('value').eq('key', key).maybeSingle();
  return (data?.value as string | undefined) ?? fallback;
}
const setState = (db: Db, key: string, value: string) => db.from('telegram_state').upsert({ key, value });

/** ينزّل الصورة من تليجرام ويرفعها لمخزن الموقع ويرجع رابطها العام (لا نكشف توكن البوت أبدًا) */
async function savePhoto(db: Db, fileId: string): Promise<string | null> {
  try {
    const info = await tg('getFile', { file_id: fileId });
    const path = info?.result?.file_path as string | undefined;
    if (!path) return null;
    const res = await fetch(`https://api.telegram.org/file/bot${TOKEN()}/${path}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const objectPath = `telegram/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.jpg`;
    const { error } = await db.storage.from(BUCKET).upload(objectPath, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) return null;
    return db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  } catch {
    return null;
  }
}

const sourceOf = (m: TgMsg) =>
  m.forward_origin?.chat?.title || m.forward_from_chat?.title || m.forward_origin?.sender_user?.first_name || m.forward_origin?.sender_user_name || m.chat.title || 'تليجرام';

async function collect(db: Db, m: TgMsg) {
  const caption = m.caption ?? m.text ?? '';
  const largest = m.photo && m.photo.length > 0 ? m.photo[m.photo.length - 1] : null;
  const parsed = parseCaption(caption);
  if (!largest && parsed.price === null) return;

  const url = largest ? await savePhoto(db, largest.file_id) : null;

  const append = async () => {
    const { data: ex } = await db.from('telegram_items').select('id,name,price,description,images').eq('chat_id', m.chat.id).eq('media_group_id', m.media_group_id as string).maybeSingle();
    if (!ex) return false;
    const images = [...((ex.images as string[]) ?? []), ...(url ? [url] : [])].slice(0, 6);
    const patch: Record<string, unknown> = { images };
    if (!ex.name && parsed.name) patch.name = parsed.name;
    if (ex.price == null && parsed.price !== null) patch.price = parsed.price;
    if (!ex.description && parsed.description) patch.description = parsed.description;
    await db.from('telegram_items').update(patch).eq('id', ex.id);
    return true;
  };

  if (m.media_group_id && (await append())) return;

  const { error } = await db.from('telegram_items').insert({
    chat_id: m.chat.id,
    message_id: m.message_id,
    media_group_id: m.media_group_id ?? null,
    source: sourceOf(m).slice(0, 120),
    name: parsed.name || null,
    description: parsed.description || null,
    price: parsed.price,
    images: url ? [url] : [],
  });
  // ألبوم وصلت صورته في نفس اللحظة من رسالة أخرى: ندمجها مع العنصر الموجود
  if (error && m.media_group_id) await append();
}

async function command(db: Db, m: TgMsg, text: string) {
  const [cmdRaw, ...rest] = text.trim().split(/\s+/);
  const cmd = cmdRaw.split('@')[0].toLowerCase();
  const arg = rest.join(' ').trim();
  const chat = m.chat.id;

  if (cmd === '/start' || cmd === '/help') {
    return say(
      chat,
      [
        `معرّفك: ${m.from?.id}`,
        'ابعت لي (أو حوّل لي) رسائل فيها صورة وسعر، وأنا أحفظها.',
        '',
        '/markup 20  ← زيادة 20% على الأسعار',
        '/category أزياء  ← القسم في الملف',
        '/publish on|off  ← هل المنتجات تتنشر مباشرة عند الاستيراد',
        '/count  ← كم منتج محفوظ',
        '/export  ← ملف إكسل بالجديد فقط',
        '/exportall  ← ملف بكل المنتجات',
      ].join('\n'),
    );
  }
  if (cmd === '/markup') {
    const n = Number(arg.replace('%', ''));
    if (!Number.isFinite(n) || n < -90 || n > 1000) return say(chat, 'اكتب رقم، مثلًا: /markup 20');
    await setState(db, 'markup', String(n));
    return say(chat, `تم. هيتزاد ${n}% على كل الأسعار في الملف.`);
  }
  if (cmd === '/category') {
    await setState(db, 'category', arg.slice(0, 80));
    return say(chat, arg ? `القسم في الملف: ${arg} (لازم يكون نفس اسم القسم في موقعك)` : 'تم مسح القسم.');
  }
  if (cmd === '/publish') {
    await setState(db, 'publish', arg === 'on' ? 'yes' : 'no');
    return say(chat, arg === 'on' ? 'المنتجات هتتنشر مباشرة عند الاستيراد.' : 'المنتجات هتدخل مخفية لحد ما تراجعها.');
  }
  if (cmd === '/count') {
    const [{ count: fresh }, { count: all }] = await Promise.all([
      db.from('telegram_items').select('id', { count: 'exact', head: true }).is('exported_at', null),
      db.from('telegram_items').select('id', { count: 'exact', head: true }),
    ]);
    return say(chat, `جديد (لم يُصدَّر): ${fresh ?? 0}\nالإجمالي: ${all ?? 0}\nنسبة الزيادة: ${await getState(db, 'markup', '0')}%`);
  }
  if (cmd === '/export' || cmd === '/exportall') {
    const all = cmd === '/exportall';
    let q = db.from('telegram_items').select('*').order('created_at', { ascending: true }).limit(2000);
    if (!all) q = q.is('exported_at', null);
    const { data } = await q;
    const items = data ?? [];
    const markup = Number(await getState(db, 'markup', '0'));
    const category = await getState(db, 'category', '');
    const publish = await getState(db, 'publish', 'no');
    const ready = items.filter((i) => i.price != null && i.name && (i.images as string[]).length > 0);
    const skipped = items.length - ready.length;
    if (ready.length === 0) return say(chat, skipped > 0 ? `${skipped} منتج ناقص (اسم أو سعر أو صورة)، ماتصدّرش.` : 'مفيش منتجات جديدة.');
    const rows = ready.map((i) =>
      csvRow([i.name, withMarkup(Number(i.price), markup), '', 10, category, '', '', i.description ?? '', '', (i.images as string[]).join('|'), publish === 'yes' ? 'yes' : '', i.price, i.source ?? '', '', '', '']),
    );
    await sendCsv(chat, [HEADER, ...rows].join('\r\n'), `products-${new Date().toISOString().slice(0, 10)}.csv`, `${ready.length} منتج · زيادة ${markup}%${skipped ? ` · ${skipped} ناقص ماتصدّرش` : ''}`);
    await db.from('telegram_items').update({ exported_at: new Date().toISOString() }).in('id', ready.map((i) => i.id as string));
    return;
  }
  return say(chat, 'أمر غير معروف. اكتب /help');
}

export async function POST(req: Request) {
  // تليجرام يرسل السر في هذا الهيدر لو ضبطناه عند setWebhook
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  if (secret.length < 16 || a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse('Forbidden', { status: 403 });
  if (!TOKEN() || !hasServiceRole) return NextResponse.json({ ok: true });

  try {
    const update = (await req.json()) as { message?: TgMsg; channel_post?: TgMsg };
    const m = update.message ?? update.channel_post;
    if (!m) return NextResponse.json({ ok: true });
    const db = createAdminClient();
    const isOwner = String(m.from?.id ?? '') === OWNER() && OWNER() !== '';
    const text = m.text ?? '';

    if (text.startsWith('/')) {
      if (text.toLowerCase().startsWith('/start') && !isOwner) await say(m.chat.id, `معرّفك: ${m.from?.id}\nضيفه في TELEGRAM_OWNER_ID في Vercel.`);
      else if (isOwner) await command(db, m, text);
      return NextResponse.json({ ok: true });
    }
    // المحادثة الخاصة: للمالك فقط. الجروبات والقنوات التي أُضيف لها البوت: نجمع منها
    if (m.chat.type === 'private' && !isOwner) return NextResponse.json({ ok: true });
    await collect(db, m);
  } catch (e) {
    console.error('[telegram] error', e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
