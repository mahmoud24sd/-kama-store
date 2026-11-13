import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Digital Asset Links: بيربط الموقع بتطبيق أندرويد (Play Store).
 * بيتضبط من متغيرات Vercel:
 *   ANDROID_PACKAGE_NAME  مثال: app.vercel.kama_store.twa
 *   ANDROID_SHA256        بصمة SHA-256 (ممكن أكتر من واحدة مفصولة بفاصلة)
 */
export function GET() {
  const pkg = (process.env.ANDROID_PACKAGE_NAME ?? '').trim();
  const prints = (process.env.ANDROID_SHA256 ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const body = pkg && prints.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints } }]
    : [];
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
