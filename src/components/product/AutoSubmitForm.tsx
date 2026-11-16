'use client';

import type { ReactNode } from 'react';

/** نموذج فلاتر بيتطبّق لوحده بمجرد ما تغيّر أي اختيار (من غير زرار تطبيق) */
export default function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form action="/products" method="get" className={className} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
    </form>
  );
}
