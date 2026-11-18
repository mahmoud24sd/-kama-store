'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** صندوق منتجات الفولدر: اسحب الركن السفلي عشان تكبّره، أو دوس «ملء الشاشة» عشان يفتح على الصفحة كلها */
export default function ExpandBox({ title, children }: { title: string; children: ReactNode }) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [full]);

  const btn = (
    <button type="button" onClick={() => setFull((v) => !v)} className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
      {full ? '✕ إغلاق' : '⤢ ملء الشاشة'}
    </button>
  );

  if (full && typeof document !== 'undefined') {
    return (
      <>
        <div className="flex justify-end px-1 py-0.5">{btn}</div>
        {createPortal(
          <div dir="rtl" className="fixed inset-0 z-[1000] flex h-dvh w-screen flex-col bg-white">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
              <b className="truncate text-sm">{title}</b>
              {btn}
            </div>
            <div className="grid flex-1 grid-cols-3 content-start gap-2 overflow-y-auto p-2 sm:grid-cols-5 lg:grid-cols-8">{children}</div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-end px-1 py-0.5">{btn}</div>
      <div className="grid h-72 min-h-[10rem] max-h-[90vh] max-w-full resize grid-cols-3 content-start gap-1.5 overflow-auto p-1.5 sm:grid-cols-4 lg:grid-cols-5">{children}</div>
    </div>
  );
}
