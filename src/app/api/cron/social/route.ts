import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runSocialBatch, socialAutoOn } from '@/lib/social';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** يستدعيه cron-job.org كل 30 دقيقة: Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  if (secret.length < 16 || a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse('Forbidden', { status: 403 });
  if (!hasServiceRole) return NextResponse.json({ ok: false });
  const db = createAdminClient();
  if (!(await socialAutoOn(db))) return NextResponse.json({ ok: true, auto: false });
  return NextResponse.json({ ok: true, ...(await runSocialBatch(db, 2)) });
}
