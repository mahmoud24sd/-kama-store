/**
 * رابط الموقع الأساسي. لا ينهار البناء أبدًا إذا كانت قيمة NEXT_PUBLIC_SITE_URL
 * ناقصة أو فيها مسافات/علامات تنصيص/حروف غير ASCII/بدون https.
 */
const FALLBACK = 'http://localhost:3000';

function tryOrigin(value: string): string | null {
  if (!/^https?:\/\/[\x21-\x7E]+$/.test(value)) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/^["']|["']$/g, '');
  const fromEnv = tryOrigin(raw) ?? tryOrigin(raw ? `https://${raw}` : '');
  if (fromEnv) return fromEnv;

  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '').trim();
  const fromVercel = vercel ? tryOrigin(`https://${vercel}`) : null;
  return fromVercel ?? FALLBACK;
}
