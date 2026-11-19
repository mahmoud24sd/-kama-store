import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';

/** نقرة على إعلان: نعدّ النقرة ونحوّل لرابط المعلن */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let to: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    try {
      const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await sb.rpc('ad_click', { p_id: id });
      to = typeof data === 'string' ? data : null;
    } catch { /* ignore */ }
  }
  if (!to || !/^https?:\/\//i.test(to)) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.redirect(to, 302);
}
