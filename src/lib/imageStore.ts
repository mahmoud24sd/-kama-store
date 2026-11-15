import { createHash, createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * تخزين صور المنتجات. لو متغيرات B2_* موجودة في Vercel: الصور الجديدة بتتخزن في Backblaze B2 (10 جيجا مجانًا).
 * غير كده: بتتخزن في Supabase Storage زي الأول. الصور القديمة بتفضل زي ما هي في مكانها.
 */
const env = () => ({
  keyId: (process.env.B2_KEY_ID ?? '').trim(),
  appKey: (process.env.B2_APP_KEY ?? '').trim(),
  bucket: (process.env.B2_BUCKET ?? '').trim(),
  endpoint: (process.env.B2_ENDPOINT ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''),
  publicUrl: (process.env.B2_PUBLIC_URL ?? '').trim().replace(/\/+$/, ''),
});

export const b2Enabled = () => {
  const e = env();
  return Boolean(e.keyId && e.appKey && e.bucket && e.endpoint && e.publicUrl);
};

const sha256 = (d: string | Uint8Array) => createHash('sha256').update(d).digest('hex');
const hmac = (k: string | Buffer, d: string) => createHmac('sha256', k).update(d).digest();

/** طلب S3 موقّع (AWS Signature V4) على Backblaze B2 */
async function b2Request(method: 'PUT' | 'DELETE', key: string, body?: Uint8Array, contentType?: string): Promise<boolean> {
  const e = env();
  const region = e.endpoint.match(/^s3\.([^.]+)\./)?.[1] ?? 'us-west-004';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const encKey = key.split('/').map(encodeURIComponent).join('/');
  const uri = `/${e.bucket}/${encKey}`;
  const payloadHash = sha256(body ?? '');
  const headers: Record<string, string> = { host: e.endpoint, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['content-type'] = contentType;
  const names = Object.keys(headers).sort();
  const canonical = [method, uri, '', ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), payloadHash].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${e.appKey}`, date), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${e.keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  const res = await fetch(`https://${e.endpoint}${uri}`, {
    method,
    headers: { ...headers, Authorization: auth },
    body: body ? (body as unknown as BodyInit) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  return res.ok || (method === 'DELETE' && res.status === 404);
}

type Sb = Pick<SupabaseClient, 'storage'>;

/** يرفع صورة ويرجّع رابطها العام، أو null لو فشل */
export async function uploadImage(sb: Sb, supabaseBucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<string | null> {
  try {
    if (b2Enabled()) {
      const ok = await b2Request('PUT', path, bytes, contentType);
      if (ok) return `${env().publicUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
      // لو B2 فشل مؤقتًا نكمّل على Supabase بدل ما الصورة تضيع
    }
    const { error } = await sb.storage.from(supabaseBucket).upload(path, bytes, { contentType, upsert: false });
    if (error) return null;
    return sb.storage.from(supabaseBucket).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/** يمسح الصور حسب رابطها (من B2 أو Supabase). الأخطاء بتتجاهل: المسح مش بيوقف الحذف */
export async function removeImages(sb: Sb, supabaseBucket: string, urls: string[]) {
  const pub = env().publicUrl;
  const sbPaths: string[] = [];
  for (const u of urls) {
    try {
      if (pub && u.startsWith(`${pub}/`)) {
        await b2Request('DELETE', decodeURIComponent(u.slice(pub.length + 1)));
      } else if (u.includes(`/${supabaseBucket}/`)) {
        sbPaths.push(u.slice(u.indexOf(`/${supabaseBucket}/`) + supabaseBucket.length + 2));
      }
    } catch {
      /* نكمّل */
    }
  }
  if (sbPaths.length) await sb.storage.from(supabaseBucket).remove(sbPaths).catch(() => null);
}
