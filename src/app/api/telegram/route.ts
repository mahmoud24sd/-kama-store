import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { csvRow, parseCaption, withMarkup } from '@/lib/telegramParse';
import { channelFromLink, fetchChannelPage, groupPosts } from '@/lib/tmeScrape';

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

type Job = { channel: string; cutoff: number; before?: number; chat: number; collected: number; done?: boolean };

async function uploadFromUrl(db: Db, url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) return null;
    const objectPath = `telegram/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(objectPath, bytes, { contentType: type.startsWith('image/') ? type : 'image/jpeg', upsert: false });
    return error ? null : db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  } catch {
    return null;
  }
}

const channelChatId = (channel: string) => -(parseInt(createHash('sha1').update(channel.toLowerCase()).digest('hex').slice(0, 11), 16) + 1000000);

/** يعالج قناة عامة صفحة بصفحة حتى ينتهي وقت التنفيذ أو نصل لتاريخ البداية. يُستأنف بـ /continue */
async function runJob(db: Db) {
  const raw = await getState(db, 'job', '');
  if (!raw) return;
  const job = JSON.parse(raw) as Job;
  const started = Date.now();
  let finished = false;
  while (Date.now() - started < 40000) {
    const { posts, ok } = await fetchChannelPage(job.channel, job.before);
    if (!ok) {
      await say(job.chat, 'ما قدرتش أفتح القناة. تأكد إنها عامة وإن الرابط صحيح.');
      await db.from('telegram_state').delete().eq('key', 'job');
      return;
    }
    if (posts.length === 0) { finished = true; break; }
    const minId = Math.min(...posts.map((p) => p.id));
    const inRange = posts.filter((p) => p.time >= job.cutoff);
    const grouped = groupPosts(inRange);
    for (const g of grouped) {
      const parsed = parseCaption(g.text);
      if (!parsed.name || parsed.price === null || g.photos.length === 0) continue;
      const urls = (await Promise.all(g.photos.slice(0, 4).map((u) => uploadFromUrl(db, u)))).filter((u): u is string => Boolean(u));
      if (urls.length === 0) continue;
      const { error } = await db.from('telegram_items').upsert(
        { chat_id: channelChatId(job.channel), message_id: g.id, source: `@${job.channel}`, name: parsed.name, description: parsed.description || null, price: parsed.price, images: urls, posted_at: new Date(g.time).toISOString(), post_url: g.url },
        { onConflict: 'chat_id,message_id', ignoreDuplicates: true },
      );
      if (!error) job.collected += 1;
    }
    if (posts.some((p) => p.time < job.cutoff) || minId <= 1) { finished = true; break; }
    job.before = minId;
  }
  if (finished) {
    await db.from('telegram_state').delete().eq('key', 'job');
    await say(job.chat, `خلّصت قناة @${job.channel}: اتحفظ ${job.collected} منتج (فيه اسم وسعر وصورة).\nاكتب /export عشان تاخد ملف إكسل.`);
  } else {
    await setState(db, 'job', JSON.stringify(job));
    await say(job.chat, `لسه شغّال على @${job.channel}: اتحفظ ${job.collected} لحد دلوقتي. اكتب /continue عشان يكمل.`);
  }
}

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

async function getAdmins(db: Db): Promise<string[]> {
  try {
    const v = JSON.parse(await getState(db, 'admins', '[]')) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function command(db: Db, m: TgMsg, text: string, isOwner: boolean) {
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
        '/channel https://t.me/اسم_القناة 30  ← اسحب منتجات آخر 30 يوم من قناة عامة',
        '/continue  ← كمّل السحب لو وقف',
        '/add 50  ← زيادة 50 جنيه على كل منتج',
        '/markup 20  ← زيادة نسبة 20% (اختياري)',
        '/category أزياء  ← القسم في الملف',
        '/publish on|off  ← هل المنتجات تتنشر مباشرة عند الاستيراد',
        '/count  ← كم منتج محفوظ',
        ...(isOwner ? ['/addadmin 123456789  ← ضيف أدمن (رقم تليجرام)', '/removeadmin 123456789  ← احذف أدمن', '/admins  ← قائمة الأدمن'] : []),
        '/export  ← ملف إكسل بالجديد فقط',
        '/exportall  ← ملف بكل المنتجات',
      ].join('\n'),
    );
  }
  if (cmd === '/addadmin' || cmd === '/removeadmin' || cmd === '/admins') {
    if (!isOwner) return say(chat, 'الأمر ده للمالك بس.');
    const admins = await getAdmins(db);
    if (cmd === '/admins') return say(chat, admins.length ? `الأدمن:\n${admins.join('\n')}` : 'مفيش أدمن مضاف. اكتب /addadmin رقم_التليجرام');
    const id = arg.replace(/\D/g, '');
    if (id.length < 5 || id.length > 15) return say(chat, 'اكتب رقم حساب تليجرام، مثلًا: /addadmin 123456789\n(الشخص يبعت /start للبوت ويطلعله رقمه)');
    if (id === OWNER()) return say(chat, 'ده رقمك إنت المالك.');
    if (cmd === '/addadmin') {
      if (admins.length >= 20) return say(chat, 'وصلت الحد الأقصى (20 أدمن).');
      await setState(db, 'admins', JSON.stringify([...new Set([...admins, id])]));
      return say(chat, `تمت إضافة ${id} كأدمن. يقدر يستخدم كل أوامر البوت ما عدا إضافة وحذف الأدمن.`);
    }
    await setState(db, 'admins', JSON.stringify(admins.filter((a) => a !== id)));
    return say(chat, `تم حذف ${id} من الأدمن.`);
  }
  if (cmd === '/add') {
    const n = Number(arg);
    if (!Number.isFinite(n) || n < 0 || n > 100000) return say(chat, 'اكتب رقم، مثلًا: /add 50');
    await setState(db, 'fixed', String(n));
    return say(chat, `تم. هيتزاد ${n} جنيه على كل منتج في الملف.`);
  }
  if (cmd === '/channel') {
    const link = rest[0] ?? '';
    const channel = channelFromLink(link);
    if (!channel) return say(chat, 'ابعت رابط قناة عامة، مثلًا:\n/channel https://t.me/اسم_القناة 30\n(الجروبات والقنوات الخاصة مش بتتسحب بالطريقة دي. استخدم صفحة التصدير في الموقع.)');
    const days = Math.min(Math.max(Number(rest[1]) || 30, 1), 365);
    const job: Job = { channel, cutoff: Date.now() - days * 86400000, chat, collected: 0 };
    await setState(db, 'job', JSON.stringify(job));
    await say(chat, `تمام، بسحب منتجات @${channel} لآخر ${days} يوم. هبعتلك رسالة لما أخلّص. (استخدم منتجات عندك إذن منها)`);
    after(() => runJob(db));
    return;
  }
  if (cmd === '/continue') {
    if (!(await getState(db, 'job', ''))) return say(chat, 'مفيش سحب شغّال دلوقتي.');
    await say(chat, 'بكمّل...');
    after(() => runJob(db));
    return;
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
    const fixed = Number(await getState(db, 'fixed', '0'));
    const category = await getState(db, 'category', '');
    const publish = await getState(db, 'publish', 'no');
    const ready = items.filter((i) => i.price != null && i.name && (i.images as string[]).length > 0);
    const skipped = items.length - ready.length;
    if (ready.length === 0) return say(chat, skipped > 0 ? `${skipped} منتج ناقص (اسم أو سعر أو صورة)، ماتصدّرش.` : 'مفيش منتجات جديدة.');
    const rows = ready.map((i) =>
      csvRow([i.name, withMarkup(Number(i.price), markup) + fixed, '', 10, category, '', '', i.description ?? '', '', (i.images as string[]).join('|'), publish === 'yes' ? 'yes' : '', i.price, i.source ?? '', `السعر الأصلي: ${i.price} · المصدر: ${i.source ?? ''}${i.posted_at ? ' · ' + new Date(i.posted_at as string).toLocaleDateString('en-GB') : ''}${i.post_url ? ' · ' + i.post_url : ''}`, '', '']),
    );
    await sendCsv(chat, [HEADER, ...rows].join('\r\n'), `products-${new Date().toISOString().slice(0, 10)}.csv`, `${ready.length} منتج · زيادة ${fixed} جنيه${markup ? ` + ${markup}%` : ''}${skipped ? ` · ${skipped} ناقص ماتصدّرش` : ''}`);
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
    const isStaff = isOwner || (m.from?.id !== undefined && (await getAdmins(db)).includes(String(m.from.id)));
    const text = m.text ?? '';

    if (text.startsWith('/')) {
      if (text.toLowerCase().startsWith('/start') && !isStaff) await say(m.chat.id, `معرّفك: ${m.from?.id}\nابعته للمالك عشان يضيفك أدمن.${OWNER() ? '' : '\n(لو إنت المالك: ضيفه في TELEGRAM_OWNER_ID في Vercel.)'}`);
      else if (isStaff && m.chat.type === 'private') await command(db, m, text, isOwner);
      return NextResponse.json({ ok: true });
    }
    if (isStaff && m.chat.type === 'private' && !m.photo && channelFromLink(text) && /t\.me|telegram\.me|^@/i.test(text)) {
      await command(db, m, `/channel ${text.trim()}`, isOwner);
      return NextResponse.json({ ok: true });
    }
    // المحادثة الخاصة: للمالك فقط. الجروبات والقنوات التي أُضيف لها البوت: نجمع منها
    if (m.chat.type === 'private' && !isStaff) return NextResponse.json({ ok: true });
    await collect(db, m);
  } catch (e) {
    console.error('[telegram] error', e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
