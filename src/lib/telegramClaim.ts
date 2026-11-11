import { createHmac, timingSafeEqual } from 'node:crypto';

/** كود ربط المالك: يُشتق من سر الـ webhook، ويراه مالك الموقع فقط في لوحة التحكم */
export function claimCode(): string {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  if (secret.length < 16) return '';
  const hex = createHmac('sha256', secret).update('owner-claim').digest('hex');
  return String(parseInt(hex.slice(0, 10), 16) % 100000000).padStart(8, '0');
}

export function claimMatches(input: string): boolean {
  const code = claimCode();
  const a = Buffer.from(input.trim());
  const b = Buffer.from(code);
  return code !== '' && a.length === b.length && timingSafeEqual(a, b);
}
