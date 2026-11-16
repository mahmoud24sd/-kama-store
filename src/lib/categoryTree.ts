import type { Category } from '@/lib/types';

export type CategoryNode = { c: Category; children: Category[] };

/** أقسام رئيسية وتحت كل واحد أنواعه (الفروع) بالترتيب */
export function categoryTree(cats: Category[]): CategoryNode[] {
  const ids = new Set(cats.map((c) => c.id));
  const kids = new Map<string, Category[]>();
  for (const c of cats) if (c.parent_id && ids.has(c.parent_id)) kids.set(c.parent_id, [...(kids.get(c.parent_id) ?? []), c]);
  return cats.filter((c) => !c.parent_id || !ids.has(c.parent_id)).map((c) => ({ c, children: kids.get(c.id) ?? [] }));
}

/** قائمة مسطّحة للاختيار: «الأزياء» ثم «الأزياء › رجالي» */
export function categoryOptions(cats: Category[]): { id: string; label: string }[] {
  return categoryTree(cats).flatMap(({ c, children }) => [{ id: c.id, label: c.name }, ...children.map((k) => ({ id: k.id, label: `${c.name} › ${k.name}` }))]);
}
