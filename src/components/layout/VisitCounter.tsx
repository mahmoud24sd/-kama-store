'use client';

import { useEffect, useState } from 'react';

/** يعرض عدد الزيارات، ويسجّل زيارة هذا المتصفح (مرة كل 30 دقيقة) عند أول تحميل */
export default function VisitCounter({ initial }: { initial: number | null }) {
  const [count, setCount] = useState<number | null>(initial);
  useEffect(() => {
    fetch('/api/visit', { method: 'POST' })
      .then((r) => r.json())
      .then((d: { count: number | null }) => {
        if (typeof d.count === 'number') setCount(d.count);
      })
      .catch(() => {});
  }, []);
  if (count === null) return null;
  return <span>عدد الزيارات: <b className="text-white" dir="ltr">{count.toLocaleString('en-US')}</b></span>;
}
