'use client';

import { useState, type ReactNode } from 'react';

/** صندوق منتجات الفولدر: اسحب الحافة السفلية عشان تطوّله، أو دوس «ملء الشاشة» عشان يفتح على الصفحة كلها */
export default function ExpandBox({ title, children }: { title: string; children: ReactNode }) {
  const [full, setFull] = useState(false);
  return (
    <div className={full ? 'fixed inset-0 z-50 flex flex-col bg-white' : 'relative'}>
      <div className="flex items-center justify-between gap-2 px-1 py-0.5">
        {full ? <b className="truncate text-sm">{title}</b> : <span />}
        <button type="button" onClick={() => setFull((v) => !v)} className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
          {full ? '✕ إغلاق' : '⤢ ملء الشاشة'}
        </button>
      </div>
      <div className={full ? 'grid flex-1 grid-cols-3 content-start gap-2 overflow-y-auto p-2 sm:grid-cols-5 lg:grid-cols-8' : 'grid min-h-[10rem] h-72 max-h-[90vh] max-w-full resize grid-cols-3 content-start gap-1.5 overflow-auto p-1.5 sm:grid-cols-4 lg:grid-cols-5'}>
        {children}
      </div>
    </div>
  );
}
