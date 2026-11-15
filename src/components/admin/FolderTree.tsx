import FolderCard from '@/components/admin/FolderCard';
import type { Folder } from '@/lib/folders';

type Cat = { id: string; name: string };
const TZ = 'Africa/Cairo';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }); // yyyy-mm-dd
const monthLabel = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** فولدرات اليوم مجمّعة حسب الأدمن اللي رفعها (الأحدث نشرًا أولًا جوه كل أدمن) */
function byAdmin(list: Folder[]): [string, Folder[]][] {
  const m = new Map<string, Folder[]>();
  for (const f of list) m.set(f.publisher, [...(m.get(f.publisher) ?? []), f]);
  return [...m.entries()];
}

type Props = { folders: Folder[]; back: string; cats: Cat[]; canEdit: boolean; canPublish: boolean; canDraft: boolean; canTrash: boolean; noticeFolder?: string; notice?: string };

/** الفولدرات مرتبة: شهر ← يوم ← فولدرات اليوم (بتاريخ النشر). أحدث شهر ويوم مفتوحين */
export default function FolderTree({ folders, noticeFolder, notice, ...card }: Props) {
  const sorted = [...folders].sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  const months = new Map<string, Map<string, Folder[]>>();
  for (const f of sorted) {
    const d = dayKey(f.published_at);
    const m = d.slice(0, 7);
    const days = months.get(m) ?? new Map<string, Folder[]>();
    days.set(d, [...(days.get(d) ?? []), f]);
    months.set(m, days);
  }
  const target = noticeFolder ? sorted.find((f) => f.id === noticeFolder) : undefined;
  const targetDay = target ? dayKey(target.published_at) : undefined;
  const count = (days: Map<string, Folder[]>) => [...days.values()].reduce((n, l) => n + l.length, 0);
  const prods = (l: Folder[]) => l.reduce((n, f) => n + f.count, 0);

  return (
    <div className="space-y-2">
      {[...months.entries()].map(([m, days]) => {
        const monthOpen = Boolean(targetDay && targetDay.startsWith(m));
        return (
          <details key={m} open={monthOpen} className="rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-extrabold">
              🗓 {monthLabel(m)} <span className="font-normal text-gray-500">· {count(days)} فولدر · {prods([...days.values()].flat())} منتج</span>
            </summary>
            <div className="space-y-2 border-t border-gray-100 p-2">
              {[...days.entries()].map(([d, list]) => (
                <details key={d} open={d === targetDay} className="rounded-lg border border-gray-100 bg-gray-50">
                  <summary className="cursor-pointer select-none px-3 py-1.5 text-sm font-bold">
                    📅 {dayLabel(d)} <span className="font-normal text-gray-500">· {list.length} فولدر · {prods(list)} منتج</span>
                  </summary>
                  <div className="space-y-2 p-2">
                    {byAdmin(list).map(([admin, items]) => (
                      <details key={admin} open={items.some((f) => f.id === noticeFolder)} className="rounded-lg border border-brand-200 bg-white">
                        <summary className="cursor-pointer select-none px-3 py-1.5 text-sm font-bold text-brand-800">
                          👤 {admin} <span className="font-normal text-gray-500">· نشر {items.length} فولدر · {prods(items)} منتج</span>
                        </summary>
                        <div className="grid gap-2 p-2 md:grid-cols-2 xl:grid-cols-3">
                          {items.map((f) => <FolderCard key={f.id} f={f} notice={noticeFolder === f.id ? notice : undefined} {...card} />)}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
