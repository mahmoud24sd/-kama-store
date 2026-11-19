import type { Profile } from '@/lib/types';

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** لو الأدمن مش مالك: يرجع id بتاعه عشان أسماء الأدمن التانيين تتخفى. المالك يشوف الكل (null) */
export function viewerOf(p: Pick<Profile, 'id' | 'role'> | null | undefined): string | null {
  return p && p.role !== 'owner' ? p.id : null;
}

/** أقسام النشر المحددة للأدمن (مخزّنة في permissions بالشكل cat:<id>). null = بدون قيود */
export function restrictedMains(p: Pick<Profile, 'role' | 'permissions'> | null | undefined): string[] | null {
  if (!p || p.role === 'owner') return null;
  const ids = (p.permissions ?? []).filter((x) => x.startsWith('cat:')).map((x) => x.slice(4));
  return ids.length ? ids : null;
}

/** كل الأقسام المسموح النشر فيها (القسم المحدد + أجزاؤه الفرعية). null = كل الأقسام */
export async function allowedCategoryIds(supabase: Sb, p: Pick<Profile, 'role' | 'permissions'>): Promise<string[] | null> {
  const mains = restrictedMains(p);
  if (!mains) return null;
  const { data } = await supabase.from('categories').select('id,parent_id');
  const all = new Set<string>(mains);
  for (const c of (data ?? []) as { id: string; parent_id: string | null }[]) if (c.parent_id && mains.includes(c.parent_id)) all.add(c.id);
  return [...all];
}
