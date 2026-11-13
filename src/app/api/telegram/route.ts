import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { csvRow, parseCaption, withMarkup } from '@/lib/telegramParse';
import { claimMatches } from '@/lib/telegramClaim';
import { getSiteUrl } from '@/lib/site';
import { slugify } from '@/lib/utils';
import { writeXlsx } from '@/lib/xlsx';
import { enqueueFile } from '@/lib/social';
import { existingNames, hasTrashReason, normName } from '@/lib/dedupe';
import { channelFromLink, fetchChannelPage, groupPosts } from '@/lib/tmeScrape';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOKEN = () => (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
// رقم المالك: من متغير TELEGRAM_OWNER_ID أو من الربط بالكود (/claim). يُحدَّث في بداية كل طلب
let ownerNow = (process.env.TELEGRAM_OWNER_ID ?? '').trim();
const OWNER = () => ownerNow;
const BUCKET = 'product-images';
const HEADER = 'name,price,compare_at_price,stock,category,brand,shop_name,description,details,image_urls,publish,cost_price,supplier,private_notes,affiliate_url,asin';

type TgPhoto = { file_id: string };
type TgMsg = {
  message_id: number;
  chat: { id: number; type: string; title?: string; username?: string };
  from?: { id: number; first_name?: string; username?: string };
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

async function sendDoc(chat: number, data: Buffer | string, filename: string, mime: string, caption: string) {
  const form = new FormData();
  form.append('chat_id', String(chat));
  form.append('caption', caption);
  form.append('document', new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type: mime }), filename);
  await fetch(`https://api.telegram.org/bot${TOKEN()}/sendDocument`, { method: 'POST', body: form, signal: AbortSignal.timeout(40000) });
}

const keyboard = (chat: number, text: string, rows: { text: string; data: string }[][]) =>
  tg('sendMessage', { chat_id: chat, text, reply_markup: { inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data }))) } }).catch(() => null);

type Db = ReturnType<typeof createAdminClient>;

async function getState(db: Db, key: string, fallback: string) {
  const { data } = await db.from('telegram_state').select('value').eq('key', key).maybeSingle();
  return (data?.value as string | undefined) ?? fallback;
}
const setState = (db: Db, key: string, value: string) => db.from('telegram_state').upsert({ key, value });
/** نحفظ اسم الأدمن عشان يظهر في الموقع مين رفع الملف */
const rememberName = (db: Db, from?: { id: number; first_name?: string; last_name?: string; username?: string }) => {
  const full = from ? [from.first_name, from.last_name].filter(Boolean).join(' ') : '';
  const nm = full || (from?.username ? `@${from.username}` : '');
  return from && nm ? setState(db, `name:${from.id}`, nm).then(() => null, () => null) : null;
};

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

type Job = { channel: string; cutoff: number; before?: number; chat: number; collected: number; by: number };

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
async function runJob(db: Db, by: number) {
  const raw = await getState(db, `job:${by}`, '');
  if (!raw) return;
  const job = JSON.parse(raw) as Job;
  const started = Date.now();
  let finished = false;
  while (Date.now() - started < 40000) {
    const { posts, ok } = await fetchChannelPage(job.channel, job.before);
    if (!ok) {
      await say(job.chat, 'ما قدرتش أفتح القناة. تأكد إنها عامة وإن الرابط صحيح.');
      await db.from('telegram_state').delete().eq('key', `job:${by}`);
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
        { chat_id: channelChatId(job.channel), message_id: g.id, source: `@${job.channel}`, name: parsed.name, description: parsed.description || null, price: parsed.price, images: urls, posted_at: new Date(g.time).toISOString(), post_url: g.url, added_by: by },
        { onConflict: 'chat_id,message_id,added_by', ignoreDuplicates: true },
      );
      if (!error) job.collected += 1;
    }
    if (posts.some((p) => p.time < job.cutoff) || minId <= 1) { finished = true; break; }
    job.before = minId;
  }
  if (finished) {
    await db.from('telegram_state').delete().eq('key', `job:${by}`);
    await say(job.chat, `خلّصت قناة @${job.channel}: اتحفظ ${job.collected} منتج (فيه اسم وسعر وصورة).`);
    if (job.collected > 0) {
      await uploadToSite(db, job.chat, by, false).catch(() => null);
      await keyboard(job.chat, 'وتقدر كمان تاخد ملف:', [[{ text: '📊 إكسل', data: 'exp:all:xlsx' }, { text: '🧾 JSON', data: 'exp:all:json' }]]);
    }
  } else {
    await setState(db, `job:${by}`, JSON.stringify(job));
    await say(job.chat, `لسه شغّال على @${job.channel}: اتحفظ ${job.collected} لحد دلوقتي. اكتب /continue عشان يكمل.`);
  }
}

