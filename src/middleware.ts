import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';

// مسارات تتطلب تسجيل دخول (صفحة الأدمن تتحقق من الصلاحية أيضًا على السيرفر + RLS)
const PROTECTED = ['/account', '/checkout', '/admin', '/sell'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** لينك إحالة (?ref=...): نحفظه في كوكي 30 يوم ونسجّل الزيارة مرة لكل متصفح */
export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const res = await core(request);
  const ref = request.nextUrl.searchParams.get('ref');
  if (ref && UUID.test(ref) && isSupabaseConfigured && request.cookies.get('kama_ref')?.value !== ref) {
    res.cookies.set('kama_ref', ref, { maxAge: 60 * 60 * 24 * 30, path: '/', httpOnly: true, sameSite: 'lax' });
    event.waitUntil(
      fetch(`${supabaseUrl}/rest/v1/rpc/ref_hit`, {
        method: 'POST',
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_admin: ref }),
      }).catch(() => null),
    );
  }
  return res;
}

async function core(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // مسار سريع للزائر غير المسجّل: لا يوجد كوكي جلسة → لا طلبات شبكة إلى Supabase إطلاقًا
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (!hasSession) {
    if (!needsAuth) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // يجدد الجلسة. لا تضف كودًا بين createServerClient و getClaims/getUser.
  // getClaims يتحقق من التوكن محليًا (بدون رحلة شبكة) عند استخدام مفاتيح التوقيع الحديثة، وإلا نرجع لـ getUser
  const auth = supabase.auth as unknown as { getClaims?: () => Promise<{ data: { claims?: unknown } | null }> };
  let user: boolean;
  if (typeof auth.getClaims === 'function') {
    const { data } = await auth.getClaims();
    user = Boolean(data?.claims);
  } else {
    const { data } = await supabase.auth.getUser();
    user = Boolean(data.user);
  }

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
