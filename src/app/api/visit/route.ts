import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** يسجّل زيارة واحدة لكل متصفح كل 30 دقيقة (كوكي)، ويرجع العدد الحالي */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const seen = /(?:^|;\s*)kv=1(?:;|$)/.test(request.headers.get('cookie') ?? '');
    const { data, error } = await supabase.rpc(seen ? 'get_visits' : 'track_visit');
    if (error || data === null || data === undefined) return NextResponse.json({ count: null });
    const res = NextResponse.json({ count: Number(data) });
    if (!seen) res.cookies.set('kv', '1', { maxAge: 30 * 60, path: '/', sameSite: 'lax', httpOnly: true });
    return res;
  } catch {
    return NextResponse.json({ count: null });
  }
}
