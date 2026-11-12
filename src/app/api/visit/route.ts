import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** يسجّل زيارة واحدة لكل متصفح كل 30 دقيقة (كوكي). لا يرجع العدد: العدد للأدمن المصرّح لهم فقط */
export async function POST(request: Request) {
  try {
    const seen = /(?:^|;\s*)kv=1(?:;|$)/.test(request.headers.get('cookie') ?? '');
    const res = NextResponse.json({ ok: true });
    if (seen) return res;
    const supabase = await createClient();
    await supabase.rpc('track_visit');
    res.cookies.set('kv', '1', { maxAge: 30 * 60, path: '/', sameSite: 'lax', httpOnly: true });
    return res;
  } catch {
    return NextResponse.json({ ok: false });
  }
}
