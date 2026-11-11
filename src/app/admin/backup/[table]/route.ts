import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// الجداول المسموح بتصديرها (للمالك فقط). بدون بيانات حساسة مثل كلمات المرور.
const TABLES: Record<string, { select: string; order: string }> = {
  orders: { select: 'order_number,status,payment_method,payment_status,subtotal,discount,shipping,total,ship_name,ship_phone,ship_city,ship_governorate,created_at', order: 'created_at' },
  products: { select: 'id,name,price,compare_at_price,stock,brand,shop_name,is_active,created_at', order: 'created_at' },
  customers: { select: 'full_name,email,phone,governorate,role,created_at', order: 'created_at' },
  withdrawals: { select: 'amount,note,created_by_name,created_at', order: 'created_at' },
};

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // منع حقن الصيغ عند فتح الملف في إكسل
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(_req: Request, { params }: { params: Promise<{ table: string }> }) {
  const profile = await getProfile();
  if (!profile || profile.role !== 'owner') return new NextResponse('Forbidden', { status: 403 });
  const { table } = await params;
  const def = TABLES[table];
  if (!def) return new NextResponse('Not found', { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.from(table === 'customers' ? 'profiles' : table).select(def.select).order(def.order, { ascending: false }).limit(20000);
  if (error) return new NextResponse('تعذّر التصدير', { status: 500 });

  const cols = def.select.split(',');
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const csv = '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kama-${table}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
