/** قراءة المعاينة العامة لقناة تليجرام عامة (t.me/s/اسم_القناة). لا تحتاج تسجيل دخول، وتعمل للقنوات العامة فقط */

export type TmePost = { id: number; time: number; text: string; photos: string[]; url: string; views: number };

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
/** «12.3K» / «1.2M» / «845» → رقم */
const parseViews = (t: string | undefined) => {
  const m = (t ?? '').trim().match(/^([\d.,]+)\s*([KkMm]?)$/);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Math.round(n * (m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1)) || 0;
};
const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, (m) => ENT[m] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const htmlToText = (h: string) =>
  decode(h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/\n{3,}/g, '\n\n').trim();

/** يستخرج اسم القناة من رابط أو @اسم. يرجع null لو غير صالح أو رابط دعوة خاص */
export function channelFromLink(input: string): string | null {
  const t = input.trim();
  const m = t.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z][A-Za-z0-9_]{3,31})(?:[/?#]|$)/i) ?? t.match(/^@([A-Za-z][A-Za-z0-9_]{3,31})$/);
  if (!m) return null;
  const name = m[1];
  return /^(joinchat|addstickers|share|c|proxy)$/i.test(name) ? null : name;
}

export function parsePage(html: string): TmePost[] {
  const parts = html.split('tgme_widget_message_wrap').slice(1);
  const out: TmePost[] = [];
  for (const part of parts) {
    const post = part.match(/data-post="([^"]+)"/);
    if (!post) continue;
    const id = Number(post[1].split('/').pop());
    const dt = part.match(/<time[^>]*datetime="([^"]+)"/);
    const time = dt ? new Date(dt[1]).getTime() : NaN;
    if (!Number.isFinite(id) || !Number.isFinite(time)) continue;
    const textM = part.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    const photos = [...part.matchAll(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g)].map((m) => decode(m[1]));
    out.push({ id, time, text: textM ? htmlToText(textM[1]) : '', photos: [...new Set(photos)], url: `https://t.me/${post[1]}`, views: parseViews(part.match(/tgme_widget_message_views[^>]*>([^<]+)</)?.[1]) });
  }
  return out;
}

export async function fetchChannelPage(channel: string, before?: number): Promise<{ posts: TmePost[]; ok: boolean }> {
  const url = `https://t.me/s/${channel}${before ? `?before=${before}` : ''}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KamaStore/1.0)', 'Accept-Language': 'ar,en' }, signal: AbortSignal.timeout(15000), redirect: 'follow', cache: 'no-store' });
  if (!res.ok) return { posts: [], ok: false };
  const html = await res.text();
  return { posts: parsePage(html), ok: true };
}

/** يضم صور الألبوم (صور بلا نص خلال 5 ثواني) إلى المنشور ذي النص المجاور، ويرجع منشورات مرتبة زمنيًا */
export function groupPosts(posts: TmePost[]): TmePost[] {
  const sorted = [...posts].sort((a, b) => a.time - b.time || a.id - b.id);
  const out: TmePost[] = [];
  let pending: TmePost[] = [];
  for (const p of sorted) {
    if (!p.text && p.photos.length > 0) {
      const last = out[out.length - 1];
      if (last && p.time - last.time <= 5000) last.photos.push(...p.photos);
      else pending.push(p);
      continue;
    }
    if (!p.text) continue;
    const near = pending.filter((x) => p.time - x.time <= 5000);
    const cur: TmePost = { ...p, photos: [...near.flatMap((x) => x.photos), ...p.photos] };
    pending = [];
    out.push(cur);
  }
  return out;
}
