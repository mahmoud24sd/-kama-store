import { unstable_rethrow } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

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
