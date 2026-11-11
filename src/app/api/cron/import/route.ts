import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { runSource, type Source } from '@/lib/importer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (secret.length < 16) return false;
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** يُستدعى كل ساعة من خدمة جدولة مجانية. محمي بـ CRON_SECRET */
export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse('Forbidden', { status: 403 });
  if (!hasServiceRole) return NextResponse.json({ error: 'service role missing' }, { status: 500 });
  const db = createAdminClient();
  const { data, error } = await db.from('product_sources').select('*').eq('is_active', true);
  if (error) return NextResponse.json({ error: 'sources table not ready' }, { status: 500 });

  const results: Record<string, string> = {};
  for (const s of (data ?? []) as (Source & { imported_total: number })[]) {
    const r = await runSource(db, s);
    await db
      .from('product_sources')
      .update({ last_run_at: new Date().toISOString(), last_status: r.status, imported_total: s.imported_total + r.added })
      .eq('id', s.id);
    results[s.name] = r.status;
  }
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, results });
}
