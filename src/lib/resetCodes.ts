import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const CODE_VALID_DAYS = 3;
export const MAX_ATTEMPTS = 5;

/** رمز من 8 أرقام */
export const generateCode = () => String(randomInt(0, 100_000_000)).padStart(8, '0');

/** HMAC بمفتاح السيرفر السري: لا يمكن تخمين الرمز من الهاش حتى لو قُرئ الجدول */
export const hashCode = (requestId: string, code: string) =>
  createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').update(`${requestId}:${code}`).digest('hex');

export function codesMatch(storedHash: string, requestId: string, code: string): boolean {
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(hashCode(requestId, code), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const expiryFromNow = () => new Date(Date.now() + CODE_VALID_DAYS * 24 * 60 * 60 * 1000);
