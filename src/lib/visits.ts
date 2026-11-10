import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** عدد الزيارات الحالي. يرجع null لو الإعداد غير جاهز (لا يُسبب خطأ أبدًا) */
export const getVisitCount = cache(async (): Promise<number | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_visits');
    if (error || data === null || data === undefined) return null;
    return Number(data);
  } catch (e) {
    unstable_rethrow(e);
    return null;
  }
});
