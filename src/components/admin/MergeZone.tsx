'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { mergeFiles } from '@/app/actions/productFiles';

/** مربع فولدر قابل للسحب: امسك المقبض ✥ واسحبه على فولدر تاني عشان يتدمج جواه */
export default function MergeZone({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();

  return (
    <div
      ref={ref}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/kama-folder')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const src = e.dataTransfer.getData('text/kama-folder');
        const srcName = e.dataTransfer.getData('text/kama-name');
        if (!src || src === id) return;
        e.preventDefault();
        if (!window.confirm(`تنقل كل منتجات «${srcName}» جوه «${name}»؟ الفولدر الأول هيتمسح بعد النقل.`)) return;
        start(async () => {
          const r = await mergeFiles(src, id);
          setMsg(r.msg);
          if (r.ok) router.refresh();
        });
      }}
      className={`relative rounded-xl transition ${over ? 'bg-brand-50 outline outline-2 outline-offset-2 outline-brand-500' : ''} ${busy ? 'opacity-50' : ''}`}
    >
      <div
        draggable
        title="امسك واسحب الفولدر على فولدر تاني"
        onDragStart={(e) => {
          e.dataTransfer.setData('text/kama-folder', id);
          e.dataTransfer.setData('text/kama-name', name);
          e.dataTransfer.effectAllowed = 'move';
          if (ref.current) e.dataTransfer.setDragImage(ref.current, 20, 20);
        }}
        className="mb-1 flex cursor-grab items-center gap-1 rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 active:cursor-grabbing"
      >
        ✥ اسحبني وحطني جوه فولدر
      </div>
      {msg && <p className="mb-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">{msg}</p>}
      {children}
    </div>
  );
}
