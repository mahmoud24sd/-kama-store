import type { ReactNode } from 'react';
import type { AdCode } from '@/lib/adCodes';

type Item = AdCode & { adminName: string };

const TZ = 'Africa/Cairo';
const monthKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(new Date(iso));
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const monthLabel = (iso: string) => new Intl.DateTimeFormat('ar-EG', { timeZone: TZ, month: 'long', year: 'numeric' }).format(new Date(iso));
const dayLabel = (iso: string) => new Intl.DateTimeFormat('ar-EG', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));

/** أكواد الإعلانات في فولدرات: شهر ← يوم ← اسم الأدمن. كلها مقفولة وإنت اللي بتفتح */
export default function AdCodeTree({ items, card }: { items: Item[]; card: (c: Item) => ReactNode }) {
  const months = new Map<string, { label: string; days: Map<string, { label: string; admins: Map<string, Item[]> }> }>();
  for (const c of items) {
    const iso = c.created_at ?? new Date(0).toISOString();
    const mk = monthKey(iso); const dk = dayKey(iso);
    const m = months.get(mk) ?? { label: monthLabel(iso), days: new Map() };
    const d = m.days.get(dk) ?? { label: dayLabel(iso), admins: new Map() };
    d.admins.set(c.adminName, [...(d.admins.get(c.adminName) ?? []), c]);
    m.days.set(dk, d); months.set(mk, m);
  }
  const sortDesc = <T,>(e: [string, T][]) => e.sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-2">
      {sortDesc([...months]).map(([mk, m]) => {
        const count = [...m.days.values()].reduce((n, d) => n + [...d.admins.values()].reduce((x, a) => x + a.length, 0), 0);
        return (
          <details key={mk} className="rounded-xl border border-gray-200 bg-white">
            <summary className="cursor-pointer p-3 font-bold">📅 {m.label} <span className="text-xs font-normal text-gray-500">· {count} إعلان</span></summary>
            <div className="space-y-2 p-2 pt-0">
              {sortDesc([...m.days]).map(([dk, d]) => (
                <details key={dk} className="rounded-lg border border-gray-100 bg-gray-50">
                  <summary className="cursor-pointer p-2 text-sm font-semibold">{d.label}</summary>
                  <div className="space-y-2 p-2 pt-0">
                    {[...d.admins].map(([name, list]) => (
                      <details key={name} className="rounded-lg border border-gray-100 bg-white">
                        <summary className="cursor-pointer p-2 text-sm">👤 {name} <span className="text-xs text-gray-500">· {list.length}</span></summary>
                        <div className="grid gap-2 p-2 pt-0 sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => card(c))}</div>
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
