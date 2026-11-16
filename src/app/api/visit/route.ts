import { after, NextResponse } from 'next/server';
import { runSocialIfDue } from '@/lib/social';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** يسجّل زيارة واحدة لكل متصفح كل 30 دقيقة (كوكي). لا يرجع العدد: العدد للأدمن المصرّح لهم فقط */
export async function POST(request: Request) {
  try {
    if (hasServiceRole) after(() => runSocialIfDue(createAdminClient()));
    const seen = /(?:^|;\s*)kv=1(?:;|$)/.test(request.headers.get('cookie') ?? '');
    const res = NextResponse.json({ ok: true });
    if (seen) return res;
    const supabase = await createClient();
    await supabase.rpc('track_visit');
    // الدولة من هيدر Vercel المجاني (من غير أي خدمة خارجية). فشلها مايأثرش على العدّ
    await supabase.rpc('track_visit_country', { c: request.headers.get('x-vercel-ip-country') ?? '' }).then(() => null, () => null);
    res.cookies.set('kv', '1', { maxAge: 30 * 60, path: '/', sameSite: 'lax', httpOnly: true });
    return res;
  } catch {
    return NextResponse.json({ ok: false });
  }
}
