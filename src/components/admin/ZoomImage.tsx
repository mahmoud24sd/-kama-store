'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** صورة مصغّرة؛ دوس عليها تتكبّر على الشاشة كلها، ودوس تاني أو Esc تقفلها */
export default function ZoomImage({ src, alt = '', thumbClass = 'max-h-28' }: { src: string; alt?: string; thumbClass?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" title="دوس للتكبير" onClick={() => setOpen(true)} className={`${thumbClass} cursor-zoom-in rounded border border-gray-100 object-contain`} />
      {open && createPortal(
        <div dir="rtl" onClick={() => setOpen(false)} className="fixed inset-0 z-[1000] flex cursor-zoom-out items-center justify-center bg-black/80 p-3">
          <button type="button" className="absolute left-3 top-3 rounded bg-white px-3 py-1 text-sm font-bold" onClick={() => setOpen(false)}>✕ إغلاق</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-full max-w-full rounded bg-white object-contain" />
        </div>,
        document.body,
      )}
    </>
  );
}
