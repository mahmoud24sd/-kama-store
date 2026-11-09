'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** قائمة الحساب: تُغلق عند اختيار رابط، أو تغيير الصفحة، أو النقر خارجها، أو الضغط على Esc */
export default function AccountMenu({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (el?.open && e.target instanceof Node && !el.contains(e.target)) el.open = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current) ref.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/10">{summary}</summary>
      <div
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a') && ref.current) ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}
