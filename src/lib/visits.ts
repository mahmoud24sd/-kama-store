import { unstable_rethrow } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CountryVisits = { country: string; visits: number };

/** زيارات كل دولة (نفس صلاحية عدد الزيارات). null عند أي مشكلة أو لو ملف 026 ماتشغلش */
export async function getAdminVisitCountries(supabase: SupabaseClient): Promise<CountryVisits[] | null> {
  try {
    const { data, error } = await supabase.rpc('admin_visit_countries');
    if (error || !Array.isArray(data)) return null;
    return data.map((r: { country: string; visits: number | string }) => ({ country: String(r.country), visits: Number(r.visits) }));
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
}

/** عدد الزيارات للأدمن المصرّح لهم فقط (الدالة في قاعدة البيانات تتحقق من الصلاحية). ترجع null عند أي مشكلة ولا تُسبب خطأ */
export async function getAdminVisitCount(supabase: SupabaseClient): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('admin_visits');
    if (error || data === null || data === undefined) return null;
    return Number(data);
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
}
