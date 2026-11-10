import type { createAdminClient } from '@/lib/supabase/admin';
import { normalizeInternationalPhone } from '@/lib/governorates';

export type FoundProfile = { id: string; email: string | null; phone: string | null; full_name: string | null; role: string };

type Db = ReturnType<typeof createAdminClient>;
const COLS = 'id,email,phone,full_name,role';

/** حسابات مطابقة لبريد أو لرقم هاتف (الرقم بالصيغة الدولية، مع الصيغة المحلية القديمة لأرقام مصر) */
export async function findProfiles(db: Db, input: { email?: string; dial?: string; phone?: string }): Promise<FoundProfile[]> {
  if (input.email) {
    const { data } = await db.from('profiles').select(COLS).eq('email', input.email.trim().toLowerCase()).limit(3);
    return (data ?? []) as FoundProfile[];
  }
  const e164 = normalizeInternationalPhone(input.dial ?? '20', input.phone ?? '');
  if (!e164) return [];
  const digits = e164.replace(/\D/g, '');
  const variants = [e164, ...(digits.startsWith('20') ? [`0${digits.slice(2)}`] : [])];
  const { data } = await db.from('profiles').select(COLS).in('phone', variants).limit(5);
  return (data ?? []) as FoundProfile[];
}
