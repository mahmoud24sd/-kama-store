'use client';

import type { ReactNode } from 'react';

/** نموذج فلاتر بيتطبّق لوحده بمجرد ما تغيّر أي اختيار (من غير زرار تطبيق) */
export default function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form action="/products" method="get" className={className} onChange={(e) => e.currentTarget.requestSubmit()}
      onClick={(e) => {
        // ضغطة تانية على قسم مختار = قفله (رجوع لـ «الكل»)
        const t = e.target as HTMLInputElement;
        if (t.tagName === 'INPUT' && t.type === 'radio' && t.name === 'category' && t.dataset.was === 'true') {
          const all = e.currentTarget.querySelector<HTMLInputElement>('input[name="category"][value=""]');
          if (all) { all.checked = true; e.currentTarget.requestSubmit(); }
        }
      }}>
      {children}
    </form>
  );
}
