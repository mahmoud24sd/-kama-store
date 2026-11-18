'use client';

import { useState } from 'react';
import { ui } from '@/lib/ui';

export type PublisherCard = { key: string; name: string; phone: string; total: number; cats: { category: string; products: number }[] };

const norm = (s: string) => s.toLowerCase().replace(/[\s\-+()]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/** من نشر كم منتج، مع خانة بحث بالاسم أو برقم الهاتف */
export default function PublisherList({ admins }: { admins: PublisherCard[] }) {
  const [q, setQ] = useState('');
  const nq = norm(q);
  const shown = nq ? admins.filter((a) => norm(a.name).includes(nq) || norm(a.phone).includes(nq)) : admins;

  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ابحث باسم الأدمن أو رقم تليفونه" className={`${ui.input} mb-3 max-w-md`} aria-label="بحث عن أدمن" />
      {shown.length === 0 ? (
        <p className="text-sm text-gray-500">مفيش أدمن بالاسم أو الرقم ده.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((a) => (
            <div key={a.key} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{a.name}</p>
                  {a.phone && <p className="text-xs text-gray-500" dir="ltr">{a.phone}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700">{a.total} منتج</span>
              </div>
              <ul className="space-y-1 text-sm text-gray-700">
                {a.cats.map((c) => (
                  <li key={c.category} className="flex justify-between border-t border-gray-100 pt-1">
                    <span>{c.category}</span><span className="font-semibold">{c.products}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