async function collect(db: Db, m: TgMsg, by: number) {
  const caption = m.caption ?? m.text ?? '';
  const largest = m.photo && m.photo.length > 0 ? m.photo[m.photo.length - 1] : null;
  const parsed = parseCaption(caption);
  if (!largest && parsed.price === null) return;

  const url = largest ? await savePhoto(db, largest.file_id) : null;

  const append = async () => {
    const { data: ex } = await db.from('telegram_items').select('id,name,price,description,images').eq('chat_id', m.chat.id).eq('added_by', by).eq('media_group_id', m.media_group_id as string).maybeSingle();
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
    added_by: by,
  });
  // ألبوم وصلت صورته في نفس اللحظة من رسالة أخرى: ندمجها مع العنصر الموجود
  if (error && m.media_group_id) await append();
}

/** الجروبات والقنوات المسموح بالجمع منها (يضيفها المالك أو أدمن البوت فقط) */
async function getChats(db: Db): Promise<string[]> {
  try {
    const v = JSON.parse(await getState(db, 'chats', '[]')) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function getAdmins(db: Db): Promise<string[]> {
  try {
    const v = JSON.parse(await getState(db, 'admins', '[]')) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}


const CHUNK = 500; // أقصى عدد منتجات في الملف الواحد
type Fmt = 'xlsx' | 'json' | 'csv';
const COLS = HEADER.split(',');

async function readyItems(db: Db, by: number, all: boolean) {
  let q = db.from('telegram_items').select('*').eq('added_by', by).order('created_at', { ascending: true }).limit(5000);
  if (!all) q = q.is('exported_at', null);
  const { data } = await q;
  const items = data ?? [];
  const markup = Number(await getState(db, 'markup', '0'));
  const fixed = Number(await getState(db, 'fixed', '0'));
  const category = await getState(db, 'category', '');
  const publish = (await getState(db, 'publish', 'no')) === 'yes';
  const ready = items.filter((i) => i.price != null && i.name && (i.images as string[]).length > 0);
  return { ready, skipped: items.length - ready.length, markup, fixed, category, publish };
}

const noteOf = (i: Record<string, unknown>) =>
  `السعر الأصلي: ${i.price} · المصدر: ${i.source ?? ''}${i.posted_at ? ' · ' + new Date(i.posted_at as string).toLocaleDateString('en-GB') : ''}${i.post_url ? ' · ' + i.post_url : ''}`;

function buildFile(chunk: Record<string, unknown>[], st: { markup: number; fixed: number; category: string; publish: boolean }, fmt: Fmt): { data: Buffer | string; ext: string; mime: string } {
  const objs = chunk.map((i) => ({
    name: i.name as string,
    price: withMarkup(Number(i.price), st.markup) + st.fixed,
    compare_at_price: '',
    stock: 10,
    category: st.category,
    brand: '',
    shop_name: '',
    description: (i.description as string) ?? '',
    details: '',
    image_urls: i.images as string[],
    publish: st.publish ? 'yes' : '',
    cost_price: Number(i.price),
    supplier: (i.source as string) ?? '',
    private_notes: noteOf(i),
    affiliate_url: '',
    asin: '',
  }));
  if (fmt === 'json') return { data: JSON.stringify(objs, null, 2), ext: 'json', mime: 'application/json' };
  if (fmt === 'xlsx') {
    const rows = [COLS as (string | number | null)[], ...objs.map((o) => COLS.map((c) => { const v = (o as Record<string, unknown>)[c]; return Array.isArray(v) ? v.join('|') : (v as string | number); }))];
    return { data: writeXlsx(rows), ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
  const rows = objs.map((o) => csvRow(COLS.map((c) => { const v = (o as Record<string, unknown>)[c]; return Array.isArray(v) ? v.join('|') : v; })));
  return { data: '﻿' + [HEADER, ...rows].join('\r\n'), ext: 'csv', mime: 'text/csv' };
}

/** يرسل الملفات (500 منتج كحد أقصى في الملف الواحد) بالصيغة المختارة */
async function exportFiles(db: Db, chat: number, by: number, all: boolean, fmt: Fmt) {
  const st = await readyItems(db, by, all);
  if (st.ready.length === 0) return say(chat, st.skipped > 0 ? `${st.skipped} منتج ناقص (اسم أو سعر أو صورة)، ماتصدّرش.` : 'مفيش منتجات جديدة.');
  const parts = Math.ceil(st.ready.length / CHUNK);
  const day = new Date().toISOString().slice(0, 10);
  for (let k = 0; k < parts; k++) {
    const chunk = st.ready.slice(k * CHUNK, (k + 1) * CHUNK);
    const f = buildFile(chunk, st, fmt);
    await sendDoc(chat, f.data, `products-${day}${parts > 1 ? `-part${k + 1}` : ''}.${f.ext}`, f.mime, `ملف ${k + 1} من ${parts} · ${chunk.length} منتج · زيادة ${st.fixed} جنيه${st.markup ? ` + ${st.markup}%` : ''}`);
    await db.from('telegram_items').update({ exported_at: new Date().toISOString() }).in('id', chunk.map((i) => i.id as string));
  }
  if (st.skipped) await say(chat, `${st.skipped} منتج ناقص (اسم أو سعر أو صورة)، ماتصدّرش.`);
}

/** يرفع المنتجات للموقع كملفات (500 في الملف) كمسودة، وبجانب كل ملف زر «نشر» */
async function uploadToSite(db: Db, chat: number, by: number, all: boolean) {
  const st = await readyItems(db, by, all);
  if (st.ready.length === 0) return say(chat, st.skipped > 0 ? `${st.skipped} منتج ناقص (اسم أو سعر أو صورة)، ماتترفعش.` : 'مفيش منتجات جديدة ترفعها.');
  let categoryId: string | null = null;
  if (st.category) {
    const { data: cats } = await db.from('categories').select('id,name,slug');
    categoryId = (cats ?? []).find((c) => String(c.name).trim().toLowerCase() === st.category.trim().toLowerCase() || String(c.slug).toLowerCase() === st.category.trim().toLowerCase())?.id ?? null;
  }
  const seen = await existingNames(db);
  const canReason = await hasTrashReason(db);
  let dups = 0;
  const parts = Math.ceil(st.ready.length / CHUNK);
  const day = new Date().toLocaleDateString('en-GB');
  for (let k = 0; k < parts; k++) {
    const chunk = st.ready.slice(k * CHUNK, (k + 1) * CHUNK);
    const label = `${(chunk[0].source as string) || 'تليجرام'} ${day}${parts > 1 ? ` (${k + 1})` : ''}`;
    const fileRow = { name: label, source: 'bot', markup: st.fixed, is_public: false, tg_by: by };
    let { data: file, error: fErr } = await db.from('product_files').insert({ ...fileRow, stage: 'inbox' }).select('id').single();
    if (!file) ({ data: file, error: fErr } = await db.from('product_files').insert(fileRow).select('id').single()); // قبل تشغيل 024
    if (fErr || !file) return say(chat, 'ما قدرتش أعمل الملف على الموقع. لازم المالك يشغّل ملف supabase/migrations/020_product_files.sql في Supabase.');
    let saved = 0;
    for (let i = 0; i < chunk.length; i += 50) {
      const part = chunk.slice(i, i + 50);
      const isDup = part.map((it) => {
        const key = normName(String(it.name));
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      const keep = part.map((it, n) => ({ it, dup: isDup[n] })).filter((x) => canReason || !x.dup);
      dups += part.length - keep.filter((x) => !x.dup).length;
      if (keep.length === 0) continue;
      const now = new Date().toISOString();
      const rows = keep.map(({ it, dup }) => {
        const base = withMarkup(Number(it.price), st.markup);
        return { name: String(it.name).slice(0, 200), slug: `${slugify(String(it.name)) || 'p'}-${Math.random().toString(36).slice(2, 8)}`, description: (it.description as string) || null, price: base + st.fixed, base_price: base, stock: 10, is_active: false, category_id: categoryId, file_id: file.id as string, ...(dup ? { deleted_at: now, trash_reason: 'متكرر' } : {}) };
      });
      const { data: ins, error } = await db.from('products').insert(rows).select('id,slug');
      if (error || !ins) continue;
      const idBySlug = new Map(ins.map((d) => [d.slug as string, d.id as string]));
      const live = keep.filter((x) => !x.dup);
      const imgs = keep.flatMap(({ it, dup }, n) => { const pid = idBySlug.get(rows[n].slug); return pid && !dup ? (it.images as string[]).map((url, o) => ({ product_id: pid, url, sort_order: o })) : []; });
      if (imgs.length) await db.from('product_images').insert(imgs);
      const priv = keep.flatMap(({ it, dup }, n) => { const pid = idBySlug.get(rows[n].slug); return pid && !dup ? [{ product_id: pid, cost_price: Number(it.price), supplier: (it.source as string) || null, notes: noteOf(it) }] : []; });
      if (priv.length) await db.from('product_private').insert(priv);
      saved += live.length;
      await db.from('telegram_items').update({ exported_at: now }).in('id', part.map((x) => x.id as string));
    }
    await keyboard(chat, `✅ اترفع للموقع (مسودة): «${label}»\n${saved} منتج · زيادة ${st.fixed} جنيه${dups ? `\n${dups} منتج متكرر ما اترفعش (راح المهملات)` : ''}\nافتحه من: ${getSiteUrl()}/admin/files`, [[{ text: 'نشر للعلن ✅', data: `pub:${file.id}` }]]);
  }
}

const formatButtons = (all: boolean) => [
  [{ text: '📊 إكسل', data: `exp:${all ? 'all' : 'new'}:xlsx` }, { text: '🧾 JSON', data: `exp:${all ? 'all' : 'new'}:json` }],
  [{ text: '🌐 رفع للموقع (مسودة + نشر)', data: `up:${all ? 'all' : 'new'}` }],
];

async function command(db: Db, m: TgMsg, text: string, isOwner: boolean) {
  const [cmdRaw, ...rest] = text.trim().split(/\s+/);
  const cmd = cmdRaw.split('@')[0].toLowerCase();
  const arg = rest.join(' ').trim();
  const chat = m.chat.id;
  const by = m.from?.id ?? 0;

  if (cmd === '/start' || cmd === '/help') {
    return say(
      chat,
      [
        `معرّفك: ${m.from?.id}`,
        'ابعت لي رابط قناة عامة (مثلًا https://t.me/اسم_القناة) وأنا أسحب منتجاتها وأجهّز لك ملف إكسل.',
        'الزيادة على الأسعار والقسم بيحددهم المالك من الموقع.',
        '',
        '/channel https://t.me/اسم_القناة 30  ← آخر 30 يوم',
        '/continue  ← كمّل السحب لو وقف',
        '/count  ← كم منتج محفوظ',
        '/export  ← ملف بالجديد فقط (تختار إكسل أو JSON أو رفع للموقع)',
        '/exportall  ← نفس الشيء بكل منتجاتك',
        '/upload  ← ارفع الجديد للموقع كمسودة',
        ...(isOwner ? ['/category  ← اختار القسم اللي المسودات تتحفظ فيه'] : []),
        ...(isOwner ? ['', '/addadmin 123456789  ← ضيف أدمن', '/removeadmin 123456789  ← احذف أدمن', '/admins  ← قائمة الأدمن (للمالك فقط)'] : []),
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
  if (cmd === '/category' && isOwner) {
    const { data: cats } = await db.from('categories').select('id,name').order('name').limit(30);
    const rows: { text: string; data: string }[][] = [[{ text: 'بدون قسم', data: 'cat:none' }]];
    for (const c of cats ?? []) rows.push([{ text: String(c.name), data: `cat:${c.id}` }]);
    return keyboard(chat, `اختار القسم اللي المسودات هتتحفظ فيه (الحالي: ${(await getState(db, 'category', '')) || 'بدون قسم'}):`, rows);
  }
  if (cmd === '/add' || cmd === '/markup' || cmd === '/category' || cmd === '/publish') {
    return say(chat, 'الزيادة والقسم والنشر بيحددهم المالك من الموقع (لوحة التحكم ← بوت تليجرام).');
  }
  if (cmd === '/channel') {
    const link = rest[0] ?? '';
    const channel = channelFromLink(link);
    if (!channel) return say(chat, 'ابعت رابط قناة عامة، مثلًا:\n/channel https://t.me/اسم_القناة 30\n(الجروبات والقنوات الخاصة مش بتتسحب بالطريقة دي. استخدم صفحة التصدير في الموقع.)');
    const days = Math.min(Math.max(Number(rest[1]) || 30, 1), 365);
    const job: Job = { channel, cutoff: Date.now() - days * 86400000, chat, collected: 0, by };
    await setState(db, `job:${by}`, JSON.stringify(job));
    await say(chat, `تمام، بسحب منتجات @${channel} لآخر ${days} يوم. هبعتلك رسالة لما أخلّص. (استخدم منتجات عندك إذن منها)`);
    after(() => runJob(db, by));
    return;
  }
  if (cmd === '/continue') {
    if (!(await getState(db, `job:${by}`, ''))) return say(chat, 'مفيش سحب شغّال دلوقتي.');
    await say(chat, 'بكمّل...');
    after(() => runJob(db, by));
    return;
  }
  if (cmd === '/count') {
    const [{ count: fresh }, { count: all }] = await Promise.all([
      db.from('telegram_items').select('id', { count: 'exact', head: true }).eq('added_by', by).is('exported_at', null),
      db.from('telegram_items').select('id', { count: 'exact', head: true }).eq('added_by', by),
    ]);
    return say(chat, `جديد (لم يُصدَّر): ${fresh ?? 0}\nالإجمالي: ${all ?? 0}\nالزيادة: ${await getState(db, 'fixed', '0')} جنيه + ${await getState(db, 'markup', '0')}%`);
  }
  if (cmd === '/export' || cmd === '/exportall') {
    const all = cmd === '/exportall';
    const f = arg.toLowerCase();
    if (f === 'json' || f === 'xlsx' || f === 'excel' || f === 'csv') return exportFiles(db, chat, by, all, f === 'excel' ? 'xlsx' : (f as Fmt));
    return keyboard(chat, `اختار شكل الملف (الملف الواحد 500 منتج بالكتير):`, formatButtons(all));
  }
  if (cmd === '/upload') return uploadToSite(db, chat, by, false);
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
    const update = (await req.json()) as { callback_query?: { id: string; from: { id: number; first_name?: string; username?: string }; data?: string; message?: { chat: { id: number } } }; message?: TgMsg; channel_post?: TgMsg; my_chat_member?: { chat: TgMsg['chat']; from: { id: number }; new_chat_member?: { status?: string } } };
    const db = createAdminClient();
    ownerNow = (process.env.TELEGRAM_OWNER_ID ?? '').trim() || (await getState(db, 'owner', ''));

    if (update.callback_query) {
      const cq = update.callback_query;
      const uid = String(cq.from.id);
      const owner = OWNER() !== '' && uid === OWNER();
      const staff = owner || (await getAdmins(db)).includes(uid);
      const chatId = cq.message?.chat.id ?? cq.from.id;
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
      if (!staff) return NextResponse.json({ ok: true });
      await rememberName(db, cq.from);
      const [kind, a1, a2] = (cq.data ?? '').split(':');
      if (kind === 'exp' && (a2 === 'xlsx' || a2 === 'json' || a2 === 'csv')) await exportFiles(db, chatId, cq.from.id, a1 === 'all', a2);
      else if (kind === 'cat') {
        if (!owner) await say(chatId, 'اختيار القسم للمالك بس.');
        else {
          let name = '';
          if (a1 !== 'none' && /^[0-9a-f-]{36}$/i.test(a1 ?? '')) name = String((await db.from('categories').select('name').eq('id', a1).maybeSingle()).data?.name ?? '');
          await setState(db, 'category', name);
          await say(chatId, name ? `✅ المسودات الجاية هتتحفظ في قسم «${name}».` : '✅ المسودات الجاية من غير قسم.');
        }
      } else if (kind === 'up') await uploadToSite(db, chatId, cq.from.id, a1 === 'all');
      else if (kind === 'pub' && /^[0-9a-f-]{36}$/i.test(a1 ?? '')) {
        if (!owner) await say(chatId, 'النشر للمالك من هنا، أو من الموقع لمن عنده صلاحية «نشر المنتجات من بوت تليجرام».');
        else {
          await db.from('product_files').update({ is_public: true }).eq('id', a1);
          await db.from('product_files').update({ stage: 'public' }).eq('id', a1);
          await db.from('products').update({ is_active: true, published_at: new Date().toISOString() }).eq('file_id', a1).is('deleted_at', null);
          await enqueueFile(db, a1);
          await say(chatId, '✅ اتنشر الملف للعلن.');
        }
      }
      return NextResponse.json({ ok: true });
    }

    // إضافة البوت لجروب/قناة: نقبلها فقط لو من أضافه هو المالك أو أدمن البوت، وإلا يغادر فورًا
    if (update.my_chat_member) {
      const mc = update.my_chat_member;
      if (mc.chat.type !== 'private' && ['member', 'administrator'].includes(mc.new_chat_member?.status ?? '')) {
        const byOwner = OWNER() !== '' && String(mc.from.id) === OWNER();
        const staff = byOwner || (await getAdmins(db)).includes(String(mc.from.id));
        if (staff) await setState(db, 'chats', JSON.stringify([...new Set([...(await getChats(db)), String(mc.chat.id)])]));
        else await tg('leaveChat', { chat_id: mc.chat.id });
      }
      return NextResponse.json({ ok: true });
    }

    const m = update.message ?? update.channel_post;
    if (!m) return NextResponse.json({ ok: true });
    const isOwner = String(m.from?.id ?? '') === OWNER() && OWNER() !== '';
    const isStaff = isOwner || (m.from?.id !== undefined && (await getAdmins(db)).includes(String(m.from.id)));
    const text = m.text ?? '';
    if (isStaff) await rememberName(db, m.from);

    // ربط المالك بالكود الظاهر في لوحة التحكم (مرة واحدة، ولا يعمل لو فيه مالك بالفعل)
    const claim = text.match(/^\/claim(?:@\w+)?\s+(\d{8})\s*$/i);
    if (claim && m.chat.type === 'private' && m.from?.id) {
      if (!ownerNow && claimMatches(claim[1])) {
        await setState(db, 'owner', String(m.from.id));
        await say(m.chat.id, 'تم. إنت دلوقتي مالك البوت. اكتب /start.');
      } else {
        await say(m.chat.id, 'الكود غير صحيح، أو في مالك مربوط بالفعل.');
      }
      return NextResponse.json({ ok: true });
    }

    // داخل جروب: أدمن البوت يكتب /allow لتفعيل الجمع من الجروب (للجروبات اللي أُضيف لها البوت قبل هذا التحديث)
    if (m.chat.type !== 'private' && isStaff && /^\/allow(@\w+)?$/i.test(text.trim())) {
      await setState(db, 'chats', JSON.stringify([...new Set([...(await getChats(db)), String(m.chat.id)])]));
      await say(m.chat.id, 'تم. هجمع الصور والأسعار من هنا.');
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/')) {
      if (text.toLowerCase().startsWith('/start') && !isStaff) await say(m.chat.id, `معرّفك: ${m.from?.id}\nابعته للمالك عشان يضيفك أدمن.${OWNER() ? '' : '\n(لو إنت المالك: افتح لوحة التحكم ← بوت تليجرام وخد كود الربط، واكتب هنا /claim ثم الكود.)'}`);
      else if (isStaff && m.chat.type === 'private') await command(db, m, text, isOwner);
      return NextResponse.json({ ok: true });
    }
    if (isStaff && m.chat.type === 'private' && !m.photo && channelFromLink(text) && /t\.me|telegram\.me|^@/i.test(text)) {
      await command(db, m, `/channel ${text.trim()}`, isOwner);
      return NextResponse.json({ ok: true });
    }
    // المحادثة الخاصة: للمالك فقط. الجروبات والقنوات التي أُضيف لها البوت: نجمع منها
    if (m.chat.type === 'private' && !isStaff) return NextResponse.json({ ok: true });
    // جروب/قناة: نجمع فقط من المسموح بها
    if (m.chat.type !== 'private' && !(await getChats(db)).includes(String(m.chat.id))) return NextResponse.json({ ok: true });
    await collect(db, m, m.chat.type === 'private' ? (m.from?.id ?? 0) : Number(OWNER() || 0));
  } catch (e) {
    console.error('[telegram] error', e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
